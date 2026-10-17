/* ============================================================
   CYBERGUARD // SCAM-LIVE.JS  -  LIVE GLOBAL SCAM RADAR
   "Recent Global Scam Alerts" section ko LIVE news feed deta hai.
   Har 5 minute mein khud update hota hai, naye alerts upar aate hain.

   FREE SOURCES (kisi key ki zaroorat nahi):
     1) Hacker News (Algolia API) - scam/phishing/fraud stories  [direct, CORS OK]
     2) rss2json                  - BleepingComputer, The Hacker News, Krebs, The Record
     3) Google News RSS           - global + Pakistan   [CORS proxy ke zariye]
     4) GDELT DOC 2.0             - duniya bhar ki news [CORS proxy ke zariye]
   NOTE: site ko file:// se mat kholein (origin "null" hota hai). Live Server /
   hosting (http/https) par kholein, warna browser kai APIs block kar deta hai.
   Agar internet/API band ho to purane (curated) cards wese hi rehte hain
   aur last cached alerts dikhte hain. Fake/jhooti news kabhi nahi banti.
   ============================================================ */
(function () {
"use strict";

const CACHE_KEY = "cg_scam_live_v1";
const REFRESH_MS = 5 * 60 * 1000;
const MAX_CARDS = (navigator.connection && navigator.connection.saveData) ? 6 : 12;
const root = document.documentElement;

/* ---------- country detection ---------- */
const CC = [
    ["Pakistan", "PK"], ["India", "IN"], ["United States", "US"], ["United Kingdom", "GB"], ["Australia", "AU"], ["Canada", "CA"], ["Nigeria", "NG"],
    ["Singapore", "SG"], ["United Arab Emirates", "AE"], ["Philippines", "PH"], ["Malaysia", "MY"], ["Indonesia", "ID"], ["Kenya", "KE"], ["South Africa", "ZA"],
    ["Ghana", "GH"], ["Germany", "DE"], ["France", "FR"], ["Hong Kong", "HK"], ["China", "CN"], ["Japan", "JP"], ["South Korea", "KR"], ["Brazil", "BR"],
    ["Mexico", "MX"], ["Turkey", "TR"], ["Saudi Arabia", "SA"], ["Bangladesh", "BD"], ["Sri Lanka", "LK"], ["Nepal", "NP"], ["New Zealand", "NZ"], ["Ireland", "IE"],
    ["Italy", "IT"], ["Spain", "ES"], ["Netherlands", "NL"], ["Thailand", "TH"], ["Vietnam", "VN"], ["Cambodia", "KH"], ["Myanmar", "MM"], ["Egypt", "EG"],
    ["Qatar", "QA"], ["Kuwait", "KW"], ["Oman", "OM"], ["Russia", "RU"], ["Ukraine", "UA"], ["Poland", "PL"], ["Israel", "IL"], ["Taiwan", "TW"], ["Argentina", "AR"],
    ["Colombia", "CO"], ["Chile", "CL"], ["Peru", "PE"], ["Zimbabwe", "ZW"], ["Uganda", "UG"], ["Tanzania", "TZ"], ["Ethiopia", "ET"], ["Afghanistan", "AF"], ["Iran", "IR"],
    ["Sweden", "SE"], ["Norway", "NO"], ["Denmark", "DK"], ["Switzerland", "CH"], ["Belgium", "BE"], ["Austria", "AT"], ["Portugal", "PT"], ["Greece", "GR"]
];
const NAME2CC = Object.fromEntries(CC.map(([n, c]) => [n.toLowerCase(), c]));
const CC2NAME = Object.fromEntries(CC.map(([n, c]) => [c, n]));
Object.assign(NAME2CC, { "usa": "US", "u.s.": "US", "uk": "GB", "britain": "GB", "korea, south": "KR", "russian federation": "RU", "uae": "AE", "iran, islamic republic of": "IR", "viet nam": "VN" });
const TEXT_RULES = [
    [/\b(pakistan|karachi|lahore|islamabad|rawalpindi|peshawar|fia|nr3c|pta|easypaisa|jazzcash|sbp)\b/i, "PK"],
    [/\b(india|indian|mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|upi|rbi|cbi|noida|gurugram)\b/i, "IN"],
    [/\b(u\.?s\.?a?\.?|united states|american|fbi|ftc|new york|california|texas|florida)\b/i, "US"],
    [/\b(uk|britain|british|england|london|scotland|wales|action fraud)\b/i, "GB"],
    [/\b(australia|australian|sydney|melbourne|scamwatch)\b/i, "AU"], [/\b(canada|canadian|toronto|ontario|vancouver)\b/i, "CA"],
    [/\b(nigeria|nigerian|lagos|efcc)\b/i, "NG"], [/\bsingapore\b/i, "SG"], [/\b(uae|dubai|abu dhabi|emirates)\b/i, "AE"],
    [/\b(philippines|filipino|manila)\b/i, "PH"], [/\b(malaysia|kuala lumpur)\b/i, "MY"], [/\b(indonesia|jakarta)\b/i, "ID"],
    [/\b(kenya|nairobi)\b/i, "KE"], [/\bsouth africa\b/i, "ZA"], [/\bghana\b/i, "GH"], [/\bgermany|german\b/i, "DE"], [/\bfrance|french|paris\b/i, "FR"],
    [/\bhong kong\b/i, "HK"], [/\bchina|chinese|beijing\b/i, "CN"], [/\bjapan|japanese|tokyo\b/i, "JP"], [/\bsouth korea|korean|seoul\b/i, "KR"],
    [/\bbrazil\b/i, "BR"], [/\bmexico\b/i, "MX"], [/\bturkey|turkish\b/i, "TR"], [/\bsaudi\b/i, "SA"], [/\bbangladesh|dhaka\b/i, "BD"], [/\bsri lanka\b/i, "LK"],
    [/\bnew zealand\b/i, "NZ"], [/\bireland|irish|dublin\b/i, "IE"], [/\bthailand|bangkok\b/i, "TH"], [/\bvietnam\b/i, "VN"], [/\bcambodia\b/i, "KH"]
];
const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌎";
function detectCountry(title, srcCountry) {
    for (const [re, cc] of TEXT_RULES) if (re.test(title)) return cc;
    const k = (srcCountry || "").toLowerCase().trim();
    if (NAME2CC[k]) return NAME2CC[k];
    if (/^[a-z]{2}$/i.test(k)) return k.toUpperCase();
    return "";
}

/* ---------- classify ---------- */
const REL = /\bfake\b|\bfraudster|\bmule\b|\bhoax|\bimposter|scam|fraud|phish|smish|vish|swindl|con ?artist|cheat|ponzi|impersonat|spoof|deepfake|malware|spyware|stolen|duped|extort|blackmail|sextortion|\botp\b|mule account|cyber ?crime|cyber ?attack|data breach|ransom|hacked|hackers?|qr code|fake (app|website|site|link|job|ad)/i;
const BAD = /\b(porn|sex video|casino bonus|buy followers)\b/i;
function classify(t) {
    const cats = [];
    if (/deepfake|ai[- ]generated|voice clon|artificial intelligence|chatgpt|\bai\b/i.test(t)) cats.push("ai");
    if (/phish|smish|vish|\bqr\b|quishing|spoof|fake (website|site|link|login|portal)|credential|password/i.test(t)) cats.push("phishing");
    if (/whatsapp|telegram|\bsms\b|text message|android|\bapk\b|malware|spyware|sim[- ]swap|spam call|robocall|\bapp\b/i.test(t)) cats.push("mobile");
    if (/bank|\bupi\b|wallet|payment|card|\batm\b|transfer|crypto|bitcoin|invest|loan|ponzi|money|funds|trading|rs\.? ?\d|₹|\$ ?\d|lakh|crore|million/i.test(t)) cats.push("payment");
    if (/facebook|instagram|tiktok|social media|romance|dating|impersonat|\bjob\b|recruit|lottery|giveaway|marketplace|olx|shopping|fake ads?|influencer|sextortion/i.test(t)) cats.push("social");
    if (!cats.length) cats.push("social");
    let label = "Scam Alert";
    if (/invest|ponzi|trading|crypto|bitcoin/i.test(t)) label = "Investment Fraud";
    else if (cats.includes("ai")) label = "AI / Deepfake Fraud";
    else if (cats.includes("phishing")) label = "Phishing / Smishing";
    else if (/arrest|police|busted|syndicate|ring|racket|mule|seized/i.test(t)) label = "Law Enforcement";
    else if (cats.includes("mobile")) label = "Mobile / App Fraud";
    else if (cats.includes("payment")) label = "Payment Fraud";
    else label = "Social Engineering";
    const high = /arrest|million|billion|crore|lakh|\blost\b|losses|victims|surge|warns?|alert|busted|syndicate|ring|racket|nationwide|record|thousands|deadly|massive|\bfbi\b/i.test(t);
    return { cats: cats.join(" "), label, high };
}
const TIPS = {
    ai: "Verify urgent voice/video requests by calling the person back on their saved number.",
    phishing: "Never tap links from SMS/email. Open the official app or type the site yourself.",
    mobile: "Install apps only from official stores. Never open .apk files received on chat.",
    payment: "Banks never ask for OTP/PIN. Verify any payment request in your official app.",
    social: "Too-good offers from strangers are bait. Check the profile, then verify independently."
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (_) { return ""; } };
const norm = t => t.replace(/\s[-|–—]\s[^-|–—]{3,38}$/, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
function ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
}
async function fetchJson(url, ms = 13000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(t); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- sources ---------- */
const BAD_KEY = "cg_live_bad", BAD_TTL = 20 * 60 * 1000;
const badMap = () => { try { return JSON.parse(sessionStorage.getItem(BAD_KEY) || "{}"); } catch (_) { return {}; } };
const isBad = n => (badMap()[n] || 0) > Date.now() - BAD_TTL;
const markBad = n => { try { const m = badMap(); m[n] = Date.now(); sessionStorage.setItem(BAD_KEY, JSON.stringify(m)); } catch (_) { } };
const clearBad = n => { try { const m = badMap(); delete m[n]; sessionStorage.setItem(BAD_KEY, JSON.stringify(m)); } catch (_) { } };
async function fetchText(url, ms = 13000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
    finally { clearTimeout(t); }
}
const PROXIES = [u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), u => "https://corsproxy.io/?" + encodeURIComponent(u)];
async function viaProxy(url, name) {
    if (isBad(name)) throw new Error("skipped");
    for (const mk of PROXIES) { try { const t = await fetchText(mk(url)); if (t && t.length > 20) { clearBad(name); return t; } } catch (_) { } }
    markBad(name); throw new Error("proxy failed");
}
function parseGdelt(s) { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || ""); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.now(); }
async function gdelt(query) {
    const u = "https://api.gdeltproject.org/api/v2/doc/doc?query=" + encodeURIComponent(query) + "&mode=artlist&maxrecords=60&format=json&sort=datedesc&timespan=24h";
    const txt = await viaProxy(u, "gdelt"); let d; try { d = JSON.parse(txt); } catch (_) { markBad("gdelt"); throw new Error("gdelt json"); }
    return (d.articles || []).map(a => ({ title: (a.title || "").trim(), url: a.url, ts: parseGdelt(a.seendate), source: a.domain || "", country: a.sourcecountry || "", via: "GDELT" }));
}
async function hn(q) {
    const name = "hn"; if (isBad(name)) throw new Error("skipped");
    try {
        const since = Math.floor(Date.now() / 1000) - 2 * 86400;
        const d = await fetchJson("https://hn.algolia.com/api/v1/search_by_date?query=" + encodeURIComponent(q) + "&tags=story&hitsPerPage=40&numericFilters=" + encodeURIComponent("created_at_i>" + since));
        clearBad(name);
        return (d.hits || []).map(h => { let host = ""; try { host = new URL(h.url).hostname; } catch (_) { } return { title: (h.title || "").trim(), url: h.url || ("https://news.ycombinator.com/item?id=" + h.objectID), ts: (h.created_at_i || 0) * 1000, source: host || "news.ycombinator.com", country: "", via: "Hacker News" }; });
    } catch (e) { markBad(name); throw e; }
}
async function rss(feed, via, filter) {
    const name = "rss:" + via; if (isBad(name)) throw new Error("skipped");
    try {
        const d = await fetchJson("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(feed));
        if (d.status !== "ok") throw new Error("rss");
        clearBad(name);
        return (d.items || []).map(i => {
            const ts = i.pubDate ? Date.parse(i.pubDate.replace(" ", "T") + "Z") : Date.now();
            return { title: (i.title || "").trim(), url: i.link, ts: isNaN(ts) ? Date.now() : ts, source: via, country: "", via };
        }).filter(a => !filter || filter.test(a.title));
    } catch (e) { markBad(name); throw e; }
}
async function googleNews(q, hl, gl, name) {
    const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl.split("-")[0]}`;
    const xml = await viaProxy(feed, name);
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("item")].map(it => {
        let title = (it.querySelector("title")?.textContent || "").trim(), source = it.querySelector("source")?.textContent?.trim() || "Google News";
        const k = title.lastIndexOf(" - "); if (k > 10) title = title.slice(0, k);
        const ts = Date.parse(it.querySelector("pubDate")?.textContent || "");
        return { title, url: it.querySelector("link")?.textContent?.trim(), ts: isNaN(ts) ? Date.now() : ts, source, country: "", via: "Google News", trusted: true };
    });
}

/* ---------- state ---------- */
let items = [], lastOk = 0, loading = false, nextAt = 0, started = false, firstLoad = true;
const seen = new Set();

function normalize(list) {
    const out = [], keys = new Set(), now = Date.now();
    list.forEach(a => {
        if (!a.title || a.title.length < 20 || !safeUrl(a.url)) return;
        if ((!a.trusted && !REL.test(a.title)) || BAD.test(a.title)) return;
        if (a.ts > now + 3600e3 || now - a.ts > 36 * 3600e3) return;
        const k = norm(a.title); if (keys.has(k)) return; keys.add(k);
        const cc = detectCountry(a.title, a.country), cl = classify(a.title);
        out.push({ ...a, url: safeUrl(a.url), cc, ...cl });
    });
    return out.sort((x, y) => y.ts - x.ts);
}
const save = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: lastOk, items: items.slice(0, 40) })); } catch (_) { } };
const load = () => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); if (c && Array.isArray(c.items)) { items = c.items; lastOk = c.t || 0; return true; } } catch (_) { } return false; };

/* ---------- UI ---------- */
function build() {
    const sec = $(".recent-scam-section");
    if (!sec || $("#liveRadar")) return !!$("#liveRadar");
    const anchor = sec.querySelector(".recent-scam-grid");
    const panel = document.createElement("div");
    panel.id = "liveRadar"; panel.className = "live-radar";
    panel.innerHTML = `
        <div class="live-radar-head">
            <div class="live-title"><span class="live-pulse" aria-hidden="true"></span><b>LIVE GLOBAL SCAM RADAR</b><small id="liveUpdated">connecting…</small></div>
            <div class="live-actions"><span id="liveCountdown" class="live-countdown"></span><button type="button" id="liveRefresh" class="live-refresh" title="Refresh now">⟳ Refresh</button></div>
        </div>
        <div class="live-ticker" aria-label="Latest scam headlines"><div class="live-ticker-track" id="liveTicker"></div></div>
        <div class="live-stats">
            <span><b id="liveCount">0</b> alerts · last 24h</span><span><b id="liveCountries">0</b> countries</span><span>Top: <b id="liveTop">—</b></span>
        </div>
        <div class="live-scam-grid" id="liveScamGrid"></div>
        <div class="live-empty" id="liveEmpty" hidden></div>
        <small class="live-credit">Sources: Google News · GDELT · Hacker News · BleepingComputer · Krebs · The Record. Headlines open the original publisher. Auto-updates every 5 minutes.</small>
        <div class="live-divider"><span>CURATED KNOWLEDGE</span></div>`;
    anchor ? anchor.before(panel) : sec.appendChild(panel);
    $("#liveRefresh").addEventListener("click", () => refresh(true));
    return true;
}
function setStatus(mode) {
    const el = $(".recent-scam-section .source-status"), up = $("#liveUpdated");
    const t = lastOk ? new Date(lastOk).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) + " PKT" : "";
    if (el) { el.className = "source-status live-" + mode; el.textContent = mode === "live" ? "● LIVE · " + t : mode === "cached" ? "◐ CACHED · " + t : mode === "loading" ? "◌ UPDATING…" : "● CURATED / VERIFIED"; }
    if (up) up.textContent = mode === "live" ? "updated " + t : mode === "cached" ? "offline - showing cached alerts (" + t + ")" : mode === "loading" ? "fetching newest alerts…" : "live sources unavailable - showing curated alerts below";
}
function cardHTML(a, isFresh) {
    const hot = Date.now() - a.ts < 3600e3;
    const country = a.cc ? `${flag(a.cc)} ${(CC2NAME[a.cc] || a.cc).toUpperCase()}` : "🌎 GLOBAL";
    const tip = TIPS[(a.cats || "social").split(" ")[0]] || TIPS.social;
    return `<article class="recent-scam-card live-card${isFresh ? " is-fresh" : ""}" data-category="${esc(a.cats)}" data-ts="${a.ts}">
        <div class="recent-card-top"><span class="country-chip">${country}</span><span class="risk-chip ${a.high ? "critical" : "warning"}">${a.high ? "HIGH" : "MEDIUM"}</span></div>
        <h4><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(a.title)}</a></h4>
        <p class="live-tip">🛡️ ${esc(tip)}</p>
        <div class="recent-card-footer"><span>${esc(a.label)}</span><span class="live-src" title="${esc(a.source)}">${esc((a.source || "").replace(/^www\./, "").slice(0, 26))}</span></div>
        <div class="live-meta"><span class="live-ago" data-ts="${a.ts}">${ago(a.ts)}</span>${hot ? '<span class="live-new">● NEW</span>' : '<span class="live-badge">LIVE</span>'}</div>
    </article>`;
}
function render() {
    const grid = $("#liveScamGrid"), empty = $("#liveEmpty"), ticker = $("#liveTicker");
    if (!grid) return;
    const list = items.slice(0, MAX_CARDS);
    if (!list.length) { grid.innerHTML = ""; if (empty) { empty.hidden = false; empty.textContent = "Live sources are unreachable right now. The verified curated alerts below are still available."; } ticker && (ticker.innerHTML = ""); return; }
    if (empty) empty.hidden = true;
    grid.innerHTML = list.map(a => cardHTML(a, !firstLoad && !seen.has(norm(a.title)))).join("");
    const heads = items.slice(0, 12).map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow"><i>${flag(a.cc)}</i> ${esc(a.title)}</a>`).join("<span class=\"live-sep\">◆</span>");
    if (ticker) ticker.innerHTML = `<div class="live-ticker-run">${heads}</div><div class="live-ticker-run" aria-hidden="true">${heads}</div>`;
    const ccs = new Set(items.filter(a => a.cc).map(a => a.cc));
    const tally = {}; items.forEach(a => tally[a.label] = (tally[a.label] || 0) + 1);
    const top = Object.entries(tally).sort((x, y) => y[1] - x[1])[0];
    $("#liveCount").textContent = items.length; $("#liveCountries").textContent = ccs.size; $("#liveTop").textContent = top ? top[0] : "—";
    applyFilter();
}
function applyFilter() {
    const f = ($(".scam-filter.active") || {}).dataset?.filter || "all", q = (($("#scamSearch") || {}).value || "").trim().toLowerCase();
    document.querySelectorAll("#liveScamGrid .live-card").forEach(c => {
        const ok = (f === "all" || (c.dataset.category || "").includes(f)) && (!q || c.textContent.toLowerCase().includes(q));
        c.classList.toggle("scam-filter-hidden", !ok);
    });
}
document.addEventListener("click", e => { if (e.target.closest(".scam-filter")) setTimeout(applyFilter, 0); });
document.addEventListener("input", e => { if (e.target && e.target.id === "scamSearch") setTimeout(applyFilter, 0); });

/* ---------- refresh ---------- */
async function refresh(manual) {
    if (loading) return;
    loading = true; setStatus("loading");
    const btn = $("#liveRefresh"); if (btn) { btn.disabled = true; btn.classList.add("spin"); }
    const got = [];
    const add = r => got.push(...r);
    const jobs = [
        hn("scam").then(add), hn("phishing").then(add), hn("fraud").then(add),
        rss("https://www.bleepingcomputer.com/feed/", "BleepingComputer", REL).then(add),
        rss("https://feeds.feedburner.com/TheHackersNews", "The Hacker News", REL).then(add),
        rss("https://krebsonsecurity.com/feed/", "Krebs on Security", REL).then(add),
        rss("https://therecord.media/feed", "The Record", REL).then(add),
        googleNews("scam OR fraud OR phishing when:1d", "en-US", "US", "gn-us").then(add),
        googleNews("scam OR fraud OR cybercrime when:2d", "en-PK", "PK", "gn-pk").then(add),
        gdelt('(scam OR scammers OR "online fraud" OR phishing OR "cyber fraud") sourcelang:english').then(add)
    ].map(p => p.catch(() => null));
    await Promise.all(jobs);
    const fresh = normalize(got);
    if (fresh.length >= 1) {
        const prev = new Set(items.map(a => norm(a.title)));
        const added = fresh.filter(a => !prev.has(norm(a.title))).length;
        items.forEach(a => seen.add(norm(a.title)));
        items = fresh; lastOk = Date.now(); save(); render(); setStatus("live");
        if (!firstLoad && added > 0 && typeof window.showCyberToast === "function") window.showCyberToast(added + " new scam alert" + (added > 1 ? "s" : "") + " from around the world", "LIVE RADAR");
        firstLoad = false; fresh.forEach(a => seen.add(norm(a.title)));
    } else if (items.length) { render(); setStatus("cached"); }
    else { render(); setStatus("curated"); }
    loading = false; nextAt = Date.now() + REFRESH_MS;
    if (btn) { btn.disabled = false; btn.classList.remove("spin"); }
}

/* ---------- timers ---------- */
setInterval(() => {
    document.querySelectorAll("#liveScamGrid .live-ago").forEach(e => { e.textContent = ago(+e.dataset.ts); });
    const c = $("#liveCountdown");
    if (c && nextAt && !loading) { const s = Math.max(0, Math.round((nextAt - Date.now()) / 1000)); c.textContent = "next update " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
}, 1000);
setInterval(() => { if (started && !document.hidden && Date.now() >= nextAt) refresh(false); }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && started && Date.now() - lastOk > REFRESH_MS) refresh(false); });

function start() {
    if (started) return; started = true;
    if (load() && items.length) { items.forEach(a => seen.add(norm(a.title))); render(); setStatus("cached"); }
    refresh(false);
}
function init() {
    if (!build()) return;
    const sec = $(".recent-scam-section");
    if (load() && items.length) { render(); setStatus("cached"); } else setStatus("loading");
    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "500px" });
        io.observe(sec);
    } else start();
    setTimeout(() => { if (!started) start(); }, 12000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
window.CG_SCAM_LIVE = { refresh: () => refresh(true), items: () => items.slice() };
})();