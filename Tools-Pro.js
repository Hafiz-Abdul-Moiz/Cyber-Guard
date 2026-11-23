/* ============================================================
   CYBERGUARD // TOOLS-PRO.JS  (30 Security Tools - REAL DATA ENGINE)
   ------------------------------------------------------------
   Ye file script.js ke BAAD load hoti hai aur 30 tools ke functions
   ko upgrade karti hai (script.js ko chhua nahi gaya).

   REAL FREE APIs (kisi key ki zaroorat NAHI):
     HIBP Pwned Passwords  - password breach count (k-anonymity)
     XposedOrNot           - email breach check
     HIBP Breaches         - domain breach history
     ipwho.is / ipapi.co   - IP geolocation + ASN
     Shodan InternetDB     - open ports / CVEs / tags (passive)
     dns.google (DoH)      - DNS records, DNSSEC, resolve
     RDAP (rdap.org)       - domain age (phishing signal)
     crt.sh / CertSpotter  - SSL certs + subdomains (CT logs)
     Mozilla Observatory   - security headers grade
     HackerTarget          - HTTP headers / host search (free tier)
     binlist.net           - card BIN lookup
     maclookup.app         - MAC vendor
     CIRCL hashlookup      - known-file hash database
     GitHub API            - handle OSINT
     DOMPurify (cdnjs)     - real XSS sanitizing
   OPTIONAL KEYS (neeche CG_API_KEYS mein daal dein, free milti hain):
     googleSafeBrowsing -> https://developers.google.com/safe-browsing/v4/get-started
     shodan             -> https://account.shodan.io  (honeypot score)
   ============================================================ */
(function () {
"use strict";

/* ------------------------------------------------------------
   0. API KEYS  (khali chhorein to tool bina key wale mode mein chalta hai)
   ------------------------------------------------------------ */
const KEYS = window.CG_API_KEYS = Object.assign({
    googleSafeBrowsing: "",   // <-- apni free Google Safe Browsing key yahan paste karein
    shodan: ""                // <-- apni free Shodan key yahan paste karein (optional)
}, window.CG_API_KEYS || {});

/* ------------------------------------------------------------
   1. HELPERS
   ------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const val = id => ($(id)?.value || "").trim();
const num = n => Number(n).toLocaleString("en-US");

async function getRaw(url, opt = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opt.timeout || 10000);
    try {
        const r = await fetch(url, { ...opt, signal: ctl.signal });
        if (!r.ok && !opt.allowStatus) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
        return r;
    } finally { clearTimeout(t); }
}
const getJson = async (url, opt) => (await getRaw(url, opt)).json();
const getText = async (url, opt) => (await getRaw(url, opt)).text();

function set(id, html, state = "info", plain = false) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = html + (plain ? "" : `<div class="tp-actions"><button type="button" class="tp-copy" data-target="${id}">⧉ Copy result</button></div>`);
    el.classList.add("tp-out");
    const card = el.closest(".tool-card");
    if (card) card.dataset.state = state;
}
const busy = (id, msg) => set(id, `<div class="tp-busy"><span class="tp-spin"></span><span>${esc(msg)}</span></div>`, "info", true);
const fail = (id, msg, state = "danger") => set(id, `<div class="tp-verdict tp-${state}"><span class="tp-vi">${state === "danger" ? "⛔" : "⚠️"}</span><div><b>${esc(msg)}</b></div></div>`, state);

const badge = (t, k = "info") => `<span class="tp-badge tp-b-${k}">${esc(t)}</span>`;
const chips = (arr, k = "info") => `<div class="tp-chips">${arr.map(x => badge(x, k)).join("")}</div>`;
const note = t => `<div class="tp-note">${t}</div>`;
const meter = (pct, k = "ok") => `<div class="tp-meter"><i class="tp-m-${k}" style="width:${Math.max(2, Math.min(100, pct))}%"></i></div>`;
const kv = rows => `<div class="tp-kv">${rows.filter(Boolean).map(([a, b]) => `<div class="tp-row"><span>${esc(a)}</span><b>${b}</b></div>`).join("")}</div>`;
const verdict = (icon, title, kind, sub = "") => `<div class="tp-verdict tp-${kind}"><span class="tp-vi">${icon}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div></div>`;
const code = t => `<code>${esc(t)}</code>`;
const link = (href, text) => `<a class="cg-result-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
const stateOf = score => score >= 60 ? "danger" : score >= 25 ? "warning" : "success";

document.addEventListener("click", e => {
    const b = e.target.closest(".tp-copy");
    if (!b) return;
    const src = $(b.dataset.target);
    if (!src) return;
    const clone = src.cloneNode(true);
    clone.querySelectorAll(".tp-actions").forEach(x => x.remove());
    const text = clone.innerText.trim();
    const done = () => { b.textContent = "✓ Copied"; setTimeout(() => (b.textContent = "⧉ Copy result"), 1600); };
    (navigator.clipboard?.writeText(text) || Promise.reject()).then(done).catch(() => {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (_) { } ta.remove();
    });
});

/* ---- host / ip helpers ---- */
const isIPv4 = s => /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s);
const isIPv6 = s => s.includes(":") && /^[0-9a-f:.]+$/i.test(s) && (s.match(/:/g) || []).length >= 2;
const isIP = s => isIPv4(s) || isIPv6(s);
const isDomain = s => /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s) || /^xn--/.test(s);

function parseHost(raw) {
    let v = String(raw || "").trim();
    if (!v) throw new Error("Input required");
    v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[\/?#]/)[0].replace(/^.*@/, "");
    if (v.startsWith("[")) v = v.slice(1).split("]")[0];
    else if ((v.match(/:/g) || []).length === 1) v = v.split(":")[0];
    return v.toLowerCase().replace(/\.$/, "");
}
function privateKind(ip) {
    if (!isIPv4(ip)) {
        const l = ip.toLowerCase();
        if (l === "::1") return "Loopback (IPv6)";
        if (/^f[cd]/.test(l)) return "Private ULA (IPv6)";
        if (/^fe[89ab]/.test(l)) return "Link-local (IPv6)";
        return "";
    }
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return "Private (10.0.0.0/8)";
    if (a === 172 && b >= 16 && b <= 31) return "Private (172.16.0.0/12)";
    if (a === 192 && b === 168) return "Private (192.168.0.0/16)";
    if (a === 127) return "Loopback";
    if (a === 169 && b === 254) return "Link-local (APIPA)";
    if (a === 100 && b >= 64 && b <= 127) return "Carrier-grade NAT (100.64/10)";
    if (a === 0) return "Reserved (0.0.0.0/8)";
    if (a >= 224) return "Multicast / Reserved";
    return "";
}
async function dnsQuery(name, type) {
    return getJson(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { timeout: 8000 });
}
async function resolveIPs(host) {
    if (isIP(host)) return [host];
    const d = await dnsQuery(host, "A");
    const ips = (d.Answer || []).filter(a => a.type === 1).map(a => a.data);
    if (!ips.length) {
        const d6 = await dnsQuery(host, "AAAA");
        return (d6.Answer || []).filter(a => a.type === 28).map(a => a.data);
    }
    return ips;
}
async function internetDb(ip) {
    try { return await getJson(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, { timeout: 9000 }); }
    catch (e) { if (e.status === 404) return { notFound: true, ports: [], vulns: [], hostnames: [], tags: [], cpes: [] }; throw e; }
}
const PORT_NAMES = { 20: "FTP-data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3", 111: "RPC", 123: "NTP", 135: "MS-RPC", 139: "NetBIOS", 143: "IMAP", 161: "SNMP", 389: "LDAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 500: "IPsec", 514: "Syslog", 587: "SMTP-sub", 631: "IPP", 993: "IMAPS", 995: "POP3S", 1080: "SOCKS", 1433: "MSSQL", 1521: "Oracle", 1723: "PPTP", 1883: "MQTT", 2049: "NFS", 2375: "Docker-API", 3000: "Dev-HTTP", 3306: "MySQL", 3389: "RDP", 5000: "UPnP/Dev", 5060: "SIP", 5432: "PostgreSQL", 5555: "ADB", 5900: "VNC", 5985: "WinRM", 6379: "Redis", 7547: "TR-069", 8000: "HTTP-alt", 8008: "HTTP-alt", 8080: "HTTP-proxy", 8081: "HTTP-alt", 8443: "HTTPS-alt", 8888: "HTTP-alt", 9000: "Svc", 9200: "Elasticsearch", 9100: "Printer", 11211: "Memcached", 27017: "MongoDB", 50000: "SAP/Svc" };
const RISKY_PORTS = new Set([21, 23, 111, 135, 139, 161, 445, 1433, 1521, 2049, 2375, 3306, 3389, 5432, 5555, 5900, 5985, 6379, 7547, 9200, 11211, 27017]);

/* ============================================================
   1. PASSWORD RESILIENCE ANALYZER  (HIBP k-anonymity = REAL)
   ============================================================ */
const COMMON_PW = ["password", "123456", "123456789", "qwerty", "111111", "12345678", "abc123", "password1", "1234567", "iloveyou", "admin", "welcome", "monkey", "dragon", "letmein", "football", "123123", "000000", "pakistan", "admin123", "qwerty123", "1q2w3e4r", "princess", "sunshine", "master", "login", "passw0rd", "hello", "freedom", "whatever", "trustno1", "baseball", "superman", "shadow", "jazzcash", "easypaisa", "lahore", "karachi", "islamabad", "allah", "muhammad", "123321", "654321", "zxcvbnm", "asdfghjkl", "qazwsx", "1qaz2wsx", "12345", "1234", "0000", "1111", "test", "test123", "abc12345", "987654321", "computer", "internet", "cyberguard", "changeme", "secret", "pass", "root", "user", "guest", "default"];
const SEQS = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
const deLeet = s => s.toLowerCase().replace(/[@4]/g, "a").replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[$5]/g, "s").replace(/7/g, "t");

function fmtDuration(sec) {
    if (!isFinite(sec) || sec > 3.15e17) return "billions of years+";
    if (sec < 1) return "instantly";
    const U = [["year", 31557600], ["month", 2629800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
    for (const [n, s] of U) if (sec >= s) { const v = Math.round(sec / s); return v >= 1e6 ? "millions of years" : `${num(v)} ${n}${v > 1 ? "s" : ""}`; }
    return "instantly";
}
function analyzePassword(p) {
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26;
    if (/[A-Z]/.test(p)) pool += 26;
    if (/\d/.test(p)) pool += 10;
    if (/[^A-Za-z0-9]/.test(p)) pool += 33;
    let bits = p.length * Math.log2(Math.max(pool, 2));
    const issues = [], good = [];
    const low = deLeet(p);
    let penalty = 0;
    if (COMMON_PW.includes(p.toLowerCase()) || COMMON_PW.includes(low)) { issues.push("Top common password (instantly guessable)"); bits = Math.min(bits, 10); }
    else {
        const w = COMMON_PW.find(c => c.length >= 4 && low.includes(c));
        if (w) { penalty += 14; issues.push(`Contains common word "${w}"`); }
    }
    const rep = p.match(/(.)\1{2,}/g);
    if (rep) { penalty += rep.length * 5; issues.push("Repeated characters (aaa / 111)"); }
    let seqHit = false;
    const lp = p.toLowerCase();
    for (let i = 0; i + 3 <= lp.length && !seqHit; i++) {
        const w = lp.slice(i, i + 3), r = [...w].reverse().join("");
        if (SEQS.some(s => s.includes(w) || s.includes(r))) seqHit = true;
    }
    if (seqHit) { penalty += 8; issues.push("Keyboard / alphabet / number sequence"); }
    if (/(19|20)\d{2}$/.test(p)) { penalty += 5; issues.push("Ends with a year"); }
    if (/^\d+$/.test(p)) { penalty += 6; issues.push("Digits only"); }
    if (/^[a-zA-Z]+$/.test(p)) { penalty += 4; issues.push("Letters only"); }
    if (new Set(p).size < p.length / 2) { penalty += 6; issues.push("Very few unique characters"); }
    bits = Math.max(0, bits - penalty);
    if (p.length >= 12) good.push("12+ characters");
    if (p.length >= 16) good.push("16+ characters");
    if (pool >= 62) good.push("Mixed character types");
    if (/[^A-Za-z0-9]/.test(p)) good.push("Contains symbols");
    if (p.length < 8) issues.push("Shorter than 8 characters");
    return { bits, pool, issues, good, score: Math.min(100, Math.round(bits / 1.2)) };
}
async function sha1Hex(text) {
    const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}
let pwToken = 0, pwTimer = null;
window.checkPasswordStrength = function () {
    const p = $("passInput")?.value || "";
    const bar = $("strengthBar"), text = $("strengthText");
    if (!bar || !text) return;
    const card = text.closest(".tool-card");
    if (!p) { bar.style.width = "0%"; text.textContent = "Awaiting Input..."; if (card) card.dataset.state = "info"; return; }
    const a = analyzePassword(p);
    const col = a.score < 30 ? "#ff3366" : a.score < 55 ? "#ffbb00" : a.score < 75 ? "#00bcff" : "#00ffaa";
    bar.style.width = Math.max(4, a.score) + "%";
    bar.style.backgroundColor = col;
    const label = a.score < 30 ? "Very Weak" : a.score < 45 ? "Weak" : a.score < 65 ? "Fair" : a.score < 82 ? "Strong" : "Excellent";
    const g = Math.pow(2, Math.max(a.bits - 1, 0));
    const sc = [["Online (throttled 100/s)", 100], ["Online (fast 10k/s)", 1e4], ["Offline fast hash 10B/s", 1e10], ["GPU farm 1T/s", 1e12]];
    text.innerHTML = `
        <div class="tp-verdict tp-${a.score < 45 ? "danger" : a.score < 65 ? "warning" : "success"}"><span class="tp-vi">${a.score < 45 ? "🔓" : a.score < 65 ? "🔐" : "🛡️"}</span>
        <div><b>${label} • ${a.score}/100</b><small>${p.length} chars • ${a.bits.toFixed(1)} bits entropy</small></div></div>
        ${kv(sc.map(([n, r]) => [n, fmtDuration(g / r)]))}
        ${a.issues.length ? chips(a.issues, "danger") : ""}${a.good.length ? chips(a.good, "ok") : ""}
        <div id="pwBreachLine" class="tp-note">🔎 Checking real breach database (HIBP)…</div>`;
    if (card) card.dataset.state = a.score < 45 ? "danger" : a.score < 65 ? "warning" : "success";
    clearTimeout(pwTimer);
    const my = ++pwToken;
    pwTimer = setTimeout(async () => {
        const line = () => document.getElementById("pwBreachLine");
        try {
            if (!crypto?.subtle) throw new Error("no-subtle");
            const h = await sha1Hex(p);
            const body = await getText(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`, { timeout: 9000 });
            if (my !== pwToken || !line()) return;
            const hit = body.split(/\r?\n/).map(l => l.split(":")).find(([s]) => s === h.slice(5));
            if (hit) {
                line().className = "tp-note tp-bad";
                line().innerHTML = `☠️ <b>Found ${num(parseInt(hit[1], 10))} times</b> in real data breaches (HIBP). Never use this password.`;
                if (card) card.dataset.state = "danger";
            } else {
                line().className = "tp-note tp-good";
                line().innerHTML = "✅ Not found in 800M+ breached passwords (HIBP). Only the first 5 hash characters were sent (k-anonymity).";
            }
        } catch (_) {
            if (my === pwToken && line()) line().textContent = "ℹ️ Breach database unreachable right now (needs HTTPS + internet). Local analysis above is still valid.";
        }
    }, 700);
};

/* ============================================================
   2. EMAIL BREACH INSPECTOR  (XposedOrNot = REAL)
   ============================================================ */
const DISPOSABLE = ["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com"];
async function xonEmail(email) {
    try {
        const d = await getJson(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`, { timeout: 12000 });
        const list = Array.isArray(d.breaches) ? d.breaches.flat() : [];
        return { found: list.length > 0, list };
    } catch (e) { if (e.status === 404) return { found: false, list: [] }; throw e; }
}
window.simulateBreachCheck = async function () {
    const email = val("emailInput");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("breachResult", "Enter a valid email address.");
    const domain = email.split("@")[1].toLowerCase(), local = email.split("@")[0];
    busy("breachResult", "Checking breach databases…");
    const [br, mx] = await Promise.allSettled([xonEmail(email), dnsQuery(domain, "MX")]);
    const mxOk = mx.status === "fulfilled" ? (mx.value.Answer || []).some(a => a.type === 15) : null;
    const flags = [];
    if (DISPOSABLE.includes(domain)) flags.push(badge("Disposable email domain", "warn"));
    if (/^(admin|info|support|sales|contact|root|noreply|no-reply|webmaster|postmaster)$/i.test(local)) flags.push(badge("Role account", "warn"));
    if (mxOk === false) flags.push(badge("Domain has NO mail server (MX)", "danger"));
    if (mxOk === true) flags.push(badge("Mail server exists", "ok"));
    if (br.status === "rejected") {
        return set("breachResult", verdict("⚠️", "Breach service unreachable", "warning", "Rate-limited or offline. Try again in a minute.") + `<div class="tp-chips">${flags.join("")}</div>`, "warning");
    }
    const { found, list } = br.value;
    if (!found) {
        return set("breachResult", verdict("✅", "No breach found", "success", `${esc(email)} not listed in XposedOrNot database`) + `<div class="tp-chips">${flags.join("")}</div>` + note("Absence here is not a guarantee. Still use unique passwords + 2FA."), "success");
    }
    set("breachResult", verdict("🚨", `Exposed in ${list.length} breach${list.length > 1 ? "es" : ""}`, "danger", esc(email)) +
        chips(list.slice(0, 24), "danger") + (list.length > 24 ? note(`+${list.length - 24} more`) : "") +
        `<div class="tp-chips">${flags.join("")}</div>` + note("Action: change the password on these sites, enable 2FA, never reuse passwords.") + link("https://xposedornot.com/", "Full details on XposedOrNot"), "danger");
};

/* ============================================================
   3. PHISHING LINK & DOMAIN INSPECTOR (heuristics + RDAP age + DNS + Safe Browsing)
   ============================================================ */
const BRANDS = ["easypaisa", "jazzcash", "hbl", "ubl", "mcb", "meezan", "alfalah", "paypal", "google", "facebook", "whatsapp", "instagram", "binance", "amazon", "microsoft", "apple", "netflix", "nadra", "fbr", "daraz", "telenor", "zong", "ufone", "jazz", "sadapay", "nayapay", "raast", "paytm", "tiktok", "telegram", "youtube", "linkedin"];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at", "tiny.cc", "buff.ly", "rebrand.ly", "wa.me"];
const SLD = /^(co|com|net|org|gov|edu|ac|nic)$/;
function regDomain(host) {
    if (isIP(host)) return host;
    const p = host.split(".");
    if (p.length >= 3 && SLD.test(p[p.length - 2]) && p[p.length - 1].length === 2) return p.slice(-3).join(".");
    return p.slice(-2).join(".");
}
function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}
function brandCheck(host) {
    const rd = regDomain(host), name = rd.split(".")[0], out = [];
    const norm = deLeet(name).replace(/[-_]/g, "");
    for (const b of BRANDS) {
        if (name === b) continue;
        if (name.includes(b) || norm.includes(b)) { out.push(`Looks like "${b}" brand abuse`); break; }
        if (b.length >= 5 && lev(norm, b) <= 1) { out.push(`Typosquat of "${b}"`); break; }
    }
    const sub = host.slice(0, Math.max(0, host.length - rd.length));
    for (const b of BRANDS) if (b.length > 3 && sub.includes(b) && name !== b) { out.push(`Brand "${b}" used in subdomain of a different domain`); break; }
    return out;
}
async function domainAge(host) {
    try {
        const d = await getJson(`https://rdap.org/domain/${encodeURIComponent(regDomain(host))}`, { timeout: 9000 });
        const ev = (d.events || []).find(e => /registration/i.test(e.eventAction));
        if (!ev) return null;
        const created = new Date(ev.eventDate);
        return { created, days: Math.floor((Date.now() - created) / 864e5), registrar: (d.entities || []).map(e => e.vcardArray?.[1]?.find(v => v[0] === "fn")?.[3]).filter(Boolean)[0] };
    } catch (_) { return null; }
}
async function safeBrowsing(url) {
    if (!KEYS.googleSafeBrowsing) return null;
    try {
        const r = await getJson(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(KEYS.googleSafeBrowsing)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, timeout: 9000,
            body: JSON.stringify({ client: { clientId: "cyberguard", clientVersion: "6.0" }, threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }] } })
        });
        return (r.matches || []).map(m => m.threatType);
    } catch (_) { return undefined; }
}
async function analyzeUrl(raw) {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw);
    const host = u.hostname.toLowerCase();
    const reasons = []; let risk = 0;
    const add = (t, w) => { reasons.push(t); risk += w; };
    if (u.protocol !== "https:") add("Not using HTTPS", 15);
    if (isIPv4(host)) add("IP address used instead of domain", 25);
    if (host.includes("xn--")) add("Punycode (possible lookalike characters)", 25);
    if (u.username || u.password) add("Credentials embedded in URL (@ trick)", 30);
    if (host.split(".").length > 4) add("Unusually deep subdomain chain", 12);
    if (/[^\x00-\x7f]/.test(host)) add("Non-ASCII hostname characters", 20);
    if (SHORTENERS.includes(host)) add("URL shortener hides the real destination", 18);
    if (/\.(zip|mov|top|xyz|click|work|download|tk|ml|ga|cf|gq|icu|buzz|rest|cyou|monster)$/i.test(host)) add("High-abuse TLD", 15);
    if (/(login|signin|verify|secure|account|update|wallet|bank|bonus|reward|claim|free|prize|gift|otp|kyc|suspend)/i.test(host + u.pathname)) add("Social-engineering keywords", 14);
    if ((host.match(/-/g) || []).length >= 3) add("Many hyphens in domain", 10);
    if (u.port && !["80", "443", ""].includes(u.port)) add(`Non-standard port :${u.port}`, 10);
    if (/\.(apk|exe|scr|bat|msi|jar|vbs|ps1)(\?|$)/i.test(u.pathname)) add("Direct download of an executable/APK", 25);
    if (u.href.length > 150) add("Very long URL", 6);
    brandCheck(host).forEach(t => add(t, 30));
    return { u, host, reasons, risk };
}
window.inspectURL = async function () {
    const raw = val("urlInput");
    if (!raw) return fail("urlResult", "Enter a URL to inspect.");
    let a;
    try { a = await analyzeUrl(raw); } catch (_) { return fail("urlResult", "Invalid URL format."); }
    busy("urlResult", "Running 4 checks: heuristics, domain age, DNS, Safe Browsing…");
    const [age, dns, sb] = await Promise.all([isIP(a.host) ? null : domainAge(a.host), isIP(a.host) ? [a.host] : resolveIPs(a.host).catch(() => null), safeBrowsing(a.u.href)]);
    let risk = a.risk; const extra = [];
    if (age) {
        if (age.days < 30) { risk += 35; extra.push(["Domain age", badge(`${age.days} days old - VERY NEW`, "danger")]); }
        else if (age.days < 180) { risk += 15; extra.push(["Domain age", badge(`${age.days} days old`, "warn")]); }
        else extra.push(["Domain age", badge(`${Math.floor(age.days / 365 * 10) / 10} years`, "ok")]);
        if (age.registrar) extra.push(["Registrar", esc(age.registrar)]);
    } else if (!isIP(a.host)) extra.push(["Domain age", badge("Unavailable (TLD has no public RDAP)", "info")]);
    if (dns === null || (Array.isArray(dns) && !dns.length)) { risk += 10; extra.push(["DNS", badge("Domain does not resolve", "warn")]); }
    else if (dns) extra.push(["Resolves to", code(dns.slice(0, 2).join(", "))]);
    if (Array.isArray(sb)) { if (sb.length) { risk = 100; extra.push(["Google Safe Browsing", badge("LISTED: " + sb.join(", "), "danger")]); } else extra.push(["Google Safe Browsing", badge("Not listed", "ok")]); }
    else if (sb === undefined) extra.push(["Google Safe Browsing", badge("Check failed (key/quota)", "info")]);
    else extra.push(["Google Safe Browsing", badge("Add key in CG_API_KEYS to enable", "info")]);
    risk = Math.min(100, risk);
    const k = stateOf(risk);
    set("urlResult",
        verdict(risk >= 60 ? "🚨" : risk >= 25 ? "⚠️" : "🛡️", risk >= 60 ? "HIGH RISK - do not open" : risk >= 25 ? "SUSPICIOUS - verify first" : "LOWER RISK", k, `Risk score ${risk}/100`) + meter(risk, k === "danger" ? "bad" : k === "warning" ? "warn" : "ok") +
        kv([["Domain", code(a.host)], ...extra]) +
        (a.reasons.length ? chips(a.reasons, risk >= 60 ? "danger" : "warn") : note("No obvious red flags. This is NOT proof the site is safe.")), k);
};

/* ============================================================
   4. IP GEOLOCATION & THREAT FINDER  (ipwho.is + InternetDB + PTR)
   ============================================================ */
window.lookupIP = async function () {
    let q = val("ipInput"), host = "";
    busy("ipResult", "Querying IP intelligence…");
    try {
        if (q) { host = parseHost(q); if (!isIP(host)) { const ips = await resolveIPs(host); if (!ips.length) return fail("ipResult", "Domain does not resolve to an IP."); q = ips[0]; } else q = host; }
        const pk = q && privateKind(q);
        if (pk) return set("ipResult", verdict("🏠", "Non-public address", "info", esc(q)) + kv([["Type", badge(pk, "info")]]) + note("Private/local ranges have no public geolocation."), "info");
        let g;
        try {
            g = await getJson(`https://ipwho.is/${q ? encodeURIComponent(q) : ""}`, { timeout: 9000 });
            if (g.success === false) throw new Error(g.message);
        } catch (_) {
            const o = await getJson(`https://ipapi.co/${q ? encodeURIComponent(q) + "/" : ""}json/`, { timeout: 9000 });
            if (o.error) throw new Error(o.reason);
            g = { ip: o.ip, country: o.country_name, region: o.region, city: o.city, latitude: o.latitude, longitude: o.longitude, connection: { asn: (o.asn || "").replace("AS", ""), org: o.org, isp: o.org }, timezone: { id: o.timezone }, flag: {} };
        }
        const ip = g.ip;
        const [db, ptr] = await Promise.allSettled([internetDb(ip), isIPv4(ip) ? dnsQuery(ip.split(".").reverse().join(".") + ".in-addr.arpa", "PTR") : Promise.resolve({})]);
        const d = db.status === "fulfilled" ? db.value : null;
        const rev = ptr.status === "fulfilled" ? (ptr.value.Answer || []).map(a => a.data.replace(/\.$/, "")) : [];
        const risky = d ? (d.ports || []).filter(p => RISKY_PORTS.has(p)) : [];
        const bad = d && ((d.vulns || []).length || (d.tags || []).some(t => /malware|c2|scanner|tor|compromised|botnet/i.test(t)));
        const state = bad ? "danger" : risky.length ? "warning" : "success";
        set("ipResult",
            verdict(g.flag?.emoji || "📍", esc(ip), state, bad ? "Threat indicators found" : risky.length ? "Risky services exposed" : "No threat indicators found") +
            kv([["Country", esc(g.country || "—")], ["Region / City", esc((g.region || "—") + " / " + (g.city || "—"))], ["ASN", g.connection?.asn ? code("AS" + g.connection.asn) : "—"], ["ISP / Org", esc(g.connection?.org || g.connection?.isp || "—")], ["Timezone", esc(g.timezone?.id || "—")], rev.length ? ["Reverse DNS", code(rev[0])] : null,
            d && !d.notFound ? ["Open ports", d.ports?.length ? d.ports.map(p => badge(p + (PORT_NAMES[p] ? " " + PORT_NAMES[p] : ""), RISKY_PORTS.has(p) ? "danger" : "info")).join("") : "—"] : null,
            d && d.vulns?.length ? ["CVEs", chips(d.vulns.slice(0, 8), "danger")] : null, d?.tags?.length ? ["Tags", chips(d.tags, "warn")] : null]) +
            (g.latitude != null ? link(`https://www.openstreetmap.org/?mlat=${g.latitude}&mlon=${g.longitude}#map=9/${g.latitude}/${g.longitude}`, "View on map") : "") +
            note("Geolocation is approximate (city-level). Ports/CVEs from Shodan InternetDB (passive)."), state);
    } catch (e) { fail("ipResult", "IP providers unavailable or rate-limited. No fake data shown.", "warning"); }
};

/* ============================================================
   5. STRONG PASSWORD GENERATOR  (crypto RNG, options, copy)
   ============================================================ */
function randInt(max) {
    const lim = Math.floor(0x100000000 / max) * max; const a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
}
function ensureGenUI() {
    const out = $("genPassOutput"); if (!out || $("genLen")) return;
    const wrap = document.createElement("div"); wrap.className = "tp-gen-opts";
    wrap.innerHTML = `
        <label class="tp-gen-len">Length <b id="genLenVal">20</b><input type="range" id="genLen" min="8" max="64" value="20"></label>
        <div class="tp-gen-toggles">
          <label><input type="checkbox" id="genUp" checked> A-Z</label><label><input type="checkbox" id="genLow" checked> a-z</label>
          <label><input type="checkbox" id="genNum" checked> 0-9</label><label><input type="checkbox" id="genSym" checked> !@#</label>
          <label><input type="checkbox" id="genAmb" checked> No look-alikes</label>
        </div>`;
    out.closest(".input-group").after(wrap);
    $("genLen").addEventListener("input", e => { $("genLenVal").textContent = e.target.value; window.generatePassword(); });
    wrap.querySelectorAll("input[type=checkbox]").forEach(c => c.addEventListener("change", () => window.generatePassword()));
    const res = document.createElement("div"); res.id = "genMeta"; res.className = "breach-result-text"; wrap.after(res);
    const btn = out.closest(".tool-card").querySelector(".btn-primary-small");
    if (btn) btn.insertAdjacentHTML("afterend", ` <button type="button" class="btn-primary-small tp-btn-ghost" id="genCopyBtn">⧉ Copy</button>`);
    $("genCopyBtn")?.addEventListener("click", () => { const v = $("genPassOutput").value; if (!v) return; navigator.clipboard?.writeText(v); $("genCopyBtn").textContent = "✓ Copied"; setTimeout(() => ($("genCopyBtn").textContent = "⧉ Copy"), 1500); });
}
window.generatePassword = function () {
    ensureGenUI();
    const out = $("genPassOutput"); if (!out) return;
    const amb = $("genAmb")?.checked !== false;
    const strip = s => amb ? s.replace(/[Il1O0o|]/g, "") : s;
    const sets = [];
    if ($("genUp")?.checked !== false) sets.push(strip("ABCDEFGHIJKLMNOPQRSTUVWXYZ"));
    if ($("genLow")?.checked !== false) sets.push(strip("abcdefghijklmnopqrstuvwxyz"));
    if ($("genNum")?.checked !== false) sets.push(strip("0123456789"));
    if ($("genSym")?.checked !== false) sets.push("!@#$%^&*_-+=?");
    if (!sets.length) sets.push(strip("abcdefghijklmnopqrstuvwxyz"));
    const len = Math.max(sets.length, parseInt($("genLen")?.value || "20", 10));
    const all = sets.join("");
    const chars = sets.map(s => s[randInt(s.length)]);
    while (chars.length < len) chars.push(all[randInt(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1);[chars[i], chars[j]] = [chars[j], chars[i]]; }
    out.value = chars.join("");
    const bits = len * Math.log2(all.length);
    const meta = $("genMeta");
    if (meta) meta.innerHTML = `${badge(bits.toFixed(0) + " bits entropy", bits >= 100 ? "ok" : bits >= 70 ? "info" : "warn")} ${badge(fmtDuration(Math.pow(2, bits - 1) / 1e12) + " @ 1T guesses/s", "info")} ${badge("Generated locally - never sent anywhere", "ok")}`;
    out.closest(".tool-card")?.setAttribute("data-state", "success");
};

/* ============================================================
   6. JWT INSPECTOR (claims, expiry, risk flags, HS256 verify)
   ============================================================ */
function b64uBytes(v) { let s = v.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function ensureJwtUI() {
    const i = $("jwtInput"); if (!i || $("jwtSecret")) return;
    i.closest(".input-group").insertAdjacentHTML("beforeend", `<input type="text" id="jwtSecret" placeholder="(optional) HS256 secret to verify signature" autocomplete="off">`);
}
window.decodeJWT = async function () {
    ensureJwtUI();
    const jwt = val("jwtInput").replace(/^Bearer\s+/i, "");
    if (!jwt) return fail("jwtResult", "Paste a JWT first.");
    try {
        const parts = jwt.split(".");
        if (parts.length !== 3) throw new Error();
        const dec = new TextDecoder();
        const h = JSON.parse(dec.decode(b64uBytes(parts[0]))), p = JSON.parse(dec.decode(b64uBytes(parts[1])));
        const flags = []; let state = "success";
        const alg = String(h.alg || "");
        if (alg.toLowerCase() === "none") { flags.push(badge("alg=none (unsigned!)", "danger")); state = "danger"; }
        if (/^HS/i.test(alg)) flags.push(badge("Symmetric " + alg + " - secret must be strong", "warn"));
        if (h.jku || h.x5u) { flags.push(badge("jku/x5u header (key-injection risk)", "danger")); state = "danger"; }
        if (h.kid && /[\/'";]|\.\./.test(h.kid)) { flags.push(badge("Suspicious kid value", "danger")); state = "danger"; }
        const now = Date.now() / 1000, rows = [];
        const t = (k, l) => { if (p[k]) rows.push([l, `${new Date(p[k] * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC`]); };
        t("iat", "Issued at"); t("nbf", "Not before"); t("exp", "Expires");
        if (p.exp) { if (p.exp < now) { flags.push(badge("EXPIRED " + fmtDuration(now - p.exp) + " ago", "danger")); if (state !== "danger") state = "warning"; } else flags.push(badge("Valid for " + fmtDuration(p.exp - now), "ok")); }
        else flags.push(badge("No exp claim (never expires)", "warn"));
        if (p.nbf && p.nbf > now) flags.push(badge("Not yet valid", "warn"));
        let sig = "";
        const secret = val("jwtSecret");
        if (secret && alg === "HS256") {
            const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[0] + "." + parts[1])));
            const given = b64uBytes(parts[2]);
            const ok = mac.length === given.length && mac.every((b, i) => b === given[i]);
            sig = badge(ok ? "✔ Signature VALID" : "✘ Signature INVALID", ok ? "ok" : "danger"); if (!ok) state = "danger";
        } else if (secret) sig = badge("Verification supports HS256 only", "info");
        set("jwtResult",
            verdict("🔑", `JWT decoded • ${esc(alg || "?")}`, state, esc(h.typ || "")) + `<div class="tp-chips">${flags.join("")}${sig}</div>` +
            (rows.length ? kv(rows) : "") + `<div class="tp-sub">Header</div><pre>${esc(JSON.stringify(h, null, 2))}</pre><div class="tp-sub">Payload</div><pre>${esc(JSON.stringify(p, null, 2))}</pre>` +
            note("Decoding ≠ trust. Never paste live production tokens into public tools."), state);
    } catch (_) { fail("jwtResult", "Invalid JWT (needs 3 Base64URL parts with JSON header/payload)."); }
};

/* ============================================================
   7. BASE64 ENCODER / DECODER (UTF-8 safe, URL-safe aware)
   ============================================================ */
function bytesToB64(bytes) { let s = ""; bytes.forEach(b => (s += String.fromCharCode(b))); return btoa(s); }
window.handleBase64 = function (mode) {
    const input = $("base64Input")?.value || "";
    if (!input) return fail("base64Result", "Enter a string first.");
    try {
        if (mode === "encode") {
            const bytes = new TextEncoder().encode(input), b = bytesToB64(bytes);
            return set("base64Result", verdict("🔐", "Encoded", "success", `${bytes.length} bytes → ${b.length} chars`) + kv([["Base64", code(b)], ["URL-safe", code(b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""))]]), "success");
        }
        const clean = input.replace(/\s+/g, "");
        if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) throw new Error();
        const bytes = b64uBytes(clean);
        let text = null; try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch (_) { }
        const printable = text !== null && !/[\x00-\x08\x0e-\x1f]/.test(text);
        let json = false; if (printable) try { JSON.parse(text); json = true; } catch (_) { }
        const hex = [...bytes.slice(0, 32)].map(b => b.toString(16).padStart(2, "0")).join(" ");
        set("base64Result", verdict("🔓", "Decoded", "success", `${bytes.length} bytes${clean.includes("-") || clean.includes("_") ? " • URL-safe alphabet" : ""}`) +
            (printable ? `<code>${esc(text)}</code>` : kv([["Binary data", badge("not text", "warn")], ["Hex (first 32 bytes)", code(hex)]])) +
            `<div class="tp-chips">${json ? badge("Valid JSON", "ok") : ""}${/^(MZ|PK|%PDF|\x7fELF)/.test(text || "") ? badge("Looks like a file header", "warn") : ""}${/https?:\/\//i.test(text || "") ? badge("Contains a URL - inspect before opening", "warn") : ""}</div>`, "success");
    } catch (_) { fail("base64Result", "Invalid Base64 input."); }
};

/* ============================================================
   8. HASH GENERATOR (MD5 + SHA-1/256/384/512)
   ============================================================ */
function md5(bytes) {
    const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
    const len = bytes.length, total = (((len + 8) >> 6) + 1) << 6, buf = new Uint8Array(total);
    buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(total - 8, (len * 8) >>> 0, true); dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < total; o += 64) {
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = (F + A + K[i] + dv.getUint32(o + g * 4, true)) >>> 0;
            A = D; D = C; C = B; const s = S[((i >> 4) << 2) | (i & 3)];
            B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new DataView(new ArrayBuffer(16)); [a0, b0, c0, d0].forEach((v, i) => out.setUint32(i * 4, v, true));
    return [...new Uint8Array(out.buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function digestAll(bytes) {
    const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
    const r = [["MD5 ⚠ broken", bytes.length < 2e8 ? md5(bytes) : "(file too large for MD5 in browser)"]];
    for (const a of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) r.push([a + (a === "SHA-1" ? " ⚠ weak" : ""), hex(await crypto.subtle.digest(a, bytes))]);
    return r;
}
window.generateHash = async function () {
    const text = $("hashInput")?.value || "";
    if (!text) return fail("hashResult", "Enter text to hash.");
    if (!crypto?.subtle) return fail("hashResult", "Hashing needs HTTPS or localhost.", "warning");
    const bytes = new TextEncoder().encode(text);
    const rows = await digestAll(bytes);
    set("hashResult", verdict("#️⃣", "Hashes generated", "success", `${bytes.length} bytes UTF-8 • computed locally`) + kv(rows.map(([n, v]) => [n, code(v)])) + note("Use SHA-256+ for integrity. For passwords use bcrypt/argon2, never a plain hash."), "success");
};

/* ============================================================
   9. URL ENCODER / DECODER (+ parser, double-encoding)
   ============================================================ */
window.handleURLCodec = function (mode) {
    const input = $("urlCodecInput")?.value || "";
    if (!input) return fail("urlCodecResult", "Enter a URL or text first.");
    try {
        if (mode === "encode") {
            return set("urlCodecResult", verdict("🔗", "Encoded", "success") + kv([["Component (encodeURIComponent)", code(encodeURIComponent(input))], ["Full URL (encodeURI)", code(encodeURI(input))]]), "success");
        }
        let cur = input, layers = 0;
        while (layers < 5) { const n = decodeURIComponent(cur.replace(/\+/g, " ")); if (n === cur) break; cur = n; layers++; }
        const flags = [];
        if (layers > 1) flags.push(badge(`${layers}x encoded (evasion technique)`, "warn"));
        if (/<script|javascript:|onerror=|onload=/i.test(cur)) flags.push(badge("Contains script payload", "danger"));
        if (/(\.\.\/|\.\.\\|%00|\x00)/.test(cur)) flags.push(badge("Path traversal / null byte", "danger"));
        if (/('|%27)\s*(or|and)\s|union\s+select/i.test(cur)) flags.push(badge("SQLi pattern", "danger"));
        let params = "";
        try { const u = new URL(cur); const rows = [...u.searchParams.entries()].slice(0, 15).map(([k, v]) => [k, code(v)]); if (rows.length) params = `<div class="tp-sub">Query parameters</div>` + kv(rows); } catch (_) { }
        set("urlCodecResult", verdict("🔗", "Decoded", flags.some(f => f.includes("danger")) ? "danger" : "success", layers + " layer(s) removed") + `<code>${esc(cur)}</code>` + `<div class="tp-chips">${flags.join("")}</div>` + params, flags.some(f => f.includes("danger")) ? "danger" : "success");
    } catch (_) { fail("urlCodecResult", "Malformed % sequence - cannot decode."); }
};

/* ============================================================
   10. PORT / EXPOSURE SCANNER  (Shodan InternetDB - passive, REAL)
   ============================================================ */
window.scanPorts = async function () {
    const raw = val("portScanInput");
    let host;
    try { host = parseHost(raw); } catch (_) { return fail("portScanResult", "Enter a hostname or public IP."); }
    if (!isIP(host) && !isDomain(host)) return fail("portScanResult", "Invalid hostname / IP.");
    busy("portScanResult", "Resolving target & querying exposure database…");
    try {
        const ips = await resolveIPs(host);
        if (!ips.length) return fail("portScanResult", "Target does not resolve.", "warning");
        const ip = ips.find(isIPv4) || ips[0];
        const pk = privateKind(ip);
        if (pk) return set("portScanResult", verdict("🏠", "Private address", "info", esc(ip)) + note(esc(pk) + " - not reachable from the internet, so no public exposure data exists."), "info");
        const d = await internetDb(ip);
        if (d.notFound) return set("portScanResult", verdict("🔍", "No exposure data", "success", esc(ip)) + note("This IP is not in Shodan's index (no known open services). That is NOT proof that all ports are closed."), "success");
        const risky = d.ports.filter(p => RISKY_PORTS.has(p));
        const state = d.vulns.length ? "danger" : risky.length ? "warning" : "success";
        set("portScanResult",
            verdict(d.vulns.length ? "🚨" : risky.length ? "⚠️" : "🛡️", `${d.ports.length} open port${d.ports.length === 1 ? "" : "s"} indexed`, state, `${esc(host)} → ${esc(ip)}`) +
            kv([["Open ports", d.ports.length ? d.ports.map(p => badge(`${p} ${PORT_NAMES[p] || ""}`.trim(), RISKY_PORTS.has(p) ? "danger" : "info")).join("") : "none indexed"],
            risky.length ? ["Risky services", chips(risky.map(p => `${p} ${PORT_NAMES[p] || ""}`), "danger")] : null,
            d.vulns.length ? ["Known CVEs", chips(d.vulns.slice(0, 12), "danger") + (d.vulns.length > 12 ? note("+" + (d.vulns.length - 12) + " more") : "")] : null,
            d.hostnames.length ? ["Hostnames", d.hostnames.slice(0, 5).map(code).join(" ")] : null,
            d.cpes.length ? ["Software (CPE)", d.cpes.slice(0, 5).map(code).join(" ")] : null,
            d.tags.length ? ["Tags", chips(d.tags, "warn")] : null]) +
            link(`https://www.shodan.io/host/${ip}`, "Full report on Shodan") +
            note("Passive intelligence from Shodan InternetDB (not a live scan). Scan only systems you own or are authorised to test."), state);
    } catch (e) { fail("portScanResult", "Exposure database unreachable right now.", "warning"); }
};

/* ============================================================
   11. BROWSER & CLIENT ENVIRONMENT (fingerprint + WebRTC leak test)
   ============================================================ */
function parseUA(ua) {
    let b = "Unknown", v = "";
    const m = (re, n) => { const x = ua.match(re); if (x) { b = n; v = x[1]; return true; } return false; };
    m(/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge") || m(/OPR\/([\d.]+)/, "Opera") || m(/SamsungBrowser\/([\d.]+)/, "Samsung Internet") || m(/Firefox\/([\d.]+)/, "Firefox") || m(/(?:Chrome|CriOS)\/([\d.]+)/, "Chrome") || m(/Version\/([\d.]+).*Safari/, "Safari");
    let os = "Unknown";
    if (/Windows NT 10/.test(ua)) os = "Windows 10/11"; else if (/Windows NT 6\.3/.test(ua)) os = "Windows 8.1"; else if (/Windows/.test(ua)) os = "Windows";
    else if (/Android ([\d.]+)/.test(ua)) os = "Android " + ua.match(/Android ([\d.]+)/)[1];
    else if (/(iPhone|iPad).*OS ([\d_]+)/.test(ua)) os = "iOS " + ua.match(/OS ([\d_]+)/)[1].replace(/_/g, ".");
    else if (/Mac OS X/.test(ua)) os = "macOS"; else if (/CrOS/.test(ua)) os = "ChromeOS"; else if (/Linux/.test(ua)) os = "Linux";
    return { browser: b + (v ? " " + v.split(".")[0] : ""), os };
}
function webglInfo() {
    try {
        const c = document.createElement("canvas"), gl = c.getContext("webgl") || c.getContext("experimental-webgl");
        if (!gl) return "unsupported";
        const e = gl.getExtension("WEBGL_debug_renderer_info");
        return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "hidden";
    } catch (_) { return "blocked"; }
}
async function canvasFp() {
    try {
        const c = document.createElement("canvas"); c.width = 220; c.height = 40; const x = c.getContext("2d");
        x.textBaseline = "top"; x.font = "16px Arial"; x.fillStyle = "#f60"; x.fillRect(10, 5, 80, 25); x.fillStyle = "#069"; x.fillText("CyberGuard-fp ✓ 🛡", 4, 8);
        return (await sha1Hex(c.toDataURL())).slice(0, 16);
    } catch (_) { return "blocked"; }
}
function webrtcIPs() {
    return new Promise(res => {
        const found = new Set();
        if (!window.RTCPeerConnection) return res(null);
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            pc.createDataChannel("x");
            pc.onicecandidate = e => {
                if (!e.candidate) { pc.close(); return res([...found]); }
                const m = e.candidate.candidate.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{6,}|[a-f0-9-]{36}\.local)/i);
                if (m) found.add(m[1]);
            };
            pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => res(null));
            setTimeout(() => { try { pc.close(); } catch (_) { } res([...found]); }, 2500);
        } catch (_) { res(null); }
    });
}
window.analyzeUserAgent = async function () {
    busy("uaResult", "Inspecting browser, fingerprint & WebRTC…");
    const p = parseUA(navigator.userAgent), c = navigator.connection || {}, uad = navigator.userAgentData;
    const [fp, rtc] = await Promise.all([canvasFp(), webrtcIPs()]);
    const pubLeak = (rtc || []).filter(x => isIPv4(x) && !privateKind(x));
    const localIP = (rtc || []).filter(x => isIPv4(x) && privateKind(x));
    let score = 100; const flags = [];
    if (navigator.webdriver) { flags.push(badge("Automation flag (webdriver) ON", "warn")); score -= 10; }
    if (pubLeak.length) { flags.push(badge("WebRTC exposes IP", "danger")); score -= 25; }
    if (localIP.length) { flags.push(badge("Local IP visible via WebRTC", "warn")); score -= 10; }
    if (location.protocol !== "https:") { flags.push(badge("Page not on HTTPS", "warn")); score -= 10; }
    if (!navigator.cookieEnabled) flags.push(badge("Cookies disabled", "info"));
    if (navigator.doNotTrack === "1") flags.push(badge("Do-Not-Track ON", "ok")); else { score -= 5; flags.push(badge("Do-Not-Track off", "info")); }
    if (fp !== "blocked") { score -= 5; flags.push(badge("Canvas fingerprint readable", "info")); } else flags.push(badge("Canvas fingerprint blocked", "ok"));
    score = Math.max(10, score);
    const state = score >= 80 ? "success" : score >= 55 ? "warning" : "danger";
    set("uaResult",
        verdict("🖥️", `${esc(p.browser)} on ${esc(p.os)}`, state, `Privacy score ${score}/100`) + meter(score, state === "success" ? "ok" : state === "warning" ? "warn" : "bad") +
        kv([["Device", uad?.mobile ? "Mobile" : (/Mobi|Android|iPhone/.test(navigator.userAgent) ? "Mobile" : "Desktop")], ["Language / TZ", esc(navigator.language) + " • " + esc(Intl.DateTimeFormat().resolvedOptions().timeZone)],
        ["Screen", `${screen.width}×${screen.height} @${window.devicePixelRatio}x • ${screen.colorDepth}-bit`], ["CPU threads / RAM", `${navigator.hardwareConcurrency || "?"} / ${navigator.deviceMemory ? navigator.deviceMemory + " GB+" : "hidden"}`],
        ["Network", c.effectiveType ? `${c.effectiveType} • ${c.downlink || "?"} Mbps • RTT ${c.rtt || "?"}ms${c.saveData ? " • Data-saver" : ""}` : "n/a"], ["Touch points", String(navigator.maxTouchPoints || 0)],
        ["GPU (WebGL)", esc(webglInfo())], ["Canvas fingerprint", code(fp)], ["WebRTC IPs", rtc === null ? "unsupported" : (rtc.length ? rtc.map(code).join(" ") : "none exposed")], ["Online", navigator.onLine ? "YES" : "NO"]]) +
        `<div class="tp-chips">${flags.join("")}</div><details class="tp-det"><summary>Raw User-Agent</summary><code>${esc(navigator.userAgent)}</code></details>`, state);
};

/* ============================================================
   12. DNS RECORD LOOKUP (8 record types + DNSSEC + SPF/DMARC)
   ============================================================ */
const DNS_TYPES = { 1: "A", 28: "AAAA", 15: "MX", 2: "NS", 16: "TXT", 5: "CNAME", 6: "SOA", 257: "CAA" };
window.lookupDNS = async function () {
    let domain;
    try { domain = parseHost(val("dnsInput")); } catch (_) { return fail("dnsResult", "Enter a domain."); }
    if (!isDomain(domain)) return fail("dnsResult", "Enter a valid domain, e.g. google.com");
    busy("dnsResult", "Querying 8 record types via DNS-over-HTTPS…");
    try {
        const types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA", "CAA"];
        const res = await Promise.allSettled([...types.map(t => dnsQuery(domain, t)), dnsQuery("_dmarc." + domain, "TXT")]);
        const ok = res.filter(r => r.status === "fulfilled").map(r => r.value);
        if (!ok.length) throw new Error();
        if (ok[0].Status === 3) return set("dnsResult", verdict("❓", "Domain does not exist (NXDOMAIN)", "warning", esc(domain)), "warning");
        const rows = [];
        types.forEach((t, i) => {
            const r = res[i]; if (r.status !== "fulfilled") return;
            const ans = (r.value.Answer || []).filter(a => DNS_TYPES[a.type] === t);
            if (ans.length) rows.push([t + (ans[0].TTL ? ` · TTL ${ans[0].TTL}s` : ""), ans.slice(0, 8).map(a => code(String(a.data).replace(/^"|"$/g, "").slice(0, 220))).join("<br>")]);
        });
        const txt = res[4].status === "fulfilled" ? (res[4].value.Answer || []).map(a => String(a.data)) : [];
        const spf = txt.find(t => /v=spf1/i.test(t));
        const dm = res[8].status === "fulfilled" ? (res[8].value.Answer || []).map(a => String(a.data)).find(t => /v=DMARC1/i.test(t)) : null;
        const hasMx = (res[2].status === "fulfilled" && (res[2].value.Answer || []).some(a => a.type === 15));
        const dnssec = ok[0].AD === true;
        const sec = [];
        sec.push(badge(dnssec ? "DNSSEC validated" : "DNSSEC not validated", dnssec ? "ok" : "warn"));
        if (hasMx) { sec.push(badge(spf ? "SPF present" : "SPF missing", spf ? "ok" : "danger")); const pol = dm?.match(/p=(\w+)/i)?.[1]; sec.push(badge(dm ? `DMARC p=${pol}` : "DMARC missing", dm ? (pol === "none" ? "warn" : "ok") : "danger")); }
        const bad = hasMx && (!spf || !dm);
        set("dnsResult", verdict("🌐", esc(domain), bad ? "warning" : "success", `${rows.length} record type(s) found`) + `<div class="tp-chips">${sec.join("")}</div>` + kv(rows) +
            (hasMx && (!spf || !dm) ? note("Missing SPF/DMARC lets attackers spoof email from this domain.") : ""), bad ? "warning" : "success");
    } catch (_) { fail("dnsResult", "DNS-over-HTTPS provider unavailable.", "warning"); }
};

/* ============================================================
   13. SECURITY HEADERS AUDIT (Mozilla Observatory + HackerTarget)
   ============================================================ */
const HDR_CHECKS = [["strict-transport-security", "HSTS"], ["content-security-policy", "CSP"], ["x-frame-options", "X-Frame-Options"], ["x-content-type-options", "X-Content-Type-Options"], ["referrer-policy", "Referrer-Policy"], ["permissions-policy", "Permissions-Policy"], ["cross-origin-opener-policy", "COOP"], ["cross-origin-resource-policy", "CORP"]];
window.auditSecurityHeaders = async function () {
    let host;
    try { host = parseHost(val("headerInput")); } catch (_) { return fail("headerResult", "Enter a website, e.g. https://example.com"); }
    if (!isDomain(host)) return fail("headerResult", "Enter a valid public domain.");
    busy("headerResult", "Scanning with Mozilla Observatory + live header fetch…");
    const [obs, ht] = await Promise.allSettled([
        getJson(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`, { method: "POST", timeout: 25000 }),
        getText(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent("https://" + host)}`, { timeout: 15000 })
    ]);
    let html = "", state = "info", have = false;
    const headers = {};
    if (ht.status === "fulfilled" && !/^error|API count exceeded|invalid/i.test(ht.value.trim())) {
        ht.value.split(/\r?\n/).forEach(l => { const i = l.indexOf(":"); if (i > 0) headers[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
    }
    if (Object.keys(headers).length) {
        have = true;
        const rows = HDR_CHECKS.map(([k, n]) => [n, headers[k] ? badge("✔ present", "ok") + (headers[k].length < 90 ? " " + code(headers[k]) : "") : badge("✘ missing", "danger")]);
        const passed = HDR_CHECKS.filter(([k]) => headers[k]).length;
        const leaks = ["server", "x-powered-by", "x-aspnet-version", "x-generator"].filter(k => headers[k]).map(k => `${k}: ${headers[k]}`);
        const pct = Math.round(passed / HDR_CHECKS.length * 100);
        state = pct >= 75 ? "success" : pct >= 40 ? "warning" : "danger";
        html += verdict(pct >= 75 ? "🛡️" : pct >= 40 ? "⚠️" : "🚨", `${passed}/${HDR_CHECKS.length} security headers`, state, esc(host)) + meter(pct, state === "success" ? "ok" : state === "warning" ? "warn" : "bad") + kv(rows) + (leaks.length ? `<div class="tp-sub">Information leakage</div>${chips(leaks, "warn")}` : "");
    }
    if (obs.status === "fulfilled" && obs.value && obs.value.grade) {
        const o = obs.value, g = String(o.grade), gk = /^A/.test(g) ? "ok" : /^[BC]/.test(g) ? "warn" : "danger";
        if (!have) state = gk === "ok" ? "success" : gk === "warn" ? "warning" : "danger";
        html += `<div class="tp-sub">Mozilla HTTP Observatory</div>` + kv([["Grade", badge(g, gk)], ["Score", `${o.score}/100`], ["Tests passed", `${o.tests_passed}/${o.tests_quantity}`]]) + (o.details_url ? link(o.details_url, "Full Observatory report") : "");
        have = true;
    }
    if (!have) return fail("headerResult", "Could not fetch headers (site unreachable, blocked, or free quota used). Try again later.", "warning");
    set("headerResult", html + note("Missing headers are the most common cause of clickjacking, XSS and downgrade attacks."), state);
};

/* ============================================================
   14. CARD BIN INSPECTOR (binlist.net + local network detection)
   ============================================================ */
function binNetwork(b) {
    const n = +b.slice(0, 6), s2 = +b.slice(0, 2), s4 = +b.slice(0, 4);
    if (b[0] === "4") return "VISA";
    if ((s2 >= 51 && s2 <= 55) || (s4 >= 2221 && s4 <= 2720)) return "Mastercard";
    if (s2 === 34 || s2 === 37) return "American Express";
    if (s4 === 6011 || s2 === 65 || (n >= 644000 && n <= 649999)) return "Discover";
    if (s2 === 62) return "UnionPay";
    if (s4 >= 3528 && s4 <= 3589) return "JCB";
    if ((s4 >= 3000 && s4 <= 3059) || s2 === 36 || s2 === 38) return "Diners Club";
    if (s2 === 60 || s2 === 81 || s2 === 82) return "RuPay";
    return "Unknown";
}
const luhn = s => { let t = 0, d = false; for (let i = s.length - 1; i >= 0; i--) { let n = +s[i]; if (d) { n *= 2; if (n > 9) n -= 9; } t += n; d = !d; } return t % 10 === 0; };
window.checkBIN = async function () {
    const raw = ($("binInput")?.value || "").replace(/\D/g, "");
    if (raw.length > 8) {
        return set("binResult", verdict("⚠️", "Never enter a full card number", "danger", "Only the first 6 digits are needed") + note(`Luhn check (local only): ${luhn(raw) ? "passes" : "fails"}. Delete the number from the box now.`), "danger");
    }
    if (raw.length < 6) return fail("binResult", "Enter the first 6 digits of a card.");
    busy("binResult", "Looking up issuer…");
    const bin = raw.slice(0, 8), net = binNetwork(raw);
    try {
        const d = await getJson(`https://lookup.binlist.net/${bin}`, { timeout: 9000 });
        set("binResult", verdict("💳", `${esc(d.scheme ? d.scheme.toUpperCase() : net)} ${esc(d.type || "")}`, d.prepaid ? "warning" : "success", `BIN ${raw.slice(0, 6)}`) +
            kv([["Brand", esc(d.brand || "—")], ["Type", esc(d.type || "—")], ["Prepaid", d.prepaid == null ? "—" : d.prepaid ? badge("Yes", "warn") : badge("No", "ok")], ["Issuer bank", esc(d.bank?.name || "—")], ["Country", esc(`${d.country?.emoji || ""} ${d.country?.name || "—"}`)], d.bank?.url ? ["Bank site", esc(d.bank.url)] : null, d.bank?.phone ? ["Bank phone", esc(d.bank.phone)] : null]) +
            note("Fraud tip: if the card country differs from the merchant/claimed bank, treat the request as suspicious."), d.prepaid ? "warning" : "success");
    } catch (e) {
        set("binResult", verdict("💳", esc(net), "info", `BIN ${raw.slice(0, 6)} (offline detection)`) + kv([["Network", esc(net)], ["Length rule", net === "American Express" ? "15 digits" : "16 digits (typical)"]]) + note(e.status === 429 ? "Issuer API rate limit reached (free tier). Try again in an hour." : "Issuer database unreachable. Showing network detected from the prefix only."), "warning");
    }
};

/* ============================================================
   15. QR CODE DATA SAFETY (decode image + EMV/Raast parse + URL check)
   ============================================================ */
function crc16(str) { let c = 0xFFFF; for (let i = 0; i < str.length; i++) { c ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, "0"); }
function tlv(s) { const o = {}; let i = 0; while (i + 4 <= s.length) { const t = s.slice(i, i + 2), l = parseInt(s.slice(i + 2, i + 4), 10); if (isNaN(l) || i + 4 + l > s.length) return null; o[t] = s.slice(i + 4, i + 4 + l); i += 4 + l; } return o; }
function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement("script"); const t = setTimeout(() => rej(new Error("timeout")), 8000); s.src = src; s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); rej(new Error("load")); }; document.head.appendChild(s); }); }
async function decodeQrImage(file) {
    const bmp = await createImageBitmap(file);
    if (window.BarcodeDetector) { try { const r = await new BarcodeDetector({ formats: ["qr_code"] }).detect(bmp); if (r.length) return r[0].rawValue; } catch (_) { } }
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js");
    const c = document.createElement("canvas"); const sc = Math.min(1, 1200 / Math.max(bmp.width, bmp.height)); c.width = bmp.width * sc; c.height = bmp.height * sc;
    const x = c.getContext("2d"); x.drawImage(bmp, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height); const r = window.jsQR(d.data, d.width, d.height);
    return r ? r.data : null;
}
function ensureQrUI() {
    const i = $("qrInput"); if (!i || $("qrFile")) return;
    i.closest(".input-group").insertAdjacentHTML("beforeend", `<label class="tp-file-btn">📷 Scan QR from image<input type="file" id="qrFile" accept="image/*" hidden></label>`);
    $("qrFile").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        busy("qrResult", "Decoding QR image…");
        try { const t = await decodeQrImage(f); if (!t) return fail("qrResult", "No QR code found in that image.", "warning"); $("qrInput").value = t; window.checkQRData(); }
        catch (_) { fail("qrResult", "Could not decode this image (camera blur or unsupported file).", "warning"); }
        e.target.value = "";
    });
}
window.checkQRData = async function () {
    ensureQrUI();
    const t = val("qrInput");
    if (!t) return fail("qrResult", "Paste QR content or scan an image.");
    const flags = [];
    if (/^000201/.test(t)) {
        const m = tlv(t.slice(0, -4)) || {}; const crcOk = crc16(t.slice(0, -4)) === t.slice(-4).toUpperCase(); const top = tlv(t) || {};
        const acc = Object.keys(top).filter(k => +k >= 26 && +k <= 51).map(k => { const sub = tlv(top[k]) || {}; return sub["00"] || top[k].slice(0, 30); });
        const dynamic = top["01"] === "12", cur = top["53"] === "586" ? "PKR" : (top["53"] || "?");
        if (!crcOk) flags.push(badge("CRC INVALID - tampered/fake QR", "danger"));
        if (top["58"] && top["58"] !== "PK") flags.push(badge("Country is not Pakistan", "warn"));
        return set("qrResult", verdict("💸", "Payment QR (EMVCo / Raast style)", crcOk ? "warning" : "danger", crcOk ? "Checksum valid" : "Checksum failed") + kv([["Merchant", esc(top["59"] || "—")], ["City / Country", esc((top["60"] || "—") + " / " + (top["58"] || "—"))], ["Amount", top["54"] ? esc(cur + " " + top["54"]) : "Not fixed (you type amount)"], ["Type", dynamic ? "Dynamic (one-time)" : "Static (reusable)"], acc.length ? ["Scheme / ID", acc.map(code).join(" ")] : null]) + `<div class="tp-chips">${flags.join("")}</div>` + note("Scammers paste their own QR over a shop's. Confirm the merchant name on your banking app BEFORE you pay. Scanning to RECEIVE money never needs a PIN."), crcOk ? "warning" : "danger");
    }
    if (/^WIFI:/i.test(t)) {
        const g = k => (t.match(new RegExp(k + ":([^;]*)", "i")) || [])[1] || "";
        const ty = g("T") || "nopass"; const bad = /^(nopass|WEP)$/i.test(ty);
        return set("qrResult", verdict("📶", "Wi-Fi network QR", bad ? "warning" : "success") + kv([["SSID", esc(g("S"))], ["Security", badge(ty || "open", bad ? "danger" : "ok")], ["Password", g("P") ? "••••••• (hidden)" : "none"]]) + note("Joining unknown Wi-Fi from a QR can expose traffic. Prefer trusted networks."), bad ? "warning" : "success");
    }
    if (/^(https?:\/\/|www\.)/i.test(t) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t)) {
        try {
            const a = await analyzeUrl(t); const k = stateOf(a.risk);
            return set("qrResult", verdict(a.risk >= 60 ? "🚨" : a.risk >= 25 ? "⚠️" : "🔗", "QR contains a link", k, `Quick risk ${Math.min(100, a.risk)}/100`) + kv([["Host", code(a.host)]]) + (a.reasons.length ? chips(a.reasons, k === "danger" ? "danger" : "warn") : note("No obvious red flags.")) + `<button type="button" class="btn-primary-small" onclick="document.getElementById('urlInput').value=document.getElementById('qrInput').value;inspectURL();document.getElementById('urlInput').scrollIntoView({block:'center',behavior:'smooth'})">Run deep scan (age, DNS, Safe Browsing)</button>`, k);
        } catch (_) { }
    }
    const kinds = [[/^tel:/i, "Phone call link", "info"], [/^(sms|smsto|mms):/i, "SMS link", "warning"], [/^mailto:/i, "Email link", "info"], [/^geo:/i, "Map location", "info"], [/^BEGIN:VCARD/i, "Contact card (vCard)", "info"], [/^(bitcoin|ethereum|litecoin|monero):/i, "Crypto payment request", "warning"], [/^upi:\/\//i, "UPI payment request", "warning"], [/^market:\/\/|\.apk(\?|$)/i, "App/APK install link", "danger"], [/^intent:/i, "Android intent link", "danger"], [/^(javascript|data|file):/i, "Executable URI scheme", "danger"]];
    const k = kinds.find(([re]) => re.test(t));
    set("qrResult", verdict(k ? (k[2] === "danger" ? "🚨" : "ℹ️") : "📄", k ? k[1] : "Plain text QR", k ? k[2] : "info") + `<code>${esc(t.slice(0, 300))}</code>` + note("QR codes can hide any link or payment request. Treat scanned QR content like an unknown link."), k ? k[2] : "info");
};

/* ============================================================
   16. SSL CERTIFICATE INSPECTOR (TLS handshake test + CT logs)
   ============================================================ */
async function ctCerts(host) {
    try {
        const d = await getJson(`https://crt.sh/?q=${encodeURIComponent(host)}&output=json`, { timeout: 18000 });
        return d.map(c => ({ issuer: (c.issuer_name || "").replace(/^.*CN=/, "").replace(/,.*$/, ""), from: new Date(c.not_before), to: new Date(c.not_after), names: (c.name_value || "").split("\n") }));
    } catch (_) {
        const d = await getJson(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(host)}&expand=dns_names&expand=issuer`, { timeout: 15000 });
        return d.map(c => ({ issuer: c.issuer?.name?.replace(/^.*CN=/, "").replace(/,.*$/, "") || "?", from: new Date(c.not_before), to: new Date(c.not_after), names: c.dns_names || [] }));
    }
}
window.checkSSL = async function () {
    let host;
    try { host = parseHost(val("sslInput")); } catch (_) { return fail("sslResult", "Enter a domain, e.g. https://bank.com"); }
    if (!isDomain(host)) return fail("sslResult", "Enter a valid public domain.");
    busy("sslResult", "Testing TLS handshake & reading certificate transparency logs…");
    const t0 = performance.now();
    const hs = fetch(`https://${host}/`, { mode: "no-cors", cache: "no-store" }).then(() => ({ ok: true, ms: Math.round(performance.now() - t0) })).catch(() => ({ ok: false }));
    const [h, ct] = await Promise.all([Promise.race([hs, sleep(9000).then(() => ({ ok: false, timeout: true }))]), ctCerts(host).catch(() => null)]);
    const now = Date.now(); let latest = null;
    if (ct && ct.length) latest = ct.filter(c => c.names.some(n => n === host || n === "*." + host.split(".").slice(1).join("."))).sort((a, b) => b.to - a.to)[0] || ct.sort((a, b) => b.to - a.to)[0];
    const rows = [["TLS handshake", h.ok ? badge(`✔ Trusted by your browser (${h.ms} ms)`, "ok") : badge(h.timeout ? "Timed out" : "✘ FAILED - invalid/expired cert, no HTTPS, or blocked", "danger")]];
    let state = h.ok ? "success" : "danger"; const flags = [];
    if (latest) {
        const days = Math.floor((latest.to - now) / 864e5), life = Math.round((latest.to - latest.from) / 864e5);
        rows.push(["Issuer", esc(latest.issuer)], ["Valid from", latest.from.toISOString().slice(0, 10)], ["Expires", `${latest.to.toISOString().slice(0, 10)} ` + badge(days < 0 ? `EXPIRED ${-days}d ago` : `${days} days left`, days < 0 ? "danger" : days < 14 ? "danger" : days < 30 ? "warn" : "ok")], ["Lifetime", `${life} days`], ["Names covered", String(latest.names.length)]);
        if (days < 0) { state = "danger"; flags.push("Latest logged certificate is expired"); } else if (days < 30 && state === "success") { state = "warning"; flags.push("Expires within 30 days"); }
        if (/let'?s encrypt|r3|e1|zerossl/i.test(latest.issuer)) flags.push("Free DV certificate (does not prove business identity)");
        if (latest.names.some(n => n.startsWith("*."))) flags.push("Wildcard certificate");
    } else rows.push(["CT logs", badge("No certificate data returned", "info")]);
    set("sslResult", verdict(state === "success" ? "🔒" : state === "warning" ? "⏳" : "🔓", state === "success" ? "HTTPS looks healthy" : state === "warning" ? "Certificate needs attention" : "TLS problem detected", state, esc(host)) + kv(rows) + (flags.length ? chips(flags, "warn") : "") + link(`https://www.ssllabs.com/ssltest/analyze.html?d=${host}`, "Deep protocol test on SSL Labs") + note("Handshake result comes from your own browser; certificate details from public Certificate Transparency logs."), state);
};

/* ============================================================
   17. SUBDOMAIN FINDER (crt.sh → CertSpotter → HackerTarget)
   ============================================================ */
window.findSubdomains = async function () {
    let domain;
    try { domain = parseHost(val("subdomainInput")); } catch (_) { return fail("subdomainResult", "Enter a domain, e.g. target.com"); }
    if (!isDomain(domain)) return fail("subdomainResult", "Enter a valid domain.");
    busy("subdomainResult", "Searching certificate transparency logs (can take ~10s)…");
    let names = new Set(), src = "";
    const clean = n => { n = n.toLowerCase().replace(/^\*\./, ""); if (n.endsWith("." + domain) || n === domain) names.add(n); };
    try { (await getJson(`https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`, { timeout: 22000 })).forEach(c => (c.name_value || "").split("\n").forEach(clean)); src = "crt.sh"; } catch (_) { }
    if (names.size < 2) try { (await getJson(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`, { timeout: 15000 })).forEach(c => (c.dns_names || []).forEach(clean)); src = src || "CertSpotter"; } catch (_) { }
    if (names.size < 2) try { (await getText(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`, { timeout: 12000 })).split("\n").forEach(l => clean(l.split(",")[0] || "")); src = src || "HackerTarget"; } catch (_) { }
    if (!names.size) return fail("subdomainResult", "No subdomains found or sources are unavailable/rate-limited.", "warning");
    const list = [...names].sort(), total = list.length, probe = list.slice(0, 24), live = [];
    busy("subdomainResult", `Found ${total} names. Checking which are live…`);
    let idx = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (idx < probe.length) { const n = probe[idx++]; try { const ips = await resolveIPs(n); if (ips.length) live.push([n, ips[0]]); } catch (_) { } } }));
    const liveSet = new Set(live.map(x => x[0]));
    const juicy = list.filter(n => /(^|[.-])(admin|dev|test|staging|stage|vpn|beta|internal|git|jenkins|backup|old|db|sql|portal|dashboard|ftp|api)([.-]|\d|$)/.test(n.replace("." + domain, "")));
    set("subdomainResult", verdict("🧭", `${total} subdomain${total > 1 ? "s" : ""} discovered`, juicy.length ? "warning" : "success", `${esc(domain)} • source: ${src}`) +
        kv([["Live (first " + probe.length + " checked)", `${live.length}`], juicy.length ? ["Sensitive-looking", chips(juicy.slice(0, 12), "warn")] : null]) +
        `<div class="tp-list">${list.slice(0, 60).map(n => `<div class="tp-li">${liveSet.has(n) ? '<i class="tp-dot tp-on"></i>' : '<i class="tp-dot"></i>'}${esc(n)}${liveSet.has(n) ? ` <small>${esc(live.find(x => x[0] === n)[1])}</small>` : ""}</div>`).join("")}</div>` + (total > 60 ? note(`+${total - 60} more not shown`) : "") +
        note("Passive discovery from public certificates. Every name found is also visible to attackers - remove unused ones."), juicy.length ? "warning" : "success");
};

/* ============================================================
   18. MAC VENDOR IDENTIFIER (bit analysis + API + local OUI)
   ============================================================ */
const LOCAL_OUI = { "000C29": "VMware", "005056": "VMware", "080027": "Oracle VirtualBox", "00155D": "Microsoft Hyper-V", "525400": "QEMU/KVM", "B827EB": "Raspberry Pi Foundation", "DCA632": "Raspberry Pi Trading", "E45F01": "Raspberry Pi Trading", "00163E": "Xen", "001C42": "Parallels", "0050C2": "IEEE Registration Authority", "FFFFFF": "Broadcast address" };
window.checkMAC = async function () {
    const raw = val("macInput").replace(/[^0-9a-f]/gi, "").toUpperCase();
    if (raw.length < 6) return fail("macResult", "Enter a MAC address, e.g. 00:1A:2B:3C:4D:5E");
    if (raw.length !== 12 && raw.length !== 6) return fail("macResult", "A MAC address has 12 hex digits (or send the first 6 for the vendor).");
    const oui = raw.slice(0, 6), first = parseInt(raw.slice(0, 2), 16);
    const multicast = !!(first & 1), local = !!(first & 2);
    busy("macResult", "Identifying vendor…");
    let vendor = null, country = "", src = "";
    try { const d = await getJson(`https://api.maclookup.app/v2/macs/${oui}`, { timeout: 8000 }); if (d.found && d.company) { vendor = d.company; country = d.country || ""; src = "maclookup.app"; } } catch (_) { }
    if (!vendor) try { const t = await getText(`https://api.macvendors.com/${oui}`, { timeout: 8000 }); if (t && !/errors/i.test(t)) { vendor = t.trim(); src = "macvendors.com"; } } catch (_) { }
    if (!vendor && LOCAL_OUI[oui]) { vendor = LOCAL_OUI[oui]; src = "built-in list"; }
    const fm = raw.length === 12 ? raw.match(/.{2}/g).join(":") : oui.match(/.{2}/g).join(":");
    const flags = [];
    if (local) flags.push(badge("Locally administered - likely a RANDOMIZED/private MAC (phones) or VM", "warn"));
    if (multicast) flags.push(badge("Multicast / group address", "warn"));
    if (/vmware|virtualbox|hyper-v|qemu|xen|parallels/i.test(vendor || "")) flags.push(badge("Virtual machine NIC", "info"));
    const state = vendor ? "success" : "warning";
    set("macResult", verdict("🔌", vendor ? esc(vendor) : "Vendor not found", state, code(fm)) + kv([["OUI", code(oui.match(/.{2}/g).join(":"))], country ? ["Country", esc(country)] : null, ["Address type", multicast ? "Multicast" : "Unicast"], ["Administration", local ? "Locally administered" : "Globally unique (burned-in)"], src ? ["Source", esc(src)] : null]) + `<div class="tp-chips">${flags.join("")}</div>` +
        (!vendor && local ? note("Modern iOS/Android/Windows randomize MACs per network - no vendor can be resolved for those.") : ""), state);
};

/* ============================================================
   19. FILE INTEGRITY HASH CHECKER (all hashes + known-file DB + magic bytes)
   ============================================================ */
const MAGIC = [[[0x4D, 0x5A], "Windows executable (EXE/DLL)", "exe"], [[0x7F, 0x45, 0x4C, 0x46], "Linux executable (ELF)", "exe"], [[0x25, 0x50, 0x44, 0x46], "PDF document", "pdf"], [[0x50, 0x4B, 0x03, 0x04], "ZIP container (ZIP/DOCX/XLSX/APK/JAR)", "zip"], [[0x52, 0x61, 0x72, 0x21], "RAR archive", "rar"], [[0x37, 0x7A, 0xBC, 0xAF], "7-Zip archive", "7z"], [[0x89, 0x50, 0x4E, 0x47], "PNG image", "png"], [[0xFF, 0xD8, 0xFF], "JPEG image", "jpg"], [[0x47, 0x49, 0x46, 0x38], "GIF image", "gif"], [[0x1F, 0x8B], "GZIP archive", "gz"], [[0xD0, 0xCF, 0x11, 0xE0], "Legacy Office (OLE2) - macros possible", "doc"], [[0x23, 0x21], "Script (shebang)", "sh"], [[0xCA, 0xFE, 0xBA, 0xBE], "Java class / Mach-O", "class"], [[0x64, 0x65, 0x78, 0x0A], "Android DEX bytecode", "dex"], [[0x49, 0x44, 0x33], "MP3 audio", "mp3"], [[0x4C, 0x00, 0x00, 0x00], "Windows shortcut (.lnk)", "lnk"]];
function sniff(u8) {
    for (const [sig, name, ext] of MAGIC) if (sig.every((b, i) => u8[i] === b)) return { name, ext };
    if (u8.length > 11 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return { name: "MP4/MOV video", ext: "mp4" };
    const head = new TextDecoder().decode(u8.slice(0, 200)).toLowerCase();
    if (/^\s*<(!doctype html|html|script)/.test(head)) return { name: "HTML / script text", ext: "html" };
    return null;
}
window.TP_sniff = sniff;
function ensureFileUI() {
    const f = $("fileHashInput"); if (!f || $("fileExpected")) return;
    f.closest(".input-group").insertAdjacentHTML("beforeend", `<input type="text" id="fileExpected" placeholder="(optional) expected hash to compare" autocomplete="off">`);
}
window.calculateFileHash = async function () {
    ensureFileUI();
    const file = $("fileHashInput")?.files?.[0];
    if (!file) return fail("fileHashResult", "Choose a file first.");
    if (!crypto?.subtle) return fail("fileHashResult", "Hashing needs HTTPS or localhost.", "warning");
    if (file.size > 300 * 1024 * 1024) return fail("fileHashResult", "File too large for in-browser hashing (limit 300 MB).", "warning");
    busy("fileHashResult", `Hashing ${(file.size / 1048576).toFixed(1)} MB locally (file never leaves your device)…`);
    try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const rows = await digestAll(buf);
        const sha256 = rows.find(r => r[0].startsWith("SHA-256"))[1];
        const exp = val("fileExpected").toLowerCase().replace(/\s/g, "");
        let cmp = "";
        let state = "success";
        if (exp) { const m = rows.find(r => r[1].toLowerCase() === exp); cmp = m ? badge("✔ MATCH with " + m[0].split(" ")[0], "ok") : badge("✘ NO MATCH - file differs/corrupted/tampered", "danger"); if (!m) state = "danger"; }
        const type = sniff(buf), ext = (file.name.split(".").pop() || "").toLowerCase();
        const flags = [];
        if (type && type.ext === "exe" && !/^(exe|dll|sys|scr|so|bin|elf|)$/.test(ext)) { flags.push(badge("Executable disguised as ." + ext + "!", "danger")); state = "danger"; }
        if (type && type.ext === "zip" && /^(apk)$/.test(ext)) flags.push(badge("Android package - install only from trusted stores", "warn"));
        let known = "";
        try { const k = await getJson(`https://hashlookup.circl.lu/lookup/sha256/${sha256}`, { timeout: 8000 }); known = badge("Known file in CIRCL hashlookup (" + esc(k.FileName || k["source"] || "NSRL") + ")", "ok"); }
        catch (e) { known = e.status === 404 ? badge("Not in CIRCL known-file database", "info") : ""; }
        set("fileHashResult", verdict("🧾", esc(file.name), state, `${num(file.size)} bytes • ${esc(file.type || "unknown MIME")}`) + (cmp ? `<div class="tp-chips">${cmp}</div>` : "") + kv([["Detected type", type ? esc(type.name) : "Unknown / plain data"], ...rows.map(([n, v]) => [n, code(v)])]) + `<div class="tp-chips">${flags.join("")}${known}</div>` + link(`https://www.virustotal.com/gui/file/${sha256}`, "Look up this hash on VirusTotal") + note("Matching the publisher's hash proves the file wasn't altered in transit."), state);
    } catch (_) { fail("fileHashResult", "Could not read this file."); }
};

/* ============================================================
   20. AES TEXT CIPHER VAULT  (original engine kept, UI upgraded)
   ============================================================ */
(function wrapAES() {
    const orig = window.handleAES;
    if (typeof orig !== "function") return;
    window.handleAES = async function (mode) {
        const key = val("aesKeyInput");
        const r = await orig.apply(this, arguments);
        const el = $("aesResult");
        if (el && !el.querySelector(".tp-actions")) {
            const weak = key && analyzePassword(key).score < 45;
            el.insertAdjacentHTML("beforeend", (weak ? `<div class="tp-chips">${badge("⚠ Weak secret key - cipher is only as strong as this passphrase", "warn")}</div>` : "") + `<div class="tp-note">AES-256-GCM • PBKDF2 key derivation • runs 100% in your browser</div><div class="tp-actions"><button type="button" class="tp-copy" data-target="aesResult">⧉ Copy result</button></div>`);
        }
        return r;
    };
})();

/* ============================================================
   21. CIDR SUBNET CALCULATOR (IPv4 + IPv6, BigInt precise)
   ============================================================ */
const ip4n = s => s.split(".").reduce((a, b) => (a << 8n) + BigInt(b), 0n);
const n4ip = n => [24n, 16n, 8n, 0n].map(s => Number((n >> s) & 255n)).join(".");
function ip6n(s) {
    s = s.toLowerCase();
    if (s.includes(".")) { const i = s.lastIndexOf(":"), v4 = ip4n(s.slice(i + 1)); s = s.slice(0, i + 1) + ((v4 >> 16n).toString(16)) + ":" + ((v4 & 0xffffn).toString(16)); }
    const [h, t] = s.split("::"); const hp = h ? h.split(":") : [], tp = t !== undefined && t ? t.split(":") : [];
    const miss = 8 - hp.length - tp.length; if (miss < 0 || (t === undefined && hp.length !== 8)) throw new Error();
    return [...hp, ...Array(t === undefined ? 0 : miss).fill("0"), ...tp].reduce((a, x) => { if (!/^[0-9a-f]{1,4}$/.test(x)) throw new Error(); return (a << 16n) + BigInt("0x" + x); }, 0n);
}
function n6ip(n) {
    const g = Array.from({ length: 8 }, (_, i) => Number((n >> BigInt((7 - i) * 16)) & 0xffffn).toString(16));
    let best = -1, bl = 0, cur = -1, cl = 0;
    g.forEach((x, i) => { if (x === "0") { if (cur < 0) { cur = i; cl = 0; } cl++; if (cl > bl) { bl = cl; best = cur; } } else cur = -1; });
    if (bl < 2) return g.join(":");
    return (g.slice(0, best).join(":") || "") + "::" + (g.slice(best + bl).join(":") || "");
}
const bigFmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
window.calculateCIDR = function () {
    const raw = val("cidrInput").replace(/\s+/g, " ");
    if (!raw) return fail("cidrResult", "Enter a CIDR, e.g. 192.168.1.0/24");
    try {
        let ipS, pre;
        const mm = raw.match(/^(\S+) (\d+\.\d+\.\d+\.\d+)$/);
        if (mm) { ipS = mm[1]; const m = ip4n(mm[2]).toString(2).padStart(32, "0"); if (!/^1*0*$/.test(m)) throw new Error("Invalid netmask"); pre = m.indexOf("0") === -1 ? 32 : m.indexOf("0"); }
        else if (raw.includes("/")) { [ipS, pre] = raw.split("/"); pre = parseInt(pre, 10); }
        else { ipS = raw; pre = isIPv4(raw) ? 32 : 128; }
        if (isIPv4(ipS)) {
            if (!(pre >= 0 && pre <= 32)) throw new Error("Prefix must be 0-32");
            const bits = 32n, host = BigInt(32 - pre), mask = ((1n << bits) - 1n) ^ ((1n << host) - 1n), ip = ip4n(ipS), net = ip & mask, bc = net | ((1n << host) - 1n), total = 1n << host;
            const usable = pre >= 31 ? total : total - 2n, first = pre >= 31 ? net : net + 1n, last = pre >= 31 ? bc : bc - 1n, a = Number(net >> 24n);
            const cls = a < 128 ? "A" : a < 192 ? "B" : a < 224 ? "C" : a < 240 ? "D (multicast)" : "E (reserved)";
            const scope = privateKind(n4ip(net)) || "Public / routable";
            const split = pre < 30 ? `/${pre + 1} → 2 subnets of ${bigFmt(total / 2n)} addresses` : "";
            set("cidrResult", verdict("🧮", `${n4ip(net)}/${pre}`, "success", `${bigFmt(usable)} usable host${usable === 1n ? "" : "s"}`) + kv([["Network", code(n4ip(net))], ["Broadcast", code(n4ip(bc))], ["Host range", code(n4ip(first) + " – " + n4ip(last))], ["Netmask", code(n4ip(mask))], ["Wildcard", code(n4ip(~mask & 0xffffffffn))], ["Total addresses", bigFmt(total)], ["Class / Scope", esc(cls + " • " + scope)], ["Mask (binary)", code(mask.toString(2).padStart(32, "0").match(/.{8}/g).join("."))], split ? ["Split", esc(split)] : null, ip !== net ? ["Input host", code(ipS) + " (inside this network)"] : null]), "success");
        } else if (isIPv6(ipS)) {
            if (!(pre >= 0 && pre <= 128)) throw new Error("Prefix must be 0-128");
            const host = BigInt(128 - pre), mask = ((1n << 128n) - 1n) ^ ((1n << host) - 1n), ip = ip6n(ipS), net = ip & mask, last = net | ((1n << host) - 1n);
            const kind = /^fe[89ab]/i.test(n6ip(net)) ? "Link-local" : /^f[cd]/i.test(n6ip(net)) ? "Unique local (private)" : /^ff/i.test(n6ip(net)) ? "Multicast" : /^2001:db8/i.test(n6ip(net)) ? "Documentation" : "Global unicast";
            set("cidrResult", verdict("🧮", `${n6ip(net)}/${pre}`, "success", `${bigFmt(1n << host)} addresses`) + kv([["Network", code(n6ip(net))], ["First", code(n6ip(net))], ["Last", code(n6ip(last))], ["Total addresses", bigFmt(1n << host)], ["/64 subnets inside", pre <= 64 ? bigFmt(1n << BigInt(64 - pre)) : "—"], ["Scope", esc(kind)]]), "success");
        } else throw new Error("Not a valid IPv4/IPv6 address");
    } catch (e) { fail("cidrResult", e.message && e.message.length < 60 ? e.message : "Invalid CIDR notation."); }
};

/* ============================================================
   22. NETWORK PING & LATENCY TESTER (real HTTP round-trip stats)
   ============================================================ */
window.simulatePing = async function () {
    let host;
    try { host = parseHost(val("pingInput")); } catch (_) { return fail("pingResult", "Enter a hostname or IP."); }
    if (!isIP(host) && !isDomain(host)) return fail("pingResult", "Invalid hostname / IP.");
    const pk = isIP(host) && privateKind(host);
    if (pk) return fail("pingResult", "Private/local address (" + pk + ") cannot be measured from the browser sandbox.", "warning");
    busy("pingResult", "Measuring real round-trip time (8 samples)…");
    try { if (!isIP(host)) { const ips = await resolveIPs(host); if (!ips.length) return fail("pingResult", "Host does not resolve (DNS failed).", "warning"); } } catch (_) { }
    const url = isIPv6(host) ? `https://[${host}]/` : `https://${host}/`;
    const samples = []; let timeouts = 0;
    for (let i = 0; i < 8; i++) {
        const t = performance.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
        try { await fetch(`${url}?cg=${Math.random().toString(36).slice(2)}`, { mode: "no-cors", cache: "no-store", signal: ctl.signal }); samples.push(performance.now() - t); }
        catch (e) { const dt = performance.now() - t; if (dt >= 3900) timeouts++; else samples.push(dt); }
        clearTimeout(to);
        if (i < 7) await sleep(150);
    }
    if (!samples.length) return set("pingResult", verdict("📡", "No response", "danger", esc(host)) + note("Host did not answer on HTTPS (port 443) within 4 s. It may be offline, firewalled, or not a web server."), "danger");
    const body = samples.length > 2 ? samples.slice(1) : samples;
    const min = Math.min(...body), max = Math.max(...body), avg = body.reduce((a, b) => a + b, 0) / body.length, jit = Math.sqrt(body.reduce((a, b) => a + (b - avg) ** 2, 0) / body.length), loss = Math.round(timeouts / 8 * 100);
    const q = avg < 80 ? ["Excellent", "success"] : avg < 180 ? ["Good", "success"] : avg < 350 ? ["Fair", "warning"] : ["Slow", "danger"];
    set("pingResult", verdict("📡", `${q[0]} • ${avg.toFixed(0)} ms average`, q[1], esc(host)) + meter(100 - Math.min(95, avg / 5), q[1] === "success" ? "ok" : q[1] === "warning" ? "warn" : "bad") +
        kv([["Min / Avg / Max", `${min.toFixed(0)} / ${avg.toFixed(0)} / ${max.toFixed(0)} ms`], ["Jitter (σ)", jit.toFixed(1) + " ms"], ["Packet loss", badge(loss + "%", loss ? "danger" : "ok")], ["Samples", `${samples.length}/8 (first excluded: handshake)`]]) +
        `<div class="tp-spark">${samples.map(s => `<i style="height:${Math.max(8, Math.min(100, s / max * 100))}%" title="${s.toFixed(0)}ms"></i>`).join("")}</div>` +
        note("Browser cannot send ICMP, so this measures real HTTPS round-trip time (not TTL). Includes your device → server path."), q[1]);
};

/* ============================================================
   23. HONEYPOT SERVICE DETECTOR (InternetDB signals + Shodan honeyscore)
   ============================================================ */
window.detectHoneypot = async function () {
    let host;
    try { host = parseHost(val("honeypotInput")); } catch (_) { return fail("honeypotResult", "Enter a public IP or domain."); }
    if (!isIP(host) && !isDomain(host)) return fail("honeypotResult", "Invalid IP / hostname.");
    busy("honeypotResult", "Collecting service fingerprints…");
    try {
        const ips = await resolveIPs(host); if (!ips.length) return fail("honeypotResult", "Target does not resolve.", "warning");
        const ip = ips.find(isIPv4) || ips[0], pk = privateKind(ip);
        if (pk) return fail("honeypotResult", `${ip} is ${pk} - only public IPs have fingerprint data.`, "warning");
        const [db, hs] = await Promise.allSettled([internetDb(ip), KEYS.shodan ? getJson(`https://api.shodan.io/labs/honeyscore/${ip}?key=${encodeURIComponent(KEYS.shodan)}`, { timeout: 8000 }) : Promise.reject()]);
        const d = db.status === "fulfilled" ? db.value : null;
        if (!d) return fail("honeypotResult", "Fingerprint database unreachable.", "warning");
        let score = 0; const why = [];
        const P = d.ports || [];
        if (d.tags?.some(t => /honeypot/i.test(t))) { score = 100; why.push("Tagged 'honeypot' by Shodan"); }
        if (P.length >= 25) { score += 45; why.push(`${P.length} open ports (abnormally many)`); } else if (P.length >= 12) { score += 25; why.push(`${P.length} open ports`); }
        const fam = [[21], [22, 2222], [23], [3306], [3389], [5900], [445], [1433], [6379], [27017], [9200], [80, 443, 8080]].filter(g => g.some(p => P.includes(p))).length;
        if (fam >= 6) { score += 25; why.push("Many unrelated services on one host (SSH+Telnet+DB+RDP…)"); }
        if (P.some(p => [102, 502, 20000, 44818, 47808].includes(p)) && P.some(p => [80, 443, 22].includes(p))) { score += 25; why.push("ICS/SCADA ports mixed with web/SSH (typical Conpot trap)"); }
        if (P.some(p => [2222, 2223, 2323].includes(p))) { score += 10; why.push("Cowrie-style alternate SSH/Telnet ports"); }
        if ((d.vulns || []).length >= 20) { score += 20; why.push(`${d.vulns.length} CVEs advertised (decoys often fake old software)`); }
        if (hs.status === "fulfilled" && typeof hs.value === "number") { const h = Math.round(hs.value * 100); why.push(`Shodan Honeyscore ${h}%`); score = Math.max(score, h); }
        score = Math.min(100, score);
        const k = score >= 60 ? "danger" : score >= 30 ? "warning" : "success";
        set("honeypotResult", verdict(score >= 60 ? "🍯" : score >= 30 ? "🤔" : "✅", score >= 60 ? "Likely a honeypot / decoy" : score >= 30 ? "Possibly a decoy" : "No honeypot signs", k, `${esc(host)} → ${esc(ip)} • trap score ${score}/100`) + meter(score, k === "danger" ? "bad" : k === "warning" ? "warn" : "ok") +
            kv([["Open ports", P.length ? P.slice(0, 20).map(p => badge(p + (PORT_NAMES[p] ? " " + PORT_NAMES[p] : ""), "info")).join("") : "none indexed"], d.tags?.length ? ["Tags", chips(d.tags, "warn")] : null]) + (why.length ? chips(why, k === "success" ? "info" : "warn") : note("No suspicious fingerprint combinations found.")) +
            (KEYS.shodan ? "" : note("Add a free Shodan key in CG_API_KEYS to include Shodan's own honeyscore.")) + note("Heuristic detection - skilled honeypots can evade it. Authorised testing only."), k);
    } catch (_) { fail("honeypotResult", "Could not analyse this target.", "warning"); }
};

/* ============================================================
   24. FRAUD HANDLE & NUMBER OSINT  (pattern engine + PK operator + GitHub)
   ============================================================ */
const SCAM_KW = ["free", "bonus", "offer", "official", "support", "helpline", "care", "loan", "forex", "crypto", "giveaway", "lucky", "winner", "recovery", "hack", "invest", "profit", "earn", "cash", "prize", "reward", "claim", "verify", "kyc", "ehsaas", "benazir", "income", "refund", "agent", "customer"];
const PK_OPS = [[300, 309, "Jazz (Mobilink)"], [310, 319, "Zong"], [320, 329, "Jazz (ex-Warid)"], [330, 339, "Ufone"], [340, 349, "Telenor"], [355, 355, "SCOM"]];
window.searchScamHandle = async function () {
    const raw = val("handleInput");
    if (!raw) return fail("handleResult", "Enter a @handle, username or phone number.");
    const digits = raw.replace(/[\s\-()+]/g, "");
    if (/^(\+?92|0)?3\d{9}$/.test(digits)) {
        const n = "0" + digits.replace(/^(\+?92|0)/, ""), pre = +n.slice(1, 4), op = PK_OPS.find(([a, b]) => pre >= a && pre <= b);
        const intl = "92" + n.slice(1);
        return set("handleResult", verdict("📞", `Pakistani mobile ${esc(n)}`, "info", op ? "Operator series: " + op[2] : "Operator series unknown") +
            kv([["Format", code("+" + intl)], ["Operator", esc(op ? op[2] : "—") + " <small>(ported numbers may differ)</small>"]]) +
            `<div class="tp-chips">${link("https://wa.me/" + intl, "Check WhatsApp profile")}${link("https://www.google.com/search?q=%22" + encodeURIComponent(n) + "%22+scam", "Search reports")}${link("https://www.truecaller.com/search/pk/" + n.slice(1), "Truecaller")}</div>` +
            note("🚨 Report scam numbers: FIA Cyber Crime helpline <b>1991</b> • PTA complaint <b>0800-55055</b> (verify on official sites). Never share OTP/PIN with any caller."), "info");
    }
    const h = raw.replace(/^@/, "").trim();
    if (!/^[\w.\-]{2,40}$/.test(h)) return fail("handleResult", "Username may contain letters, numbers, dot, dash, underscore only.");
    busy("handleResult", "Analysing handle…");
    const low = h.toLowerCase(), why = []; let score = 0;
    const kws = SCAM_KW.filter(k => low.includes(k)); if (kws.length) { score += Math.min(40, kws.length * 14); why.push("Scam-style words: " + kws.join(", ")); }
    const brandHit = BRANDS.find(b => low.includes(b) && low !== b); if (brandHit) { score += 28; why.push(`Impersonates brand "${brandHit}"`); }
    const dr = (h.match(/\d/g) || []).length / h.length; if (dr > 0.3) { score += 12; why.push("Many digits (bulk-created account style)"); }
    if (/\d{4,}$/.test(h)) { score += 8; why.push("Long number tail"); }
    if (/[_.\-]{2,}|([_.\-].*){3,}/.test(h)) { score += 8; why.push("Excess separators"); }
    if (/(official|real|original|verified)/.test(low)) { score += 15; why.push("Claims to be 'official/real/verified'"); }
    if (h.length > 24) { score += 6; why.push("Unusually long username"); }
    if (/(0|1|3|4|5)/.test(h) && BRANDS.some(b => deLeet(h).includes(b) && !low.includes(b))) { score += 20; why.push("Leet-speak spelling of a brand"); }
    score = Math.min(100, score);
    let gh = null; try { const g = await getJson(`https://api.github.com/users/${encodeURIComponent(h)}`, { timeout: 7000 }); gh = g; } catch (_) { }
    const k = stateOf(score);
    const enc = encodeURIComponent(h);
    set("handleResult", verdict(score >= 60 ? "🚨" : score >= 25 ? "⚠️" : "🛡️", score >= 60 ? "High scam likelihood" : score >= 25 ? "Suspicious pattern" : "No scam pattern found", k, `@${esc(h)} • score ${score}/100`) + meter(score, k === "danger" ? "bad" : k === "warning" ? "warn" : "ok") +
        (why.length ? chips(why, k === "success" ? "info" : "warn") : note("Handle itself looks ordinary. That does not prove the owner is trustworthy.")) +
        (gh && gh.login ? kv([["GitHub account", `exists • created ${esc((gh.created_at || "").slice(0, 10))} • ${gh.public_repos} repos • ${gh.followers} followers`]]) : "") +
        `<div class="tp-sub">Verify the profile yourself</div><div class="tp-chips">${link("https://www.facebook.com/" + enc, "Facebook")}${link("https://www.instagram.com/" + enc, "Instagram")}${link("https://x.com/" + enc, "X")}${link("https://www.tiktok.com/@" + enc, "TikTok")}${link("https://t.me/" + enc, "Telegram")}${link("https://www.google.com/search?q=%22" + enc + "%22+scam+OR+fraud", "Google reports")}</div>` +
        note("Browsers cannot read other sites' accounts, so profile links are opened by you. Check account age, followers and whether it asks for money/OTP. Report to FIA Cyber Crime <b>1991</b>."), k);
};

/* ============================================================
   25. EXTENSION RISK INSPECTOR (+ real file-type sniffing)
   ============================================================ */
const EXT_RISK = {
    exe: [95, "Windows program"], scr: [95, "Screensaver (executable)"], com: [90, "DOS executable"], pif: [90, "Program shortcut"], msi: [85, "Installer package"], bat: [90, "Batch script"], cmd: [90, "Command script"], vbs: [92, "VBScript"], vbe: [92, "Encoded VBScript"], js: [80, "JavaScript (WSH)"], jse: [88, "Encoded JavaScript"], wsf: [90, "Windows Script File"], ps1: [90, "PowerShell script"], hta: [95, "HTML Application"], lnk: [92, "Shortcut (can run commands)"], reg: [85, "Registry edit"], jar: [80, "Java program"], apk: [88, "Android app"], dmg: [75, "macOS disk image"], iso: [70, "Disk image (bypasses Mark-of-the-Web)"], img: [70, "Disk image"], cpl: [90, "Control Panel applet"], dll: [85, "Library"], sh: [70, "Shell script"], docm: [80, "Word with macros"], xlsm: [80, "Excel with macros"], pptm: [80, "PowerPoint with macros"], dotm: [80, "Word template w/ macros"], xlam: [80, "Excel add-in"], zip: [45, "Archive (may hide malware)"], rar: [45, "Archive"], "7z": [45, "Archive"], cab: [55, "Cabinet archive"], doc: [45, "Legacy Word (macro capable)"], xls: [45, "Legacy Excel (macro capable)"], ppt: [40, "Legacy PowerPoint"], rtf: [40, "Rich text (exploit vector)"], pdf: [30, "PDF (can embed links/JS)"], html: [50, "HTML page (phishing vector)"], htm: [50, "HTML page"], svg: [45, "SVG (can contain scripts)"], docx: [12, "Word document"], xlsx: [12, "Excel workbook"], pptx: [12, "PowerPoint"], txt: [3, "Plain text"], jpg: [5, "Image"], jpeg: [5, "Image"], png: [5, "Image"], gif: [5, "Image"], mp3: [5, "Audio"], mp4: [8, "Video"], csv: [8, "Spreadsheet text"]
};
function ensureExtUI() {
    const i = $("extInput"); if (!i || $("extFile")) return;
    i.closest(".input-group").insertAdjacentHTML("beforeend", `<label class="tp-file-btn">🔬 Or pick a file to verify its REAL type<input type="file" id="extFile" hidden></label>`);
    $("extFile").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; $("extInput").value = f.name; await window.checkFileExtension(f); e.target.value = ""; });
}
window.checkFileExtension = async function (fileObj) {
    ensureExtUI();
    const name = (fileObj && fileObj.name) || $("extInput")?.value || "";
    if (!name.trim()) return fail("extResult", "Enter a file name, e.g. invoice.pdf.exe");
    const flags = []; let risk = 0;
    const bidi = /[\u202A-\u202E\u2066-\u2069\u200E\u200F]/.test(name);
    if (bidi) { risk = 100; flags.push("Hidden RTL-override character (Unicode spoofing: 'photo\\u202Egpj.exe')"); }
    const clean = name.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, "").trim();
    const parts = clean.split(".");
    const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/\s+$/, "") : "";
    const prev = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
    const info = EXT_RISK[ext];
    if (info) risk = Math.max(risk, info[0]); else if (ext) { risk = Math.max(risk, 35); flags.push("Uncommon extension"); } else { risk = Math.max(risk, 30); flags.push("No file extension"); }
    if (ext && EXT_RISK[prev] && info && info[0] >= 40 && EXT_RISK[prev][0] < info[0] - 20) { risk = Math.max(risk, 98); flags.push(`Double extension: looks like .${prev} but is really .${ext}`); }
    else if (parts.length > 1 && prev && /^[a-z0-9]{2,5}$/.test(prev) && EXT_RISK[prev]) flags.push("Multiple extensions");
    if (/\s{3,}/.test(clean) || /\.\s+\w+$/.test(clean)) { risk = Math.max(risk, 90); flags.push("Padded with spaces to hide the real extension"); }
    if (/[.\s]$/.test(name)) { risk = Math.max(risk, 70); flags.push("Trailing dot/space trick"); }
    if (clean.length > 70) flags.push("Very long file name (hides ending in file managers)");
    if (/(invoice|bill|receipt|payment|salary|cnic|nadra|bank|statement|resume|cv|offer|order|urgent|document)/i.test(clean) && risk >= 40) { risk = Math.min(100, risk + 8); flags.push("Social-engineering file name"); }
    let sniffHtml = "";
    if (fileObj) {
        const u8 = new Uint8Array(await fileObj.slice(0, 512).arrayBuffer()), t = sniff(u8);
        if (t) {
            sniffHtml = kv([["Real content type", esc(t.name)]]);
            if (t.ext === "exe" && ext && !/^(exe|dll|scr|sys|com|bin|so|elf)$/.test(ext)) { risk = 100; flags.push(`File CLAIMS .${ext} but its bytes are an EXECUTABLE`); }
            else if (t.ext === "zip" && /^(pdf|jpg|png|txt|mp3)$/.test(ext)) { risk = Math.max(risk, 85); flags.push(`Claims .${ext} but is really a ZIP archive`); }
            else if (t.ext && ext && t.ext !== ext && !["zip", "html", "doc", "class"].includes(t.ext) && EXT_RISK[ext] && EXT_RISK[t.ext]) { risk = Math.max(risk, 70); flags.push(`Extension .${ext} does not match real type (${t.name})`); }
        } else sniffHtml = kv([["Real content type", "Unrecognised / plain data"]]);
    }
    risk = Math.min(100, risk);
    const k = stateOf(risk);
    set("extResult", verdict(risk >= 60 ? "☠️" : risk >= 25 ? "⚠️" : "📄", risk >= 85 ? "DANGEROUS - do not open" : risk >= 60 ? "HIGH RISK file type" : risk >= 25 ? "Handle with care" : "Low-risk file type", k, `.${esc(ext || "?")} • ${esc(info ? info[1] : "unknown format")} • ${risk}/100`) + meter(risk, k === "danger" ? "bad" : k === "warning" ? "warn" : "ok") +
        (flags.length ? chips(flags, risk >= 60 ? "danger" : "warn") : "") + sniffHtml + note("Attackers rely on hidden or fake extensions. Enable 'show file extensions' and never run files received on WhatsApp/email from unknown senders."), k);
};

/* ============================================================
   26. IBAN VALIDATOR (real MOD-97 + Pakistan bank-code map)
   ============================================================ */
const IBAN_LEN = { AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20 };
const PK_BANKS = { HABB: "Habib Bank Limited (HBL)", MUCB: "MCB Bank", UNIL: "United Bank Limited (UBL)", ALFH: "Bank Alfalah", MEZN: "Meezan Bank", ABPA: "Allied Bank", SCBL: "Standard Chartered Pakistan", BKIP: "BankIslami", FAYS: "Faysal Bank", SONE: "Soneri Bank", BAHL: "Bank AL Habib", NBPA: "National Bank of Pakistan", ASCM: "Askari Bank", JSBL: "JS Bank", KHYB: "Bank of Khyber", BPUN: "Bank of Punjab" }; /* only well-known codes; mergers can change codes, so always confirm with your bank */
function mod97(iban) {
    const s = iban.slice(4) + iban.slice(0, 4); let rem = 0;
    for (const ch of s) { const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) rem = (rem * 10 + +d) % 97; }
    return rem;
}
window.validateIBAN = function () {
    const iban = val("ibanInput").replace(/\s+/g, "").toUpperCase();
    if (!iban) return fail("ibanResult", "Enter an IBAN, e.g. PK36HABB0000001234567801");
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return fail("ibanResult", "IBAN must start with 2 letters + 2 digits, then letters/digits only.");
    const cc = iban.slice(0, 2), want = IBAN_LEN[cc];
    const lenOk = want ? iban.length === want : iban.length >= 15 && iban.length <= 34;
    const sumOk = mod97(iban) === 1;
    const rows = [["Country", `${cc}${want ? "" : " (not in built-in table)"}`], ["Length", `${iban.length}${want ? " / expected " + want : ""} ${lenOk ? badge("✔", "ok") : badge("✘", "danger")}`], ["Check digits (MOD-97)", sumOk ? badge("✔ valid", "ok") : badge("✘ invalid - typo or fake", "danger")]];
    let bank = "";
    if (cc === "PK" && iban.length === 24) {
        const bc = iban.slice(4, 8), nm = PK_BANKS[bc];
        rows.push(["Bank code", code(bc) + " " + (nm ? badge(nm, "ok") : badge("Unrecognised code - verify with the bank", "warn"))], ["Account number", code(iban.slice(8))]);
        if (!/^[A-Z]{4}$/.test(bc)) rows.push(["Bank code format", badge("Must be 4 letters", "danger")]);
        bank = nm || "";
    }
    const ok = lenOk && sumOk;
    set("ibanResult", verdict(ok ? "✅" : "❌", ok ? "IBAN structure is VALID" : "IBAN is INVALID", ok ? "success" : "danger", code(iban.match(/.{1,4}/g).join(" "))) + kv(rows) +
        note("Validity only proves the number is well-formed - NOT that the account exists or who owns it. Confirm the beneficiary name in your banking app before sending money, especially if the IBAN came via WhatsApp/SMS."), ok ? "success" : "danger");
};

/* ============================================================
   27. WI-FI PROTOCOL INSPECTOR (rule engine)
   ============================================================ */
window.analyzeWiFi = function () {
    const t = val("wifiInput").toLowerCase();
    if (!t) return fail("wifiResult", "Enter e.g. WPA2-Personal / TKIP");
    const has = re => re.test(t);
    let score = 50; const good = [], bad = [], tips = []; let proto = "Unknown";
    if (has(/\b(open|none|nopass|no\s*security|unsecured)\b/)) { proto = "Open (no encryption)"; score = 5; bad.push("Traffic is readable by anyone nearby"); tips.push("Avoid banking/login on this network; use a VPN or switch to a secured network."); }
    else if (has(/\bwep\b/)) { proto = "WEP"; score = 8; bad.push("Cracked in minutes with free tools (RC4 flaws)"); tips.push("Replace WEP immediately - upgrade router firmware or hardware."); }
    else if (has(/wpa3|sae/)) { proto = "WPA3"; score = 95; good.push("SAE handshake resists offline guessing", "Forward secrecy"); if (has(/transition|mixed|wpa2/)) { score = 78; bad.push("Transition mode keeps WPA2 fallback (downgrade risk)"); } }
    else if (has(/wpa2/)) { proto = "WPA2"; score = 70; good.push("Still widely secure with strong password"); }
    else if (has(/wpa(?!\d)|wpa1/)) { proto = "WPA (v1)"; score = 25; bad.push("Obsolete - vulnerable to known attacks"); }
    else bad.push("Protocol not recognised - type WPA2/WPA3/WEP/Open");
    if (has(/tkip/)) { score = Math.min(score, 35); bad.push("TKIP cipher is deprecated and breakable"); tips.push("Switch cipher to AES-CCMP (AES only)."); }
    if (has(/aes|ccmp|gcmp/)) good.push("Strong AES cipher");
    if (has(/enterprise|802\.1x|eap|radius/)) { score = Math.min(100, score + 15); good.push("Per-user authentication (Enterprise)"); }
    if (has(/\bpsk\b|personal|passphrase/)) tips.push("Use a 16+ char random passphrase; change the default router password.");
    if (has(/\bwps\b/)) { score = Math.max(5, score - 25); bad.push("WPS PIN can be brute-forced (Reaver/Pixie-Dust)"); tips.push("Disable WPS in the router admin page."); }
    if (has(/hidden|cloak/)) tips.push("Hiding the SSID adds almost no security - rely on encryption instead.");
    if (has(/mac\s*filter/)) tips.push("MAC filtering is trivially bypassed by spoofing - not a security control.");
    if (has(/\bowe\b/)) { proto = proto === "Unknown" ? "Enhanced Open (OWE)" : proto; score = Math.max(score, 60); good.push("Encrypts open networks without a password"); }
    score = Math.max(0, Math.min(100, score));
    const k = score >= 70 ? "success" : score >= 40 ? "warning" : "danger";
    set("wifiResult", verdict(score >= 70 ? "📶" : score >= 40 ? "⚠️" : "🚨", `${esc(proto)} • ${score >= 70 ? "Secure" : score >= 40 ? "Acceptable / upgrade soon" : "INSECURE"}`, k, `Security score ${score}/100`) + meter(score, k === "success" ? "ok" : k === "warning" ? "warn" : "bad") +
        (good.length ? chips(good, "ok") : "") + (bad.length ? chips(bad, "danger") : "") + (tips.length ? `<div class="tp-sub">Recommendations</div><ul class="tp-ul">${tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""), k);
};

/* ============================================================
   28. SQL INJECTION STRING CHECKER (normalising rule engine)
   ============================================================ */
const SQLI_RULES = [
    [/\b(or|and)\b\s+['"]?[\w]+['"]?\s*(=|<>|!=|<|>|\blike\b)\s*['"]?[\w]+/, "Boolean tautology (OR 1=1)", 40, "Always-true condition bypasses login/filters"],
    [/\bunion\b(\s+all)?\s+select\b/, "UNION-based extraction", 50, "Appends a second query to dump other tables"],
    [/;\s*(drop|delete|insert|update|alter|create|truncate|exec|execute|shutdown)\b/, "Stacked queries", 55, "Runs a second destructive statement"],
    [/\b(sleep|benchmark|pg_sleep|dbms_pipe\.receive_message)\s*\(|waitfor\s+delay/, "Time-based blind injection", 50, "Infers data from response delays"],
    [/\b(extractvalue|updatexml|xmltype|exp\s*\(~)/, "Error-based extraction", 45, "Leaks data inside error messages"],
    [/\binformation_schema\b|\bsqlite_master\b|\bpg_catalog\b|\bsys\.(tables|columns|objects)\b|\bmysql\.user\b/, "Schema enumeration", 45, "Maps tables/columns before dumping"],
    [/\b(load_file|into\s+(out|dump)file|xp_cmdshell|utl_http|lo_import|sp_oacreate)\b/, "File / OS command access", 60, "Reads files or executes OS commands"],
    [/@@version|\bversion\s*\(\s*\)|\bdatabase\s*\(\s*\)|\bcurrent_user\b|\bsystem_user\b|\buser\s*\(\s*\)/, "Database fingerprinting", 28, "Identifies DBMS/version"],
    [/0x[0-9a-f]{6,}|\bchar\s*\(\s*\d+(\s*,\s*\d+)*\s*\)|\bchr\s*\(\s*\d+\s*\)/, "Encoded / obfuscated payload", 28, "Hex/CHAR() hides keywords from filters"],
    [/\b(substring|substr|mid|ascii|ord|left|right)\s*\(.+\)\s*(=|>|<)/, "Blind data extraction", 35, "Guesses data one character at a time"],
    [/\border\s+by\s+\d+|\bgroup\s+by\b.+\bhaving\b/, "Column-count probing", 25, "Finds number of columns for UNION"],
    [/\$(ne|gt|lt|gte|lte|regex|where|or|and|in|nin|exists)\b/, "NoSQL operator injection", 40, "MongoDB-style operator abuse"],
    [/['"]\s*\)*\s*(or|and|union|;|--|#)/, "Quote break-out", 30, "Closes the original string to inject logic"],
    [/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+(table|database)|alter\s+table)\b/, "Data-modification statement", 40, "Alters or destroys data"],
    [/\bselect\b.+\bfrom\b/, "Embedded SELECT", 22, "Sub-query data read"]
];
window.checkSQLi = function () {
    const rawIn = $("sqliInput")?.value || "";
    if (!rawIn.trim()) return fail("sqliResult", "Enter a string/payload to test.");
    let n = rawIn; try { n = decodeURIComponent(n.replace(/\+/g, " ")); n = decodeURIComponent(n); } catch (_) { }
    const hadComment = /(--\s|--$|#|\/\*)/.test(n);
    n = n.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\*!\d*/g, " ").replace(/\s+/g, " ").toLowerCase();
    const hits = []; let score = 0;
    SQLI_RULES.forEach(([re, name, w, why]) => { if (re.test(n)) { hits.push([name, why]); score += w; } });
    if (hadComment && hits.length) { hits.push(["Comment truncation (-- # /*)", "Cuts off the rest of the original query"]); score += 15; }
    if (/\/\*[\s\S]*?\*\//.test(rawIn) && hits.length) { hits.push(["Inline-comment evasion", "Splits keywords with /**/ to dodge filters"]); score += 10; }
    if (/%[0-9a-f]{2}/i.test(rawIn) && hits.length) { hits.push(["URL-encoded payload", "Encoding used to bypass naive filters"]); score += 8; }
    score = Math.min(100, score);
    const k = score >= 60 ? "danger" : score >= 25 ? "warning" : "success";
    set("sqliResult", verdict(score >= 60 ? "💉" : score >= 25 ? "⚠️" : "✅", score >= 60 ? "MALICIOUS SQL injection payload" : score >= 25 ? "Suspicious SQL patterns" : "No injection patterns found", k, `Threat score ${score}/100 • ${hits.length} rule${hits.length === 1 ? "" : "s"} matched`) + meter(score, k === "danger" ? "bad" : k === "warning" ? "warn" : "ok") +
        (hits.length ? `<div class="tp-list">${hits.map(([a, b]) => `<div class="tp-li tp-rule"><b>${esc(a)}</b><small>${esc(b)}</small></div>`).join("")}</div>` : "") +
        `<div class="tp-sub">How to defend</div><ul class="tp-ul"><li>Use parameterised queries / prepared statements - never string concatenation.</li><li>Least-privilege DB account; hide DB error messages.</li><li>Allow-list validation + a WAF as a second layer, not the only one.</li></ul>` +
        note("Educational pattern analysis on your input only. A clean result does not guarantee a field is injection-safe."), k);
};

/* ============================================================
   29. XSS PAYLOAD SANITIZER (DOMPurify real + context encoders)
   ============================================================ */
const XSS_RULES = [[/<\s*script\b/i, "<script> tag"], [/\bon\w+\s*=/i, "Inline event handler (onerror/onload…)"], [/javascript\s*:/i, "javascript: URI"], [/data\s*:\s*text\/html|data\s*:[^,]*base64/i, "data: URI payload"], [/<\s*(iframe|frame|object|embed|applet)\b/i, "Embedded content tag"], [/<\s*svg\b/i, "SVG vector (can carry scripts)"], [/<\s*meta[^>]+refresh/i, "Meta refresh redirect"], [/<\s*base\b/i, "<base> tag hijack"], [/srcdoc\s*=/i, "srcdoc attribute"], [/expression\s*\(|url\s*\(\s*['"]?javascript/i, "CSS expression / script URL"], [/<\s*form\b[^>]*action/i, "Injected form (credential phishing)"], [/&#x?[0-9a-f]+;?/i, "HTML-entity obfuscation"], [/<\s*(link|style)\b/i, "Injected stylesheet/link"], [/\{\{.*\}\}|\$\{.*\}/, "Template-injection syntax"]];
function fallbackSanitize(html) {
    const doc = new DOMParser().parseFromString(html, "text/html"), removed = [];
    doc.querySelectorAll("script,style,iframe,frame,object,embed,applet,link,meta,base,form,svg,math,template,noscript").forEach(e => { removed.push("<" + e.tagName.toLowerCase() + ">"); e.remove(); });
    doc.body.querySelectorAll("*").forEach(e => [...e.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value.replace(/[\s\u0000-\u001f]+/g, "").toLowerCase();
        if (n.startsWith("on") || n === "srcdoc" || n === "formaction" || (/^(href|src|xlink:href|action|data|poster)$/.test(n) && /^(javascript|vbscript|data):/.test(v)) || (n === "style" && /expression|javascript|url\(/.test(v))) { removed.push(n); e.removeAttribute(a.name); }
    }));
    return { clean: doc.body.innerHTML, removed };
}
window.sanitizeXSS = async function () {
    const raw = $("xssInput")?.value || "";
    if (!raw.trim()) return fail("xssResult", "Enter a payload to sanitize.");
    busy("xssResult", "Sanitizing…");
    const found = XSS_RULES.filter(([re]) => re.test(raw)).map(r => r[1]);
    let clean, removed = [], engine = "Built-in DOM allow-list";
    try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"); } catch (_) { }
    if (window.DOMPurify) { clean = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } }); removed = (window.DOMPurify.removed || []).map(r => r.element ? "<" + r.element.nodeName.toLowerCase() + ">" : r.attribute ? r.attribute.name : "?"); engine = "DOMPurify 3 (industry standard)"; }
    else { const f = fallbackSanitize(raw); clean = f.clean; removed = f.removed; }
    const htmlEnc = raw.replace(/[&<>"'`=\/]/g, c => "&#" + c.charCodeAt(0) + ";");
    const jsEnc = JSON.stringify(raw).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028");
    const score = Math.min(100, found.length * 22 + (removed.length ? 20 : 0));
    const k = clean === raw && !found.length ? "success" : score >= 40 ? "danger" : "warning";
    set("xssResult", verdict(found.length ? "🧼" : "✅", found.length ? `${found.length} XSS vector${found.length > 1 ? "s" : ""} neutralised` : "No XSS vectors detected", k, esc(engine)) + (found.length ? chips(found, "danger") : "") + (removed.length ? `<div class="tp-sub">Removed</div>${chips([...new Set(removed)].slice(0, 14), "warn")}` : "") +
        kv([["Safe HTML (sanitized)", `<code>${esc(clean) || "(empty)"}</code>`], ["HTML text context", code(htmlEnc)], ["JavaScript string", code(jsEnc)], ["URL parameter", code(encodeURIComponent(raw))]]) +
        note("Best practice: output-encode for the exact context, add a strict Content-Security-Policy, and sanitize rich HTML only with DOMPurify. The payload above was parsed in an inert DOM - it was NOT executed."), k);
};

/* ============================================================
   30. DARK-WEB / BREACH MONITOR (HIBP + XposedOrNot)
   ============================================================ */
window.checkDarkWeb = async function () {
    const q = val("darkwebInput").toLowerCase();
    if (!q) return fail("darkwebResult", "Enter a domain (company.com) or an email address.");
    busy("darkwebResult", "Searching breach intelligence…");
    try {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q)) {
            const r = await xonEmail(q);
            return set("darkwebResult", r.found ? verdict("🚨", `Credentials exposed in ${r.list.length} breach${r.list.length > 1 ? "es" : ""}`, "danger", esc(q)) + chips(r.list.slice(0, 24), "danger") + note("Rotate passwords, enable 2FA, and watch for phishing that uses leaked details.") : verdict("✅", "No exposure found", "success", esc(q)) + note("Not found in XposedOrNot. Re-check regularly."), r.found ? "danger" : "success");
        }
        const d = parseHost(q); if (!isDomain(d)) return fail("darkwebResult", "Enter a valid domain or email.");
        let list = [], src = "";
        try { const h = await getJson(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(d)}`, { timeout: 12000 }); list = h.map(b => ({ name: b.Title || b.Name, date: b.BreachDate, count: b.PwnCount, data: b.DataClasses || [], sensitive: b.IsSensitive })); src = "Have I Been Pwned"; } catch (_) { }
        if (!list.length) try { const x = await getJson(`https://api.xposedornot.com/v1/breaches?domain=${encodeURIComponent(d)}`, { timeout: 12000 }); list = (x.exposedBreaches || []).map(b => ({ name: b.breachID, date: (b.breachedDate || "").slice(0, 10), count: b.exposedRecords, data: b.exposedData || [] })); src = "XposedOrNot"; } catch (_) { }
        if (!list.length) return set("darkwebResult", verdict("✅", "No public breach recorded for this domain", "success", esc(d)) + note("Checked Have I Been Pwned & XposedOrNot. Dark-web markets are not publicly searchable - this covers disclosed breaches only."), "success");
        const total = list.reduce((a, b) => a + (+b.count || 0), 0);
        set("darkwebResult", verdict("🚨", `${list.length} known breach${list.length > 1 ? "es" : ""} • ${num(total)} records`, "danger", `${esc(d)} • source: ${esc(src)}`) +
            `<div class="tp-list">${list.slice(0, 8).map(b => `<div class="tp-li tp-rule"><b>${esc(b.name)} <small>${esc(b.date || "")}</small></b><small>${num(b.count || 0)} records • ${esc((b.data || []).slice(0, 6).join(", "))}</small></div>`).join("")}</div>` + (list.length > 8 ? note(`+${list.length - 8} more`) : "") +
            note("If employees reused passwords from these breaches, expect credential-stuffing attacks. Force resets and enforce MFA."), "danger");
    } catch (_) { fail("darkwebResult", "Breach services unreachable or rate-limited. Try again shortly.", "warning"); }
};

/* ============================================================
   INIT - inject extra UI controls once DOM is ready
   ============================================================ */
function initToolsPro() {
    ensureGenUI(); ensureJwtUI(); ensureQrUI(); ensureFileUI(); ensureExtUI();
    document.querySelectorAll(".tool-card .breach-result-text").forEach(el => el.setAttribute("aria-live", "polite"));
    document.querySelectorAll("#tools input[type=text], #tools input[type=email], #tools input[type=password]").forEach(i => {
        i.addEventListener("keydown", e => {
            if (e.key !== "Enter") return;
            const btn = i.closest(".tool-card")?.querySelector(".btn-primary-small"); if (btn) { e.preventDefault(); btn.click(); }
        });
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToolsPro); else initToolsPro();

/* ============================================================================
   ██  v6  -  FULL REPORT ENGINE  +  DEEP INTELLIGENCE TOOLS  ██
   Email/Gmail, URL, IP, Browser, DNS, Password  ->  bara "Full Report" modal
   ============================================================================ */
const REPORTS = {};
const rSec = (icon, title, html, cls = "") => `<section class="tpr-sec ${cls}"><h4><span>${icon}</span>${esc(title)}</h4>${html}</section>`;
const rTiles = arr => `<div class="tpr-tiles">${arr.filter(Boolean).map(([l, v, s]) => `<div class="tpr-tile"><small>${esc(l)}</small><b>${v}</b>${s ? `<em>${s}</em>` : ""}</div>`).join("")}</div>`;
const rTable = (head, rows) => `<div class="tpr-table"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(head[i])}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const rList = (arr, cls = "") => `<ul class="tpr-ul ${cls}">${arr.map(x => `<li>${x}</li>`).join("")}</ul>`;
const rSteps = arr => `<ol class="tpr-steps">${arr.map(x => `<li>${x}</li>`).join("")}</ol>`;
const rSignal = s => `<div class="tpr-sig tpr-s-${s.sev}"><span class="tpr-dot"></span><div><b>${esc(s.title)}</b><p>${esc(s.why)}</p></div></div>`;
const rPara = t => `<p class="tpr-p">${t}</p>`;
function rGauge(pct, label, kind = "ok") {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return `<div class="tpr-gauge tpr-g-${kind}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" stroke-dasharray="${(pct * 2.639).toFixed(1)} 264"/></svg><b>${pct}</b><small>${esc(label)}</small></div>`;
}
const rHero = (icon, title, sub, kind, gauge) => `<div class="tpr-hero tpr-h-${kind}"><div class="tpr-hero-i">${icon}</div><div class="tpr-hero-t"><h3>${title}</h3><p>${sub}</p></div>${gauge || ""}</div>`;
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4, good: 5 };
const SEV_LABEL = { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW", info: "INFO", good: "GOOD" };

function ensureModal() {
    if ($("tpModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
    <div id="tpModal" class="tp-modal" hidden role="dialog" aria-modal="true" aria-labelledby="tpmTitle">
        <div class="tp-modal-card">
            <header class="tp-modal-head">
                <div class="tp-modal-ttl"><h3 id="tpmTitle"></h3><small id="tpmSub"></small></div>
                <div class="tp-modal-actions"><button type="button" id="tpmCopy" class="tp-copy">⧉ Copy report</button><button type="button" id="tpmClose" class="tp-x" aria-label="Close report">✕</button></div>
            </header>
            <div class="tp-modal-body" id="tpmBody"></div>
        </div>
    </div>`);
    $("tpmClose").addEventListener("click", closeReport);
    $("tpModal").addEventListener("click", e => { if (e.target.id === "tpModal") closeReport(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("tpModal").hidden) closeReport(); });
    $("tpmCopy").addEventListener("click", () => {
        const t = $("tpmBody").innerText.trim(), b = $("tpmCopy");
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = "✓ Copied"; setTimeout(() => (b.textContent = "⧉ Copy report"), 1600); }).catch(() => { });
    });
}
function openReport(key) {
    const r = REPORTS[key]; if (!r) return;
    ensureModal();
    $("tpmTitle").textContent = r.title; $("tpmSub").textContent = r.sub || "";
    $("tpmBody").innerHTML = r.html; $("tpmBody").scrollTop = 0;
    $("tpModal").hidden = false; document.body.classList.add("tp-lock");
    $("tpmClose").focus({ preventScroll: true });
}
function closeReport() { const m = $("tpModal"); if (m) m.hidden = true; document.body.classList.remove("tp-lock"); }
document.addEventListener("click", e => { const b = e.target.closest(".tp-open"); if (!b) return; const k = b.dataset.report; if (k && k.indexOf("auto:") === 0 && typeof buildAuto === "function") buildAuto(k.slice(5)); openReport(k); });
/* set() + "Open full report" button */
function setR(id, key, title, sub, summaryHtml, reportHtml, state) {
    REPORTS[key] = { title, sub, html: reportHtml };
    set(id, summaryHtml, state);
    const el = $(id), act = el && el.querySelector(".tp-actions");
    if (act) act.insertAdjacentHTML("afterbegin", `<button type="button" class="tp-open" data-report="${key}">📄 Open full report</button>`);
}
const fmtDate = d => { try { return new Date(d).toISOString().slice(0, 10); } catch (_) { return "—"; } };
const entropyOf = s => { const m = {}; for (const c of s) m[c] = (m[c] || 0) + 1; return -Object.values(m).reduce((a, n) => a + (n / s.length) * Math.log2(n / s.length), 0); };
const haversine = (a, b, c, d) => { const R = 6371, t = x => x * Math.PI / 180, dl = t(c - a), dn = t(d - b), h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/* ============================================================
   EMAIL / GMAIL DEEP INSPECTOR
   ============================================================ */
const POPULAR_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "live.com", "msn.com", "aol.com", "yandex.com", "zoho.com", "mail.com", "gmx.com", "yahoo.co.uk", "googlemail.com", "protonmail.com"];
const MAIL_PROV = [[/aspmx\.l\.google\.com|googlemail\.com|\.google\.com\.?$/i, "Google (Gmail / Google Workspace)"], [/mail\.protection\.outlook\.com|outlook\.com/i, "Microsoft 365 / Outlook"], [/zoho\.(com|in|eu)/i, "Zoho Mail"], [/yahoodns\.net|yahoo/i, "Yahoo Mail"], [/protonmail|proton\.ch|proton\.me/i, "Proton Mail"], [/icloud|me\.com|apple/i, "iCloud Mail"], [/mimecast/i, "Mimecast (security gateway)"], [/pphosted|proofpoint/i, "Proofpoint (security gateway)"], [/secureserver\.net/i, "GoDaddy mail"], [/yandex/i, "Yandex Mail"], [/mailgun|sendgrid|amazonses/i, "Bulk-mail service"], [/ovh|ionos|1and1|hostinger|namecheap|privateemail|registrar-servers/i, "Hosting-provider mail"]];
const DATA_EXPLAIN = {
    "passwords": ["🔑", "Your actual password (or its hash) was leaked. Attackers try it on Gmail, banking, Facebook and shopping accounts (credential stuffing).", "critical"],
    "password hints": ["💡", "Hints often reveal the password itself. Treat as if the password leaked.", "high"],
    "email addresses": ["📧", "Your email is now on spam/phishing lists. Expect targeted fake 'account' emails.", "low"],
    "usernames": ["👤", "Usernames let attackers guess your accounts on other sites.", "low"],
    "phone numbers": ["📱", "Enables SIM-swap attempts, WhatsApp/SMS phishing and scam calls using your real details.", "high"],
    "names": ["🪪", "Real names make scam messages and calls far more convincing.", "medium"],
    "physical addresses": ["🏠", "Home address exposure helps impersonation, parcel scams and stalking.", "high"],
    "dates of birth": ["🎂", "Date of birth is a common security question and identity-theft ingredient.", "high"],
    "ip addresses": ["🌐", "Reveals approximate location and ISP at the time of the breach.", "medium"],
    "credit cards": ["💳", "Card data may be exposed. Call your bank to block/replace the card.", "critical"],
    "partial credit card data": ["💳", "Partial card data helps fraudsters pass verification checks.", "high"],
    "financial": ["💰", "Financial details raise the risk of targeted fraud.", "high"],
    "government issued ids": ["🪪", "ID numbers (like CNIC/SSN) allow identity theft. Monitor and report misuse.", "critical"],
    "security questions and answers": ["❓", "Answers can unlock account recovery. Change them everywhere you reused them.", "high"],
    "genders": ["⚧", "Low risk by itself, but adds to your profile.", "low"],
    "geographic locations": ["📍", "Location history can reveal where you live and work.", "medium"],
    "social media profiles": ["🔗", "Links your identities across sites. Review privacy settings.", "medium"],
    "employers": ["🏢", "Enables convincing work-themed phishing.", "medium"],
    "job titles": ["💼", "Enables convincing work-themed phishing.", "low"],
    "device information": ["🖥️", "Device details can be used for fingerprinting.", "low"],
    "purchases": ["🛒", "Purchase history makes fake order/refund scams believable.", "medium"],
    "ages": ["🎂", "Age adds to your profile for targeted scams.", "low"]
};
function analyzeLocalPart(local) {
    const l = local.toLowerCase(), digits = (l.match(/\d/g) || []).length, letters = (l.match(/[a-z]/g) || []).length;
    const ent = entropyOf(l.replace(/[._+-]/g, "")), kinds = [];
    if (/^[a-z]{2,}[._-][a-z]{2,}$/.test(l)) kinds.push(["Looks like first.last (professional style)", "ok"]);
    else if (/^[a-z]{3,14}$/.test(l)) kinds.push(["Name/word-like (easy to guess)", "info"]);
    if (/(19[5-9]\d|20[0-2]\d)/.test(l)) kinds.push(["Contains a year (often a birth year)", "warn"]);
    if (digits >= 5 || (digits / Math.max(1, l.length)) > 0.4) kinds.push(["Heavy digits (throwaway / bulk-created style)", "warn"]);
    if (l.length > 24) kinds.push(["Very long (typical of auto-generated addresses)", "warn"]);
    if (ent > 3.5 && letters > 8 && !/[aeiou]{1}/.test(l.slice(0, 3))) kinds.push(["Random-looking characters", "warn"]);
    if (/^(admin|info|support|sales|contact|root|noreply|no-reply|webmaster|postmaster|billing|hr|office|help)$/.test(l)) kinds.push(["Role account (shared mailbox, not a person)", "warn"]);
    if (l.includes("+")) kinds.push(["Contains a +tag alias (used to track which site leaked your address)", "info"]);
    return { len: l.length, digits, ent, kinds };
}
const grav = email => new Promise(res => {
    try {
        const h = md5(new TextEncoder().encode(email.trim().toLowerCase())), im = new Image(), t = setTimeout(() => res(null), 4500);
        im.onload = () => { clearTimeout(t); res(true); }; im.onerror = () => { clearTimeout(t); res(false); };
        im.src = `https://www.gravatar.com/avatar/${h}?d=404&s=1`;
    } catch (_) { res(null); }
});
async function xonAnalytics(email) {
    try { return await getJson(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, { timeout: 14000 }); }
    catch (e) { if (e.status === 404) return { none: true }; throw e; }
}
function parseBreaches(d) {
    const arr = d?.ExposedBreaches?.breaches_details || d?.breaches_details || [];
    return arr.map(b => ({ name: b.breach || b.name || "Unknown", domain: b.domain || "", industry: b.industry || "", year: String(b.xposed_date || "").slice(0, 4), records: +b.xposed_records || 0, data: String(b.xposed_data || "").split(/;|,/).map(s => s.trim()).filter(Boolean), pw: String(b.password_risk || "").toLowerCase(), verified: /yes|true/i.test(String(b.verified)), details: b.details || "" }));
}
const pwRiskLabel = r => ({ plaintext: ["Stored in PLAIN TEXT", "danger"], easytocrack: ["Weak hash - easy to crack", "danger"], hardtocrack: ["Strong hash - hard to crack", "warn"], unknown: ["Unknown storage", "info"] }[r] || [r ? r : "Unknown", "info"]);

window.simulateBreachCheck = async function () {
    const email = val("emailInput").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("breachResult", "Enter a valid email address.");
    const [local, domain] = [email.slice(0, email.lastIndexOf("@")), email.slice(email.lastIndexOf("@") + 1)];
    busy("breachResult", "Building deep report: breach databases, mail server, spoofing protection, Gmail analysis…");
    const isGmail = /^(gmail|googlemail)\.com$/.test(domain);
    const [an, mx, spf, dmarc, age, gv] = await Promise.allSettled([xonAnalytics(email), dnsQuery(domain, "MX"), dnsQuery(domain, "TXT"), dnsQuery("_dmarc." + domain, "TXT"), isGmail ? Promise.resolve(null) : domainAge(domain), grav(email)]);
    let breaches = [], serviceDown = false, clean = false, names = [];
    if (an.status === "fulfilled") { if (an.value.none) clean = true; else breaches = parseBreaches(an.value); if (!clean && !breaches.length) { try { const r = await xonEmail(email); names = r.list; if (!r.found) clean = true; } catch (_) { serviceDown = true; } } }
    else { try { const r = await xonEmail(email); names = r.list; clean = !r.found; } catch (_) { serviceDown = true; } }
    if (!breaches.length && names.length) breaches = names.map(n => ({ name: n, domain: "", industry: "", year: "", records: 0, data: [], pw: "", verified: false, details: "" }));
    const mxs = mx.status === "fulfilled" ? (mx.value.Answer || []).filter(a => a.type === 15).map(a => a.data.replace(/\.$/, "")) : [];
    const txts = spf.status === "fulfilled" ? (spf.value.Answer || []).map(a => String(a.data)) : [];
    const spfRec = txts.find(t => /v=spf1/i.test(t)), dmRec = dmarc.status === "fulfilled" ? (dmarc.value.Answer || []).map(a => String(a.data)).find(t => /v=DMARC1/i.test(t)) : "";
    const dmPol = (dmRec || "").match(/\bp=(\w+)/i)?.[1]?.toLowerCase() || "";
    const provider = isGmail ? "Google Gmail (consumer account)" : (MAIL_PROV.find(([re]) => mxs.some(m => re.test(m)))?.[1] || (mxs.length ? "Custom / self-hosted mail server" : "No mail server found"));
    const la = analyzeLocalPart(local), canon = isGmail ? local.replace(/\./g, "").replace(/\+.*$/, "") + "@gmail.com" : "";
    const variants = isGmail ? Math.pow(2, Math.max(0, canon.split("@")[0].length - 1)) : 0;
    const typo = !POPULAR_MAIL.includes(domain) ? POPULAR_MAIL.map(d => [d, lev(domain, d)]).filter(x => x[1] > 0 && x[1] <= 2).sort((a, b) => a[1] - b[1])[0] : null;
    const gravatar = gv.status === "fulfilled" ? gv.value : null, ageInfo = age.status === "fulfilled" ? age.value : null;

    /* ---------- risk model ---------- */
    const allData = new Set(breaches.flatMap(b => b.data.map(d => d.toLowerCase())));
    const hasPw = [...allData].some(d => /^passwords?$/.test(d)), recent = breaches.some(b => +b.year >= new Date().getFullYear() - 3);
    const weakPw = breaches.some(b => /plaintext|easytocrack/.test(b.pw));
    const sensitive = ["phone numbers", "physical addresses", "dates of birth", "credit cards", "financial", "government issued ids", "partial credit card data", "security questions and answers"].filter(k => allData.has(k));
    let risk = Math.min(40, breaches.length * 7) + (hasPw ? 22 : 0) + (weakPw ? 14 : 0) + (recent ? 8 : 0) + Math.min(16, sensitive.length * 8);
    risk = Math.min(100, risk);
    const rk = risk >= 60 ? "danger" : risk >= 25 ? "warning" : "success", rkName = risk >= 60 ? "HIGH RISK" : risk >= 25 ? "MODERATE RISK" : breaches.length ? "LOW RISK" : "NO EXPOSURE FOUND";

    /* ---------- spoofing posture ---------- */
    let spoof = "—", spoofK = "info";
    if (!isGmail && mxs.length) { const g = (spfRec ? 1 : 0) + (dmRec ? 1 : 0) + (["reject", "quarantine"].includes(dmPol) ? 1 : 0); spoof = ["F (spoofable)", "D", "B", "A (protected)"][g]; spoofK = g >= 3 ? "ok" : g === 2 ? "warn" : "danger"; }

    /* ---------- summary card ---------- */
    const flags = [];
    if (DISPOSABLE.includes(domain)) flags.push(badge("Disposable domain", "warn"));
    if (mxs.length === 0 && !isGmail) flags.push(badge("No mail server (MX)", "danger"));
    if (typo) flags.push(badge("Looks like a typo of " + typo[0], "warn"));
    if (isGmail) flags.push(badge("Gmail: dots & +tags ignored", "info"));
    if (gravatar) flags.push(badge("Public Gravatar profile exists", "info"));
    const summary = serviceDown && !breaches.length
        ? verdict("⚠️", "Breach service unreachable", "warning", "Rate-limited or offline. Local analysis is still available below.")
        : verdict(breaches.length ? (risk >= 60 ? "🚨" : "⚠️") : "✅", breaches.length ? `${breaches.length} breach${breaches.length > 1 ? "es" : ""} • ${rkName}` : "No breach found", rk, esc(email)) +
        meter(risk, rk === "danger" ? "bad" : rk === "warning" ? "warn" : "ok") +
        kv([["Provider", esc(provider)], isGmail ? ["Canonical Gmail", code(canon)] : ["Mail servers", mxs.length ? mxs.slice(0, 2).map(code).join(" ") : badge("none", "danger")], breaches.length ? ["Data exposed", chips([...allData].slice(0, 6).map(x => x.replace(/\b\w/g, c => c.toUpperCase())), "danger")] : null, ["Spoofing protection", isGmail ? badge("Google-managed", "ok") : badge(spoof, spoofK === "ok" ? "ok" : spoofK === "warn" ? "warn" : "danger")]]) +
        `<div class="tp-chips">${flags.join("")}</div>`;

    /* ---------- full report ---------- */
    let h = rHero(breaches.length ? (risk >= 60 ? "🚨" : "⚠️") : "🛡️", esc(email), `${rkName} · ${breaches.length} known breach${breaches.length === 1 ? "" : "es"} · ${esc(provider)}`, rk === "danger" ? "bad" : rk === "warning" ? "warn" : "ok", rGauge(risk, "exposure risk", rk === "danger" ? "bad" : rk === "warning" ? "warn" : "ok"));
    h += rSec("🧬", "Address anatomy", rTiles([["Local part", code(local)], ["Domain", code(domain)], ["Length", `${la.len} chars`], ["Randomness (entropy)", la.ent.toFixed(2) + " bits/char"], ["Digits", String(la.digits)], isGmail ? ["Canonical Gmail", code(canon)] : null, isGmail ? ["Dot-variants of this address", num(variants), "all deliver to the same inbox"] : null]) + (la.kinds.length ? chips(la.kinds.map(k => k[0]), "info") : "") +
        (isGmail ? rPara("<b>Gmail ignores dots and +tags.</b> <code>j.o.h.n@gmail.com</code> and <code>john+shop@gmail.com</code> reach the same inbox as <code>john@gmail.com</code>. Scammers use this to register look-alike accounts, and you can use +tags to find out which site leaks your address.") : "") +
        (typo ? rPara(`⚠️ <b>Possible typo:</b> did you mean <code>${esc(local)}@${esc(typo[0])}</code>? Mistyped domains are a common way emails reach strangers.`) : ""));
    h += rSec("📬", "Mail provider & domain health", rTiles([["Provider", esc(provider)], ["MX records", mxs.length ? esc(mxs.slice(0, 3).join(", ")) : "none"], isGmail ? null : ["Domain age", ageInfo ? `${Math.floor(ageInfo.days / 365 * 10) / 10} years (${fmtDate(ageInfo.created)})` : "unavailable"], isGmail ? null : ["SPF", spfRec ? badge("present", "ok") : badge("missing", "danger")], isGmail ? null : ["DMARC", dmRec ? badge("p=" + (dmPol || "?"), dmPol === "none" ? "warn" : "ok") : badge("missing", "danger")], ["Spoofing grade", isGmail ? "Google-managed" : spoof], ["Gravatar profile", gravatar === null ? "unknown" : gravatar ? badge("exists (public photo/name possible)", "warn") : badge("none", "ok")]]) +
        (isGmail ? "" : rPara(spoofK === "ok" ? "Strong anti-spoofing: attackers cannot easily send fake emails that appear to come from this domain." : "Weak anti-spoofing: criminals may be able to send emails that look like they come from this domain. Treat unexpected messages from it with caution.")));
    if (breaches.length) {
        const byYear = {}; breaches.forEach(b => { const y = b.year || "?"; (byYear[y] = byYear[y] || []).push(b.name); });
        h += rSec("🕰️", "Breach timeline", `<div class="tpr-timeline">${Object.keys(byYear).sort().map(y => `<div class="tpr-tl"><b>${esc(y)}</b><span>${byYear[y].map(esc).join(", ")}</span></div>`).join("")}</div>`);
        h += rSec("🗂️", "Every breach in detail", rTable(["Breach", "Year", "Records", "Data exposed", "Password storage"], breaches.map(b => { const pr = pwRiskLabel(b.pw); return [`<b>${esc(b.name)}</b>${b.domain ? `<br><small>${esc(b.domain)}</small>` : ""}${b.industry ? `<br><small>${esc(b.industry)}</small>` : ""}`, esc(b.year || "—"), b.records ? num(b.records) : "—", b.data.length ? chips(b.data.slice(0, 8), "info") : "—", b.pw ? badge(pr[0], pr[1]) : "—"]; })));
        const rows = [...allData].map(d => { const e = DATA_EXPLAIN[d] || ["•", "This information type was exposed and can help attackers target you.", "low"]; return { sev: e[2], title: `${e[0]} ${d.replace(/\b\w/g, c => c.toUpperCase())}`, why: e[1] }; }).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
        h += rSec("🎯", "What attackers can do with this data", rows.map(rSignal).join(""));
        const pwSites = breaches.filter(b => b.data.some(d => /^passwords?$/i.test(d))).map(b => b.name);
        h += rSec("🛠️", "Your action plan (in priority order)", rSteps([
            pwSites.length ? `<b>Change your password</b> on: ${pwSites.slice(0, 8).map(esc).join(", ")} — and on every site where you reused that password.` : "<b>Check password reuse:</b> change any password you reused across sites.",
            "<b>Use a unique password for every site</b> with a password manager (see our Services page for a free recommendation).",
            "<b>Turn on 2-Step Verification</b> with an authenticator app or passkey (not SMS).",
            isGmail ? "<b>Check Gmail for back doors:</b> Settings → Forwarding and POP/IMAP, and Filters. Remove anything you did not create." : "<b>Check your mailbox settings</b> for unknown forwarding rules and filters.",
            isGmail ? `<b>Run the Google Security Checkup:</b> ${link("https://myaccount.google.com/security-checkup", "myaccount.google.com/security-checkup")} and review <a class="cg-result-link" href="https://myaccount.google.com/device-activity" target="_blank" rel="noopener noreferrer">your devices</a> and <a class="cg-result-link" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">third-party access</a>.` : "<b>Review sign-in activity</b> on your email provider's security page.",
            sensitive.length ? "<b>Call your bank / watch your accounts:</b> financial or ID details were exposed. Set alerts and report misuse immediately." : "<b>Watch for phishing</b> that mentions the affected sites by name.",
            `<b>Get alerts for future leaks:</b> ${link("https://haveibeenpwned.com/NotifyMe", "haveibeenpwned.com/NotifyMe")}`
        ]));
    } else if (clean) {
        h += rSec("✅", "Breach check", rPara("This address was <b>not found</b> in the XposedOrNot breach database. That is good news, but databases are never complete. Keep a unique password and 2-Step Verification enabled.") + rPara(link("https://haveibeenpwned.com", "Cross-check on Have I Been Pwned")));
    } else h += rSec("⚠️", "Breach check", rPara("The breach database could not be reached (rate limit or offline). Try again in a minute."));
    h += rSec("🔐", isGmail ? "Check your own Gmail & Google account" : "Protect this mailbox", `<div class="tpr-links">${[["My Google Activity", "https://myactivity.google.com"], ["Security Checkup", "https://myaccount.google.com/security-checkup"], ["Your devices", "https://myaccount.google.com/device-activity"], ["Third-party access", "https://myaccount.google.com/connections"], ["Gmail forwarding settings", "https://mail.google.com/mail/u/0/#settings/fwdandpop"], ["Google Takeout", "https://takeout.google.com"]].map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`).join("")}</div>` + rPara("We cannot see inside any Gmail account. These official pages show you everything Google holds about <b>your own</b> account."));
    h += rPara(`<small>Privacy: this check sends the address to XposedOrNot and Google DNS. It is not stored by CyberGuard.</small>`);
    setR("breachResult", "email", "Email & Gmail deep report", email, summary, h, serviceDown && !breaches.length ? "warning" : rk);
};

/* ============================================================
   SHARED LOOKUPS (used by URL / IP / DNS reports)
   ============================================================ */
async function ipwho(ip) {
    try { const g = await getJson(`https://ipwho.is/${ip ? encodeURIComponent(ip) : ""}`, { timeout: 9000 }); if (g.success === false) throw new Error(g.message); return g; }
    catch (_) {
        const o = await getJson(`https://ipapi.co/${ip ? encodeURIComponent(ip) + "/" : ""}json/`, { timeout: 9000 });
        if (o.error) throw new Error(o.reason);
        return { ip: o.ip, type: o.version === "IPv6" ? "IPv6" : "IPv4", continent: o.continent_code, country: o.country_name, country_code: o.country_code, region: o.region, city: o.city, postal: o.postal, latitude: o.latitude, longitude: o.longitude, capital: o.country_capital, calling_code: String(o.country_calling_code || "").replace("+", ""), is_eu: !!o.in_eu, connection: { asn: String(o.asn || "").replace("AS", ""), org: o.org, isp: o.org, domain: "" }, timezone: { id: o.timezone, utc: o.utc_offset }, currency: o.currency ? { code: o.currency, name: o.currency_name } : null, flag: {} };
    }
}
async function rdapDomain(host) {
    try {
        const d = await getJson(`https://rdap.org/domain/${encodeURIComponent(regDomain(host))}`, { timeout: 10000 });
        const ev = a => (d.events || []).find(e => new RegExp(a, "i").test(e.eventAction))?.eventDate;
        const reg = (d.entities || []).find(e => (e.roles || []).includes("registrar"));
        return { created: ev("registration"), updated: ev("last changed"), expires: ev("expiration"), registrar: reg?.vcardArray?.[1]?.find(v => v[0] === "fn")?.[3] || "", status: d.status || [], ns: (d.nameservers || []).map(n => (n.ldhName || "").toLowerCase()).filter(Boolean), dnssec: d.secureDNS?.delegationSigned };
    } catch (_) { return null; }
}
const raceT = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);
const HOSTING_RE = /(amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|vultr|contabo|leaseweb|choopa|m247|datacamp|cloudflare|fastly|oracle|alibaba|tencent|ionos|godaddy|namecheap|hostinger|hostwinds|scaleway|colocrossing|quadranet|psychz|serverius|tzulo|packet|zenlayer|internap|rackspace|kamatera|upcloud|frantech|buyvm|path\.net|clouvider|hosting|datacenter|data center|server|vps|cloud)/i;
const VPN_RE = /(vpn|proxy|mullvad|nord|express|proton|surfshark|cyberghost|private internet|m247|datacamp|tor |tor-|anonymizer|hide)/i;

/* ============================================================
   URL DEEP INSPECTOR
   ============================================================ */
const OFFICIAL = { easypaisa: ["easypaisa.com.pk"], jazzcash: ["jazzcash.com.pk"], hbl: ["hbl.com"], ubl: ["ubl.com.pk"], mcb: ["mcb.com.pk"], meezan: ["meezanbank.com"], alfalah: ["bankalfalah.com"], paypal: ["paypal.com"], google: ["google.com", "google.com.pk", "gmail.com", "youtube.com", "goo.gl"], facebook: ["facebook.com", "fb.com", "fb.me"], whatsapp: ["whatsapp.com", "wa.me"], instagram: ["instagram.com"], binance: ["binance.com"], amazon: ["amazon.com", "amazon.co.uk", "amazon.in"], microsoft: ["microsoft.com", "live.com", "office.com", "outlook.com"], apple: ["apple.com", "icloud.com"], netflix: ["netflix.com"], nadra: ["nadra.gov.pk"], fbr: ["fbr.gov.pk"], daraz: ["daraz.pk"], telenor: ["telenor.com.pk"], zong: ["zong.com.pk"], ufone: ["ufone.com"], jazz: ["jazz.com.pk"], sadapay: ["sadapay.pk"], nayapay: ["nayapay.com"], raast: ["sbp.org.pk"], tiktok: ["tiktok.com"], telegram: ["telegram.org", "t.me"], youtube: ["youtube.com", "youtu.be"], linkedin: ["linkedin.com"], standardchartered: ["sc.com"], bisp: ["bisp.gov.pk"], pta: ["pta.gov.pk"], dhl: ["dhl.com"], fedex: ["fedex.com"], tcs: ["tcsexpress.com"], foodpanda: ["foodpanda.pk"], bykea: ["bykea.com"] };
const FREE_HOSTS = ["blogspot.com", "weebly.com", "wixsite.com", "github.io", "pages.dev", "workers.dev", "web.app", "firebaseapp.com", "vercel.app", "netlify.app", "herokuapp.com", "000webhostapp.com", "ngrok.io", "ngrok-free.app", "trycloudflare.com", "duckdns.org", "ddns.net", "glitch.me", "repl.co", "replit.app", "r2.dev", "framer.website", "carrd.co", "godaddysites.com", "myshopify.com", "square.site", "notion.site", "webflow.io", "azurewebsites.net", "appspot.com", "forms.gle", "linktr.ee", "sites.google.com"];
const BAD_TLDS = ["zip", "mov", "top", "xyz", "click", "work", "download", "tk", "ml", "ga", "cf", "gq", "icu", "buzz", "rest", "cyou", "monster", "loan", "win", "bid", "men", "review", "country", "kim", "science", "stream", "gdn", "racing", "party", "trade", "webcam", "date", "faith", "accountant", "cricket", "link", "support", "help", "cam", "sbs", "quest", "bond"];
const PATH_KW = /(login|log-in|signin|sign-in|verify|verification|secure|account|update|wallet|bank|bonus|reward|claim|free|prize|gift|otp|kyc|suspend|confirm|password|recover|unlock|refund|parcel|delivery|tracking|invoice|payment|billing|support|helpline|ehsaas|bisp|benazir|loan|apply|lottery|winner|cashback|airdrop|giveaway)/i;
const SCAM_TYPES = [
    [/ehsaas|bisp|benazir|relief|grant|nadra|fbr|tax|refund|subsidy/i, "Government benefit / tax scam", "Pretends to be a government relief or tax portal to collect CNIC, phone numbers and 'processing fees'."],
    [/prize|lottery|winner|reward|bonus|free|gift|claim|giveaway|cashback|airdrop/i, "Prize / reward scam", "Promises a prize so you enter personal or card details or pay a small 'fee'."],
    [/parcel|delivery|tracking|courier|dhl|fedex|tcs|leopards|postex|shipment|customs/i, "Delivery / courier smishing", "Fake 'failed delivery' page that asks for a small fee or your card/OTP."],
    [/job|earn|task|salary|income|invest|profit|forex|crypto|trading|usdt|bitcoin|binance|mining/i, "Job / investment / crypto scam", "Lures you with easy income, then demands deposits that can never be withdrawn."],
    [/apk|install|crack|mod|download/i, "Malware / fake app distribution", "Tries to make you download an app or file that steals SMS, OTPs and passwords."],
    [/support|helpline|antivirus|virus|technical/i, "Tech-support scam", "Fake support page that pushes you to call a number or install remote-access software."],
    [/login|signin|verify|otp|kyc|account|suspend|password|wallet|bank|confirm|unlock|secure/i, "Credential / OTP phishing", "A look-alike login or 'verification' page that steals your username, password, PIN or OTP."]
];
function punyDecode(input) {
    const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700; let n = 128, i = 0, bias = 72; const out = [];
    let basic = input.lastIndexOf("-"); if (basic < 0) basic = 0;
    for (let j = 0; j < basic; j++) out.push(input.charCodeAt(j));
    for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
        const oldi = i;
        for (let w = 1, k = base; ; k += base) {
            if (idx >= input.length) return null;
            const c = input.charCodeAt(idx++), digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
            if (digit >= base) return null;
            i += digit * w; const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
            if (digit < t) break; w *= base - t;
        }
        const len = out.length + 1; let delta = i - oldi; delta = oldi === 0 ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / len);
        let k2 = 0; while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k2 += base; }
        bias = k2 + Math.floor((base - tMin + 1) * delta / (delta + skew)); n += Math.floor(i / len); i %= len; out.splice(i++, 0, n);
    }
    try { return String.fromCodePoint(...out); } catch (_) { return null; }
}
const toUnicodeHost = h => h.split(".").map(l => /^xn--/i.test(l) ? (punyDecode(l.slice(4)) || l) : l).join(".");
const scriptsIn = s => { const set = new Set(); for (const ch of s) { const c = ch.codePointAt(0); if (c < 128) { if (/[a-z]/i.test(ch)) set.add("Latin"); } else if (c >= 0x400 && c <= 0x52f) set.add("Cyrillic"); else if (c >= 0x370 && c <= 0x3ff) set.add("Greek"); else if (c >= 0x530 && c <= 0x58f) set.add("Armenian"); else if (c >= 0x600 && c <= 0x6ff) set.add("Arabic"); else if (c >= 0xc0 && c <= 0x24f) set.add("Latin-ext"); else set.add("Other"); } return [...set]; };
const CONFUSE = s => s.toLowerCase().replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d").replace(/[0]/g, "o").replace(/[1|!]/g, "l").replace(/3/g, "e").replace(/4/g, "a").replace(/[5$]/g, "s").replace(/6/g, "g").replace(/7/g, "t").replace(/8/g, "b").replace(/@/g, "a").replace(/[^a-z]/g, "");
const colorUrl = (u, reg, host) => {
    const sub = host.slice(0, Math.max(0, host.length - reg.length)), tldI = reg.indexOf("."), name = tldI > 0 ? reg.slice(0, tldI) : reg, tld = tldI > 0 ? reg.slice(tldI) : "";
    return `<code class="tpr-url"><span class="u-sch">${esc(u.protocol)}//</span>${u.username ? `<span class="u-bad">${esc(u.username + (u.password ? ":" + u.password : ""))}@</span>` : ""}<span class="u-sub">${esc(sub)}</span><span class="u-reg">${esc(name)}</span><span class="u-tld">${esc(tld)}</span>${u.port ? `<span class="u-port">:${esc(u.port)}</span>` : ""}<span class="u-path">${esc(u.pathname)}</span><span class="u-q">${esc(u.search)}</span><span class="u-q">${esc(u.hash)}</span></code>`;
};
function lexicalSignals(raw) {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw);
    const host = u.hostname.toLowerCase(), uni = toUnicodeHost(host), reg = regDomain(host), tld = host.split(".").pop(), sub = host.slice(0, Math.max(0, host.length - reg.length)).replace(/\.$/, "");
    const label = reg.split(".")[0], S = [], add = (sev, title, why, w) => S.push({ sev, title, why, w: w || 0 });
    const brands = [];
    if (u.protocol !== "https:") add("high", "Connection is not encrypted (HTTP)", "Anything you type can be read or changed on the way. Real banks and wallets always use HTTPS. Phishing kits are often (but not always) HTTPS too, so a padlock alone proves nothing.", 14);
    else add("good", "Uses HTTPS", "The connection is encrypted. This only protects the connection, it does NOT prove the site is honest.", 0);
    if (isIPv4(host) || /^(0x[0-9a-f]+|\d{8,10})$/i.test(host)) add("critical", "Website address is a bare IP number", "Legitimate brands use names, not numbers. Scammers use raw IPs to avoid registering a domain that can be reported and taken down.", 28);
    if (u.username || u.password) add("critical", "Contains a hidden login part (the @ trick)", "In http://trusted.com@evil.com the real site is the part AFTER the @. Criminals put a trusted name first to fool a quick glance.", 32);
    if (/^xn--|\.xn--/.test(host)) add("critical", "Uses international characters (punycode)", `The real host is "${uni}". Look-alike letters from other alphabets can make a fake address appear identical to a real one.`, 26);
    const sc = scriptsIn(uni).filter(x => x !== "Latin"); if (sc.length && scriptsIn(uni).includes("Latin") || sc.includes("Cyrillic") || sc.includes("Greek")) add("critical", "Mixes alphabets (homograph attack)", `Letters from ${sc.join(", ") || "another"} script appear in the address. Cyrillic 'а' looks exactly like Latin 'a' but is a different character.`, 30);
    if (SHORTENERS.includes(host)) add("high", "Link shortener hides the real destination", "You cannot see where this goes. Shorteners are used to bypass filters and hide look-alike domains.", 20);
    if (FREE_HOSTS.some(f => host === f || host.endsWith("." + f))) add("medium", "Hosted on a free/shared website platform", "Anyone can publish a page here in minutes. Scam pages often live on free platforms. A real bank or wallet would use its own domain.", 14);
    if (BAD_TLDS.includes(tld)) add("high", `High-abuse domain ending .${tld}`, "Some endings are very cheap and heavily abused by scammers and malware distributors. Not every site with this ending is bad, but most real brands do not use them.", 16);
    const depth = sub ? sub.split(".").length : 0; if (depth >= 3) add("medium", `Very deep subdomain chain (${depth} levels)`, "Criminals stack words like login.secure.account.bank-name.evil.com so the brand name appears at the start while the real domain is the end part.", 12);
    if ((host.match(/-/g) || []).length >= 3) add("medium", "Many hyphens in the domain", "Hyphen-heavy names such as easypaisa-secure-login-verify.com are typical of throwaway phishing domains.", 10);
    const ent = entropyOf(label); if (label.length >= 10 && ent > 3.35 && !/[aeiou]{2}/.test(label)) add("medium", "Domain name looks randomly generated", `The name "${label}" has high randomness (${ent.toFixed(2)} bits/char). Auto-generated domains are used for disposable phishing and malware infrastructure.`, 12);
    const dig = (label.match(/\d/g) || []).length; if (dig >= 4) add("low", "Lots of digits in the domain name", "Numbers in the name are common for bulk-registered scam domains.", 6);
    if (u.port && !["80", "443", ""].includes(u.port)) add("medium", `Unusual port :${u.port}`, "Normal sites use the default web ports. A custom port suggests a temporary server or tunnel.", 10);
    if (/\.(apk|exe|scr|bat|msi|jar|vbs|ps1|dmg|cmd|com|lnk|js)(\?|$)/i.test(u.pathname)) add("critical", "Link downloads a program or app", "Clicking may start a download of an installer or APK. Never install files from unknown links: they can steal OTPs, SMS and passwords.", 28);
    if (/(^|[?&])(url|redirect|redirect_uri|next|return|returnurl|goto|dest|destination|continue|link|target)=https?(:|%3a)/i.test(u.search)) add("high", "Contains a hidden redirect to another site", "The page may bounce you to a different address. Open-redirect links are used to make a bad link look like it belongs to a good site.", 18);
    if (/%2f%2f|\/\/.*https?:\/\//i.test(u.pathname + u.search)) add("medium", "Another web address is embedded inside the link", "A second URL inside the first is often used to disguise the real destination.", 8);
    if (/[A-Za-z0-9+/]{40,}={0,2}/.test(u.search)) add("low", "Long encoded value in the link", "Long random-looking data may hide tracking, a victim ID or an encoded redirect.", 6);
    const kw = (u.pathname + " " + u.search + " " + sub).match(PATH_KW); if (kw) add("medium", `Pressure/lure keywords: "${kw[0]}"`, "Words like login, verify, bonus, claim or refund in the link are classic social-engineering bait, especially on a domain you do not recognise.", 12);
    if (u.href.length > 160) add("low", `Very long URL (${u.href.length} characters)`, "Long links can hide the real destination at the end of the visible part.", 6);
    /* brand impersonation */
    const tokens = host.split(/[.\-_]/).filter(Boolean), normLabel = CONFUSE(label);
    Object.keys(OFFICIAL).forEach(b => {
        const official = OFFICIAL[b].some(d => reg === d || reg.endsWith("." + d));
        const hit = tokens.some(t => t === b) || (b.length >= 5 && host.includes(b)), typo = b.length >= 5 && !tokens.includes(b) && (lev(normLabel, b) <= 1 || lev(label, b) === 1) && label !== b;
        const confu = b.length >= 4 && normLabel.includes(b) && !label.includes(b);
        if (official) { if (hit) brands.push({ b, ok: true }); return; }
        if (hit) { brands.push({ b, ok: false, how: "uses the brand name" }); }
        else if (typo || confu) brands.push({ b, ok: false, how: typo ? "is a misspelling of the brand" : "swaps look-alike characters (0↔o, rn↔m, 1↔l)" });
    });
    const fake = brands.find(x => !x.ok), real = brands.find(x => x.ok);
    if (fake) add("critical", `Pretends to be "${fake.b}" but is NOT its official domain`, `This address ${fake.how}, yet the real ${fake.b} only uses: ${OFFICIAL[fake.b].join(", ")}. The domain you are on is "${reg}". This is the strongest sign of a phishing page.`, 38);
    else if (real) add("good", `Domain matches the official ${real.b} domain`, `${reg} is one of ${real.b}'s official domains. Still check the exact spelling before entering anything.`, 0);
    const official = !!real && !fake;
    return { u, host, uni, reg, tld, sub, label, S, brands, fake, real, official, ent };
}
async function deepUrl(raw) {
    const L = lexicalSignals(raw), { u, host, reg } = L, S = L.S;
    const isIPh = isIP(host);
    const [age, ips, ct, hs, sb] = await Promise.all([
        isIPh ? null : raceT(rdapDomain(host), 11000),
        isIPh ? Promise.resolve([host]) : resolveIPs(host).catch(() => null),
        isIPh ? null : raceT(ctCerts(host).catch(() => null), 12000),
        raceT(new Promise(res => { const t0 = performance.now(); fetch(u.protocol === "http:" ? u.href : `https://${host}/`, { mode: "no-cors", cache: "no-store" }).then(() => res({ ok: true, ms: Math.round(performance.now() - t0) })).catch(() => res({ ok: false })); }), 9000),
        safeBrowsing(u.href)
    ]);
    const ip0 = (ips || []).find(isIPv4) || (ips || [])[0];
    const [geo, idb, ptr, rdapIp] = ip0 && !privateKind(ip0) ? await Promise.all([raceT(ipwho(ip0).catch(() => null), 9000), raceT(internetDb(ip0).catch(() => null), 9000), isIPv4(ip0) ? raceT(dnsQuery(ip0.split(".").reverse().join(".") + ".in-addr.arpa", "PTR").catch(() => null), 7000) : null, null]) : [null, null, null, null];
    /* online signals */
    const add = (sev, title, why, w) => S.push({ sev, title, why, w: w || 0 });
    if (age && age.created) {
        const days = Math.floor((Date.now() - new Date(age.created)) / 864e5);
        if (days < 30) add("critical", `Domain registered only ${days} day${days === 1 ? "" : "s"} ago`, "Brand-new domains are the #1 sign of phishing. Real banks and wallets have been online for years. Scam sites are usually reported and shut down within days, so criminals keep registering fresh ones.", 36);
        else if (days < 180) add("high", `Domain is young (${days} days old)`, "Young domains deserve extra suspicion, especially if the page asks for money, passwords or OTPs.", 18);
        else if (days < 365) add("low", `Domain is under a year old (${days} days)`, "Not alarming by itself, but combine this with other signals.", 6);
        else add("good", `Domain has existed for ${(days / 365).toFixed(1)} years`, "Long-lived domains are less likely to be throwaway scam sites (though hacked sites exist).", 0);
        if (age.expires) { const left = Math.floor((new Date(age.expires) - Date.now()) / 864e5); if (left >= 0 && left < 100 && days < 400) add("low", `Registration expires in ${left} days`, "Short registrations (1 year, not renewed for long) are typical of disposable domains.", 4); }
    } else if (!isIPh) add("info", "Domain age unavailable", "This ending has no public registration (RDAP) data, so age could not be checked. Be extra careful.", 0);
    if (ips === null || (Array.isArray(ips) && !ips.length)) add("high", "Domain does not resolve to any server", "The name currently points nowhere. It may be offline (already taken down), mistyped or not yet activated by the attacker.", 10);
    if (geo) {
        const org = (geo.connection && (geo.connection.org || geo.connection.isp)) || "";
        if (HOSTING_RE.test(org)) add("info", `Hosted on a cloud/hosting provider (${org})`, "Most websites (good and bad) use hosting companies. This is normal on its own.", 0);
        const ccGov = /\.gov\.pk$|\.edu\.pk$|\.com\.pk$|\.pk$/.test(host);
        if (ccGov && geo.country_code && geo.country_code !== "PK") add("medium", `.pk website hosted outside Pakistan (${geo.country})`, "Many genuine Pakistani sites are hosted abroad, but a .pk look-alike hosted in an unrelated country is worth checking.", 6);
    }
    if (idb && !idb.notFound) { if ((idb.vulns || []).length) add("medium", `Server has ${idb.vulns.length} known vulnerabilities`, "The server software is outdated or unpatched. Attackers often hack such servers to host phishing pages.", 8); if ((idb.tags || []).some(t => /malware|c2|compromised|scanner|botnet/i.test(t))) add("critical", "Server flagged in threat intelligence", `Shodan tags: ${idb.tags.join(", ")}`, 30); }
    if (ct && ct.length) {
        const sorted = [...ct].sort((a, b) => a.from - b.from), first = sorted[0], latest = [...ct].sort((a, b) => b.from - a.from)[0], dAge = Math.floor((Date.now() - first.from) / 864e5);
        if (dAge < 14) add("high", `First HTTPS certificate was issued only ${dAge} days ago`, "Certificate Transparency logs show this name got its first certificate very recently, which fits a freshly built phishing site.", 14);
        if (/let'?s encrypt|zerossl|r3|e1|google trust services.*(we|wr)/i.test(latest.issuer) && !L.official) add("info", `Certificate from ${latest.issuer} (free, automatic)`, "Free certificates prove only that someone controls the domain, not that the business is real. Banks usually use organisation-validated certificates.", 0);
    }
    if (!hs.ok && u.protocol === "https:" && ips && ips.length) add("high", "Browser could not complete a secure connection", "The HTTPS handshake failed. The site may have an invalid or expired certificate, block your region, or be offline. Do not bypass certificate warnings.", 12);
    if (Array.isArray(sb)) { if (sb.length) add("critical", `Listed by Google Safe Browsing: ${sb.join(", ")}`, "Google has flagged this address as dangerous. Do not open it.", 100); else add("good", "Not listed by Google Safe Browsing", "No match in Google's current blocklist. New scam pages often appear before they are listed.", 0); }
    /* verdict */
    let score = S.reduce((a, s) => a + (s.w || 0), 0); if (L.official && score < 40) score = Math.min(score, 8); score = Math.min(100, score);
    if (Array.isArray(sb) && sb.length) score = 100;
    const vt = score >= 80 ? ["DANGEROUS - DO NOT OPEN", "danger", "🚨", "bad"] : score >= 60 ? ["LIKELY A SCAM", "danger", "🚨", "bad"] : score >= 35 ? ["SUSPICIOUS - VERIFY FIRST", "warning", "⚠️", "warn"] : score >= 15 ? ["SLIGHTLY SUSPICIOUS", "warning", "🤔", "warn"] : ["NO WARNING SIGNS FOUND", "success", "🛡️", "ok"];
    const text = decodeURIComponent((u.pathname + " " + u.search + " " + host).replace(/\+/g, " ")).toLowerCase();
    const type = SCAM_TYPES.find(([re]) => re.test(text)) || null;
    return { L, S: S.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]), score, vt, type, age, ips, geo, idb, ptr, ct, hs, sb, ip0 };
}
window.inspectURL = async function () {
    const raw = val("urlInput"); if (!raw) return fail("urlResult", "Enter a URL to inspect.");
    try { new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "https://" + raw); } catch (_) { return fail("urlResult", "Invalid URL format."); }
    busy("urlResult", "Deep scan: URL anatomy, brand check, domain age, DNS, server location, certificate, Safe Browsing…");
    let R; try { R = await deepUrl(raw); } catch (e) { return fail("urlResult", "Could not analyse this link.", "warning"); }
    const { L, S, score, vt, type, age, ips, geo, idb, ptr, ct, hs, ip0 } = R, { u, host, reg } = L;
    const bad = S.filter(s => ["critical", "high", "medium"].includes(s.sev));
    const summary = verdict(vt[2], vt[0], vt[1], `Risk score ${score}/100 · ${esc(reg)}`) + meter(score, vt[3]) +
        kv([type ? ["Looks like", `<b>${esc(type[1])}</b>`] : null, L.fake ? ["Pretends to be", badge(L.fake.b.toUpperCase() + " (fake)", "danger")] : (L.real ? ["Brand", badge(L.real.b + " (official domain)", "ok")] : null), ["Domain age", age && age.created ? badge(Math.floor((Date.now() - new Date(age.created)) / 864e5) + " days", Math.floor((Date.now() - new Date(age.created)) / 864e5) < 180 ? "danger" : "ok") : "unknown"], ["Server", geo ? `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "?")} · ${esc(geo.connection?.org || "")}` : "unknown"]]) +
        (bad.length ? `<div class="tp-sub">Top reasons</div>` + rList(bad.slice(0, 4).map(s => `<b>${esc(s.title)}</b>`), "tpr-mini") : note("No obvious red flags. This is not proof the site is safe."));
    /* full report */
    let h = rHero(vt[2], vt[0], `${esc(host)} · ${S.filter(s => ["critical", "high"].includes(s.sev)).length} serious warning(s) · ${S.length} checks`, vt[3], rGauge(score, "risk score", vt[3]));
    h += rSec("🧾", "The verdict, explained", rPara(score >= 60 ? "<b>This link shows several strong scam indicators.</b> Do not enter passwords, PINs, OTPs, card details or CNIC numbers, and do not install anything from it." : score >= 35 ? "<b>This link is suspicious.</b> There are warning signs. Verify through an official channel before doing anything." : score >= 15 ? "A few minor warning signs were found. Compare the address carefully with the real brand's address." : "We found no strong warning signs, but <b>no tool can prove a link is safe</b>. Stay alert if the page asks for money or secrets.") +
        rTiles([["Risk score", `<b>${score}</b>/100`], type ? ["Most likely scam type", esc(type[1])] : null, L.fake ? ["Impersonated brand", esc(L.fake.b)] : null, L.fake ? ["Brand's REAL website", esc(OFFICIAL[L.fake.b][0])] : null, ["Checks performed", String(S.length + 6)]]) + (type ? rPara(`<b>What this scam tries to do:</b> ${esc(type[2])}`) : ""));
    h += rSec("🔬", "URL anatomy (what each part means)", rPara("Colour guide: " + `<span class="u-sub">subdomain</span> · <span class="u-reg">registered name (who really owns it)</span> · <span class="u-tld">ending</span> · <span class="u-path">path</span> · <span class="u-q">query</span>`) + colorUrl(u, reg, host) +
        rTiles([["Protocol", esc(u.protocol.replace(":", "")), u.protocol === "https:" ? "encrypted" : "NOT encrypted"], ["Real domain", code(reg), "this is who owns the site"], ["Subdomain", L.sub ? code(L.sub) : "none"], ["Ending (TLD)", "." + esc(L.tld), BAD_TLDS.includes(L.tld) ? "often abused" : ""], L.uni !== host ? ["Unicode form", code(L.uni)] : null, ["Port", esc(u.port || "default")], ["Path", code(u.pathname.slice(0, 60) || "/")], ["Name randomness", L.ent.toFixed(2) + " bits"]]) +
        ([...u.searchParams.entries()].length ? rTable(["Parameter", "Value"], [...u.searchParams.entries()].slice(0, 15).map(([k, v]) => [code(k), code(v.slice(0, 90))])) : ""));
    h += rSec("🚦", "Every check, with the reason", S.map(rSignal).join(""), "tpr-signals");
    h += rSec("📅", "Domain registration (RDAP)", age ? rTiles([["Registered", fmtDate(age.created), age.created ? Math.floor((Date.now() - new Date(age.created)) / 864e5) + " days ago" : ""], ["Last changed", fmtDate(age.updated)], ["Expires", fmtDate(age.expires)], ["Registrar", esc(age.registrar || "—")], ["Status", esc((age.status || []).slice(0, 3).join(", ") || "—")], ["Name servers", esc((age.ns || []).slice(0, 3).join(", ") || "—")], ["DNSSEC", age.dnssec ? badge("signed", "ok") : badge("not signed", "info")]]) : rPara("Registration data is not publicly available for this ending, or the lookup timed out."));
    h += rSec("🖥️", "Where the server is", geo ? rTiles([["IP address", code(ip0)], ["Country", `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "—")}`], ["City / region", esc((geo.city || "—") + " / " + (geo.region || "—"))], ["Network (ASN)", geo.connection?.asn ? code("AS" + geo.connection.asn) : "—"], ["Hosting company", esc(geo.connection?.org || geo.connection?.isp || "—")], ["Reverse DNS", ptr && ptr.Answer ? code(ptr.Answer[0].data.replace(/\.$/, "")) : "—"], idb && !idb.notFound ? ["Open ports seen", (idb.ports || []).slice(0, 8).map(p => badge(p, RISKY_PORTS.has(p) ? "danger" : "info")).join("") || "—"] : null, idb && (idb.vulns || []).length ? ["Known CVEs", chips(idb.vulns.slice(0, 6), "danger")] : null]) + ((ips || []).length > 1 ? rPara("All addresses: " + (ips || []).map(code).join(" ")) : "") : rPara("Server location could not be determined (the name does not resolve or the lookup service was unreachable)."));
    h += rSec("🔒", "Security certificate history", ct && ct.length ? rTable(["Issued", "Expires", "Issuer", "Names covered"], [...ct].sort((a, b) => b.from - a.from).slice(0, 6).map(c => [fmtDate(c.from), fmtDate(c.to), esc(c.issuer), String(c.names.length)])) + rPara("Certificate Transparency logs are public. A brand-new certificate for a name that pretends to be an old brand is a warning sign.") : rPara("No certificate history was found, or the log service was slow." + (hs.ok ? "" : " The browser's own HTTPS test also failed.")));
    const enc = encodeURIComponent(u.href);
    h += rSec("🧰", "Double-check it yourself (safe links)", `<div class="tpr-links">${[["VirusTotal URL scan", "https://www.virustotal.com/gui/search/" + enc], ["Google Safe Browsing status", "https://transparencyreport.google.com/safe-browsing/search?url=" + enc], ["urlscan.io search", "https://urlscan.io/search/#" + encodeURIComponent(host)], ["WHOIS for " + reg, "https://who.is/whois/" + encodeURIComponent(reg)], ["Report phishing to Google", "https://safebrowsing.google.com/safebrowsing/report_phish/"]].map(([t, x]) => `<a href="${x}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`).join("")}</div>` + rPara("Do not paste the link into the browser address bar to \"test\" it. Use the safe links above."));
    h += rSec("✅", "What to do now", rSteps(score >= 35 ? ["<b>Do not open or share the link.</b> If it came by SMS/WhatsApp, block the sender.", L.fake ? `<b>Go to ${esc(L.fake.b)} yourself:</b> type <code>${esc(OFFICIAL[L.fake.b][0])}</code> in the browser or open its official app.` : "<b>Open the real service yourself</b> by typing its official address or using its app, never through this link.", "<b>Never enter</b> passwords, PINs, OTPs, card or CNIC details on a page you reached from a message.", "<b>Report it:</b> forward to your bank/wallet's official helpline and report to FIA NR3C (helpline 1991).", "<b>Warn others</b> who received the same message."] : ["Open the service by typing its address yourself if you can.", "Check the padlock and the exact spelling of the domain.", "Do not enter secrets unless you started the visit yourself.", "Keep your browser and phone updated."]));
    h += rSec("🆘", "If you already clicked or entered data", rSteps(["<b>Entered a password?</b> Change it now on the real site and anywhere you reused it. Turn on 2-Step Verification.", "<b>Entered card/PIN/OTP?</b> Call your bank on the number printed on your card and block the card/account immediately.", "<b>Installed an app/APK?</b> Turn on airplane mode, uninstall it, run Play Protect scan, then change passwords from another device.", "<b>Shared CNIC photo?</b> Report to FIA NR3C and watch for new SIM/accounts in your name."]));
    h += rPara("<small>Method: lexical analysis, brand comparison, RDAP registration data, DNS (Google), IP intelligence (ipwho.is / Shodan InternetDB), Certificate Transparency logs and optional Google Safe Browsing. Results show risk indicators, not a legal verdict.</small>");
    setR("urlResult", "url", "Link & domain deep report", u.href.slice(0, 90), summary, h, vt[1]);
};

/* ============================================================
   PORT / SERVICE KNOWLEDGE BASE  (used by IP, Port, Honeypot reports)
   ============================================================ */
const PORT_INFO = {
    21: ["FTP", "File transfer. Sends usernames and passwords as readable text.", "high", "Replace with SFTP/FTPS or close the port. Restrict by IP."],
    22: ["SSH", "Secure remote login. Constantly brute-forced by bots.", "medium", "Use key-based login only, disable root login, add fail2ban, change nothing else."],
    23: ["Telnet", "Old remote login with no encryption. Mirai-style botnets hunt for it.", "critical", "Disable Telnet completely and use SSH."],
    25: ["SMTP", "Mail delivery. An open relay can be abused to send spam.", "medium", "Require authentication and restrict relaying."],
    53: ["DNS", "Domain name service. Open resolvers are used in DDoS amplification.", "medium", "Disable recursion for outsiders."],
    80: ["HTTP", "Normal website traffic without encryption.", "low", "Redirect everything to HTTPS and add HSTS."],
    110: ["POP3", "Email download in plain text.", "medium", "Use POP3S (995) only."],
    111: ["RPC", "Remote procedure service that leaks internal details.", "high", "Block from the internet."],
    123: ["NTP", "Time service. Old versions are abused for DDoS amplification.", "low", "Patch and restrict queries."],
    135: ["MS-RPC", "Windows remote procedure calls. A classic worm and ransomware path.", "critical", "Never expose to the internet."],
    139: ["NetBIOS", "Windows file sharing (legacy). Leaks names and shares.", "critical", "Block at the firewall."],
    143: ["IMAP", "Email access in plain text.", "medium", "Use IMAPS (993) only."],
    161: ["SNMP", "Device monitoring. Default community strings leak everything.", "high", "Use SNMPv3 and restrict to your network."],
    389: ["LDAP", "Directory service holding user accounts.", "high", "Never expose; use LDAPS inside a VPN."],
    443: ["HTTPS", "Encrypted website traffic.", "low", "Keep TLS modern and certificates valid."],
    445: ["SMB", "Windows file sharing. EternalBlue/WannaCry used this port.", "critical", "Never expose to the internet. Patch and block."],
    465: ["SMTPS", "Encrypted mail submission.", "low", "Require authentication."],
    500: ["IPsec/IKE", "VPN negotiation.", "low", "Use strong pre-shared keys / certificates."],
    587: ["SMTP submit", "Authenticated mail submission.", "low", "Require TLS and authentication."],
    631: ["IPP", "Printer sharing.", "medium", "Keep printers off the internet."],
    993: ["IMAPS", "Encrypted email access.", "low", "Use strong passwords and 2FA."],
    995: ["POP3S", "Encrypted email download.", "low", "Use strong passwords."],
    1080: ["SOCKS", "Proxy service. Open proxies are abused by criminals.", "high", "Require authentication or close."],
    1433: ["MS SQL", "Microsoft database. Exposed databases get hijacked or ransomed.", "critical", "Never expose; allow only app servers."],
    1521: ["Oracle DB", "Oracle database listener.", "critical", "Never expose to the internet."],
    1723: ["PPTP VPN", "Old VPN protocol with known weaknesses.", "high", "Replace with WireGuard/OpenVPN/IPsec."],
    1883: ["MQTT", "IoT messaging. Often runs without a password.", "high", "Enable authentication and TLS."],
    2049: ["NFS", "Network file shares.", "high", "Block from the internet."],
    2375: ["Docker API", "Unauthenticated control of containers = full server takeover.", "critical", "Never expose; use TLS-protected socket."],
    3000: ["Dev server", "Developer web server (Node/Grafana) left open.", "medium", "Put behind a reverse proxy with authentication."],
    3306: ["MySQL", "Database. Exposed instances get dumped and ransomed.", "critical", "Bind to localhost / private network only."],
    3389: ["RDP", "Windows remote desktop. The #1 entry point for ransomware.", "critical", "Never expose. Use a VPN + MFA."],
    5000: ["UPnP / dev", "Device or dev web service.", "medium", "Restrict access."],
    5060: ["SIP", "VoIP signalling. Toll-fraud and spam-call abuse.", "medium", "Restrict to trusted carriers."],
    5432: ["PostgreSQL", "Database server.", "critical", "Bind to private network only."],
    5555: ["ADB", "Android Debug Bridge: full device control with no password.", "critical", "Disable ADB over network."],
    5900: ["VNC", "Remote screen control, often with weak passwords.", "high", "Tunnel through VPN/SSH."],
    5985: ["WinRM", "Windows remote management.", "high", "Restrict to admin networks."],
    6379: ["Redis", "In-memory database, often with no password. Easily hijacked.", "critical", "Bind to localhost and set a password."],
    7547: ["TR-069", "ISP router management. Exploited by Mirai variants.", "high", "ISP should restrict to their servers."],
    8000: ["HTTP-alt", "Alternative web server / dev tool.", "medium", "Check what is running there."],
    8008: ["HTTP-alt", "Alternative web server.", "medium", "Check what is running there."],
    8080: ["HTTP proxy/alt", "Alternative web port, admin panels and proxies.", "medium", "Protect admin panels with authentication."],
    8081: ["HTTP-alt", "Alternative web server or admin panel.", "medium", "Check what is running there."],
    8443: ["HTTPS-alt", "Alternative HTTPS port, often admin consoles.", "medium", "Restrict admin access."],
    8888: ["HTTP-alt", "Notebook / dev tools / admin panels.", "medium", "Require authentication."],
    9000: ["Service", "Application or admin service (PHP-FPM, SonarQube).", "medium", "Do not expose backend services."],
    9100: ["JetDirect", "Printer raw printing.", "medium", "Keep printers off the internet."],
    9200: ["Elasticsearch", "Search database with no login by default. Huge data leaks.", "critical", "Never expose; enable security."],
    11211: ["Memcached", "Cache server abused for massive DDoS amplification.", "critical", "Bind to localhost."],
    27017: ["MongoDB", "Database frequently found open with no password.", "critical", "Enable auth and bind to private network."],
    50000: ["SAP/Service", "Enterprise application port.", "medium", "Restrict access."]
};
const portRows = ports => ports.map(p => { const i = PORT_INFO[p] || [PORT_NAMES[p] || "Unknown", "Service not in our knowledge base.", "info", "Identify what is running and close it if not needed."]; return { p, name: i[0], what: i[1], sev: i[2], fix: i[3] }; }).sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || a.p - b.p);
const portTable = ports => rTable(["Port", "Service", "What it is / why it matters", "Risk", "How to fix"], portRows(ports).map(r => [code(r.p), `<b>${esc(r.name)}</b>`, esc(r.what), badge(SEV_LABEL[r.sev] || r.sev, r.sev === "critical" || r.sev === "high" ? "danger" : r.sev === "medium" ? "warn" : r.sev === "low" ? "ok" : "info"), esc(r.fix)]));

/* ============================================================
   IP DEEP INTELLIGENCE
   ============================================================ */
function flattenEntities(arr, out = []) { (arr || []).forEach(e => { out.push(e); flattenEntities(e.entities, out); }); return out; }
async function rdapIp(ip) {
    try {
        const d = await getJson(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { timeout: 10000 });
        const ents = flattenEntities(d.entities), abuse = ents.find(e => (e.roles || []).includes("abuse")), org = ents.find(e => (e.roles || []).some(r => /registrant|administrative|technical/.test(r)));
        const em = x => x?.vcardArray?.[1]?.find(v => v[0] === "email")?.[3], fn = x => x?.vcardArray?.[1]?.find(v => v[0] === "fn")?.[3];
        return { name: d.name, handle: d.handle, range: d.startAddress && d.endAddress ? `${d.startAddress} – ${d.endAddress}` : "", cidr: (d.cidr0_cidrs || []).map(c => `${c.v4prefix || c.v6prefix}/${c.length}`).join(", "), country: d.country, type: d.type, abuse: em(abuse), org: fn(org) || fn(abuse), updated: (d.events || []).find(e => /last changed/i.test(e.eventAction))?.eventDate };
    } catch (_) { return null; }
}
window.lookupIP = async function () {
    let q = val("ipInput"), host = "";
    busy("ipResult", "Deep scan: location, network owner, abuse contact, open ports, reputation, distance…");
    try {
        let ips = [];
        if (q) { host = parseHost(q); if (!isIP(host)) { ips = await resolveIPs(host); if (!ips.length) return fail("ipResult", "Domain does not resolve to an IP.", "warning"); q = ips.find(isIPv4) || ips[0]; } else q = host; }
        const pk = q && privateKind(q);
        if (pk) {
            const rows = [["Private (10.", "10.0.0.0/8: large organisations and home routers"], ["Private (172.", "172.16.0.0/12: company and cloud internal networks"], ["Private (192.", "192.168.0.0/16: typical home Wi-Fi networks"], ["Loopback", "127.0.0.0/8: your own computer talking to itself"], ["Link-local", "169.254.0.0/16: no DHCP answered, device assigned itself an address"], ["Carrier", "100.64.0.0/10: your mobile/ISP shares one public IP among many users (CGNAT)"]];
            const exp = (rows.find(r => pk.startsWith(r[0])) || ["", "Reserved range, not routed on the public internet."])[1];
            return set("ipResult", verdict("🏠", "Private / non-public address", "info", esc(q)) + kv([["Range type", badge(pk, "info")], ["What it means", esc(exp)]]) + note("Private addresses cannot be located. Only your router's public IP is visible to websites. Leave the box empty to see your own public IP."), "info");
        }
        const [meR, gR] = await Promise.allSettled([q ? raceT(ipwho("").catch(() => null), 8000) : Promise.resolve(null), ipwho(q)]);
        if (gR.status !== "fulfilled") throw new Error("ipwho");
        const g = gR.value, me = meR.status === "fulfilled" ? meR.value : null, ip = g.ip;
        const [dbR, ptrR, rdR] = await Promise.allSettled([internetDb(ip), isIPv4(ip) ? dnsQuery(ip.split(".").reverse().join(".") + ".in-addr.arpa", "PTR") : Promise.resolve({}), rdapIp(ip)]);
        const d = dbR.status === "fulfilled" ? dbR.value : null, rev = ptrR.status === "fulfilled" ? (ptrR.value.Answer || []).map(a => a.data.replace(/\.$/, "")) : [], rd = rdR.status === "fulfilled" ? rdR.value : null;
        const org = g.connection?.org || g.connection?.isp || "", isHost = HOSTING_RE.test(org), isVpn = VPN_RE.test(org + " " + (g.connection?.domain || ""));
        const ports = d && !d.notFound ? d.ports : [], risky = ports.filter(p => RISKY_PORTS.has(p)), cves = d && d.vulns ? d.vulns : [], tags = d && d.tags ? d.tags : [];
        const badTag = tags.some(t => /malware|c2|scanner|tor|compromised|botnet|vpn|proxy/i.test(t));
        let risk = Math.min(30, cves.length * 4) + Math.min(24, risky.length * 8) + (badTag ? 30 : 0) + (isVpn ? 8 : 0) + (isHost ? 4 : 0); risk = Math.min(100, risk);
        const k = risk >= 55 ? "danger" : risk >= 20 ? "warning" : "success", kk = k === "danger" ? "bad" : k === "warning" ? "warn" : "ok";
        const km = me && me.latitude != null && g.latitude != null ? Math.round(haversine(me.latitude, me.longitude, g.latitude, g.longitude)) : null;
        let local = ""; try { local = new Date().toLocaleString("en-GB", { timeZone: g.timezone?.id, weekday: "short", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }); } catch (_) { }
        const kind = isVpn ? "VPN / proxy / anonymiser network" : isHost ? "Data-centre / cloud hosting (servers, not a home user)" : "Likely residential or business ISP";
        /* summary */
        const summary = verdict(g.flag?.emoji || "📍", `${esc(ip)} · ${esc(g.city || g.country || "")}`, k, host ? `from ${esc(host)}` : q ? "" : "your public IP") +
            kv([["Location", esc(`${g.city || "—"}, ${g.region || "—"}, ${g.country || "—"}`)], ["Network owner", esc(org || "—") + (g.connection?.asn ? ` <small>(AS${esc(g.connection.asn)})</small>` : "")], ["Type", badge(kind.split("(")[0].trim(), isVpn ? "warn" : isHost ? "info" : "ok")], km != null ? ["Distance from you", num(km) + " km"] : null, local ? ["Local time there", esc(local)] : null, ports.length ? ["Open ports", ports.slice(0, 6).map(p => badge(p, RISKY_PORTS.has(p) ? "danger" : "info")).join("")] : null, cves.length ? ["Known CVEs", chips(cves.slice(0, 4), "danger")] : null]);
        /* report */
        let h = rHero(g.flag?.emoji || "📍", `${esc(ip)}`, `${esc(g.city || "")}${g.city ? ", " : ""}${esc(g.country || "")} · ${esc(org || "unknown network")}`, kk, rGauge(risk, "exposure risk", kk));
        h += rSec("📍", "Where is this IP?", rTiles([["Country", `${esc(g.flag?.emoji || "")} ${esc(g.country || "—")}`, esc(g.continent || "")], ["Region / city", esc((g.region || "—") + " / " + (g.city || "—"))], ["Postal code", esc(g.postal || "—")], ["Capital of country", esc(g.capital || "—")], ["Coordinates", g.latitude != null ? code(g.latitude + ", " + g.longitude) : "—"], ["Time zone", esc(g.timezone?.id || "—"), esc(g.timezone?.utc || "")], ["Local time now", esc(local || "—")], ["Calling code", g.calling_code ? "+" + esc(g.calling_code) : "—"], g.currency ? ["Currency", esc((g.currency.code || "") + " " + (g.currency.name || ""))] : null, ["EU country", g.is_eu ? "Yes" : "No"], km != null ? ["Distance from you", num(km) + " km", `minimum possible ping ≈ ${Math.max(1, Math.round(km / 100))} ms`] : null]) +
            (g.latitude != null ? `<iframe class="tpr-map" loading="lazy" title="Map" src="https://www.openstreetmap.org/export/embed.html?bbox=${g.longitude - 0.6}%2C${g.latitude - 0.4}%2C${+g.longitude + 0.6}%2C${+g.latitude + 0.4}&layer=mapnik&marker=${g.latitude}%2C${g.longitude}"></iframe>` + rPara(link(`https://www.openstreetmap.org/?mlat=${g.latitude}&mlon=${g.longitude}#map=10/${g.latitude}/${g.longitude}`, "Open full map")) : "") + rPara("<small>IP geolocation is approximate (usually city level) and shows where the network is registered/served, not an exact address.</small>"));
        h += rSec("🏢", "Who owns this IP?", rTiles([["Network (ISP / org)", esc(org || "—")], ["ASN", g.connection?.asn ? code("AS" + g.connection.asn) : "—"], ["Domain", esc(g.connection?.domain || "—")], ["Network name", esc(rd?.name || "—")], ["IP block", esc(rd?.cidr || rd?.range || "—")], ["Registered in", esc(rd?.country || "—")], ["Registrant", esc(rd?.org || "—")], ["Abuse contact", rd?.abuse ? code(rd.abuse) : "—"], ["Reverse DNS", rev.length ? code(rev[0]) : "none"], ["Classification", esc(kind)]]) + rPara(rd?.abuse ? `To report abuse from this IP, email <code>${esc(rd.abuse)}</code> with logs and timestamps.` : "Abuse contact not published via RDAP. Search the network name in WHOIS."));
        const sigs = [];
        if (isVpn) sigs.push({ sev: "medium", title: "VPN / proxy / anonymiser network", why: "Traffic from this IP is often hidden behind a privacy service. Banks may flag logins from such addresses." });
        if (isHost) sigs.push({ sev: "info", title: "Data-centre / cloud hosting address", why: "This IP belongs to a hosting company. Websites, bots and scanners live here. Ordinary people browsing from home do not." });
        if (!isHost && !isVpn) sigs.push({ sev: "good", title: "Looks like a normal ISP address", why: "No hosting, VPN or proxy signals were found." });
        if (cves.length) sigs.push({ sev: cves.length > 4 ? "high" : "medium", title: `${cves.length} known vulnerabilities on this host`, why: "Shodan sees software with public CVEs. Attackers actively scan for such hosts." });
        if (risky.length) sigs.push({ sev: "high", title: `${risky.length} high-risk service(s) exposed`, why: `Ports ${risky.join(", ")} should rarely be open to the whole internet.` });
        if (tags.length) sigs.push({ sev: badTag ? "critical" : "info", title: "Intelligence tags: " + tags.join(", "), why: "Tags come from internet-wide scanning (Shodan InternetDB)." });
        if (!sigs.some(s => s.sev === "high" || s.sev === "critical")) sigs.push({ sev: "good", title: "No serious exposure indicators", why: "No dangerous services or tags were seen. This is not a guarantee." });
        h += rSec("🛡️", "Reputation & risk signals", sigs.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).map(rSignal).join(""));
        h += rSec("🔌", "Open ports & services seen on the internet", ports.length ? portTable(ports) + (d.cpes && d.cpes.length ? rPara("Software detected: " + d.cpes.slice(0, 8).map(code).join(" ")) : "") : rPara(d && d.notFound ? "This IP is not in Shodan's index, meaning no open services were observed. That does not prove every port is closed." : "Port data unavailable right now."));
        if (cves.length) h += rSec("🐞", "Known vulnerabilities (CVE)", `<div class="tpr-links">${cves.slice(0, 24).map(c => `<a href="https://nvd.nist.gov/vuln/detail/${esc(c)}" target="_blank" rel="noopener noreferrer">${esc(c)} ↗</a>`).join("")}</div>` + rPara("Open a CVE to read what it allows and which patch fixes it."));
        h += rSec("🧭", "What to do with this information", rSteps(["<b>Suspicious login or message from this IP?</b> Note the time, then report it to the abuse contact above and to your bank/service.", "<b>Your own server?</b> Close every high-risk port listed and patch the CVEs.", "<b>Do not attack or scan IPs you do not own.</b> This report uses public intelligence only.", "<b>Cross-check:</b> " + link("https://www.abuseipdb.com/check/" + encodeURIComponent(ip), "AbuseIPDB") + " and " + link("https://www.shodan.io/host/" + encodeURIComponent(ip), "Shodan")]));
        setR("ipResult", "ip", "IP deep intelligence report", ip, summary, h, k);
    } catch (e) { fail("ipResult", "IP providers unavailable or rate-limited. No fake data shown.", "warning"); }
};

/* ============================================================
   BROWSER & DEVICE DEEP REPORT
   ============================================================ */
function webglDetails() {
    try {
        const c = document.createElement("canvas"), gl = c.getContext("webgl") || c.getContext("experimental-webgl"); if (!gl) return null;
        const e = gl.getExtension("WEBGL_debug_renderer_info");
        return { vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION), glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), ext: (gl.getSupportedExtensions() || []).length, hidden: !e };
    } catch (_) { return null; }
}
async function audioFp() {
    try {
        const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return "unsupported";
        const ctx = new C(1, 44100, 44100), osc = ctx.createOscillator(), comp = ctx.createDynamicsCompressor();
        osc.type = "triangle"; osc.frequency.value = 10000; osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
        const buf = await Promise.race([ctx.startRendering(), sleep(2500).then(() => null)]); if (!buf) return "timeout";
        let sum = 0; const ch = buf.getChannelData(0); for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);
        return (await sha1Hex(String(sum))).slice(0, 16);
    } catch (_) { return "blocked"; }
}
const FONT_LIST = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Tahoma", "Trebuchet MS", "Comic Sans MS", "Impact", "Segoe UI", "Calibri", "Cambria", "Consolas", "Helvetica", "Palatino", "Garamond", "Roboto", "Open Sans", "Noto Sans", "Ubuntu", "San Francisco", "Menlo", "Monaco", "Lucida Console", "Candara", "Gill Sans", "Futura", "Optima", "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Arabic Typesetting", "Mangal", "Nirmala UI", "Gadugi", "Bahnschrift", "Droid Sans", "Poppins"];
function detectFonts() {
    try {
        const c = document.createElement("canvas").getContext("2d"), base = ["monospace", "serif", "sans-serif"], txt = "mmmmmmmmmmlli@#Wq", w = {};
        base.forEach(b => { c.font = `72px ${b}`; w[b] = c.measureText(txt).width; });
        return FONT_LIST.filter(f => base.some(b => { c.font = `72px "${f}", ${b}`; return c.measureText(txt).width !== w[b]; }));
    } catch (_) { return []; }
}
async function permStates() {
    const out = {}; if (!navigator.permissions) return out;
    for (const n of ["geolocation", "notifications", "camera", "microphone", "clipboard-read", "persistent-storage"]) { try { out[n] = (await navigator.permissions.query({ name: n })).state; } catch (_) { } }
    return out;
}
async function adblockDetected() {
    try { const b = document.createElement("div"); b.className = "adsbox ad-banner ads advert pub_300x250"; b.style.cssText = "position:absolute;left:-999px;top:-999px;width:10px;height:10px"; document.body.appendChild(b); await sleep(120); const hid = b.offsetHeight === 0 || getComputedStyle(b).display === "none"; b.remove(); return hid; } catch (_) { return false; }
}
async function collectEnv() {
    const nav = navigator, d = {};
    d.ua = nav.userAgent; d.p = parseUA(d.ua); d.platform = nav.platform || "—"; d.langs = (nav.languages && nav.languages.length ? [...nav.languages] : [nav.language]).filter(Boolean);
    d.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; d.tzOff = -new Date().getTimezoneOffset() / 60;
    d.scr = { w: screen.width, h: screen.height, aw: screen.availWidth, ah: screen.availHeight, cd: screen.colorDepth, dpr: window.devicePixelRatio, iw: innerWidth, ih: innerHeight };
    d.cores = nav.hardwareConcurrency; d.mem = nav.deviceMemory; d.touch = nav.maxTouchPoints || 0;
    d.dnt = nav.doNotTrack === "1" || window.doNotTrack === "1"; d.gpc = !!nav.globalPrivacyControl; d.cookies = nav.cookieEnabled; d.webdriver = !!nav.webdriver; d.pdf = nav.pdfViewerEnabled; d.plugins = nav.plugins ? nav.plugins.length : 0;
    d.secure = !!window.isSecureContext; d.https = location.protocol === "https:"; d.online = nav.onLine;
    const c = nav.connection; d.conn = c ? { type: c.effectiveType, down: c.downlink, rtt: c.rtt, save: c.saveData } : null;
    const mq = q => { try { return matchMedia(q).matches; } catch (_) { return false; } };
    d.dark = mq("(prefers-color-scheme: dark)"); d.reduce = mq("(prefers-reduced-motion: reduce)"); d.hover = mq("(hover: hover)"); d.coarse = mq("(pointer: coarse)"); d.hdr = mq("(dynamic-range: high)"); d.p3 = mq("(color-gamut: p3)");
    d.webgl = webglDetails(); d.canvas = await canvasFp(); d.fonts = detectFonts();
    const rest = await Promise.allSettled([audioFp(), nav.userAgentData && nav.userAgentData.getHighEntropyValues ? nav.userAgentData.getHighEntropyValues(["platformVersion", "model", "architecture", "bitness", "fullVersionList"]) : Promise.resolve(null), permStates(), nav.getBattery ? nav.getBattery() : Promise.resolve(null), nav.storage && nav.storage.estimate ? nav.storage.estimate() : Promise.resolve(null), nav.mediaDevices && nav.mediaDevices.enumerateDevices ? nav.mediaDevices.enumerateDevices() : Promise.resolve([]), webrtcIPs(), adblockDetected(), raceT(ipwho("").catch(() => null), 8000)]);
    const v = i => rest[i].status === "fulfilled" ? rest[i].value : null;
    d.audio = v(0) || "blocked"; d.hints = v(1); d.perm = v(2) || {}; const bt = v(3); d.battery = bt ? { level: Math.round(bt.level * 100), charging: bt.charging } : null; d.storage = v(4); d.devices = (v(5) || []).reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {}); d.rtc = v(6); d.adblock = !!v(7); d.ip = v(8);
    d.voices = window.speechSynthesis ? (speechSynthesis.getVoices() || []).length : 0;
    d.privateMode = d.storage && d.storage.quota ? d.storage.quota < 135 * 1024 * 1024 : false;
    return d;
}
const bitsOf = d => { let b = 0; const add = (v, n) => { if (v && v !== "blocked" && v !== "unsupported" && v !== "timeout") b += n; }; add(d.ua, 9); add(d.langs.join(), 3.5); add(d.tz, 3); add(d.scr.w, 5); add(d.cores, 2); add(d.mem, 1.5); add(d.touch >= 0, 1.5); add(d.platform, 2); add(d.webgl && d.webgl.renderer, 7); add(d.canvas, 7); add(d.audio, 5); add(d.fonts.length, Math.min(10, d.fonts.length * 0.45)); add(d.plugins, 1); return Math.min(33, b); };
window.analyzeUserAgent = async function () {
    busy("uaResult", "Collecting ~40 browser signals: hardware, graphics, fonts, audio, WebRTC, permissions, privacy flags…");
    const d = await collectEnv();
    const pubLeak = (d.rtc || []).filter(x => isIPv4(x) && !privateKind(x)), localIP = (d.rtc || []).filter(x => (isIPv4(x) && privateKind(x)) || /\.local$/.test(x));
    const bits = bitsOf(d), S = [], add = (sev, title, why, w) => S.push({ sev, title, why, w: w || 0 });
    let score = 100;
    if (pubLeak.length) { add("high", "WebRTC reveals your real public IP", "Websites can ask your browser for network addresses through WebRTC, even behind a VPN. Here it exposed: " + pubLeak.join(", "), 22); score -= 22; }
    else add("good", "No public IP leaked through WebRTC", "Websites cannot learn a second IP address through WebRTC.", 0);
    if (localIP.length) { add("medium", "Local network address visible", "Your private address (" + localIP.join(", ") + ") is visible to scripts. This helps trackers recognise your network.", 6); score -= 6; }
    if (!d.https) { add("medium", "This page is not on HTTPS", "On a non-secure page a network attacker could read or modify what you do. Some features also turn off.", 8); score -= 8; }
    if (d.webdriver) { add("medium", "Automation flag is ON", "The browser says it is being controlled by software (Selenium/Puppeteer). Many sites treat this as a bot.", 5); score -= 5; }
    if (!d.dnt) { add("low", "'Do Not Track' is off", "A weak signal that most sites ignore, but it costs nothing to turn on.", 2); score -= 2; }
    if (!d.gpc) { add("low", "Global Privacy Control is off", "GPC is the legally recognised successor to Do Not Track in some regions. Browsers like Firefox/Brave can enable it.", 3); score -= 3; }
    if (d.canvas && d.canvas !== "blocked") { add("low", "Canvas fingerprint is readable", "Sites can draw hidden graphics and read the result to recognise your device even without cookies.", 4); score -= 4; } else add("good", "Canvas fingerprinting blocked or randomised", "Your browser protects against this tracking method.", 0);
    if (d.audio && !["blocked", "unsupported", "timeout"].includes(d.audio)) { add("low", "Audio fingerprint is readable", "Tiny differences in how your device processes sound can identify it.", 3); score -= 3; }
    if (bits >= 26) { add("medium", `Your browser fingerprint is highly unique (~${bits.toFixed(0)} bits)`, "Many small details combine into a signature that could single you out among millions. Trackers use this when cookies are deleted.", 8); score -= 8; }
    if (d.adblock) { add("good", "Ad / tracker blocker detected", "Blocking trackers reduces cross-site profiling.", 0); score += 4; } else { add("low", "No ad/tracker blocker detected", "Without protection, ad networks can follow you across sites. Consider uBlock Origin or a privacy browser.", 3); score -= 3; }
    Object.entries(d.perm).forEach(([k, s]) => { if (s === "granted" && /geolocation|camera|microphone|clipboard/.test(k)) { add("medium", `Permission already granted: ${k}`, "A site on this browser can use this without asking again. Review in browser settings → Site settings.", 4); score -= 4; } });
    if (d.privateMode) add("info", "Private / incognito mode likely", "Storage quota is unusually small, which is typical of private browsing. Good for privacy; sites cannot keep long-term data.", 0);
    if (d.ip && d.ip.timezone && d.ip.timezone.id && d.tz && d.ip.timezone.id !== d.tz) add("info", "Browser time zone differs from your IP location", `Browser says ${d.tz}, your IP appears in ${d.ip.timezone.id}. This is normal with a VPN or while travelling, but some sites treat it as suspicious.`, 0);
    else if (d.ip && d.ip.timezone) add("good", "Browser time zone matches your IP location", "Your settings look consistent with your network location.", 0);
    if (d.conn && d.conn.save) add("info", "Data-saver mode is on", "The browser limits data use; some sites send lighter pages.", 0);
    score = Math.max(5, Math.min(100, Math.round(score)));
    const k = score >= 80 ? "success" : score >= 55 ? "warning" : "danger", kk = k === "success" ? "ok" : k === "warning" ? "warn" : "bad";
    const device = d.hints && d.hints.model ? d.hints.model : (d.coarse ? "Phone / tablet" : "Desktop / laptop");
    const summary = verdict("🖥️", `${esc(d.p.browser)} on ${esc(d.p.os)}`, k, `Privacy score ${score}/100`) + meter(score, kk) +
        kv([["Device", esc(device) + (d.touch ? " · touch" : "")], ["Screen", `${d.scr.w}×${d.scr.h} @${d.scr.dpr}x`], ["Your IP", d.ip ? code(d.ip.ip) + " " + esc(d.ip.flag?.emoji || "") : "—"], ["Fingerprint", `≈${bits.toFixed(0)} bits (1 in ${num(Math.round(Math.pow(2, bits)))})`]]) +
        `<div class="tp-chips">${pubLeak.length ? badge("WebRTC leak", "danger") : badge("No WebRTC leak", "ok")}${d.adblock ? badge("Tracker blocker on", "ok") : badge("No tracker blocker", "warn")}${d.gpc ? badge("GPC on", "ok") : badge("GPC off", "info")}${d.privateMode ? badge("Private mode", "info") : ""}</div>`;
    /* report */
    const T = (l, v, s) => [l, v, s];
    let h = rHero("🖥️", `${esc(d.p.browser)} on ${esc(d.p.os)}`, `${esc(device)} · ${esc(d.tz)} · ${S.filter(s => ["high", "critical"].includes(s.sev)).length} serious finding(s)`, kk, rGauge(score, "privacy score", kk));
    h += rSec("🧾", "Findings explained", S.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).map(rSignal).join(""));
    h += rSec("🧬", "Browser fingerprint uniqueness", rTiles([T("Estimated entropy", `<b>${bits.toFixed(1)}</b> bits`, "estimate"), T("Could single you out among", `1 in ${num(Math.round(Math.pow(2, bits)))}`), T("Canvas hash", code(d.canvas)), T("Audio hash", code(d.audio)), T("GPU renderer hash", d.webgl ? code((await sha1Hex(d.webgl.renderer || "")).slice(0, 12)) : "—"), T("Fonts detected", `${d.fonts.length} of ${FONT_LIST.length}`)]) + rPara("Trackers combine dozens of small details (browser, screen, fonts, graphics, audio) into one signature. <b>The more unusual your setup, the easier you are to recognise.</b> This number is an estimate for education, not a measured value.") + (d.fonts.length ? chips(d.fonts.slice(0, 24), "info") : ""));
    h += rSec("📱", "Device & operating system", rTiles([T("Browser", esc(d.p.browser)), T("Operating system", esc(d.p.os), d.hints && d.hints.platformVersion ? "version " + esc(d.hints.platformVersion) : ""), T("Platform string", esc(d.platform)), d.hints && d.hints.model ? T("Device model", esc(d.hints.model)) : null, d.hints && d.hints.architecture ? T("CPU architecture", esc(d.hints.architecture + (d.hints.bitness ? "-" + d.hints.bitness : ""))) : null, T("CPU threads", String(d.cores || "hidden")), T("Memory (approx.)", d.mem ? d.mem + " GB+" : "hidden"), T("Touch points", String(d.touch)), T("Input", d.coarse ? "Touch (coarse pointer)" : "Mouse / trackpad"), d.battery ? T("Battery", `${d.battery.level}% ${d.battery.charging ? "⚡ charging" : ""}`) : null]) + `<details class="tpr-det"><summary>Raw user-agent string</summary><code>${esc(d.ua)}</code></details>`);
    h += rSec("🖼️", "Display & graphics", rTiles([T("Screen", `${d.scr.w}×${d.scr.h}`), T("Available area", `${d.scr.aw}×${d.scr.ah}`), T("Window now", `${d.scr.iw}×${d.scr.ih}`), T("Pixel ratio", d.scr.dpr + "x"), T("Colour depth", d.scr.cd + "-bit"), T("HDR / wide gamut", (d.hdr ? "HDR " : "") + (d.p3 ? "P3" : "sRGB")), T("Dark mode", d.dark ? "On" : "Off"), T("Reduced motion", d.reduce ? "Requested" : "No")]) + (d.webgl ? rTiles([T("GPU vendor", esc(d.webgl.vendor)), T("GPU renderer", esc(d.webgl.renderer)), T("WebGL version", esc(d.webgl.version)), T("Max texture", esc(d.webgl.maxTex)), T("Extensions", String(d.webgl.ext))]) : rPara("WebGL is unavailable or blocked.")));
    h += rSec("🌐", "Network & location", rTiles([T("Public IP", d.ip ? code(d.ip.ip) : "—"), T("Location (IP)", d.ip ? esc(`${d.ip.city || ""}, ${d.ip.country || ""}`) : "—"), T("ISP / network", d.ip ? esc(d.ip.connection?.org || d.ip.connection?.isp || "—") : "—"), T("Browser time zone", esc(d.tz), "UTC" + (d.tzOff >= 0 ? "+" : "") + d.tzOff), T("Languages", esc(d.langs.slice(0, 4).join(", "))), d.conn ? T("Connection", `${esc(d.conn.type || "?")} · ${d.conn.down || "?"} Mbps · RTT ${d.conn.rtt || "?"} ms`) : null, T("WebRTC addresses", d.rtc === null ? "unsupported" : (d.rtc.length ? d.rtc.map(code).join(" ") : "none exposed")), T("Online", d.online ? "Yes" : "No")]));
    h += rSec("🔒", "Privacy & security switches", rTiles([T("HTTPS page", d.https ? badge("yes", "ok") : badge("no", "danger")), T("Secure context", d.secure ? badge("yes", "ok") : badge("no", "warn")), T("Cookies", d.cookies ? "enabled" : "disabled"), T("Do Not Track", d.dnt ? badge("on", "ok") : badge("off", "info")), T("Global Privacy Control", d.gpc ? badge("on", "ok") : badge("off", "info")), T("Automation flag", d.webdriver ? badge("ON", "warn") : badge("off", "ok")), T("Tracker blocker", d.adblock ? badge("detected", "ok") : badge("none", "warn")), T("Private mode", d.privateMode ? "likely" : "no"), d.storage && d.storage.quota ? T("Storage quota", (d.storage.quota / 1073741824).toFixed(1) + " GB") : null]));
    const pe = Object.entries(d.perm); h += rSec("🔑", "Site permissions in this browser", pe.length ? rTable(["Permission", "State", "Meaning"], pe.map(([n, s]) => [esc(n), badge(s, s === "granted" ? "danger" : s === "denied" ? "ok" : "info"), s === "granted" ? "Sites may use it without asking" : s === "denied" ? "Blocked" : "Will ask before use"])) : rPara("The permissions API is not available in this browser."));
    h += rSec("🎧", "Media devices (counts only)", rTiles([T("Microphones", String(d.devices.audioinput || 0)), T("Cameras", String(d.devices.videoinput || 0)), T("Speakers", String(d.devices.audiooutput || 0)), T("Speech voices", String(d.voices))]) + rPara("Only the number of devices is read. No camera or microphone is ever turned on by this tool."));
    h += rSec("🛠️", "How to improve your privacy", rSteps(["Use a browser with built-in tracker protection (Firefox, Brave) or add uBlock Origin.", "Turn on <b>Global Privacy Control / Do Not Track</b> in browser settings.", pubLeak.length ? "<b>Disable WebRTC IP leaks</b> (Firefox: media.peerconnection.enabled = false, or use a WebRTC-blocking extension)." : "Keep WebRTC protection enabled.", "Review <b>Site settings → Permissions</b> and remove location/camera/microphone from sites you do not trust.", "Clear cookies regularly and avoid logging into many services in the same browser profile.", "Keep your browser and OS updated, and avoid sites that are not HTTPS."]));
    h += rPara("<small>Everything on this page is read locally in your browser. Only your public IP lookup contacts ipwho.is. Nothing is stored by CyberGuard.</small>");
    setR("uaResult", "ua", "Browser & device deep report", `${d.p.browser} · ${d.p.os}`, summary, h, k);
};

/* ============================================================
   DNS DEEP REPORT
   ============================================================ */
const DNS_NUM = { A: 1, AAAA: 28, CNAME: 5, MX: 15, NS: 2, TXT: 16, SOA: 6, CAA: 257, DS: 43, DNSKEY: 48, PTR: 12 };
const NS_PROV = [[/cloudflare/i, "Cloudflare"], [/awsdns/i, "Amazon Route 53"], [/googledomains|google\.com|ns-cloud/i, "Google Cloud DNS"], [/azure-dns/i, "Microsoft Azure DNS"], [/domaincontrol/i, "GoDaddy"], [/registrar-servers/i, "Namecheap"], [/nsone/i, "NS1"], [/dnsmadeeasy/i, "DNS Made Easy"], [/ultradns/i, "UltraDNS"], [/akam/i, "Akamai"], [/digitalocean/i, "DigitalOcean"], [/hetzner/i, "Hetzner"], [/ovh/i, "OVH"], [/wixdns/i, "Wix"], [/squarespace|sqsp/i, "Squarespace"], [/dnspod|alidns|hichina/i, "Alibaba / Tencent"], [/vercel-dns/i, "Vercel"], [/netlify/i, "Netlify"]];
const TXT_SERVICES = [[/google-site-verification/i, "Google Search Console / Workspace"], [/^"?MS=/i, "Microsoft 365"], [/facebook-domain-verification/i, "Meta (Facebook)"], [/apple-domain-verification/i, "Apple"], [/atlassian-domain-verification/i, "Atlassian"], [/docusign/i, "DocuSign"], [/stripe-verification/i, "Stripe"], [/zoho-verification/i, "Zoho"], [/adobe-idp-site-verification/i, "Adobe"], [/shopify/i, "Shopify"], [/hubspot|hs-site-verification/i, "HubSpot"], [/amazonses/i, "Amazon SES"], [/sendgrid/i, "SendGrid"], [/mailchimp|mandrill/i, "Mailchimp"], [/slack-domain-verification/i, "Slack"], [/zoom/i, "Zoom"], [/cloudflare-verify/i, "Cloudflare"]];
const DKIM_SEL = ["google", "selector1", "selector2", "default", "k1", "s1", "dkim", "mail", "smtp", "zoho"];
const REC_INFO = { A: "Maps a name to an IPv4 address (where the website lives).", AAAA: "Maps a name to an IPv6 address.", CNAME: "An alias that points one name to another name.", MX: "Mail servers that receive email for the domain (lower number = higher priority).", NS: "The authoritative name servers that answer for this domain.", TXT: "Free text used for SPF, DMARC, ownership verification and more.", SOA: "Start-of-authority record: the zone's primary server, admin contact and refresh timers.", CAA: "Lists which certificate authorities are allowed to issue HTTPS certificates for the domain." };
const pool = async (tasks, n = 6) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k]().catch(() => null); } })); return out; };
function parseSpf(txt) {
    const t = txt.replace(/^"|"$/g, "").replace(/"\s*"/g, ""), parts = t.split(/\s+/).slice(1); let lookups = 0, all = ""; const mech = [];
    parts.forEach(p => { const m = /^([+\-~?]?)(all|include|a|mx|ptr|exists|ip4|ip6|redirect|exp)(?:[:=](.*))?$/i.exec(p); if (!m) return; const k = m[2].toLowerCase(); if (["include", "a", "mx", "ptr", "exists", "redirect"].includes(k)) lookups++; if (k === "all") all = (m[1] || "+") + "all"; mech.push({ q: m[1] || "+", k, v: m[3] || "" }); });
    return { mech, lookups, all, raw: t };
}
const parseDmarc = txt => { const o = {}; txt.replace(/^"|"$/g, "").split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim(); }); return o; };
const txtVal = a => String(a.data).replace(/^"|"$/g, "").replace(/"\s*"/g, "");
const ttlHuman = s => s >= 86400 ? Math.round(s / 86400) + " d" : s >= 3600 ? Math.round(s / 3600) + " h" : s >= 60 ? Math.round(s / 60) + " min" : s + " s";

window.lookupDNS = async function () {
    let domain; try { domain = parseHost(val("dnsInput")); } catch (_) { return fail("dnsResult", "Enter a domain."); }
    if (!isDomain(domain)) return fail("dnsResult", "Enter a valid domain, e.g. google.com");
    busy("dnsResult", "Deep DNS audit: records, DNSSEC, SPF/DKIM/DMARC, providers, hosting, registration (about 30 lookups)…");
    try {
        const rnd = "cg-" + Math.random().toString(36).slice(2, 9);
        const specs = [["A", domain, "A"], ["AAAA", domain, "AAAA"], ["CNAME", domain, "CNAME"], ["MX", domain, "MX"], ["NS", domain, "NS"], ["TXT", domain, "TXT"], ["SOA", domain, "SOA"], ["CAA", domain, "CAA"], ["DS", domain, "DS"], ["DNSKEY", domain, "DNSKEY"], ["wwwA", "www." + domain, "A"], ["wwwCNAME", "www." + domain, "CNAME"], ["dmarc", "_dmarc." + domain, "TXT"], ["mtasts", "_mta-sts." + domain, "TXT"], ["bimi", "default._bimi." + domain, "TXT"], ["wild", rnd + "." + domain, "A"], ...DKIM_SEL.map(s => ["dkim:" + s, s + "._domainkey." + domain, "TXT"])];
        const res = await pool(specs.map(([k, n, t]) => () => dnsQuery(n, t).then(d => ({ k, t, d }))), 7);
        const R = {}; res.forEach(r => { if (r) R[r.k] = r; });
        if (!R.A && !R.NS) throw new Error("dns");
        const first = R.A || R.NS || R.TXT; if (first && first.d.Status === 3) return set("dnsResult", verdict("❓", "Domain does not exist (NXDOMAIN)", "warning", esc(domain)) + note("No DNS records were found. Check the spelling or whether the domain is registered."), "warning");
        const ans = (k, type) => (R[k] && R[k].d.Answer ? R[k].d.Answer.filter(a => a.type === (DNS_NUM[type || R[k].t])) : []);
        const A = ans("A"), AAAA = ans("AAAA"), CN = ans("CNAME"), MX = ans("MX"), NS = ans("NS"), TXT = ans("TXT"), SOA = ans("SOA"), CAA = ans("CAA"), DS = ans("DS"), DNSKEY = ans("DNSKEY");
        const dnssec = R.A && R.A.d.AD === true, hasMail = MX.length > 0 && !MX.some(m => /^0?\s*\.?$/.test(String(m.data).replace(/^\d+\s+/, "")));
        const spfTxt = TXT.map(txtVal).find(t => /^v=spf1/i.test(t)), dmTxt = ans("dmarc", "TXT").map(txtVal).find(t => /^v=DMARC1/i.test(t)), mtaTxt = ans("mtasts", "TXT").map(txtVal).find(t => /v=STSv1/i.test(t)), bimi = ans("bimi", "TXT").map(txtVal).find(t => /v=BIMI1/i.test(t));
        const spf = spfTxt ? parseSpf(spfTxt) : null, dm = dmTxt ? parseDmarc(dmTxt) : null, dkim = DKIM_SEL.filter(s => ans("dkim:" + s, "TXT").some(a => /v=DKIM1|p=/.test(txtVal(a))));
        const mxHosts = MX.map(m => String(m.data).replace(/^\d+\s+/, "").replace(/\.$/, "").toLowerCase()), nsHosts = NS.map(n => String(n.data).replace(/\.$/, "").toLowerCase());
        const mailProv = MAIL_PROV.find(([re]) => mxHosts.some(m => re.test(m)))?.[1] || (hasMail ? "Custom mail server" : "No email service"), nsProv = NS_PROV.find(([re]) => nsHosts.some(n => re.test(n)))?.[1] || "Independent / other";
        const wildcard = ans("wild", "A").length > 0, soa = SOA[0] ? String(SOA[0].data).split(/\s+/) : [];
        const ip0 = A[0] && A[0].data;
        const [geo, rd] = await Promise.all([ip0 ? raceT(ipwho(ip0).catch(() => null), 9000) : null, raceT(rdapDomain(domain), 10000)]);
        const svc = [...new Set(TXT.map(txtVal).flatMap(t => TXT_SERVICES.filter(([re]) => re.test(t)).map(x => x[1])))];
        const cdn = geo && /cloudflare|akamai|fastly|cloudfront|incapsula|imperva|sucuri|stackpath|bunny/i.test(geo.connection?.org || "") ? geo.connection.org : "";
        /* grading */
        let health = 100; const P = [], add = (sev, title, why, d) => { P.push({ sev, title, why }); health -= d; };
        if (NS.length < 2) add("high", "Fewer than 2 name servers", "If the single name server fails, the whole domain disappears. Standards require at least two, ideally on different networks.", 15); else add("good", `${NS.length} name servers (${nsProv})`, "Redundant name servers keep the domain reachable if one fails.", 0);
        if (!dnssec) add("low", "DNSSEC is not validated", "Without DNSSEC, attackers who poison DNS caches can send visitors to fake servers. Enabling it signs your records cryptographically.", 5); else add("good", "DNSSEC validated (AD flag)", "Resolvers can verify that answers were not tampered with.", 0);
        if (!CAA.length) add("low", "No CAA record", "A CAA record restricts which certificate authorities may issue certificates for your domain, reducing mis-issuance risk.", 4); else add("good", "CAA record present", "Certificate issuance is restricted to listed authorities.", 0);
        if (wildcard) add("info", "Wildcard DNS is enabled", "Any random subdomain resolves. Useful for apps, but it can hide typos and help phishers abuse your domain.", 2);
        let grade = "N/A", gk = "info";
        if (hasMail) {
            let g = 0;
            if (!spf) add("high", "No SPF record", "SPF lists which servers may send email for your domain. Without it anyone can more easily forge messages from you.", 20); else { g += 1; if (spf.all === "-all") { g += 1; add("good", "SPF with strict policy (-all)", "Servers not listed are told to reject the mail.", 0); } else if (spf.all === "~all") { g += 0.6; add("low", "SPF uses soft-fail (~all)", "Unlisted senders are only marked suspicious. Move to -all once you are sure all senders are listed.", 3); } else add("high", `SPF policy is weak (${spf.all || "none"})`, "+all or ?all effectively allows anyone to send as your domain.", 18); if (spf.lookups > 10) add("medium", `SPF needs ${spf.lookups} DNS lookups (limit is 10)`, "Receivers may treat SPF as broken (permerror) and ignore it.", 8); }
            if (!dm) add("high", "No DMARC record", "DMARC tells receivers what to do with forged mail and sends you reports. It is the key defence against spoofed emails.", 20); else { g += 1; const p = (dm.p || "").toLowerCase(); if (p === "reject") { g += 1.5; add("good", "DMARC policy: reject", "Forged emails are refused. This is the strongest setting.", 0); } else if (p === "quarantine") { g += 1; add("low", "DMARC policy: quarantine", "Forged emails go to spam. Consider moving to reject.", 3); } else add("medium", "DMARC policy: none (monitor only)", "DMARC is present but does not block anything yet.", 8); if (dm.rua) g += 0.5; else add("low", "DMARC has no reporting address (rua)", "Without reports you cannot see who is sending as your domain.", 2); }
            if (dkim.length) { g += 1; add("good", `DKIM signing found (${dkim.join(", ")})`, "Messages can be cryptographically verified.", 0); } else add("low", "No common DKIM selector found", "Selectors vary by provider, so this check is not conclusive. DKIM proves mail was not altered in transit.", 2);
            if (mtaTxt) g += 0.5; else add("info", "MTA-STS not configured", "MTA-STS forces encrypted delivery of incoming mail and prevents downgrade attacks.", 1);
            grade = g >= 5.5 ? "A" : g >= 4.5 ? "B" : g >= 3 ? "C" : g >= 1.5 ? "D" : "F"; gk = g >= 4.5 ? "ok" : g >= 3 ? "warn" : "danger";
        } else add("info", "Domain does not receive email", spf && /-all/.test(spf.all) ? "A null/strict SPF on a non-mail domain correctly stops spoofing." : "Domains that send no email should publish v=spf1 -all and DMARC p=reject so criminals cannot spoof them.", 0);
        health = Math.max(5, Math.min(100, Math.round(health))); const k = health >= 80 ? "success" : health >= 55 ? "warning" : "danger", kk = k === "success" ? "ok" : k === "warning" ? "warn" : "bad";
        const ageDays = rd && rd.created ? Math.floor((Date.now() - new Date(rd.created)) / 864e5) : null;
        /* summary */
        const summary = verdict("🌐", esc(domain), k, `DNS health ${health}/100`) + meter(health, kk) +
            kv([["Website IP", A.length ? A.slice(0, 2).map(a => code(a.data)).join(" ") : (CN.length ? "alias → " + code(String(CN[0].data).replace(/\.$/, "")) : badge("none", "warn"))], ["Hosting", geo ? `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "")} · ${esc(cdn || geo.connection?.org || "")}` : "—"], ["Name servers", esc(nsProv)], ["Mail", esc(mailProv)], ["Email security", hasMail ? badge("Grade " + grade, gk) : badge("no email", "info")], ["DNSSEC", dnssec ? badge("validated", "ok") : badge("not validated", "warn")], ageDays != null ? ["Domain age", badge((ageDays / 365).toFixed(1) + " years", ageDays < 180 ? "danger" : "ok")] : null]);
        /* report */
        const recTable = (type, list, fmt) => list.length ? rTable(["Value", "TTL"], list.slice(0, 12).map(a => [fmt ? fmt(a) : code(String(a.data).slice(0, 240)), ttlHuman(a.TTL)])) : "";
        let h = rHero("🌐", esc(domain), `${esc(nsProv)} · ${esc(mailProv)} · ${hasMail ? "email grade " + grade : "no email"} · ${P.filter(p => ["high", "critical"].includes(p.sev)).length} serious issue(s)`, kk, rGauge(health, "DNS health", kk));
        h += rSec("🧾", "Findings & recommendations", P.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).map(rSignal).join(""));
        h += rSec("📚", "All records found (and what they mean)", ["A", "AAAA", "CNAME", "MX", "NS", "SOA", "CAA"].map(t => { const L = { A, AAAA, CNAME: CN, MX, NS, SOA, CAA }[t]; return `<div class="tpr-rec"><h5>${t} <small>${esc(REC_INFO[t])}</small></h5>${L.length ? recTable(t, L) : `<p class="tpr-none">none</p>`}</div>`; }).join("") + `<div class="tpr-rec"><h5>TXT <small>${esc(REC_INFO.TXT)}</small></h5>${TXT.length ? recTable("TXT", TXT) : `<p class="tpr-none">none</p>`}</div>`);
        if (hasMail || spf || dm) {
            h += rSec("✉️", "Email security (SPF · DKIM · DMARC)", rTiles([["Overall grade", `<b>${hasMail ? grade : "N/A"}</b>`], ["SPF", spf ? badge("present", "ok") : badge("missing", "danger")], ["SPF policy", spf ? code(spf.all || "none") : "—"], ["SPF lookups", spf ? `${spf.lookups} / 10` : "—"], ["DMARC", dm ? badge("p=" + (dm.p || "?"), /reject|quarantine/.test(dm.p || "") ? "ok" : "warn") : badge("missing", "danger")], ["DKIM selectors", dkim.length ? esc(dkim.join(", ")) : "none found"], ["MTA-STS", mtaTxt ? badge("on", "ok") : badge("off", "info")], ["BIMI logo", bimi ? badge("set", "ok") : "—"]]) +
                (spf ? rTable(["SPF part", "Meaning"], spf.mech.slice(0, 16).map(m => [code((m.q === "+" ? "" : m.q) + m.k + (m.v ? ":" + m.v : "")), esc({ include: "Also trust this other domain's senders", a: "Trust the server in the domain's A record", mx: "Trust this domain's mail servers", ip4: "Trust this IPv4 range", ip6: "Trust this IPv6 range", all: m.q === "-" ? "Reject everyone else (strict)" : m.q === "~" ? "Mark everyone else suspicious (soft)" : "Allow everyone else (dangerous)", redirect: "Use another domain's SPF", exists: "Advanced check", ptr: "Deprecated, avoid", exp: "Explanation text" }[m.k] || "")])) : "") +
                (dm ? rTable(["DMARC tag", "Value", "Meaning"], Object.entries(dm).map(([k2, v]) => [code(k2), code(v.slice(0, 80)), esc({ v: "Version", p: "Action for failing mail", sp: "Action for subdomains", pct: "Percent of mail the policy applies to", rua: "Where aggregate reports are sent", ruf: "Where forensic reports are sent", adkim: "DKIM alignment mode", aspf: "SPF alignment mode", fo: "Failure reporting options" }[k2] || "")])) : "") +
                rPara(hasMail && (!spf || !dm) ? "<b>Example fix:</b> add TXT records <code>v=spf1 include:YOUR_MAIL_PROVIDER -all</code> and <code>_dmarc</code> → <code>v=DMARC1; p=quarantine; rua=mailto:you@" + esc(domain) + "</code>." : "Keep monitoring DMARC reports to catch misuse."));
        }
        h += rSec("🛡️", "DNSSEC", rTiles([["Validated by resolver", dnssec ? badge("yes (AD flag)", "ok") : badge("no", "warn")], ["DS record at parent", DS.length ? badge("present", "ok") : badge("none", "info")], ["DNSKEY at domain", DNSKEY.length ? badge("present", "ok") : badge("none", "info")], ["Registry says signed", rd ? (rd.dnssec ? badge("yes", "ok") : badge("no", "info")) : "—"]]) + rPara("DNSSEC signs your DNS answers so tampering can be detected. It is optional but recommended for banks, government and high-value sites."));
        h += rSec("🏗️", "Providers & hosting", rTiles([["Name servers", esc(nsHosts.slice(0, 4).join(", ") || "—")], ["DNS provider", esc(nsProv)], ["Mail servers", esc(mxHosts.slice(0, 3).join(", ") || "—")], ["Mail provider", esc(mailProv)], ["Website IP", A.length ? A.slice(0, 3).map(a => code(a.data)).join(" ") : "—"], ["Hosting / network", geo ? esc(geo.connection?.org || "—") : "—"], ["Server country", geo ? `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "")}` : "—"], ["CDN / protection", cdn ? badge(cdn, "ok") : "none detected"], ["IPv6", AAAA.length ? badge("enabled", "ok") : badge("not enabled", "info")], ["www record", ans("wwwA", "A").length || ans("wwwCNAME", "CNAME").length ? badge("exists", "ok") : badge("none", "info")], ["Wildcard DNS", wildcard ? badge("yes", "warn") : badge("no", "ok")]]) + (svc.length ? `<div class="tp-sub">Services detected from TXT records</div>` + chips(svc, "info") : ""));
        if (soa.length >= 7) h += rSec("🧮", "Zone details (SOA)", rTiles([["Primary server", code(soa[0].replace(/\.$/, ""))], ["Admin contact", code(soa[1].replace(/\.$/, "").replace(".", "@"))], ["Serial", code(soa[2])], ["Refresh", ttlHuman(+soa[3])], ["Retry", ttlHuman(+soa[4])], ["Expire", ttlHuman(+soa[5])], ["Negative TTL", ttlHuman(+soa[6])]]));
        h += rSec("📅", "Registration (RDAP)", rd ? rTiles([["Registered", fmtDate(rd.created), ageDays != null ? (ageDays / 365).toFixed(1) + " years ago" : ""], ["Last changed", fmtDate(rd.updated)], ["Expires", fmtDate(rd.expires)], ["Registrar", esc(rd.registrar || "—")], ["Status", esc((rd.status || []).slice(0, 3).join(", ") || "—")]]) : rPara("Registration data is not available for this ending, or the lookup timed out."));
        h += rPara("<small>Data source: Google Public DNS (DNS-over-HTTPS), RDAP and ipwho.is. DKIM selectors are guessed from common names, so absence is not proof.</small>");
        setR("dnsResult", "dns", "DNS & email-security deep report", domain, summary, h, k);
    } catch (e) { fail("dnsResult", "DNS-over-HTTPS provider unavailable.", "warning"); }
};

/* ============================================================
   PASSWORD  (deep local analysis + real breach check)
   ============================================================ */
function pwStructure(p) {
    const segs = []; let cur = null;
    for (const ch of p) { const t = /[a-z]/.test(ch) ? "l" : /[A-Z]/.test(ch) ? "U" : /\d/.test(ch) ? "d" : "s"; if (cur && cur.t === t) cur.n++; else { cur = { t, n: 1 }; segs.push(cur); } }
    const name = { l: "lowercase", U: "UPPERCASE", d: "digits", s: "symbols" };
    return segs.map(s => `<span class="pw-seg pw-${s.t}" title="${s.n} ${name[s.t]}">${s.t === "l" ? "a" : s.t === "U" ? "A" : s.t === "d" ? "1" : "#"}${s.n > 1 ? "×" + s.n : ""}</span>`).join("");
}
let pwTok2 = 0, pwTimer2 = null;
window.checkPasswordStrength = function () {
    const p = $("passInput")?.value || "", bar = $("strengthBar"), text = $("strengthText"); if (!bar || !text) return;
    const card = text.closest(".tool-card");
    if (!p) { bar.style.width = "0%"; text.textContent = "Awaiting Input..."; if (card) card.dataset.state = "info"; return; }
    const a = analyzePassword(p), col = a.score < 30 ? "#ff3366" : a.score < 55 ? "#ffbb00" : a.score < 75 ? "#00bcff" : "#00ffaa";
    bar.style.width = Math.max(4, a.score) + "%"; bar.style.backgroundColor = col;
    const label = a.score < 30 ? "Very Weak" : a.score < 45 ? "Weak" : a.score < 65 ? "Fair" : a.score < 82 ? "Strong" : "Excellent", g = Math.pow(2, Math.max(a.bits - 1, 0));
    const sc = [["Online, throttled (100 guesses/s)", 100], ["Online, no limit (10,000/s)", 1e4], ["Stolen database, fast hash (10 billion/s)", 1e10], ["Stolen database, GPU farm (1 trillion/s)", 1e12]];
    const checks = [["8+ characters", p.length >= 8], ["12+ characters (recommended minimum)", p.length >= 12], ["16+ characters (strong)", p.length >= 16], ["Mixed upper & lower case", /[a-z]/.test(p) && /[A-Z]/.test(p)], ["Contains numbers", /\d/.test(p)], ["Contains symbols", /[^A-Za-z0-9]/.test(p)], ["Not a common password", !COMMON_PW.includes(p.toLowerCase()) && !COMMON_PW.includes(deLeet(p))], ["No obvious pattern (123, qwerty, aaa)", !a.issues.some(i => /sequence|Repeated/.test(i))]];
    const need = a.bits < 60 ? Math.ceil((60 - a.bits) / Math.log2(Math.max(a.pool, 26))) : 0;
    text.innerHTML = `
        <div class="tp-verdict tp-${a.score < 45 ? "danger" : a.score < 65 ? "warning" : "success"}"><span class="tp-vi">${a.score < 45 ? "🔓" : a.score < 65 ? "🔐" : "🛡️"}</span>
        <div><b>${label} • ${a.score}/100</b><small>${p.length} chars • ${a.bits.toFixed(1)} bits • character pool ${a.pool}</small></div></div>
        <div class="pw-structure"><small>Structure</small>${pwStructure(p)}</div>
        ${kv(sc.map(([n, r]) => [n, fmtDuration(g / r)]))}
        ${a.issues.length ? chips(a.issues, "danger") : ""}${a.good.length ? chips(a.good, "ok") : ""}
        <div id="pwBreachLine" class="tp-note">🔎 Checking real breach database (HIBP)…</div>
        <details class="tp-det"><summary>🔬 Deep analysis & how to improve</summary><div>
          <div class="tp-sub">Policy checks</div>${rList(checks.map(([t, ok]) => `${ok ? "✅" : "❌"} ${esc(t)}`), "tpr-mini")}
          <div class="tp-sub">What the numbers mean</div>
          <p class="tp-note"><b>Entropy ${a.bits.toFixed(1)} bits</b> = about ${num(Math.round(g))} guesses on average. Each extra bit doubles the work for an attacker. 60+ bits is decent for online accounts, 80+ is strong against stolen databases.</p>
          <div class="tp-sub">Improve it</div>
          ${rList([need ? `Add about <b>${need} more random characters</b> to reach 60 bits.` : "Length is good. Make sure it is unique for this account.", "A passphrase of <b>4–5 unrelated random words</b> (e.g. from a dice list) gives 50–65 bits and is easy to remember.", "Never reuse this password on another site. Use a password manager.", "Add <b>2-Step Verification</b>: even a perfect password can be phished."], "tpr-mini")}
          <p class="tp-note">Your password is analysed only in your browser. Only the first 5 characters of its SHA-1 hash are sent for the breach check.</p></div></details>`;
    if (card) card.dataset.state = a.score < 45 ? "danger" : a.score < 65 ? "warning" : "success";
    clearTimeout(pwTimer2); const my = ++pwTok2;
    pwTimer2 = setTimeout(async () => {
        const line = () => document.getElementById("pwBreachLine");
        try {
            if (!crypto?.subtle) throw new Error("no-subtle");
            const hh = await sha1Hex(p), body = await getText(`https://api.pwnedpasswords.com/range/${hh.slice(0, 5)}`, { timeout: 9000 });
            if (my !== pwTok2 || !line()) return;
            const hit = body.split(/\r?\n/).map(l => l.split(":")).find(([s]) => s === hh.slice(5));
            if (hit) { line().className = "tp-note tp-bad"; line().innerHTML = `☠️ <b>Found ${num(parseInt(hit[1], 10))} times</b> in real data breaches (HIBP). Never use this password anywhere.`; if (card) card.dataset.state = "danger"; }
            else { line().className = "tp-note tp-good"; line().innerHTML = "✅ Not found in 800M+ breached passwords (HIBP). Only the first 5 hash characters were sent (k-anonymity)."; }
        } catch (_) { if (my === pwTok2 && line()) line().textContent = "ℹ️ Breach database unreachable right now (needs HTTPS + internet). Local analysis above is still valid."; }
    }, 700);
};

/* ============================================================
   PORT / EXPOSURE SCANNER  (deep)
   ============================================================ */
window.scanPorts = async function () {
    let host; try { host = parseHost(val("portScanInput")); } catch (_) { return fail("portScanResult", "Enter a hostname or public IP."); }
    if (!isIP(host) && !isDomain(host)) return fail("portScanResult", "Invalid hostname / IP.");
    busy("portScanResult", "Resolving target & querying exposure database…");
    try {
        const ips = await resolveIPs(host); if (!ips.length) return fail("portScanResult", "Target does not resolve.", "warning");
        const ip = ips.find(isIPv4) || ips[0], pk = privateKind(ip);
        if (pk) return set("portScanResult", verdict("🏠", "Private address", "info", esc(ip)) + note(esc(pk) + " - not reachable from the internet, so no public exposure data exists."), "info");
        const [d, geo] = await Promise.all([internetDb(ip), raceT(ipwho(ip).catch(() => null), 9000)]);
        if (d.notFound) return set("portScanResult", verdict("🔍", "No exposure data", "success", esc(ip)) + note("This IP is not in Shodan's index (no known open services). That is NOT proof that all ports are closed."), "success");
        const rows = portRows(d.ports), crit = rows.filter(r => r.sev === "critical").length, high = rows.filter(r => r.sev === "high").length;
        let risk = Math.min(100, crit * 25 + high * 14 + Math.min(30, d.vulns.length * 4) + (d.tags.some(t => /malware|c2|compromised|botnet/i.test(t)) ? 30 : 0));
        const k = risk >= 55 ? "danger" : risk >= 20 ? "warning" : "success", kk = k === "danger" ? "bad" : k === "warning" ? "warn" : "ok";
        const summary = verdict(risk >= 55 ? "🚨" : risk >= 20 ? "⚠️" : "🛡️", `${d.ports.length} open port${d.ports.length === 1 ? "" : "s"} · ${crit} critical`, k, `${esc(host)} → ${esc(ip)}`) + meter(risk, kk) +
            kv([["Open ports", d.ports.slice(0, 10).map(p => badge(`${p} ${(PORT_INFO[p] || [PORT_NAMES[p] || ""])[0]}`.trim(), RISKY_PORTS.has(p) ? "danger" : "info")).join("")], d.vulns.length ? ["Known CVEs", chips(d.vulns.slice(0, 5), "danger")] : null, geo ? ["Location", `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "")} · ${esc(geo.connection?.org || "")}`] : null, d.tags.length ? ["Tags", chips(d.tags, "warn")] : null]);
        let h = rHero(risk >= 55 ? "🚨" : "🔌", `${d.ports.length} open services on ${esc(ip)}`, `${esc(host)} · ${crit} critical · ${high} high · ${d.vulns.length} known CVEs`, kk, rGauge(risk, "exposure risk", kk));
        h += rSec("🔌", "Every open port, explained", portTable(d.ports));
        if (d.vulns.length) h += rSec("🐞", `Known vulnerabilities (${d.vulns.length})`, `<div class="tpr-links">${d.vulns.slice(0, 40).map(c => `<a href="https://nvd.nist.gov/vuln/detail/${esc(c)}" target="_blank" rel="noopener noreferrer">${esc(c)} ↗</a>`).join("")}</div>` + rPara("These CVEs are matched from detected software versions. Some may not apply if the vendor back-ported fixes, but each deserves a check."));
        h += rSec("🧩", "Identity of the host", rTiles([["IP", code(ip)], ["Hostnames", d.hostnames.length ? esc(d.hostnames.slice(0, 4).join(", ")) : "none"], ["Software (CPE)", d.cpes.length ? d.cpes.slice(0, 5).map(code).join(" ") : "unknown"], ["Tags", d.tags.length ? chips(d.tags, "warn") : "none"], geo ? ["Network", esc(geo.connection?.org || "—")] : null, geo ? ["Country", `${esc(geo.flag?.emoji || "")} ${esc(geo.country || "")}`] : null]));
        h += rSec("🛠️", "Hardening checklist", rSteps(["Close every <b>critical</b> and <b>high</b> port unless it is truly needed. Put admin services behind a VPN.", "Restrict databases (3306, 5432, 6379, 27017, 9200) to private networks only.", "Patch the software behind the CVEs above and remove outdated services.", "Add a firewall allow-list and fail2ban/rate limiting for SSH and web logins.", "Re-check after changes: Shodan data refreshes every few days."]));
        h += rPara("<small>Passive data from Shodan InternetDB. It is not a live scan. Scan only systems you own or are authorised to test.</small>");
        setR("portScanResult", "ports", "Exposure & port report", host, summary, h, k);
    } catch (e) { fail("portScanResult", "Exposure database unreachable right now.", "warning"); }
};

/* ============================================================
   SECURITY HEADERS (deep)
   ============================================================ */
const HDR_INFO = {
    "strict-transport-security": ["HSTS", "Forces browsers to always use HTTPS, blocking SSL-stripping attacks.", "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload", "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;"],
    "content-security-policy": ["Content-Security-Policy", "Stops injected scripts (XSS) by allow-listing where code may load from.", "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'", "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'\" always;"],
    "x-frame-options": ["X-Frame-Options", "Prevents your page being embedded in another site (clickjacking).", "X-Frame-Options: DENY", "add_header X-Frame-Options \"DENY\" always;"],
    "x-content-type-options": ["X-Content-Type-Options", "Stops browsers guessing file types, blocking some drive-by attacks.", "X-Content-Type-Options: nosniff", "add_header X-Content-Type-Options \"nosniff\" always;"],
    "referrer-policy": ["Referrer-Policy", "Controls how much of your URL is leaked to other sites.", "Referrer-Policy: strict-origin-when-cross-origin", "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;"],
    "permissions-policy": ["Permissions-Policy", "Disables powerful browser features (camera, mic, location) you do not use.", "Permissions-Policy: camera=(), microphone=(), geolocation=()", "add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;"],
    "cross-origin-opener-policy": ["COOP", "Isolates your window from cross-site pop-ups (Spectre-style attacks).", "Cross-Origin-Opener-Policy: same-origin", "add_header Cross-Origin-Opener-Policy \"same-origin\" always;"],
    "cross-origin-resource-policy": ["CORP", "Stops other sites from loading your resources.", "Cross-Origin-Resource-Policy: same-origin", "add_header Cross-Origin-Resource-Policy \"same-origin\" always;"]
};
window.auditSecurityHeaders = async function () {
    let host; try { host = parseHost(val("headerInput")); } catch (_) { return fail("headerResult", "Enter a website, e.g. https://example.com"); }
    if (!isDomain(host)) return fail("headerResult", "Enter a valid public domain.");
    busy("headerResult", "Scanning with Mozilla Observatory + live header fetch…");
    const [obs, ht] = await Promise.allSettled([getJson(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`, { method: "POST", timeout: 25000 }), getText(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent("https://" + host)}`, { timeout: 15000 })]);
    const headers = {}; if (ht.status === "fulfilled" && !/^error|API count exceeded|invalid/i.test(ht.value.trim())) ht.value.split(/\r?\n/).forEach(l => { const i = l.indexOf(":"); if (i > 0) headers[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
    const have = Object.keys(headers).length, o = obs.status === "fulfilled" && obs.value && obs.value.grade ? obs.value : null;
    if (!have && !o) return fail("headerResult", "Could not fetch headers (site unreachable, blocked, or free quota used). Try again later.", "warning");
    const keys = Object.keys(HDR_INFO), passed = keys.filter(k => headers[k]).length, pct = have ? Math.round(passed / keys.length * 100) : (o ? Math.min(100, o.score) : 0);
    const k = pct >= 75 ? "success" : pct >= 40 ? "warning" : "danger", kk = k === "success" ? "ok" : k === "warning" ? "warn" : "bad";
    const leaks = ["server", "x-powered-by", "x-aspnet-version", "x-generator", "x-aspnetmvc-version"].filter(x => headers[x]).map(x => `${x}: ${headers[x]}`);
    const g = o ? String(o.grade) : "", gk = /^A/.test(g) ? "ok" : /^[BC]/.test(g) ? "warn" : "danger";
    const summary = verdict(pct >= 75 ? "🛡️" : pct >= 40 ? "⚠️" : "🚨", have ? `${passed}/${keys.length} security headers` : `Observatory grade ${esc(g)}`, k, esc(host)) + meter(pct, kk) + kv([have ? ["Missing", keys.filter(x => !headers[x]).length ? chips(keys.filter(x => !headers[x]).map(x => HDR_INFO[x][0]), "danger") : badge("none", "ok")] : null, o ? ["Mozilla grade", badge(g + " · " + o.score + "/100", gk)] : null, leaks.length ? ["Leaks", chips(leaks.slice(0, 3), "warn")] : null]);
    let h = rHero("🛡️", esc(host), `${have ? passed + "/" + keys.length + " headers present" : "headers unavailable"}${o ? " · Observatory " + esc(g) : ""}`, kk, rGauge(pct, "header score", kk));
    if (have) h += rSec("🧾", "Header-by-header audit", rTable(["Header", "Status", "What it protects", "Current value"], keys.map(x => { const i = HDR_INFO[x]; return [`<b>${esc(i[0])}</b>`, headers[x] ? badge("present", "ok") : badge("missing", "danger"), esc(i[1]), headers[x] ? code(headers[x].slice(0, 120)) : "—"]; })));
    const miss = keys.filter(x => have && !headers[x]);
    if (miss.length) h += rSec("🔧", "How to add the missing headers", `<div class="tpr-code">${miss.map(x => `<div><small>${esc(HDR_INFO[x][0])}</small><code>${esc(HDR_INFO[x][2])}</code></div>`).join("")}</div>` + rPara("<b>Nginx example:</b>") + `<pre class="tpr-pre">${esc(miss.map(x => HDR_INFO[x][3]).join("\n"))}</pre>`);
    if (leaks.length) h += rSec("🔓", "Information leakage", rList(leaks.map(esc).map(x => x + " — reveals server software; hide or genericise it."), "tpr-mini") + rPara("Version banners help attackers pick exploits. Remove or minimise them."));
    if (o) h += rSec("🦊", "Mozilla HTTP Observatory", rTiles([["Grade", badge(g, gk)], ["Score", o.score + "/100"], ["Tests passed", `${o.tests_passed}/${o.tests_quantity}`], ["Tests failed", String(o.tests_failed)]]) + (o.details_url ? rPara(link(o.details_url, "Open the full Observatory report")) : ""));
    setR("headerResult", "headers", "Security headers report", host, summary, h, k);
};

/* ============================================================
   SSL / TLS CERTIFICATE (deep)
   ============================================================ */
window.checkSSL = async function () {
    let host; try { host = parseHost(val("sslInput")); } catch (_) { return fail("sslResult", "Enter a domain, e.g. https://bank.com"); }
    if (!isDomain(host)) return fail("sslResult", "Enter a valid public domain.");
    busy("sslResult", "Testing TLS handshake & reading certificate transparency logs…");
    const t0 = performance.now();
    const hs = fetch(`https://${host}/`, { mode: "no-cors", cache: "no-store" }).then(() => ({ ok: true, ms: Math.round(performance.now() - t0) })).catch(() => ({ ok: false }));
    const [h0, ct] = await Promise.all([Promise.race([hs, sleep(9000).then(() => ({ ok: false, timeout: true }))]), ctCerts(host).catch(() => null)]);
    const now = Date.now(), list = ct ? [...ct].sort((a, b) => b.from - a.from) : [], match = list.filter(c => c.names.some(n => n === host || (n.startsWith("*.") && host.endsWith(n.slice(1)))));
    const latest = (match.length ? match : list)[0] || null;
    let state = h0.ok ? "success" : "danger"; const P = [];
    const add = (sev, title, why) => P.push({ sev, title, why });
    add(h0.ok ? "good" : "critical", h0.ok ? `Browser trusts this certificate (handshake ${h0.ms} ms)` : "Secure connection FAILED", h0.ok ? "Your browser completed a TLS handshake and accepted the certificate chain." : h0.timeout ? "The connection timed out." : "The certificate may be expired, self-signed, for the wrong name, or the site has no HTTPS. Do not click through browser warnings.");
    let days = null, life = null;
    if (latest) {
        days = Math.floor((latest.to - now) / 864e5); life = Math.round((latest.to - latest.from) / 864e5);
        if (days < 0) { state = "danger"; add("critical", `Latest logged certificate EXPIRED ${-days} days ago`, "Expired certificates trigger browser warnings and can indicate neglected or abandoned sites."); }
        else if (days < 14) { if (state === "success") state = "warning"; add("high", `Expires in ${days} days`, "Renew soon. Automatic renewal (ACME) avoids outages."); }
        else if (days < 30) { if (state === "success") state = "warning"; add("medium", `Expires in ${days} days`, "Plan renewal. Most automated systems renew about 30 days before."); }
        else add("good", `${days} days of validity left`, "Certificate is comfortably within its validity period.");
        if (/let'?s encrypt|r3|r10|r11|e5|e6|zerossl/i.test(latest.issuer)) add("info", `Issued by ${latest.issuer} (free, automated)`, "Domain-validated certificates prove control of the domain, not the identity or honesty of the owner. Phishing sites use them too.");
        if (latest.names.some(n => n.startsWith("*."))) add("info", "Wildcard certificate", "Covers every subdomain. Convenient, but one stolen key exposes all of them.");
        if (life > 400) add("medium", `Long certificate lifetime (${life} days)`, "Browsers now limit lifetimes; very long certificates are legacy and riskier if the key leaks.");
        if (latest.names.length > 30) add("low", `Covers ${latest.names.length} names`, "A shared certificate for many unrelated names is typical of cheap shared hosting or CDNs.");
        const recent = list.filter(c => now - c.from < 90 * 864e5).length; if (recent > 6) add("medium", `${recent} certificates issued in the last 90 days`, "Frequent re-issuing can mean misconfigured automation or someone repeatedly regenerating keys.");
    } else add("info", "No certificate history found", "Certificate Transparency logs returned nothing, or the log service was slow.");
    const kk = state === "success" ? "ok" : state === "warning" ? "warn" : "bad", pct = days == null ? (h0.ok ? 70 : 10) : Math.max(0, Math.min(100, Math.round(days / 90 * 100)));
    const summary = verdict(state === "success" ? "🔒" : state === "warning" ? "⏳" : "🔓", state === "success" ? "HTTPS looks healthy" : state === "warning" ? "Certificate needs attention" : "TLS problem detected", state, esc(host)) + kv([["Handshake", h0.ok ? badge(`trusted · ${h0.ms} ms`, "ok") : badge("FAILED", "danger")], latest ? ["Issuer", esc(latest.issuer)] : null, latest ? ["Expires", `${fmtDate(latest.to)} ` + badge(days < 0 ? "expired" : days + " days left", days < 14 ? "danger" : days < 30 ? "warn" : "ok")] : null]);
    let h = rHero(state === "success" ? "🔒" : "🔓", esc(host), h0.ok ? "Trusted HTTPS connection" : "HTTPS connection failed", kk, rGauge(pct, days == null ? "status" : "days left (of 90)", kk));
    h += rSec("🧾", "Findings explained", P.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).map(rSignal).join(""));
    if (latest) h += rSec("📜", "Newest certificate", rTiles([["Issuer", esc(latest.issuer)], ["Valid from", fmtDate(latest.from)], ["Valid until", fmtDate(latest.to)], ["Lifetime", life + " days"], ["Names covered", String(latest.names.length)], ["Days remaining", days < 0 ? badge("expired", "danger") : String(days)]]) + (latest.names.length ? `<div class="tp-sub">Names on the certificate</div>` + chips(latest.names.slice(0, 30), "info") : ""));
    if (list.length) h += rSec("🕰️", "Certificate history (public log)", rTable(["Issued", "Expires", "Issuer", "Names"], list.slice(0, 10).map(c => [fmtDate(c.from), fmtDate(c.to), esc(c.issuer), String(c.names.length)])) + rPara("Certificate Transparency logs are public and append-only, so even attackers cannot hide certificates issued for a name."));
    h += rSec("🧰", "Go deeper", `<div class="tpr-links">${[["SSL Labs full test", "https://www.ssllabs.com/ssltest/analyze.html?d=" + host], ["crt.sh log search", "https://crt.sh/?q=" + host], ["Security headers audit", "https://securityheaders.com/?q=" + host]].map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`).join("")}</div>` + rPara("A valid padlock only means the connection is encrypted. It does not prove the site is trustworthy."));
    setR("sslResult", "ssl", "TLS certificate report", host, summary, h, state);
};

/* ============================================================
   EXTRA INSIGHTS for the remaining tools (collapsible)
   ============================================================ */
function addDetails(id, title, html) {
    const el = $(id); if (!el || el.querySelector(".tp-busy") || el.querySelector(".tp-extra")) return;
    const d = `<details class="tp-det tp-extra"><summary>${title}</summary><div>${html}</div></details>`, act = el.querySelector(".tp-actions");
    act ? act.insertAdjacentHTML("beforebegin", d) : el.insertAdjacentHTML("beforeend", d);
}
function wrapTool(name, fn) { const o = window[name]; if (typeof o !== "function") return; window[name] = async function () { const r = await o.apply(this, arguments); try { fn.apply(null, arguments); } catch (_) { } return r; }; }
const CLAIMS = { iss: "Issuer: who created and signed the token.", sub: "Subject: the user or account the token is about.", aud: "Audience: which service the token is meant for. APIs must check it.", exp: "Expiry time. After this the token must be rejected.", nbf: "Not before: token is not valid until this time.", iat: "Issued at: when the token was created.", jti: "Unique token ID, used to block replays.", scope: "Permissions granted to the token.", scp: "Permissions granted to the token.", roles: "Roles the user has (admin, user…). Never trust without verifying the signature.", role: "User role. Verify signature first.", email: "User email address.", name: "User display name.", azp: "Authorised party (client that requested the token).", nonce: "Value that links the token to a login request (anti-replay).", auth_time: "When the user actually authenticated.", sid: "Session ID.", typ: "Token type.", kid: "Key ID: which key signed the token.", amr: "How the user authenticated (password, otp…)." };
wrapTool("decodeJWT", () => {
    const jwt = val("jwtInput").replace(/^Bearer\s+/i, ""), parts = jwt.split("."); if (parts.length !== 3) return;
    const dec = new TextDecoder(); let p; try { p = JSON.parse(dec.decode(b64uBytes(parts[1]))); } catch (_) { return; }
    const keys = Object.keys(p);
    addDetails("jwtResult", "📖 What each claim means", rTable(["Claim", "Value", "Meaning"], keys.slice(0, 18).map(k => [code(k), code(JSON.stringify(p[k]).slice(0, 60)), esc(CLAIMS[k] || "Custom claim defined by the application.")])) + `<div class="tp-sub">Security reminders</div>` + rList(["A JWT is <b>signed, not encrypted</b>: anyone can read this payload.", "Always verify the signature and check <code>exp</code>, <code>aud</code> and <code>iss</code> on the server.", "Prefer RS256/ES256 for tokens verified by many services; HS256 secrets must be long and random.", "Never put passwords or secrets inside a JWT."], "tpr-mini"));
});
wrapTool("validateIBAN", () => {
    const iban = val("ibanInput").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return;
    const cc = iban.slice(0, 2), re = iban.slice(4) + iban.slice(0, 4), conv = re.replace(/[A-Z]/g, c => c.charCodeAt(0) - 55);
    addDetails("ibanResult", "🧩 Structure & how validation works", rTable(["Part", "Value", "Meaning"], [["Country code", code(cc), "ISO country of the account"], ["Check digits", code(iban.slice(2, 4)), "Two digits that catch typing mistakes (MOD-97)"], ["BBAN (rest)", code(iban.slice(4)), cc === "PK" ? "4-letter bank code + 16-character account number" : "Domestic bank + account identifier"]]) + rList(["Move the first 4 characters to the end: <code>" + esc(re.slice(0, 28)) + "…</code>", "Replace letters with numbers (A=10 … Z=35): <code>" + esc(conv.slice(0, 32)) + "…</code>", "Divide by 97. If the remainder is <b>1</b>, the IBAN is structurally valid."], "tpr-mini") + `<p class="tp-note">A valid IBAN can still belong to a scammer. Always confirm the beneficiary name with the person or company through a known number.</p>`);
});
wrapTool("calculateCIDR", () => {
    const raw = val("cidrInput").trim(), m = /^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/.exec(raw); if (!m || !isIPv4(m[1])) return;
    const pre = +m[2]; if (pre > 30 || pre < 1) return;
    const host = BigInt(32 - pre), mask = ((1n << 32n) - 1n) ^ ((1n << host) - 1n), net = ip4n(m[1]) & mask;
    const kids = []; for (let i = 0n; i < 4n && pre <= 28; i++) kids.push(`${n4ip(net + i * (1n << (host - 2n)))}/${pre + 2}`);
    const halves = [`${n4ip(net)}/${pre + 1}`, `${n4ip(net + (1n << (host - 1n)))}/${pre + 1}`];
    const sup = `${n4ip(net & (mask << 1n & 0xffffffffn))}/${pre - 1}`;
    addDetails("cidrResult", "🧮 Splitting, merging & special ranges", rTable(["Operation", "Result"], [["Split in 2", halves.map(code).join(" ")], pre <= 28 ? ["Split in 4", kids.map(code).join(" ")] : null, ["Merge up (supernet)", code(sup)], ["Equivalent /24 networks", pre <= 24 ? num(Math.pow(2, 24 - pre)) : "less than one /24"]].filter(Boolean)) + rList(["<b>10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16</b> are private (RFC 1918).", "<b>100.64.0.0/10</b> is carrier-grade NAT (many users share one public IP).", "<b>169.254.0.0/16</b> is link-local (device found no DHCP server).", "Subnet math: usable hosts = 2<sup>(32-prefix)</sup> − 2."], "tpr-mini"));
});
wrapTool("checkBIN", () => {
    const raw = ($("binInput")?.value || "").replace(/\D/g, ""); if (raw.length < 6 || raw.length > 8) return;
    const mii = { 1: "Airlines", 2: "Airlines / financial", 3: "Travel & entertainment (Amex, Diners)", 4: "Banking / financial (Visa)", 5: "Banking / financial (Mastercard)", 6: "Merchandising & banking (Discover, UnionPay, RuPay)", 7: "Petroleum", 8: "Healthcare / telecom", 9: "Government / national" }[raw[0]] || "Other";
    addDetails("binResult", "💳 How to read a card number", rTable(["Part", "Digits", "Meaning"], [["Major Industry Identifier", code(raw[0]), esc(mii)], ["Issuer ID number (BIN/IIN)", code(raw.slice(0, 6)), "Identifies the card network and issuing bank"], ["Account identifier", "digits 7 to second-last", "The cardholder's account within that bank"], ["Check digit", "last digit", "Verified by the Luhn algorithm to catch typos"]]) + `<p class="tp-note">The BIN alone cannot be used to charge a card. Never type your <b>full card number, CVV or PIN</b> into any lookup tool.</p>`);
});
wrapTool("checkMAC", () => {
    const raw = val("macInput").replace(/[^0-9a-f]/gi, "").toLowerCase(); if (raw.length !== 12) return;
    const b0 = parseInt(raw.slice(0, 2), 16) ^ 2, eui = (b0.toString(16).padStart(2, "0") + raw.slice(2, 6) + "fffe" + raw.slice(6)).match(/.{4}/g).join(":").replace(/(^|:)0+(?=\w)/g, "$1");
    addDetails("macResult", "🔌 Formats, structure & IPv6 link", rTable(["Format", "Value"], [["Colon", code(raw.match(/.{2}/g).join(":"))], ["Dash (Windows)", code(raw.match(/.{2}/g).join("-").toUpperCase())], ["Cisco dot", code(raw.match(/.{4}/g).join("."))], ["Plain", code(raw)], ["OUI (vendor)", code(raw.slice(0, 6).toUpperCase())], ["Device part (NIC)", code(raw.slice(6).toUpperCase())], ["IPv6 link-local (EUI-64)", code("fe80::" + eui)]]) + `<p class="tp-note">The first 3 bytes identify the manufacturer. Phones now often use <b>random private MACs</b> per Wi-Fi network, so the vendor may show as unknown.</p>`);
});
wrapTool("checkSQLi", () => {
    const t = $("sqliResult")?.textContent || ""; if (!/threat score/i.test(t)) return;
    addDetails("sqliResult", "🛡️ Secure code examples (parameterised queries)", `<div class="tpr-code"><div><small>Python (psycopg2 / sqlite3)</small><code>cur.execute("SELECT * FROM users WHERE email = %s", (email,))</code></div><div><small>PHP (PDO)</small><code>$s = $pdo-&gt;prepare("SELECT * FROM users WHERE email = ?"); $s-&gt;execute([$email]);</code></div><div><small>Node.js (mysql2)</small><code>await db.execute("SELECT * FROM users WHERE email = ?", [email]);</code></div><div><small>Java (JDBC)</small><code>PreparedStatement ps = c.prepareStatement("SELECT * FROM users WHERE email = ?"); ps.setString(1, email);</code></div></div><p class="tp-note">Never build SQL by joining strings. Also use least-privilege DB accounts, hide detailed errors, and validate input types.</p>`);
});
wrapTool("generateHash", () => {
    if (!$("hashResult")?.querySelector(".tp-verdict.tp-success")) return;
    addDetails("hashResult", "📚 Which algorithm should I use?", rTable(["Algorithm", "Output", "Status"], [["MD5", "128-bit", badge("Broken: collisions are easy", "danger")], ["SHA-1", "160-bit", badge("Weak: collisions demonstrated", "danger")], ["SHA-256", "256-bit", badge("Secure: good default", "ok")], ["SHA-384", "384-bit", badge("Secure", "ok")], ["SHA-512", "512-bit", badge("Secure", "ok")]]) + `<p class="tp-note">Hashes check <b>integrity</b>, they do not hide data. For passwords use <b>bcrypt, scrypt or Argon2</b> (slow, salted), never a plain hash.</p>`);
});
wrapTool("handleBase64", () => addDetails("base64Result", "📖 Encoding is not encryption", `<p class="tp-note">Base64 turns bytes into safe text characters. <b>Anyone can decode it.</b> It is used in emails, JWTs, data URLs and API keys. If you see credentials in Base64, they are effectively in plain text.</p>`));
wrapTool("handleURLCodec", () => addDetails("urlCodecResult", "📖 Why URLs are encoded", `<p class="tp-note">Characters like space, <code>&amp;</code>, <code>?</code> and <code>#</code> have special meaning in URLs, so they are written as <code>%20</code>, <code>%26</code>… Attackers double-encode (<code>%2527</code>) to slip payloads past filters, so always decode fully before inspecting.</p>`));
wrapTool("sanitizeXSS", () => {
    if (!$("xssResult")?.querySelector(".tp-verdict")) return;
    addDetails("xssResult", "🧱 Defence in depth", rList(["Encode output for the exact context: HTML text, attribute, JavaScript string, URL.", "Add a strict <b>Content-Security-Policy</b>: <code>default-src 'self'; script-src 'self'; object-src 'none'</code>", "Set cookies <code>HttpOnly; Secure; SameSite=Lax</code> so injected scripts cannot steal sessions.", "Use framework auto-escaping (React, Vue, Django) and avoid <code>innerHTML</code> with user data."], "tpr-mini"));
});
wrapTool("handleAES", () => addDetails("aesResult", "🔐 How this encryption works", rList(["Your passphrase is stretched with <b>PBKDF2</b> into a 256-bit key.", "<b>AES-256-GCM</b> encrypts and also detects tampering.", "A random salt and IV are stored with the output so you can decrypt later.", "If you forget the passphrase, the data cannot be recovered."], "tpr-mini")));

/* ============================================================
   "ABOUT THIS TOOL" under every card  +  init
   ============================================================ */
const ABOUT = {
    strengthText: ["Estimates how long attackers need to guess your password and checks it against real breached-password lists.", "Bits of entropy double the work per bit. Aim for 60+ bits online and 80+ for important accounts.", "Local analysis only. A strong password reused on a hacked site is still unsafe."],
    breachResult: ["Checks whether an email appears in public data breaches, and analyses the address, mail provider and spoofing protection.", "Open the full report for every breach, what was exposed and a prioritised action plan.", "No database is complete. A clean result is not a guarantee."],
    urlResult: ["Examines a link for scam signals: look-alike brands, fake characters, domain age, server location and certificate history.", "Higher score = more warning signs. Read each reason; the explanation says why scammers do it.", "It never opens the page. Brand-new scam sites may not be flagged anywhere yet."],
    ipResult: ["Shows where an IP is, who owns the network, whether it is a VPN or data centre, and what services it exposes.", "Location is city-level and approximate. The abuse contact is who you report problems to.", "Private addresses (192.168.x.x) cannot be located."],
    genPassOutput: ["Creates random passwords with your browser's secure random generator.", "Use 16+ characters and turn off 'no look-alikes' only if a site demands specific symbols.", "Passwords are created locally and never sent anywhere."],
    jwtResult: ["Decodes a JSON Web Token and flags risky settings such as alg=none or missing expiry.", "Check exp, aud and iss, and verify the signature on your server.", "Decoding is not verification. Do not paste live production tokens."],
    base64Result: ["Encodes and decodes Base64 with correct UTF-8 handling and URL-safe detection.", "If decoded data is JSON or a URL, treat it with the same caution as the original.", "Base64 is encoding, not encryption."],
    hashResult: ["Calculates MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of any text.", "Same text always gives the same hash. A single changed character changes everything.", "Not for storing passwords."],
    urlCodecResult: ["Encodes and decodes URLs, shows query parameters and detects double-encoding tricks.", "Look for hidden scripts or path traversal after decoding.", "Works locally."],
    portScanResult: ["Looks up which services a public host exposes using internet-wide scan data.", "Each port is explained with its risk and how to fix it.", "Passive data, not a live scan. Scan only systems you own."],
    uaResult: ["Reads what websites can learn about your browser and device and estimates how unique your fingerprint is.", "Higher privacy score is better. Fix the red items first.", "Everything is read locally except your IP lookup."],
    dnsResult: ["Audits a domain's DNS: records, DNSSEC, SPF/DKIM/DMARC email security, providers and registration.", "Email grade A-F shows how easy it is to spoof the domain's email.", "DKIM selectors are guessed, so a missing DKIM is not conclusive."],
    headerResult: ["Checks the security headers a website sends and explains how to add the missing ones.", "Missing headers raise the risk of XSS and clickjacking.", "Some sites block automated checks."],
    binResult: ["Identifies the card network, type and issuing bank from the first 6-8 digits.", "A mismatch between card country and the seller's claim can signal fraud.", "Never enter a full card number."],
    qrResult: ["Reads a QR code image or text and analyses links, payment (Raast/EMV) QR codes, Wi-Fi and more.", "For payment QR, confirm the merchant name in your banking app before paying.", "Scanning to receive money never needs a PIN."],
    sslResult: ["Tests whether your browser trusts a site's certificate and shows its public history.", "Expiry, issuer and recent re-issues tell you how well it is maintained.", "A padlock proves encryption, not honesty."],
    subdomainResult: ["Finds subdomains from public certificate logs and checks which ones are live.", "Look for forgotten dev, admin and test hosts.", "Passive discovery; not every subdomain appears."],
    macResult: ["Identifies a device maker from a MAC address and explains private/random addresses.", "Locally-administered MACs are random, so no vendor exists.", "Vendor lookups use public registries."],
    fileHashResult: ["Computes SHA hashes of a file locally, compares with a hash you provide and checks known-file databases.", "A match with the publisher's hash proves the file is unchanged.", "The file is never uploaded."],
    aesResult: ["Encrypts or decrypts text with AES-256-GCM in your browser.", "Use a long passphrase and keep it safe.", "Lost passphrase = lost data."],
    cidrResult: ["Calculates network, broadcast, host range and masks for IPv4 and IPv6 CIDR blocks.", "Use it for firewall rules and network planning.", "Pure local math."],
    pingResult: ["Measures real HTTPS round-trip time to a host with jitter and loss.", "Lower and steadier is better.", "Browsers cannot send ICMP ping."],
    honeypotResult: ["Looks for signs that an IP is a decoy system (honeypot) using exposed-service patterns.", "Trap scores above 60 are suspicious.", "Heuristic only."],
    handleResult: ["Analyses a username or Pakistani phone number for scam patterns and operator series.", "Use the profile links to verify the account yourself.", "Cannot read private data from social platforms."],
    extResult: ["Rates file-name risk and detects double extensions and hidden characters; can check a file's real type.", "Anything executable or macro-enabled deserves caution.", "Names can lie; real content is checked only for files you pick."],
    ibanResult: ["Validates IBAN structure with MOD-97 and identifies Pakistani bank codes.", "Valid format does not mean the account exists or who owns it.", "Confirm the beneficiary name before paying."],
    wifiResult: ["Rates Wi-Fi security settings (WEP, WPA, WPA2, WPA3, WPS) and gives fixes.", "Prefer WPA3, or WPA2 with AES and a long passphrase.", "Rule-based advice."],
    sqliResult: ["Checks text for SQL-injection patterns and shows secure code.", "Higher score = more attack-like structure.", "Pattern analysis, not a full scanner."],
    xssResult: ["Sanitizes HTML with DOMPurify and shows safe encodings for each output context.", "Neutralised vectors are listed so you learn the attack.", "Payload is parsed in an inert DOM and never executed."],
    darkwebResult: ["Searches public breach databases for an email or domain.", "Open breaches show what data leaked and when.", "Covers disclosed breaches, not private dark-web markets."]
};
function initToolsV6() {
    ensureModal();
    Object.keys(ABOUT).forEach(id => {
        const el = $(id); const card = el && el.closest(".tool-card"); if (!card || card.querySelector(".tp-about")) return;
        const [what, read, limit] = ABOUT[id];
        card.insertAdjacentHTML("beforeend", `<details class="tp-about"><summary>ℹ️ How this tool works</summary><div><p><b>What it does:</b> ${esc(what)}</p><p><b>How to read it:</b> ${esc(read)}</p><p><b>Limits:</b> ${esc(limit)}</p></div></details>`);
    });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToolsV6); else initToolsV6();


/* ============================================================================
   FULL REPORT FOR ALL 30 TOOLS
   8 tools build their own deep report above. The other 22 get an automatic
   "Open full report": your live result + knowledge base (what, how, abuse, defend).
   ============================================================================ */
const TOOLKB = {
    strengthText: { ic: "🔐", title: "Password strength report", what: "Password strength measures how hard a password is to guess. It depends mostly on length and unpredictability, not on clever symbol swaps. Tools estimate this as 'entropy' in bits: every extra bit doubles the guesses an attacker needs.", how: ["Entropy ≈ length × log2(size of the character pool), then reduced for common words, keyboard patterns, repeats and years.", "Crack time depends on the attack: slow online guessing, or very fast offline guessing after a database is stolen.", "The breach check hashes your password locally and sends only the first 5 characters of the SHA-1 hash to Have I Been Pwned (k-anonymity), then compares the rest on your device."], abuse: ["Credential stuffing: attackers replay leaked passwords on other sites.", "Dictionary + rule attacks (hashcat/John) crack 'P@ssw0rd2024' style passwords in seconds.", "Phishing: even a perfect password is useless if you type it into a fake page."], defend: ["Use 15+ characters or a 4-5 word random passphrase.", "Use a different password for every account, stored in a password manager.", "Turn on 2-Step Verification, preferably passkeys or an authenticator app.", "Change any password found in a breach immediately."], terms: [["Entropy", "A measure of unpredictability in bits."], ["Brute force", "Trying every possible combination."], ["Dictionary attack", "Trying common words and variations first."], ["Credential stuffing", "Reusing leaked username/password pairs on other sites."], ["k-anonymity", "Checking a secret against a database without revealing it."], ["Passkey", "A phishing-resistant login that replaces passwords."]], links: [["NIST password guidance (SP 800-63B)", "https://pages.nist.gov/800-63-3/sp800-63b.html"], ["Have I Been Pwned: Pwned Passwords", "https://haveibeenpwned.com/Passwords"]] },
    genPassOutput: { ic: "🎲", title: "Generated password report", what: "A password generator creates unpredictable passwords using a cryptographically secure random source, so no human pattern can be guessed.", how: ["Your browser's crypto.getRandomValues() picks each character without bias.", "At least one character from each selected set is guaranteed, then the result is shuffled.", "Nothing is sent anywhere: the password exists only on your device."], abuse: ["Humans pick predictable passwords (names, dates, 'Password1!').", "Reusing one strong password across sites turns one breach into many."], defend: ["Generate a new password per site and save it straight into a password manager.", "Prefer 16+ characters. Avoid look-alike characters only when you must type it by hand.", "Never paste it into chat or email."], terms: [["CSPRNG", "Cryptographically secure random number generator."], ["Entropy", "Unpredictability measured in bits."], ["Password manager", "An encrypted vault that stores unique passwords for you."]], links: [["Password Services guide", "Services.html#app"]] },
    jwtResult: { ic: "🔑", title: "JWT security report", what: "A JSON Web Token is a signed package of claims (who you are, what you may do, when it expires) used to keep you logged in to APIs and web apps. It has three Base64URL parts: header.payload.signature.", how: ["The server signs header+payload with a secret (HS256) or private key (RS256/ES256).", "On each request it re-checks the signature and claims such as exp, aud and iss.", "Anyone can read the payload because it is encoded, not encrypted."], abuse: ["alg=none tokens sent to servers that skip signature checks.", "Brute-forcing weak HS256 secrets offline.", "kid/jku/x5u header tricks that point to attacker-controlled keys.", "Stealing tokens via XSS or logs, then replaying them until they expire."], defend: ["Verify the signature with an allow-listed algorithm, never trust the header's alg blindly.", "Use short lifetimes plus refresh-token rotation.", "Validate iss, aud, exp and nbf on every request.", "Prefer HttpOnly, Secure, SameSite cookies over localStorage.", "Use long random secrets or asymmetric keys."], terms: [["Claim", "A statement inside the token (sub, exp...)."], ["JWS", "JSON Web Signature, the signed format."], ["Bearer token", "Whoever holds it can use it."], ["kid", "Key ID that tells the server which key to verify with."]], links: [["RFC 7519: JSON Web Token", "https://datatracker.ietf.org/doc/html/rfc7519"], ["OWASP JWT cheat sheet", "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"]] },
    base64Result: { ic: "🔤", title: "Base64 report", what: "Base64 represents any bytes using 64 safe text characters (A-Z, a-z, 0-9, + and /). It makes binary data travel safely through text-only systems such as email, JSON and URLs.", how: ["Every 3 bytes become 4 characters, so data grows by about 33%.", "'=' padding fills the last group. The URL-safe variant swaps + and / for - and _.", "Decoding reverses it exactly. There is no key and no secrecy."], abuse: ["Malware hides commands (for example PowerShell -EncodedCommand) inside Base64 to evade simple filters.", "Credentials and API keys are sometimes 'protected' with Base64, which protects nothing.", "Data can be smuggled out disguised as harmless text."], defend: ["Always decode and inspect Base64 before trusting it.", "Never use Base64 as encryption.", "Log and alert on long encoded command lines in your endpoint tools."], terms: [["Encoding", "Changing format for transport. Reversible by anyone."], ["Encryption", "Hiding data with a secret key."], ["Hashing", "One-way fingerprint of data."], ["Padding", "The '=' characters at the end."]], links: [["RFC 4648: Base encodings", "https://datatracker.ietf.org/doc/html/rfc4648"]] },
    hashResult: { ic: "#️⃣", title: "Hash report", what: "A hash function turns any input into a fixed-length fingerprint. The same input always gives the same hash, and a tiny change gives a completely different one.", how: ["Algorithms such as SHA-256 process the data in blocks and mix them through many rounds.", "The result cannot be reversed to get the original (one-way).", "Comparing two hashes shows whether two files or texts are identical."], abuse: ["Attackers crack stolen password hashes with huge guess lists and rainbow tables.", "MD5 and SHA-1 have known collision attacks, so forged files can share a hash.", "Unsalted hashes reveal which users share the same password."], defend: ["Use SHA-256 or stronger for file integrity.", "Store passwords with bcrypt, scrypt or Argon2 (slow, salted), never with plain SHA.", "Use HMAC when you need authenticity, not just integrity."], terms: [["Collision", "Two different inputs with the same hash."], ["Salt", "Random data added before hashing a password."], ["HMAC", "A hash combined with a secret key."], ["Preimage", "Finding an input for a given hash."]], links: [["NIST FIPS 180-4 (SHA)", "https://csrc.nist.gov/pubs/fips/180-4/upd1/final"], ["OWASP password storage", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"]] },
    urlCodecResult: { ic: "🔗", title: "URL encoding report", what: "Percent-encoding writes characters that have special meaning in URLs (space, &, ?, #, non-ASCII) as % followed by two hex digits, such as %20.", how: ["Text is converted to UTF-8 bytes and each unsafe byte becomes %XX.", "Decoding turns each %XX back into the byte.", "Servers and filters may decode once, twice or never, which is where mistakes happen."], abuse: ["Double encoding (%252e%252e) slips past filters that decode only once.", "Encoded path traversal (%2e%2e%2f) and null bytes (%00) probe for file access.", "Encoding hides scripts or SQL in links used for phishing."], defend: ["Canonicalise input (decode fully) before validating, and validate once.", "Use well-tested URL libraries instead of hand-written filters.", "Block encoded traversal and control characters at the WAF."], terms: [["Percent-encoding", "The %XX notation."], ["Reserved characters", "Characters with special URL meaning."], ["Canonicalisation", "Converting to one standard form before checks."]], links: [["RFC 3986: URI syntax", "https://datatracker.ietf.org/doc/html/rfc3986"]] },
    binResult: { ic: "💳", title: "Card BIN report", what: "The first 6 to 8 digits of a payment card form the Bank Identification Number (BIN/IIN). It reveals the card network, type, country and issuing bank.", how: ["The first digit is the Major Industry Identifier (4 and 5 are banking cards).", "Networks assign BIN ranges to issuers, so a lookup can name the bank.", "The last digit is a Luhn check digit that catches typing mistakes."], abuse: ["Card testing: fraudsters try thousands of generated numbers with valid BINs on small payments.", "Scammers claim a card is 'from your bank' while the BIN says otherwise.", "Stolen BIN lists help craft convincing phishing for a specific bank."], defend: ["Never type your full card number, CVV or PIN into lookup tools.", "Use 3-D Secure, virtual cards and transaction alerts.", "Merchants: velocity limits, AVS/CVV checks and device fingerprinting."], terms: [["BIN / IIN", "Issuer identification number."], ["PAN", "Primary account number (the card number)."], ["Luhn algorithm", "Checksum that validates card numbers."], ["3-D Secure", "Extra cardholder authentication step."]], links: [["PCI Security Standards Council", "https://www.pcisecuritystandards.org"]] },
    qrResult: { ic: "📷", title: "QR code safety report", what: "A QR code is a picture that encodes text, usually a link, Wi-Fi login or payment request. You cannot read it by eye, so you must check what it contains before acting.", how: ["Your phone decodes the pattern and shows or opens the content.", "Payment QR codes (EMVCo style) carry merchant name, city, currency, optional amount and a CRC checksum.", "Wi-Fi QR codes carry the network name, security type and password."], abuse: ["Quishing: QR codes in emails or posters that lead to phishing pages.", "Fake sticker pasted over a shop's real payment QR.", "'Scan to receive money' tricks that actually authorise a payment out of your account.", "QR links that start an app download."], defend: ["Preview the address before opening it.", "Check the merchant name in your payment app before you enter a PIN.", "Never scan codes from random posters or unsolicited emails.", "Receiving money never needs a PIN."], terms: [["Quishing", "Phishing delivered through QR codes."], ["Static vs dynamic QR", "Reusable versus one-time payment code."], ["CRC", "Checksum that detects tampered payment data."]], links: [["EMVCo QR code specifications", "https://www.emvco.com/emv-technologies/qr-codes/"]] },
    subdomainResult: { ic: "🧭", title: "Subdomain discovery report", what: "Subdomains such as mail.example.com or dev.example.com are separate entry points. Listing them shows an organisation's external attack surface.", how: ["Every publicly trusted HTTPS certificate is recorded in Certificate Transparency logs.", "Searching those logs reveals names that have had certificates.", "A DNS lookup shows which of them currently resolve (are live)."], abuse: ["Forgotten dev/staging servers are often unpatched.", "Subdomain takeover: a DNS record pointing to a deleted cloud service can be claimed by an attacker.", "Look-alike subdomains of a real brand are used for phishing."], defend: ["Keep an inventory of every subdomain and owner.", "Delete dangling CNAME/DNS records for retired services.", "Monitor CT logs for unexpected certificates on your names.", "Avoid broad wildcard certificates for sensitive systems."], terms: [["Attack surface", "Everything an attacker can reach from outside."], ["Certificate Transparency", "Public logs of issued certificates."], ["Dangling DNS", "A record pointing to a resource that no longer exists."]], links: [["crt.sh certificate search", "https://crt.sh"], ["OWASP Amass", "https://owasp.org/www-project-amass/"]] },
    macResult: { ic: "🔌", title: "MAC address report", what: "A MAC address is a hardware identifier for a network interface (48 bits, written like AA:BB:CC:DD:EE:FF). The first 3 bytes (OUI) identify the manufacturer.", how: ["The IEEE assigns OUI prefixes to vendors.", "Bit 1 of the first byte marks multicast; bit 2 marks a locally administered (software-set) address.", "Modern phones randomise their MAC per Wi-Fi network for privacy."], abuse: ["MAC spoofing to bypass MAC-filter allow-lists.", "Tracking people in shops or airports by their phone's Wi-Fi MAC.", "Evil-twin hotspots impersonating a trusted access point."], defend: ["Do not rely on MAC filtering for security: use WPA3 or 802.1X.", "Keep private/random Wi-Fi addresses enabled on phones.", "Monitor for duplicate or unexpected MACs on your network."], terms: [["OUI", "Organisationally Unique Identifier (vendor prefix)."], ["EUI-48/64", "IEEE address formats."], ["Locally administered", "Address chosen by software, not burned in."]], links: [["IEEE OUI registry", "https://standards.ieee.org/products-programs/regauth/oui/"]] },
    fileHashResult: { ic: "🧾", title: "File integrity report", what: "A file hash is the fingerprint of a file's exact contents. If even one byte changes, the hash changes, so it proves a download was not altered or corrupted.", how: ["Your browser reads the file locally and computes SHA hashes. The file is never uploaded.", "You compare the result with the hash the publisher posted over HTTPS.", "The SHA-256 can also be looked up in public known-file databases."], abuse: ["Attackers replace installers on mirrors or compromise update servers (supply-chain attacks).", "Cracked software and fake apps often carry malware despite looking identical.", "Malware changes one byte to get a new hash and dodge simple blocklists."], defend: ["Download only from the official site and compare hashes or signatures.", "Prefer digitally signed installers and package managers.", "Scan unknown files with several engines (for example VirusTotal) without uploading private data."], terms: [["Checksum", "Short value used to detect changes."], ["Code signing", "Cryptographic proof of who published the software."], ["Supply-chain attack", "Compromising software before it reaches you."]], links: [["CIRCL hashlookup", "https://www.circl.lu/services/hashlookup/"], ["VirusTotal", "https://www.virustotal.com"]] },
    aesResult: { ic: "🔒", title: "AES encryption report", what: "AES-256-GCM is a modern authenticated encryption method. It scrambles data so only someone with the right passphrase can read it, and it detects tampering.", how: ["Your passphrase is stretched into a 256-bit key using PBKDF2 with a random salt.", "A random IV (nonce) is generated for every message and stored with the output.", "GCM mode encrypts and adds an authentication tag, so changed ciphertext fails to decrypt."], abuse: ["Short or guessable passphrases can be brute-forced offline.", "Re-using an IV with the same key breaks GCM security.", "Attackers target the key or passphrase, not the cipher."], defend: ["Use a long, random passphrase and store it in a password manager.", "Never reuse an IV. Let the tool generate it.", "Keep the original and the passphrase in separate places."], terms: [["AES", "Advanced Encryption Standard."], ["GCM / AEAD", "Mode that encrypts and authenticates."], ["IV / nonce", "Unique value per encryption."], ["PBKDF2", "Slow function that turns a passphrase into a key."]], links: [["NIST FIPS 197 (AES)", "https://csrc.nist.gov/pubs/fips/197/final"], ["NIST SP 800-38D (GCM)", "https://csrc.nist.gov/pubs/sp/800/38/d/final"]] },
    cidrResult: { ic: "🧮", title: "CIDR / subnet report", what: "CIDR notation (like 192.168.1.0/24) describes a block of IP addresses: the number after the slash is how many leading bits identify the network.", how: ["The prefix length sets the netmask. /24 = 255.255.255.0.", "Usable hosts = 2^(32 − prefix) − 2 for IPv4 (network and broadcast are reserved).", "IPv6 uses the same idea with 128-bit addresses."], abuse: ["Overly wide rules such as 0.0.0.0/0 expose services to the whole internet.", "Attackers scan entire ranges (like a /24) for open services.", "Mistakes in subnet maths cause firewall gaps or overlapping networks."], defend: ["Write allow-lists with the narrowest range possible.", "Segment networks into separate subnets by trust level.", "Review cloud security groups for 0.0.0.0/0 on admin ports."], terms: [["Netmask", "Marks the network part of an address."], ["Wildcard mask", "Inverse of the netmask, used in ACLs."], ["RFC 1918", "Private IPv4 ranges (10/8, 172.16/12, 192.168/16)."], ["CGNAT", "Carrier-grade NAT range 100.64.0.0/10."]], links: [["RFC 4632: CIDR", "https://datatracker.ietf.org/doc/html/rfc4632"], ["RFC 1918: private addresses", "https://datatracker.ietf.org/doc/html/rfc1918"]] },
    pingResult: { ic: "📡", title: "Latency & reachability report", what: "Latency is how long a round trip to a server takes. Jitter is how much that time varies, and packet loss is the share of requests that never return.", how: ["This tool measures real HTTPS round trips from your browser, because browsers cannot send ICMP ping.", "The first sample includes DNS and TLS setup, so it is excluded from the average.", "Minimum time is limited by distance: roughly 1 ms per 100 km of fibre, round trip."], abuse: ["ICMP and HTTP floods try to exhaust a server.", "Attackers ping-sweep ranges to find live hosts.", "Latency changes can reveal an attacker routing your traffic through another place."], defend: ["Rate-limit ICMP and use DDoS protection at the edge.", "Monitor latency and loss for sudden changes.", "Do not block all ICMP; some types are needed for path discovery."], terms: [["RTT", "Round-trip time."], ["Jitter", "Variation in latency."], ["Packet loss", "Percentage of lost packets."], ["TTL", "Hop limit on a packet."]], links: [["What is ICMP? (Cloudflare)", "https://www.cloudflare.com/learning/network-layer/what-is-icmp/"]] },
    honeypotResult: { ic: "🍯", title: "Honeypot detection report", what: "A honeypot is a decoy system built to attract attackers. This tool looks for patterns that make an internet host look like a decoy: too many unrelated services, ICS ports mixed with web servers, or suspicious tags.", how: ["It resolves the host and reads internet-wide scan data (Shodan InternetDB).", "It scores signals such as an abnormal port count or fake-looking service mixes.", "A higher trap score means a higher chance the host is a honeypot."], abuse: ["Skilled attackers fingerprint honeypots to avoid them or feed them false data.", "Researchers sometimes mistake honeypots for real vulnerable systems."], defend: ["Make decoys realistic: believable banners, timing and file systems.", "Isolate honeypots from production networks.", "Use honeypot data to block attackers and tune detection."], terms: [["Low/medium/high interaction", "How much of a real system the decoy emulates."], ["Cowrie", "Popular SSH/Telnet honeypot."], ["Conpot", "ICS/SCADA honeypot."], ["Dionaea", "Malware-capturing honeypot."]], links: [["The Honeynet Project", "https://www.honeynet.org"], ["Cowrie on GitHub", "https://github.com/cowrie/cowrie"]] },
    handleResult: { ic: "🕵️", title: "Scam handle / number report", what: "This check looks at a username or phone number for scam patterns: brand look-alikes, 'official/support' wording, bulk-created digit tails and operator information for Pakistani mobile numbers.", how: ["Pattern analysis compares the handle with known scam wording and brand names.", "For +92 numbers it identifies the operator series (numbers can be ported).", "Verification links let you check the profile yourself, because browsers cannot read other sites' accounts."], abuse: ["Impersonation accounts of banks, wallets, influencers and officials.", "Advance-fee scams: 'pay a fee to receive a prize or job'.", "Fake support numbers that harvest OTPs."], defend: ["Contact the organisation only through the number or link on its official website.", "Never pay to receive money or a job.", "Report scam numbers and profiles and block them."], terms: [["OSINT", "Open-source intelligence from public information."], ["Impersonation", "Pretending to be a trusted person or brand."], ["Advance-fee scam", "Asking for money upfront for a promised reward."]], links: [["FIA Cyber Crime Wing (NR3C)", "https://nr3c.gov.pk"], ["Pakistan Telecommunication Authority", "https://www.pta.gov.pk"]] },
    extResult: { ic: "📎", title: "File-extension risk report", what: "The file extension tells your computer how to open a file. Attackers disguise dangerous files with harmless-looking names such as invoice.pdf.exe.", how: ["The last extension decides the type; earlier ones are just part of the name.", "A hidden Unicode right-to-left override (U+202E) can make 'photo_gpj.exe' display as 'photo_exe.jpg'.", "'Magic bytes' at the start of the file show its real type regardless of the name."], abuse: ["Double extensions and spaces that push the real extension out of view.", "Macro-enabled Office files and shortcut (.lnk) files that run commands.", "Disk images (.iso) that bypass some download warnings."], defend: ["Turn on 'show file extensions' in your operating system.", "Block executables and scripts in email attachments.", "Open unknown documents only in a sandbox or online viewer.", "Keep macros disabled by default."], terms: [["Magic bytes", "Signature bytes identifying a file type."], ["RTLO", "Right-to-left override character."], ["Mark-of-the-Web", "Flag that marks files downloaded from the internet."]], links: [["MITRE T1036.002: RTLO", "https://attack.mitre.org/techniques/T1036/002/"]] },
    ibanResult: { ic: "🏦", title: "IBAN report", what: "An IBAN (International Bank Account Number) identifies a bank account in a standard format: country code, two check digits and a country-specific bank/account part. Pakistan's IBAN has 24 characters.", how: ["The first 4 characters move to the end and letters become numbers (A=10 … Z=35).", "The resulting number divided by 97 must leave remainder 1 (MOD-97 check).", "Country rules decide the exact length and structure."], abuse: ["Invoice fraud: criminals email a changed IBAN pretending to be a supplier.", "A valid-looking IBAN can still belong to a mule account.", "Fake IBANs fail the checksum, which is why validation helps catch typos."], defend: ["Confirm any new or changed bank details by phoning a known number.", "Check the beneficiary name in your banking app before paying.", "Require dual approval for new payees."], terms: [["BBAN", "Basic Bank Account Number inside the IBAN."], ["MOD-97", "The checksum used for IBANs."], ["BEC", "Business email compromise."]], links: [["SWIFT: IBAN", "https://www.swift.com/standards/data-standards/iban-international-bank-account-number"]] },
    wifiResult: { ic: "📶", title: "Wi-Fi security report", what: "Wi-Fi security protocols protect traffic between your device and the router. From weakest to strongest: Open, WEP, WPA, WPA2, WPA3.", how: ["WPA2-AES (CCMP) encrypts traffic with a key derived from your passphrase.", "WPA3 uses SAE, which resists offline guessing of the passphrase.", "WPS lets devices connect with a short PIN, which can be brute-forced."], abuse: ["Evil-twin hotspots copy a real network name to capture traffic.", "Captured WPA2 handshakes are cracked offline if the passphrase is weak.", "WPS PIN attacks and deauthentication floods disconnect and trick users."], defend: ["Use WPA3, or WPA2 with AES only and a 16+ character passphrase.", "Disable WPS and keep router firmware updated.", "Use a guest network for visitors and smart-home devices.", "Avoid sensitive logins on public Wi-Fi, or use a trusted VPN."], terms: [["SAE", "Simultaneous Authentication of Equals (WPA3)."], ["TKIP / CCMP", "Older / current encryption ciphers."], ["PSK", "Pre-shared key (the Wi-Fi password)."], ["802.1X", "Per-user enterprise authentication."]], links: [["Wi-Fi Alliance security", "https://www.wi-fi.org/discover-wi-fi/security"]] },
    sqliResult: { ic: "💉", title: "SQL injection report", what: "SQL injection happens when user input is glued into a database query, letting an attacker change the query and read, change or delete data.", how: ["A form field such as a login box is concatenated into SQL text.", "A payload like ' OR '1'='1 closes the string and adds an always-true condition.", "UNION, stacked queries and time delays let attackers extract data even when errors are hidden (blind injection)."], abuse: ["Login bypass and account takeover.", "Dumping whole tables (users, cards, personal data).", "On some systems, reading files or running operating-system commands."], defend: ["Always use parameterised queries / prepared statements.", "Use an ORM correctly and validate input types.", "Run the database account with least privilege.", "Hide detailed error messages and add a WAF as a second layer."], terms: [["Tautology", "Always-true condition such as 1=1."], ["UNION injection", "Appending a second SELECT to leak data."], ["Blind SQLi", "Inferring data from true/false or timing."], ["Prepared statement", "Query with placeholders, separate from data."]], links: [["OWASP: SQL Injection", "https://owasp.org/www-community/attacks/SQL_Injection"], ["OWASP prevention cheat sheet", "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"]] },
    xssResult: { ic: "🧼", title: "XSS & sanitization report", what: "Cross-Site Scripting lets an attacker run their JavaScript inside another user's browser session by injecting it into a page.", how: ["Reflected XSS: the payload is in a link and echoed back by the server.", "Stored XSS: the payload is saved (comments, profiles) and runs for every visitor.", "DOM XSS: client-side code writes untrusted data into the page, for example with innerHTML."], abuse: ["Stealing session cookies or tokens.", "Keylogging and fake login pop-ups.", "Performing actions as the victim, or spreading as a worm."], defend: ["Encode output for the exact context: HTML, attribute, JavaScript, URL.", "Sanitise rich HTML with DOMPurify.", "Add a strict Content-Security-Policy.", "Set cookies HttpOnly; Secure; SameSite.", "Avoid innerHTML and eval with untrusted data."], terms: [["Sanitisation", "Removing dangerous parts of HTML."], ["Output encoding", "Escaping characters so they display as text."], ["CSP", "Header that restricts where scripts can load from."], ["DOM", "The page structure your browser builds."]], links: [["OWASP: XSS", "https://owasp.org/www-community/attacks/xss/"], ["OWASP XSS prevention cheat sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"]] },
    darkwebResult: { ic: "🕳️", title: "Breach & dark-web exposure report", what: "Data breaches leak emails, passwords and personal details. Criminals trade this data on forums and markets, which is often called the 'dark web'. This tool searches public breach databases, not private criminal markets.", how: ["Breach services collect disclosed leaks and index the affected emails and domains.", "A domain search lists breaches where that organisation's data appeared.", "Each breach lists what data types were exposed and when."], abuse: ["Credential stuffing with leaked passwords on other sites.", "Targeted phishing that quotes real details from the leak.", "Identity theft and SIM-swap fraud using exposed personal data.", "'Stealer logs' from infected computers sold in bulk."], defend: ["Use a unique password everywhere and enable MFA.", "Change passwords for affected sites and anywhere they were reused.", "Subscribe to breach notifications and monitor accounts for odd activity.", "Companies: force resets, notify users and reduce stored personal data."], terms: [["Credential stuffing", "Reusing leaked logins on other sites."], ["Combolist", "A list of leaked email:password pairs."], ["Stealer logs", "Data stolen by malware from infected devices."], ["Paste site", "Public text-sharing sites where leaks appear."]], links: [["Have I Been Pwned", "https://haveibeenpwned.com"], ["XposedOrNot", "https://xposedornot.com"]] }
};
function buildAuto(id) {
    const kb = TOOLKB[id], el = id === "genPassOutput" ? $("genMeta") : $(id); if (!kb) return;
    const card = (el || $("genPassOutput")).closest(".tool-card"), st = card ? card.dataset.state : "info", kk = st === "danger" ? "bad" : st === "warning" ? "warn" : st === "success" ? "ok" : "ok";
    let snap = "";
    if (id === "genPassOutput") {
        const pw = $("genPassOutput").value || "", a = pw ? analyzePassword(pw) : null;
        snap = a ? `<div class="tp-verdict tp-success"><span class="tp-vi">🎲</span><div><b>${esc(pw)}</b><small>${pw.length} characters · ${a.bits.toFixed(0)} bits of entropy · strength ${a.score}/100</small></div></div>` + kv([["Time to crack (offline GPU farm, 1T guesses/s)", fmtDuration(Math.pow(2, Math.max(a.bits - 1, 0)) / 1e12)], ["Time to crack (fast hash, 10B guesses/s)", fmtDuration(Math.pow(2, Math.max(a.bits - 1, 0)) / 1e10)], ["Character pool", String(a.pool)]]) : `<p class="tpr-p">Generate a password first, then open this report.</p>`;
    } else {
        const c = el.cloneNode(true); c.querySelectorAll(".tp-actions,.tp-open,.tp-busy").forEach(x => x.remove()); snap = `<div class="tpr-snap">${c.innerHTML}</div>`;
    }
    const msg = { success: ["✅", "Result looks healthy", "No serious problem was found by this check. A clean result is not a guarantee, so keep good habits."], warning: ["⚠️", "Something needs attention", "The check found points worth fixing or verifying. Read the details and the defence steps below."], danger: ["🚨", "Risk detected", "This check found a significant problem. Follow the defence steps below and verify through official channels."], info: ["ℹ️", "Information", "This result is informational. Use the knowledge below to understand it."] }[st] || ["ℹ️", "Information", ""];
    let h = rHero(kb.ic, esc(kb.title), `${msg[1]} · ${esc(msg[2])}`, kk, "") + rSec("🧾", "Your result (live snapshot)", snap) + rSec("📖", "What is this?", rPara(esc(kb.what))) + rSec("⚙️", "How it works", rSteps(kb.how.map(esc))) + rSec("🎯", "How attackers abuse it", rList(kb.abuse.map(esc))) + rSec("🛡️", "How to defend", rSteps(kb.defend.map(esc))) +
        rSec("🧠", "Key terms", rTable(["Term", "Meaning"], kb.terms.map(([a, b]) => [`<b>${esc(a)}</b>`, esc(b)]))) + rSec("🔗", "Learn more", `<div class="tpr-links">${kb.links.map(([t, u]) => `<a href="${esc(u)}" ${/^https?:/.test(u) ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(t)}${/^https?:/.test(u) ? " ↗" : ""}</a>`).join("")}</div>`) +
        rPara("<small>Educational summary. Always confirm important decisions through official sources.</small>");
    REPORTS["auto:" + id] = { title: kb.title, sub: "Full report · live result + knowledge base", html: h };
}
function decorateAuto(id) {
    const el = $(id); if (!el || el.querySelector(".tp-busy") || el.querySelector(".tp-open")) return;
    const rich = el.querySelector(".tp-kv, .tp-chips, .tp-meter, pre, code, table, .pw-structure, .tp-sub"), txt = el.innerText.trim();
    if (id === "aesResult" ? txt.length < 40 : (!el.querySelector(".tp-verdict") || (!rich && txt.length < 80))) return;
    let act = el.querySelector(".tp-actions"); if (!act) { el.insertAdjacentHTML("beforeend", `<div class="tp-actions"></div>`); act = el.querySelector(".tp-actions"); }
    act.insertAdjacentHTML("afterbegin", `<button type="button" class="tp-open" data-report="auto:${id}">📄 Open full report</button>`);
}
function initAutoReports() {
    Object.keys(TOOLKB).forEach(id => {
        if (id === "genPassOutput") return;
        const el = $(id); if (!el) return; let t = null;
        new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => decorateAuto(id), 120); }).observe(el, { childList: true });
    });
    const gen = $("genPassOutput");
    if (gen && !$("genReportBtn")) { const row = gen.closest(".tool-card").querySelector("#genMeta") || gen.closest(".input-group"); (row || gen).insertAdjacentHTML("afterend", `<div class="tp-actions" style="margin-top:8px"><button type="button" id="genReportBtn" class="tp-open" data-report="auto:genPassOutput">📄 Open full report</button></div>`); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(initAutoReports, 400)); else setTimeout(initAutoReports, 400);

/* ---- Embedded QR encoder: "QRCode for JavaScript" (c) 2009 Kazuhiko Arase, MIT license
   (via qrcode-terminal 0.12.0 vendor copy). The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED. ---- */
const CG_QRLIB = (function () {
    const S = {}, C = {};
    const req = n => { n = String(n).replace(/^\.\//, "").replace(/\.js$/, ""); if (C[n]) return C[n].exports; const m = C[n] = { exports: {} }; S[n](m, m.exports, req); return m.exports; };
    S['QRMode'] = function (module, exports, require) {
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

    };
    S['QR8bitByte'] = function (module, exports, require) {
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

    };
    S['QRMath'] = function (module, exports, require) {
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

    };
    S['QRPolynomial'] = function (module, exports, require) {
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

    };
    S['QRMaskPattern'] = function (module, exports, require) {
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

    };
    S['QRUtil'] = function (module, exports, require) {
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

    };
    S['QRErrorCorrectLevel'] = function (module, exports, require) {
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


    };
    S['QRRSBlock'] = function (module, exports, require) {
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

    };
    S['QRBitBuffer'] = function (module, exports, require) {
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

    };
    S['index'] = function (module, exports, require) {
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

    };
    return { QRCode: req('index'), Level: req('QRErrorCorrectLevel') };
})();

/* ============================================================================
   TOOLS v7  -  5 NEW TOOLS (31-35)
   31 Scam Message Analyzer · 32 Email Header Analyzer · 33 Photo Metadata Scanner & Cleaner
   34 QR Studio (safe QR generator) · 35 Sensitive Data Redactor
   Everything runs locally in your browser. Only the optional IP look-up in tool 32
   contacts a public service (ipwho.is).
   ============================================================================ */
const defang = s => String(s).replace(/^http/i, "hxxp").replace(/:\/\//, "[://]").replace(/\./g, "[.]");
const refang = s => String(s).replace(/^hxxp/i, "http").replace(/\[:\/\/\]/g, "://").replace(/\[\.\]/g, ".").replace(/\[:\]/g, ":").replace(/\(\.\)/g, ".");
const dlBlob = (name, data, mime) => { const a = document.createElement("a"); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime || "text/plain" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
const fmtBytes = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB";
function mergeRanges(rs) { rs = rs.slice().sort((a, b) => a.s - b.s || b.e - a.e); const out = []; rs.forEach(r => { const l = out[out.length - 1]; if (l && r.s < l.e) { if (r.e > l.e) l.e = r.e; if (SEV_ORDER[r.sev] < SEV_ORDER[l.sev]) { l.sev = r.sev; } l.t.push(r.t); } else out.push({ s: r.s, e: r.e, sev: r.sev, t: [r.t] }); }); return out; }
function highlightText(text, ranges) {
    let h = "", p = 0; mergeRanges(ranges).forEach(r => { h += esc(text.slice(p, r.s)) + `<mark class="tp-hl tp-hl-${r.sev}" title="${esc([...new Set(r.t)].join(" · "))}">${esc(text.slice(r.s, r.e))}</mark>`; p = r.e; });
    return h + esc(text.slice(p));
}

/* ============================================================
   31. SCAM MESSAGE ANALYZER
   ============================================================ */
const NEG_BEFORE = /(do not|don'?t|dont|never|please do not|kabhi na|kabhi nahi|mat)\s+$/i;
const SCAM_RULES = [
    { id: "otp", cat: "Credential / OTP theft", sev: "critical", w: 36, tactic: "Authority + urgency", neg: true,
      re: /\b(share|send|tell|give|provide|read out|forward|reply with|bata(?:o|en|ye|iye)?|bhej(?:o|en|iye)?|batana|dena)\b[^.\n]{0,45}\b(otp|pin|cvv|cvc|mpin|one[- ]?time (?:password|code)|verification code|security code|6[- ]digit code|passcode)\b/gi,
      title: "Asks you to hand over an OTP, PIN or security code", why: "An OTP or PIN is the final key to your account or money. Real banks, wallets and telecoms never ask you to read it out, send it by message or tell it to an agent." },
    { id: "creds", cat: "Personal-data / KYC harvesting", sev: "high", w: 26, tactic: "Authority", neg: false,
      re: /\b(send|share|enter|confirm|verify|update|upload|provide|submit|bhej(?:o|en)?)\b[^.\n]{0,50}\b(password|login details|cnic|nic number|id card|identity card|card number|account number|selfie|biometric|kyc|date of birth|mother'?s? maiden|ssn|passport)\b/gi,
      title: "Requests sensitive personal or account details", why: "Scammers collect ID numbers, card data and selfies for identity theft and account takeover. Genuine KYC updates happen inside the official app or branch." },
    { id: "urgency", cat: "Pressure & urgency", sev: "medium", w: 16, tactic: "Urgency", neg: false,
      re: /\b(urgent(?:ly)?|immediately|right now|act now|asap|within \d+ ?(?:hours?|hrs?|minutes?|mins?|days?)|last chance|final (?:warning|notice|reminder)|expires? (?:today|soon|tonight)|only \d+ (?:hours?|minutes?) left|limited time|hurry|jaldi|foran|abhi|aaj hi|warna|fauran)\b/gi,
      title: "Creates time pressure", why: "A deadline stops you from thinking and from checking with someone you trust. Real organisations give written notice and official channels, not 'reply in 10 minutes'." },
    { id: "threat", cat: "Fear & threats", sev: "high", w: 22, tactic: "Fear", neg: false,
      re: /\b(?:(?:account|sim|card|wallet|number|line|service|connection)\b[^.\n]{0,30}\b(?:will be|has been|is being|ho ga|hogi|ho jaye ga)\b[^.\n]{0,20}\b(?:blocked?|suspended|closed|deactivated|terminated|frozen|cancell?ed|barred|band)\b|legal action|arrest(?:ed)?|\bfir\b|court (?:notice|case)|police case|case (?:has been )?registered|penalty|fine of|blacklist(?:ed)?|block ho jaye?ga|band ho jaye?ga)/gi,
      title: "Threatens blocking, fines or legal trouble", why: "Fear makes people comply. Scammers pose as a bank, telecom or authority and threaten blocked accounts or arrests to force a quick reaction." },
    { id: "prize", cat: "Fake prize / reward", sev: "high", w: 26, tactic: "Greed / reward", neg: false,
      re: /\b(congratulations?|you(?:'ve| have)? (?:won|been selected|been chosen)|winner|lucky (?:draw|winner|customer)|lottery|jackpot|prize|free (?:gift|iphone|money|data|laptop|recharge)|cashback|bonus|reward|inaam|inam|jeet(?:a|e)|selected for)\b/gi,
      title: "Promises a prize, reward or free money", why: "If you did not enter a draw you cannot win it. Prize scams ask for a 'fee', your card details or personal data to release the reward." },
    { id: "fee", cat: "Advance-fee scam", sev: "critical", w: 34, tactic: "Reciprocity + greed", neg: false,
      re: /\b(?:(?:processing|registration|clearance|customs|delivery|release|activation|admission|insurance|handling|tax) (?:fee|charges?|payment|tax)|pay (?:a |the )?(?:small )?(?:fee|charge|deposit)|refundable deposit|(?:send|pay|transfer|deposit|jama|bhej(?:o|en)?)\b[^.\n]{0,40}\b(?:rs\.?|pkr|rupees?|usd|\$|aed)\s?[\d,]{2,})/gi,
      title: "Asks you to pay money first to receive something", why: "Advance-fee fraud: you pay a 'small fee' to unlock a prize, job, loan or parcel that does not exist. Genuine prizes, loans and jobs do not require upfront payment." },
    { id: "wrong", cat: "Wrong-transfer (reverse payment) scam", sev: "high", w: 28, tactic: "Reciprocity / guilt", neg: false,
      re: /\b(?:by mistake|wrong(?:ly)? (?:transfer(?:red)?|sent|number)|sent (?:you )?(?:money|rs\.?|pkr)|please (?:return|send back|refund)|galti se|ghalti se|wapis (?:bhej|kar))\b/gi,
      title: "Claims money was sent to you by mistake and asks for it back", why: "The 'received' message is fake or the payment will be reversed later. Never send money back based on a message: check your balance in the official app first." },
    { id: "job", cat: "Fake job / investment", sev: "high", w: 26, tactic: "Greed", neg: false,
      re: /\b(work from home|earn (?:rs\.?|up to|daily|money)|daily (?:income|profit|earning)|per day|guaranteed (?:profit|returns?)|double your (?:money|investment)|investment plan|forex|crypto(?:currency)?|bitcoin|usdt|trading signal|part[- ]time job|simple task|like (?:and|&) (?:share|subscribe)|commission|passive income)\b/gi,
      title: "Offers easy money, a job or a 'guaranteed' investment", why: "High pay for simple tasks and guaranteed returns are hallmarks of task, Ponzi and trading scams. Early small payouts are used to lure larger deposits." },
    { id: "remote", cat: "Remote-access / malicious app", sev: "critical", w: 32, tactic: "Authority", neg: false,
      re: /\b(anydesk|teamviewer|quick ?support|ultraviewer|remote (?:access|support|control)|install (?:this |the )?(?:app|apk|software)|download (?:this |the )?(?:app|apk|file)|\.apk\b|your (?:device|phone|computer|pc) (?:is|has been) (?:infected|hacked|compromised)|virus (?:detected|found|alert))/gi,
      title: "Pushes you to install an app or give remote access", why: "Remote-control apps let criminals see your screen and approve payments. APK files from messages are a common way to install banking malware." },
    { id: "secret", cat: "Isolation / secrecy", sev: "high", w: 22, tactic: "Isolation", neg: false,
      re: /\b(don'?t tell (?:anyone|anybody)|do not tell (?:anyone|anybody)|keep (?:this|it) (?:a )?(?:secret|confidential|private)|strictly confidential|do not (?:share|discuss) (?:this )?(?:with|message)|kisi ko (?:na|mat) (?:batana|batao|batayen))\b/gi,
      title: "Tells you to keep it secret", why: "Secrecy cuts you off from the people who could say 'that is a scam'. Genuine organisations never need you to hide a request from family or colleagues." },
    { id: "chain", cat: "Chain / forward pressure", sev: "medium", w: 12, tactic: "Social proof", neg: false,
      re: /\b(forward (?:this )?(?:message )?to \d+|share (?:this )?with \d+ (?:friends|contacts|groups|people)|send (?:this )?to \d+ (?:friends|contacts|groups)|\d+ (?:friends|contacts) ko (?:forward|bhej))\b/gi,
      title: "Chain-message pressure to forward it", why: "Forward-to-N messages spread hoaxes and phishing links and harvest your contacts." },
    { id: "cta", cat: "Click / log-in call to action", sev: "medium", w: 12, tactic: "Authority", neg: false,
      re: /\b(click (?:the )?(?:link|here|below)|tap (?:the )?(?:link|here|below)|open (?:the )?link|visit (?:the )?(?:link|website|site)|log ?in (?:here|now|to)|login (?:here|now)|verify (?:now|your account|here)|confirm (?:now|your account)|unlock your account|reactivate)\b/gi,
      title: "Tells you to click a link to log in or verify", why: "Links in unexpected messages commonly lead to fake login pages. Open the official app or type the website yourself." },
    { id: "family", cat: "Family-emergency impersonation", sev: "high", w: 22, tactic: "Fear + trust", neg: false,
      re: /\b(hi (?:mum|mom|dad|mama|papa|ammi|abu)|new number|lost my phone|changed my number|i(?:'m| am) in (?:trouble|hospital|jail)|had an accident|need (?:money )?urgent(?:ly)?)\b/gi,
      title: "Looks like a family-member 'new number' emergency", why: "Criminals pretend to be a relative with a new number and a sudden emergency. Always call the person on their old number or ask a question only they can answer." },
    { id: "crypto", cat: "Crypto transfer request", sev: "high", w: 24, tactic: "Greed", neg: false,
      re: /\b(?:(?:send|transfer|deposit)\b[^.\n]{0,30}\b(?:usdt|btc|bitcoin|eth|crypto)|trust wallet|binance (?:account|support)|wallet address|seed phrase|recovery phrase|private key)\b/gi,
      title: "Asks for crypto or a wallet seed phrase", why: "Crypto transfers cannot be reversed. No legitimate service ever asks for your seed phrase or recovery phrase." },
    { id: "blackmail", cat: "Blackmail / sextortion", sev: "critical", w: 36, tactic: "Fear + shame", neg: false,
      re: /\b(?:i (?:have|recorded|hacked)\b[^.\n]{0,40}\b(?:your|you)\b[^.\n]{0,30}\b(?:video|videos|photos?|webcam|camera|nudes?)|(?:pay|send)\b[^.\n]{0,50}\b(?:or|otherwise|else)\b[^.\n]{0,50}\b(?:leak|share|post|expose|viral|send to your contacts))\b/gi,
      title: "Threatens to leak private material unless you pay", why: "This is blackmail. Mass-sent 'I hacked your webcam' emails are usually bluffs. Do not pay: stop contact, keep evidence and report it." },
    { id: "delivery", cat: "Fake parcel / delivery", sev: "medium", w: 14, tactic: "Curiosity", neg: false,
      re: /\b(parcel|package|courier|shipment|delivery (?:failed|attempt|fee|address)|tracking (?:number|id|link)|customs (?:fee|clearance|hold)|dhl|fedex|tcs|leopards|postex|bykea|pakistan post)\b/gi,
      title: "Mentions a parcel or delivery problem", why: "'Your parcel is held' texts lead to fake payment pages. Check tracking only in the courier's official app or website." },
    { id: "govt", cat: "Impersonates an authority", sev: "low", w: 10, tactic: "Authority", neg: false,
      re: /\b(bisp|benazir|ehsaas|nadra|fbr|pta|sbp|state bank|nab|fia|ministry|government of|police|customs|wapda|k-?electric|sui (?:gas|northern|southern)|ptcl|jazz|zong|ufone|telenor|easypaisa|jazzcash|sadapay|nayapay|hbl|ubl|mcb|meezan|alfalah|paypal|microsoft|google|facebook|whatsapp|amazon)\b/gi,
      title: "Names a bank, wallet, telecom or government body", why: "Scammers borrow trusted names. The name alone proves nothing: check the sender number and any link against the organisation's official channels." },
    { id: "generic", cat: "Impersonal greeting", sev: "low", w: 6, tactic: "Mass targeting", neg: false,
      re: /\b(dear (?:customer|user|client|sir\/madam|sir or madam|valued customer|account holder|member)|valued customer)\b/gi,
      title: "Generic greeting instead of your name", why: "Mass-sent scams do not know your name. Real banks usually address you by name in email and use their app for sensitive alerts." },
    { id: "contactnum", cat: "Unknown contact number", sev: "low", w: 8, tactic: "Authority", neg: false,
      re: /\b(?:call|contact|whatsapp|message|text|dial|reach)\b[^.\n]{0,25}(?:\+?\d[\d\s-]{8,15}\d)/gi,
      title: "Asks you to call or WhatsApp a number in the message", why: "Fake 'helplines' in a message connect you to the scammer. Use the number printed on your card or the official website." }
];
const SCAM_STEPS = {
    otp: ["Do NOT share any code. Hang up or stop replying.", "Open the official app yourself (not a link) and check for alerts.", "If you shared a code: call the bank or wallet's official helpline immediately and ask to block the account or card."],
    creds: ["Do not send IDs, selfies or account details by message.", "Contact the organisation through its official website or app to check if the request is real.", "If you already sent details: change passwords, tell your bank and watch for new SIMs or accounts in your name."],
    urgency: ["Pause. Real organisations do not need an answer in minutes.", "Check with the organisation through an official channel you find yourself."],
    threat: ["Do not reply or click. A real block or legal notice is delivered through official channels, not a threatening text.", "Log in through the official app or call the number on the back of your card."],
    prize: ["You cannot win a draw you did not enter: ignore it.", "Never pay a 'fee' or give card details to claim a prize."],
    fee: ["Do not pay. Real prizes, loans, jobs and parcels do not require upfront fees.", "If you already paid, tell your bank/wallet immediately and report it."],
    wrong: ["Do not send money back based on a message or call.", "Check your real balance in the official app. If money really arrived, contact the wallet or bank so they reverse it properly."],
    job: ["Do not deposit money to 'unlock' tasks or investments.", "Check whether the company is registered and licensed by the proper regulator before investing anything."],
    remote: ["Do NOT install the app or grant remote access. Delete the message.", "If you already installed it: turn on airplane mode, uninstall it, change banking passwords from another device and call your bank."],
    secret: ["Tell someone you trust right away: secrecy is the scammer's tool.", "Ask a family member or colleague to look at the message with you."],
    chain: ["Do not forward it. Chain messages spread scams and hoaxes."],
    cta: ["Do not click the link. Open the official app or type the website address yourself."],
    family: ["Call the person on their old, saved number before doing anything.", "Ask a question only the real person can answer."],
    crypto: ["Never share a seed phrase or private key with anyone.", "Crypto payments cannot be reversed: do not send funds on a message's instruction."],
    blackmail: ["Do not pay and do not reply. Paying usually leads to more demands.", "Keep screenshots and the sender details, block the contact and report it to your national cyber-crime authority."],
    delivery: ["Track parcels only in the courier's official app or website.", "Never pay a 'redelivery fee' through a link in a message."],
    govt: ["Verify through the organisation's official website or helpline, not the contact details in the message."],
    generic: ["Treat unexpected messages with extra care, especially if the sender cannot show your name or account details."],
    contactnum: ["Use contact details from the official website or card, not the message."]
};
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|pk|info|xyz|top|click|shop|online|site|link|app|co|io|me|ly|gl|cc|tk|ml|ga|cf|gq|ru|cn|in|uk|us|biz|live|store|vip|icu|buzz|work|club|fun|page|cloud|digital|tech|help|support|services)\b(?:\/[^\s<>"'`]*)?/gi;
function extractUrls(text) {
    const out = [], seen = new Set();
    for (const m of text.matchAll(URL_RE)) { let u = m[0].replace(/[.,;:!?)\]}'"]+$/, ""); if (/^[\d.]+$/.test(u) || /@/.test(text.slice(Math.max(0, m.index - 1), m.index))) continue; const k = u.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ url: u, s: m.index, e: m.index + u.length }); }
    return out;
}
function extractPhones(text) {
    const out = [], seen = new Set();
    for (const m of text.matchAll(/(?:\+92|0092|\b92|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b|\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,5}\b/g)) {
        const raw = m[0], d = raw.replace(/\D/g, ""); let norm = d.replace(/^0092/, "92"); if (/^0\d{10}$/.test(d)) norm = "92" + d.slice(1);
        if (seen.has(norm)) continue; seen.add(norm);
        let op = ""; if (/^923\d{9}$/.test(norm)) { const p = +norm.slice(2, 5), o = PK_OPS.find(x => p >= x[0] && p <= x[1]); op = o ? o[2] : "Pakistani mobile (series not in our list)"; }
        out.push({ raw, norm, op, s: m.index, e: m.index + raw.length });
    }
    return out;
}
function analyzeScam(text) {
    const hits = [], ranges = [];
    SCAM_RULES.forEach(r => {
        const ms = []; r.re.lastIndex = 0;
        for (const m of text.matchAll(r.re)) { if (r.neg && NEG_BEFORE.test(text.slice(Math.max(0, m.index - 22), m.index))) continue; ms.push(m); }
        if (ms.length) { hits.push({ r, n: ms.length, ex: ms[0][0] }); ms.forEach(m => ranges.push({ s: m.index, e: m.index + m[0].length, sev: r.sev, t: r.title })); }
    });
    const urls = extractUrls(text).map(u => { let sig = null, risk = 0, flags = []; try { sig = lexicalSignals(u.url); sig.S.forEach(s => { risk += s.w || 0; if (s.sev !== "good" && s.sev !== "info") flags.push(s); }); if (sig.fake) risk += 30; } catch (_) { } risk = Math.min(100, risk); return Object.assign(u, { sig, risk, flags }); });
    const phones = extractPhones(text);
    const amounts = []; for (const m of text.matchAll(/(?:rs\.?|pkr|rupees?|usd|\$|aed|£|€)\s?([\d,]{2,}(?:\.\d+)?)|\b([\d,]{3,})\s?(?:rs\.?|pkr|rupees?|usd|dollars?)\b/gi)) amounts.push(m[0].trim());
    urls.forEach(u => ranges.push({ s: u.s, e: u.e, sev: u.risk >= 50 ? "critical" : u.risk >= 20 ? "high" : "medium", t: "Link found in message" }));
    phones.forEach(p => ranges.push({ s: p.s, e: p.e, sev: "low", t: "Phone number" }));
    let score = hits.reduce((a, h) => a + h.r.w, 0);
    const letters = text.replace(/[^A-Za-z]/g, ""); if (letters.length > 25 && (letters.replace(/[^A-Z]/g, "").length / letters.length) > 0.6) { score += 5; hits.push({ r: { id: "caps", cat: "Shouting", sev: "low", w: 5, tactic: "Urgency", title: "Mostly capital letters", why: "SHOUTING is used to create alarm. Official messages are usually written normally." }, n: 1, ex: "" }); }
    const worst = urls.reduce((a, u) => Math.max(a, u.risk), 0); score += Math.round(worst * 0.35);
    if (hits.filter(h => h.r.w >= 12).length >= 4) score += 8;
    const legitOtp = /\b(otp|code|pin)\b[^.\n]{0,30}?(?:\bis\b|:)\s*\d{4,8}\b/i.test(text) && /(do not|don'?t|never)\s+share/i.test(text);
    if (legitOtp && !hits.some(h => h.r.sev === "critical")) score = Math.max(0, score - 15);
    score = Math.min(100, score);
    const top = hits.slice().sort((a, b) => b.r.w - a.r.w)[0];
    const lv = score >= 70 ? ["Almost certainly a scam", "danger", "bad"] : score >= 45 ? ["Very likely a scam", "danger", "bad"] : score >= 25 ? ["Suspicious: treat as unsafe", "warning", "warn"] : score >= 10 ? ["Some warning signs", "warning", "warn"] : ["No obvious scam patterns", "success", "ok"];
    return { hits, ranges, urls, phones, amounts, score, top, lv, legitOtp };
}
window.analyzeScamMessage = function () {
    const text = val("scamMsgInput");
    if (!text || text.length < 6) return fail("scamMsgResult", "Paste the full message first (at least a few words).");
    if (text.length > 6000) return fail("scamMsgResult", "Message is too long. Paste up to 6,000 characters.");
    const A = analyzeScam(text), sev = A.lv[2];
    const flagList = A.hits.slice().sort((a, b) => SEV_ORDER[a.r.sev] - SEV_ORDER[b.r.sev] || b.r.w - a.r.w);
    const steps = []; const seen = new Set(); (A.top ? [A.top] : []).concat(flagList).forEach(h => (SCAM_STEPS[h.r.id] || []).forEach(s => { if (!seen.has(s) && steps.length < 7) { seen.add(s); steps.push(s); } }));
    if (!steps.length) steps.push("Nothing alarming matched, but if the message asks for money, codes or a click you did not expect, verify through the official app or website.");
    const summary = verdict(A.lv[2] === "ok" ? "✅" : A.lv[2] === "warn" ? "⚠️" : "🚨", A.lv[0], A.lv[1], `${A.score}/100 scam-risk indicators · ${A.hits.length} warning sign${A.hits.length === 1 ? "" : "s"}${A.top ? " · most likely: " + esc(A.top.r.cat) : ""}`) + meter(A.score, A.lv[2] === "ok" ? "ok" : A.lv[2] === "warn" ? "warn" : "bad") +
        (A.hits.length ? `<div class="tp-chips">${flagList.slice(0, 6).map(h => badge(h.r.cat, h.r.sev === "critical" ? "bad" : h.r.sev === "high" ? "bad" : h.r.sev === "medium" ? "warn" : "info")).join("")}</div>` : "") +
        (A.urls.length ? kv([["Links found", A.urls.map(u => `<code>${esc(defang(u.url))}</code> ${badge(u.risk >= 50 ? "HIGH RISK" : u.risk >= 20 ? "RISKY" : "CHECK", u.risk >= 50 ? "bad" : u.risk >= 20 ? "warn" : "info")}`).join("<br>")]]) : "") +
        note(A.legitOtp ? "This looks like a normal one-time-code notice (it tells you not to share the code). Never share it." : "Pattern-based indicators, not proof. When in doubt, contact the organisation through its official app or website.");
    const html = rHero(A.lv[2] === "ok" ? "✅" : "🚨", esc(A.lv[0]), `Scam Message Analyzer · ${A.hits.length} warning sign(s) · ${A.urls.length} link(s) · ${A.phones.length} number(s)`, sev === "ok" ? "ok" : sev === "warn" ? "warn" : "bad", rGauge(A.score, "risk", sev === "ok" ? "ok" : sev === "warn" ? "warn" : "bad")) +
        rSec("🧾", "Your message, with the suspicious parts highlighted", `<div class="tpr-msg">${highlightText(text, A.ranges)}</div><p class="tpr-p"><small>Hover over a highlight to see why it was flagged. Colours: <mark class="tp-hl tp-hl-critical">critical</mark> <mark class="tp-hl tp-hl-high">high</mark> <mark class="tp-hl tp-hl-medium">medium</mark> <mark class="tp-hl tp-hl-low">low</mark></small></p>`) +
        rTiles([["Scam-risk score", A.score + "/100"], ["Most likely type", esc(A.top ? A.top.r.cat : "None detected")], ["Warning signs", String(A.hits.length)], ["Links", String(A.urls.length)], ["Phone numbers", String(A.phones.length)], ["Money amounts", A.amounts.length ? esc(A.amounts.slice(0, 3).join(", ")) : "none"]]) +
        rSec("🚩", "Warning signs explained", A.hits.length ? flagList.map(h => `<div class="tpr-sig tpr-s-${h.r.sev}"><span class="tpr-dot"></span><div><b>${esc(h.r.title)}</b><p>${esc(h.r.why)}</p><p class="tpr-tag"><span>${esc(h.r.cat)}</span><span>Trick used: ${esc(h.r.tactic)}</span>${h.n > 1 ? `<span>${h.n} matches</span>` : ""}${h.ex ? `<span>e.g. “${esc(h.ex.slice(0, 50))}”</span>` : ""}</p></div></div>`).join("") : rPara("No scam patterns matched. This does not guarantee safety: scammers also write plain, polite messages.")) +
        (A.urls.length ? rSec("🔗", "Links found in the message (shown safely defanged, never clickable)", rTable(["Link (defanged)", "Risk", "Why"], A.urls.map(u => [`<code>${esc(defang(u.url))}</code>`, `${badge(u.risk >= 50 ? "HIGH" : u.risk >= 20 ? "MEDIUM" : "LOW", u.risk >= 50 ? "bad" : u.risk >= 20 ? "warn" : "info")} ${u.risk}/100`, u.flags.length ? esc(u.flags.slice(0, 3).map(f => f.title).join("; ")) : "No lexical red flags. Still verify before opening."])) + rPara("For a deeper check paste a link into the <b>URL Inspector</b> tool.")) : "") +
        (A.phones.length ? rSec("📞", "Phone numbers in the message", rTable(["Number", "Normalised", "Operator (series)"], A.phones.map(p => [`<code>${esc(p.raw)}</code>`, `<code>+${esc(p.norm)}</code>`, esc(p.op || "International / unknown")])) + rPara("<small>Operator series are only a hint because numbers can be ported between networks. A matching operator does not make a number trustworthy.</small>")) : "") +
        rSec("✅", "What to do now", rSteps(steps.map(esc))) +
        rSec("😰", "If you already clicked, replied or paid", rSteps(["Stop all contact with the sender. Do not pay 'recovery agents': they are a second scam.", "Call your bank or wallet's official helpline (from the card or official website) and ask to block the card/account and reverse payments if possible.", "Change passwords of any account you typed into a link, starting with email, and enable two-step verification.", "If you installed an app: uninstall it, run a security scan and change banking passwords from a different device.", "Keep screenshots, numbers, links and payment receipts as evidence."])) +
        rSec("📣", "Report it", rList(["Report to your national cyber-crime authority. In Pakistan that is the FIA Cyber Crime Wing (NR3C): confirm the current helpline and online form on <b>nr3c.gov.pk</b>.", "Report spam or scam numbers to your mobile operator and the telecom regulator (PTA: <b>pta.gov.pk</b>).", "In WhatsApp: open the chat → contact name → <b>Report</b> and <b>Block</b>. In SMS apps use 'Report spam'.", "If a bank or wallet was impersonated, tell the real one through its official helpline."])) +
        rSec("🧠", "Scam-spotting rules to remember", rList(["Real organisations do not ask for OTP, PIN or passwords: ever.", "Urgency + fear + a link or number = stop and verify.", "You cannot win a draw you did not enter.", "Never pay to receive money, a job or a parcel.", "Verify using a number or website you find yourself, never the one in the message."])) +
        rPara("<small>This analyzer uses pattern matching on the text you pasted. It runs entirely in your browser; nothing is uploaded. Scammers change wording constantly, so the absence of flags is not a guarantee.</small>");
    setR("scamMsgResult", "scam", "Scam Message Analyzer", `${A.lv[0]} · ${A.score}/100`, summary, html, A.lv[1]);
};

/* ============================================================
   32. EMAIL HEADER ANALYZER
   ============================================================ */
function decodeWords(s) {
    return String(s || "").replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
        try {
            let bytes;
            if (enc.toLowerCase() === "b") { const bin = atob(txt.replace(/\s/g, "")); bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); }
            else { const t = txt.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))); bytes = Uint8Array.from(t, c => c.charCodeAt(0) & 255); }
            return new TextDecoder(cs.toLowerCase() === "utf8" ? "utf-8" : cs).decode(bytes);
        } catch (_e) { return txt; }
    }).replace(/\?=\s+=\?/g, "");
}
function parseHeaderBlock(raw) {
    const t = String(raw).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, ""), idx = t.search(/\n[ \t]*\n/);
    const head = idx >= 0 ? t.slice(0, idx) : t, body = idx >= 0 ? t.slice(idx).replace(/^\n[ \t]*\n/, "") : "";
    const H = []; head.replace(/\n[ \t]+/g, " ").split("\n").forEach(line => { const m = line.match(/^([!-9;-~]+):[ \t]*(.*)$/); if (m) H.push({ k: m[1], kl: m[1].toLowerCase(), v: m[2].trim() }); });
    return { H, body };
}
function parseAddr(v) {
    const d = decodeWords(v || ""); let name = "", addr = "";
    const m = d.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
    if (m) { name = m[1].trim(); addr = m[2].trim(); } else { const e = d.match(/[^\s<>"',;()]+@[^\s<>"',;()]+/); addr = e ? e[0] : ""; name = d.replace(addr, "").replace(/[<>"]/g, "").trim(); }
    addr = addr.toLowerCase(); return { name, addr, domain: (addr.split("@")[1] || "").replace(/[>;,]+$/, "") };
}
function parseReceived(v) {
    const semi = v.lastIndexOf(";"), head = semi > -1 ? v.slice(0, semi) : v, date = semi > -1 ? v.slice(semi + 1).trim() : "", ts = Date.parse(date.replace(/\s*\([^)]*\)\s*$/, ""));
    const from = (head.match(/\bfrom\s+(\S+)/i) || [])[1] || "", by = (head.match(/\bby\s+(\S+)/i) || [])[1] || "", withp = (head.match(/\bwith\s+([A-Za-z0-9-]+)/i) || [])[1] || "";
    const ips = []; for (const m of head.matchAll(/\[(?:IPv6:)?([0-9a-fA-F:.]{3,45})\]|\((?:[^()]*?[\s(])?((?:\d{1,3}\.){3}\d{1,3})\)/g)) { const ip = m[1] || m[2]; if (ip && isIP(ip) && !ips.includes(ip)) ips.push(ip); }
    const tls = /\bESMTPS|ESMTPSA|LMTPS|using TLS|TLSv1|\(version=TLS|cipher=/i.test(head);
    return { from, by, withp, ips, tls, ts: isNaN(ts) ? null : ts, date, raw: v };
}
function parseAuthResults(list) {
    const o = { spf: null, dkim: [], dmarc: null, arc: null, compauth: null };
    list.forEach(v => {
        const parts = v.split(/;\s*/), server = (parts.shift() || "").trim();
        parts.forEach(p => {
            const m = p.match(/^(spf|dkim|dmarc|arc|compauth)\s*=\s*([a-z]+)(.*)$/i); if (!m) return;
            const meth = m[1].toLowerCase(), rest = m[3], props = {};
            (rest.match(/[a-z][a-z0-9.\-]*=[^\s;()]+/gi) || []).forEach(kv => { const i = kv.indexOf("="); props[kv.slice(0, i).toLowerCase()] = kv.slice(i + 1); });
            const e = { res: m[2].toLowerCase(), props, reason: (rest.match(/\(([^)]*)\)/) || [])[1] || "", server };
            if (meth === "dkim") o.dkim.push(e); else if (!o[meth]) o[meth] = e;
        });
    });
    return o;
}
function parseDkimSig(v) { const o = {}; v.split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/\s+/g, ""); }); return o; }
const FREE_MAIL = ["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com", "mail.ru", "qq.com", "163.com"];
const AUTH_EXPLAIN = {
    spf: { pass: "The sending server's IP is on the sender domain's approved list.", fail: "The sending server is NOT allowed to send for that domain. A strong sign of spoofing.", softfail: "The server is probably not allowed (domain says '~all'). Treat as suspicious.", neutral: "The domain makes no claim about this server.", none: "The domain publishes no SPF policy, so the check could not be made.", temperror: "A temporary DNS error stopped the check.", permerror: "The domain's SPF record is broken." },
    dkim: { pass: "The message carries a valid cryptographic signature from the signing domain and was not altered in transit.", fail: "The signature does not match: the message was altered, or the signature is forged.", none: "The message is not DKIM-signed.", neutral: "The signature could not be verified.", temperror: "A temporary DNS error stopped the check.", permerror: "The signature or key record is malformed." },
    dmarc: { pass: "SPF or DKIM passed AND aligned with the visible From domain, so the From address is genuine.", fail: "Neither SPF nor DKIM aligned with the visible From domain: the From address may be forged.", none: "The From domain has no DMARC policy or the result was not recorded.", bestguesspass: "No DMARC record, but the message would have passed.", temperror: "A temporary DNS error stopped the check.", permerror: "The DMARC record is malformed." }
};
async function analyzeEmailHeaders(raw) {
    const { H, body } = parseHeaderBlock(raw), get = n => H.filter(h => h.kl === n).map(h => h.v), one = n => get(n)[0] || "";
    if (!H.length) throw new Error("No email headers found. Paste the full 'Show original' / 'Internet headers' text (lines like 'From:', 'Received:', 'Subject:').");
    const from = parseAddr(one("from")), rp = parseAddr(one("return-path")), rt = parseAddr(one("reply-to")), mid = (one("message-id").match(/@([^>\s]+)/) || [])[1] || "";
    const subject = decodeWords(one("subject")), date = one("date"), dateTs = Date.parse(date.replace(/\s*\([^)]*\)\s*$/, ""));
    const recv = get("received").map(parseReceived).reverse(); // oldest first
    const auth = parseAuthResults(get("authentication-results")), rspf = get("received-spf")[0] || "";
    if (!auth.spf && rspf) { const m = rspf.match(/^\s*(pass|fail|softfail|neutral|none|temperror|permerror)/i); if (m) auth.spf = { res: m[1].toLowerCase(), props: { "smtp.mailfrom": (rspf.match(/envelope-from=\"?<?([^\s;>"]+)/i) || [])[1] || "" }, reason: rspf.slice(0, 120), server: "Received-SPF" }; }
    const dkimSigs = get("dkim-signature").map(parseDkimSig), arcSeal = get("arc-seal").length;
    const fromReg = from.domain ? regDomain(from.domain) : "";
    const S = [], add = (sev, title, why, w) => S.push({ sev, title, why, w: w ?? ({ critical: 40, high: 25, medium: 12, low: 5, info: 0, good: 0 }[sev]) });

    /* authentication */
    const spf = auth.spf, dm = auth.dmarc, dk = auth.dkim;
    if (!spf && !dm && !dk.length) add("medium", "No SPF / DKIM / DMARC results were found in the headers", "The headers you pasted contain no Authentication-Results. Paste the complete headers from the receiving mailbox, or the message cannot be verified here.", 12);
    if (spf) { const r = spf.res; if (r === "pass") add("good", "SPF: PASS", AUTH_EXPLAIN.spf.pass); else if (r === "fail") add("critical", "SPF: FAIL", AUTH_EXPLAIN.spf.fail); else if (r === "softfail") add("high", "SPF: SOFTFAIL", AUTH_EXPLAIN.spf.softfail); else add("medium", "SPF: " + r.toUpperCase(), AUTH_EXPLAIN.spf[r] || "The result was inconclusive.", 8); }
    if (dk.length) { const best = dk.find(d => d.res === "pass") || dk[0]; if (best.res === "pass") add("good", "DKIM: PASS (signed by " + (best.props["header.d"] || best.props["header.i"] || "unknown") + ")", AUTH_EXPLAIN.dkim.pass); else if (best.res === "fail") add("critical", "DKIM: FAIL", AUTH_EXPLAIN.dkim.fail); else add("medium", "DKIM: " + best.res.toUpperCase(), AUTH_EXPLAIN.dkim[best.res] || "The result was inconclusive.", 8); }
    else if (dkimSigs.length) add("info", "DKIM signature present (not verified in headers)", "The message carries a DKIM-Signature but no verification result was pasted, so it could not be confirmed here.");
    else if (spf || dm) add("medium", "No DKIM signature", AUTH_EXPLAIN.dkim.none, 10);
    if (dm) { const r = dm.res; if (r === "pass") add("good", "DMARC: PASS", AUTH_EXPLAIN.dmarc.pass); else if (r === "fail") add("critical", "DMARC: FAIL", AUTH_EXPLAIN.dmarc.fail); else add("medium", "DMARC: " + r.toUpperCase(), AUTH_EXPLAIN.dmarc[r] || "The result was inconclusive.", 8); }
    /* alignment */
    const spfDom = spf ? ((spf.props["smtp.mailfrom"] || spf.props["smtp.helo"] || "").split("@").pop() || "") : "", spfReg = spfDom ? regDomain(spfDom.toLowerCase()) : "";
    const dkDoms = dk.map(d => (d.props["header.d"] || (d.props["header.i"] || "").replace(/^.*@/, "") || "").toLowerCase()).filter(Boolean).concat(dkimSigs.map(s => (s.d || "").toLowerCase()).filter(Boolean));
    const spfAligned = !!(spfReg && fromReg && spfReg === fromReg), dkAligned = dkDoms.some(d => fromReg && regDomain(d) === fromReg);
    if (fromReg && (spf || dk.length) && !spfAligned && !dkAligned && spf && spf.res === "pass" && (dk.length === 0 || dk.some(d => d.res === "pass"))) add("high", "SPF/DKIM passed, but for a different domain than the visible From", `Authentication passed for ${[spfReg, ...dkDoms.map(regDomain)].filter(Boolean).join(", ") || "another domain"}, not for ${fromReg}. This is the classic way attackers get a 'pass' while faking the From address. DMARC exists to catch it.`);
    /* identity */
    if (from.domain && rp.domain && regDomain(rp.domain) !== fromReg) add("medium", `Return-Path domain (${rp.domain}) differs from the From domain (${from.domain})`, "Bulk-mail services legitimately use their own return path, but forged mail also shows this mismatch. Judge it together with the authentication results above.", 10);
    if (from.domain && rt.domain && regDomain(rt.domain) !== fromReg) add(FREE_MAIL.includes(rt.domain) ? "high" : "medium", `Replies would go to a different domain (${rt.domain})`, "Phishing and CEO-fraud emails often show one sender but route your reply to the attacker's address.", FREE_MAIL.includes(rt.domain) ? 25 : 14);
    if (from.name && /@/.test(from.name) && from.name.toLowerCase().match(/[^\s@]+@[^\s@]+/) && from.name.toLowerCase().match(/[^\s@]+@[^\s@]+/)[0] !== from.addr) add("high", "Display name contains a different email address", "Mail apps often show only the display name. Attackers put a trusted address in the name field to fool you.");
    const nameL = from.name.toLowerCase();
    Object.keys(OFFICIAL).forEach(b => { if (b.length >= 4 && new RegExp("\\b" + b + "\\b").test(nameL)) { const ok = OFFICIAL[b].some(d => fromReg === d || fromReg.endsWith("." + d)); if (!ok && fromReg) add("critical", `Display name says "${b}" but the address is ${from.addr}`, `The real ${b} sends from: ${OFFICIAL[b].join(", ")}. Display names can be set to anything, so always read the actual address.`); } });
    if (from.domain && FREE_MAIL.includes(from.domain) && /(support|security|billing|helpdesk|service|official|team|admin|account|bank|payment|hr|ceo)/i.test(from.name)) add("high", "Official-sounding sender using a free mailbox", `Organisations send from their own domain, not ${from.domain}.`);
    if (from.domain) { try { const lx = lexicalSignals(from.domain); lx.S.filter(s => s.sev === "critical" && /Pretends|punycode|alphabets|bare IP/.test(s.title)).forEach(s => add("critical", "Sender domain: " + s.title, s.why)); const hi = lx.S.find(s => /High-abuse domain/.test(s.title)); if (hi) add("medium", "Sender domain: " + hi.title, hi.why, 10); } catch (_) { } }
    if (mid && fromReg && regDomain(mid.toLowerCase()) !== fromReg) add("low", `Message-ID domain (${mid}) differs from the From domain`, "Mail sent through a third-party service often looks like this; forged mail does too. Minor on its own.", 4);
    if (!one("message-id")) add("medium", "No Message-ID header", "Every genuine mail server adds a Message-ID. Missing ones are typical of hand-built or bulk spam mail.", 10);
    if (!date) add("medium", "No Date header", "A valid message normally includes a Date header.", 8);
    /* timing & path */
    const hops = recv.map((h, i) => Object.assign(h, { delay: i && h.ts != null && recv[i - 1].ts != null ? h.ts - recv[i - 1].ts : null }));
    if (hops.some(h => h.delay != null && h.delay < -300000)) add("medium", "Time goes backwards between mail servers", "A hop is timestamped earlier than the previous one. This can be clock drift, but forged 'Received' lines also cause it.", 10);
    const big = hops.filter(h => h.delay != null && h.delay > 3600000); if (big.length) add("low", `Message sat for over an hour at ${big.length} hop(s)`, "Long delays happen with greylisting or queueing, and also with batch-sent spam.", 4);
    const firstTs = hops.find(h => h.ts != null); if (!isNaN(dateTs) && firstTs && Math.abs(dateTs - firstTs.ts) > 86400000) add("medium", "The Date header disagrees with the first Received time by more than a day", "Spammers often set a fake Date header. Compare it with the time your own server received the message.", 10);
    if (hops.length === 0) add("low", "No Received headers", "Without Received lines the delivery path cannot be traced.", 4);
    if (hops.some(h => h.withp && /^(SMTP|ESMTP)$/i.test(h.withp) && !h.tls) && hops.length > 1) add("info", "At least one hop used unencrypted SMTP", "Mail can pass between servers without TLS. This alone is not malicious.");
    /* origin */
    const priv = ip => !!privateKind(ip); const xo = (one("x-originating-ip") || one("x-sender-ip") || "").replace(/[\[\]\s]/g, "");
    let origin = ""; for (const h of hops) { const ip = h.ips.find(i => !priv(i)); if (ip) { origin = ip; break; } } if (!origin && xo && isIP(xo) && !priv(xo)) origin = xo;
    let geo = null; if (origin) { try { geo = await ipwho(origin); } catch (_) { } }
    if (geo && geo.connection && HOSTING_RE.test(geo.connection.org || "") && from.domain && FREE_MAIL.includes(from.domain) === false) add("info", "First visible server is in a hosting/cloud network", `${geo.connection.org}. Normal for mail services; for a personal-looking sender it can indicate a script or bulk-mail server.`);
    /* body */
    const links = extractUrls(body).slice(0, 12).map(u => { let r = 0, fl = []; try { const s = lexicalSignals(u.url); s.S.forEach(x => { r += x.w || 0; if (!["good", "info"].includes(x.sev)) fl.push(x); }); if (s.fake) r += 30; } catch (_) { } return { url: u.url, risk: Math.min(100, r), flags: fl }; });
    const atts = []; for (const m of body.matchAll(/(?:file)?name\*?=\s*"?([^";\r\n]+)"?/gi)) { const n = decodeWords(m[1]).trim(), ext = (n.split(".").pop() || "").toLowerCase(), dbl = /\.[a-z0-9]{2,4}\.(exe|scr|bat|cmd|js|vbs|msi|jar|lnk|iso)$/i.test(n), r = EXT_RISK[ext]; if (n && !atts.some(a => a.n === n)) atts.push({ n, ext, risk: r ? r[0] : 0, label: r ? r[1] : "", dbl }); }
    atts.filter(a => a.risk >= 80 || a.dbl).forEach(a => add("critical", `Risky attachment: ${a.n}`, a.dbl ? "Double extension: the file pretends to be a document but is a program." : `${a.label} files can run code when opened.`));
    links.filter(l => l.risk >= 50).forEach(l => add("high", `Suspicious link in the body: ${defang(l.url)}`, l.flags.slice(0, 2).map(f => f.title).join("; ") || "Link shows several lexical red flags."));
    S.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    let score = 100 - S.reduce((a, s) => a + (s.w || 0), 0); score = Math.max(0, Math.min(100, score));
    const goodAuth = (spf && spf.res === "pass") + (dk.some(d => d.res === "pass")) + (dm && dm.res === "pass");
    const lv = score >= 80 ? ["Headers look consistent and authentic", "success", "ok"] : score >= 50 ? ["Some concerns: verify before trusting", "warning", "warn"] : ["Likely spoofed or phishing", "danger", "bad"];
    return { from, rp, rt, mid, subject, date, hops, auth, spfReg, dkDoms, spfAligned, dkAligned, S, score, lv, origin, geo, xo, links, atts, goodAuth, arcSeal, bodyLen: body.length, headerCount: H.length, mailer: one("x-mailer") || one("user-agent"), unsub: !!one("list-unsubscribe") };
}
window.analyzeEmailHeaders = async function () {
    const raw = ($("hdrInput")?.value || "").trim();
    if (!raw) return fail("hdrResult", "Paste the email headers (or the full 'Show original' text) first.");
    if (raw.length > 400000) return fail("hdrResult", "That is too large. Paste only the header section.");
    busy("hdrResult", "Reading headers and checking the sending server…");
    let R; try { R = await analyzeEmailHeaders(raw); } catch (e) { return fail("hdrResult", e.message); }
    const st = R.lv[2], k = st === "ok" ? "ok" : st === "warn" ? "warn" : "bad", rs = e => e ? e.res.toUpperCase() : "NOT FOUND", rk = e => !e ? "info" : e.res === "pass" ? "ok" : (e.res === "fail" || e.res === "softfail") ? "bad" : "warn";
    const dkBest = R.auth.dkim.find(d => d.res === "pass") || R.auth.dkim[0];
    const summary = verdict(st === "ok" ? "✅" : st === "warn" ? "⚠️" : "🚨", R.lv[0], R.lv[1], `Authenticity score ${R.score}/100 · ${R.hops.length} server hop(s)`) + meter(R.score, k) +
        `<div class="tp-chips">${badge("SPF " + rs(R.auth.spf), rk(R.auth.spf))}${badge("DKIM " + rs(dkBest), rk(dkBest))}${badge("DMARC " + rs(R.auth.dmarc), rk(R.auth.dmarc))}</div>` +
        kv([["From", `<code>${esc(R.from.addr || "—")}</code>${R.from.name ? " (" + esc(R.from.name) + ")" : ""}`], ["Return-Path", `<code>${esc(R.rp.addr || "—")}</code>`], ["Reply-To", `<code>${esc(R.rt.addr || "same as From")}</code>`], ["Subject", esc(R.subject.slice(0, 90) || "—")], ["First public server", R.origin ? `<code>${esc(R.origin)}</code>${R.geo ? " · " + esc((R.geo.country || "") + (R.geo.connection ? " · " + R.geo.connection.org : "")) : ""}` : "not visible"]]) +
        (R.S.filter(s => !["good", "info"].includes(s.sev)).length ? `<div class="tp-note">${R.S.filter(s => !["good", "info"].includes(s.sev)).slice(0, 3).map(s => "• " + esc(s.title)).join("<br>")}</div>` : "");
    const authRow = (n, e, extra) => [`<span class="nw"><b>${n}</b></span>`, `<span class="nw">${badge(rs(e), rk(e))}</span>`, esc(e ? (AUTH_EXPLAIN[n.toLowerCase()][e.res] || "Inconclusive result.") : "No result was recorded in the pasted headers."), esc(extra || "")];
    const html = rHero(st === "ok" ? "✅" : "📧", esc(R.lv[0]), `Email Header Analyzer · ${R.headerCount} headers · ${R.hops.length} hop(s)`, k, rGauge(R.score, "authentic", k)) +
        rTiles([["From", `<code>${esc(R.from.addr || "—")}</code>`, esc(R.from.name)], ["Return-Path", `<code>${esc(R.rp.addr || "—")}</code>`], ["Reply-To", `<code>${esc(R.rt.addr || "none")}</code>`], ["Subject", esc(R.subject.slice(0, 80) || "—")], ["Date header", esc(R.date || "—")], ["Server hops", String(R.hops.length)], ["Authenticated checks passed", `${R.goodAuth}/3`], ["Mailer", esc(R.mailer || "not shown")]]) +
        rSec("🔐", "Authentication: did the sender prove who they are?", rTable(["Check", "Result", "What it means", "Detail"], [authRow("SPF", R.auth.spf, R.spfReg ? `Domain checked: ${R.spfReg}${R.spfAligned ? " (aligned with From)" : " (not aligned)"}` : ""), authRow("DKIM", dkBest, R.dkDoms.length ? `Signed by: ${[...new Set(R.dkDoms)].join(", ")}${R.dkAligned ? " (aligned)" : " (not aligned)"}` : ""), authRow("DMARC", R.auth.dmarc, R.auth.dmarc && R.auth.dmarc.reason ? R.auth.dmarc.reason : "")]) + rPara("<small>SPF = is this server allowed to send for the domain? DKIM = is the message cryptographically signed and unaltered? DMARC = do SPF/DKIM match the visible From address, and what should receivers do if not?</small>")) +
        rSec("🚦", "Findings (worst first)", R.S.length ? R.S.map(rSignal).join("") : rPara("Nothing unusual detected in the pasted headers.")) +
        rSec("🪪", "Does the sender identity add up?", rTable(["Field", "Address / domain", "Matches From domain?"], [["From (what you see)", `<code>${esc(R.from.addr || "—")}</code>`, "—"], ["Return-Path (bounce address)", `<code>${esc(R.rp.addr || "—")}</code>`, R.rp.domain ? (regDomain(R.rp.domain) === regDomain(R.from.domain || "") ? "✅ yes" : "⚠️ no") : "—"], ["Reply-To (where replies go)", `<code>${esc(R.rt.addr || "same as From")}</code>`, R.rt.domain ? (regDomain(R.rt.domain) === regDomain(R.from.domain || "") ? "✅ yes" : "⚠️ no") : "✅ not set"], ["Message-ID domain", `<code>${esc(R.mid || "—")}</code>`, R.mid ? (regDomain(R.mid.toLowerCase()) === regDomain(R.from.domain || "") ? "✅ yes" : "ℹ️ no (common for mail services)") : "⚠️ missing"], ["SPF-checked domain", `<code>${esc(R.spfReg || "—")}</code>`, R.spfReg ? (R.spfAligned ? "✅ yes" : "⚠️ no") : "—"], ["DKIM signing domain", `<code>${esc([...new Set(R.dkDoms)].join(", ") || "—")}</code>`, R.dkDoms.length ? (R.dkAligned ? "✅ yes" : "⚠️ no") : "—"]])) +
        rSec("🛣️", "Delivery path (oldest hop first)", R.hops.length ? rTable(["#", "From server", "By server", "Protocol", "Encrypted", "Time", "Delay"], R.hops.map((h, i) => [String(i + 1), `<code>${esc(h.from || "—")}</code>${h.ips.length ? "<br><small>" + esc(h.ips.join(", ")) + "</small>" : ""}`, `<code>${esc(h.by || "—")}</code>`, esc(h.withp || "—"), h.tls ? "🔒 TLS" : "—", esc(h.date || "—"), h.delay == null ? "—" : (h.delay < 0 ? "⚠️ −" : "") + Math.abs(Math.round(h.delay / 1000)) + " s"])) : rPara("No Received headers were found.")) +
        (R.origin ? rSec("📍", "First public sending server", rTiles([["IP", `<code>${esc(R.origin)}</code>`], ["Country", esc(R.geo ? (R.geo.country || "—") : "lookup unavailable")], ["Network", esc(R.geo && R.geo.connection ? R.geo.connection.org || R.geo.connection.isp || "—" : "—")], ["ASN", esc(R.geo && R.geo.connection && R.geo.connection.asn ? "AS" + R.geo.connection.asn : "—")]]) + rPara("<small>This is the first non-private server in the chain, which is often the sender's mail server or ISP gateway, not necessarily the person's own device. Location data comes from a public IP database and can be wrong.</small>")) : "") +
        (R.atts.length ? rSec("📎", "Attachments named in the message", rTable(["File name", "Risk", "Note"], R.atts.map(a => [`<code>${esc(a.n)}</code>`, a.risk >= 80 || a.dbl ? badge("DANGEROUS", "bad") : a.risk ? badge("CAUTION", "warn") : badge("OK", "ok"), esc(a.dbl ? "Double extension" : a.label || "No known risk by extension")]))) : "") +
        (R.links.length ? rSec("🔗", "Links found in the message body (defanged)", rTable(["Link", "Risk"], R.links.map(l => [`<code>${esc(defang(l.url))}</code>`, `${badge(l.risk >= 50 ? "HIGH" : l.risk >= 20 ? "MEDIUM" : "LOW", l.risk >= 50 ? "bad" : l.risk >= 20 ? "warn" : "info")} ${l.risk}/100`]))) : "") +
        rSec("✅", "What to do", rSteps(st === "ok" ? ["The headers are consistent. If the content still feels wrong, contact the sender using a phone number or website you already trust.", "Never act on payment-detail changes without calling to confirm."] : ["Do not click links, open attachments or reply.", "Report it as phishing in your mail app, then delete it.", "If you already interacted: change the password of the affected account, enable two-step verification and tell your IT/security team.", "For payment or bank-detail requests, confirm by phone using a number you already have."])) +
        rSec("📖", "How to get the full headers", rList(["<b>Gmail:</b> open the message → ⋮ (More) → <b>Show original</b> → copy everything.", "<b>Outlook (desktop):</b> open the message → File → Properties → <b>Internet headers</b>.", "<b>Outlook.com / Microsoft 365:</b> ⋯ → View → <b>View message details</b>.", "<b>Yahoo Mail:</b> ⋯ → <b>View raw message</b>.", "<b>Apple Mail:</b> View → Message → <b>All Headers</b> (or Raw Source)."])) +
        rPara("<small>Everything is analysed in your browser. Only the first public server IP is sent to ipwho.is for a location look-up. Headers can be forged by attackers: authentication results added by YOUR receiving server are the most trustworthy lines.</small>");
    setR("hdrResult", "hdr", "Email Header Analyzer", `${R.lv[0]} · ${R.score}/100`, summary, html, R.lv[1]);
};

/* ============================================================
   33. PHOTO METADATA SCANNER & CLEANER (JPEG + PNG, lossless strip)
   ============================================================ */
const TS_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const IFD0_TAGS = { 0x010E: "Image description", 0x010F: "Camera make", 0x0110: "Camera model", 0x0112: "Orientation", 0x0131: "Editing software", 0x0132: "Last modified", 0x013B: "Artist / owner name", 0x8298: "Copyright text" };
const EXIF_TAGS = { 0x829A: "Exposure time", 0x829D: "Aperture (F-number)", 0x8827: "ISO", 0x9003: "Date & time taken", 0x9004: "Date & time digitised", 0x9010: "Time-zone offset", 0x9209: "Flash", 0x920A: "Focal length", 0x9286: "User comment", 0xA420: "Unique image ID", 0xA430: "Camera owner name", 0xA431: "Camera body serial number", 0xA433: "Lens make", 0xA434: "Lens model", 0xA435: "Lens serial number", 0xA002: "Pixel width", 0xA003: "Pixel height" };
function parseTiff(u8) {
    if (u8.length < 12) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), bom = String.fromCharCode(u8[0], u8[1]), le = bom === "II";
    if (!(le || bom === "MM") || dv.getUint16(2, le) !== 42) return null;
    const rd = (type, cnt, off) => {
        if (type === 2) { let s = ""; for (let i = 0; i < cnt && u8[off + i]; i++) s += String.fromCharCode(u8[off + i]); return s.trim(); }
        if (type === 7 || type === 1 || type === 6) return u8.slice(off, off + cnt);
        const out = [];
        for (let i = 0; i < cnt; i++) {
            if (type === 3) out.push(dv.getUint16(off + i * 2, le)); else if (type === 8) out.push(dv.getInt16(off + i * 2, le));
            else if (type === 4) out.push(dv.getUint32(off + i * 4, le)); else if (type === 9) out.push(dv.getInt32(off + i * 4, le));
            else if (type === 5) { const n = dv.getUint32(off + i * 8, le), d = dv.getUint32(off + i * 8 + 4, le); out.push(d ? n / d : 0); }
            else if (type === 10) { const n = dv.getInt32(off + i * 8, le), d = dv.getInt32(off + i * 8 + 4, le); out.push(d ? n / d : 0); }
        }
        return cnt === 1 ? out[0] : out;
    };
    const readIFD = off => {
        const ents = {}; let next = 0; if (off < 8 || off + 2 > u8.length) return { ents, next, n: 0 };
        const n = Math.min(dv.getUint16(off, le), 512);
        for (let i = 0; i < n; i++) {
            const p = off + 2 + i * 12; if (p + 12 > u8.length) break;
            const tag = dv.getUint16(p, le), type = dv.getUint16(p + 2, le), cnt = dv.getUint32(p + 4, le), sz = (TS_SIZE[type] || 0) * cnt; if (!sz || cnt > 1 << 20) continue;
            const vo = sz <= 4 ? p + 8 : dv.getUint32(p + 8, le); if (vo + sz > u8.length) continue;
            try { ents[tag] = rd(type, cnt, vo); } catch (_) { }
        }
        const np = off + 2 + n * 12; if (np + 4 <= u8.length) next = dv.getUint32(np, le);
        return { ents, next, n };
    };
    const ifd0 = readIFD(dv.getUint32(4, le)), ex = ifd0.ents[0x8769] ? readIFD(ifd0.ents[0x8769]) : { ents: {} }, gp = ifd0.ents[0x8825] ? readIFD(ifd0.ents[0x8825]) : { ents: {} };
    const ifd1 = ifd0.next ? readIFD(ifd0.next) : null;
    return { ifd0: ifd0.ents, exif: ex.ents, gps: gp.ents, thumb: !!(ifd1 && (ifd1.ents[0x0201] !== undefined || ifd1.ents[0x0202] !== undefined)), thumbBytes: ifd1 && ifd1.ents[0x0202] ? ifd1.ents[0x0202] : 0 };
}
function gpsDecode(g) {
    const conv = (a, ref) => { if (!Array.isArray(a) || a.length < 3) return null; let v = a[0] + a[1] / 60 + a[2] / 3600; if (/^[SW]/i.test(ref || "")) v = -v; return v; };
    const lat = conv(g[2], g[1]), lon = conv(g[4], g[3]); if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const alt = typeof g[6] === "number" ? (g[5] && g[5][0] === 1 ? -g[6] : g[6]) : null;
    const t = Array.isArray(g[7]) && g[7].length >= 3 ? [g[7][0], g[7][1], Math.floor(g[7][2])].map(x => String(Math.floor(x)).padStart(2, "0")).join(":") + " UTC" : "";
    return { lat, lon, alt, time: t, date: typeof g[0x1D] === "string" ? g[0x1D] : "", dir: typeof g[0x11] === "number" ? g[0x11] : null, method: typeof g[0x1B] === "object" && g[0x1B] && g[0x1B].length ? String.fromCharCode(...[...g[0x1B]].filter(x => x > 31 && x < 127)).trim() : "" };
}
const ascii = (u8, a, n) => { let s = ""; for (let i = 0; i < n && a + i < u8.length; i++) s += String.fromCharCode(u8[a + i]); return s; };
function scanJpeg(u8) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    const segs = []; let p = 2, sof = null, sos = null;
    while (p + 4 <= u8.length) {
        if (u8[p] !== 0xFF) break; const mk = u8[p + 1];
        if (mk === 0xFF) { p++; continue; } if (mk === 0xD8 || (mk >= 0xD0 && mk <= 0xD7) || mk === 0x01) { p += 2; continue; } if (mk === 0xD9) break;
        const len = (u8[p + 2] << 8) | u8[p + 3]; if (len < 2 || p + 2 + len > u8.length) break;
        const seg = { mk, start: p, end: p + 2 + len, len, kind: "other" }, d = p + 4;
        if (mk === 0xE1 && ascii(u8, d, 6) === "Exif\0\0") seg.kind = "exif";
        else if (mk === 0xE1 && ascii(u8, d, 28).startsWith("http://ns.adobe.com/xap/1.0/")) seg.kind = "xmp";
        else if (mk === 0xE1 && ascii(u8, d, 34).startsWith("http://ns.adobe.com/xmp/extension/")) seg.kind = "xmp";
        else if (mk === 0xE1) seg.kind = "app1";
        else if (mk === 0xE2 && ascii(u8, d, 12) === "ICC_PROFILE\0") seg.kind = "icc";
        else if (mk === 0xE2 && ascii(u8, d, 4) === "MPF\0") seg.kind = "mpf";
        else if (mk === 0xED && ascii(u8, d, 13) === "Photoshop 3.0") seg.kind = "iptc";
        else if (mk === 0xE0 && (ascii(u8, d, 5) === "JFIF\0" || ascii(u8, d, 5) === "JFXX\0")) seg.kind = "jfif";
        else if (mk === 0xEE && ascii(u8, d, 5) === "Adobe") seg.kind = "adobe";
        else if (mk === 0xFE) seg.kind = "comment";
        else if (mk >= 0xE0 && mk <= 0xEF) seg.kind = "app";
        segs.push(seg);
        if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk) && !sof) sof = { h: (u8[p + 5] << 8) | u8[p + 6], w: (u8[p + 7] << 8) | u8[p + 8], comps: u8[p + 9], progressive: mk === 0xC2 };
        if (mk === 0xDA) { sos = seg; break; }
        p = seg.end;
    }
    let eoi = -1; if (sos) for (let i = sos.end; i + 1 < u8.length; i++) if (u8[i] === 0xFF && u8[i + 1] === 0xD9) { eoi = i + 2; break; }
    return { segs, sof, sos, eoi, trailing: eoi > 0 ? u8.length - eoi : 0 };
}
function scanPng(u8) {
    const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]; if (!sig.every((b, i) => u8[i] === b)) return null;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), chunks = []; let p = 8;
    while (p + 12 <= u8.length) { const len = dv.getUint32(p), type = ascii(u8, p + 4, 4); if (p + 12 + len > u8.length) break; chunks.push({ type, start: p, end: p + 12 + len, len }); p += 12 + len; if (type === "IEND") break; }
    const ih = chunks.find(c => c.type === "IHDR"); const dim = ih ? { w: dv.getUint32(ih.start + 8), h: dv.getUint32(ih.start + 12) } : null;
    return { chunks, dim, trailing: u8.length - p };
}
function readExifFromJpeg(u8, seg) { return parseTiff(u8.subarray(seg.start + 10, seg.end)); }
function xmpFields(u8, seg) {
    const txt = ascii(u8, seg.start + 4, Math.min(seg.len - 2, 60000)), f = {};
    [["Creator", /<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)</], ["Title", /<dc:title>[\s\S]*?<rdf:li[^>]*>([^<]+)</], ["Software", /xmp:CreatorTool="([^"]+)"/], ["Created", /xmp:CreateDate="([^"]+)"/], ["Location", /photoshop:(?:City|Country|State)="([^"]+)"/], ["Device", /tiff:Model="([^"]+)"/]].forEach(([k, re]) => { const m = txt.match(re); if (m) f[k] = m[1]; });
    return f;
}
function analyzePhoto(u8, name) {
    const R = { name, size: u8.length, fmt: "", w: 0, h: 0, finds: [], fields: [], gps: null, thumb: false, xmp: null, iptc: false, comments: [], trailing: 0, orient: 1, removable: 0, supported: true, mpf: false, textChunks: [] };
    const add = (sev, label, value, why, pts) => R.finds.push({ sev, label, value, why, pts });
    let tiff = null, j = scanJpeg(u8), pn = null;
    if (j) {
        R.fmt = "JPEG"; if (j.sof) { R.w = j.sof.w; R.h = j.sof.h; }
        const ex = j.segs.find(s => s.kind === "exif"); if (ex) tiff = readExifFromJpeg(u8, ex);
        const xm = j.segs.find(s => s.kind === "xmp"); if (xm) R.xmp = xmpFields(u8, xm);
        R.iptc = j.segs.some(s => s.kind === "iptc"); R.mpf = j.segs.some(s => s.kind === "mpf");
        j.segs.filter(s => s.kind === "comment").forEach(s => R.comments.push(ascii(u8, s.start + 4, Math.min(s.len - 2, 300)).trim()));
        R.trailing = j.trailing; R.jpeg = j;
    } else if ((pn = scanPng(u8))) {
        R.fmt = "PNG"; if (pn.dim) { R.w = pn.dim.w; R.h = pn.dim.h; } R.png = pn; R.trailing = pn.trailing > 0 ? pn.trailing : 0;
        const ex = pn.chunks.find(c => c.type === "eXIf"); if (ex) tiff = parseTiff(u8.subarray(ex.start + 8, ex.start + 8 + ex.len));
        pn.chunks.filter(c => ["tEXt", "zTXt", "iTXt"].includes(c.type)).forEach(c => { const key = ascii(u8, c.start + 8, Math.min(c.len, 80)).split("\0")[0]; R.textChunks.push({ type: c.type, key, value: c.type === "tEXt" ? ascii(u8, c.start + 8 + key.length + 1, Math.min(c.len - key.length - 1, 200)).trim() : "" }); });
        if (pn.chunks.some(c => c.type === "iTXt" && ascii(u8, c.start + 8, 17) === "XML:com.adobe.xmp")) R.xmp = R.xmp || {};
    } else { R.supported = false; return R; }
    if (tiff) {
        R.orient = Number(tiff.ifd0[0x0112]) || 1; const t = tiff;
        const mk = (o, tags) => Object.keys(tags).forEach(k => { const v = o[k]; if (v !== undefined && v !== null && v !== "" && !(v && v.length === 0)) { let s = typeof v === "number" ? String(Math.round(v * 1e4) / 1e4) : Array.isArray(v) ? v.map(x => Math.round(x * 1e3) / 1e3).join(", ") : (v instanceof Uint8Array ? (/^(ASCII|UNICODE|JIS)/.test(ascii(v, 0, 8)) ? ascii(v, 8, v.length - 8).replace(/[^\x20-\x7e]/g, "").trim() : "[binary " + v.length + " bytes]") : String(v)); R.fields.push([tags[k], s]); } });
        mk(t.ifd0, IFD0_TAGS); mk(t.exif, EXIF_TAGS);
        const gp = gpsDecode(t.gps); R.gps = gp; R.thumb = t.thumb;
        if (gp) add("critical", "GPS location", `${gp.lat.toFixed(6)}, ${gp.lon.toFixed(6)}${gp.alt != null ? " · altitude " + Math.round(gp.alt) + " m" : ""}`, "Reveals exactly where the photo was taken, usually to within a few metres. A photo taken at home shows your home address to anyone who views the original file.", 50);
        if (t.exif[0xA431] || t.exif[0xA435]) add("high", "Device / lens serial number", String(t.exif[0xA431] || t.exif[0xA435]), "A unique serial number can link photos to one specific camera and, with a purchase record, to its owner.", 14);
        if (t.exif[0xA430] || t.ifd0[0x013B]) add("high", "Owner / artist name", String(t.exif[0xA430] || t.ifd0[0x013B]), "Your name is embedded in the file and travels with every copy.", 14);
        if (t.exif[0x9003] || t.exif[0x9004]) add("medium", "Exact date and time taken", String(t.exif[0x9003] || t.exif[0x9004]), "Combined with a location, this reveals when you are usually at a place, or when your home is empty.", 8);
        if (t.ifd0[0x0110] || t.ifd0[0x010F]) add("low", "Camera / phone model", `${t.ifd0[0x010F] || ""} ${t.ifd0[0x0110] || ""}`.trim(), "Tells viewers which device you own, and helps attackers target device-specific flaws.", 5);
        if (t.ifd0[0x0131]) add("low", "Editing software", String(t.ifd0[0x0131]), "Shows which app or version edited or created the picture.", 3);
        if (t.exif[0x9286]) add("medium", "User comment", String(R.fields.find(f => f[0] === "User comment")?.[1] || ""), "Free-text notes can contain names, places or other private details.", 8);
        if (t.thumb) add("medium", "Embedded thumbnail preview", t.thumbBytes ? fmtBytes(t.thumbBytes) : "present", "A small preview copy is stored inside the file. If you crop or blur the main picture in some editors, the old thumbnail can still show the original.", 8);
        R.thumbBytes = t.thumbBytes || 0;
    }
    if (R.xmp) add("medium", "XMP metadata block", Object.keys(R.xmp).length ? Object.entries(R.xmp).map(([k, v]) => `${k}: ${v}`).join(" · ") : "present", "XMP can hold author names, titles, locations, edit history and software details.", 8);
    if (R.iptc) add("medium", "IPTC / Photoshop block", "present", "Newsroom-style fields such as caption, keywords, credit and city may be stored here.", 8);
    if (R.comments.length) add("medium", "JPEG comment", R.comments.join(" | ").slice(0, 160), "Free-text comment embedded in the file.", 6);
    if (R.textChunks.length) add("medium", "PNG text chunks", R.textChunks.map(c => c.key).slice(0, 8).join(", "), "PNG files can store text such as author, software and prompts used to generate the image.", 8);
    if (R.png && R.png.chunks.some(c => c.type === "tIME")) add("low", "Last-modified timestamp (tIME)", "present", "Records when the PNG was last changed.", 3);
    if (R.mpf) add("low", "Multi-picture data (MPF)", "present", "Used by some phones to attach extra images (such as depth maps or previews).", 4);
    if (R.trailing > 64) add("medium", "Extra data hidden after the image", fmtBytes(R.trailing), "Some phones and apps append extra content (for example a motion-photo video or a second image) after the picture. It is invisible when you view the photo but travels with the file.", 8);
    R.score = Math.min(100, R.finds.reduce((a, f) => a + f.pts, 0));
    R.level = R.score >= 50 ? ["High privacy exposure", "danger", "bad"] : R.score >= 20 ? ["Moderate privacy exposure", "warning", "warn"] : R.finds.length ? ["Low privacy exposure", "success", "ok"] : ["No private metadata found", "success", "ok"];
    return R;
}
function minimalExif(orient) {
    const b = [0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orient, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    return Uint8Array.from(b);
}
function cleanPhoto(u8, R, keepOri) {
    const out = [];
    if (R.fmt === "JPEG") {
        const j = R.jpeg; out.push(u8.subarray(0, 2));
        const orientSeg = keepOri && R.orient > 1 && R.orient <= 8 ? minimalExif(R.orient) : null; let placed = !orientSeg;
        j.segs.forEach(s => {
            const keep = ["jfif", "icc", "adobe"].includes(s.kind) || (s.mk !== 0xFE && !(s.mk >= 0xE0 && s.mk <= 0xEF));
            if (!keep) return;
            if (!placed && s.kind !== "jfif") { out.push(orientSeg); placed = true; }
            out.push(u8.subarray(s.start, s.end)); if (!placed && s.kind === "jfif") { out.push(orientSeg); placed = true; }
        });
        const sosEnd = j.sos ? j.sos.end : 2, end = j.eoi > 0 ? j.eoi : u8.length; out.push(u8.subarray(sosEnd, end));
    } else if (R.fmt === "PNG") {
        out.push(u8.subarray(0, 8)); const drop = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
        R.png.chunks.forEach(c => { if (!drop.has(c.type)) out.push(u8.subarray(c.start, c.end)); });
    }
    const len = out.reduce((a, b) => a + b.length, 0), res = new Uint8Array(len); let p = 0; out.forEach(b => { res.set(b, p); p += b.length; }); return res;
}
let PHOTO = null;
async function readPhotoFile(f) {
    if (!f) throw new Error("Choose a JPEG or PNG photo first.");
    if (f.size > 60 * 1048576) throw new Error("That file is over 60 MB. Choose a smaller photo.");
    return new Uint8Array(await f.arrayBuffer());
}
window.scanPhotoMetadata = async function () {
    const f = $("exifFile")?.files?.[0];
    busy("exifResult", "Reading the file's hidden data…");
    let u8; try { u8 = await readPhotoFile(f); } catch (e) { return fail("exifResult", e.message); }
    const R = analyzePhoto(u8, f.name);
    if (!R.supported) return fail("exifResult", /heic|heif|webp|avif|gif|tiff?/i.test(f.name + f.type) ? "This format (HEIC/WebP/AVIF/GIF/TIFF) is not supported for lossless cleaning here. Export or convert the photo to JPEG or PNG first, then scan it." : "Only JPEG and PNG photos are supported.", "warning");
    PHOTO = { u8, R, f };
    const top = R.finds.slice().sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
    const k = R.level[2];
    const prev = URL.createObjectURL(new Blob([u8], { type: R.fmt === "PNG" ? "image/png" : "image/jpeg" }));
    const summary = verdict(R.level[2] === "ok" ? "✅" : R.level[2] === "warn" ? "⚠️" : "📍", R.level[0], R.level[1], `${esc(f.name)} · ${R.fmt} · ${R.w}×${R.h} · ${fmtBytes(R.size)}`) + meter(R.score, k) +
        `<div class="tpr-prev"><img src="${prev}" alt="Preview of the selected photo" loading="lazy"></div>` +
        (top.length ? kv(top.slice(0, 6).map(x => [x.label, esc(x.value.slice(0, 70))])) : "") +
        `<label class="tp-check"><input type="checkbox" id="exifKeepOri" checked> Keep photo rotation (recommended)</label><div class="tp-actions"><button type="button" class="tp-act" data-exif-clean>🧹 Remove all metadata &amp; download</button></div>` +
        note("Your photo never leaves this device. The clean copy is made by deleting metadata blocks only: the picture pixels are not re-compressed.");
    const html = rHero(R.level[2] === "ok" ? "✅" : "📍", esc(R.level[0]), `Photo Metadata Scanner · ${esc(R.fmt)} · ${R.finds.length} privacy finding(s)`, k, rGauge(R.score, "exposure", k)) +
        rTiles([["File", esc(f.name)], ["Format", esc(R.fmt)], ["Dimensions", `${R.w} × ${R.h}`], ["Size", fmtBytes(R.size)], ["Privacy exposure", R.score + "/100"], ["Findings", String(R.finds.length)]]) +
        (R.gps ? rSec("📍", "Exact location stored in this photo", rTiles([["Latitude", R.gps.lat.toFixed(6)], ["Longitude", R.gps.lon.toFixed(6)], ["Altitude", R.gps.alt != null ? Math.round(R.gps.alt) + " m" : "n/a"], ["GPS time", esc(R.gps.time || R.gps.date || "n/a")]]) + `<p class="tpr-p"><a class="cg-result-link" href="https://www.openstreetmap.org/?mlat=${R.gps.lat.toFixed(6)}&mlon=${R.gps.lon.toFixed(6)}#map=17/${R.gps.lat.toFixed(6)}/${R.gps.lon.toFixed(6)}" target="_blank" rel="noopener noreferrer">View this spot on OpenStreetMap ↗</a></p>` + rPara("Anyone who receives the <b>original file</b> can read these coordinates with free tools. Many social apps strip location when you upload a picture, but sending the original as a file, document, email attachment or cloud link usually keeps it.")) : "") +
        rSec("🔍", "What privacy risks were found", top.length ? top.map(f2 => `<div class="tpr-sig tpr-s-${f2.sev}"><span class="tpr-dot"></span><div><b>${esc(f2.label)}: <span class="tpr-val">${esc(f2.value.slice(0, 120))}</span></b><p>${esc(f2.why)}</p></div></div>`).join("") : rPara("No location, device or author metadata was found in this file. It is already clean.")) +
        (R.fields.length ? rSec("📋", "Every readable EXIF field", rTable(["Field", "Value"], R.fields.map(([a, b]) => [esc(a), `<code>${esc(String(b).slice(0, 120))}</code>`]))) : "") +
        rSec("🧹", "Clean it before you share", `<p class="tpr-p">Press the button below to download a copy with all of these removed. The picture itself is not re-compressed, so quality stays identical.</p><div class="tp-actions"><button type="button" class="tp-act" data-exif-clean>🧹 Remove all metadata &amp; download</button></div>` + rList(["<b>JPEG:</b> removes EXIF, XMP, IPTC, comments, thumbnails and extra appended data. Colour profile (ICC) is kept so colours look the same.", "<b>PNG:</b> removes text chunks (author, prompts, software), embedded EXIF and the modification timestamp.", "Photo <b>rotation</b> is preserved by keeping one tiny orientation tag, so portrait photos do not turn sideways."])) +
        rSec("🛡️", "Habits that protect your location", rList(["Turn off <b>Location / Geotag</b> in your camera app if you do not need it (wording varies by phone; on iPhone: Settings → Privacy &amp; Security → Location Services → Camera → Never).", "Before sharing originals, clean them with this tool.", "Remember backgrounds, street signs and reflections can reveal a place even with no metadata.", "Screenshots of a photo normally do not carry the original's GPS data."])) +
        rPara("<small>Supports JPEG and PNG. For HEIC (iPhone) choose 'Most Compatible' in camera settings or export as JPEG first. The scan reads EXIF/XMP/IPTC; unusual maker-specific blocks are removed from JPEG but not itemised.</small>");
    setR("exifResult", "exif", "Photo Metadata Scanner", `${R.level[0]} · ${R.score}/100`, summary, html, R.level[1]);
};
document.addEventListener("click", e => {
    const b = e.target.closest("[data-exif-clean]"); if (!b) return;
    if (!PHOTO) return;
    const keep = !($("exifKeepOri") && !$("exifKeepOri").checked);
    const clean = cleanPhoto(PHOTO.u8, PHOTO.R, keep), V = analyzePhoto(clean, PHOTO.f.name), base = PHOTO.f.name.replace(/\.[^.]+$/, ""), ext = PHOTO.R.fmt === "PNG" ? "png" : "jpg";
    dlBlob(`${base}-clean.${ext}`, new Blob([clean], { type: PHOTO.R.fmt === "PNG" ? "image/png" : "image/jpeg" }));
    const left = V.finds.filter(f => !(f.label === "Camera / phone model" && false)).length;
    b.textContent = `✓ Clean copy saved (${fmtBytes(clean.length)}, ${fmtBytes(PHOTO.u8.length - clean.length)} smaller). Re-scan: ${left ? left + " item(s) remain" : "no private metadata left"}`;
    b.classList.add("tp-done");
});

/* ============================================================
   34. QR STUDIO  (safe QR generator, runs fully offline)
   ============================================================ */
const QRS = { payload: "", n: 0, ver: 0, svg: "", png: "", ec: "M", bytes: 0 };
const hexToRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [0, 0, 0]; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const relLum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const wifiEsc = s => String(s).replace(/([\\;,:"])/g, "\\$1");
function waNumber(raw) { let d = String(raw || "").replace(/\D/g, ""); if (/^00/.test(d)) d = d.slice(2); else if (/^03\d{9}$/.test(d)) d = "92" + d.slice(1); return d; }
function qrBuild() {
    const type = $("qrsType").value, g = id => ($(id)?.value || "").trim(), warns = [];
    let payload = "", label = "";
    if (type === "url") {
        let u = g("qrsMain"); if (!u) throw new Error("Enter the web address to put in the QR code.");
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) { warns.push(["medium", "No https:// was typed", "Added https:// automatically. Always include the full address you intend people to open."]); u = "https://" + u; }
        let x; try { x = new URL(u); } catch (_) { throw new Error("That is not a valid web address."); }
        if (x.protocol !== "https:") warns.push(["high", "Link is not HTTPS", "People scanning will land on an unencrypted page. Use https:// whenever possible."]);
        try { const s = lexicalSignals(u); const bad = s.S.filter(z => ["critical", "high"].includes(z.sev)); bad.slice(0, 3).forEach(z => warns.push([z.sev, "Link check: " + z.title, z.why])); } catch (_) { }
        payload = u; label = "Website link";
    } else if (type === "text") { payload = $("qrsBody").value.replace(/\r\n/g, "\n"); if (!payload.trim()) throw new Error("Type the text to encode."); label = "Plain text"; }
    else if (type === "wifi") {
        const ssid = g("qrsWifiSsid"), pw = $("qrsWifiPass").value, sec = $("qrsWifiSec").value, hid = $("qrsWifiHidden").checked;
        if (!ssid) throw new Error("Enter the Wi-Fi network name (SSID)."); if (sec !== "nopass" && !pw) throw new Error("Enter the Wi-Fi password, or choose 'No password'.");
        if (sec === "WEP") warns.push(["high", "WEP is broken", "WEP can be cracked in minutes. Use WPA2 or WPA3 on your router."]);
        if (sec === "nopass") warns.push(["high", "Open network", "Anyone nearby can join and may be able to watch unencrypted traffic. Use a password."]);
        if (sec !== "nopass" && pw.length < 12) warns.push(["medium", "Short Wi-Fi password", "A WPA2/WPA3 password of 12+ characters (ideally a passphrase) resists guessing much better."]);
        warns.push(["info", "The password is readable by anyone who scans the code", "Treat this QR like the password itself. For visitors or a cafe, put it on a guest network, not your main one."]);
        payload = `WIFI:T:${sec};S:${wifiEsc(ssid)};${sec === "nopass" ? "" : "P:" + wifiEsc(pw) + ";"}${hid ? "H:true;" : ""};`; label = "Wi-Fi network";
    } else if (type === "phone") { const d = g("qrsMain").replace(/[^\d+]/g, ""); if ((d.match(/\d/g) || []).length < 6) throw new Error("Enter a valid phone number."); payload = "tel:" + d; label = "Phone call"; }
    else if (type === "sms") { const d = g("qrsMain").replace(/[^\d+]/g, ""); if ((d.match(/\d/g) || []).length < 3) throw new Error("Enter the phone number to text."); payload = `SMSTO:${d}:${$("qrsBody").value.trim()}`; label = "SMS message"; }
    else if (type === "email") { const a = g("qrsMain"); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a)) throw new Error("Enter a valid email address."); const q = []; if (g("qrsSub")) q.push("subject=" + encodeURIComponent(g("qrsSub"))); if ($("qrsBody").value.trim()) q.push("body=" + encodeURIComponent($("qrsBody").value.trim())); payload = "mailto:" + a + (q.length ? "?" + q.join("&") : ""); label = "Email"; }
    else if (type === "whatsapp") { const d = waNumber(g("qrsMain")); if (d.length < 8 || d.length > 15) throw new Error("Enter the WhatsApp number with country code, e.g. +92 300 1234567 or 0300 1234567."); payload = "https://wa.me/" + d + ($("qrsBody").value.trim() ? "?text=" + encodeURIComponent($("qrsBody").value.trim()) : ""); label = "WhatsApp chat"; }
    return { type, payload, label, warns };
}
function qrRender(payload, ecKey, size, qz, fg, bg) {
    const bin = unescape(encodeURIComponent(payload)), qr = new CG_QRLIB.QRCode(-1, CG_QRLIB.Level[ecKey]);
    qr.addData(bin); try { qr.make(); } catch (e) { throw new Error("That content is too long for a QR code at this error-correction level. Shorten it or choose a lower level (L)."); }
    const n = qr.getModuleCount(), scale = Math.max(2, Math.floor(size / (n + 2 * qz))), px = scale * (n + 2 * qz);
    const cv = document.createElement("canvas"); cv.width = cv.height = px; const c = cv.getContext("2d"); c.fillStyle = bg; c.fillRect(0, 0, px, px); c.fillStyle = fg;
    let path = ""; for (let r = 0; r < n; r++) { let run = 0; for (let col = 0; col <= n; col++) { const d = col < n && qr.isDark(r, col); if (d) { run++; } else if (run) { const x = col - run; c.fillRect((x + qz) * scale, (r + qz) * scale, run * scale, scale); path += `M${x + qz},${r + qz}h${run}v1h-${run}z`; run = 0; } } }
    const tot = n + 2 * qz, svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${tot}" height="${tot}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
    return { cv, n, ver: (n - 17) / 4, svg, px, bytes: bin.length };
}
window.generateQRStudio = function () {
    const out = "qrGenResult"; let B;
    try { B = qrBuild(); } catch (e) { return fail(out, e.message, "warning"); }
    const ec = $("qrsEc").value, size = +$("qrsSize").value || 512, qz = +$("qrsQz").value || 4, fg = $("qrsFg").value || "#000000", bg = $("qrsBg").value || "#ffffff";
    let Q; try { Q = qrRender(B.payload, ec, size, qz, fg, bg); } catch (e) { return fail(out, e.message, "warning"); }
    const cr = contrast(hexToRgb(fg), hexToRgb(bg)), W = B.warns.slice();
    if (relLum(hexToRgb(fg)) > relLum(hexToRgb(bg))) W.push(["high", "Inverted colours (light on dark)", "Many scanner apps only read dark modules on a light background. Use a dark foreground and a light background."]);
    else if (cr < 4) W.push(["medium", `Low contrast (${cr.toFixed(1)}:1)`, "Scanners need strong contrast. Aim for at least 4:1; black on white is 21:1."]);
    if (qz < 4) W.push(["medium", "Quiet zone smaller than 4 modules", "The specification asks for a blank border of at least 4 modules. A smaller border can make scanning fail."]);
    if (Q.ver >= 15) W.push(["info", `Dense code (version ${Q.ver})`, "Print it larger, and shorten the content if you can. Shorter data makes a simpler, easier-to-scan code."]);
    Object.assign(QRS, { payload: B.payload, n: Q.n, ver: Q.ver, svg: Q.svg, png: Q.cv.toDataURL("image/png"), ec, bytes: Q.bytes, label: B.label, type: B.type, px: Q.px, qz, warns: W, fg, bg, cr });
    const ecTxt = { L: "~7%", M: "~15%", Q: "~25%", H: "~30%" }[ec], k = W.some(w => w[0] === "high" || w[0] === "critical") ? "warn" : "ok";
    const summary = verdict("🔳", `${esc(B.label)} QR code ready`, k === "ok" ? "success" : "warning", `Version ${Q.ver} · ${Q.n}×${Q.n} modules · ${Q.px}×${Q.px}px · error correction ${ec} (recovers ${ecTxt} damage)`) +
        `<div class="tpr-prev tpr-qr"><img src="${QRS.png}" alt="Generated QR code for ${esc(B.label)}"></div>` +
        `<div class="tp-actions"><button type="button" class="tp-act" data-qr-dl="png">⬇ PNG</button><button type="button" class="tp-act" data-qr-dl="svg">⬇ SVG</button><button type="button" class="tp-act" data-qr-dl="copy">⧉ Copy content</button></div>` +
        (W.length ? `<div class="tp-note">${W.slice(0, 3).map(w => (w[0] === "info" ? "ℹ️ " : "⚠️ ") + esc(w[1])).join("<br>")}</div>` : note("No problems found. Test the code with two different phones before printing."));
    const html = rHero("🔳", `${esc(B.label)} QR code`, `QR Studio · version ${Q.ver} · ${Q.bytes} byte(s) encoded`, k, rGauge(Math.min(100, Math.round(cr / 21 * 100)), "contrast", cr >= 4 ? "ok" : "warn")) +
        `<div class="tpr-prev tpr-qr tpr-qr-big"><img src="${QRS.png}" alt="QR code"></div><div class="tp-actions"><button type="button" class="tp-act" data-qr-dl="png">⬇ Download PNG</button><button type="button" class="tp-act" data-qr-dl="svg">⬇ Download SVG</button></div>` +
        rTiles([["Content type", esc(B.label)], ["QR version", `${Q.ver} (of 40)`], ["Modules", `${Q.n} × ${Q.n}`], ["Data size", `${Q.bytes} bytes`], ["Error correction", `${ec} · recovers ${ecTxt}`], ["Contrast", `${cr.toFixed(1)}:1`]]) +
        rSec("🧾", "Exactly what the code contains", `<pre class="tpr-pre">${esc(B.payload)}</pre>` + rPara("Anyone scanning gets this text. Check it before printing: a typo or a wrong address goes on every copy.")) +
        rSec("🚦", "Safety and scan-quality check", W.length ? W.map(w => rSignal({ sev: w[0], title: w[1], why: w[2] })).join("") : rPara("No problems found.")) +
        rSec("🖨️", "Printing and placement tips", rList(["Keep a blank border (quiet zone) of at least 4 modules around the code.", "Rule of thumb: print at least about 2 × 2 cm for close-range scanning, and larger for denser codes or longer distances.", "Use dark modules on a light background. Test with two different phones, in the lighting where it will be used.", "Prefer SVG for printing: it stays sharp at any size.", "Write the destination in words next to the code so people know what they are scanning."])) +
        rSec("🧠", "How QR codes work (and stay accurate)", rList(["A QR code stores data in a grid of modules. Versions run from 1 (21×21) to 40 (177×177); every version adds 4 modules per side.", "Reed–Solomon error correction lets a code survive damage: level L restores about 7%, M about 15%, Q about 25%, H about 30%.", "This generator makes <b>static</b> codes: the content is baked into the image, nothing is tracked, and it cannot be changed later.", "Everything is created in your browser. Nothing you type is sent anywhere."])) +
        rSec("🛡️", "Stay safe with QR codes", rList(["Never scan a QR sticker placed over another one: criminals paste fake codes over real payment or parking codes ('quishing').", "Check the web address your phone shows before opening it.", "Do not scan codes from unexpected emails or messages that push you to log in or pay.", "A QR code that asks for your card, PIN or OTP is a scam."])) +
        rPara("<small>QR Code is a registered trademark of DENSO WAVE INCORPORATED. Encoder: Kazuhiko Arase's MIT-licensed 'QRCode for JavaScript'.</small>");
    setR("qrGenResult", "qrgen", "QR Studio", `${B.label} · version ${Q.ver}`, summary, html, k === "ok" ? "success" : "warning");
};
document.addEventListener("click", e => {
    const b = e.target.closest("[data-qr-dl]"); if (!b || !QRS.payload) return; const a = b.dataset.qrDl, base = "cyberguard-qr-" + (QRS.type || "code");
    if (a === "png") { fetch(QRS.png).then(r => r.blob()).then(bl => dlBlob(base + ".png", bl)); }
    else if (a === "svg") dlBlob(base + ".svg", QRS.svg, "image/svg+xml");
    else if (a === "copy") { (navigator.clipboard ? navigator.clipboard.writeText(QRS.payload) : Promise.reject()).then(() => { b.textContent = "✓ Copied"; setTimeout(() => (b.textContent = "⧉ Copy content"), 1500); }).catch(() => { }); }
});
function qrsToggle() {
    const t = $("qrsType").value, show = (id, on) => { const el = $(id); if (el) el.closest(".qrs-f").style.display = on ? "" : "none"; };
    const cfg = { url: ["Web address", "https://example.com", 1, 0, 0, 0], text: ["", "", 0, 0, 1, 0], wifi: ["", "", 0, 0, 0, 1], phone: ["Phone number", "+92 300 1234567", 1, 0, 0, 0], sms: ["Phone number", "+92 300 1234567", 1, 0, 1, 0], email: ["Email address", "name@example.com", 1, 1, 1, 0], whatsapp: ["WhatsApp number", "+92 300 1234567 or 0300 1234567", 1, 0, 1, 0] }[t];
    show("qrsMain", !!cfg[2]); show("qrsSub", !!cfg[3]); show("qrsBody", !!cfg[4]); show("qrsWifiSsid", !!cfg[5]); show("qrsWifiPass", !!cfg[5]); show("qrsWifiSec", !!cfg[5]); show("qrsWifiHidden", !!cfg[5]);
    const m = $("qrsMain"); if (m) { m.placeholder = cfg[1]; const lb = m.closest(".qrs-f").querySelector("label"); if (lb) lb.textContent = cfg[0]; }
    const bd = $("qrsBody"), bl = bd.closest(".qrs-f").querySelector("label"); bl.textContent = t === "text" ? "Text to encode" : t === "email" ? "Email body (optional)" : "Message (optional)"; bd.placeholder = t === "text" ? "Type any text…" : "Optional message…";
}

/* ============================================================
   35. SENSITIVE DATA REDACTOR (PII + secrets scanner)
   ============================================================ */
const wordB = (t, s, e) => !/[A-Za-z0-9_]/.test(t[s - 1] || " ") && !/[A-Za-z0-9_]/.test(t[e] || " ");
const digitB = (t, s, e) => !/\d/.test(t[s - 1] || " ") && !/\d/.test(t[e] || " ");
const RED_DETECT = [
    { t: "PRIVATE_KEY", label: "Private key block", sev: "critical", conf: "certain", secret: true, re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g },
    { t: "AWS_ACCESS_KEY", label: "AWS access key ID", sev: "critical", conf: "certain", secret: true, re: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, ok: wordB },
    { t: "GITHUB_TOKEN", label: "GitHub token", sev: "critical", conf: "certain", secret: true, re: /(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{22,255})/g, ok: wordB },
    { t: "SLACK_TOKEN", label: "Slack token", sev: "critical", conf: "certain", secret: true, re: /xox[abprs]-[A-Za-z0-9-]{10,}/g, ok: wordB },
    { t: "STRIPE_LIVE_SECRET", label: "Stripe live secret key", sev: "critical", conf: "certain", secret: true, re: /(?:sk|rk)_live_[0-9A-Za-z]{16,}/g, ok: wordB },
    { t: "GOOGLE_API_KEY", label: "Google API key", sev: "high", conf: "certain", secret: true, re: /AIza[0-9A-Za-z_-]{35}/g, ok: wordB },
    { t: "JWT", label: "JSON Web Token", sev: "high", conf: "certain", secret: true, re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, ok: wordB },
    { t: "BEARER_TOKEN", label: "Bearer token", sev: "high", conf: "likely", secret: true, re: /\bBearer\s+([A-Za-z0-9._~+\/=-]{20,})/gi, g: 1 },
    { t: "OPENAI_STYLE_KEY", label: "Possible API key (sk-…)", sev: "high", conf: "possible", secret: true, re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, ok: wordB },
    { t: "URL_PASSWORD", label: "Password inside a URL", sev: "critical", conf: "certain", secret: true, re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:([^\s@\/]{3,})@/gi, g: 1 },
    { t: "PASSWORD_VALUE", label: "Password / secret value", sev: "critical", conf: "likely", secret: true, re: /\b(?:pass(?:word)?|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["']?([^\s"',;&]{4,})/gi, g: 1 },
    { t: "CREDIT_CARD", label: "Payment card number", sev: "high", conf: "certain", re: /\d(?:[ -]?\d){12,18}/g, ok: (t, s, e) => digitB(t, s, e), v: m => { const d = m.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && !/^(\d)\1+$/.test(d) && luhn(d) && /^(?:4|5[1-5]|2[2-7]|3[47]|3[0689]|6)/.test(d); } },
    { t: "IBAN", label: "IBAN bank account", sev: "high", conf: "certain", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{2,4}){3,8}\b/g, v: m => { const s = m.replace(/ /g, ""); return IBAN_LEN[s.slice(0, 2)] === s.length && mod97(s) === 1; } },
    { t: "CNIC", label: "CNIC number (xxxxx-xxxxxxx-x)", sev: "high", conf: "likely", re: /\d{5}-\d{7}-\d/g, ok: digitB },
    { t: "EMAIL", label: "Email address", sev: "medium", conf: "certain", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { t: "PHONE_PK", label: "Pakistani mobile number", sev: "medium", conf: "likely", re: /(?:\+92|0092|92|0)[\s-]?3\d{2}[\s-]?\d{7}/g, ok: digitB },
    { t: "ID_13_DIGITS", label: "13-digit number (could be a CNIC)", sev: "medium", conf: "possible", re: /\d{13}/g, ok: digitB },
    { t: "PHONE_INTL", label: "International phone number", sev: "medium", conf: "possible", re: /\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}/g, ok: digitB },
    { t: "IPV4", label: "IPv4 address", sev: "low", conf: "likely", re: /(?:\d{1,3}\.){3}\d{1,3}/g, ok: (t, s, e) => !/[\d.]/.test(t[s - 1] || " ") && !/[\d]/.test(t[e] || " ") && !/\bv(?:ersion)?\s*$/i.test(t.slice(Math.max(0, s - 9), s)), v: m => m.split(".").every(x => +x <= 255 && String(+x) === x) },
    { t: "MAC_ADDRESS", label: "MAC address", sev: "low", conf: "likely", re: /(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/g, ok: wordB }
];
function findSensitive(text) {
    const acc = [], taken = [];
    RED_DETECT.forEach((d, pri) => {
        d.re.lastIndex = 0;
        for (const m of text.matchAll(d.re)) {
            const full = m[0]; let s = m.index, e = s + full.length, val = full;
            if (d.g) { const gv = m[d.g]; if (!gv) continue; s = m.index + full.lastIndexOf(gv); e = s + gv.length; val = gv; }
            if (d.ok && !d.ok(text, s, e)) continue; if (d.v && !d.v(val)) continue;
            if (taken.some(r => s < r[1] && e > r[0])) continue;
            taken.push([s, e]); acc.push({ s, e, d, val });
        }
    });
    return acc.sort((a, b) => a.s - b.s);
}
function maskValue(f, mode, idx) {
    const d = f.d, v = f.val;
    if (mode === "pseudo") return `<${d.t}_${idx}>`;
    if (mode === "partial" && !d.secret) {
        const digits = v.replace(/\D/g, ""), keep = 4;
        if (d.t === "EMAIL") { const [l, dom] = v.split("@"), parts = dom.split("."), tld = parts.pop(); return `${l[0]}***@${(parts[0] || "")[0] || ""}***.${tld}`; }
        if (d.t === "IBAN") { const s = v.replace(/ /g, ""); return s.slice(0, 4) + "•".repeat(Math.max(4, s.length - 8)) + s.slice(-4); }
        if (d.t === "IPV4") { const p = v.split("."); return `${p[0]}.${p[1]}.•••.•••`; }
        if (digits.length >= 8) return "•".repeat(Math.max(4, digits.length - keep)) + digits.slice(-keep);
        return `[REDACTED:${d.t}]`;
    }
    return `[REDACTED:${d.t}]`;
}
const ROTATE = { AWS_ACCESS_KEY: "AWS: in IAM, make the key Inactive, then delete it and create a new one. Check CloudTrail for use of the old key.", GITHUB_TOKEN: "GitHub: Settings → Developer settings → revoke the token, then create a new one with minimum scopes.", SLACK_TOKEN: "Slack: revoke the token in the app/OAuth settings and issue a new one.", STRIPE_LIVE_SECRET: "Stripe: roll the key in the Dashboard (Developers → API keys) and review recent activity.", GOOGLE_API_KEY: "Google Cloud: create a new key, restrict it (by API and by referrer/IP) and delete the old one.", PRIVATE_KEY: "Treat the key pair as compromised: generate a new pair, replace the public key everywhere it was trusted, and revoke the old one.", JWT: "Invalidate the session/token server-side and force re-login; rotate the signing secret if it may have leaked.", BEARER_TOKEN: "Revoke the token with the issuing service and issue a new one.", OPENAI_STYLE_KEY: "Revoke the key in the provider's dashboard and create a new one.", URL_PASSWORD: "Change that account's password immediately and remove credentials from the URL.", PASSWORD_VALUE: "Change the password/secret now; never keep secrets in logs, tickets or screenshots." };
window.redactSensitive = function () {
    const text = $("redInput")?.value || "";
    if (!text.trim()) return fail("redactResult", "Paste the text, log, config or message you want to check.");
    if (text.length > 400000) return fail("redactResult", "That is too large. Paste up to 400,000 characters.");
    const mode = $("redMode").value, F = findSensitive(text), counters = {}, outParts = []; let p = 0;
    F.forEach(f => { counters[f.d.t] = (counters[f.d.t] || 0) + 1; f.masked = maskValue(f, mode, counters[f.d.t]); outParts.push(text.slice(p, f.s), f.masked); p = f.e; }); outParts.push(text.slice(p));
    const red = outParts.join(""), by = {}; F.forEach(f => { (by[f.d.t] = by[f.d.t] || { d: f.d, n: 0, ex: f.masked }).n++; });
    const secrets = F.filter(f => f.d.secret).length, sevN = { critical: 0, high: 0, medium: 0, low: 0 }; F.forEach(f => sevN[f.d.sev]++);
    const score = Math.min(100, sevN.critical * 30 + sevN.high * 14 + sevN.medium * 5 + sevN.low * 2);
    const lv = !F.length ? ["Nothing sensitive detected", "success", "ok"] : sevN.critical ? ["Secrets found: do not share this text", "danger", "bad"] : sevN.high ? ["Sensitive data found", "warning", "warn"] : ["Some personal data found", "warning", "warn"];
    const summary = verdict(!F.length ? "✅" : sevN.critical ? "🚨" : "⚠️", lv[0], lv[1], `${F.length} item(s) found · ${Object.keys(by).length} type(s) · ${text.length.toLocaleString()} characters scanned`) + meter(score, lv[2]) +
        (F.length ? `<div class="tp-chips">${Object.values(by).map(x => badge(`${x.d.label} ×${x.n}`, x.d.sev === "critical" || x.d.sev === "high" ? "bad" : x.d.sev === "medium" ? "warn" : "info")).join("")}</div>` : "") +
        `<textarea id="redOut" class="tp-out-area" readonly rows="6" aria-label="Redacted text"></textarea><div class="tp-actions"><button type="button" class="tp-act" data-red="copy">⧉ Copy redacted text</button><button type="button" class="tp-act" data-red="dl">⬇ Download .txt</button></div>` +
        note(F.length ? (secrets ? "If any real secret was exposed anywhere (chat, ticket, repo, screenshot), treat it as compromised and rotate it." : "Review the output before sharing: automated detection can miss names, addresses and context.") : "Nothing matched the built-in patterns. Names, home addresses and free-text secrets are not detected automatically.");
    const html = rHero(!F.length ? "✅" : "🙈", esc(lv[0]), `Sensitive Data Redactor · ${F.length} finding(s) · mode: ${mode === "mask" ? "mask" : mode === "partial" ? "partial" : "pseudonymise"}`, lv[2], rGauge(score, "exposure", lv[2])) +
        rTiles([["Findings", String(F.length)], ["Critical", String(sevN.critical)], ["High", String(sevN.high)], ["Medium / low", String(sevN.medium + sevN.low)], ["Secrets & keys", String(secrets)], ["Characters scanned", text.length.toLocaleString()]]) +
        rSec("📋", "What was found", F.length ? rTable(["Type", "Count", "Severity", "Confidence", "Replaced with (example)"], Object.values(by).sort((a, b) => SEV_ORDER[a.d.sev] - SEV_ORDER[b.d.sev]).map(x => [esc(x.d.label), String(x.n), badge(x.d.sev.toUpperCase(), x.d.sev === "critical" || x.d.sev === "high" ? "bad" : x.d.sev === "medium" ? "warn" : "info"), esc(x.d.conf), `<code>${esc(x.ex)}</code>`])) : rPara("No patterns matched.")) +
        rSec("🙈", "Redacted text", `<pre class="tpr-pre">${esc(red.length > 6000 ? red.slice(0, 6000) + "\n… (shortened here, full text is in the tool)" : red)}</pre>` + `<div class="tp-actions"><button type="button" class="tp-act" data-red="copy">⧉ Copy redacted text</button><button type="button" class="tp-act" data-red="dl">⬇ Download .txt</button></div>`) +
        (secrets ? rSec("🔑", "Rotate every exposed secret", rSteps([...new Set(F.filter(f => f.d.secret).map(f => ROTATE[f.d.t]).filter(Boolean))].map(esc).concat(["Search your logs and repositories for the old value, and check the provider's activity log for unexpected use.", "Remove secrets from code: use environment variables or a secrets manager, and enable secret scanning (for example gitleaks or trufflehog) in your pipeline."]))) : "") +
        rSec("🧭", "How the three modes work", rList(["<b>Mask:</b> replaces each match with [REDACTED:TYPE]. Safest for sharing.", "<b>Partial:</b> keeps a hint (last 4 digits, first letter of an email). Secrets and keys are never partially shown.", "<b>Pseudonymise:</b> replaces each match with a numbered placeholder such as &lt;EMAIL_1&gt;, so a reader can still follow the story of a log."])) +
        rSec("🛡️", "Before you share a log, ticket or screenshot", rList(["Read the redacted version once more: automated rules cannot recognise names, addresses or free-text secrets.", "Screenshots: blur or crop, and remember browser tabs, bookmarks and notifications.", "Share the least data needed. Prefer a few relevant lines over a full log.", "Credit-card numbers are only flagged when they pass the Luhn check and look like real card ranges; IBANs only when the country length and checksum are valid."])) +
        rPara("<small>All detection runs locally in your browser; the text is never sent anywhere. Patterns follow the public formats of each provider, but new key formats appear over time, so treat this as a safety net, not a guarantee.</small>");
    setR("redactResult", "redact", "Sensitive Data Redactor", `${F.length} finding(s)`, summary, html, lv[1]);
    const ta = $("redOut"); if (ta) ta.value = red; window.__redOut = red;
};
document.addEventListener("click", e => {
    const b = e.target.closest("[data-red]"); if (!b || window.__redOut === undefined) return;
    if (b.dataset.red === "copy") { (navigator.clipboard ? navigator.clipboard.writeText(window.__redOut) : Promise.reject()).then(() => { const o = b.textContent; b.textContent = "✓ Copied"; setTimeout(() => (b.textContent = o), 1500); }).catch(() => { }); }
    else dlBlob("redacted.txt", window.__redOut, "text/plain");
});
function initToolsV7() {
    const ty = $("qrsType"); if (ty) { qrsToggle(); let t = null; const go = () => { clearTimeout(t); t = setTimeout(() => { if ($("qrGenResult").dataset.live) window.generateQRStudio(); }, 300); }; ty.addEventListener("change", () => { qrsToggle(); if ($("qrGenResult").dataset.live) window.generateQRStudio(); });
        ["qrsMain", "qrsSub", "qrsBody", "qrsWifiSsid", "qrsWifiPass", "qrsWifiSec", "qrsWifiHidden", "qrsEc", "qrsSize", "qrsQz", "qrsFg", "qrsBg"].forEach(id => { const el = $(id); if (el) { el.addEventListener("input", go); el.addEventListener("change", go); } });
        const btn = $("qrsGo"); if (btn) btn.addEventListener("click", () => { $("qrGenResult").dataset.live = "1"; window.generateQRStudio(); }); }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToolsV7); else initToolsV7();


/* ============================================================================
   TOOLS v7b  -  upgrades for all tools: Smart Paste, pin favourites, "Try example",
   report export (txt / html / print) and advanced panels (JWT, HMAC, DNS, CIDR, AES file, defang)
   ============================================================================ */
const REPORT_CSS = "body{font:14px/1.6 system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:860px;margin:24px auto;padding:0 18px}h3{margin:0 0 4px}h4{margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #0ea5e9;color:#075985;text-transform:uppercase;font-size:.8rem;letter-spacing:.06em}.tpr-hero{display:flex;gap:14px;align-items:center;padding:14px;border:2px solid #cbd5e1;border-radius:12px;margin-bottom:12px}.tpr-hero-i{font-size:2rem}.tpr-hero-t p{margin:2px 0;color:#475569}.tpr-gauge{margin-left:auto;text-align:center;font-weight:700}.tpr-gauge svg{display:none}.tpr-gauge b{font-size:1.6rem}.tpr-gauge small{display:block;color:#64748b;font-weight:400}.tpr-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}.tpr-tile{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px}.tpr-tile small{display:block;color:#64748b;font-size:.68rem;text-transform:uppercase}.tpr-tile em{display:block;color:#64748b;font-size:.72rem;font-style:normal}table{border-collapse:collapse;width:100%;font-size:.84rem}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9}code,pre{font-family:Consolas,monospace;background:#f1f5f9;padding:1px 5px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere}.tpr-sig{border-left:4px solid #94a3b8;padding:6px 10px;margin:6px 0;background:#f8fafc}.tpr-s-critical{border-color:#e11d48}.tpr-s-high{border-color:#f97316}.tpr-s-medium{border-color:#eab308}.tpr-s-good{border-color:#16a34a}.tpr-dot{display:none}.tpr-sig p{margin:2px 0;color:#475569}mark{background:#fde68a;padding:0 2px}.tp-actions,button,.tp-copy,.tp-open{display:none}.tpr-prev img{max-width:220px}footer{margin-top:28px;color:#64748b;font-size:.75rem;border-top:1px solid #cbd5e1;padding-top:8px}@media print{h4{break-after:avoid}.tpr-sig,.tpr-tile{break-inside:avoid}}";
function reportStandalone() {
    const title = $("tpmTitle").textContent, sub = $("tpmSub").textContent, body = $("tpmBody").cloneNode(true);
    body.querySelectorAll("button,.tp-actions,script").forEach(x => x.remove());
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} - CyberGuard report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${REPORT_CSS}</style></head><body><h3>${esc(title)}</h3><small>${esc(sub)} · generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</small>${body.innerHTML}<footer>Generated by CyberGuard security tools. Educational guidance: confirm important decisions through official sources.</footer></body></html>`;
}
function hookReportExport() {
    const old = ensureModal; /* patch once the modal exists */
    const add = () => { const act = document.querySelector("#tpModal .tp-modal-actions"); if (!act || $("tpmTxt")) return; act.insertAdjacentHTML("afterbegin", `<button type="button" id="tpmTxt" class="tp-copy" title="Download as text">⬇ .txt</button><button type="button" id="tpmHtml" class="tp-copy" title="Download as a standalone web page">⬇ .html</button><button type="button" id="tpmPrint" class="tp-copy" title="Print or save as PDF">🖨 Print</button>`);
        const nm = () => ($("tpmTitle").textContent || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        $("tpmTxt").onclick = () => dlBlob(`cyberguard-${nm()}.txt`, `${$("tpmTitle").textContent}\n${$("tpmSub").textContent}\n${"=".repeat(60)}\n\n${$("tpmBody").innerText.trim()}\n\n-- Generated by CyberGuard security tools --\n`, "text/plain");
        $("tpmHtml").onclick = () => dlBlob(`cyberguard-${nm()}.html`, reportStandalone(), "text/html");
        $("tpmPrint").onclick = () => { const f = document.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f); f.srcdoc = reportStandalone(); f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { } setTimeout(() => f.remove(), 60000); }; };
    };
    new MutationObserver(add).observe(document.body, { childList: true });
    add();
}

/* ---------- Smart Paste ---------- */
function detectKinds(raw) {
    const t = raw.trim(), out = []; if (!t) return out;
    const add = (icon, name, input, fn, why) => out.push({ icon, name, input, fn, why });
    const oneLine = !/\n/.test(t);
    if (/^eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*$/.test(t)) add("🔑", "JWT Token Inspector", "jwtInput", "decodeJWT", "Looks like a JSON Web Token");
    else if (/(^|\n)(Received|Authentication-Results|Return-Path|Message-ID|DKIM-Signature):/i.test(t) && /(^|\n)(From|Subject|Date):/i.test(t)) add("📧", "Email Header Analyzer", "hdrInput", "analyzeEmailHeaders", "Looks like raw email headers");
    else if (oneLine && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) { add("📨", "Email Breach & Mail-Security Check", "emailInput", "simulateBreachCheck", "Looks like an email address"); add("🙈", "Sensitive Data Redactor", "redInput", "redactSensitive", "Mask it before sharing"); }
    else if (oneLine && /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(t)) add("🧮", "CIDR Subnet Calculator", "cidrInput", "calculateCIDR", "Looks like a CIDR range");
    else if (oneLine && isIP(t) && !/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(t)) { add("🌐", "IP Geolocation & Threat Finder", "ipInput", "lookupIP", "Looks like an IP address"); add("🔌", "Port Vulnerability Scanner", "portScanInput", "scanPorts", "See its exposed services"); add("🍯", "Honeypot Service Detector", "honeypotInput", "detectHoneypot", "Check if it looks like a decoy"); }
    else if (oneLine && /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(t)) add("🔌", "MAC Vendor Identifier", "macInput", "checkMAC", "Looks like a MAC address");
    else if (oneLine && /^[A-Z]{2}\d{2}[A-Z0-9 ]{11,40}$/i.test(t.replace(/\s/g, "")) && IBAN_LEN[t.replace(/\s/g, "").slice(0, 2).toUpperCase()] === t.replace(/\s/g, "").length) add("🏦", "Pakistani IBAN / IBAN Validator", "ibanInput", "validateIBAN", "Looks like an IBAN");
    else if (oneLine && /^(?:https?:\/\/|www\.)\S+$/i.test(t)) { add("🔗", "URL Inspector", "urlInput", "inspectURL", "Looks like a web link"); add("🔒", "SSL Certificate Inspector", "sslInput", "checkSSL", "Check its certificate"); add("🛡️", "Security Headers Audit", "headerInput", "auditSecurityHeaders", "Audit its headers"); add("🧭", "DNS Record Lookup", "dnsInput", "lookupDNS", "Inspect its DNS"); }
    else if (oneLine && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(t)) { add("🧭", "DNS Record Lookup", "dnsInput", "lookupDNS", "Looks like a domain name"); add("🔗", "URL Inspector", "urlInput", "inspectURL", "Is it a scam site?"); add("🔒", "SSL Certificate Inspector", "sslInput", "checkSSL", "Check its certificate"); add("🌳", "Subdomain Finder", "subdomainInput", "findSubdomains", "List its subdomains"); add("🌑", "Dark Web Monitoring", "darkwebInput", "checkDarkWeb", "Was it in breaches?"); }
    else if (oneLine && /^\d{6,8}$/.test(t)) add("💳", "Card BIN Inspector", "binInput", "checkBIN", "6-8 digits: a card BIN");
    else if (oneLine && /^(?:\d[ -]?){13,19}$/.test(t) && luhn(t.replace(/\D/g, ""))) { add("⚠️", "Sensitive Data Redactor", "redInput", "redactSensitive", "This looks like a FULL card number. Never paste real card numbers into tools. Mask it."); }
    else if (oneLine && /^(?:\+92|0092|92|0)[\s-]?3\d{2}[\s-]?\d{7}$/.test(t)) add("📞", "Fraud Handle & Number OSINT", "handleInput", "searchScamHandle", "Looks like a Pakistani mobile number");
    else if (oneLine && /^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$|^[0-9a-f]{128}$/i.test(t)) { const n = t.length, g = { 32: "MD5 or NTLM", 40: "SHA-1", 64: "SHA-256", 128: "SHA-512" }[n]; add("#️⃣", "Hash detected: " + g, "", "", `${n} hex characters. A hash cannot be reversed; check it against a known list or compare it with a file's hash in the File Integrity tool.`); }
    else if (oneLine && /%[0-9A-Fa-f]{2}/.test(t) && !/\s/.test(t)) add("🔗", "URL Encoder / Decoder", "urlCodecInput", "__decode", "Looks percent-encoded");
    else if (oneLine && t.length >= 16 && t.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(t) && (() => { try { return /^[\x09\x0a\x0d\x20-\x7e]+$/.test(atob(t)); } catch (_) { return false; } })()) add("🔤", "Base64 Decoder", "base64Input", "__b64dec", "Looks like Base64 text");
    else if (/[<>]|javascript:/i.test(t) && oneLine) add("🧼", "XSS Sanitizer", "xssInput", "sanitizeXSS", "Contains HTML/script characters");
    else if (/('|--|\bunion\b|\bselect\b|\bor\b\s+1=1)/i.test(t) && oneLine && t.length < 200) add("💉", "SQLi String Checker", "sqliInput", "checkSQLi", "Contains SQL-like syntax");
    if (!out.length || t.length > 30) {
        if (findSensitive(t).length) add("🙈", "Sensitive Data Redactor", "redInput", "redactSensitive", "Contains passwords, keys, cards or personal data");
        if ((!oneLine || t.length > 40) && /\s/.test(t)) add("🕵️", "Scam Message Analyzer", "scamMsgInput", "analyzeScamMessage", "Is this message a scam?");
    }
    return out;
}
function initSmartPaste() {
    const s = $("toolSearch"); if (!s || $("tpOmni")) return; const host = s.closest(".tools-search-wrap") || s.parentElement;
    host.insertAdjacentHTML("beforebegin", `<div class="tp-omni" id="tpOmni"><label for="tpOmniIn">🧠 <b>Smart Paste</b> <small>paste anything: link, email, IP, hash, JWT, message, headers… and I will pick the right tool</small></label><textarea id="tpOmniIn" rows="1" placeholder="Paste here, e.g. https://example.com  ·  name@mail.com  ·  8.8.8.8  ·  a suspicious SMS…" spellcheck="false" autocomplete="off"></textarea><div class="tp-omni-out" id="tpOmniOut" aria-live="polite"></div></div>`);
    const inp = $("tpOmniIn"), out = $("tpOmniOut"); let t = null;
    const render = () => {
        const v = inp.value; inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px";
        const k = detectKinds(v);
        out.innerHTML = !v.trim() ? "" : k.length ? k.map((x, i) => x.fn ? `<button type="button" class="tp-omni-chip" data-i="${i}"><span>${x.icon}</span><b>${esc(x.name)}</b><small>${esc(x.why)}</small></button>` : `<div class="tp-omni-info"><span>${x.icon}</span><div><b>${esc(x.name)}</b><small>${esc(x.why)}</small></div></div>`).join("") : `<div class="tp-omni-info"><span>🤷</span><div><b>No exact match</b><small>Try a full link, an email address, an IP, a domain, or paste a suspicious message.</small></div></div>`;
        out._k = k;
    };
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(render, 160); }); inp.addEventListener("paste", () => setTimeout(render, 30));
    out.addEventListener("click", e => {
        const b = e.target.closest(".tp-omni-chip"); if (!b) return; const x = out._k[+b.dataset.i], v = inp.value.trim(), el = $(x.input); if (!el) return;
        const card = el.closest(".tool-card"); const flt = document.querySelector(".tool-filter.active"); if (card && card.hidden) { const all = [...document.querySelectorAll(".tool-filter")][0]; all && all.click(); const sv = $("toolSearch"); if (sv && sv.value) { sv.value = ""; sv.dispatchEvent(new Event("input")); } }
        if (x.fn === "__decode") { el.value = v; if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => window.handleURLCodec && window.handleURLCodec("decode"), 350); return; }
        if (x.fn === "__b64dec") { el.value = v; if (card) card.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => window.handleBase64 && window.handleBase64("decode"), 350); return; }
        el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("tp-flash"); setTimeout(() => card.classList.remove("tp-flash"), 1800); }
        setTimeout(() => { if (typeof window[x.fn] === "function") window[x.fn](); }, 380);
    });
}

/* ---------- pin favourites + "Try example" ---------- */
const TRY = { strengthText: ["passInput", "correct horse battery staple 7!", () => window.checkPasswordStrength && window.checkPasswordStrength()], breachResult: ["emailInput", "test@example.com", "simulateBreachCheck"], urlResult: ["urlInput", "http://secure-login.paypa1-verify.xyz/otp?next=https://evil.com", "inspectURL"], ipResult: ["ipInput", "8.8.8.8", "lookupIP"], jwtResult: ["jwtInput", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c", "decodeJWT"], base64Result: ["base64Input", "Hello CyberGuard", () => window.handleBase64("encode")], hashResult: ["hashInput", "hello", "generateHash"], urlCodecResult: ["urlCodecInput", "name=Ali Khan&city=Karachi", () => window.handleURLCodec("encode")], portScanResult: ["portScanInput", "scanme.nmap.org", "scanPorts"], dnsResult: ["dnsInput", "example.com", "lookupDNS"], headerResult: ["headerInput", "https://example.com", "auditSecurityHeaders"], binResult: ["binInput", "411111", "checkBIN"], qrResult: ["qrInput", "https://example.com/pay?amount=500", "checkQRData"], sslResult: ["sslInput", "example.com", "checkSSL"], subdomainResult: ["subdomainInput", "example.com", "findSubdomains"], macResult: ["macInput", "00:0C:29:12:34:56", "checkMAC"], cidrResult: ["cidrInput", "192.168.10.0/26", "calculateCIDR"], pingResult: ["pingInput", "example.com", "simulatePing"], honeypotResult: ["honeypotInput", "example.com", "detectHoneypot"], handleResult: ["handleInput", "easypaisa_official_support", "searchScamHandle"], extResult: ["extInput", "invoice.pdf.exe", "checkFileExtension"], ibanResult: ["ibanInput", "PK36SCBL0000001123456702", "validateIBAN"], wifiResult: ["wifiInput", "WPA2-Personal / AES", "analyzeWiFi"], sqliResult: ["sqliInput", "' OR 1=1 --", "checkSQLi"], xssResult: ["xssInput", "<img src=x onerror=alert(1)>", "sanitizeXSS"], darkwebResult: ["darkwebInput", "example.com", "checkDarkWeb"],
    scamMsgResult: ["scamMsgInput", "URGENT: Your EasyPaisa account will be blocked within 2 hours. You have won Rs. 500,000 in the BISP lucky draw! Send Rs. 2500 processing fee and share your OTP code to claim. Click http://easypaisa-verify.xyz/claim now.", "analyzeScamMessage"],
    hdrResult: ["hdrInput", "Received: from mail.example.net ([203.0.113.9]) by mx.example.org with ESMTPS; Mon, 02 Nov 2026 08:00:04 +0000\nAuthentication-Results: mx.example.org; spf=fail smtp.mailfrom=billing@examp1e.net; dkim=none; dmarc=fail header.from=examp1e.net\nReturn-Path: <bounce@mailer.test>\nFrom: \"Example Billing\" <billing@examp1e.net>\nReply-To: billing.help@gmail.com\nSubject: Invoice overdue\nDate: Mon, 02 Nov 2026 08:00:00 +0000\nMessage-ID: <1@mailer.test>", "analyzeEmailHeaders"],
    redactResult: ["redInput", "Contact ali@example.com or 0300-1234567. CNIC 42101-1234567-1. password=Sup3rS3cret! key AKIAIOSFODNN7EXAMPLE card 4111 1111 1111 1111", "redactSensitive"] };
const PIN_KEY = "cg_pinned_tools";
const pinned = () => { try { return JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); } catch (_) { return []; } };
function toolIdOf(card) { const e = card.querySelector('[id$="Result"],#strengthText,#genPassOutput'); return e ? e.id : ""; }
function initPinsAndExamples() {
    const cards = document.querySelectorAll("#tools .tool-card"); const pins = new Set(pinned());
    cards.forEach(card => {
        const id = toolIdOf(card); if (!id) return;
        if (!card.querySelector(".tp-pin")) { card.insertAdjacentHTML("afterbegin", `<button type="button" class="tp-pin${pins.has(id) ? " on" : ""}" aria-pressed="${pins.has(id)}" title="Pin this tool to MY TOOLS">★</button>`); card.dataset.fav = pins.has(id) ? "1" : "0"; }
        const tr = TRY[id]; if (tr && !card.querySelector(".tp-try")) { const btn = card.querySelector(".btn-primary-small") || card.querySelector(".input-group"); if (btn) btn.insertAdjacentHTML("afterend", `<button type="button" class="tp-try" data-try="${id}" title="Fill an example and run it">✨ Try example</button>`); }
    });
}
document.addEventListener("click", e => {
    const p = e.target.closest(".tp-pin");
    if (p) { const card = p.closest(".tool-card"), id = toolIdOf(card), s = new Set(pinned()); if (s.has(id)) s.delete(id); else s.add(id); try { localStorage.setItem(PIN_KEY, JSON.stringify([...s])); } catch (_) { } const on = s.has(id); p.classList.toggle("on", on); p.setAttribute("aria-pressed", on); card.dataset.fav = on ? "1" : "0"; const act = document.querySelector(".tool-filter.active"); if (act && /PINNED/i.test(act.textContent)) act.click(); return; }
    const t = e.target.closest(".tp-try"); if (!t) return; const [inId, text, fn] = TRY[t.dataset.try], el = $(inId); if (!el) return; el.value = text; el.dispatchEvent(new Event("input", { bubbles: true }));
    setTimeout(() => { typeof fn === "function" ? fn() : (typeof window[fn] === "function" && window[fn]()); }, 120);
});

/* ---------- advanced panels inside existing tools ---------- */
const mini = (id, html, kind) => { const e = $(id); if (e) { e.className = "tp-mini" + (kind ? " tp-mini-" + kind : ""); e.innerHTML = html; const d = e.closest("details"); if (d && !d.open) d.open = true; } };
function advPanel(resultId, key, summary, html) {
    const res = $(resultId); if (!res || res.parentElement.querySelector(`[data-adv="${key}"]`)) return null;
    const d = document.createElement("details"); d.className = "tp-adv"; d.dataset.adv = key; d.innerHTML = `<summary>${summary}</summary><div class="tp-adv-body">${html}</div>`; res.parentElement.insertBefore(d, res); return d;
}
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uToBytes = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const hexOf = u8 => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");
const HASHN = { "HS256": "SHA-256", "HS384": "SHA-384", "HS512": "SHA-512" };
async function hmac(hash, key, data) { const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash }, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", k, typeof data === "string" ? enc.encode(data) : data)); }
const ipToInt = ip => ip.split(".").reduce((a, o) => ((a << 8) + (+o)) >>> 0, 0), intToIp = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join(".");
const isV4 = s => /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s);
function initAdvanced() {
    /* JWT verify / sign */
    advPanel("jwtResult", "jwt", "🔏 Advanced: verify a signature or sign a test token (HS256/384/512)", `<div class="tp-adv-row"><input type="text" id="jwtSecret" placeholder="Secret (e.g. your-256-bit-secret)" autocomplete="off"><select id="jwtAlg"><option>HS256</option><option>HS384</option><option>HS512</option></select></div><div class="tp-adv-row"><button type="button" class="tp-act" id="jwtVerifyBtn">Verify the token above</button></div><textarea id="jwtPayload" rows="3" placeholder='Payload JSON to sign, e.g. {"sub":"123","name":"Test","exp":1999999999}'></textarea><div class="tp-adv-row"><button type="button" class="tp-act" id="jwtSignBtn">Sign a test token</button></div><div id="jwtAdvOut"></div><small class="tp-hint">Runs locally. Use test secrets only. Never paste a production secret into any website.</small>`);
    $("jwtVerifyBtn")?.addEventListener("click", async () => {
        const tok = val("jwtInput"), sec = $("jwtSecret").value; if (!tok) return mini("jwtAdvOut", "Paste the token in the box above first.", "warn");
        const p = tok.split("."); if (p.length !== 3) return mini("jwtAdvOut", "That is not a three-part JWT.", "bad");
        let h; try { h = JSON.parse(dec.decode(b64uToBytes(p[0]))); } catch (_) { return mini("jwtAdvOut", "The header is not valid Base64URL JSON.", "bad"); }
        const alg = String(h.alg || ""); if (/^none$/i.test(alg)) return mini("jwtAdvOut", "⚠️ alg is <b>none</b>: this token has no signature at all. Servers must reject it. Never trust it.", "bad");
        if (!HASHN[alg]) return mini("jwtAdvOut", `This token uses <b>${esc(alg || "an unknown algorithm")}</b>. HMAC secrets only verify HS256/384/512. RS*/ES*/PS* tokens need the issuer's public key.`, "warn");
        if (!sec) return mini("jwtAdvOut", "Enter the secret first.", "warn");
        try { const sig = b64u(await hmac(HASHN[alg], sec, p[0] + "." + p[1])), ok = sig === p[2]; mini("jwtAdvOut", ok ? `✅ <b>Signature valid</b> for ${esc(alg)} with this secret.` : `❌ <b>Signature does NOT match</b> this secret (or the token was altered).`, ok ? "ok" : "bad"); } catch (e) { mini("jwtAdvOut", "Could not verify: " + esc(e.message), "bad"); }
    });
    $("jwtSignBtn")?.addEventListener("click", async () => {
        const sec = $("jwtSecret").value, alg = $("jwtAlg").value; let pl; if (!sec) return mini("jwtAdvOut", "Enter a test secret first.", "warn");
        try { pl = JSON.parse($("jwtPayload").value || "{}"); if (!pl || typeof pl !== "object" || Array.isArray(pl)) throw 0; } catch (_) { return mini("jwtAdvOut", "The payload must be a valid JSON object.", "bad"); }
        const h = b64u(enc.encode(JSON.stringify({ alg, typ: "JWT" }))), b = b64u(enc.encode(JSON.stringify(pl))), s = b64u(await hmac(HASHN[alg], sec, h + "." + b));
        mini("jwtAdvOut", `Signed ${esc(alg)} token:<textarea class="tp-out-area" rows="3" readonly>${esc(h + "." + b + "." + s)}</textarea>${sec.length < 32 ? "<small class='tp-hint'>⚠️ That secret is shorter than 32 characters: weak secrets can be brute-forced offline.</small>" : ""}`, "ok");
    });
    /* HMAC */
    advPanel("hashResult", "hmac", "🔐 Advanced: HMAC (keyed hash, proves who made a message)", `<div class="tp-adv-row"><input type="text" id="hmacKey" placeholder="Secret key" autocomplete="off"><select id="hmacAlg"><option value="SHA-256">HMAC-SHA-256</option><option value="SHA-384">HMAC-SHA-384</option><option value="SHA-512">HMAC-SHA-512</option><option value="SHA-1">HMAC-SHA-1 (legacy)</option></select></div><div class="tp-adv-row"><button type="button" class="tp-act" id="hmacBtn">Compute HMAC of the text above</button></div><div id="hmacOut"></div><small class="tp-hint">A plain hash can be recomputed by anyone. An HMAC needs the secret key, so it also proves authenticity. Used to sign webhooks and API requests.</small>`);
    $("hmacBtn")?.addEventListener("click", async () => {
        const key = $("hmacKey").value, msg = $("hashInput")?.value || ""; if (!key || !msg) return mini("hmacOut", "Enter the text above and a key here.", "warn");
        const r = await hmac($("hmacAlg").value, key, msg); mini("hmacOut", `<b>Hex:</b> <code>${hexOf(r)}</code><br><b>Base64:</b> <code>${btoa(String.fromCharCode(...r))}</code>`, "ok");
    });
    /* DNS: compare resolvers */
    advPanel("dnsResult", "dnscmp", "🧭 Advanced: compare Google vs Cloudflare answers", `<div class="tp-adv-row"><select id="dnsCmpType"><option>A</option><option>AAAA</option><option>MX</option><option>NS</option><option>TXT</option><option>CAA</option></select><button type="button" class="tp-act" id="dnsCmpBtn">Compare resolvers for the domain above</button></div><div id="dnsCmpOut"></div><small class="tp-hint">Different answers can be normal (CDNs return different IPs by location) but can also reveal DNS hijacking or stale caches.</small>`);
    $("dnsCmpBtn")?.addEventListener("click", async () => {
        const raw = val("dnsInput").replace(/^https?:\/\//i, "").split(/[\/?#]/)[0].toLowerCase(), type = $("dnsCmpType").value; if (!raw || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return mini("dnsCmpOut", "Enter a valid domain in the DNS box above.", "warn");
        mini("dnsCmpOut", "Asking both resolvers…");
        const q = async url => { try { const r = await fetch(url, { headers: { accept: "application/dns-json" } }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
        const [g, c] = await Promise.all([q(`https://dns.google/resolve?name=${encodeURIComponent(raw)}&type=${type}`), q(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(raw)}&type=${type}`)]);
        const ans = j => j && j.Answer ? j.Answer.filter(a => a.type === ({ A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CAA: 257 }[type])).map(a => String(a.data).replace(/^"|"$/g, "").trim()).sort() : null;
        const a = ans(g), b = ans(c); if (a === null && b === null) return mini("dnsCmpOut", "Both resolvers were unreachable (network or blocked).", "bad");
        const same = a && b && a.length === b.length && a.every((x, i) => x.toLowerCase() === b[i].toLowerCase());
        const col = (n, l, s) => `<div class="tp-col"><b>${n}</b>${s === null ? "<small>unreachable</small>" : s.length ? s.map(x => `<code>${esc(x.slice(0, 160))}</code>`).join("") : "<small>no records</small>"}<small>Status ${l ? l.Status : "?"}${l && l.AD ? " · DNSSEC validated" : ""}</small></div>`;
        mini("dnsCmpOut", `<div class="tp-cols">${col("Google (8.8.8.8)", g, a)}${col("Cloudflare (1.1.1.1)", c, b)}</div><div class="tp-verdict-line">${a && b ? (same ? "✅ Both resolvers agree." : "⚠️ The answers differ. Check whether the site uses a CDN or recently changed DNS.") : "⚠️ Only one resolver answered."}</div>`, same ? "ok" : "warn");
    });
    /* CIDR: IP inside range + split */
    advPanel("cidrResult", "cidr", "🧮 Advanced: is an IP inside the range? Split into smaller subnets", `<div class="tp-adv-row"><input type="text" id="cidrIp" placeholder="IP to test, e.g. 192.168.10.37"><button type="button" class="tp-act" id="cidrInBtn">Is it inside the CIDR above?</button></div><div class="tp-adv-row"><input type="number" id="cidrSplit" min="1" max="32" placeholder="New prefix, e.g. 28"><button type="button" class="tp-act" id="cidrSplitBtn">Split the CIDR above</button></div><div id="cidrAdvOut"></div><small class="tp-hint">IPv4 only. For a /N network, usable hosts = 2^(32−N) − 2 (a /31 has 2 and a /32 has 1).</small>`);
    const cidrParse = () => { const m = val("cidrInput").match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/); if (!m || !isV4(m[1]) || +m[2] > 32) return null; const p = +m[2], mask = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0, net = (ipToInt(m[1]) & mask) >>> 0; return { p, mask, net, bc: (net | (~mask >>> 0)) >>> 0 }; };
    $("cidrInBtn")?.addEventListener("click", () => { const c = cidrParse(), ip = val("cidrIp"); if (!c) return mini("cidrAdvOut", "Enter a valid IPv4 CIDR (like 192.168.10.0/24) in the box above.", "warn"); if (!isV4(ip)) return mini("cidrAdvOut", "Enter a valid IPv4 address to test.", "warn"); const n = ipToInt(ip), inside = n >= c.net && n <= c.bc; mini("cidrAdvOut", `${inside ? "✅" : "❌"} <b>${esc(ip)}</b> is ${inside ? "" : "<b>NOT</b> "}inside <b>${intToIp(c.net)}/${c.p}</b> (${intToIp(c.net)} – ${intToIp(c.bc)}).`, inside ? "ok" : "bad"); });
    $("cidrSplitBtn")?.addEventListener("click", () => { const c = cidrParse(), np = +$("cidrSplit").value; if (!c) return mini("cidrAdvOut", "Enter a valid IPv4 CIDR in the box above.", "warn"); if (!np || np <= c.p || np > 32) return mini("cidrAdvOut", `New prefix must be bigger than /${c.p} and at most /32.`, "warn"); const cnt = Math.pow(2, np - c.p), size = Math.pow(2, 32 - np); if (cnt > 64) return mini("cidrAdvOut", `That makes ${cnt.toLocaleString()} subnets. Choose a prefix that gives 64 or fewer.`, "warn"); let rows = ""; for (let i = 0; i < cnt; i++) { const n = (c.net + i * size) >>> 0, b = (n + size - 1) >>> 0, usable = np >= 31 ? size : size - 2; rows += `<tr><td>${intToIp(n)}/${np}</td><td>${np >= 31 ? intToIp(n) : intToIp(n + 1)} – ${np >= 31 ? intToIp(b) : intToIp(b - 1)}</td><td>${intToIp(b)}</td><td>${usable}</td></tr>`; } mini("cidrAdvOut", `<b>${cnt} subnet(s)</b> of /${np}<div class="tp-tbl-wrap"><table class="tp-tbl"><thead><tr><th>Network</th><th>Usable range</th><th>Broadcast</th><th>Usable hosts</th></tr></thead><tbody>${rows}</tbody></table></div>`, "ok"); });
    /* AES file encryption */
    advPanel("aesResult", "aesfile", "📁 Advanced: encrypt or decrypt a FILE (AES-256-GCM)", `<input type="file" id="aesFile"><input type="password" id="aesFilePass" placeholder="Passphrase (long and random)" autocomplete="new-password"><div class="tp-adv-row"><button type="button" class="tp-act" id="aesFileEnc">🔒 Encrypt file</button><button type="button" class="tp-act" id="aesFileDec">🔓 Decrypt .cgenc file</button></div><div id="aesFileOut"></div><small class="tp-hint">The key comes from your passphrase with PBKDF2-SHA-256 (250,000 rounds). The file never leaves your device. Lose the passphrase and the file cannot be recovered. Limit: 100 MB.</small>`);
    const MAGIC = enc.encode("CGENC1"), derive = async (pw, salt) => { const km = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]); return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); };
    const fileArg = () => { const f = $("aesFile")?.files?.[0], pw = $("aesFilePass")?.value; if (!f) { mini("aesFileOut", "Choose a file first.", "warn"); return null; } if (!pw || pw.length < 8) { mini("aesFileOut", "Enter a passphrase of at least 8 characters (12+ is better).", "warn"); return null; } if (f.size > 100 * 1048576) { mini("aesFileOut", "File is over 100 MB.", "warn"); return null; } return { f, pw }; };
    $("aesFileEnc")?.addEventListener("click", async () => {
        const a = fileArg(); if (!a) return; mini("aesFileOut", "Encrypting (key derivation takes a moment)…");
        try { const data = new Uint8Array(await a.f.arrayBuffer()), hdr = enc.encode(JSON.stringify({ n: a.f.name, t: a.f.type, s: data.length })), plain = new Uint8Array(4 + hdr.length + data.length); new DataView(plain.buffer).setUint32(0, hdr.length); plain.set(hdr, 4); plain.set(data, 4 + hdr.length);
            const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), key = await derive(a.pw, salt), ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)), out = new Uint8Array(MAGIC.length + 28 + ct.length); out.set(MAGIC, 0); out.set(salt, MAGIC.length); out.set(iv, MAGIC.length + 16); out.set(ct, MAGIC.length + 28);
            dlBlob(a.f.name + ".cgenc", new Blob([out], { type: "application/octet-stream" })); mini("aesFileOut", `✅ Encrypted <b>${esc(a.f.name)}</b> → <b>${esc(a.f.name)}.cgenc</b> (${fmtBytes(out.length)}). The original name is stored inside the encrypted data.`, "ok"); } catch (e) { mini("aesFileOut", "Encryption failed: " + esc(e.message), "bad"); }
    });
    $("aesFileDec")?.addEventListener("click", async () => {
        const a = fileArg(); if (!a) return; mini("aesFileOut", "Decrypting…");
        try { const d = new Uint8Array(await a.f.arrayBuffer()); if (d.length < MAGIC.length + 28 + 16 || !MAGIC.every((b, i) => d[i] === b)) return mini("aesFileOut", "This is not a CyberGuard .cgenc file.", "bad");
            const salt = d.slice(MAGIC.length, MAGIC.length + 16), iv = d.slice(MAGIC.length + 16, MAGIC.length + 28), ct = d.slice(MAGIC.length + 28), key = await derive(a.pw, salt); let plain; try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)); } catch (_) { return mini("aesFileOut", "❌ Wrong passphrase, or the file was damaged or altered.", "bad"); }
            const hl = new DataView(plain.buffer).getUint32(0), meta = JSON.parse(dec.decode(plain.slice(4, 4 + hl))), data = plain.slice(4 + hl), safe = String(meta.n || "decrypted-file").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120);
            dlBlob(safe, new Blob([data], { type: meta.t || "application/octet-stream" })); mini("aesFileOut", `✅ Decrypted and verified. Saved as <b>${esc(safe)}</b> (${fmtBytes(data.length)}).`, "ok"); } catch (e) { mini("aesFileOut", "Decryption failed: " + esc(e.message), "bad"); }
    });
    /* URL defang / refang */
    advPanel("urlResult", "defang", "🧯 Advanced: defang a link so it is safe to share in tickets and chats", `<div class="tp-adv-row"><button type="button" class="tp-act" id="defangBtn">Defang the link above</button><button type="button" class="tp-act" id="refangBtn">Refang (restore)</button></div><div id="defangOut"></div><small class="tp-hint">Defanging (hxxp, [.]) stops chat apps and email from turning a dangerous link into a clickable one. Analysts use it in every report.</small>`);
    const dfOut = f => { const v = val("urlInput"); if (!v) return mini("defangOut", "Type or paste a link in the box above first.", "warn"); const r = f(v); mini("defangOut", `<textarea class="tp-out-area" rows="2" readonly>${esc(r)}</textarea>`, "ok"); };
    $("defangBtn")?.addEventListener("click", () => dfOut(defang)); $("refangBtn")?.addEventListener("click", () => dfOut(refang));
}
function initV7() { hookReportExport(); initSmartPaste(); initPinsAndExamples(); initAdvanced(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(initV7, 500)); else setTimeout(initV7, 500);

window.CG_TOOLS_PRO = { version: "6.0", analyzePassword, analyzeUrl };
})();