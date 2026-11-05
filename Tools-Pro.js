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
const PK_BANKS = { HABB: "Habib Bank Limited (HBL)", MUCB: "MCB Bank", UNIL: "United Bank Limited (UBL)", ALFH: "Bank Alfalah", MEZN: "Meezan Bank", ABPA: "Allied Bank", SCBL: "Standard Chartered Pakistan", BKIP: "BankIslami", FAYS: "Faysal Bank", SONE: "Soneri Bank", BAHL: "Bank AL Habib", NBPA: "National Bank of Pakistan", ASCM: "Askari Bank", SAMB: "Samba Bank", JSBL: "JS Bank", DUIB: "Dubai Islamic Bank Pakistan", KHYB: "Bank of Khyber", BPUN: "Bank of Punjab", SIND: "Sindh Bank", SUMB: "Summit Bank", AIBL: "Al Baraka Bank", FWBL: "First Women Bank", ZTBL: "Zarai Taraqiati Bank" };
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

window.CG_TOOLS_PRO = { version: "6.0", analyzePassword, analyzeUrl };
})();