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
const MAX_CARDS = (navigator.connection && navigator.connection.saveData) ? 6 : 48;
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
const CATS = [["all", "All"], ["phishing", "🎣 Phishing"], ["payment", "💳 Payment"], ["mobile", "📱 Mobile / App"], ["social", "👥 Social"], ["ai", "🤖 AI / Deepfake"]];
const WHY = {
    phishing: "Fake messages and pages copy real brands to steal passwords, OTPs and card data. Always open the official app or type the address yourself.",
    payment: "Money scams rely on urgency and fake proof. Verify every payment request inside your own banking or wallet app.",
    mobile: "Malicious apps, SIM tricks and WhatsApp/Telegram bait spread through links and APK files. Install only from official stores.",
    social: "Fake profiles, jobs, giveaways and romance bait build trust before asking for money or secrets.",
    ai: "Cloned voices and deepfake video make impostors convincing. Confirm by calling back on a saved number."
};
const F = { cat: "all", cc: "", sort: "new", n: Math.min(MAX_CARDS, 12) };
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
        <div class="live-insights" id="liveInsights"></div>
        <div class="live-filters" id="liveFilters" role="toolbar" aria-label="Filter alerts"></div>
        <div class="live-scam-grid" id="liveScamGrid"></div>
        <div class="live-more-wrap"><button type="button" id="liveMore" class="live-refresh" hidden>Show more alerts ↓</button></div>
        <div class="live-empty" id="liveEmpty" hidden></div>
        <small class="live-credit">Sources: Google News · GDELT · Hacker News · BleepingComputer · Krebs · The Record. Headlines open the original publisher. Auto-updates every 5 minutes.</small>
        <div class="live-divider"><span>CURATED KNOWLEDGE</span></div>`;
    anchor ? anchor.before(panel) : sec.appendChild(panel);
    $("#liveRefresh").addEventListener("click", () => refresh(true));
    $("#liveMore").addEventListener("click", () => { F.n += 12; render(); });
    $("#liveFilters").addEventListener("click", e => {
        const b = e.target.closest("button[data-cat],button[data-cc],button[data-sort]"); if (!b) return;
        if (b.dataset.cat !== undefined) F.cat = b.dataset.cat;
        if (b.dataset.cc !== undefined) F.cc = F.cc === b.dataset.cc ? "" : b.dataset.cc;
        if (b.dataset.sort !== undefined) F.sort = b.dataset.sort;
        F.n = Math.min(MAX_CARDS, 12); render();
    });
    $("#liveScamGrid").addEventListener("click", e => {
        const b = e.target.closest(".live-share"); if (!b) return;
        const c = b.closest(".live-card"), a = items.find(x => String(x.ts) === c.dataset.ts && x.url === c.querySelector("h4 a").href) || { title: c.querySelector("h4").textContent, url: c.querySelector("h4 a").href };
        const text = `⚠️ Scam alert: ${a.title}\n${a.url}\n(via CyberGuard Live Scam Radar)`;
        if (navigator.share) navigator.share({ title: "Scam alert", text: a.title, url: a.url }).catch(() => { });
        else (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { b.textContent = "✓ Copied"; setTimeout(() => (b.textContent = "↗ Share"), 1600); }).catch(() => { });
    });
    return true;
}
function setStatus(mode) {
    const el = $(".recent-scam-section .source-status"), up = $("#liveUpdated");
    const t = lastOk ? new Date(lastOk).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) + " PKT" : "";
    if (el) { el.className = "source-status live-" + mode; el.textContent = mode === "live" ? "● LIVE · " + t : mode === "cached" ? "◐ CACHED · " + t : mode === "loading" ? "◌ UPDATING…" : "● CURATED / VERIFIED"; }
    if (up) up.textContent = mode === "live" ? "updated " + t : mode === "cached" ? "offline - showing cached alerts (" + t + ")" : mode === "loading" ? "fetching newest alerts…" : "live sources unavailable - showing curated alerts below";
}
function cardHTML(a, isFresh) {
    const hot = Date.now() - a.ts < 3600e3, c0 = (a.cats || "social").split(" ")[0];
    const country = a.cc ? `${flag(a.cc)} ${(CC2NAME[a.cc] || a.cc).toUpperCase()}` : "🌎 GLOBAL";
    return `<article class="recent-scam-card live-card${isFresh ? " is-fresh" : ""}${a.high ? " is-high" : ""}" data-category="${esc(a.cats)}" data-ts="${a.ts}">
        <div class="recent-card-top"><span class="country-chip">${country}</span><span class="risk-chip ${a.high ? "critical" : "warning"}">${a.high ? "HIGH" : "MEDIUM"}</span></div>
        <h4><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(a.title)}</a></h4>
        <p class="live-tip">🛡️ ${esc(TIPS[c0] || TIPS.social)}</p>
        <details class="live-why"><summary>Why it matters</summary><p>${esc(WHY[c0] || WHY.social)}</p></details>
        <div class="recent-card-footer"><span>${esc(a.label)}</span><span class="live-src" title="${esc(a.source)}">${esc((a.source || "").replace(/^www\./, "").slice(0, 26))}</span></div>
        <div class="live-meta"><span class="live-ago" data-ts="${a.ts}">${ago(a.ts)}</span><span class="live-acts"><button type="button" class="live-share">↗ Share</button>${hot ? '<span class="live-new">● NEW</span>' : '<span class="live-badge">LIVE</span>'}</span></div>
    </article>`;
}
function passes(a) {
    const f = ($(".scam-filter.active") || {}).dataset?.filter || "all", q = (($("#scamSearch") || {}).value || "").trim().toLowerCase();
    if (f !== "all" && !(a.cats || "").includes(f)) return false;
    if (F.cat !== "all" && !(a.cats || "").includes(F.cat)) return false;
    if (F.cc && a.cc !== F.cc) return false;
    if (q && !(a.title + " " + a.source + " " + a.label + " " + (CC2NAME[a.cc] || "")).toLowerCase().includes(q)) return false;
    return true;
}
function insights() {
    const box = $("#liveInsights"); if (!box) return;
    if (!items.length) { box.innerHTML = ""; return; }
    const now = Date.now(), high = items.filter(a => a.high).length, ccs = {}, cats = {}, buckets = Array(12).fill(0);
    items.forEach(a => { if (a.cc) ccs[a.cc] = (ccs[a.cc] || 0) + 1; (a.cats || "").split(" ").filter(Boolean).forEach(c => cats[c] = (cats[c] || 0) + 1); const i = Math.floor((now - a.ts) / 7200e3); if (i >= 0 && i < 12) buckets[11 - i]++; });
    const topC = Object.entries(ccs).sort((x, y) => y[1] - x[1]).slice(0, 6), pk = ccs.PK || 0, maxB = Math.max(1, ...buckets), maxCat = Math.max(1, ...Object.values(cats));
    const hero = items.filter(a => a.high && now - a.ts < 3 * 3600e3)[0] || items[0];
    const tile = (i, l, v) => `<div class="li-tile"><span>${i}</span><b>${v}</b><small>${l}</small></div>`;
    box.innerHTML = `
        <div class="li-tiles">${tile("📡", "alerts · last 24h", items.length)}${tile("🔥", "high severity", high)}${tile("🌍", "countries", Object.keys(ccs).length)}${tile("🇵🇰", "Pakistan alerts", pk)}</div>
        ${hero ? `<a class="li-hero" href="${esc(hero.url)}" target="_blank" rel="noopener noreferrer nofollow"><span class="li-hero-tag">🔥 SCAM OF THE MOMENT</span><b>${esc(hero.title)}</b><small>${flag(hero.cc)} ${esc(CC2NAME[hero.cc] || "Global")} · ${esc(hero.label)} · ${ago(hero.ts)}</small></a>` : ""}
        <div class="li-cols">
            <div class="li-box"><h5>Scam types</h5>${CATS.slice(1).map(([k, n]) => `<div class="li-bar"><span>${n}</span><i style="--w:${Math.round((cats[k] || 0) / maxCat * 100)}%"></i><em>${cats[k] || 0}</em></div>`).join("")}</div>
            <div class="li-box"><h5>Top countries</h5>${topC.length ? topC.map(([c, n]) => `<button type="button" class="li-cc${F.cc === c ? " on" : ""}" data-cc="${c}">${flag(c)} ${esc(CC2NAME[c] || c)} <em>${n}</em></button>`).join("") : "<small>No country detected yet</small>"}</div>
            <div class="li-box"><h5>Alerts per 2 hours (24h)</h5><div class="li-spark">${buckets.map((n, i) => `<i style="--h:${Math.max(6, Math.round(n / maxB * 100))}%" title="${n} alerts, ${(11 - i) * 2}–${(12 - i) * 2} h ago"></i>`).join("")}</div><small>← 24 h ago · now →</small></div>
        </div>`;
}
function filters() {
    const box = $("#liveFilters"); if (!box) return;
    box.innerHTML = CATS.map(([k, n]) => `<button type="button" data-cat="${k}" class="${F.cat === k ? "on" : ""}">${n}</button>`).join("") + `<span class="lf-sep"></span><button type="button" data-cc="PK" class="${F.cc === "PK" ? "on" : ""}">🇵🇰 Pakistan only</button><button type="button" data-sort="new" class="${F.sort === "new" ? "on" : ""}">🕒 Newest</button><button type="button" data-sort="risk" class="${F.sort === "risk" ? "on" : ""}">🔥 Highest risk</button>`;
}
function view() { let l = items.filter(passes); if (F.sort === "risk") l = [...l].sort((a, b) => (b.high - a.high) || (b.ts - a.ts)); return l; }
function render() {
    const grid = $("#liveScamGrid"), empty = $("#liveEmpty"), ticker = $("#liveTicker"), more = $("#liveMore");
    if (!grid) return;
    insights(); filters();
    if (!items.length) { grid.innerHTML = ""; if (empty) { empty.hidden = false; empty.textContent = "Live sources are unreachable right now. The verified curated alerts below are still available."; } ticker && (ticker.innerHTML = ""); if (more) more.hidden = true; return; }
    const all = view(), list = all.slice(0, F.n);
    if (empty) { empty.hidden = list.length > 0; if (!list.length) empty.textContent = "No live alerts match these filters. Try 'All' or clear the search box."; }
    grid.innerHTML = list.map(a => cardHTML(a, !firstLoad && !seen.has(norm(a.title)))).join("");
    if (more) { more.hidden = all.length <= F.n; more.textContent = `Show more alerts ↓ (${all.length - F.n} more)`; }
    const heads = items.slice(0, 12).map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer nofollow"><i>${flag(a.cc)}</i> ${esc(a.title)}</a>`).join("<span class=\"live-sep\">◆</span>");
    if (ticker) ticker.innerHTML = `<div class="live-ticker-run">${heads}</div><div class="live-ticker-run" aria-hidden="true">${heads}</div>`;
}
function applyFilter() { F.n = Math.min(MAX_CARDS, 12); render(); }
document.addEventListener("click", e => { if (e.target.closest(".scam-filter")) setTimeout(applyFilter, 0); });
document.addEventListener("input", e => { if (e.target && e.target.id === "scamSearch") setTimeout(applyFilter, 0); });
document.addEventListener("click", e => { const b = e.target.closest(".li-cc"); if (b) { F.cc = F.cc === b.dataset.cc ? "" : b.dataset.cc; F.n = Math.min(MAX_CARDS, 12); render(); } });

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


/* ============================================================================
   CYBERGUARD // LIVE SOC ANALYTICS COMMAND CENTER  v6
   SIM  : incident engine, vector signals, SOC metrics (training simulation)
   REAL : "Real-world threat pulse" - NVD, CISA KEV, FIRST EPSS, GitHub advisories,
          CyberGuard Scam Radar (public feeds, no key)
   KNOWLEDGE: 14 vector deep-dives, incident-response drawer, SOC Academy, daily drill
   ============================================================================ */
(function () {
"use strict";
const mount = document.getElementById("an6Root");
if (!mount) return;
const $ = (s, r = mount) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tier = () => document.documentElement.dataset.perf || "medium";
const num = n => Number(n).toLocaleString("en-US");
const ago = ts => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { } };
const pkt = ts => new Date(ts).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour12: false });

/* ---------- 14 threat vectors with deep knowledge ---------- */
const V = [
    { id: "phish", icon: "🎣", name: "Phishing Vector Volume", sector: "Email & messaging", base: 82, like: 5, imp: 3, tags: ["T1566", "T1204", "T1598"],
      what: "Phishing tricks people into giving up passwords, OTPs or money, or into opening a malicious file or link. It is the most common way attackers get their first foothold because it attacks people, not software.",
      how: ["Attacker registers a look-alike domain and clones a bank, wallet or Microsoft/Google login page.", "A bulk email, SMS (smishing) or WhatsApp message creates urgency: 'account blocked', 'parcel held', 'refund waiting'.", "The victim enters credentials; the kit forwards them to the attacker in real time and often relays the OTP too.", "The attacker logs in, changes recovery details and moves money or sends more phishing from the hacked mailbox."],
      ioc: ["Sender domain differs from the brand's real domain (reply-to mismatch)", "Link text shows one address but points to another", "Very new domain registered days ago", "Urgent threat or reward + request for credentials", "Login page served over HTTP or from a free hosting domain"],
      defend: ["Publish SPF, DKIM and DMARC (p=reject) for your domains", "Use phishing-resistant MFA (FIDO2/passkeys), not SMS codes", "Rewrite and sandbox links; block newly registered domains", "Add a one-click 'Report phishing' button and reward reporting", "Run regular simulated-phishing training, then retrain those who click"],
      pk: "Wallet, bank and BISP/relief-themed lures dominate local campaigns, often via SMS and WhatsApp forwards in Urdu and English.",
      q: { t: "An employee reports an email 'Your mailbox is full - click to keep access' from a look-alike domain. What is the BEST first SOC action?", o: ["Reply asking whether it is real", "Check headers and domain, block the sender/URL, and search for other recipients who may have clicked", "Delete it and move on", "Forward it to colleagues as a warning"], c: 1, w: "Containment at scale: confirm it is malicious, block the indicators, and find everyone else exposed. Replying or forwarding spreads risk and loses evidence." } },
    { id: "ransom", icon: "🔐", name: "Ransomware Payload Threats", sector: "Enterprise endpoints", base: 66, like: 4, imp: 5, tags: ["T1486", "T1490", "T1021", "T1078"],
      what: "Ransomware encrypts files (and often steals them first) and demands payment. Modern groups use 'double extortion': pay or we leak your data.",
      how: ["Initial access through phishing, exposed RDP/VPN with weak passwords, or an unpatched internet-facing service.", "Attackers escalate privileges, disable security tools and move across the network with legitimate admin tools.", "Backups and shadow copies are deleted so recovery is hard.", "Data is copied out, then the payload is launched across many machines at once, usually at night or on a weekend."],
      ioc: ["Rapid mass file renames or new extensions", "'vssadmin delete shadows' or backup service stopped", "Unusual large SMB/RDP activity between servers", "Security agent tampering or disabled", "Ransom note files appearing in many folders"],
      defend: ["Keep offline, immutable backups and test restores regularly", "Patch internet-facing systems quickly; never expose RDP directly", "Enforce MFA on VPN, email and admin accounts", "Deploy EDR with isolation capability", "Segment networks so one infected PC cannot reach everything"],
      pk: "Hospitals, manufacturers, universities and SMEs with flat networks and weak backups are common victims regionally.",
      q: { t: "EDR shows hundreds of files being renamed on a file server within seconds. What is the BEST first action?", o: ["Pay the ransom quickly", "Isolate the host from the network, preserve evidence and escalate to incident response", "Reboot the server to stop it", "Wait to see if it stops"], c: 1, w: "Network isolation stops spread while keeping memory and logs for investigation. Rebooting can destroy evidence; waiting lets the encryption continue." } },
    { id: "wallet", icon: "📱", name: "Mobile Wallet Spoofing", sector: "Mobile financial services", base: 71, like: 5, imp: 3, tags: ["T1566", "T1111", "T1451"],
      what: "Fraudsters impersonate wallet apps, agents or support staff to steal OTPs, PINs and device access, then drain balances.",
      how: ["A fake 'received money' or 'refund' SMS prompts the victim to call a number or click a link.", "A fake agent or helpline asks for the OTP/PIN 'to reverse the transaction'.", "In SIM-swap cases the attacker takes over the phone number to receive real OTPs.", "Funds move quickly through mule accounts and are cashed out."],
      ioc: ["Messages from unknown numbers instead of the official short code", "Requests for OTP or PIN by phone or chat", "Sudden loss of mobile signal (possible SIM swap)", "New device login alerts you did not trigger"],
      defend: ["Never share OTP or PIN with anyone, including 'staff'", "Enable app lock and transaction limits", "Verify balance only inside the official app", "Use SIM-swap alerts and ask the telecom for extra SIM-change checks", "Report to the wallet helpline and FIA immediately"],
      pk: "Fake 'received Rs. X by mistake, please return' messages and agent-assisted PIN theft are widely reported.",
      q: { t: "A caller says he is from the wallet company and asks you to read the OTP 'to cancel a wrong transfer'. What do you do?", o: ["Read the OTP quickly", "Hang up and check your balance in the official app", "Ask him to send an SMS first", "Share only the first 3 digits"], c: 1, w: "An OTP authorises a transaction. Real staff never need it. Even partial digits help attackers." } },
    { id: "apt", icon: "🕵️", name: "APT Hacking Group Activity (PK/IN)", sector: "Government & defence-adjacent", base: 90, like: 3, imp: 5, tags: ["T1566.001", "T1190", "T1105", "T1071", "T1041"],
      what: "Advanced Persistent Threats are well-resourced, patient attackers (often state-linked) who aim for long-term access to steal information rather than quick cash. Security vendors have published research on espionage campaigns across South Asia.",
      how: ["Targeted spear-phishing with a convincing document, or exploitation of an exposed server.", "A small implant establishes command-and-control over normal-looking web traffic.", "The attacker maps the network slowly, steals credentials and moves laterally.", "Data is staged and exfiltrated in small pieces over weeks or months."],
      ioc: ["Regular 'beaconing' to rare domains at fixed intervals", "Office documents spawning scripts or shells", "New services, scheduled tasks or accounts on key servers", "Large outbound transfers off-hours"],
      defend: ["Hunt for beaconing and rare outbound destinations", "Sandbox and restrict macros and attachments", "Apply least privilege and segment sensitive networks", "Retain logs for months to reconstruct long intrusions", "Share indicators with national CERT and trusted partners"],
      pk: "Governments and critical sectors in the region are persistent espionage targets. Treat unexplained slow-burn activity seriously.",
      q: { t: "Proxy logs show one workstation contacting a rare domain every 60 seconds for days. What is this most likely?", o: ["Normal software updates", "Beaconing to a command-and-control server", "A broken browser", "Cloud backup"], c: 1, w: "Regular, machine-like check-ins to a rare domain are a classic C2 beacon pattern and should be investigated." } },
    { id: "govbf", icon: "🏛️", name: "Government Portal Brute-Force", sector: "Citizen services", base: 73, like: 5, imp: 3, tags: ["T1110", "T1110.004", "T1078"],
      what: "Bots try thousands of passwords or leaked username-password pairs ('credential stuffing') against login pages to take over citizen accounts.",
      how: ["Attackers buy or download leaked credential lists.", "Automated tools test each pair against the portal from many IP addresses to avoid blocks.", "Successful logins are sold or used to file fraudulent claims and steal personal data."],
      ioc: ["Spike of failed logins from many IPs", "Same password tried across many usernames", "Logins at inhuman speed or from hosting-provider IPs", "A burst of successful logins followed by profile changes"],
      defend: ["Rate-limit and add CAPTCHA/bot protection", "Offer and encourage MFA", "Check passwords against breach lists at signup and login", "Alert on account takeover patterns and lock suspicious sessions", "Use a WAF with bot-management rules"],
      pk: "Large national databases make citizen portals attractive for credential stuffing and identity fraud.",
      q: { t: "Thousands of failed logins hit a portal, each username tried with only 2-3 passwords from many IPs. What is it?", o: ["A normal Monday", "Credential stuffing / distributed brute force", "A DNS outage", "A software update"], c: 1, w: "Few attempts per account from many IPs is designed to evade per-IP lockouts. Add bot protection and MFA." } },
    { id: "telco", icon: "📡", name: "Telecom Infrastructure DDoS", sector: "Telecom", base: 57, like: 4, imp: 4, tags: ["T1498", "T1499"],
      what: "Distributed Denial of Service floods a network or service with junk traffic so real users cannot connect.",
      how: ["A botnet or rented 'booter' service sends huge volumes of traffic.", "Reflection attacks abuse open DNS, NTP or memcached servers to amplify traffic many times over.", "Links saturate, routers overload and customers lose service."],
      ioc: ["Sudden spike in packets per second or bandwidth", "Huge numbers of SYN packets without completed handshakes", "Large UDP responses from port 53/123/11211 you never requested"],
      defend: ["Use upstream scrubbing or an anycast DDoS provider", "Rate-limit and filter spoofed traffic (BCP38)", "Prepare BGP blackhole and runbooks in advance", "Keep spare capacity and monitor flow data", "Close open resolvers and reflectors"],
      pk: "Telecom and ISP networks are high-value, high-impact DDoS targets, so rehearsed response matters.",
      q: { t: "Traffic suddenly jumps 50x with huge UDP replies from port 53 you never asked for. Best response?", o: ["Reboot the router", "Engage upstream scrubbing, apply rate limits and filter the reflection source", "Ignore it", "Block all customers"], c: 1, w: "Large unsolicited DNS replies indicate a reflection/amplification attack, which needs upstream filtering and rate limits." } },
    { id: "grid", icon: "⚡", name: "National Load Dispatch Grid Intrusion", sector: "Energy (ICS/SCADA)", base: 94, like: 2, imp: 5, tags: ["T0855", "T0883", "T0886"],
      what: "Operational-technology networks control physical equipment. An intrusion can cause outages, so even small anomalies are treated as high risk.",
      how: ["Attackers reach the IT network first (phishing, VPN, vendor access).", "They find a path into the OT network where PLCs and SCADA servers sit, often over weakly protected remote-access links.", "Unauthorised commands or configuration changes are sent using legitimate industrial protocols such as Modbus or DNP3."],
      ioc: ["Unknown IP sending write commands to a PLC", "New remote-access tools or accounts on engineering workstations", "Firewall rules between IT and OT changed unexpectedly", "Controllers rebooted or logic downloaded outside maintenance windows"],
      defend: ["Segment IT and OT (Purdue model) with a monitored DMZ", "Never expose control devices to the internet", "VPN + MFA for vendors with session recording", "Passive OT network monitoring and protocol allow-lists", "Keep offline copies of PLC logic and rehearse manual operation"],
      pk: "Energy dispatch and utility sectors are strategic assets. Pair IT security with OT engineers in any incident.",
      q: { t: "An unknown IP sends Modbus write commands to a PLC from the IT network. What is the BEST first move?", o: ["Send test commands to see what happens", "Block the path at the IT/OT firewall, alert OT engineers and verify with operators", "Wait until the shift ends", "Reboot every PLC"], c: 1, w: "Contain the path first and involve people who understand the physical process. Testing or rebooting can cause real-world harm." } },
    { id: "media", icon: "📺", name: "Media Broadcast & Satellite Hijacking", sector: "Broadcast & satellite", base: 70, like: 2, imp: 4, tags: ["T1190", "T1584", "T1565"],
      what: "Attackers take over broadcast chains or satellite uplinks to inject their own audio, video or messages, or to knock a channel off air.",
      how: ["Default or weak credentials on encoders, playout servers or remote-management portals are used to get in.", "On satellite links, a stronger rogue uplink signal can override the legitimate one.", "Content is replaced or the feed is jammed."],
      ioc: ["Unexpected content on air", "Admin logins to encoders from unusual locations", "Unexplained changes to playout schedules", "Uplink power or frequency anomalies"],
      defend: ["Change default credentials and patch broadcast gear", "Authenticate and encrypt control and contribution links", "Separate playout networks from corporate IT", "Monitor the spectrum and uplink for rogue signals", "Keep a clean standby chain ready"],
      pk: "Broadcast and satellite services are public-facing and trusted by audiences, so hijacks have outsized impact.",
      q: { t: "A channel's output suddenly shows unscheduled content. Which first step is best?", o: ["Keep broadcasting and investigate later", "Switch to the clean standby chain, isolate the compromised playout and preserve logs", "Delete the playout server", "Post an apology only"], c: 1, w: "Restore trusted output first, then isolate and investigate while keeping evidence." } },
    { id: "avi", icon: "✈️", name: "Airport & Aviation Server Stress", sector: "Aviation", base: 83, like: 3, imp: 4, tags: ["T1499", "T1190"],
      what: "Aviation depends on always-on booking, check-in and flight-information systems. Denial-of-service or intrusion can delay thousands of passengers.",
      how: ["Floods or heavy bot traffic target public booking and check-in APIs.", "Weak third-party integrations are used to disrupt or access data.", "Operations fall back to slow manual procedures."],
      ioc: ["Sudden API latency and error rates", "Traffic from unusual regions or known bot networks", "Repeated requests to expensive endpoints"],
      defend: ["Rate-limit and protect public APIs with a WAF", "Design for graceful degradation and manual fallback", "Monitor third-party and supply-chain connections", "Run joint IT/operations incident exercises"],
      pk: "Airports combine public portals with critical operations, so rehearsal of manual fallback is essential.",
      q: { t: "Check-in API latency spikes and error rates climb while bot traffic increases. What is the BEST step?", o: ["Add more airline staff only", "Enable rate limits/bot rules, scale capacity and activate manual fallback procedures", "Shut the website forever", "Ignore the alerts"], c: 1, w: "Mitigate the load and keep operations running through documented fallback procedures." } },
    { id: "leo", icon: "🚔", name: "Law Enforcement Database Recon", sector: "Public safety", base: 63, like: 3, imp: 4, tags: ["T1595", "T1087", "T1213", "T1078"],
      what: "Attackers probe databases of police and public-safety agencies to find accounts, records and weak systems, either to steal sensitive data or to tip off criminals.",
      how: ["Scanning for exposed login pages and APIs.", "Testing stolen or reused credentials.", "Querying records to map officers, cases or informants."],
      ioc: ["Unusual query volume or after-hours searches", "Accounts accessing records they never touch", "Repeated failed logins from foreign IPs"],
      defend: ["MFA for all users and strict least privilege", "Database activity monitoring and anomaly alerts", "Honeytoken records that alert when accessed", "Separate sensitive datasets and log every access"],
      pk: "Insider misuse and credential theft are both realistic risks, so audit trails matter.",
      q: { t: "An officer's account suddenly searches thousands of unrelated records at 3 AM. Best action?", o: ["Assume it is a busy officer", "Suspend the session, verify with the user out-of-band and review the audit log", "Delete the account", "Do nothing until Monday"], c: 1, w: "Contain the possible compromise or insider misuse and verify through a separate channel." } },
    { id: "bisp", icon: "🎁", name: "BISP / Relief Fund Phishing Links", sector: "Citizen welfare", base: 90, like: 5, imp: 3, tags: ["T1566.002", "T1583.001", "T1204.001"],
      what: "Scammers abuse trusted welfare and relief programmes with fake 'registration' pages that collect CNIC numbers, phone numbers and 'fees'.",
      how: ["A forwarded message or SMS claims you are 'selected' for a grant.", "A look-alike website asks for CNIC, mobile number and a small fee.", "Collected data is used for wallet fraud, SIM abuse and identity theft."],
      ioc: ["Domain is not the official government domain", "Payment requested to receive a grant", "Pressure to forward to ten WhatsApp contacts", "Link shortener or cheap domain ending"],
      defend: ["Use only official government websites and channels", "Never pay a fee to 'unlock' welfare money", "Report fake pages to FIA and the hosting provider", "Run public-awareness campaigns in local languages"],
      pk: "Welfare programmes are repeatedly impersonated. Always verify through the official programme channels.",
      q: { t: "A WhatsApp message says 'Register for relief money here - pay Rs. 500 fee'. What should you do?", o: ["Pay quickly before it expires", "Ignore it, never pay, verify only on the official programme website and report the number", "Forward to family", "Send your CNIC photo"], c: 1, w: "Real grants never require an upfront fee, and unofficial links are the scam." } },
    { id: "gps", icon: "🛰️", name: "Drone & GPS Spoofing Signals", sector: "Navigation & aviation", base: 85, like: 3, imp: 4, tags: ["T0856", "T0830"],
      what: "GPS jamming blocks satellite signals, while spoofing broadcasts fake ones so receivers calculate a wrong position or time.",
      how: ["A transmitter overpowers the weak satellite signals.", "Fake signals gradually 'drag' a receiver to a false location.", "Drones, vehicles and timing systems act on wrong data."],
      ioc: ["Sudden position jumps or impossible speed", "Many receivers losing lock at once", "Signal-to-noise anomalies", "Time drift on GNSS-synchronised systems"],
      defend: ["Use multi-constellation and anti-spoofing receivers", "Add inertial or other backup navigation", "Cross-check GNSS with other sensors", "Monitor signal quality and alert on anomalies", "Train operators on loss-of-GNSS procedures"],
      pk: "Navigation spoofing matters for aviation, shipping, drones and time-synchronised infrastructure.",
      q: { t: "A drone's reported position suddenly jumps 20 km while its inertial sensors show no movement. What is likely?", o: ["A perfectly normal update", "GNSS spoofing or interference", "Low battery", "Wind"], c: 1, w: "A position jump that other sensors disagree with is a classic GNSS spoofing symptom." } },
    { id: "keys", icon: "🗝️", name: "Cryptographic Key Leak Scans", sector: "Software & cloud", base: 50, like: 4, imp: 4, tags: ["T1552.001", "T1552.004", "T1078"],
      what: "Bots constantly scan public code repositories and websites for exposed passwords, API keys and private keys, and abuse them within minutes.",
      how: ["A developer commits an API key or .env file to a public repository.", "Automated scanners find it quickly.", "The key is used to run cloud servers (often crypto-miners), read data or send spam."],
      ioc: ["Secret-scanning alerts", "API usage from unfamiliar IPs or countries", "Unexpected cloud bills or new resources", "Keys appearing in public paste sites"],
      defend: ["Rotate the exposed secret IMMEDIATELY, then investigate", "Use secret scanning and pre-commit hooks", "Store secrets in a vault, not in code", "Use short-lived, least-privilege tokens", "Alert on anomalous API usage"],
      pk: "Fast-growing startups and freelancers often leak keys by accident. Treat any exposed secret as compromised.",
      q: { t: "A developer pushed a cloud access key to a public repo 10 minutes ago. What comes FIRST?", o: ["Delete the repository", "Revoke/rotate the key immediately, then review its usage logs", "Email the team", "Wait for a bill"], c: 1, w: "Deleting the repo does not help; the key may already be copied. Rotate first, investigate second." } },
    { id: "darknet", icon: "🕳️", name: "Darknet Identity Leak Trading", sector: "Identity & finance", base: 82, like: 4, imp: 4, tags: ["T1589", "T1078", "T1657"],
      what: "Stolen identity data (names, ID numbers, phone numbers, passwords) is bought and sold on criminal forums and then used for fraud, account takeover and SIM abuse.",
      how: ["Data is stolen in breaches or by malware 'stealers'.", "It is packaged and sold or traded in underground markets.", "Buyers attempt account takeovers, loan fraud and targeted scams."],
      ioc: ["Your organisation's domain in breach databases", "Credential-stuffing waves right after a public leak", "Unusual new accounts or loan applications using real identities"],
      defend: ["Monitor breach databases and force resets", "Enforce MFA and block reused passwords", "Minimise and encrypt stored personal data", "Add fraud monitoring and customer alerts", "Educate users to use unique passwords"],
      pk: "Large data leaks make identity-based fraud easier. Unique passwords and MFA limit the damage.",
      q: { t: "Your customer database appears in a public breach list. What is the BEST first action?", o: ["Deny it publicly", "Verify the leak, force password resets and MFA, notify affected users and watch for fraud", "Wait for a news report", "Delete all logs"], c: 1, w: "Reduce attacker value quickly and be transparent with the people affected." } }
];
const MIT = { T1566: "Phishing", "T1566.001": "Spearphishing Attachment", "T1566.002": "Spearphishing Link", T1204: "User Execution", "T1204.001": "Malicious Link", T1598: "Phishing for Information", T1486: "Data Encrypted for Impact", T1490: "Inhibit System Recovery", T1021: "Remote Services", T1078: "Valid Accounts", T1111: "MFA Interception", T1451: "SIM Card Swap (Mobile)", T1190: "Exploit Public-Facing Application", T1105: "Ingress Tool Transfer", T1071: "Application Layer Protocol", T1041: "Exfiltration Over C2", T1110: "Brute Force", "T1110.004": "Credential Stuffing", T1498: "Network Denial of Service", T1499: "Endpoint Denial of Service", T0855: "Unauthorized Command Message (ICS)", T0883: "Internet Accessible Device (ICS)", T0886: "Remote Services (ICS)", T1584: "Compromise Infrastructure", T1565: "Data Manipulation", T1595: "Active Scanning", T1087: "Account Discovery", T1213: "Data from Information Repositories", "T1583.001": "Acquire Domains", T0856: "Spoof Reporting Message (ICS)", T0830: "Adversary-in-the-Middle (ICS)", "T1552.001": "Credentials in Files", "T1552.004": "Private Keys", T1589: "Gather Victim Identity Info", T1657: "Financial Theft" };
const EV = {
    phish: [["Wallet OTP phishing simulation", "Synthetic SMS gateway", "Mobile wallet", "high"], ["Credential-harvesting page flagged", "Training indicator", "Identity services", "high"], ["Look-alike bank domain registered", "Domain watchlist", "Banking", "medium"]],
    ransom: [["Ransomware execution scenario", "Sandbox payload", "Enterprise endpoint", "critical"], ["Mass file-rename burst detected", "Endpoint sensor (sim)", "File server", "critical"]],
    wallet: [["SIM-swap pattern suspected", "Telecom signal (sim)", "Mobile wallet", "high"], ["Fake 'received money' campaign", "Synthetic SMS gateway", "Mobile wallet", "medium"]],
    apt: [["Beaconing to rare domain", "Local simulation engine", "Government network", "critical"], ["Spear-phishing document opened", "Sandbox payload", "Government network", "high"]],
    govbf: [["Credential stuffing wave", "Synthetic botnet", "Citizen services", "high"], ["Login failures from 400 IPs", "Local simulation engine", "Citizen services", "medium"]],
    telco: [["Reflection flood mitigated", "Synthetic load event", "Telecom core", "high"], ["SYN flood on edge routers", "Synthetic load event", "Telecom core", "medium"]],
    grid: [["Unknown Modbus write command", "OT monitor (sim)", "Energy / SCADA", "critical"], ["IT to OT firewall rule change", "Local simulation engine", "Energy / SCADA", "high"]],
    media: [["Unscheduled content on air", "Playout monitor (sim)", "Broadcast", "high"], ["Encoder admin login from new region", "Local simulation engine", "Broadcast", "medium"]],
    avi: [["Aviation service stress test", "Synthetic load event", "Aviation systems", "medium"], ["Check-in API error spike", "Synthetic load event", "Aviation systems", "high"]],
    leo: [["Off-hours bulk record queries", "Local simulation engine", "Public safety", "high"], ["Repeated failed logins to records DB", "Synthetic botnet", "Public safety", "medium"]],
    bisp: [["Relief fund look-alike domain", "Training indicator", "Citizen services", "critical"], ["Fee-collection WhatsApp campaign", "Training indicator", "Citizen services", "high"]],
    gps: [["GNSS position jump anomaly", "Local simulation engine", "Navigation", "high"], ["Multiple receivers lost lock", "Local simulation engine", "Navigation", "medium"]],
    keys: [["Credential leak correlation", "Local simulation engine", "Identity services", "high"], ["API key found in public repo", "Secret-scan (sim)", "Cloud platform", "high"]],
    darknet: [["Identity data listed on forum", "Threat-intel (sim)", "Identity & finance", "high"], ["Credential-stuffing after leak", "Local simulation engine", "Identity services", "medium"]]
};
const ACTIONS = [["contain", "🧯 Contain / isolate"], ["escalate", "📣 Escalate to IR lead"], ["monitor", "👁️ Monitor & gather more"], ["fp", "✅ Close as false positive"]];
const best = ev => ev.sev === "critical" ? "contain" : ev.sev === "high" ? (ev.v.id === "apt" || ev.v.id === "grid" ? "escalate" : "contain") : "monitor";
const ACTION_WHY = { contain: "Containing quickly limits spread and damage. Isolate first, then investigate.", escalate: "This needs specialist or leadership involvement (IR lead, OT engineers or management) because impact could be large.", monitor: "Medium-severity alerts without proof of compromise are best watched while you gather evidence, not shut down.", fp: "Closing as a false positive is only right when evidence shows the activity is benign, which has not been shown here." };

/* ---------- state ---------- */
const S = { events: [], paused: false, sev: "all", vec: "all", q: "", sig: {}, tl: [], mttd: [], mttr: [], tab: "nvd", data: { nvd: null, kev: null, epss: null, gh: null, scam: null }, feeds: {}, drill: lsGet("cg_an6_drill", { score: 0, streak: 0, answered: 0 }), idx: 0, seq: 0, handled: 0, good: 0 };
V.forEach(v => S.sig[v.id] = v.base);
const lvl = s => s >= 85 ? ["CRITICAL", "c"] : s >= 68 ? ["ELEVATED", "h"] : ["GUARDED", "g"];
const SEVC = { critical: "c", high: "h", medium: "m", low: "l" };

/* ---------- shared bits (reuse global report styles) ---------- */
const rSec = (i, t, h) => `<section class="tpr-sec"><h4><span>${i}</span>${esc(t)}</h4>${h}</section>`;
const rTiles = a => `<div class="tpr-tiles">${a.filter(Boolean).map(([l, v, s]) => `<div class="tpr-tile"><small>${esc(l)}</small><b>${v}</b>${s ? `<em>${s}</em>` : ""}</div>`).join("")}</div>`;
const rList = (a, c = "") => `<ul class="tpr-ul ${c}">${a.map(x => `<li>${x}</li>`).join("")}</ul>`;
const rSteps = a => `<ol class="tpr-steps">${a.map(x => `<li>${x}</li>`).join("")}</ol>`;
const rPara = t => `<p class="tpr-p">${t}</p>`;
const gauge = (p, label, k) => { p = clamp(Math.round(p), 0, 100); return `<div class="tpr-gauge tpr-g-${k}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="${(p * 2.639).toFixed(1)} 264"/></svg><b>${p}</b><small>${esc(label)}</small></div>`; };
const hero = (ic, t, s, k, g) => `<div class="tpr-hero tpr-h-${k}"><div class="tpr-hero-i">${ic}</div><div class="tpr-hero-t"><h3>${t}</h3><p>${s}</p></div>${g || ""}</div>`;
function openModal(title, sub, html) {
    let m = document.getElementById("an6Modal");
    if (!m) { document.body.insertAdjacentHTML("beforeend", `<div id="an6Modal" class="tp-modal" hidden role="dialog" aria-modal="true"><div class="tp-modal-card"><header class="tp-modal-head"><div class="tp-modal-ttl"><h3 id="an6mT"></h3><small id="an6mS"></small></div><div class="tp-modal-actions"><button type="button" class="tp-x" id="an6mX" aria-label="Close">✕</button></div></header><div class="tp-modal-body" id="an6mB"></div></div></div>`); m = document.getElementById("an6Modal"); const close = () => { m.hidden = true; document.body.classList.remove("tp-lock"); }; document.getElementById("an6mX").onclick = close; m.addEventListener("click", e => { if (e.target === m) close(); }); document.addEventListener("keydown", e => { if (e.key === "Escape" && !m.hidden) close(); }); }
    document.getElementById("an6mT").textContent = title; document.getElementById("an6mS").textContent = sub || ""; const b = document.getElementById("an6mB"); b.innerHTML = html; b.scrollTop = 0; m.hidden = false; document.body.classList.add("tp-lock"); return b;
}

/* ---------- build ---------- */
function build() {
    mount.innerHTML = `
    <div class="an6">
        <header class="an6-head">
            <div><span class="an6-eyebrow">SECURITY OPERATIONS CENTER</span><h2>📊 Live SOC Analytics Command Center</h2>
            <p>A training SOC in your browser. The <b>incident engine and vector signals are a simulation</b> (clearly marked <i class="t-sim">SIM</i>) so you can practise real analyst decisions. The <b>Real-world threat pulse</b> uses public feeds (<i class="t-live">LIVE</i>). Click any vector or incident to open the deep-dive.</p></div>
            <div class="an6-status"><span class="an6-live"><i></i> SIMULATION LIVE</span><span id="an6Upd">last update --:--:-- PKT</span><span class="an6-drillchip" id="an6Chip">🎯 Drill score 0</span></div>
        </header>
        <div class="an6-bar">
            <input id="an6Q" type="search" placeholder="Search incidents, vectors, sectors…" aria-label="Search incidents">
            <select id="an6Sev" aria-label="Severity"><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select>
            <select id="an6Vec" aria-label="Vector"><option value="all">All vectors</option>${V.map(v => `<option value="${v.id}">${v.icon} ${esc(v.name)}</option>`).join("")}</select>
            <div class="an6-btns"><button type="button" id="an6Pause">⏸ Pause</button><button type="button" id="an6Pulse">⟳ Refresh pulse</button><button type="button" id="an6Csv">⬇ Export CSV</button></div>
        </div>
        <section class="an6-kpis" id="an6Kpis"></section>
        <div class="an6-main">
            <div class="an6-card"><div class="an6-ch"><h3>🌡️ Threat vector heatboard <em class="t-sim">SIM</em></h3><small>click a card for the deep-dive</small></div><div class="an6-vgrid" id="an6V"></div></div>
            <div class="an6-card an6-feedcard"><div class="an6-ch"><h3>🚨 Live incident feed <em class="t-sim">SIM</em></h3><small>click an incident to respond</small></div><div class="an6-feed" id="an6Feed"></div></div>
        </div>
        <section class="an6-charts" id="an6Charts"></section>
        <div class="an6-card"><div class="an6-ch"><h3>🌍 Real-world threat pulse <em class="t-live">LIVE</em></h3><div class="an6-feeds" id="an6Fd"></div></div><div class="an6-tabs" id="an6Tabs"></div><div class="an6-pulse" id="an6Pulse2"></div></div>
        <div class="an6-two">
            <div class="an6-card"><div class="an6-ch"><h3>🧠 Daily analyst drill</h3><small id="an6DStat"></small></div><div id="an6Drill"></div></div>
            <div class="an6-card"><div class="an6-ch"><h3>🎓 SOC Academy</h3><input id="an6AQ" type="search" placeholder="Search topics: MTTR, kill chain, SIEM…" aria-label="Search academy"></div><div class="an6-acad" id="an6Acad"></div></div>
        </div>
        <footer class="an6-foot"><b>Honest labelling:</b> <i class="t-sim">SIM</i> items are generated locally for training and are not real incidents or a real threat feed. <i class="t-live">LIVE</i> items come from public sources (NVD, CISA KEV, FIRST EPSS, GitHub advisories, CyberGuard Scam Radar) and show real timestamps.</footer>
    </div>`;
    $("#an6Q").oninput = e => { S.q = e.target.value.trim().toLowerCase(); renderFeed(); };
    $("#an6Sev").onchange = e => { S.sev = e.target.value; renderFeed(); };
    $("#an6Vec").onchange = e => { S.vec = e.target.value; renderFeed(); };
    $("#an6Pause").onclick = e => { S.paused = !S.paused; e.target.textContent = S.paused ? "▶ Resume" : "⏸ Pause"; $(".an6-live").classList.toggle("off", S.paused); $(".an6-live").lastChild.textContent = S.paused ? " SIMULATION PAUSED" : " SIMULATION LIVE"; };
    $("#an6Pulse").onclick = () => loadPulse(true);
    $("#an6Csv").onclick = exportCsv;
    $("#an6V").onclick = e => { const c = e.target.closest("[data-v]"); if (c) openVector(c.dataset.v); };
    $("#an6Feed").onclick = e => { const c = e.target.closest("[data-e]"); if (c) openIncident(c.dataset.e); };
    $("#an6Charts").onclick = e => { const c = e.target.closest("[data-v]"); if (c) openVector(c.dataset.v); };
    $("#an6AQ").oninput = renderAcademy;
    $("#an6Tabs").innerHTML = [["nvd", "🐞 New CVEs"], ["kev", "🔥 Exploited (KEV)"], ["epss", "🎯 EPSS top"], ["gh", "📦 Advisories"], ["scam", "🎣 Scam alerts"]].map(([k, n]) => `<button type="button" data-t="${k}" class="${k === S.tab ? "on" : ""}">${n}</button>`).join("");
    $("#an6Tabs").onclick = e => { const b = e.target.closest("button[data-t]"); if (!b) return; S.tab = b.dataset.t; [...$("#an6Tabs").children].forEach(x => x.classList.toggle("on", x === b)); renderPulse(); };
}

/* ---------- engine ---------- */
function mkEvent(v) { const t = pick(EV[v.id]), sev = t[3], id = "INC-" + (4000 + (++S.seq)); return { id, ts: Date.now(), v, title: t[0], src: t[1], sector: t[2], sev, status: "DETECTED", age: 0, det: ri(3, 18), res: null, by: null }; }
function weightedVector() { const w = V.map(v => Math.pow(S.sig[v.id] / 50, 3)); let t = w.reduce((a, b) => a + b, 0) * Math.random(); for (let i = 0; i < V.length; i++) { t -= w[i]; if (t <= 0) return V[i]; } return V[0]; }
function advance() {
    S.events.forEach(e => {
        if (e.by) return; e.age += 1;
        if (e.status === "DETECTED" && e.age >= 2) e.status = "INVESTIGATING";
        else if (e.status === "INVESTIGATING" && e.age >= ri(6, 14)) { e.status = e.sev === "critical" ? (Math.random() < .5 ? "CONTAINED" : "ESCALATED") : e.sev === "high" ? pick(["CONTAINED", "BLOCKED", "INVESTIGATING"]) : pick(["BLOCKED", "MONITORING", "CONTAINED"]); if (e.status !== "INVESTIGATING") { e.res = ri(24, 118); S.mttr.push(e.res); } }
    });
    if (S.mttr.length > 40) S.mttr.splice(0, S.mttr.length - 40);
}
function tick() {
    if (S.paused || document.hidden) return;
    V.forEach(v => { const drift = rnd(-3.2, 3.2) + (v.base - S.sig[v.id]) * 0.12; S.sig[v.id] = clamp(S.sig[v.id] + drift, 30, 99); });
    advance();
    const n = Math.random() < 0.7 ? 1 : Math.random() < 0.5 ? 2 : 0, c = { critical: 0, high: 0, medium: 0 };
    for (let i = 0; i < n; i++) { const e = mkEvent(weightedVector()); S.events.unshift(e); S.mttd.push(e.det); c[e.sev] = (c[e.sev] || 0) + 1; }
    if (S.events.length > 70) S.events.length = 70; if (S.mttd.length > 40) S.mttd.shift();
    S.tl.push(c); if (S.tl.length > 30) S.tl.shift();
    $("#an6Upd").textContent = "last update " + pkt(Date.now()) + " PKT";
    renderAll();
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function metrics() {
    const ev = S.events, open = ev.filter(e => ["DETECTED", "INVESTIGATING", "ESCALATED"].includes(e.status)), crit = open.filter(e => e.sev === "critical").length;
    const resolved = ev.filter(e => ["CONTAINED", "BLOCKED", "CLOSED"].includes(e.status)), mttd = avg(S.mttd) || 9, mttr = avg(S.mttr) || 62, sig = avg(V.map(v => S.sig[v.id]));
    const fp = clamp(5 + ev.filter(e => e.status === "CLOSED" && e.by === "fp").length * 1.5, 3, 20);
    const health = clamp(Math.round(100 - crit * 7 - open.length * 1.4 - Math.max(0, mttr - 60) / 3 - Math.max(0, mttd - 10) + S.good * 2), 18, 99);
    return { ev, open, crit, resolved, mttd, mttr, sig, fp, health, inv: ev.filter(e => e.status === "INVESTIGATING").length };
}

/* ---------- render ---------- */
const sevTag = s => `<b class="an6-sv an6-sv-${SEVC[s]}">${s.toUpperCase()}</b>`;
const stTag = s => `<b class="an6-st an6-st-${s.toLowerCase()}">${s}</b>`;
function renderKpis() {
    const m = metrics(), t = (i, l, v, s, k) => `<div class="an6-kpi an6-k-${k || "b"}"><span>${i}</span><small>${l}</small><b>${v}</b><u>${s}</u></div>`;
    $("#an6Kpis").innerHTML = t("📥", "Events in buffer", m.ev.length, "sample incidents", "b") + t("🛡️", "Blocked / contained", m.resolved.length, "mitigated scenarios", "g") + t("🔎", "Under investigation", m.inv, "open scenarios", "a") + t("📶", "Average signal", Math.round(m.sig) + "%", "across 14 vectors", "r") + t("⏱️", "MTTD (detect)", m.mttd.toFixed(1) + " min", "mean time to detect", "b") + t("🛠️", "MTTR (resolve)", Math.round(m.mttr) + " min", "mean time to respond", m.mttr > 75 ? "a" : "g") + t("🎭", "False-positive rate", m.fp.toFixed(1) + "%", "alerts closed as benign", "b") + t("❤️", "SOC health", m.health + "/100", m.crit ? `${m.crit} critical open` : "no critical open", m.health >= 75 ? "g" : m.health >= 50 ? "a" : "r");
}
function renderVectors() {
    $("#an6V").innerHTML = V.map(v => { const s = Math.round(S.sig[v.id]), l = lvl(s), n = S.events.filter(e => e.v.id === v.id).length; return `<div class="an6-vc" data-v="${v.id}" tabindex="0" role="button" aria-label="${esc(v.name)}"><div class="an6-vt"><span>${v.icon}</span><h4>${esc(v.name)}</h4></div><div class="an6-bar2"><i class="an6-f-${l[1]}" style="width:${s}%"></i><b>${s}% ${l[0]}</b></div><small>${esc(v.sector)} · ${n} incident${n === 1 ? "" : "s"}</small></div>`; }).join("");
}
function filtered() { return S.events.filter(e => (S.sev === "all" || e.sev === S.sev) && (S.vec === "all" || e.v.id === S.vec) && (!S.q || (e.title + e.v.name + e.sector + e.src + e.id).toLowerCase().includes(S.q))); }
function renderFeed() {
    const l = filtered().slice(0, 14);
    $("#an6Feed").innerHTML = l.length ? l.map(e => `<div class="an6-ev" data-e="${e.id}" tabindex="0" role="button"><div class="an6-evh"><span>${e.v.icon}</span><b>${esc(e.title)}</b></div><div class="an6-evm">${sevTag(e.sev)}${stTag(e.status)}<small>${esc(e.sector)} · ${esc(e.src)}</small><time>${pkt(e.ts)} PKT</time></div></div>`).join("") : `<div class="an6-empty">No incidents match your filters.</div>`;
}
const bars = (rows, cls) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(([n, v]) => `<div class="an6-b"><span>${esc(n)}</span><i class="${cls}" style="--w:${Math.round(v / mx * 100)}%"></i><em>${v}</em></div>`).join(""); };
function renderCharts() {
    const ev = S.events, sevC = { critical: 0, high: 0, medium: 0 }; ev.forEach(e => sevC[e.sev]++);
    const tot = Math.max(1, ev.length), C = 2 * Math.PI * 40; let off = 0;
    const don = [["critical", "#ff3366"], ["high", "#ffbb00"], ["medium", "#00bcff"]].map(([k, c]) => { const l = sevC[k] / tot * C, s = `<circle r="40" cx="50" cy="50" fill="none" stroke="${c}" stroke-width="14" stroke-dasharray="${l.toFixed(1)} ${(C - l).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 50 50)"/>`; off += l; return s; }).join("");
    const maxT = Math.max(1, ...S.tl.map(c => (c.critical || 0) + (c.high || 0) + (c.medium || 0)));
    const tl = S.tl.map(c => { const a = c.critical || 0, b = c.high || 0, d = c.medium || 0, t = a + b + d; return `<div class="an6-col" title="${t} events"><i class="c" style="height:${a / maxT * 100}%"></i><i class="h" style="height:${b / maxT * 100}%"></i><i class="m" style="height:${d / maxT * 100}%"></i></div>`; }).join("");
    const st = k => ev.filter(e => k.includes(e.status)).length, fun = [["Detected", ev.length], ["Triaged", ev.length - ev.filter(e => e.status === "DETECTED").length], ["Contained / blocked", st(["CONTAINED", "BLOCKED", "CLOSED"])], ["Closed by analyst", ev.filter(e => e.by).length]];
    const sec = {}; ev.forEach(e => sec[e.sector] = (sec[e.sector] || 0) + 1); const secR = Object.entries(sec).sort((a, b) => b[1] - a[1]).slice(0, 6);
    let mat = ""; for (let imp = 5; imp >= 1; imp--) for (let li = 1; li <= 5; li++) { const risk = li * imp, z = risk >= 15 ? "r" : risk >= 8 ? "a" : "g", dots = V.filter(v => v.like === li && v.imp === imp).map(v => `<button type="button" class="an6-dot" data-v="${v.id}" title="${esc(v.name)}">${v.icon}</button>`).join(""); mat += `<div class="an6-cell an6-z-${z}">${dots}</div>`; }
    $("#an6Charts").innerHTML = `
        <div class="an6-card"><h4>Events per tick <em class="t-sim">SIM</em></h4><div class="an6-tl">${tl || "<small>collecting…</small>"}</div><div class="an6-lg"><span><i class="c"></i>critical</span><span><i class="h"></i>high</span><span><i class="m"></i>medium</span></div></div>
        <div class="an6-card"><h4>Severity mix <em class="t-sim">SIM</em></h4><div class="an6-donut"><svg viewBox="0 0 100 100">${don}<text x="50" y="48" text-anchor="middle" class="dn">${ev.length}</text><text x="50" y="60" text-anchor="middle" class="ds">incidents</text></svg><div class="an6-lg v"><div><i class="c"></i>Critical ${sevC.critical}</div><div><i class="h"></i>High ${sevC.high}</div><div><i class="m"></i>Medium ${sevC.medium}</div></div></div></div>
        <div class="an6-card"><h4>Response funnel <em class="t-sim">SIM</em></h4>${bars(fun, "fn")}</div>
        <div class="an6-card"><h4>Most targeted sectors <em class="t-sim">SIM</em></h4>${secR.length ? bars(secR, "sc") : "<small>collecting…</small>"}</div>
        <div class="an6-card an6-mx"><h4>Risk matrix (likelihood × impact)</h4><div class="an6-matrix">${mat}</div><div class="an6-ax"><span>← lower likelihood</span><span>higher likelihood →</span></div><p class="an6-note">Each icon is a vector. Top-right = fix first. Click an icon for its playbook.</p></div>`;
}
function renderAll() { renderKpis(); renderVectors(); renderFeed(); renderCharts(); const c = $("#an6Chip"); if (c) c.textContent = `🎯 Drill score ${S.drill.score}`; }

/* ---------- vector drawer ---------- */
function openVector(id) {
    const v = V.find(x => x.id === id); if (!v) return; const s = Math.round(S.sig[id]), l = lvl(s), k = l[1] === "c" ? "bad" : l[1] === "h" ? "warn" : "ok";
    const rel = S.events.filter(e => e.v.id === id).slice(0, 5);
    const b = openModal(v.name, v.sector + " · deep-dive", hero(v.icon, esc(v.name), `${esc(v.sector)} · current signal <b>${s}% ${l[0]}</b> (simulated)`, k, gauge(s, "signal", k)) +
        rSec("📖", "What is it?", rPara(esc(v.what))) + rSec("🧬", "How the attack works", rSteps(v.how.map(esc))) + rSec("🔍", "What defenders look for (indicators)", rList(v.ioc.map(esc))) +
        rSec("🧭", "MITRE ATT&CK mapping", `<div class="tpr-table"><table><thead><tr><th>Technique</th><th>Name</th></tr></thead><tbody>${v.tags.map(t => `<tr><td data-label="Technique"><a class="cg-result-link" href="https://attack.mitre.org/techniques/${t.replace(".", "/")}/" target="_blank" rel="noopener noreferrer">${t} ↗</a></td><td data-label="Name">${esc(MIT[t] || "")}</td></tr>`).join("")}</tbody></table></div>`) +
        rSec("🛡️", "How to prevent, detect and respond", rSteps(v.defend.map(esc))) + rSec("🇵🇰", "Pakistan context", rPara(esc(v.pk))) +
        rSec("🚨", "Recent simulated incidents of this type", rel.length ? rel.map(e => `<button type="button" class="an6-rel" data-e="${e.id}">${sevTag(e.sev)} ${esc(e.title)} ${stTag(e.status)}</button>`).join("") : rPara("None in the buffer yet. Wait a few seconds.")) +
        rSec("🎯", "Test yourself", `<div id="an6Q1"></div>`));
    b.querySelectorAll(".an6-rel").forEach(x => x.onclick = () => openIncident(x.dataset.e));
    drillCard(b.querySelector("#an6Q1"), v);
}
function drillCard(box, v, after) {
    const q = v.q; box.innerHTML = `<div class="an6-q"><p><b>${esc(q.t)}</b></p><div class="an6-opts">${q.o.map((o, i) => `<button type="button" data-i="${i}">${String.fromCharCode(65 + i)}. ${esc(o)}</button>`).join("")}</div><div class="an6-fb" hidden></div></div>`;
    box.querySelectorAll(".an6-opts button").forEach(b => b.onclick = () => {
        if (box.dataset.done) return; box.dataset.done = "1"; const i = +b.dataset.i, ok = i === q.c;
        box.querySelectorAll(".an6-opts button").forEach((x, j) => { x.disabled = true; if (j === q.c) x.classList.add("ok"); else if (j === i) x.classList.add("no"); });
        S.drill.answered++; if (ok) { S.drill.score += 10 + Math.min(10, S.drill.streak * 2); S.drill.streak++; } else S.drill.streak = 0; lsSet("cg_an6_drill", S.drill);
        const fb = box.querySelector(".an6-fb"); fb.hidden = false; fb.className = "an6-fb " + (ok ? "ok" : "no"); fb.innerHTML = `${ok ? "✅ Correct!" : "❌ Not quite."} ${esc(q.w)} <small>Score ${S.drill.score} · streak ${S.drill.streak}</small>`;
        const c = $("#an6Chip"); if (c) c.textContent = `🎯 Drill score ${S.drill.score}`; renderDrillStat(); after && after();
    });
}

/* ---------- incident drawer ---------- */
function openIncident(id) {
    const e = S.events.find(x => x.id === id); if (!e) return; const v = e.v;
    const k = e.sev === "critical" ? "bad" : e.sev === "high" ? "warn" : "ok", t0 = e.ts;
    const tm = [["T+0", "Alert fires: " + e.title], ["T+" + e.det + " min", "Analyst picks up the alert (mean time to detect)"], ["T+" + (e.det + 4) + " min", "Triage: confirm it is real, scope affected assets"], ["T+" + (e.det + 12) + " min", "Containment decision (isolate / block / escalate)"], ["T+" + (e.res || e.det + 45) + " min", e.res ? "Resolved: " + e.status : "Target resolution (SLA)"]];
    const b = openModal(e.id + " · " + e.title, `${e.sector} · ${pkt(e.ts)} PKT`, hero(v.icon, esc(e.title), `${esc(v.name)} · source ${esc(e.src)} · ${sevTag(e.sev)} ${stTag(e.status)}`, k, "") +
        rTiles([["Incident ID", esc(e.id)], ["Severity", e.sev.toUpperCase()], ["Status", `<span id="an6St">${e.status}</span>`], ["Sector", esc(e.sector)], ["Vector", esc(v.name)], ["Detected", pkt(t0) + " PKT"], ["MITRE", v.tags.slice(0, 3).join(", ")], ["Response SLA", e.sev === "critical" ? "15 min" : e.sev === "high" ? "1 hour" : "4 hours"]]) +
        rSec("🕰️", "Incident timeline", `<div class="tpr-timeline">${tm.map(([a, c]) => `<div class="tpr-tl"><b>${a}</b><span>${esc(c)}</span></div>`).join("")}</div>`) +
        rSec("🔍", "Triage questions to ask", rList(["Is the activity real or a false positive? What evidence supports that?", "Which systems, accounts and data are affected?", "Is the attacker still active right now?", "Does it match known indicators: " + esc(v.ioc.slice(0, 2).join("; ")) + "?"])) +
        rSec("📦", "Evidence to collect (before changing anything)", rList(["Relevant logs and timestamps (firewall, EDR, auth, proxy)", "Memory/disk snapshot of affected hosts if possible", "Email headers, URLs, hashes and screenshots", "A written timeline of every action you take"])) +
        rSec("🧑‍💻", "Your decision", `<p class="tpr-p">What is the best next action for this ${esc(e.sev)} incident? Your choice updates the live metrics.</p><div class="an6-acts" id="an6Acts">${ACTIONS.map(([k2, n]) => `<button type="button" data-a="${k2}">${n}</button>`).join("")}</div><div class="an6-fb" id="an6ActFb" hidden></div>`) +
        rSec("🛡️", "Recommended playbook", rSteps(v.defend.slice(0, 5).map(esc))) + rSec("📚", "Deep-dive", `<button type="button" class="an6-rel" id="an6Dive">${v.icon} Open the ${esc(v.name)} knowledge page</button>`));
    b.querySelector("#an6Dive").onclick = () => openVector(v.id);
    b.querySelectorAll("#an6Acts button").forEach(x => x.onclick = () => {
        const a = x.dataset.a, ok = a === best(e), fb = b.querySelector("#an6ActFb"); b.querySelectorAll("#an6Acts button").forEach(y => y.disabled = true); x.classList.add(ok ? "ok" : "no");
        e.by = a; e.status = a === "fp" ? "CLOSED" : a === "contain" ? "CONTAINED" : a === "escalate" ? "ESCALATED" : "MONITORING"; e.res = ok ? ri(14, 40) : ri(70, 130); S.mttr.push(e.res); S.handled++; if (ok) S.good++;
        fb.hidden = false; fb.className = "an6-fb " + (ok ? "ok" : "no"); fb.innerHTML = `${ok ? "✅ Good call." : "⚠️ Not the best choice."} ${esc(ACTION_WHY[best(e)])} <small>Best action: ${ACTIONS.find(z => z[0] === best(e))[1]}</small>`;
        const st = b.querySelector("#an6St"); if (st) st.textContent = e.status; renderAll();
    });
}
function exportCsv() {
    const rows = [["id", "time_utc", "severity", "status", "vector", "sector", "source", "title", "simulated"], ...S.events.map(e => [e.id, new Date(e.ts).toISOString(), e.sev, e.status, e.v.name, e.sector, e.src, e.title, "yes"])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "cyberguard-soc-simulation.csv"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- daily drill ---------- */
function renderDrillStat() { const s = $("#an6DStat"); if (s) s.textContent = `Score ${S.drill.score} · streak ${S.drill.streak} · answered ${S.drill.answered}`; }
function renderDrill() {
    renderDrillStat(); const box = $("#an6Drill"), v = V[S.idx % V.length];
    box.innerHTML = `<div class="an6-dtag">${v.icon} ${esc(v.name)}</div><div id="an6DQ"></div><div class="an6-dnext"><button type="button" id="an6DN" hidden>Next question →</button></div>`;
    drillCard($("#an6DQ"), v, () => { const n = $("#an6DN"); n.hidden = false; n.onclick = () => { S.idx = (S.idx + 1 + ri(0, V.length - 1)) % V.length; renderDrill(); }; });
}

/* ---------- SOC Academy ---------- */
const ACAD = [
    ["🏢", "What is a SOC?", "A Security Operations Center is the team, tools and process that watch an organisation 24/7, detect attacks, investigate alerts and respond. It combines <b>people</b> (analysts), <b>process</b> (playbooks) and <b>technology</b> (SIEM, EDR, threat intel)."],
    ["👥", "SOC roles and tiers", "<b>Tier 1</b> triages alerts and closes false positives. <b>Tier 2</b> investigates confirmed incidents. <b>Tier 3 / threat hunters</b> proactively search for hidden attackers and build detections. <b>IR lead</b> coordinates major incidents. <b>SOC engineers</b> maintain the tooling. A <b>SOC manager</b> owns metrics and staffing."],
    ["⛓️", "Cyber kill chain", "Seven steps: <b>1 Reconnaissance → 2 Weaponization → 3 Delivery → 4 Exploitation → 5 Installation → 6 Command & Control → 7 Actions on objectives.</b> Defenders win by breaking the chain at any step: earlier is cheaper."],
    ["🧭", "MITRE ATT&CK", "A public knowledge base of attacker behaviour. Enterprise tactics: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command & Control, Exfiltration, Impact. Use it to describe what you saw and to check detection coverage."],
    ["🔁", "Incident response lifecycle (NIST)", "<b>1 Preparation</b> (plans, tools, training) → <b>2 Detection & analysis</b> → <b>3 Containment, eradication & recovery</b> → <b>4 Post-incident activity</b> (lessons learned). Contain first to stop damage, but preserve evidence."],
    ["⏱️", "SOC metrics explained", "<b>MTTD</b> = mean time to detect. <b>MTTR</b> = mean time to respond/resolve. <b>Dwell time</b> = how long an attacker stayed unnoticed. <b>False-positive rate</b> = share of alerts that were harmless. <b>Coverage</b> = share of ATT&CK techniques you can detect. Lower MTTD/MTTR and dwell time are better."],
    ["🔬", "Detection types", "<b>Signature</b> (known bad hashes/patterns), <b>anomaly</b> (unusual vs baseline), <b>behavioural</b> (suspicious chains of actions), <b>threat-intel</b> (matches known bad IPs/domains) and <b>deception</b> (honeypots/honeytokens). Strong SOCs layer all five."],
    ["🔺", "Pyramid of Pain", "From easy to painful for attackers to change: hash values → IP addresses → domain names → network/host artefacts → tools → <b>TTPs</b> (behaviours). Detect behaviours, not just indicators, because indicators change instantly."],
    ["🚦", "Severity and response times", "<b>Critical</b>: active compromise or major business impact, respond in minutes. <b>High</b>: likely compromise, within the hour. <b>Medium</b>: suspicious, within hours. <b>Low</b>: informational. Always define who is paged and when to escalate."],
    ["🗂️", "Common log sources", "Firewall and proxy logs, DNS logs, endpoint/EDR telemetry, Windows event logs, authentication/VPN logs, email gateway, cloud audit logs (AWS CloudTrail, Azure, Google), web server and WAF logs, and database audit logs. No logs, no detection."],
    ["🆚", "IoC vs TTP", "An <b>Indicator of Compromise</b> is a specific artefact (an IP, a file hash). A <b>TTP</b> (tactics, techniques, procedures) is how attackers behave. IoCs expire quickly; TTP-based detections last."],
    ["🇵🇰", "Reporting & help in Pakistan", "Report cyber-crime to the <b>FIA Cyber Crime Wing (NR3C)</b> (helpline 1991). Contact your bank's official helpline for financial fraud and the telecom operator for SIM problems. Organisations should also inform their national CERT. Always confirm contact details on official websites."],
    ["📖", "Glossary", "<b>SIEM</b> collects and correlates logs. <b>SOAR</b> automates response. <b>EDR/XDR</b> watches endpoints/everything. <b>IDS/IPS</b> detect/block network attacks. <b>WAF</b> protects web apps. <b>C2</b> is attacker remote control. <b>Lateral movement</b> is hopping between machines. <b>Exfiltration</b> is stealing data out. <b>Zero-day</b> is an unpatched, unknown flaw."]
];
function renderAcademy() {
    const q = ($("#an6AQ").value || "").trim().toLowerCase(), l = ACAD.filter(a => !q || (a[1] + a[2]).toLowerCase().includes(q));
    $("#an6Acad").innerHTML = l.length ? l.map(a => `<details class="an6-ac"><summary><span>${a[0]}</span>${esc(a[1])}</summary><p>${a[2]}</p></details>`).join("") : `<div class="an6-empty">No topic matches "${esc(q)}".</div>`;
}

/* ---------- REAL threat pulse ---------- */
const PROXIES = [u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), u => "https://corsproxy.io/?" + encodeURIComponent(u)];
async function fetchT(url, ms = 15000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); } finally { clearTimeout(t); } }
async function getData(url, proxy) { try { return JSON.parse(await fetchT(url)); } catch (e) { if (!proxy) throw e; } for (const mk of PROXIES) { try { return JSON.parse(await fetchT(mk(url))); } catch (_) { } } throw new Error("unreachable"); }
const bad = {}; const cget = k => lsGet("cg_an6_" + k, null);
async function feed(name, loader, norm) {
    S.feeds[name] = { state: "loading" }; renderFeedsChips();
    try { if (bad[name] && Date.now() - bad[name] < 15 * 60000) throw new Error("skip"); const d = norm(await loader()); S.data[name] = d; lsSet("cg_an6_" + name, { t: Date.now(), d }); S.feeds[name] = { state: "live", t: Date.now() }; delete bad[name]; }
    catch (_) { bad[name] = Date.now(); const c = cget(name); if (c && c.d) { S.data[name] = c.d; S.feeds[name] = { state: "cached", t: c.t }; } else S.feeds[name] = { state: "off" }; }
    renderFeedsChips(); renderPulse();
}
async function loadPulse(force) {
    if (force) Object.keys(bad).forEach(k => delete bad[k]);
    const now = new Date(), st = new Date(now - 24 * 3600e3), iso = d => d.toISOString().replace("Z", "");
    await Promise.all([
        feed("nvd", () => getData(`https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(iso(st))}&pubEndDate=${encodeURIComponent(iso(now))}&resultsPerPage=40`, true), r => ({ total: r.totalResults || (r.vulnerabilities || []).length, items: (r.vulnerabilities || []).map(v => { const c = v.cve, m = c.metrics || {}, mm = (m.cvssMetricV40 || m.cvssMetricV31 || m.cvssMetricV30 || m.cvssMetricV2 || [])[0], cd = mm ? mm.cvssData : null; return { id: c.id, ts: Date.parse(c.published), score: cd ? cd.baseScore : null, sev: cd ? (cd.baseSeverity || (cd.baseScore >= 9 ? "CRITICAL" : cd.baseScore >= 7 ? "HIGH" : cd.baseScore >= 4 ? "MEDIUM" : "LOW")) : "UNRATED", desc: ((c.descriptions || []).find(d => d.lang === "en") || {}).value || "" }; }).sort((a, b) => b.ts - a.ts) })),
        feed("kev", () => getData("https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json", true), r => ({ count: r.count || (r.vulnerabilities || []).length, items: (r.vulnerabilities || []).map(v => ({ id: v.cveID, vendor: v.vendorProject, product: v.product, name: v.vulnerabilityName, ts: Date.parse(v.dateAdded), ransom: /known/i.test(v.knownRansomwareCampaignUse || ""), due: v.dueDate })).sort((a, b) => b.ts - a.ts).slice(0, 60) })),
        feed("epss", () => getData("https://api.first.org/data/v1/epss?order=!epss&limit=10", true), r => ({ items: (r.data || []).map(x => ({ id: x.cve, p: +x.epss })) })),
        feed("gh", () => getData("https://api.github.com/advisories?per_page=12&type=reviewed&sort=published&direction=desc"), r => (Array.isArray(r) ? r : []).map(a => ({ id: a.ghsa_id, cve: a.cve_id, ts: Date.parse(a.published_at), sev: String(a.severity || "").toUpperCase(), title: a.summary, url: a.html_url }))),
        (async () => { try { const c = JSON.parse(localStorage.getItem("cg_scam_live_v1") || "null"); if (c && c.items && c.items.length) { S.data.scam = c.items; S.feeds.scam = { state: Date.now() - c.t < 3600e3 ? "live" : "cached", t: c.t }; } else S.feeds.scam = { state: "off" }; } catch (_) { S.feeds.scam = { state: "off" }; } renderFeedsChips(); renderPulse(); })()
    ]);
}
const FN = { nvd: "NVD", kev: "CISA KEV", epss: "EPSS", gh: "GitHub", scam: "Scam radar" };
function renderFeedsChips() { const b = $("#an6Fd"); if (b) b.innerHTML = Object.entries(FN).map(([k, n]) => { const f = S.feeds[k] || { state: "loading" }; return `<span class="an6-fd an6-fd-${f.state}" title="${n}: ${f.state}"><i></i>${n}</span>`; }).join(""); }
const svb = s => { const k = /CRIT/i.test(s) ? "c" : /HIGH/i.test(s) ? "h" : /MED|MOD/i.test(s) ? "m" : /LOW/i.test(s) ? "l" : "u"; return `<b class="an6-sv an6-sv-${k}">${esc(String(s).slice(0, 4).toUpperCase())}</b>`; };
function renderPulse() {
    const el = $("#an6Pulse2"); if (!el) return; const t = S.tab, d = S.data[t], st = (S.feeds[t] || {}).state; let h = "";
    const none = n => `<div class="an6-empty">${st === "loading" || !st ? "⏳ Loading live data…" : st === "off" ? `📴 ${n} is not reachable right now (network, rate limit or blocked). Press Refresh pulse.` : "No items."}</div>`;
    if (t === "nvd") h = d ? `<div class="an6-ph"><b>${num(d.total)}</b> CVEs published in the last 24 hours · showing the newest</div>` + d.items.slice(0, 8).map(x => `<a class="an6-pr" href="https://nvd.nist.gov/vuln/detail/${esc(x.id)}" target="_blank" rel="noopener noreferrer">${svb(x.sev)}<div><b>${esc(x.id)}${x.score != null ? ` <i>CVSS ${x.score}</i>` : ""}</b><small>${esc(x.desc.slice(0, 140))}${x.desc.length > 140 ? "…" : ""}</small></div><time>${ago(x.ts)}</time></a>`).join("") : none("NVD");
    else if (t === "kev") h = d ? `<div class="an6-ph"><b>${num(d.count)}</b> vulnerabilities in CISA's Known Exploited catalogue · latest additions</div>` + d.items.slice(0, 8).map(x => `<a class="an6-pr" href="https://nvd.nist.gov/vuln/detail/${esc(x.id)}" target="_blank" rel="noopener noreferrer"><b class="an6-sv an6-sv-c">KEV</b><div><b>${esc(x.id)} · ${esc(x.vendor)} ${esc(x.product)}</b><small>${esc(x.name)}${x.ransom ? " · <em>used by ransomware</em>" : ""} · patch by ${esc(x.due || "—")}</small></div><time>${ago(x.ts)}</time></a>`).join("") : none("CISA KEV");
    else if (t === "epss") h = d ? `<div class="an6-ph">Probability each CVE is exploited in the next 30 days (FIRST EPSS)</div>` + d.items.map(x => `<a class="an6-pr" href="https://nvd.nist.gov/vuln/detail/${esc(x.id)}" target="_blank" rel="noopener noreferrer"><b class="an6-sv an6-sv-h">EPSS</b><div><b>${esc(x.id)}</b><div class="an6-pbar"><i style="width:${Math.round(x.p * 100)}%"></i></div></div><time>${(x.p * 100).toFixed(1)}%</time></a>`).join("") : none("FIRST EPSS");
    else if (t === "gh") h = d ? d.slice(0, 8).map(x => `<a class="an6-pr" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${svb(x.sev)}<div><b>${esc(x.title)}</b><small>${esc(x.cve || x.id)}</small></div><time>${ago(x.ts)}</time></a>`).join("") : none("GitHub");
    else if (t === "scam") h = d ? `<div class="an6-ph"><b>${d.length}</b> scam alerts from the CyberGuard Live Scam Radar</div>` + d.slice(0, 8).map(x => `<a class="an6-pr" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b class="an6-sv ${x.high ? "an6-sv-h" : "an6-sv-m"}">${x.high ? "HIGH" : "MED"}</b><div><b>${esc(x.title)}</b><small>${esc(x.label || "")} · ${esc(x.source || "")}</small></div><time>${ago(x.ts)}</time></a>`).join("") : `<div class="an6-empty">Scam alerts appear once the Live Scam Radar above has loaded.</div>`;
    el.innerHTML = h;
}

/* ---------- boot ---------- */
function init() {
    build();
    for (let i = 0; i < 9; i++) { const e = mkEvent(weightedVector()); e.ts -= i * 45000; e.age = ri(0, 14); S.events.push(e); S.mttd.push(e.det); }
    S.events.forEach(e => { if (e.age >= 8) { e.status = e.sev === "critical" ? "CONTAINED" : pick(["BLOCKED", "CONTAINED", "MONITORING"]); e.res = ri(24, 110); S.mttr.push(e.res); } else if (e.age >= 2) e.status = "INVESTIGATING"; });
    for (let i = 0; i < 12; i++) S.tl.push({ critical: ri(0, 1), high: ri(0, 2), medium: ri(0, 1) });
    renderAll(); renderDrill(); renderAcademy(); renderFeedsChips(); renderPulse();
    $("#an6Upd").textContent = "last update " + pkt(Date.now()) + " PKT";
    const loop = () => { tick(); setTimeout(loop, tier() === "low" ? 7000 : tier() === "medium" ? 4500 : 3200); }; setTimeout(loop, 3200);
    const start = () => { if (start.d) return; start.d = 1; loadPulse(false); setInterval(() => { if (!document.hidden) loadPulse(false); }, 10 * 60000); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "400px" }); io.observe(mount); } else start();
    setTimeout(start, 9000);
    window.addEventListener("storage", e => { if (e.key === "cg_scam_live_v1") loadPulse(false); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
window.CG_AN6 = { state: S, vectors: V };
})();