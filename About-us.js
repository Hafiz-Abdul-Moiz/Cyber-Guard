/* ============================================================
   CYBERGUARD // ABOUT-US & UNIFIED PORTAL HUB SCRIPT
   Counters, Incident Dispatch & Shared Sound Sync
   ============================================================ */

const CYBER_AUDIO_STATE_KEY = "cyberguard_audio_state";
const CYBER_AUDIO_POSITION_KEY = "cyberguard_audio_position";

function ensureSharedAudio() {
    if (window.parent !== window) return null;

    let audio = document.getElementById('bgAudio');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'bgAudio';
        audio.loop = true;
        audio.preload = 'auto';
        const source = document.createElement('source');
        source.src = 'Sound.mp3';
        source.type = 'audio/mpeg';
        audio.appendChild(source);
        document.body.appendChild(audio);
    }
    return audio;
}

function saveSharedAudioPosition(audio) {
    if (audio && Number.isFinite(audio.currentTime)) {
        localStorage.setItem(CYBER_AUDIO_POSITION_KEY, String(audio.currentTime));
    }
}

function restoreSharedAudioPosition(audio) {
    const savedPosition = Number(localStorage.getItem(CYBER_AUDIO_POSITION_KEY));
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
        audio.currentTime = savedPosition;
    }
}

function syncSharedAudioFromStorage() {
    const audio = ensureSharedAudio();
    if (!audio) return;
    const isPlaying = localStorage.getItem(CYBER_AUDIO_STATE_KEY) === 'playing';

    if (isPlaying && audio.paused) {
        audio.play().catch((error) => {
            console.warn('Background audio could not resume:', error);
        });
    } else if (!isPlaying && !audio.paused) {
        audio.pause();
    }
}

window.addEventListener('storage', (event) => {
    if (event.key === CYBER_AUDIO_STATE_KEY) {
        syncSharedAudioFromStorage();
    }
});

window.addEventListener('pagehide', () => {
    saveSharedAudioPosition(document.getElementById('bgAudio'));
});

window.addEventListener('DOMContentLoaded', () => {
    const audio = ensureSharedAudio();
    if (audio) {
        audio.loop = true;
        audio.addEventListener('timeupdate', () => saveSharedAudioPosition(audio));
        audio.addEventListener('loadedmetadata', () => {
            restoreSharedAudioPosition(audio);
            syncSharedAudioFromStorage();
        }, { once: true });

        if (audio.readyState >= 1) {
            restoreSharedAudioPosition(audio);
            syncSharedAudioFromStorage();
        }
    }

    if (window.parent !== window) {
        const backButton = document.querySelector('[data-key="btnBackMain"]');
        if (backButton) {
            backButton.addEventListener('click', (event) => {
                event.preventDefault();
                window.parent.postMessage('cyberguard:close-about', '*');
            });
        }
    }
});

function initAll() {
    initVvipCounters();
    initWhatsAppIntegration();
    initIncidentDispatch();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
} else {
    initAll();
}

// 1. ANIMATED COUNTER ENGINE (WITH VISIBILITY FALLBACK)
function initVvipCounters() {
    const counters = document.querySelectorAll(".counter");
    if (!counters.length) return;

    function runCounter(counter) {
        if (counter.dataset.animated === "true") return;
        counter.dataset.animated = "true";
        const target = +counter.getAttribute("data-target") || 0;
        let count = 0;
        const duration = 1200;
        const steps = 30;
        const stepValue = Math.max(1, Math.ceil(target / steps));

        const interval = setInterval(() => {
            count += stepValue;
            if (count >= target) {
                counter.innerText = target;
                clearInterval(interval);
            } else {
                counter.innerText = Math.floor(count);
            }
        }, duration / steps);
    }

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    runCounter(entry.target);
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        counters.forEach(c => observer.observe(c));
    }

    // Fallback: Agar element screen par pehle se maujood hai
    setTimeout(() => {
        counters.forEach(c => {
            const rect = c.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom >= 0) {
                runCounter(c);
            }
        });
    }, 250);
}

// 2. WHATSAPP INTELLIGENT DISPATCH & DIRECT LINK
function initWhatsAppIntegration() {
    const waNumber = "923262116352";
    const openWaBtn = document.getElementById("openWaBtn");
    const copyWaBtn = document.getElementById("copyWaBtn");
    const waIncidentSelect = document.getElementById("waIncidentSelect");

    if (openWaBtn) {
        openWaBtn.addEventListener("click", () => {
            const selectedCategory = waIncidentSelect ? waIncidentSelect.value : "general";
            let messageText = "Hello CyberGuard Support Desk, I require immediate assistance.";

            if (selectedCategory === "wallet") {
                messageText = "*URGENT SCAM REPORT:* My Mobile Wallet (EasyPaisa/JazzCash) has received a suspicious transfer or fake SMS refund request. Please assist me immediately.";
            } else if (selectedCategory === "phishing") {
                messageText = "*PHISHING DOMAIN CHECK:* I encountered a suspicious login link requesting credentials or OTPs. Please analyze its safety.";
            } else if (selectedCategory === "apk") {
                messageText = "*MALICIOUS APK ALERT:* I was asked to install an Android APK file via WhatsApp. Please analyze this application.";
            }

            const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
            window.open(waUrl, "_blank");
        });
    }

    if (copyWaBtn) {
        copyWaBtn.addEventListener("click", () => {
            navigator.clipboard.writeText("03262116352").then(() => {
                copyWaBtn.innerText = "✓ Number Copied to Clipboard!";
                setTimeout(() => {
                    copyWaBtn.innerText = "📋 Copy Verified Number";
                }, 2500);
            });
        });
    }
}

// 3. ENCRYPTED INCIDENT REPORT DISPATCH SIMULATOR
function initIncidentDispatch() {
    const form = document.getElementById("incidentDispatchForm");
    const notice = document.getElementById("dispatchSuccessNotice");
    const ticketIdText = document.getElementById("ticketIdText");
    const forwardTicketBtn = document.getElementById("forwardTicketBtn");
    const submitBtn = document.getElementById("btnDispatchIncident");

    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("incName")?.value || "Anonymous";
        const phone = document.getElementById("incPhone")?.value || "Not specified";
        const severity = document.getElementById("incSeverity")?.value || "critical";
        const details = document.getElementById("incDetails")?.value || "No details provided";

        if (submitBtn) {
            submitBtn.innerText = "⏳ Encrypting (AES-256) & Generating Ticket...";
            submitBtn.disabled = true;
        }

        setTimeout(() => {
            const ticketId = "CG-INC-" + Math.floor(1000 + Math.random() * 9000);
            if (ticketIdText) ticketIdText.innerText = `Ticket ID: ${ticketId}`;

            const dossier = `*INCIDENT DOSSIER [#${ticketId}]*\n*Name:* ${name}\n*Contact:* ${phone}\n*Severity:* ${severity.toUpperCase()}\n*Details:* ${details}\n*Status:* DISPATCHED TO SOC`;
            if (forwardTicketBtn) {
                forwardTicketBtn.href = `https://wa.me/923262116352?text=${encodeURIComponent(dossier)}`;
            }

            if (notice) notice.style.display = "flex";
            if (submitBtn) {
                submitBtn.innerText = "✓ Dossier Generated Successfully";
                submitBtn.disabled = false;
            }
        }, 1500);
    });
}