/* ============================================================================
   CYBERGUARD // LIVE CYBER THREAT MAP  v6  -  GLOBAL THREAT COMMAND CENTER
   REAL LIVE FEEDS (public, no key):
     NVD (new CVEs 24h) · CISA KEV (actively exploited) · FIRST EPSS (exploit probability)
     GitHub Security Advisories · ransomware.live (victims) · CyberGuard Scam Radar (cache)
   SIMULATED (clearly labelled "SIM"): attack arcs + telemetry stream + regional node status,
   built for awareness training. They use documentation IP ranges, never real victims.
   ============================================================================ */
(function () {
"use strict";
const root = document.getElementById("Live-Cyber-Threat-Map");
if (!root) return;
const $ = (s, r = root) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = n => Number(n).toLocaleString("en-US");
const tier = () => document.documentElement.dataset.perf || "medium";
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (_) { return ""; } };
const ago = ts => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago"; };
const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌎";

/* ---------- geography ---------- */
const W = 1000, H = 500;
const proj = (lat, lon) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
const CENT = { PK: [30, 70, "Pakistan"], IN: [22, 79, "India"], US: [39, -98, "United States"], GB: [54, -2, "United Kingdom"], AU: [-25, 134, "Australia"], CA: [57, -100, "Canada"], NG: [9, 8, "Nigeria"], SG: [1.3, 103.8, "Singapore"], AE: [24, 54, "UAE"], PH: [13, 122, "Philippines"], MY: [4, 102, "Malaysia"], ID: [-2, 118, "Indonesia"], KE: [0, 38, "Kenya"], ZA: [-29, 24, "South Africa"], GH: [8, -1, "Ghana"], DE: [51, 10, "Germany"], FR: [46, 2, "France"], HK: [22.3, 114.2, "Hong Kong"], CN: [35, 103, "China"], JP: [36, 138, "Japan"], KR: [36, 128, "South Korea"], BR: [-10, -52, "Brazil"], MX: [23, -102, "Mexico"], TR: [39, 35, "Turkey"], SA: [24, 45, "Saudi Arabia"], BD: [24, 90, "Bangladesh"], LK: [7.8, 80.7, "Sri Lanka"], NP: [28, 84, "Nepal"], NZ: [-41, 174, "New Zealand"], IE: [53, -8, "Ireland"], IT: [42, 12, "Italy"], ES: [40, -4, "Spain"], NL: [52, 5, "Netherlands"], TH: [15, 101, "Thailand"], VN: [16, 108, "Vietnam"], RU: [60, 100, "Russia"], UA: [49, 32, "Ukraine"], PL: [52, 20, "Poland"], IL: [31, 35, "Israel"], TW: [23.7, 121, "Taiwan"], AR: [-34, -64, "Argentina"], CO: [4, -72, "Colombia"], EG: [27, 30, "Egypt"], QA: [25, 51, "Qatar"], KW: [29, 48, "Kuwait"], IR: [32, 53, "Iran"], AF: [33, 65, "Afghanistan"], SE: [62, 15, "Sweden"], NO: [61, 9, "Norway"], DK: [56, 10, "Denmark"], CH: [47, 8, "Switzerland"], BE: [50.5, 4.5, "Belgium"], AT: [47.5, 14.5, "Austria"], PT: [39.5, -8, "Portugal"], GR: [39, 22, "Greece"], CL: [-35, -71, "Chile"], PE: [-9, -75, "Peru"], OM: [21, 57, "Oman"], BH: [26, 50.5, "Bahrain"], JO: [31, 36, "Jordan"], IQ: [33, 44, "Iraq"], MA: [32, -6, "Morocco"], DZ: [28, 3, "Algeria"], KZ: [48, 68, "Kazakhstan"], RO: [46, 25, "Romania"], CZ: [49.8, 15.5, "Czechia"], FI: [64, 26, "Finland"], HU: [47, 20, "Hungary"] };
const REGIONS = { global: ["Global", -170, 170, -58, 82], "south-asia": ["South Asia", 55, 100, 3, 40], "middle-east": ["Middle East", 25, 66, 10, 42], europe: ["Europe", -14, 45, 33, 72], "north-america": ["North America", -170, -50, 10, 75], "east-asia": ["East & SE Asia", 95, 150, -10, 55], africa: ["Africa", -20, 55, -37, 38], "latin-america": ["Latin America", -120, -30, -57, 33] };
const FALLBACK_LAND = [
    [[-168, 66], [-141, 70], [-125, 70], [-95, 73], [-80, 72], [-62, 67], [-56, 52], [-66, 45], [-71, 41], [-76, 35], [-81, 30], [-80, 25], [-83, 29], [-90, 30], [-97, 27], [-97, 20], [-91, 19], [-87, 21], [-88, 16], [-84, 15], [-83, 9], [-79, 8], [-86, 11], [-92, 15], [-105, 20], [-110, 24], [-113, 31], [-117, 32], [-123, 38], [-124, 46], [-130, 54], [-141, 60], [-152, 58], [-165, 55]],
    [[-80, 9], [-72, 12], [-62, 10], [-52, 5], [-50, -1], [-35, -6], [-39, -14], [-48, -26], [-58, -35], [-65, -41], [-68, -52], [-72, -52], [-74, -42], [-71, -30], [-70, -18], [-76, -14], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 44], [-4, 48], [2, 51], [8, 55], [10, 58], [5, 62], [14, 68], [25, 71], [32, 70], [40, 67], [40, 56], [38, 47], [30, 45], [28, 41], [22, 37], [12, 38], [6, 43], [-5, 36]],
    [[-17, 21], [-10, 30], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [44, -2], [40, -15], [35, -25], [27, -34], [19, -35], [13, -22], [12, -6], [9, 4], [-8, 5], [-17, 14]],
    [[28, 41], [36, 37], [36, 32], [35, 28], [43, 13], [52, 16], [57, 23], [62, 25], [67, 24], [72, 21], [77, 8], [80, 13], [88, 22], [92, 20], [98, 10], [103, 1], [109, 12], [106, 20], [122, 29], [121, 37], [127, 39], [130, 35], [140, 42], [141, 52], [160, 60], [180, 66], [180, 70], [130, 73], [100, 78], [70, 73], [60, 68], [40, 67], [40, 56], [38, 47], [30, 45]],
    [[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [141, -38], [135, -34], [129, -32], [115, -34]],
    [[-55, 60], [-44, 60], [-20, 70], [-20, 82], [-60, 82], [-70, 76]], [[-5, 50], [1, 51], [2, 56], [-2, 58], [-6, 56]], [[130, 32], [135, 34], [141, 38], [142, 45], [140, 41], [132, 35]]
];
const polyPath = pts => "M" + pts.map(([lo, la]) => proj(la, lo).map(v => v.toFixed(1)).join(",")).join("L") + "Z";
function decodeTopo(topo, objName) {
    const sc = topo.transform ? topo.transform.scale : [1, 1], tr = topo.transform ? topo.transform.translate : [0, 0];
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sc[0] + tr[0], y * sc[1] + tr[1]]; }); });
    const ring = idxs => { const out = []; idxs.forEach(i => { let a = i < 0 ? [...arcs[~i]].reverse() : arcs[i]; if (out.length) a = a.slice(1); out.push(...a); }); return out; };
    const o = topo.objects[objName], geoms = o.geometries || [o], paths = [];
    geoms.forEach(g => { const polys = g.type === "MultiPolygon" ? g.arcs : g.type === "Polygon" ? [g.arcs] : []; polys.forEach(p => p.forEach(r => paths.push(polyPath(ring(r))))); });
    return paths.join("");
}

/* ---------- state ---------- */
const S = { region: "global", type: "all", q: "", paused: false, tab: "sim", layers: { arcs: true, ransom: true, scam: true, nodes: true }, events: [], vec: { Phishing: 0, DDoS: 0, Malware: 0, Recon: 0, Exploit: 0, Fraud: 0 }, perMin: [], sel: null, feeds: {}, data: { nvd: null, kev: null, epss: null, gh: null, rw: null, scam: null } };

/* ---------- build UI ---------- */
function build() {
    root.innerHTML = `
    <div class="tm6" id="tm6">
        <header class="tm6-head">
            <div class="tm6-title">
                <span class="tm6-badge"><i></i> SOC THREAT INTELLIGENCE ACTIVE</span>
                <h2>◈ Live Cyber Threat Map</h2>
                <p>Global command centre combining <b>real live public feeds</b> (new vulnerabilities, actively exploited bugs, ransomware victims, scam alerts) with a clearly-labelled <b>simulation layer</b> for awareness training.</p>
            </div>
            <div class="tm6-sync"><div class="tm6-clock"><small>UTC</small><b id="tm6Clock">--:--:--</b></div><div class="tm6-feeds" id="tm6Feeds"></div></div>
        </header>
        <div class="tm6-bar">
            <label>REGION<select id="tm6Region">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></label>
            <label>THREAT TYPE<select id="tm6Type"><option value="all">All threats</option><option>Phishing</option><option>DDoS</option><option>Malware</option><option>Recon</option><option>Exploit</option><option>Fraud</option></select></label>
            <label class="tm6-search">SEARCH<input id="tm6Search" type="search" placeholder="CVE, country, group, keyword…"></label>
            <div class="tm6-btns"><button type="button" id="tm6Pause">⏸ Pause</button><button type="button" id="tm6Refresh">⟳ Refresh feeds</button><button type="button" id="tm6Full">⛶ Fullscreen</button></div>
        </div>
        <section class="tm6-kpis" id="tm6Kpis"></section>
        <div class="tm6-main">
            <div class="tm6-mapcard">
                <div class="tm6-maphead"><div><small>GLOBAL SENSOR MAP</small><h3>World threat picture</h3></div><div class="tm6-layers" id="tm6Layers"></div></div>
                <div class="tm6-mapwrap" id="tm6MapWrap"><svg id="tm6Svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map with threat markers"></svg><div class="tm6-tip" id="tm6Tip" hidden></div></div>
                <div class="tm6-legend"><span><i class="lg-a"></i>Simulated attack</span><span><i class="lg-r"></i>Ransomware victims (real)</span><span><i class="lg-s"></i>Scam alerts (real)</span><span><i class="lg-n"></i>CyberGuard node</span></div>
                <div class="tm6-detail" id="tm6Detail"><small>Tip: click a glowing marker to see what is happening in that country.</small></div>
            </div>
            <aside class="tm6-feedcard">
                <div class="tm6-tabs" id="tm6Tabs" role="tablist"></div>
                <div class="tm6-list" id="tm6List" aria-live="polite"></div>
            </aside>
        </div>
        <div class="tm6-grid" id="tm6Grid"></div>
        <footer class="tm6-foot"><b>How to read this page:</b> <span class="tag-live">LIVE</span> panels use public feeds and show real data (timestamps are real). <span class="tag-sim">SIM</span> panels (attack arcs, telemetry stream, node status) are generated for training and use documentation IP ranges. Nothing here is a verified real-time attack feed. <button type="button" id="tm6Clear">Clear simulated feed</button></footer>
    </div>`;
    const svg = $("#tm6Svg");
    svg.innerHTML = `<defs><pattern id="tm6dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.6" cy="1.6" r="1.1" fill="#0fd3a8" opacity=".55"/></pattern><radialGradient id="tm6glow"><stop offset="0" stop-color="#00f0ff" stop-opacity=".35"/><stop offset="1" stop-color="#00f0ff" stop-opacity="0"/></radialGradient></defs>
        <rect width="1000" height="500" fill="#040b13"/><g class="tm6-grat">${[-60, -30, 0, 30, 60].map(la => `<line x1="0" x2="1000" y1="${proj(la, 0)[1]}" y2="${proj(la, 0)[1]}"/>`).join("")}${[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map(lo => `<line y1="0" y2="500" x1="${proj(0, lo)[0]}" x2="${proj(0, lo)[0]}"/>`).join("")}</g>
        <path id="tm6Land" class="tm6-land" d="${FALLBACK_LAND.map(polyPath).join("")}"/><g id="tm6Nodes"></g><g id="tm6Arcs"></g><g id="tm6Mk"></g>`;
    $("#tm6Layers").innerHTML = [["arcs", "⚡ Attacks"], ["ransom", "☠ Ransomware"], ["scam", "🎣 Scams"], ["nodes", "🛡 Nodes"]].map(([k, n]) => `<button type="button" data-l="${k}" class="on">${n}</button>`).join("");
    $("#tm6Tabs").innerHTML = [["sim", "📡 Telemetry", "SIM"], ["nvd", "🐞 New CVEs", "LIVE"], ["kev", "🔥 Exploited", "LIVE"], ["rw", "☠ Ransomware", "LIVE"], ["gh", "📦 Advisories", "LIVE"], ["scam", "🎣 Scams", "LIVE"]].map(([k, n, t]) => `<button type="button" role="tab" data-t="${k}" class="${k === S.tab ? "on" : ""}">${n}<em class="${t === "LIVE" ? "tag-live" : "tag-sim"}">${t}</em></button>`).join("");
    bind(); drawNodes(); setFeeds();
}
function bind() {
    $("#tm6Region").addEventListener("change", e => { S.region = e.target.value; zoom(); });
    $("#tm6Type").addEventListener("change", e => { S.type = e.target.value; renderList(); });
    $("#tm6Search").addEventListener("input", e => { S.q = e.target.value.trim().toLowerCase(); renderList(); drawMarkers(); });
    $("#tm6Pause").addEventListener("click", e => { S.paused = !S.paused; e.target.textContent = S.paused ? "▶ Resume" : "⏸ Pause"; });
    $("#tm6Refresh").addEventListener("click", () => loadAll(true));
    $("#tm6Full").addEventListener("click", () => { const el = $("#tm6"); (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen()); });
    $("#tm6Clear").addEventListener("click", () => { S.events = []; Object.keys(S.vec).forEach(k => S.vec[k] = 0); renderList(); renderGrid(); });
    $("#tm6Layers").addEventListener("click", e => { const b = e.target.closest("button[data-l]"); if (!b) return; S.layers[b.dataset.l] = !S.layers[b.dataset.l]; b.classList.toggle("on", S.layers[b.dataset.l]); $("#tm6Svg").dataset["hide" + b.dataset.l] = S.layers[b.dataset.l] ? "" : "1"; });
    $("#tm6Tabs").addEventListener("click", e => { const b = e.target.closest("button[data-t]"); if (!b) return; S.tab = b.dataset.t; [...$("#tm6Tabs").children].forEach(x => x.classList.toggle("on", x === b)); renderList(); });
    $("#tm6Svg").addEventListener("click", e => { const m = e.target.closest("[data-cc]"); if (m) showCountry(m.dataset.cc); });
    $("#tm6List").addEventListener("click", e => { const c = e.target.closest("[data-cc]"); if (c && !e.target.closest("a")) showCountry(c.dataset.cc); });
}
/* ---------- map ---------- */
let vb = [0, 10, 1000, 410], vbAnim = 0;
function zoom() {
    const r = REGIONS[S.region], top = proj(r[4], r[1]), bot = proj(r[3], r[2]);
    let x = top[0], y = top[1], w = bot[0] - top[0], h = bot[1] - top[1];
    const ar = 2.0; if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
    const to = [x, y, w, h], from = vb.slice(), t0 = performance.now(), dur = tier() === "low" ? 1 : 700; cancelAnimationFrame(vbAnim);
    (function step(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); vb = from.map((v, i) => v + (to[i] - v) * e); const sv = $("#tm6Svg"); if (sv) sv.setAttribute("viewBox", vb.map(v => v.toFixed(1)).join(" ")); if (p < 1) vbAnim = requestAnimationFrame(step); })(t0);
}
function drawNodes() {
    const nodes = ["PK", "IN", "AE", "SA", "SG", "GB", "US", "DE", "AU", "ZA", "BR", "JP"];
    $("#tm6Nodes").innerHTML = nodes.map(c => { const [la, lo] = CENT[c], [x, y] = proj(la, lo); return `<g class="tm6-node" transform="translate(${x},${y})"><rect x="-3" y="-3" width="6" height="6" rx="1.5"/><circle r="9" class="tm6-nring"/></g>`; }).join("");
}
function markerData() {
    const m = {};
    const get = c => (m[c] = m[c] || { cc: c, ransom: 0, scam: 0, items: [] });
    (S.data.rw || []).forEach(v => { if (v.cc && CENT[v.cc]) { const o = get(v.cc); o.ransom++; o.items.push({ k: "ransom", t: `${v.group || "?"}: ${v.victim}`, ts: v.ts, url: v.url }); } });
    (S.data.scam || []).forEach(v => { if (v.cc && CENT[v.cc]) { const o = get(v.cc); o.scam++; o.items.push({ k: "scam", t: v.title, ts: v.ts, url: v.url }); } });
    return m;
}
function drawMarkers() {
    const g = $("#tm6Mk"); if (!g) return; const m = markerData(); let h = "";
    Object.values(m).forEach(o => {
        if (S.q && !(CENT[o.cc][2] + " " + o.items.map(i => i.t).join(" ")).toLowerCase().includes(S.q)) return;
        const [la, lo] = CENT[o.cc], [x, y] = proj(la, lo);
        if (o.ransom) h += `<g class="tm6-mk tm6-r" data-cc="${o.cc}" transform="translate(${x},${y})"><circle class="pl" r="${6 + Math.min(14, o.ransom * 2)}"/><circle r="${3 + Math.min(5, o.ransom)}"/></g>`;
        if (o.scam) h += `<g class="tm6-mk tm6-s" data-cc="${o.cc}" transform="translate(${x + 5},${y + 5})"><circle class="pl" r="${5 + Math.min(10, o.scam * 2)}"/><circle r="${2.5 + Math.min(4, o.scam)}"/></g>`;
    });
    g.innerHTML = h;
}
function showCountry(cc) {
    const m = markerData()[cc], [, , name] = CENT[cc] || [0, 0, cc]; S.sel = cc;
    const d = $("#tm6Detail"); if (!m) { d.innerHTML = `<small>No live items for ${esc(name)} right now.</small>`; return; }
    d.innerHTML = `<div class="tm6-dh"><b>${flag(cc)} ${esc(name)}</b><span><em class="r">☠ ${m.ransom} ransomware</em><em class="s">🎣 ${m.scam} scam alerts</em></span></div><ul>${m.items.sort((a, b) => b.ts - a.ts).slice(0, 5).map(i => `<li><i class="${i.k === "ransom" ? "r" : "s"}"></i>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.t)}</a>` : esc(i.t)}<small>${ago(i.ts)}</small></li>`).join("")}</ul>`;
}

/* ---------- simulated telemetry ---------- */
const VECT = [
    ["Phishing", "Phishing Campaign Detected", ["Mobile Wallet Gateway", "Payment Infrastructure", "Email Gateway"], "high", 443],
    ["Phishing", "Credential Harvesting Page Blocked", ["Authentication Gateway", "Customer Portal"], "high", 443],
    ["DDoS", "Traffic Flood Anomaly Mitigated", ["CDN Edge", "Public API", "DNS Cluster"], "medium", 80],
    ["Malware", "Malware Payload Signature Found", ["Endpoint Fleet", "File Server"], "critical", 445],
    ["Malware", "Ransomware Beacon Blocked", ["Enterprise Network", "Backup Server"], "critical", 3389],
    ["Recon", "Port Scan Sweep Detected", ["Perimeter Firewall", "Edge Router"], "low", 22],
    ["Recon", "SSH Brute-force Attempt", ["Remote Access Gateway"], "medium", 22],
    ["Exploit", "Exploit Attempt on Known CVE", ["Web Application", "VPN Appliance"], "high", 8443],
    ["Exploit", "SQL Injection Attempt Blocked", ["Web Application Firewall"], "medium", 443],
    ["Fraud", "Mobile Wallet Fraud Pattern", ["Payment Switch", "Wallet API"], "high", 443],
    ["Fraud", "OTP Interception Pattern", ["SMS Gateway"], "high", 25]
];
const SRC = ["RU", "CN", "BR", "NG", "VN", "US", "IN", "PK", "TR", "ID", "IR", "UA", "KP"].filter(c => CENT[c] || true);
function genEvent() {
    const reg = REGIONS[S.region], inReg = c => { const p = CENT[c]; return p && p[1] >= reg[1] && p[1] <= reg[2] && p[0] >= reg[3] && p[0] <= reg[4]; };
    const dsts = Object.keys(CENT).filter(inReg), dst = pick(dsts.length ? dsts : ["PK", "IN", "AE", "SG", "GB", "US"]);
    let src = pick(Object.keys(CENT)); if (src === dst) src = pick(["US", "CN", "RU", "BR"]);
    const v = S.type === "all" ? pick(VECT) : pick(VECT.filter(x => x[0] === S.type)), sev = v[3];
    const ip = pick(["203.0.113.", "198.51.100.", "192.0.2."]) + Math.floor(rnd(2, 250));
    return { id: Math.random().toString(36).slice(2, 8), ts: Date.now(), vec: v[0], title: v[1], target: pick(v[2]), sev, port: v[4], src, dst, ip };
}
function fireArc(ev) {
    if (!S.layers.arcs) return; const t = tier(); if (t === "low") return;
    const g = $("#tm6Arcs"); if (!g || g.childElementCount > (t === "high" ? 16 : 7)) return;
    const a = CENT[ev.src], b = CENT[ev.dst]; if (!a || !b) return;
    const [x1, y1] = proj(a[0], a[1]), [x2, y2] = proj(b[0], b[1]), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.min(90, Math.hypot(x2 - x1, y2 - y1) * 0.35);
    const col = ev.sev === "critical" ? "#ff3366" : ev.sev === "high" ? "#ff8a3d" : ev.sev === "medium" ? "#ffbb00" : "#00f0ff";
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g"); el.setAttribute("class", "tm6-arc");
    el.innerHTML = `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" stroke="${col}" pathLength="1"/><circle cx="${x2}" cy="${y2}" r="3" fill="${col}"/><circle class="tm6-hit" cx="${x2}" cy="${y2}" r="3" stroke="${col}"/>`;
    g.appendChild(el); setTimeout(() => el.remove(), 2600);
}
function pushEvent() {
    if (S.paused || document.hidden) return; const ev = genEvent(); S.events.unshift(ev); if (S.events.length > 60) S.events.pop();
    S.vec[ev.vec] = (S.vec[ev.vec] || 0) + 1; S.perMin.push(Date.now()); S.perMin = S.perMin.filter(t => Date.now() - t < 60000);
    fireArc(ev); if (S.tab === "sim") renderList(); renderKpiSim(); if (Math.random() < 0.3) renderGrid(true);
}

/* ---------- real feeds ---------- */
const PROXIES = [u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), u => "https://corsproxy.io/?" + encodeURIComponent(u)];
async function fetchT(url, ms = 15000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); } finally { clearTimeout(t); } }
async function getData(url, { proxy = false } = {}) {
    try { return JSON.parse(await fetchT(url)); } catch (e) { if (!proxy) throw e; }
    for (const mk of PROXIES) { try { return JSON.parse(await fetchT(mk(url))); } catch (_) { } }
    throw new Error("unreachable");
}
const cacheGet = k => { try { const c = JSON.parse(localStorage.getItem("cg_tm6_" + k) || "null"); return c; } catch (_) { return null; } };
const cacheSet = (k, d) => { try { localStorage.setItem("cg_tm6_" + k, JSON.stringify({ t: Date.now(), d })); } catch (_) { } };
const bad = {}; // session memory: feed -> ts of last failure
async function feed(name, loader, normalize) {
    S.feeds[name] = S.feeds[name] || {}; S.feeds[name].state = "loading"; setFeeds();
    try {
        if (bad[name] && Date.now() - bad[name] < 15 * 60000) throw new Error("skip");
        const raw = await loader(); const d = normalize(raw); S.data[name] = d; cacheSet(name, d); S.feeds[name] = { state: "live", t: Date.now() }; delete bad[name];
    } catch (e) {
        bad[name] = Date.now(); const c = cacheGet(name);
        if (c && c.d) { S.data[name] = c.d; S.feeds[name] = { state: "cached", t: c.t }; } else S.feeds[name] = { state: "off" };
    }
    setFeeds(); renderKpiReal(); renderList(); renderGrid(); drawMarkers();
}
const isoNvd = d => d.toISOString().replace("Z", "");
function loaders() {
    const now = new Date(), start = new Date(now.getTime() - 24 * 3600e3);
    return {
        nvd: () => feed("nvd", () => getData(`https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(isoNvd(start))}&pubEndDate=${encodeURIComponent(isoNvd(now))}&resultsPerPage=60`, { proxy: true }), r => ({
            total: r.totalResults || (r.vulnerabilities || []).length,
            items: (r.vulnerabilities || []).map(v => { const c = v.cve, m = (c.metrics || {}), mm = (m.cvssMetricV40 || m.cvssMetricV31 || m.cvssMetricV30 || m.cvssMetricV2 || [])[0], cd = mm ? mm.cvssData : null; return { id: c.id, ts: Date.parse(c.published), score: cd ? cd.baseScore : null, sev: cd ? (cd.baseSeverity || (cd.baseScore >= 9 ? "CRITICAL" : cd.baseScore >= 7 ? "HIGH" : cd.baseScore >= 4 ? "MEDIUM" : "LOW")) : "UNRATED", desc: ((c.descriptions || []).find(d => d.lang === "en") || {}).value || "", url: "https://nvd.nist.gov/vuln/detail/" + c.id }; }).sort((a, b) => b.ts - a.ts)
        })),
        kev: () => feed("kev", () => getData("https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json", { proxy: true }), r => ({ count: r.count || (r.vulnerabilities || []).length, version: r.catalogVersion, items: (r.vulnerabilities || []).map(v => ({ id: v.cveID, vendor: v.vendorProject, product: v.product, name: v.vulnerabilityName, ts: Date.parse(v.dateAdded), due: v.dueDate, ransom: /known/i.test(v.knownRansomwareCampaignUse || ""), desc: v.shortDescription, url: "https://nvd.nist.gov/vuln/detail/" + v.cveID })).sort((a, b) => b.ts - a.ts).slice(0, 400) })),
        epss: () => feed("epss", () => getData("https://api.first.org/data/v1/epss?order=!epss&limit=10", { proxy: true }), r => ({ items: (r.data || []).map(x => ({ id: x.cve, p: +x.epss, pct: +x.percentile, url: "https://nvd.nist.gov/vuln/detail/" + x.cve })) })),
        gh: () => feed("gh", () => getData("https://api.github.com/advisories?per_page=20&type=reviewed&sort=published&direction=desc"), r => (Array.isArray(r) ? r : []).map(a => ({ id: a.ghsa_id, cve: a.cve_id, ts: Date.parse(a.published_at), sev: String(a.severity || "").toUpperCase(), title: a.summary, pkg: ((a.vulnerabilities || [])[0] || {}).package ? a.vulnerabilities[0].package.ecosystem + "/" + a.vulnerabilities[0].package.name : "", url: a.html_url }))),
        rw: () => feed("rw", async () => { try { return await getData("https://api.ransomware.live/v2/recentvictims", { proxy: true }); } catch (_) { return await getData("https://api.ransomware.live/recentvictims", { proxy: true }); } }, r => (Array.isArray(r) ? r : (r.victims || [])).slice(0, 100).map(v => ({ victim: v.victim || v.post_title || v.name || "Undisclosed", group: v.group || v.group_name || "", cc: String(v.country || "").toUpperCase().slice(0, 2), sector: v.activity || v.sector || "", ts: Date.parse(v.discovered || v.published || v.attackdate || "") || Date.now(), url: safeUrl(v.url || v.claim_url || "") }))),
        scam: async () => { try { const c = JSON.parse(localStorage.getItem("cg_scam_live_v1") || "null"); if (c && c.items && c.items.length) { S.data.scam = c.items; S.feeds.scam = { state: Date.now() - c.t < 3600e3 ? "live" : "cached", t: c.t }; } else S.feeds.scam = { state: "off" }; } catch (_) { S.feeds.scam = { state: "off" }; } setFeeds(); renderKpiReal(); renderList(); drawMarkers(); }
    };
}
async function loadAll(force) { if (force) Object.keys(bad).forEach(k => delete bad[k]); const L = loaders(); await Promise.all([L.nvd(), L.kev(), L.epss(), L.gh(), L.rw(), L.scam()]); }
const FEED_NAMES = { nvd: "NVD", kev: "CISA KEV", epss: "EPSS", gh: "GitHub", rw: "Ransomware", scam: "Scam radar" };
function setFeeds() { const b = $("#tm6Feeds"); if (!b) return; b.innerHTML = Object.entries(FEED_NAMES).map(([k, n]) => { const f = S.feeds[k] || { state: "loading" }; return `<span class="fd fd-${f.state}" title="${n}: ${f.state}${f.t ? " · " + new Date(f.t).toLocaleTimeString() : ""}"><i></i>${n}</span>`; }).join(""); }

/* ---------- panels ---------- */
function sevBadge(s) { const k = /CRIT/i.test(s) ? "c" : /HIGH/i.test(s) ? "h" : /MED|MOD/i.test(s) ? "m" : /LOW/i.test(s) ? "l" : "u"; return `<b class="sv sv-${k}">${esc(String(s).slice(0, 4).toUpperCase())}</b>`; }
const match = txt => !S.q || txt.toLowerCase().includes(S.q);
function renderKpiReal() { renderKpis(); }
function renderKpiSim() { const a = $("#kpiAtk"), b = $("#kpiMit"); if (a) a.textContent = num(S.perMin.length * (tier() === "low" ? 1 : 4) + 120); if (b) b.textContent = (99.2 + Math.random() * 0.6).toFixed(1) + "%"; }
function renderKpis() {
    const k = S.data.kev, d = S.data.nvd, rw = S.data.rw, sc = S.data.scam;
    const kev30 = k ? k.items.filter(x => Date.now() - x.ts < 30 * 864e5).length : null, kevRw = k ? k.items.filter(x => x.ransom && Date.now() - x.ts < 90 * 864e5).length : null;
    const rw24 = rw ? rw.filter(x => Date.now() - x.ts < 24 * 3600e3).length : null;
    const tile = (ic, label, val, sub, kind, id) => `<div class="tm6-kpi tm6-k-${kind}"><span class="ic">${ic}</span><small>${label}<em class="${kind === "sim" ? "tag-sim" : "tag-live"}">${kind === "sim" ? "SIM" : "LIVE"}</em></small><b ${id ? `id="${id}"` : ""}>${val}</b><u>${sub}</u></div>`;
    $("#tm6Kpis").innerHTML = tile("🐞", "New CVEs · 24 h", d ? num(d.total) : "—", d ? `${d.items.filter(x => /CRIT/i.test(x.sev)).length} critical in latest ${d.items.length}` : "NVD loading…", "live") +
        tile("🔥", "Actively exploited · 30 d", kev30 != null ? num(kev30) : "—", k ? `${num(k.count)} in CISA catalogue · ${kevRw} used by ransomware` : "CISA KEV loading…", "live") +
        tile("☠", "Ransomware victims · 24 h", rw24 != null ? num(rw24) : "—", rw ? `${rw.length} latest posts tracked` : "feed unavailable or loading", "live") +
        tile("🎣", "Scam alerts · 24 h", sc ? num(sc.length) : "—", sc ? "from CyberGuard Scam Radar" : "open the main site to load", "live") +
        tile("⚡", "Simulated attacks / min", num(S.perMin.length * 4 + 120), "training telemetry", "sim", "kpiAtk") +
        tile("🛡", "Mitigation efficiency", "99.3%", "simulated defence engine", "sim", "kpiMit");
}
const stateOfFeed = k => (S.feeds[k] || {}).state;
function emptyMsg(k, t) { const s = stateOfFeed(k); return `<div class="tm6-empty">${s === "loading" || !s ? "⏳ Loading live data…" : s === "off" ? `📴 ${t} is not reachable right now (network, rate limit or blocked). Try Refresh.` : "No items match."}</div>`; }
function renderList() {
    const el = $("#tm6List"); if (!el) return; const t = S.tab; let h = "";
    if (t === "sim") {
        const list = S.events.filter(e => (S.type === "all" || e.vec === S.type) && match(`${e.title} ${e.target} ${CENT[e.src][2]} ${CENT[e.dst][2]} ${e.ip}`)).slice(0, 14);
        h = list.length ? list.map(e => `<div class="tm6-ev" data-cc="${e.dst}"><span class="sv sv-${e.sev[0]}">${e.sev.slice(0, 4).toUpperCase()}</span><div><b>${esc(e.title)}</b><small>${esc(e.target)} · ${flag(e.src)} ${esc(CENT[e.src][2])} → ${flag(e.dst)} ${esc(CENT[e.dst][2])} · :${e.port}</small><code>${e.ip} · SIM</code></div><time>${new Date(e.ts).toISOString().slice(11, 19)}</time></div>`).join("") : `<div class="tm6-empty">Waiting for simulated telemetry…</div>`;
    } else if (t === "nvd") { const d = S.data.nvd; h = d ? d.items.filter(x => match(x.id + x.desc)).slice(0, 14).map(x => `<a class="tm6-row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${sevBadge(x.sev)}<div><b>${esc(x.id)} ${x.score != null ? `<i class="sc">CVSS ${x.score}</i>` : ""}</b><small>${esc(x.desc.slice(0, 150))}${x.desc.length > 150 ? "…" : ""}</small></div><time>${ago(x.ts)}</time></a>`).join("") || emptyMsg("nvd", "NVD") : emptyMsg("nvd", "NVD"); }
    else if (t === "kev") { const d = S.data.kev; h = d ? d.items.filter(x => match(x.id + x.vendor + x.product + x.name)).slice(0, 14).map(x => `<a class="tm6-row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b class="sv sv-c">KEV</b><div><b>${esc(x.id)} · ${esc(x.vendor)} ${esc(x.product)}</b><small>${esc(x.name)}${x.ransom ? " · <em class='rwk'>used by ransomware</em>" : ""} · patch by ${esc(x.due || "—")}</small></div><time>${ago(x.ts)}</time></a>`).join("") || emptyMsg("kev", "CISA KEV") : emptyMsg("kev", "CISA KEV"); }
    else if (t === "rw") { const d = S.data.rw; h = d ? d.filter(x => match(x.victim + x.group + x.sector + (CENT[x.cc] || [0, 0, ""])[2])).slice(0, 14).map(x => `<div class="tm6-row" ${x.cc ? `data-cc="${x.cc}"` : ""}><b class="sv sv-c">RANS</b><div><b>${esc(x.victim)}</b><small>${esc(x.group || "unknown group")} · ${flag(x.cc)} ${esc((CENT[x.cc] || [0, 0, x.cc || "?"])[2])}${x.sector ? " · " + esc(x.sector) : ""}</small></div><time>${ago(x.ts)}</time></div>`).join("") || emptyMsg("rw", "ransomware.live") : emptyMsg("rw", "ransomware.live"); }
    else if (t === "gh") { const d = S.data.gh; h = d ? d.filter(x => match(x.id + x.title + x.pkg)).slice(0, 14).map(x => `<a class="tm6-row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${sevBadge(x.sev)}<div><b>${esc(x.title)}</b><small>${esc(x.pkg || "package")} · ${esc(x.cve || x.id)}</small></div><time>${ago(x.ts)}</time></a>`).join("") || emptyMsg("gh", "GitHub") : emptyMsg("gh", "GitHub Advisories"); }
    else if (t === "scam") { const d = S.data.scam; h = d ? d.filter(x => match(x.title + x.source)).slice(0, 14).map(x => `<a class="tm6-row" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b class="sv ${x.high ? "sv-h" : "sv-m"}">${x.high ? "HIGH" : "MED"}</b><div><b>${esc(x.title)}</b><small>${flag(x.cc)} ${esc((CENT[x.cc] || [0, 0, "Global"])[2])} · ${esc(x.label || "")} · ${esc(x.source || "")}</small></div><time>${ago(x.ts)}</time></a>`).join("") || emptyMsg("scam", "Scam radar") : `<div class="tm6-empty">Scam alerts appear after the main site's Live Scam Radar has loaded once in this browser.</div>`; }
    el.innerHTML = h;
}
function renderGrid() {
    const g = $("#tm6Grid"); if (!g) return;
    const vecMax = Math.max(1, ...Object.values(S.vec)), vecTot = Object.values(S.vec).reduce((a, b) => a + b, 0) || 1;
    const nvd = S.data.nvd, sev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }; if (nvd) nvd.items.forEach(x => { const k = String(x.sev).toUpperCase(); if (sev[k] !== undefined) sev[k]++; }); const sevMax = Math.max(1, ...Object.values(sev));
    const rw = S.data.rw || [], grp = {}; rw.forEach(x => { if (x.group) grp[x.group] = (grp[x.group] || 0) + 1; }); const topG = Object.entries(grp).sort((a, b) => b[1] - a[1]).slice(0, 6), gMax = Math.max(1, ...topG.map(x => x[1]));
    const kev = S.data.kev, ven = {}; if (kev) kev.items.filter(x => Date.now() - x.ts < 180 * 864e5).forEach(x => ven[x.vendor] = (ven[x.vendor] || 0) + 1); const topV = Object.entries(ven).sort((a, b) => b[1] - a[1]).slice(0, 6), vMax = Math.max(1, ...topV.map(x => x[1]));
    const ep = S.data.epss ? S.data.epss.items : [];
    const bars = (rows, max, cls) => rows.map(([n, v]) => `<div class="tm6-bar2"><span>${esc(n)}</span><i style="--w:${Math.round(v / max * 100)}%" class="${cls}"></i><em>${v}</em></div>`).join("");
    const nodeRows = [["PK", "Karachi / Lahore / Islamabad"], ["IN", "Mumbai / Delhi / Bengaluru"], ["AE", "Dubai / Abu Dhabi"], ["SG", "Singapore"], ["GB", "London"], ["US", "Virginia / California"]].map(([c, loc]) => `<div class="tm6-node-row" data-cc="${c}"><b>${flag(c)} ${esc(CENT[c][2])}</b><small>${esc(loc)}</small><span class="ok">ONLINE</span><em>${Math.round(rnd(11, 74))} ms</em></div>`).join("");
    g.innerHTML = `
        <div class="tm6-card"><small>SIMULATED</small><h4>Attack vector profile</h4>${bars(Object.entries(S.vec).sort((a, b) => b[1] - a[1]), vecMax, "v")}<p class="tm6-note">${vecTot} simulated events this session</p></div>
        <div class="tm6-card"><small class="live">LIVE · NVD</small><h4>Severity of newest CVEs</h4>${nvd ? bars(Object.entries(sev), sevMax, "sev") : emptyMsg("nvd", "NVD")}<p class="tm6-note">CVSS severity of the latest ${nvd ? nvd.items.length : 0} published vulnerabilities</p></div>
        <div class="tm6-card"><small class="live">LIVE · CISA KEV</small><h4>Most exploited vendors (6 months)</h4>${topV.length ? bars(topV, vMax, "ven") : emptyMsg("kev", "CISA KEV")}<p class="tm6-note">Vendors with the most "known exploited" bugs</p></div>
        <div class="tm6-card"><small class="live">LIVE · ransomware.live</small><h4>Most active ransomware groups</h4>${topG.length ? bars(topG, gMax, "grp") : emptyMsg("rw", "ransomware.live")}<p class="tm6-note">Based on the latest victim postings</p></div>
        <div class="tm6-card"><small class="live">LIVE · FIRST EPSS</small><h4>Most likely to be exploited next</h4>${ep.length ? ep.slice(0, 7).map(x => `<a class="tm6-ep" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(x.id)}</b><i style="--w:${Math.round(x.p * 100)}%"></i><em>${(x.p * 100).toFixed(1)}%</em></a>`).join("") : emptyMsg("epss", "FIRST EPSS")}<p class="tm6-note">EPSS = probability a CVE will be exploited in the next 30 days</p></div>
        <div class="tm6-card"><small>SIMULATED</small><h4>Regional monitoring nodes</h4>${nodeRows}</div>`;
    g.querySelectorAll(".tm6-node-row").forEach(n => n.onclick = () => showCountry(n.dataset.cc));
}

/* ---------- boot ---------- */
async function loadLand() {
    try { const t = await getData("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"); const d = decodeTopo(t, "land"); if (d && d.length > 200) $("#tm6Land").setAttribute("d", d); } catch (_) { }
}
function init() {
    build(); zoom(); renderKpis(); renderGrid(); renderList();
    for (let i = 0; i < 6; i++) { const e = genEvent(); e.ts -= i * 4000; S.events.push(e); S.vec[e.vec]++; }
    renderList();
    setInterval(() => { const c = $("#tm6Clock"); if (c) c.textContent = new Date().toISOString().slice(11, 19); }, 1000);
    const spawn = () => { pushEvent(); setTimeout(spawn, tier() === "low" ? 4500 : tier() === "medium" ? 2600 : 1500); }; spawn();
    loadLand();
    const start = () => { if (start.done) return; start.done = true; loadAll(false); setInterval(() => { if (!document.hidden) loadAll(false); }, 10 * 60000); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "300px" }); io.observe(root); } else start();
    setTimeout(start, 8000);
    window.addEventListener("storage", e => { if (e.key === "cg_scam_live_v1") loaders().scam(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
window.CG_THREAT_MAP = { state: S, decodeTopo };
})();