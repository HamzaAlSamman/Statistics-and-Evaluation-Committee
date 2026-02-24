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

  const isIOS = () => {
    const ua = navigator.userAgent || "";
    const iOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return !!iOSDevice;
  };

  // -------------------------
  // Header + Mobile menu (robust + iOS scroll lock)
  // -------------------------
  const setupHeaderAndMenu = () => {
    const btn = document.getElementById("menuBtn");
    const nav = document.getElementById("nav");
    let overlay = document.getElementById("navOverlay");

    if (!btn || !nav) return;

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "navOverlay";
      overlay.className = "nav-overlay";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }

    // Ensure overlay is always above page content but under nav
    overlay.style.touchAction = "none";

    let isOpen = false;
    let lastFocus = null;

    // iOS: lock scroll reliably
    let savedScrollY = 0;

    const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

    const focusableSelector =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const lockScroll = () => {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.classList.add("nav-open");

      // iOS needs fixed body to prevent background scroll
      if (isIOS()) {
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
      }
    };

    const unlockScroll = () => {
      document.body.classList.remove("nav-open");

      if (isIOS()) {
        const top = document.body.style.top;
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";

        const y = Math.abs(parseInt(top || "0", 10)) || savedScrollY || 0;
        window.scrollTo(0, y);
      }
    };

    const closeOtherPanelsIfAny = () => {
      // If you have other overlays/panels, close them here to avoid click-blocking.
      const hallPanel = document.getElementById("hallPanel");
      const hallOverlay = document.getElementById("overlay");
      if (hallPanel?.classList.contains("open")) {
        hallPanel.classList.remove("open");
        hallPanel.setAttribute("aria-hidden", "true");
      }
      if (hallOverlay?.classList.contains("open")) {
        hallOverlay.classList.remove("open");
        hallOverlay.setAttribute("aria-hidden", "true");
      }
    };

    const setOpen = (open) => {
      // Desktop: force closed
      if (!isMobile()) open = false;

      const next = !!open;
      if (next === isOpen) return;
      isOpen = next;

      if (isOpen) {
        closeOtherPanelsIfAny();
        lastFocus = document.activeElement;
        lockScroll();
      } else {
        unlockScroll();
      }

      nav.classList.toggle("open", isOpen);
      overlay.classList.toggle("open", isOpen);

      btn.classList.toggle("is-open", isOpen);

      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      btn.setAttribute("aria-label", isOpen ? "إغلاق القائمة" : "فتح القائمة");

      nav.setAttribute("aria-hidden", isOpen ? "false" : "true");
      overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");

      if (isOpen) {
        const firstFocusable =
          nav.querySelector(".nav-link") || nav.querySelector(focusableSelector);
        firstFocusable?.focus?.();
      } else {
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
        else btn.focus();
      }
    };

    // Toggle by button
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setOpen(!isOpen);
    });

    // Click on overlay closes
    overlay.addEventListener("click", () => setOpen(false));

    // Clicking a link closes (mobile)
    nav.querySelectorAll(".nav-link").forEach((a) => {
      a.addEventListener("click", () => setOpen(false));
    });

    // Close on outside click (extra safety, in case overlay isn't covering due to styling changes)
    document.addEventListener("click", (e) => {
      if (!isOpen) return;
      if (!isMobile()) return;
      const t = e.target;
      if (nav.contains(t) || btn.contains(t) || overlay.contains(t)) return;
      setOpen(false);
    });

    // Esc + focus trap
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);

      if (!isOpen || !isMobile() || e.key !== "Tab") return;

      const focusables = Array.from(nav.querySelectorAll(focusableSelector));
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Resize: close on desktop
    window.addEventListener(
      "resize",
      rafThrottle(() => {
        if (!isMobile()) setOpen(false);
      }),
      { passive: true }
    );

    // Init
    setOpen(false);
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

    const suffixUpper = String(suffix).toUpperCase();
    const isCompact = suffixUpper.includes("K") || suffixUpper.includes("M");

    const core2 = core.replace(/,/g, "");
    const num = Number(core2);
    if (!Number.isFinite(num)) return null;

    const decimals = (core2.split(".")[1] || "").length;

    return {
      value: num,
      prefix,
      suffix: isCompact ? suffix : suffix,
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

    Chart.defaults.font.family = "Cairo";
    Chart.defaults.color = "#3d0e2d";
    Chart.defaults.animation.duration = prefersReducedMotion ? 0 : 950;
    Chart.defaults.animation.easing = "easeOutQuart";
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.titleFont = { family: "Cairo", weight: "900" };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "Cairo", weight: "700" };

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
        datasets: [{ label: "", data: [45, 20, 25, 10] }],
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#ffffff", font: { size: 14 } },
          },
          tooltip: {
            callbacks: {
              title: function () {
                return "";
              },
              label: function (context) {
                return context.label || "";
              },
            },
          },
        },
      },
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
  // -------------------------
  // Heatmap / SVG (iOS-safe)
  // -------------------------
  const setupHeatmap = () => {
    // ✅ منع تكرار التهيئة (سبب تسريب/كراش)
    if (window.__heatmap_inited) return;
    window.__heatmap_inited = true;

    const mapContainer = document.querySelector("#map-container");
    const svgMount = document.querySelector("#svgMount");
    const tooltip = document.querySelector("#tooltip");
    const slider = document.querySelector("#timeSlider");
    const playBtn = document.querySelector("#playBtn");
    const dateDisplay = document.querySelector("#dateDisplay");
    const counterSpan = document.querySelector("#counterSpan");

    if (!mapContainer || !svgMount || !tooltip || !slider || !playBtn || !dateDisplay || !counterSpan) return;

    const hallPanel = document.querySelector("#hallPanel");
    const overlay = document.querySelector("#overlay");
    const hallPanelClose = document.querySelector("#hallPanelClose");
    const hallPanelTitle = document.querySelector("#hallPanelTitle");
    const hallPanelSub = document.querySelector("#hallPanelSub");
    const hallMetricDensity = document.querySelector("#hallMetricDensity");
    const hallMetricVisitors = document.querySelector("#hallMetricVisitors");
    const hallMetricEvents = document.querySelector("#hallMetricEvents");

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
    const formatNumber = (num) => new Intl.NumberFormat("en-US").format(num);

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

    // -------------------------
    // Data
    // -------------------------
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
      {
        day: "6 شباط (الافتتاح)", target: 158450, events: { "H1.1": 5, "H10.1": 4, H28: 4 },
        densities: { H1: 90, H2: 95, H10: 95, H11: 85, H25: 88, H26: 80, H27: 85, H28: 75, "H1.1": 60, "H10.1": 45, H41: 45, "12": 40, VIP: 10, PR: 45 }
      },
      {
        day: "7 شباط", target: 47563, events: { "H1.1": 9, "H10.1": 8, H28: 6 },
        densities: { H1: 70, H2: 88, H10: 85, H11: 60, H25: 65, H26: 55, H27: 65, H28: 80, "H1.1": 85, "H10.1": 85, H41: 45, "12": 40, VIP: 8, PR: 45 }
      },
      {
        day: "8 شباط", target: 65725, events: { "H1.1": 9, "H10.1": 3, H28: 4 },
        densities: { H1: 80, H2: 95, H10: 92, H11: 70, H25: 75, H26: 65, H27: 75, H28: 60, "H1.1": 85, "H10.1": 45, H41: 55, "12": 50, VIP: 12, PR: 50 }
      },
      {
        day: "9 شباط", target: 82300, events: { "H1.1": 4, "H10.1": 2, H28: 3 },
        densities: { H1: 82, H2: 96, H10: 95, H11: 72, H25: 78, H26: 68, H27: 78, H28: 50, "H1.1": 55, "H10.1": 35, H41: 60, "12": 55, VIP: 10, PR: 55 }
      },
      {
        day: "10 شباط", target: 94150, events: { "H1.1": 4, "H10.1": 3, H28: 5 },
        densities: { H1: 85, H2: 98, H10: 96, H11: 75, H25: 82, H26: 72, H27: 82, H28: 65, "H1.1": 55, "H10.1": 45, H41: 35, "12": 30, VIP: 5, PR: 35 }
      },
      {
        day: "11 شباط", target: 112600, events: { "H1.1": 4, "H10.1": 2, H28: 5 },
        densities: { H1: 88, H2: 100, H10: 98, H11: 80, H25: 85, H26: 78, H27: 85, H28: 65, "H1.1": 55, "H10.1": 35, H41: 40, "12": 35, VIP: 6, PR: 40 }
      },
      {
        day: "12 شباط", target: 158400, events: { "H1.1": 5, "H10.1": 3, H28: 5 },
        densities: { H1: 90, H2: 100, H10: 100, H11: 85, H25: 90, H26: 85, H27: 90, H28: 80, "H1.1": 65, "H10.1": 45, H41: 45, "12": 40, VIP: 8, PR: 45 }
      },
      {
        day: "13 شباط (ذروة الزحام)", target: 245500, events: { "H1.1": 8, "H10.1": 6, H28: 7 },
        densities: { H1: 98, H2: 100, H10: 100, H11: 95, H25: 98, H26: 96, H27: 98, H28: 95, "H1.1": 92, "H10.1": 88, H41: 85, "12": 87, VIP: 15, PR: 90 }
      },
      {
        day: "14 شباط", target: 155000, events: { "H1.1": 5, "H10.1": 4, H28: 4 },
        densities: { H1: 88, H2: 92, H10: 90, H11: 80, H25: 85, H26: 75, H27: 85, H28: 70, "H1.1": 65, "H10.1": 40, H41: 50, "12": 45, VIP: 10, PR: 40 }
      },
      {
        day: "15 شباط", target: 125012, events: { "H1.1": 3, "H10.1": 3, H28: 4 },
        densities: { H1: 82, H2: 88, H10: 85, H11: 75, H25: 80, H26: 70, H27: 78, H28: 65, "H1.1": 50, "H10.1": 35, H41: 40, "12": 40, VIP: 8, PR: 35 }
      },
      {
        day: "16 شباط (الختام)", target: 45300, events: { "H1.1": 1, "H10.1": 1, H28: 1 },
        densities: { H1: 45, H2: 65, H10: 60, H11: 35, H25: 40, H26: 30, H27: 55, H28: 30, "H1.1": 25, "H10.1": 25, H41: 15, "12": 15, VIP: 3, PR: 25 }
      },
    ];

    // -------------------------
    // Helpers
    // -------------------------
    const getHeatColor = (value) => {
      const v = Number(value) || 0;
      if (v >= 85) return "rgba(215, 48, 39, 0.85)";
      if (v >= 70) return "rgba(252, 141, 89, 0.85)";
      if (v >= 50) return "rgba(254, 224, 139, 0.85)";
      if (v >= 30) return "rgba(166, 217, 106, 0.85)";
      return "rgba(26, 152, 80, 0.85)";
    };

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

    // ✅ تسريع applyFillDeep: كاش للأشكال الداخلية بدل querySelectorAll كل مرة
    const innerCache = new WeakMap();
    const applyFillDeep = (rootEl, color) => {
      if (!rootEl) return;

      rootEl.style.setProperty("fill", color, "important");

      let inner = innerCache.get(rootEl);
      if (!inner) {
        inner = Array.from(rootEl.querySelectorAll?.("rect, polygon, path, circle, ellipse") || []);
        innerCache.set(rootEl, inner);
      }
      for (const n of inner) {
        n.style.setProperty("fill", color, "important");
      }
    };

    // -------------------------
    // Tooltip (iOS safe): transform + rAF + قياس مرة واحدة
    // -------------------------
    let mapRect = null;
    let ttW = 220, ttH = 110;
    let ttMeasured = false;

    const refreshMapRect = () => {
      mapRect = mapContainer.getBoundingClientRect();
    };

    window.addEventListener("resize", refreshMapRect, { passive: true });
    window.addEventListener("scroll", refreshMapRect, { passive: true });

    const measureTooltipOnce = () => {
      if (ttMeasured) return;
      const r = tooltip.getBoundingClientRect();
      ttW = r.width || 220;
      ttH = r.height || 110;
      ttMeasured = true;
    };

    let moveRaf = 0;
    let lastClient = null;

    const positionTooltip = (clientX, clientY) => {
      if (!mapRect) refreshMapRect();
      lastClient = { x: clientX, y: clientY };
      if (moveRaf) return;

      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        if (!lastClient || !mapRect) return;

        const x = lastClient.x - mapRect.left;
        const y = lastClient.y - mapRect.top;

        const pad = 12;
        const offset = 18;

        let left = x + offset;
        let top = y + offset;

        if (left + ttW + pad > mapRect.width) left = x - ttW - offset;
        if (top + ttH + pad > mapRect.height) top = y - ttH - offset;

        left = clamp(left, pad, mapRect.width - ttW - pad);
        top = clamp(top, pad, mapRect.height - ttH - pad);

        tooltip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      });
    };

    // -------------------------
    // Counter: منع تراكب الأنيميشن
    // -------------------------
    let counterToken = 0;
    const animateCounter = (el, endValue) => {
      const myToken = ++counterToken;

      const end = Number(endValue) || 0;
      const dur = prefersReducedMotion ? 0 : 520;
      const t0 = performance.now();

      const step = (t) => {
        if (myToken !== counterToken) return;
        const p = dur === 0 ? 1 : clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = Math.round(end * eased);
        el.textContent = formatNumber(v);
        if (p < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    };

    // -------------------------
    // Panel open
    // -------------------------
    let calculatedVisitors = {};

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

    // -------------------------
    // Bind halls
    // -------------------------
    const bindHall = (roomId, el) => {
      if (!el || el.dataset.bound) return;
      el.dataset.bound = "1";

      const setHoverStroke = (on) => {
        if (!on) {
          el.style.removeProperty("stroke");
          el.style.removeProperty("stroke-width");
          return;
        }
        el.style.setProperty("stroke", "rgba(15,23,42,.90)", "important");
        el.style.setProperty("stroke-width", "4px", "important");
      };

      // Desktop hover: tooltip فقط (بدون فتح panel على hover)
      el.addEventListener("mouseenter", (e) => {
        setHoverStroke(true);

        const dayIdx = Number(slider.value) || 0;
        const activeDay = dailyData[dayIdx];
        const d = activeDay?.densities?.[roomId] ?? 0;
        const vis = calculatedVisitors?.[roomId] ?? 0;

        const ttName = document.querySelector("#tt-name");
        const densityVal = document.querySelector("#densityVal");
        const visitorsVal = document.querySelector("#visitorsVal");

        if (ttName) ttName.textContent = hallNames[roomId] || roomId;
        if (densityVal) densityVal.textContent = `${formatNumber(d)}%`;
        if (visitorsVal) visitorsVal.textContent = formatNumber(vis);

        tooltip.setAttribute("aria-hidden", "false");
        refreshMapRect();

        // قياس مرة واحدة بعد ما يظهر
        requestAnimationFrame(() => {
          measureTooltipOnce();
          if (e) positionTooltip(e.clientX, e.clientY);
        });
      });

      el.addEventListener("mousemove", (e) => {
        positionTooltip(e.clientX, e.clientY);
      });

      el.addEventListener("mouseleave", () => {
        tooltip.setAttribute("aria-hidden", "true");
        setHoverStroke(false);
      });

      // ✅ فتح الـpanel فقط على النقر/اللمس (أفضل كثيرًا على iOS)
      el.addEventListener("pointerdown", () => {
        const dayIdx = Number(slider.value) || 0;
        const activeDay = dailyData[dayIdx];
        const density = activeDay?.densities?.[roomId] ?? 0;
        openPanelWithData(roomId, dayIdx, density);
      });
    };

    // -------------------------
    // Update map
    // -------------------------
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

    // -------------------------
    // Boot only once when SVG exists
    // -------------------------
    const bootIfSVGExists = () => {
      const hasSVG = !!document.querySelector("#svgMount svg");
      if (!hasSVG) return false;

      // ✅ منع إعادة ربط listeners
      if (slider.dataset.bound === "1") {
        updateMap(slider.value || 0);
        return true;
      }
      slider.dataset.bound = "1";

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

      // ✅ وقف التشغيل عند الانتقال لخلفية (مهم على iOS)
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopPlay();
      });

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
  // Gallery (public images + pending uploads)
  // -------------------------
  const setupGallery = () => {
    const track = document.getElementById("galleryTrack");
    const wrapper = document.querySelector(".gallery-wrapper");
    if (!track || !wrapper) return;

    const guessGhBase = () => {
      const parts = location.pathname.split("/").filter(Boolean);
      if (!location.hostname.endsWith("github.io")) return "";
      if (!parts.length) return "";
      const first = parts[0];
      const reserved = new Set(["uploads", "gallery", "assets", "css", "js", "img", "images"]);
      if (reserved.has(first.toLowerCase())) return "";
      return `/${first}`;
    };

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
    const API_BASE = isLocal ? "http://localhost:3000" : window.location.origin;

    let LIST_URL = "";
    let PUBLIC_DIR = "";

    if (window.location.protocol === "file:") {
      // If previewing from file system directly, fallback to node server routes to avoid CORS
      LIST_URL = `${API_BASE}/public/gallery.json`;
      PUBLIC_DIR = `./uploads/public/`;
    } else {
      // On VSCode Live Server or Github Pages, simply fetch relative static files
      const baseRepo = guessGhBase() || ".";
      LIST_URL = `${baseRepo}/uploads/public/gallery.json`;
      PUBLIC_DIR = `${baseRepo}/uploads/public/`;
    }

    const buildItem = (filename) => {
      const wrap = document.createElement("div");
      wrap.className = "gallery-item";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "صورة من المعرض";
      img.src = PUBLIC_DIR + encodeURIComponent(filename);
      wrap.appendChild(img);
      return wrap;
    };

    const renderImages = (files) => {
      track.innerHTML = "";
      if (!files || !files.length) {
        const empty = document.createElement("div");
        empty.className = "text-center w-full py-8 text-slate-500 font-bold";
        empty.textContent = "لا توجد صور منشورة حالياً.";
        track.appendChild(empty);
        return;
      }

      const set1 = document.createElement("div");
      set1.className = "gallery-set";
      set1.dataset.set = "1";
      files.forEach((f) => set1.appendChild(buildItem(f)));

      const set2 = set1.cloneNode(true);
      set2.dataset.set = "2";

      track.appendChild(set1);
      track.appendChild(set2);
    };

    const loadGallery = async () => {
      track.innerHTML = "";
      const defaultFiles = [
        "631584631_122123423739126208_6393421084653786636_n.jpg",
        "632609301_122124004335126208_6569830779751906835_n.jpg",
        "629520034_122124013527126208_5841801769823622818_n.jpg",
        "631823291_122124341487126208_8590593667139748535_n.jpg",
        "632385947_122124338181126208_1792607530793737425_n.jpg",
        "634165138_122124813159126208_6537274596070465056_n.jpg",
        "634749336_122125255635126208_6460779698768701157_n.jpg",
        "637673074_122125373793126208_558079665942474763_n.jpg",
        "637145116_122125373709126208_6299887698660418466_n.jpg",
        "637491895_122125373715126208_6360397558353506358_n.jpg"
      ];

      try {
        const r = await fetch(LIST_URL, { cache: "no-store", mode: "cors" });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        const files = Array.isArray(data.files) ? data.files : defaultFiles;
        renderImages(files);
      } catch (err) {
        console.warn("استخدام الصور الافتراضية بسبب تعذر الجلب:", err);
        renderImages(defaultFiles);
      }
    };

    const handlePhotoUpload = () => {
      const input = document.getElementById("userPhotoInput");
      const status = document.getElementById("uploadStatus");
      const btn = document.getElementById("uploadBtn");

      if (!input) return;

      input.addEventListener("change", async () => {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];

        // التحقق من الحجم (مثلاً 5 ميجا كحد أقصى)
        if (file.size > 5 * 1024 * 1024) {
          status.innerText = "❌ الملف كبير جداً (الأقصى 5MB)";
          status.className = "text-xs font-bold text-rose-600 mt-2";
          return;
        }

        const formData = new FormData();
        formData.append("photo", file);

        try {
          btn.disabled = true;
          btn.innerText = "جاري الإرسال...";
          status.innerText = "⏳ يتم الرفع الآن...";
          status.className = "text-xs font-bold text-brand mt-2";

          const response = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            body: formData
          });

          const result = await response.json();

          if (response.ok) {
            status.innerText = "✅ شكراً لك! تم إرسال الصورة للمراجعة.";
            status.className = "text-xs font-bold text-emerald-600 mt-2";
            input.value = ""; // تفريغ المدخل
          } else {
            throw new Error(result.message || "فشل الرفع");
          }
        } catch (error) {
          status.innerText = "❌ حدث خطأ: " + error.message;
          status.className = "text-xs font-bold text-rose-600 mt-2";
        } finally {
          btn.disabled = false;
          btn.innerText = "إرسال صورة";
        }
      });
    };

    loadGallery();
    handlePhotoUpload();
  };




  const setupDesktopOverflowNav = () => {
    const nav = document.getElementById("nav");
    const moreWrap = document.getElementById("navMore");
    const moreBtn = document.getElementById("navMoreBtn");
    const moreMenu = document.getElementById("navMoreMenu");

    if (!nav || !moreWrap || !moreBtn || !moreMenu) return;

    const isDesktop = () => window.matchMedia("(min-width: 1025px)").matches;
    const getNavLinks = () => Array.from(nav.querySelectorAll(":scope > a.nav-link"));

    const closeMore = () => {
      moreMenu.classList.remove("open");
      moreBtn.setAttribute("aria-expanded", "false");
      moreMenu.setAttribute("aria-hidden", "true");
    };

    const openMore = () => {
      moreMenu.classList.add("open");
      moreBtn.setAttribute("aria-expanded", "true");
      moreMenu.setAttribute("aria-hidden", "false");
    };

    moreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      moreMenu.classList.contains("open") ? closeMore() : openMore();
    });

    document.addEventListener("click", (e) => {
      if (!moreWrap.contains(e.target)) closeMore();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMore();
    });

    const reset = () => {
      // رجّع أي روابط موجودة داخل moreMenu إلى nav قبل moreWrap
      const menuLinks = Array.from(moreMenu.querySelectorAll("a.nav-link"));
      menuLinks.forEach((a) => nav.insertBefore(a, moreWrap));
      moreMenu.innerHTML = "";
    };

    const rebuild = () => {
      reset();

      if (!isDesktop()) {
        moreWrap.hidden = true;
        closeMore();
        return;
      }

      // Desktop
      moreWrap.hidden = false;
      closeMore();

      const overflows = () => nav.scrollWidth > (nav.getBoundingClientRect().width - 16);

      while (overflows()) {
        const links = getNavLinks();
        if (links.length <= 5) break;

        const lastLink = links[links.length - 1];
        if (!lastLink) break;

        nav.removeChild(lastLink);
        moreMenu.insertBefore(lastLink, moreMenu.firstChild);
      }

      moreWrap.hidden = !moreMenu.querySelector("a.nav-link");
    };

    const ro = new ResizeObserver(() => rebuild());
    ro.observe(nav);

    window.addEventListener("resize", rafThrottle(rebuild), { passive: true });

    rebuild();
    setTimeout(rebuild, 120);
  };

  // -------------------------
  // Boot
  // -------------------------
  document.addEventListener("DOMContentLoaded", () => {
    setupHeaderAndMenu();
    setupDesktopOverflowNav();
    setupHeaderScroll();
    setupSmoothAnchors();
    setupActiveNav();
    setupReveal();
    setupCountUps();
    setupCharts();
    setupHeatmap();
    setupGallery();
  });
})();