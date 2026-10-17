/* ============================================================
   CYBERGUARD // NAV-PRO.JS
   1) Device performance tier  (low / medium / high)
   2) VVIP navbar effects      (ripple, magnetic, progress, auto-hide, live --nav-h)
   3) Upgraded Sound Engine    (fade, volume, seek, mute, single-tab, lock-screen controls)
   Ye file script.js ke BAAD load hoti hai (script.js ko chheda nahi gaya).
   ============================================================ */
(function () {
"use strict";

const root = document.documentElement;
const $ = id => document.getElementById(id);

/* ============================================================
   1. DEVICE PERFORMANCE TIER
   low    -> animations OFF, sab content/text wese hi
   medium -> hover/transition effects ON, heavy loops OFF
   high   -> sab VVIP animations ON
   Override: ?perf=low|medium|high  (URL)  ya  localStorage cg_perf
   ============================================================ */
const TIERS = ["low", "medium", "high"];
function coarseTier() {
    try {
        const q = new URLSearchParams(location.search).get("perf");
        if (TIERS.includes(q)) { localStorage.setItem("cg_perf", q); }
        if (q === "auto") localStorage.removeItem("cg_perf");
        const saved = localStorage.getItem("cg_perf");
        if (TIERS.includes(saved)) return { tier: saved, forced: true };
    } catch (_) { }
    const ua = navigator.userAgent || "";
    const conn = navigator.connection || {};
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return { tier: "low" };
    if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return { tier: "low" };
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobile = ios || /Android|Mobi/i.test(ua) || Math.min(screen.width, screen.height) < 700;
    let s = ios ? 2 : mobile ? 0 : 2;
    const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency || 4;
    if (mem) s += mem <= 2 ? -2 : mem <= 4 ? -1 : mem >= 8 ? 2 : 1;
    s += cores >= 8 ? 2 : cores >= 6 ? 1 : cores <= 2 ? -2 : cores <= 4 ? -1 : 0;
    if (/(^|-)3g$/.test(conn.effectiveType || "")) s -= 1;
    return { tier: s >= 3 ? "high" : s >= 1 ? "medium" : "low" };
}
function applyTier(t, why) {
    root.dataset.perf = t;
    root.classList.remove("perf-low", "perf-medium", "perf-high");
    root.classList.add("perf-" + t);
    window.CG_PERF = Object.assign(window.CG_PERF || {}, { tier: t, reason: why || "" });
    window.dispatchEvent(new CustomEvent("cg:perf", { detail: { tier: t } }));
}
const first = coarseTier();
applyTier(first.tier, first.forced ? "manual override" : "device specs");
window.CG_PERF.set = function (t) { if (!TIERS.includes(t)) return; try { localStorage.setItem("cg_perf", t); } catch (_) { } applyTier(t, "manual override"); };
window.CG_PERF.auto = function () { try { localStorage.removeItem("cg_perf"); } catch (_) { } const c = coarseTier(); applyTier(c.tier, "device specs"); };

/* live FPS probe -> sirf NEECHE le jata hai (kabhi upar nahi), taake slow phone atke nahi */
function fpsProbe() {
    if (first.forced || document.hidden || !window.requestAnimationFrame) return;
    let frames = 0, t0 = 0, last = 0, worst = 0;
    function tick(t) {
        if (!t0) { t0 = last = t; }
        worst = Math.max(worst, t - last); last = t; frames++;
        if (t - t0 < 900) return requestAnimationFrame(tick);
        const fps = frames / ((t - t0) / 1000), cur = root.dataset.perf;
        if (fps < 20 && cur !== "low") applyTier("low", `measured ${fps.toFixed(0)} fps`);
        else if (fps < 38 && cur === "high") applyTier("medium", `measured ${fps.toFixed(0)} fps`);
        window.CG_PERF.fps = Math.round(fps);
    }
    requestAnimationFrame(tick);
}
window.addEventListener("load", () => setTimeout(fpsProbe, 1800), { once: true });

/* ============================================================
   2. NAVBAR EFFECTS
   ============================================================ */
function initNavbar() {
    const nav = document.querySelector(".navbar");
    if (!nav) return;
    document.body.classList.add("cg-main");

    /* live nav height -> --nav-live (purana --nav-h ko NAHI chheda, warna min-height ka loop banta hai) */
    const setH = () => root.style.setProperty("--nav-live", Math.ceil(nav.getBoundingClientRect().height) + "px");
    setH();
    if (window.ResizeObserver) new ResizeObserver(setH).observe(nav); else window.addEventListener("resize", setH);

    /* scroll progress bar + auto-hide on small screens */
    const bar = nav.querySelector(".nav-progress");
    let lastY = window.scrollY, ticking = false;
    function onScroll() {
        const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
        if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
        const small = innerWidth <= 1024;
        const dy = y - lastY;
        const menuOpen = document.querySelector(".side-panel.is-open, .side-panel.open") || nav.matches(":focus-within") || nav.querySelector(".audio-control-wrapper.mix-open");
        if (small && !menuOpen) {
            if (dy > 8 && y > 140) nav.classList.add("nav-hidden");
            else if (dy < -6 || y < 60) nav.classList.remove("nav-hidden");
        } else nav.classList.remove("nav-hidden");
        nav.classList.toggle("nav-scrolled", y > 24);
        if (Math.abs(dy) > 4) lastY = y;
        ticking = false;
    }
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    /* ripple + magnetic hover */
    const fx = ".cyber-audio-btn, .btn-glow-danger, .menu-toggle, .nav-links a, .audio-mix-btn";
    nav.addEventListener("pointerdown", e => {
        const b = e.target.closest(fx);
        if (!b || root.dataset.perf === "low") return;
        const r = b.getBoundingClientRect(), s = document.createElement("span");
        const d = Math.max(r.width, r.height) * 1.6;
        s.className = "cg-ripple";
        s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
        b.appendChild(s); setTimeout(() => s.remove(), 650);
    });
    if (matchMedia("(pointer:fine)").matches) {
        nav.addEventListener("pointermove", e => {
            if (root.dataset.perf !== "high") return;
            const b = e.target.closest(".cyber-audio-btn, .btn-glow-danger, .menu-toggle");
            if (!b) return;
            const r = b.getBoundingClientRect();
            b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) / r.width * 6).toFixed(2) + "px");
            b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) / r.height * 4).toFixed(2) + "px");
            b.style.setProperty("--gx", ((e.clientX - r.left) / r.width * 100).toFixed(0) + "%");
        });
        nav.addEventListener("pointerout", e => { const b = e.target.closest(".cyber-audio-btn, .btn-glow-danger, .menu-toggle"); if (b) { b.style.removeProperty("--mx"); b.style.removeProperty("--my"); } });
    }

    /* active nav pill ko swipe-strip mein visible rakho (mobile) */
    const links = nav.querySelector(".nav-links");
    if (links) {
        const keepVisible = () => { const a = links.querySelector("a.active"); if (a && links.scrollWidth > links.clientWidth) links.scrollTo({ left: a.offsetLeft - links.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" }); };
        new MutationObserver(keepVisible).observe(links, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
}

/* ============================================================
   3. UPGRADED SOUND ENGINE
   (script.js ke 3 functions replace hote hain: syncCyberAudioUi,
    toggleCyberAudio, startCyberAudioFromBeginning - same names, same keys)
   ============================================================ */
const K_STATE = "cyberguard_audio_state", K_POS = "cyberguard_audio_position", K_VOL = "cyberguard_audio_volume", K_MUTE = "cyberguard_audio_muted", K_OWNER = "cyberguard_audio_owner";
const TAB_ID = Math.random().toString(36).slice(2);
const ST = { vol: 0.6, muted: false, blocked: false, loading: false, error: false, fade: 0 };
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (_) { } }
};
const audioEl = () => $("bgAudio");
const eff = () => (ST.muted ? 0 : ST.vol);
const fmt = s => (!isFinite(s) ? "0:00" : Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"));

const ICON = {
    play: '<svg class="i-play" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor"/></svg>',
    pause: '<svg class="i-pause" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/></svg>',
    spin: '<svg class="i-load" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="36 18"/></svg>',
    restart: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.7 9" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M5.2 4v4.4h4.4" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vol: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9.5v5h3.6L12.5 19V5L7.6 9.5H4z" fill="currentColor"/><path class="w1" d="M15.5 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="w2" d="M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="wx" d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
};

function applyVolume(a) { if (a) a.volume = Math.max(0, Math.min(1, eff())); }

function fadeTo(a, target, ms, done) {
    cancelAnimationFrame(ST.fade);
    if (!a || root.dataset.perf === "low" || ms <= 0) { if (a) a.volume = target; return done && done(); }
    const from = a.volume, t0 = performance.now();
    (function step(t) {
        const p = Math.min(1, (t - t0) / ms);
        a.volume = Math.max(0, Math.min(1, from + (target - from) * p));
        if (p < 1) ST.fade = requestAnimationFrame(step); else done && done();
    })(t0);
}

function savePos(a) { if (a && isFinite(a.currentTime)) store.set(K_POS, a.currentTime); }
function restorePos(a) { const p = Number(store.get(K_POS, 0)); if (isFinite(p) && p > 0 && (!isFinite(a.duration) || p < a.duration - 1)) { try { a.currentTime = p; } catch (_) { } } }

/* ---------- UI sync (same name as script.js -> replaces it) ---------- */
window.syncCyberAudioUi = function () {
    const a = audioEl(), btn = $("cyberAudioBtn"), icon = $("audioBtnIcon"), text = $("audioBtnText"), wrap = document.querySelector(".audio-control-wrapper");
    const playing = !!a && !a.paused && !a.ended;
    const hasPos = Number(store.get(K_POS, 0)) > 1;
    if (a) a.loop = true;
    if (btn) {
        btn.classList.toggle("playing", playing);
        btn.classList.toggle("paused", !playing && !ST.error);
        btn.classList.toggle("loading", ST.loading && !ST.error);
        btn.classList.toggle("blocked", ST.blocked && !playing);
        btn.classList.toggle("error", ST.error);
        btn.setAttribute("aria-pressed", playing ? "true" : "false");
        btn.title = ST.error ? "Sound file could not be loaded" : playing ? "Pause Background Sound" : "Play or resume Background Sound";
        btn.disabled = ST.error;
    }
    if (icon) {
        if (!icon.dataset.cg) { icon.innerHTML = ICON.play + ICON.pause + ICON.spin; icon.dataset.cg = "1"; }
    }
    if (text) text.textContent = ST.error ? "Sound Error" : playing ? "Pause Sound" : (hasPos || ST.blocked) ? "Resume Sound" : "Play Sound";
    if (wrap) wrap.classList.toggle("is-playing", playing);
    const pct = a && isFinite(a.duration) && a.duration > 0 ? a.currentTime / a.duration * 100 : 0;
    if (btn) btn.style.setProperty("--p", pct.toFixed(2) + "%");
    const seek = $("audioSeek"), cur = $("audioCur"), dur = $("audioDur"), vol = $("audioVolume"), mix = $("audioMixBtn");
    if (seek && document.activeElement !== seek) seek.value = String(Math.round(pct * 10));
    if (cur && a) cur.textContent = fmt(a.currentTime);
    if (dur && a && isFinite(a.duration)) dur.textContent = fmt(a.duration);
    if (vol && document.activeElement !== vol) vol.value = String(Math.round(ST.vol * 100));
    if (vol) vol.style.setProperty("--v", Math.round((ST.muted ? 0 : ST.vol) * 100) + "%");
    if (mix) { mix.classList.toggle("is-muted", ST.muted || ST.vol === 0); mix.setAttribute("aria-label", ST.muted ? "Unmute" : "Volume & seek"); }
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
};

function claimOwnership() { store.set(K_OWNER, TAB_ID); }

function tryPlay(a, { fade = 600 } = {}) {
    ST.loading = a.readyState < 3; ST.blocked = false;
    claimOwnership();
    a.volume = 0;
    const p = a.play();
    const ok = () => { ST.loading = false; store.set(K_STATE, "playing"); fadeTo(a, eff(), fade); window.syncCyberAudioUi(); };
    if (p && p.then) p.then(ok).catch(err => {
        ST.loading = false;
        if (err && err.name === "NotSupportedError") ST.error = true; else ST.blocked = true;
        store.set(K_STATE, "paused");
        window.syncCyberAudioUi();
    }); else ok();
    window.syncCyberAudioUi();
}

window.toggleCyberAudio = function () {
    const a = audioEl(); if (!a) return;
    a.loop = true;
    if (!a.paused && !a.ended) {
        savePos(a);
        fadeTo(a, 0, 350, () => { a.pause(); applyVolume(a); });
        store.set(K_STATE, "paused");
    } else {
        if (a.readyState >= 1) restorePos(a);
        tryPlay(a);
    }
    window.syncCyberAudioUi();
};

window.startCyberAudioFromBeginning = function () {
    const a = audioEl(); if (!a) return;
    a.loop = true; store.set(K_POS, 0);
    try { a.currentTime = 0; } catch (_) { }
    tryPlay(a, { fade: 400 });
    const b = $("cyberAudioRestartBtn"); if (b) { b.classList.remove("spin-once"); void b.offsetWidth; b.classList.add("spin-once"); }
};

/* ---------- build mixer popover + upgrade markup ---------- */
function buildAudioUi() {
    const wrap = document.querySelector(".audio-control-wrapper"), a = audioEl();
    if (!wrap || !a) return;
    a.preload = "metadata";
    const icon = $("audioBtnIcon"); if (icon) { icon.innerHTML = ICON.play + ICON.pause + ICON.spin; icon.dataset.cg = "1"; }
    const rs = $("cyberAudioRestartBtn")?.querySelector(".audio-icon"); if (rs) rs.innerHTML = ICON.restart;
    if (!$("audioMixBtn")) {
        wrap.insertAdjacentHTML("beforeend", `
        <button type="button" id="audioMixBtn" class="cyber-audio-btn audio-mix-btn" aria-haspopup="true" aria-expanded="false" aria-label="Volume & seek" title="Volume & seek">${ICON.vol}</button>
        <div class="audio-mixer" id="audioMixer" role="group" aria-label="Sound mixer">
            <div class="mix-row"><button type="button" id="audioMuteBtn" class="mix-mute" aria-label="Mute / unmute">${ICON.vol}</button>
                <input type="range" id="audioVolume" min="0" max="100" step="1" value="60" aria-label="Volume"><b id="audioVolVal">60%</b></div>
            <div class="mix-row mix-seek"><span id="audioCur">0:00</span><input type="range" id="audioSeek" min="0" max="1000" step="1" value="0" aria-label="Seek"><span id="audioDur">0:00</span></div>
            <small>Plays across About / Contact / Map pages</small>
        </div>`);
    }
    const mix = $("audioMixBtn"), vol = $("audioVolume"), seek = $("audioSeek"), mute = $("audioMuteBtn");
    const setOpen = o => { wrap.classList.toggle("mix-open", o); mix.setAttribute("aria-expanded", String(o)); };
    mix.addEventListener("click", e => { e.stopPropagation(); setOpen(!wrap.classList.contains("mix-open")); });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });
    vol.addEventListener("input", () => {
        ST.vol = vol.value / 100; if (ST.vol > 0) ST.muted = false;
        store.set(K_VOL, ST.vol); store.set(K_MUTE, ST.muted);
        $("audioVolVal").textContent = vol.value + "%"; applyVolume(a); window.syncCyberAudioUi();
    });
    mute.addEventListener("click", () => { ST.muted = !ST.muted; store.set(K_MUTE, ST.muted); applyVolume(a); window.syncCyberAudioUi(); });
    seek.addEventListener("input", () => { if (isFinite(a.duration)) { a.currentTime = a.duration * seek.value / 1000; savePos(a); } });
}

function initAudio() {
    const a = audioEl(); if (!a) return;
    ST.vol = Math.min(1, Math.max(0, Number(store.get(K_VOL, 0.6))));
    if (!isFinite(ST.vol)) ST.vol = 0.6;
    ST.muted = store.get(K_MUTE, "false") === "true";
    buildAudioUi();
    applyVolume(a);
    const vv = $("audioVolVal"); if (vv) vv.textContent = Math.round(ST.vol * 100) + "%";

    a.addEventListener("waiting", () => { ST.loading = true; window.syncCyberAudioUi(); });
    a.addEventListener("playing", () => { ST.loading = false; ST.blocked = false; window.syncCyberAudioUi(); });
    a.addEventListener("canplay", () => { ST.loading = false; window.syncCyberAudioUi(); });
    a.addEventListener("loadedmetadata", () => window.syncCyberAudioUi());
    a.addEventListener("error", () => { ST.error = true; ST.loading = false; window.syncCyberAudioUi(); });
    let lastUi = 0;
    a.addEventListener("timeupdate", () => { const n = performance.now(); if (n - lastUi > 400) { lastUi = n; window.syncCyberAudioUi(); } });
    a.addEventListener("play", () => { claimOwnership(); window.syncCyberAudioUi(); });
    a.addEventListener("pause", () => window.syncCyberAudioUi());

    /* browser autoplay rok de to pehle click/tap par sound resume ho jaye */
    if (store.get(K_STATE, "paused") === "playing" && a.paused) {
        ST.blocked = true;
        const resume = () => { ["pointerdown", "keydown", "touchstart"].forEach(ev => document.removeEventListener(ev, resume, true)); if (a.paused && store.get(K_STATE) === "playing") { restorePos(a); tryPlay(a, { fade: 900 }); } };
        ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, resume, true));
        a.volume = 0;
        a.play().then(() => { ST.blocked = false; restorePos(a); fadeTo(a, eff(), 800); window.syncCyberAudioUi(); }).catch(() => window.syncCyberAudioUi());
    }

    /* sirf ek tab mein sound: doosre tab ne play kiya to yeh tab pause */
    window.addEventListener("storage", e => {
        if (e.key === K_OWNER && e.newValue && e.newValue !== TAB_ID && !a.paused) { savePos(a); a.pause(); }
        if (e.key === K_VOL || e.key === K_MUTE) { ST.vol = Number(store.get(K_VOL, ST.vol)); ST.muted = store.get(K_MUTE, "false") === "true"; applyVolume(a); }
        window.syncCyberAudioUi();
    });

    /* lock-screen / headset controls */
    if ("mediaSession" in navigator) {
        try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: "CyberGuard Ambient", artist: "CyberGuard SOC", album: "Threat Defense Portal" });
            navigator.mediaSession.setActionHandler("play", () => { if (a.paused) window.toggleCyberAudio(); });
            navigator.mediaSession.setActionHandler("pause", () => { if (!a.paused) window.toggleCyberAudio(); });
            navigator.mediaSession.setActionHandler("seekto", d => { if (d.seekTime != null) a.currentTime = d.seekTime; });
        } catch (_) { }
    }
    window.syncCyberAudioUi();
}

function boot() { initNavbar(); initAudio(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();