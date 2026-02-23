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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Pending photos folder: ${PENDING_DIR}`);
});
