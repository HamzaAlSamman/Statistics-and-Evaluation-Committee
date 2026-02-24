const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const PORT = 3000;

// المجلدات
const PUBLIC_DIR = path.join(__dirname, 'uploads', 'public');
const PENDING_DIR = path.join(__dirname, 'uploads', 'pending');
const GALLERY_JSON = path.join(PUBLIC_DIR, 'gallery.json');

// إنشاء المجلدات إذا لم تكن موجودة
if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/temp', express.static(PENDING_DIR));

// 1. السماح للمتصفح بالوصول إلى مجلد الصور العامة
app.use('/public', express.static(PUBLIC_DIR));

// 2. إنشاء مسار جديد لجلب أسماء الصور الموجودة في المعرض لعرضها للمستخدمين
app.get('/gallery', (req, res) => {
    // نطلب من الخادم قراءة محتويات المجلد مباشرة
    fs.readdir(PUBLIC_DIR, (err, files) => {
        if (err) return res.status(500).json({ message: 'حدث خطأ في قراءة مجلد الصور' });

        // تصفية الملفات لجلب الصور فقط (وتجاهل ملفات مثل gallery.json)
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

        // إرسال قائمة بأسماء الصور إلى واجهة الموقع
        res.json(imageFiles);
    });
});

// إعداد التخزين للصور المعلقة في الذاكرة لتتم معالجتها بواسطة sharp
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 1. رفع صورة (من المستخدم) وضغطها
app.post('/upload', upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const webpFilename = `${uuidv4()}.webp`;
        const filePath = path.join(PENDING_DIR, webpFilename);

        // Resize and compress the image using sharp
        await sharp(req.file.buffer)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filePath);

        res.json({ message: 'Uploaded and compressed successfully', filename: webpFilename });
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء معالجة الصورة ضغطاً' });
    }
});

// 2. جلب الصور المعلقة (للآدمن)
app.get('/pending', (req, res) => {
    fs.readdir(PENDING_DIR, (err, files) => {
        if (err) return res.status(500).json({ message: 'Error reading directory' });
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
        res.json(imageFiles);
    });
});

// 3. الموافقة على صورة (نقلها إلى public وتحديث JSON)
app.post('/approve', (req, res) => {
    // 1. حماية من الطلبات الفارغة
    if (!req.body || !req.body.filename) {
        return res.status(400).json({ message: 'خطأ: اسم الملف غير موجود' });
    }

    const { filename } = req.body;
    const oldPath = path.join(PENDING_DIR, filename);
    const newPath = path.join(PUBLIC_DIR, filename);

    // 2. التحقق من وجود الصورة قبل نقلها
    if (!fs.existsSync(oldPath)) return res.status(404).json({ message: 'الصورة غير موجودة أو تم نقلها مسبقاً' });

    // نقل الملف
    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.status(500).json({ message: 'حدث خطأ أثناء نقل الصورة' });

        // تحديث gallery.json بشكل آمن
        fs.readFile(GALLERY_JSON, 'utf8', (err, data) => {
            let gallery = { files: [] };

            if (!err && data) {
                try {
                    // محاولة قراءة الملف، وإذا كان فيه خطأ لن ينهار السيرفر بل سيذهب للـ catch
                    gallery = JSON.parse(data);
                } catch (parseError) {
                    console.error('تم اكتشاف خطأ في ملف JSON، سيتم تفريغه لتجنب انهيار النظام.');
                    gallery = { files: [] };
                }
            }

            // التأكد من أن المصفوفة موجودة (حماية إضافية)
            if (!gallery.files) gallery.files = [];

            // التأكد من عدم إضافة نفس الصورة مرتين
            if (!gallery.files.includes(filename)) {
                gallery.files.unshift(filename);
            }

            fs.writeFile(GALLERY_JSON, JSON.stringify(gallery, null, 2), (err) => {
                if (err) return res.status(500).json({ message: 'حدث خطأ أثناء حفظ التحديث' });
                res.json({ message: 'Approved and published' });
            });
        });
    });
});

// 4. رفض صورة (حذفها)
app.post('/reject', (req, res) => {
    if (!req.body || !req.body.filename) {
        return res.status(400).json({ message: 'خطأ: اسم الملف غير موجود' });
    }

    const { filename } = req.body;
    const filePath = path.join(PENDING_DIR, filename);

    // إذا كانت الصورة محذوفة أصلاً، نخبر الواجهة بنجاح العملية لكي تخفيها من الشاشة
    if (!fs.existsSync(filePath)) {
        return res.json({ message: 'الصورة غير موجودة أو حُذفت مسبقاً' });
    }

    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ message: 'حدث خطأ أثناء حذف الصورة' });
        res.json({ message: 'Rejected and deleted' });
    });
});

// ─── Books API ─────────────────────────────────────────────────────────────
const BOOKS_PENDING_JSON = path.join(__dirname, 'uploads', 'books_pending.json');
const BOOKS_APPROVED_JSON = path.join(__dirname, 'uploads', 'books_approved.json');

function readJson(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { }
    return fallback;
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// POST /books/submit  { title: "عنوان الكتاب" }
app.post('/books/submit', (req, res) => {
    const title = (req.body && req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'يرجى إدخال عنوان الكتاب' });
    if (title.length > 200) return res.status(400).json({ message: 'العنوان طويل جداً' });

    const pending = readJson(BOOKS_PENDING_JSON, []);
    const entry = { id: uuidv4(), title, submittedAt: new Date().toISOString() };
    pending.push(entry);
    writeJson(BOOKS_PENDING_JSON, pending);
    res.json({ message: 'تم استلام إدخالك بنجاح وسيظهر بعد المراجعة' });
});

// GET /books/pending  (admin)
app.get('/books/pending', (_req, res) => {
    res.json(readJson(BOOKS_PENDING_JSON, []));
});

// POST /books/approve  { id: "uuid" }
app.post('/books/approve', (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ message: 'id مطلوب' });

    let pending = readJson(BOOKS_PENDING_JSON, []);
    const idx = pending.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ message: 'الإدخال غير موجود' });

    const [entry] = pending.splice(idx, 1);
    writeJson(BOOKS_PENDING_JSON, pending);

    // Merge into approved (case-insensitive, trimmed)
    const approved = readJson(BOOKS_APPROVED_JSON, []);
    const normalised = entry.title.trim().toLowerCase();
    const existing = approved.find(a => a.title.trim().toLowerCase() === normalised);
    if (existing) {
        existing.count = (existing.count || 1) + 1;
    } else {
        approved.push({ title: entry.title.trim(), count: 1 });
    }
    writeJson(BOOKS_APPROVED_JSON, approved);
    res.json({ message: 'تمت الموافقة ونشر الكتاب' });
});

// POST /books/reject  { id: "uuid" }
app.post('/books/reject', (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ message: 'id مطلوب' });

    let pending = readJson(BOOKS_PENDING_JSON, []);
    const idx = pending.findIndex(e => e.id === id);
    if (idx === -1) return res.json({ message: 'الإدخال غير موجود أو حُذف مسبقاً' });

    pending.splice(idx, 1);
    writeJson(BOOKS_PENDING_JSON, pending);
    res.json({ message: 'تم الرفض والحذف' });
});

// GET /books/approved  (public)
app.get('/books/approved', (_req, res) => {
    res.json(readJson(BOOKS_APPROVED_JSON, []));
});
// ─── End Books API ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Pending photos folder: ${PENDING_DIR}`);
});
