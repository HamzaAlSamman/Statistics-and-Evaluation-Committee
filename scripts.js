/* scripts.js (Pro UI / Mobile-first / English numbers / Hover details)
   Notes:
   - Comments in English
   - No emojis in code
*/

(() => {
  "use strict";

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Always format numbers in English
  const formatNumber = (n, decimals = 0) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    try {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    } catch {
      return String(num);
    }
  };

  const rafThrottle = (fn) => {
    let ticking = false;
    return (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        fn(...args);
      });
    };
  };

  // -------------------------
  // Header + Mobile menu (robust)
  // -------------------------
  const setupHeaderAndMenu = () => {
    const header = $(".site-header");
    const btn = $("#menuBtn");
    const nav = $("#nav");

    if (header) {
      // Hardening against z-index / overlap issues
      header.style.width = "100%";
      header.style.left = "0";
      header.style.right = "0";
      header.style.zIndex = "999";
      header.style.position = header.style.position || "sticky";
      header.style.top = header.style.top || "0";
    }

    if (!btn || !nav) return;

    let isOpen = false;

    const setOpen = (open) => {
      isOpen = !!open;
      nav.classList.toggle("open", isOpen);
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      nav.setAttribute("aria-hidden", isOpen ? "false" : "true");

      // Fallback in case CSS isn't applying properly
      if (window.matchMedia("(max-width: 1024px)").matches) {
        nav.style.display = isOpen ? "block" : "none";
      } else {
        nav.style.display = "";
      }

      document.documentElement.classList.toggle("nav-open", isOpen);
    };

    // Click sometimes fails due to overlay/scroll; handle pointerdown too
    const toggle = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      setOpen(!isOpen);
    };

    btn.addEventListener("pointerdown", toggle, { passive: false });
    btn.addEventListener("click", toggle, { passive: false });

    // Close when clicking a link (mobile)
    $$(".nav-link", nav).forEach((a) => {
      a.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 1024px)").matches) setOpen(false);
      });
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    // Reset on resize
    window.addEventListener(
      "resize",
      rafThrottle(() => {
        if (!window.matchMedia("(max-width: 1024px)").matches) {
          nav.style.display = "";
          setOpen(false);
        } else {
          // Ensure closed state doesn't keep nav visible
          nav.style.display = isOpen ? "block" : "none";
        }
      }),
      { passive: true }
    );

    // Init closed on mobile
    if (window.matchMedia("(max-width: 1024px)").matches) {
      nav.style.display = "none";
      nav.setAttribute("aria-hidden", "true");
    }
  };

  // -------------------------
  // Header shadow on scroll
  // -------------------------
  const setupHeaderScroll = () => {
    const header = $(".site-header");
    if (!header) return;

    const onScroll = rafThrottle(() => {
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    });

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  };

  // -------------------------
  // Smooth anchors
  // -------------------------
  const setupSmoothAnchors = () => {
    const links = $$('a[href^="#"]:not([href="#"])');
    if (!links.length) return;

    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (!id) return;

        const target = $(id);
        if (!target) return;

        if (prefersReducedMotion) return;

        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", id);
      });
    });
  };

  // -------------------------
  // Active nav link (scroll spy)
  // -------------------------
  const setupActiveNav = () => {
    const nav = $("#nav");
    if (!nav) return;

    const links = $$(".nav-link", nav);
    const map = new Map();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      map.set(href.slice(1), a);
    });

    const sections = Array.from(map.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return;

    const setActive = (id) => {
      links.forEach((a) => a.classList.remove("active"));
      const a = map.get(id);
      if (a) a.classList.add("active");
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((x) => x.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!visible?.target?.id) return;
        setActive(visible.target.id);
      },
      { threshold: [0.25, 0.4, 0.55], rootMargin: "-20% 0px -60% 0px" }
    );

    sections.forEach((s) => io.observe(s));
    setActive(sections[0].id);
  };

  // -------------------------
  // Reveal on scroll
  // -------------------------
  const setupReveal = () => {
    const items = $$(".reveal");
    if (!items.length) return;

    if (prefersReducedMotion) {
      items.forEach((el) => el.classList.add("show"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("show");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.12 }
    );

    items.forEach((el) => io.observe(el));
  };

  // -------------------------
  // Count-up (English digits everywhere)
  // -------------------------
  const parseNumberText = (text) => {
    const raw = String(text ?? "").trim();
    if (!raw) return null;

    // Skip ranges like "3 - 5"
    if (raw.includes("-") && /\d\s*-\s*\d/.test(raw)) return null;

    const prefixMatch = raw.match(/^[^\d+\-.,]+|^\+/);
    const prefix = prefixMatch ? prefixMatch[0] : "";

    const suffixMatch = raw.match(/[^\d+\-.,]+$|\+$/);
    const suffix = suffixMatch ? suffixMatch[0] : "";

    const core = raw.replace(prefix, "").replace(suffix, "").trim();
    if (!core) return null;

    // Keep compact suffix as display suffix (do NOT multiply)
    const suffixUpper = String(suffix).toUpperCase();
    const isCompact = suffixUpper.includes("K") || suffixUpper.includes("M");

    const core2 = core.replace(/,/g, "");
    const num = Number(core2);
    if (!Number.isFinite(num)) return null;

    const decimals = (core2.split(".")[1] || "").length;

    return {
      value: num, // display value
      prefix,
      suffix: isCompact ? suffix : suffix, // keep as-is
      decimals: clamp(decimals, 0, 6),
    };
  };

  const animateNumber = (el, end, opts) => {
    const { decimals = 0, prefix = "", suffix = "", duration = 900 } = opts || {};
    const dur = prefersReducedMotion ? 0 : clamp(duration, 200, 4000);
    const t0 = performance.now();
    const start = 0;

    const step = (t) => {
      const p = dur === 0 ? 1 : clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = lerp(start, end, eased);
      el.textContent = prefix + formatNumber(v, decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const setupCountUps = () => {
    const explicit = $$(".count-up,[data-count]");
    const autoCandidates = [
      ...$$(".stat-value"),
      ...$$(".kid-num"),
      ...$$(".mini-card-value"),
      ...$$(".counter"),
    ].filter((el) => !el.hasAttribute("data-count"));

    const targets = [...new Set([...explicit, ...autoCandidates])];
    if (!targets.length) return;

    const run = (el) => {
      const hasDataCount = el.hasAttribute("data-count");

      if (hasDataCount) {
        const raw = el.getAttribute("data-count") || "0";
        const end = Number(String(raw).replace(/[^\d.]/g, ""));
        if (!Number.isFinite(end)) return;

        const decimals = clamp(Number(el.getAttribute("data-decimals") || "0"), 0, 6);
        const prefix = el.getAttribute("data-prefix") || "";
        const suffix = el.getAttribute("data-suffix") || "";
        const duration = Number(el.getAttribute("data-duration") || "1100");

        animateNumber(el, end, { decimals, prefix, suffix, duration });
        return;
      }

      const p = parseNumberText(el.textContent);
      if (!p) return;

      // If percent: keep 0 decimals
      const isPercent = String(p.suffix).includes("%");
      const decimals = isPercent ? 0 : p.decimals;

      animateNumber(el, p.value, {
        decimals,
        prefix: p.prefix,
        suffix: p.suffix,
        duration: 900,
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          run(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.6 }
    );

    targets.forEach((el) => io.observe(el));
  };

  // -------------------------
  // Chart.js (English ticks)
  // -------------------------
  const setupCharts = () => {
    if (!window.Chart) return;

    Chart.defaults.font.family = "Tajawal";
    Chart.defaults.color = "#334155";
    Chart.defaults.animation.duration = prefersReducedMotion ? 0 : 950;
    Chart.defaults.animation.easing = "easeOutQuart";
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.titleFont = { family: "Tajawal", weight: "900" };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "Tajawal", weight: "700" };

    const createChart = (id, config) => {
      const canvas = document.getElementById(id);
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      return new Chart(ctx, config);
    };

    createChart("publishersGeoChart", {
      type: "pie",
      data: {
        labels: ["السعودية", "الأردن", "الإمارات", "الكويت", "سوريا", "أخرى"],
        datasets: [{ data: [39, 31, 18, 16, 102, 124] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const arr = ctx.dataset.data || [];
                const sum = arr.reduce((a, b) => a + Number(b || 0), 0) || 1;
                const v = Number(ctx.raw || 0);
                const pct = (v / sum) * 100;
                return `${ctx.label}: ${formatNumber(v)} (${pct.toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });

    createChart("ageChart", {
      type: "bar",
      data: {
        labels: ["18-25", "26-35", "36-45", "45+"],
        datasets: [{ label: "الفئات العمرية", data: [2700, 2100, 950, 750] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => formatNumber(v) } },
          x: { grid: { display: false } },
        },
      },
    });

    createChart("geoChart", {
      type: "doughnut",
      data: {
        labels: ["دمشق", "ريف دمشق", "إدلب", "حلب", "أخرى"],
        datasets: [{ data: [54, 26, 7, 6, 7] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatNumber(ctx.raw)}%` } },
        },
      },
    });

    createChart("jobChart", {
      type: "bar",
      data: {
        labels: ["الطلاب", "الأفراد", "العائلات", "أخرى"],
        datasets: [{ label: "توزع الزوار المهني", data: [45, 20, 25, 10] }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: (v) => `${formatNumber(v)}%` } },
          y: { grid: { display: false } },
        },
      },
    });

    createChart("satisfactionRadar", {
      type: "radar",
      data: {
        labels: ["تعامل الموظفين", "التنظيم والنظافة", "الموقع والوصول", "تنوع دور النشر", "الخدمات والطعام"],
        datasets: [{ label: "مقياس الرضا (5)", data: [3.7, 3.6, 3.4, 4.2, 3.0], fill: true }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: { min: 0, max: 5, ticks: { stepSize: 1, callback: (v) => formatNumber(v) } },
        },
      },
    });

    createChart("delegationChart", {
      type: "pie",
      data: {
        labels: ["رسمية سورية", "دولية", "نقابات وجامعات"],
        datasets: [{ data: [45, 30, 25] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });

    createChart("programChart", {
      type: "bar",
      data: {
        labels: ["إجمالي الفعاليات", "فعاليات عبر الأجنحة", "حفلات توقيع", "متوسط حضور/فعالية"],
        datasets: [{ label: "قيمة المؤشر", data: [650, 420, 400, 300] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => formatNumber(v) } },
          x: { grid: { display: false } },
        },
      },
    });

    createChart("viewsByPlatformChart", {
      type: "bar",
      data: {
        labels: ["فيسبوك", "إنستغرام", "تيليغرام", "X", "يوتيوب"],
        datasets: [{ label: "إجمالي المشاهدات", data: [15950556, 18211223, 267840, 1845206, 978173] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (value) => {
                const v = Number(value);
                if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
                return formatNumber(v);
              },
            },
          },
          x: { grid: { display: false } },
        },
      },
    });

    createChart("engagementVsPostsChart", {
      type: "bar",
      data: {
        labels: ["فيسبوك", "إنستغرام", "تيليغرام", "X", "يوتيوب"],
        datasets: [
          { label: "المنشورات", data: [1046, 802, 1210, 457, 22] },
          { label: "التفاعلات", data: [973605, 649883, 108000, 132327, 3072] },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: (v) => formatNumber(v) } },
          x: { grid: { display: false } },
        },
      },
    });
  };

  // -------------------------
  // Heatmap / SVG (Hover = auto details)
  // -------------------------
  const setupHeatmap = () => {
    const mapContainer = $("#map-container");
    const svgMount = $("#svgMount");
    const tooltip = $("#tooltip");
    const slider = $("#timeSlider");
    const playBtn = $("#playBtn");
    const dateDisplay = $("#dateDisplay");
    const counterSpan = $("#counterSpan");

    if (!mapContainer || !svgMount || !tooltip || !slider || !playBtn || !dateDisplay || !counterSpan) return;

    const hallPanel = $("#hallPanel");
    const overlay = $("#overlay");
    const hallPanelClose = $("#hallPanelClose");
    const hallPanelTitle = $("#hallPanelTitle");
    const hallPanelSub = $("#hallPanelSub");
    const hallMetricDensity = $("#hallMetricDensity");
    const hallMetricVisitors = $("#hallMetricVisitors");
    const hallMetricEvents = $("#hallMetricEvents");

    const setOverlay = (open) => {
      if (!overlay) return;
      overlay.classList.toggle("open", open);
      overlay.setAttribute("aria-hidden", open ? "false" : "true");
    };

    const setPanel = (open) => {
      if (!hallPanel) return;
      hallPanel.classList.toggle("open", open);
      hallPanel.setAttribute("aria-hidden", open ? "false" : "true");
      setOverlay(open);
    };

    overlay?.addEventListener("click", () => setPanel(false));
    hallPanelClose?.addEventListener("click", () => setPanel(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setPanel(false);
    });

    const hallNames = {
      H1: "القاعة الأولى",
      H2: "قاعة الطفل (الثالثة)",
      H10: "قاعة الشباب (الرابعة)",
      H11: "القاعة السادسة",
      H25: "قاعة الفكر (الثانية)",
      H26: "قاعة المعرفة (الخامسة)",
      H27: "صالة المطاعم",
      H28: "قاعة الفعاليات الثالثة",
      "H1.1": "منتدى دمشق الثقافي",
      "H10.1": "الصالون الثقافي",
      H41: "قاعة الجامعات الخاصة",
      "12": "القاعة 12",
      VIP: "القاعة الرئاسية (VIP)",
      PR: "المركز الإعلامي",
    };

    const dailyData = [
      { day: "6 شباط (الافتتاح)", target: 58450, events: { "H1.1": 3, "H10.1": 2, H28: 2 },
        densities: { H1: 65, H2: 85, H10: 80, H11: 55, H25: 60, H26: 50, H27: 60, H28: 40, "H1.1": 45, "H10.1": 35, H41: 40, "12": 35, VIP: 5, PR: 40 } },
      { day: "7 شباط", target: 47563, events: { "H1.1": 9, "H10.1": 8, H28: 6 },
        densities: { H1: 70, H2: 88, H10: 85, H11: 60, H25: 65, H26: 55, H27: 65, H28: 80, "H1.1": 85, "H10.1": 85, H41: 45, "12": 40, VIP: 8, PR: 45 } },
      { day: "8 شباط", target: 65725, events: { "H1.1": 9, "H10.1": 3, H28: 4 },
        densities: { H1: 80, H2: 95, H10: 92, H11: 70, H25: 75, H26: 65, H27: 75, H28: 60, "H1.1": 85, "H10.1": 45, H41: 55, "12": 50, VIP: 12, PR: 50 } },
      { day: "9 شباط", target: 82300, events: { "H1.1": 4, "H10.1": 2, H28: 3 },
        densities: { H1: 82, H2: 96, H10: 95, H11: 72, H25: 78, H26: 68, H27: 78, H28: 50, "H1.1": 55, "H10.1": 35, H41: 60, "12": 55, VIP: 10, PR: 55 } },
      { day: "10 شباط", target: 94150, events: { "H1.1": 4, "H10.1": 3, H28: 5 },
        densities: { H1: 85, H2: 98, H10: 96, H11: 75, H25: 82, H26: 72, H27: 82, H28: 65, "H1.1": 55, "H10.1": 45, H41: 35, "12": 30, VIP: 5, PR: 35 } },
      { day: "11 شباط", target: 112600, events: { "H1.1": 4, "H10.1": 2, H28: 5 },
        densities: { H1: 88, H2: 100, H10: 98, H11: 80, H25: 85, H26: 78, H27: 85, H28: 65, "H1.1": 55, "H10.1": 35, H41: 40, "12": 35, VIP: 6, PR: 40 } },
      { day: "12 شباط", target: 158400, events: { "H1.1": 5, "H10.1": 3, H28: 5 },
        densities: { H1: 90, H2: 100, H10: 100, H11: 85, H25: 90, H26: 85, H27: 90, H28: 80, "H1.1": 65, "H10.1": 45, H41: 45, "12": 40, VIP: 8, PR: 45 } },
      { day: "13 شباط (ذروة الزحام)", target: 245500, events: { "H1.1": 8, "H10.1": 6, H28: 7 },
        densities: { H1: 98, H2: 100, H10: 100, H11: 95, H25: 98, H26: 96, H27: 98, H28: 95, "H1.1": 92, "H10.1": 88, H41: 85, "12": 87, VIP: 15, PR: 90 } },
      { day: "14 شباط", target: 198200, events: { "H1.1": 5, "H10.1": 4, H28: 4 },
        densities: { H1: 92, H2: 100, H10: 100, H11: 88, H25: 94, H26: 88, H27: 92, H28: 85, "H1.1": 65, "H10.1": 55, H41: 55, "12": 50, VIP: 10, PR: 55 } },
      { day: "15 شباط", target: 181812, events: { "H1.1": 4, "H10.1": 3, H28: 3 },
        densities: { H1: 88, H2: 100, H10: 100, H11: 82, H25: 88, H26: 80, H27: 88, H28: 75, "H1.1": 55, "H10.1": 45, H41: 65, "12": 60, VIP: 8, PR: 60 } },
      { day: "16 شباط (الختام)", target: 45300, events: { "H1.1": 1, "H10.1": 1, H28: 1 },
        densities: { H1: 45, H2: 65, H10: 60, H11: 35, H25: 40, H26: 30, H27: 55, H28: 30, "H1.1": 25, "H10.1": 25, H41: 15, "12": 15, VIP: 3, PR: 25 } },
    ];

    const getHeatColor = (value) => {
      const v = Number(value) || 0;
      if (v >= 85) return "rgba(215, 48, 39, 0.85)";
      if (v >= 70) return "rgba(252, 141, 89, 0.85)";
      if (v >= 50) return "rgba(254, 224, 139, 0.85)";
      if (v >= 30) return "rgba(166, 217, 106, 0.85)";
      return "rgba(26, 152, 80, 0.85)";
    };

    // Stable PRNG
    const seeded01 = (seedStr) => {
      let h = 2166136261;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      h ^= h << 13; h ^= h >> 17; h ^= h << 5;
      return ((h >>> 0) % 10000) / 10000;
    };

    const computeVisitorsForDay = (dayIndex) => {
      const today = dailyData[dayIndex];
      const totalTarget = today.target;

      const fixedRooms = ["VIP", "PR", "H41", "H1.1", "H10.1", "H28"];

      const vipDensity = today.densities.VIP ?? 5;
      const prDensity = today.densities.PR ?? 40;
      const h41Density = today.densities.H41 ?? 40;

      const vipVisitors = Math.floor(20 + (vipDensity / 100) * 170);
      const prVisitors = Math.floor(200 + (prDensity / 100) * 200);
      const h41Visitors = Math.floor(300 + (h41Density / 100) * 400);

      const out = { VIP: vipVisitors, PR: prVisitors, H41: h41Visitors };

      const eventHalls = ["H1.1", "H10.1", "H28"];
      let eventsVisitorsTotal = 0;

      eventHalls.forEach((hall) => {
        const numEvents = today.events[hall] ?? 0;
        if (numEvents > 0) {
          const seed = seeded01(`${dayIndex}:${hall}`);
          let occupancy = 0.60 + seed * 0.35;
          if ((today.densities[hall] ?? 0) >= 80) occupancy = 0.90 + seed * 0.08;
          const hallVisitors = Math.floor(numEvents * 250 * occupancy);
          out[hall] = hallVisitors;
          eventsVisitorsTotal += hallVisitors;
        } else {
          out[hall] = Math.floor(10 + seeded01(`${dayIndex}:${hall}:idle`) * 50);
        }
      });

      const remaining = totalTarget - (vipVisitors + prVisitors + h41Visitors + eventsVisitorsTotal);

      let sumDensities = 0;
      const roomKeys = Object.keys(today.densities).filter((id) => !fixedRooms.includes(id));
      roomKeys.forEach((id) => (sumDensities += (today.densities[id] ?? 0)));
      sumDensities = sumDensities || 1;

      let cur = 0;
      roomKeys.forEach((id, idx) => {
        const density = today.densities[id] ?? 0;
        let alloc = Math.floor(remaining * (density / sumDensities));
        if (idx === roomKeys.length - 1) alloc = remaining - cur;
        out[id] = alloc;
        cur += alloc;
      });

      return out;
    };

    // Tooltip positioning (clamped inside map)
    const positionTooltip = (e) => {
      const rect = mapContainer.getBoundingClientRect();

      // Cursor position relative to the map container
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Tooltip size (still measurable when hidden via opacity)
      const ttW = tooltip.offsetWidth || 220;
      const ttH = tooltip.offsetHeight || 110;

      const pad = 12;
      const offset = 18;

      // Default: bottom-right of cursor
      let left = x + offset;
      let top = y + offset;

      // Flip when close to edges
      if (left + ttW + pad > rect.width) left = x - ttW - offset;
      if (top + ttH + pad > rect.height) top = y - ttH - offset;

      // Clamp inside container
      left = clamp(left, pad, rect.width - ttW - pad);
      top = clamp(top, pad, rect.height - ttH - pad);

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    const animateCounter = (el, endValue) => {
      const end = Number(endValue) || 0;
      const dur = prefersReducedMotion ? 0 : 520;
      const t0 = performance.now();

      const step = (t) => {
        const p = dur === 0 ? 1 : clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = Math.round(end * eased);
        el.textContent = formatNumber(v);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const applyFillDeep = (rootEl, color) => {
      if (!rootEl) return;
      rootEl.style.setProperty("fill", color, "important");
      const inner = rootEl.querySelectorAll?.("rect, polygon, path, circle, ellipse");
      inner?.forEach((n) => n.style.setProperty("fill", color, "important"));
    };

    let calculatedVisitors = {};
    let hoverCloseTimer = null;

    const openPanelWithData = (roomId, dayIdx, density) => {
      const activeDay = dailyData[dayIdx];
      const vis = calculatedVisitors?.[roomId] ?? 0;
      const ev = activeDay?.events?.[roomId] ?? 0;
      const d = Number(density ?? activeDay?.densities?.[roomId] ?? 0);

      if (hallPanelTitle) hallPanelTitle.textContent = hallNames[roomId] || roomId;
      if (hallPanelSub) hallPanelSub.textContent = activeDay?.day ?? "";
      if (hallMetricDensity) hallMetricDensity.textContent = `${formatNumber(d)}%`;
      if (hallMetricVisitors) hallMetricVisitors.textContent = formatNumber(vis);
      if (hallMetricEvents) hallMetricEvents.textContent = formatNumber(ev);

      setPanel(true);
    };

    const bindHall = (roomId, el) => {
      if (!el || el.dataset.bound) return;
      el.dataset.bound = "1";

      // Hover highlight
      const setHoverStroke = (on) => {
        if (!on) {
          el.style.removeProperty("stroke");
          el.style.removeProperty("stroke-width");
          el.style.removeProperty("filter");
          return;
        }
        el.style.setProperty("stroke", "rgba(15,23,42,.75)", "important");
        el.style.setProperty("stroke-width", "2px", "important");
        el.style.setProperty("filter", "drop-shadow(0 10px 20px rgba(2,6,23,.14))", "important");
      };

      el.addEventListener("mousemove", (e) => {
        positionTooltip(e);

        const dayIdx = Number(slider.value) || 0;
        const activeDay = dailyData[dayIdx];
        const d = activeDay?.densities?.[roomId] ?? 0;
        const vis = calculatedVisitors?.[roomId] ?? 0;

        $("#tt-name") && ($("#tt-name").textContent = hallNames[roomId] || roomId);
        $("#densityVal") && ($("#densityVal").textContent = `${formatNumber(d)}%`);
        $("#visitorsVal") && ($("#visitorsVal").textContent = formatNumber(vis));

        tooltip.setAttribute("aria-hidden", "false");
      });

      el.addEventListener("mouseleave", () => {
        tooltip.setAttribute("aria-hidden", "true");
        setHoverStroke(false);

        // Close panel after small delay (prevents flicker)
        clearTimeout(hoverCloseTimer);
        hoverCloseTimer = setTimeout(() => setPanel(false), 220);
      });

      el.addEventListener("mouseenter", (e) => {
        clearTimeout(hoverCloseTimer);
        setHoverStroke(true);

        // Show tooltip immediately on enter (not only after first mousemove)
        if (e) {
          positionTooltip(e);

          const dayIdx = Number(slider.value) || 0;
          const activeDay = dailyData[dayIdx];
          const d = activeDay?.densities?.[roomId] ?? 0;
          const vis = calculatedVisitors?.[roomId] ?? 0;

          $("#tt-name") && ($("#tt-name").textContent = hallNames[roomId] || roomId);
          $("#densityVal") && ($("#densityVal").textContent = `${formatNumber(d)}%`);
          $("#visitorsVal") && ($("#visitorsVal").textContent = formatNumber(vis));

          tooltip.setAttribute("aria-hidden", "false");
        }

        const dayIdx = Number(slider.value) || 0;
        const activeDay = dailyData[dayIdx];
        const density = activeDay?.densities?.[roomId] ?? 0;

        // Auto-open details on hover
        openPanelWithData(roomId, dayIdx, density);
      });

      // Mobile fallback: touch/click opens
      el.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") {
          const dayIdx = Number(slider.value) || 0;
          const activeDay = dailyData[dayIdx];
          const density = activeDay?.densities?.[roomId] ?? 0;
          openPanelWithData(roomId, dayIdx, density);
        }
      });
    };

    const updateMap = (dayIndex) => {
      const idx = clamp(Number(dayIndex) || 0, 0, dailyData.length - 1);
      const today = dailyData[idx];

      dateDisplay.textContent = today.day;
      calculatedVisitors = computeVisitorsForDay(idx);

      Object.entries(today.densities).forEach(([roomId, density]) => {
        const el = document.getElementById(roomId);
        if (!el) return;
        applyFillDeep(el, getHeatColor(density));
        bindHall(roomId, el);
      });

      animateCounter(counterSpan, today.target);
    };

    const bootIfSVGExists = () => {
      const hasSVG = !!$("svg", svgMount);
      if (!hasSVG) return false;

      slider.min = "0";
      slider.max = String(dailyData.length - 1);
      slider.step = "1";

      slider.addEventListener("input", () => updateMap(slider.value), { passive: true });

      let isPlaying = false;
      let playTimer = null;

      const setPlayUI = () => {
        playBtn.textContent = isPlaying ? "إيقاف مؤقت" : "تشغيل العرض";
        playBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      };

      const stopPlay = () => {
        isPlaying = false;
        if (playTimer) clearTimeout(playTimer);
        playTimer = null;
        setPlayUI();
      };

      const runPlay = () => {
        if (!isPlaying) return;

        const cur = Number(slider.value) || 0;
        if (cur >= dailyData.length - 1) {
          stopPlay();
          playBtn.textContent = "إرجاع للبداية";
          return;
        }

        slider.value = String(cur + 1);
        updateMap(slider.value);

        playTimer = setTimeout(runPlay, prefersReducedMotion ? 0 : 1400);
      };

      playBtn.addEventListener("click", () => {
        if (!isPlaying && playBtn.textContent.includes("إرجاع")) {
          slider.value = "0";
          updateMap(0);
          playBtn.textContent = "تشغيل العرض";
        }

        isPlaying = !isPlaying;
        setPlayUI();

        if (isPlaying) {
          if (Number(slider.value) >= dailyData.length - 1) {
            slider.value = "0";
            updateMap(0);
          }
          runPlay();
        } else {
          stopPlay();
        }
      });

      // Keep panel open if user hovers it
      hallPanel?.addEventListener("mouseenter", () => {
        clearTimeout(hoverCloseTimer);
      });
      hallPanel?.addEventListener("mouseleave", () => {
        clearTimeout(hoverCloseTimer);
        hoverCloseTimer = setTimeout(() => setPanel(false), 220);
      });

      updateMap(0);
      return true;
    };

    if (!bootIfSVGExists()) {
      const mo = new MutationObserver(() => {
        if (bootIfSVGExists()) mo.disconnect();
      });
      mo.observe(svgMount, { childList: true, subtree: true });
    }
  };


  // -------------------------
  // Boot
  // -------------------------
  document.addEventListener("DOMContentLoaded", () => {
    setupHeaderAndMenu();
    setupHeaderScroll();
    setupSmoothAnchors();
    setupActiveNav();
    setupReveal();
    setupCountUps();
    setupCharts();
    setupHeatmap();
  });
})();
