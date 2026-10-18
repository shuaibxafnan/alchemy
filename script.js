/* Paste your Google Apps Script web app URL here to receive form submissions. */
const SCRIPT_URL = "";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Mobile menu ---------- */
const nav = document.getElementById("nav");
const menuBtn = document.getElementById("menuBtn");
const scrim = document.getElementById("scrim");

function setMenu(open) {
    nav.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
scrim.addEventListener("click", () => setMenu(false));
document.querySelectorAll("#menu a").forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

/* ---------- Hero chart: history, forecast band, anomalies ---------- */
(function heroChart() {
    const canvas = document.getElementById("chart");
    const ctx = canvas.getContext("2d");
    const hero = document.getElementById("home");
    let w = 0, h = 0, dpr = 1;
    let start = null, visible = true, raf = null;

    function rng(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    const rand = rng(7);
    const N = 140, M = 80, TOTAL = 1.57;
    const noise = Array.from({ length: N + 1 }, () => (rand() - 0.5) * 0.05);
    const ANOM = [{ i: 52, d: 0.2 }, { i: 101, d: -0.17 }];

    function base(t) {
        return 0.3 + 0.24 * t + 0.07 * Math.sin(t * 17) + 0.035 * Math.sin(t * 46);
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (reduceMotion) draw(1e9);
    }

    const fx = () => w * 0.64;
    const yOf = v => h * (0.6 - v * 0.42);

    function histPoint(i) {
        const t = i / N;
        let v = base(t) + noise[i];
        ANOM.forEach(a => { if (a.i === i) v += a.d; });
        return { x: (i / N) * fx(), y: yOf(v), v };
    }

    function draw(elapsed) {
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(255,255,255,.08)";
        ctx.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
            const y = h * (0.2 + k * 0.1);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        for (let x = 0; x < w; x += 96) {
            ctx.beginPath(); ctx.moveTo(x, h * 0.18); ctx.lineTo(x, h * 0.62); ctx.stroke();
        }

        const draw1 = Math.min(elapsed / 2800, 1);
        const eased = 1 - Math.pow(1 - draw1, 3);
        const upto = Math.floor(eased * N);

        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.beginPath();
        for (let i = 0; i <= upto; i++) {
            const p = histPoint(i);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        const fa = Math.max(0, Math.min((elapsed - 2800) / 1000, 1));
        if (fa > 0) {
            const last = histPoint(N);
            ctx.globalAlpha = fa;

            ctx.fillStyle = "rgba(255,255,255,.1)";
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            for (let j = 1; j <= M; j++) {
                const t = 1 + (j / M) * (TOTAL - 1);
                const x = fx() + (j / M) * (w - fx());
                const spread = (j / M) * h * 0.09;
                ctx.lineTo(x, yOf(base(t)) - spread);
            }
            for (let j = M; j >= 1; j--) {
                const t = 1 + (j / M) * (TOTAL - 1);
                const x = fx() + (j / M) * (w - fx());
                const spread = (j / M) * h * 0.09;
                ctx.lineTo(x, yOf(base(t)) + spread);
            }
            ctx.closePath();
            ctx.fill();

            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = "rgba(255,255,255,.75)";
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            for (let j = 1; j <= M; j++) {
                const t = 1 + (j / M) * (TOTAL - 1);
                ctx.lineTo(fx() + (j / M) * (w - fx()), yOf(base(t)));
            }
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.strokeStyle = "rgba(255,255,255,.3)";
            ctx.beginPath(); ctx.moveTo(fx(), h * 0.18); ctx.lineTo(fx(), h * 0.62); ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255,.75)";
            ctx.font = "500 12px 'Hanken Grotesk', system-ui, sans-serif";
            ctx.fillText("Forecast", fx() + 10, h * 0.2);
            ctx.globalAlpha = 1;
        }

        ANOM.forEach(a => {
            if (a.i > upto) return;
            const p = histPoint(a.i);
            const age = Math.min((elapsed - (a.i / N) * 2800) / 600, 1);
            const pulse = reduceMotion ? 0 : ((elapsed / 1200) % 1);
            ctx.fillStyle = "#ff007f";
            ctx.beginPath(); ctx.arc(p.x, p.y, 5 * Math.max(age, 0), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,0,127,${(1 - pulse) * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5 + pulse * 18, 0, Math.PI * 2); ctx.stroke();
            if (age >= 1) {
                ctx.fillStyle = "rgba(255,255,255,.85)";
                ctx.font = "500 12px 'Hanken Grotesk', system-ui, sans-serif";
                ctx.fillText("Anomaly", p.x + 12, p.y + (a.d > 0 ? -8 : 18));
            }
        });
    }

    function loop(now) {
        if (start === null) start = now;
        draw(now - start);
        raf = visible ? requestAnimationFrame(loop) : null;
    }

    resize();
    window.addEventListener("resize", resize);

    if (!reduceMotion) {
        raf = requestAnimationFrame(loop);
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(loop);
        }).observe(hero);
    }
})();

/* ---------- Stat counters ---------- */
function countUp(el) {
    const to = parseFloat(el.dataset.to);
    const suffix = el.dataset.suffix || "";
    if (reduceMotion) return;
    const start = performance.now();
    function tick(now) {
        const t = Math.min((now - start) / 1400, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        obs.unobserve(entry.target);
    });
}, { threshold: 0.7 });
document.querySelectorAll(".stat strong").forEach(el => statObserver.observe(el));

/* ---------- Services: list drives the image ---------- */
const svcItems = Array.from(document.querySelectorAll(".svc-item"));
const svcImgs = Array.from(document.querySelectorAll(".svc-stage img"));

function openService(i) {
    svcItems.forEach((item, idx) => item.classList.toggle("is-open", idx === i));
    svcImgs.forEach((img, idx) => img.classList.toggle("on", idx === i));
}

svcItems.forEach((item, i) => {
    item.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") openService(i); });
    item.addEventListener("focus", () => openService(i));
    item.addEventListener("click", () => openService(i));
});

/* ---------- Marquee: duplicate tiles for a seamless loop ---------- */
const track = document.getElementById("mTrack");
if (track && !reduceMotion) {
    Array.from(track.children).forEach(node => {
        const clone = node.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
    });
}

/* ---------- Team rail ---------- */
const rail = document.getElementById("teamRail");
(function enableDrag(el) {
    let down = false, moved = false, startX = 0, startScroll = 0;
    el.addEventListener("pointerdown", e => {
        if (e.pointerType !== "mouse") return;
        down = true; moved = false;
        startX = e.clientX; startScroll = el.scrollLeft;
    });
    window.addEventListener("pointermove", e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 5) { moved = true; el.classList.add("dragging"); }
        if (moved) el.scrollLeft = startScroll - dx;
    });
    window.addEventListener("pointerup", () => {
        if (!down) return;
        down = false;
        el.classList.remove("dragging");
    });
    el.addEventListener("click", e => {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
})(rail);

document.querySelectorAll(".rail-nav .round").forEach(btn => btn.addEventListener("click", () => {
    const step = rail.firstElementChild.getBoundingClientRect().width + 16;
    rail.scrollBy({ left: step * Number(btn.dataset.dir), behavior: "smooth" });
}));

/* ---------- Forms ---------- */
function wireForm(form, onDone) {
    const status = form.querySelector(".form-status");
    const btn = form.querySelector('button[type="submit"]');
    let timer;

    function show(text) {
        status.textContent = text;
        clearTimeout(timer);
        timer = setTimeout(() => { status.textContent = ""; }, 6000);
    }

    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!SCRIPT_URL) {
            show("This form is not connected yet. Add the Apps Script URL in index.js.");
            return;
        }
        btn.disabled = true;
        fetch(SCRIPT_URL, { method: "POST", body: new FormData(form) })
            .then(() => {
                show("Thanks, we got your message and will reply soon.");
                form.reset();
                if (onDone) onDone();
            })
            .catch(() => show("Could not send. Check your connection and try again."))
            .finally(() => { btn.disabled = false; });
    });
}

/* ---------- Apply dialog ---------- */
const dialog = document.getElementById("applyDialog");
const roleInput = document.getElementById("aRole");

document.querySelectorAll(".role").forEach(btn => btn.addEventListener("click", () => {
    roleInput.value = btn.dataset.role;
    dialog.showModal();
    document.getElementById("aName").focus();
}));

document.getElementById("dlgClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

wireForm(document.getElementById("contactForm"));
wireForm(document.getElementById("applyForm"), () => setTimeout(() => dialog.close(), 1800));