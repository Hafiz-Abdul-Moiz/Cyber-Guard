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
            body: JSON.stringify({ client: { clientId: "cyberguard", clientVersion: "5.0" }, threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }] } })
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
window.CG_TOOLS_PRO = { version: "5.0", analyzePassword, analyzeUrl };
})();