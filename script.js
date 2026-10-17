/* ============================================================
   CYBERGUARD VVIP UI UPGRADE
   ============================================================ */

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        /* =====================================================
           1. LEFT SIDE CONTROL CENTER
           ===================================================== */

        const menuToggle = document.getElementById("menuToggle");
        const sidePanel = document.getElementById("sidePanel");
        const menuBackdrop = document.getElementById("menuBackdrop");
        const sideClose = document.getElementById("sideClose");

        function openSideMenu() {
            if (!menuToggle || !sidePanel || !menuBackdrop) return;

            menuToggle.classList.add("is-open");
            sidePanel.classList.add("is-open");
            menuBackdrop.classList.add("is-visible");

            menuToggle.setAttribute("aria-expanded", "true");
            sidePanel.setAttribute("aria-hidden", "false");

            document.body.classList.add("menu-lock");
        }

        function closeSideMenu() {
            if (!menuToggle || !sidePanel || !menuBackdrop) return;

            menuToggle.classList.remove("is-open");
            sidePanel.classList.remove("is-open");
            menuBackdrop.classList.remove("is-visible");

            menuToggle.setAttribute("aria-expanded", "false");
            sidePanel.setAttribute("aria-hidden", "true");

            document.body.classList.remove("menu-lock");
        }

        if (menuToggle) {
            menuToggle.addEventListener("click", function () {

                if (sidePanel.classList.contains("is-open")) {
                    closeSideMenu();
                } else {
                    openSideMenu();
                }

            });
        }

        if (sideClose) {
            sideClose.addEventListener("click", closeSideMenu);
        }

        if (menuBackdrop) {
            menuBackdrop.addEventListener("click", closeSideMenu);
        }

        const aboutPageOverlay = document.getElementById("aboutPageOverlay");
        const aboutPageFrame = document.getElementById("aboutPageFrame");

        document.querySelectorAll('.side-menu-item[target="cyberAboutFrame"]').forEach(function (link) {
            link.addEventListener("click", function () {
                if (aboutPageOverlay) {
                    aboutPageOverlay.classList.add("is-open");
                    aboutPageOverlay.setAttribute("aria-hidden", "false");
                }
                closeSideMenu();
            });
        });

        window.addEventListener("message", function (event) {
            if (!aboutPageFrame || event.source !== aboutPageFrame.contentWindow || typeof event.data !== "string") return;
            var gotoPrefix = "cyberguard:goto:";
            var wantsClose = event.data === "cyberguard:close-about";
            var gotoId = event.data.indexOf(gotoPrefix) === 0 ? event.data.slice(gotoPrefix.length) : "";
            if (!wantsClose && !/^[A-Za-z0-9_-]+$/.test(gotoId)) return;
            aboutPageOverlay.classList.remove("is-open");
            aboutPageOverlay.setAttribute("aria-hidden", "true");
            aboutPageFrame.src = "about:blank";
            if (gotoId) {
                setTimeout(function () {
                    var target = document.getElementById(gotoId);
                    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 120);
            }
        });

        /* ESC key se menu close */

        document.addEventListener("keydown", function (event) {

            if (event.key === "Escape") {
                closeSideMenu();
            }

        });


        /* =====================================================
           2. CONTROL CENTER / CONTACT / ABOUT BUTTONS
           ===================================================== */

        const sideButtons = document.querySelectorAll(".side-menu-item");

        sideButtons.forEach(function (button) {

            button.addEventListener("click", function () {

                const action = button.getAttribute("data-side-action");

                closeSideMenu();

                setTimeout(function () {

                    if (action === "control") {

                        if (typeof openModal === "function") {
                            openModal("controlModal");
                        }

                    }

                    else if (action === "contact") {

                        if (typeof openModal === "function") {
                            openModal("contactModal");
                        }

                    }

                    else if (action === "about") {

                        if (typeof openModal === "function") {
                            openModal("aboutModal");
                        }

                    }

                }, 250);

            });

        });


        /* =====================================================
           3. SCROLL REVEAL ANIMATION
           ===================================================== */

        const revealElements = document.querySelectorAll(
            ".page-section, " +
            ".tool-card, " +
            ".scam-card, " +
            ".metric-card, " +
            ".quiz-card, " +
            ".game-container, " +
            ".table-container"
        );

        revealElements.forEach(function (element, index) {

            element.classList.add("cg-reveal");

            const delay = Math.min((index % 6) * 50, 250);

            element.style.transitionDelay = delay + "ms";

        });


        if ("IntersectionObserver" in window) {

            const revealObserver = new IntersectionObserver(

                function (entries, observer) {

                    entries.forEach(function (entry) {

                        if (entry.isIntersecting) {

                            entry.target.classList.add("cg-visible");

                            observer.unobserve(entry.target);

                        }

                    });

                },

                {
                    threshold: 0.08,
                    rootMargin: "0px 0px -40px 0px"
                }

            );


            revealElements.forEach(function (element) {

                revealObserver.observe(element);

            });

        }

        else {

            revealElements.forEach(function (element) {

                element.classList.add("cg-visible");

            });

        }


        /* =====================================================
           4. BACK TO TOP BUTTON
           ===================================================== */

        const backToTop = document.getElementById("backToTop");

        if (backToTop) {

            function checkScroll() {

                if (window.scrollY > 600) {

                    backToTop.classList.add("is-visible");

                }

                else {

                    backToTop.classList.remove("is-visible");

                }

            }


            window.addEventListener(
                "scroll",
                checkScroll,
                { passive: true }
            );


            backToTop.addEventListener("click", function () {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            });


            checkScroll();

        }


        /* =====================================================
           5. LIVE DIGITAL CLOCK
           ===================================================== */

        const quickTime = document.getElementById("quickTime");

        if (quickTime) {

            function updateClock() {

                const now = new Date();

                const hours = String(
                    now.getHours()
                ).padStart(2, "0");

                const minutes = String(
                    now.getMinutes()
                ).padStart(2, "0");

                const seconds = String(
                    now.getSeconds()
                ).padStart(2, "0");

                quickTime.textContent =
                    hours + ":" +
                    minutes + ":" +
                    seconds;

            }


            updateClock();

            setInterval(
                updateClock,
                1000
            );

        }


        /* =====================================================
           6. ACTIVE NAVIGATION
           ===================================================== */

        const navLinks = document.querySelectorAll(
            ".nav-links a[href^='#']"
        );

        const navSections = [];


        navLinks.forEach(function (link) {

            const targetID =
                link.getAttribute("href");

            const target =
                document.querySelector(targetID);

            if (target) {
                navSections.push(target);
            }

        });


        if (
            navSections.length > 0 &&
            "IntersectionObserver" in window
        ) {

            const navObserver =
                new IntersectionObserver(

                    function (entries) {

                        entries.forEach(function (entry) {

                            if (!entry.isIntersecting) {
                                return;
                            }


                            navLinks.forEach(function (link) {

                                link.classList.remove(
                                    "active"
                                );

                            });


                            const activeLink =
                                document.querySelector(
                                    '.nav-links a[href="#' +
                                    entry.target.id +
                                    '"]'
                                );


                            if (activeLink) {

                                activeLink.classList.add(
                                    "active"
                                );

                            }

                        });

                    },

                    {
                        threshold: 0.3,
                        rootMargin:
                            "-10% 0px -60% 0px"
                    }

                );


            navSections.forEach(function (section) {

                navObserver.observe(section);

            });

        }


        /* =====================================================
           7. CYBER TOAST NOTIFICATION SYSTEM
           ===================================================== */

        window.showCyberToast = function (
            message,
            title
        ) {

            const toastStack =
                document.getElementById(
                    "toastStack"
                );

            if (!toastStack) return;


            title =
                title ||
                "CYBERGUARD";


            const toast =
                document.createElement(
                    "div"
                );


            toast.className =
                "cg-toast";


            const heading =
                document.createElement(
                    "strong"
                );

            heading.textContent =
                title;


            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                message;


            toast.appendChild(
                heading
            );

            toast.appendChild(
                text
            );


            toastStack.appendChild(
                toast
            );


            setTimeout(function () {

                toast.classList.add(
                    "out"
                );


                setTimeout(function () {

                    toast.remove();

                }, 350);

            }, 3200);

        };


        /* =====================================================
           8. INPUT FOCUS EFFECT
           ===================================================== */

        const inputs =
            document.querySelectorAll(
                "input"
            );


        inputs.forEach(function (input) {

            input.addEventListener(
                "focus",
                function () {

                    const card =
                        input.closest(
                            ".tool-card"
                        );


                    if (card) {

                        card.classList.add(
                            "input-active"
                        );

                    }

                }
            );


            input.addEventListener(
                "blur",
                function () {

                    const card =
                        input.closest(
                            ".tool-card"
                        );


                    if (card) {

                        card.classList.remove(
                            "input-active"
                        );

                    }

                }
            );

        });


        /* =====================================================
           10. CARD 3D HOVER EFFECT
           ===================================================== */

        const tiltCards =
            document.querySelectorAll(
                ".glowing-card, " +
                ".scam-card, " +
                ".metric-card, " +
                ".quiz-card"
            );


        if (
            window.matchMedia(
                "(pointer: fine)"
            ).matches
        ) {

            tiltCards.forEach(function (card) {

                card.addEventListener(
                    "pointermove",
                    function (event) {

                        const rect =
                            card.getBoundingClientRect();


                        const x =
                            (event.clientX -
                                rect.left) /
                            rect.width -
                            0.5;


                        const y =
                            (event.clientY -
                                rect.top) /
                            rect.height -
                            0.5;


                        const rotateX =
                            (-y * 2).toFixed(2);


                        const rotateY =
                            (x * 2).toFixed(2);


                        card.style.transform =
                            "perspective(900px) " +
                            "rotateX(" +
                            rotateX +
                            "deg) " +
                            "rotateY(" +
                            rotateY +
                            "deg) " +
                            "translateY(-4px)";

                    }
                );


                card.addEventListener(
                    "pointerleave",
                    function () {

                        card.style.transform =
                            "";

                    }
                );

            });

        }


        /* =====================================================
           11. INITIAL SYSTEM MESSAGE
           ===================================================== */

        setTimeout(function () {

            if (
                typeof showCyberToast ===
                "function"
            ) {

                showCyberToast(
                    "CyberGuard interface is ready.",
                    "SYSTEM ONLINE"
                );

            }

        }, 1000);


    });

})();
// Function to apply saved theme from localStorage across all pages
function applySavedTheme() {
    const savedTextColor = localStorage.getItem('siteTextColor');
    const savedAccentColor = localStorage.getItem('siteAccentColor');
    const savedBgOpacity = localStorage.getItem('siteBgOpacity');

    if (savedTextColor) {
        document.documentElement.style.setProperty('--primary-text', savedTextColor);
    }
    if (savedAccentColor) {
        document.documentElement.style.setProperty('--accent-color', savedAccentColor);
    }
    if (savedBgOpacity) {
        document.documentElement.style.setProperty('--bg-overlay-opacity', savedBgOpacity);
    }
}

// Run immediately on page load
document.addEventListener('DOMContentLoaded', applySavedTheme);

// Listen for color changes live from Control Center (Real-time Syncing across tabs)
window.addEventListener('storage', (event) => {
    if (['siteTextColor', 'siteAccentColor', 'siteBgOpacity'].includes(event.key)) {
        applySavedTheme();
    }
});
/* ==========================================================================
   CYBER-GUARD // FULL FUNCTIONAL TOOL SUITE & INTERACTIVE ENGINES
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavbarToggle();
});

// Real-Time Top/Quick Status Clock
function initClock() {
    const quickTime = document.getElementById('quickTime');
    if (quickTime) {
        setInterval(() => {
            const now = new Date();
            quickTime.textContent = now.toLocaleTimeString();
        }, 1000);
    }
}

// Side Menu Control Toggle
function initNavbarToggle() {
    const menuToggle = document.getElementById('menuToggle');
    const sidePanel = document.getElementById('sidePanel');
    const sideClose = document.getElementById('sideClose');
    const menuBackdrop = document.getElementById('menuBackdrop');

    if (menuToggle && sidePanel) {
        menuToggle.addEventListener('click', () => {
            sidePanel.classList.add('open');
            if (menuBackdrop) menuBackdrop.classList.add('active');
        });
    }

    if (sideClose && sidePanel) {
        sideClose.addEventListener('click', () => {
            sidePanel.classList.remove('open');
            if (menuBackdrop) menuBackdrop.classList.remove('active');
        });
    }
}

/* --------------------------------------------------------------------------
   CYBERGUARD // 30 SECURITY TOOLS VVIP ENGINE
   -------------------------------------------------------------------------- */

"use strict";


/* ============================================================
   CORE SECURITY HELPERS
   ============================================================ */

function cgEsc(value) {
    return String(value ?? "").replace(
        /[&<>'"]/g,
        c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[c])
    );
}


function cgSet(id, html, state = "info") {

    const el = document.getElementById(id);

    if (!el) return;

    el.innerHTML = html;

    const card = el.closest(".tool-card");

    if (card) {
        card.dataset.state = state;
    }
}


function cgSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function cgUrl(raw) {

    const value = String(raw || "").trim();

    if (!value) {
        throw new Error("Input required");
    }

    return new URL(
        /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
            ? value
            : "https://" + value
    );
}


async function cgJson(url, options = {}) {

    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        options.timeout || 9000
    );

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();

    } finally {

        clearTimeout(timer);

    }
}


/* ============================================================
   1. PASSWORD RESILIENCE ANALYZER
   ============================================================ */

function checkPasswordStrength() {

    const pass =
        document.getElementById("passInput")?.value || "";

    const bar =
        document.getElementById("strengthBar");

    const text =
        document.getElementById("strengthText");

    if (!bar || !text) return;

    if (!pass) {

        bar.style.width = "0%";
        text.textContent = "Awaiting Input...";

        return;
    }

    let pool = 0;

    if (/[a-z]/.test(pass)) pool += 26;
    if (/[A-Z]/.test(pass)) pool += 26;
    if (/[0-9]/.test(pass)) pool += 10;
    if (/[^A-Za-z0-9]/.test(pass)) pool += 33;

    const entropy =
        pass.length * Math.log2(Math.max(pool, 1));

    const score =
        Math.min(100, Math.round(entropy / 1.2));

    bar.style.width = score + "%";

    bar.style.backgroundColor =
        score < 40
            ? "#ff3366"
            : score < 65
                ? "#ffbb00"
                : score < 85
                    ? "#00bcff"
                    : "#00ffaa";

    const guesses =
        Math.pow(2, Math.max(entropy - 1, 0));

    const years =
        guesses / 1e10 / 31557600;

    let time;

    if (years < 1) {

        const hours =
            guesses / 1e10 / 3600;

        time =
            hours < 1
                ? "< 1 hour"
                : Math.round(hours) + " hours";

    } else if (years < 1000) {

        time = Math.round(years) + " years";

    } else {

        time = "> 1,000 years";

    }

    text.textContent =
        `${score < 40
            ? "Weak"
            : score < 65
                ? "Moderate"
                : score < 85
                    ? "Strong"
                    : "Very Strong"
        } • ${pass.length} chars • ~${entropy.toFixed(1)} bits • rough offline time: ${time}`;
}


/* ============================================================
   2. EMAIL BREACH INSPECTOR
   ============================================================ */

async function simulateBreachCheck() {

    const email =
        document.getElementById("emailInput")
            ?.value.trim() || "";

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {

        cgSet(
            "breachResult",
            "⚠️ Enter a valid email address.",
            "danger"
        );

        return;
    }

    cgSet(
        "breachResult",
        "⏳ Validating input…",
        "info"
    );

    await cgSleep(450);

    cgSet(
        "breachResult",
        `
        🛡️ Email format is valid.

        <strong>${cgEsc(email)}</strong>

        <br><small>
        Live breach verification requires a verified
        server-side breach provider/API key.
        This browser-only build intentionally does not
        claim CLEAN or EXPOSED without real evidence.
        </small>
        `,
        "warning"
    );
}


/* ============================================================
   3. PHISHING URL INSPECTOR
   ============================================================ */

function inspectURL() {

    const raw =
        document.getElementById("urlInput")
            ?.value.trim() || "";

    if (!raw) {

        cgSet(
            "urlResult",
            "⚠️ Enter a URL to inspect.",
            "danger"
        );

        return;
    }

    try {

        const u = cgUrl(raw);

        const host =
            u.hostname.toLowerCase();

        const reasons = [];

        if (u.protocol !== "https:") {
            reasons.push("Not HTTPS");
        }

        if (
            /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
        ) {
            reasons.push("IP address used as host");
        }

        if (host.includes("xn--")) {
            reasons.push("Punycode domain");
        }

        if (u.username || u.password) {
            reasons.push("Embedded credentials");
        }

        if (host.split(".").length > 4) {
            reasons.push("Unusually deep subdomain");
        }

        if (
            /[\u0430-\u04ff\u0370-\u03ff]/.test(host)
        ) {
            reasons.push(
                "Non-Latin hostname characters"
            );
        }

        if (
            /(login|verify|secure|bonus|reward|update|wallet|bank|easypaisa|jazzcash)/i
                .test(host + u.pathname)
        ) {
            reasons.push(
                "Sensitive/social-engineering keywords"
            );
        }

        if (
            /\.(zip|mov|top|xyz|click|work|download)$/i
                .test(host)
        ) {
            reasons.push(
                "Higher-abuse-risk TLD pattern"
            );
        }

        const risk =
            Math.min(
                100,
                reasons.length * 18 +
                (u.protocol !== "https:" ? 15 : 0)
            );

        const state =
            risk >= 55
                ? "danger"
                : risk >= 25
                    ? "warning"
                    : "success";

        cgSet(
            "urlResult",
            `
            <strong>
                ${risk >= 55
                    ? "🚨 HIGH RISK"
                    : risk >= 25
                        ? "⚠️ REVIEW"
                        : "🛡️ LOWER RISK"
                }
            </strong>

            • ${risk}/100

            <br>

            <small>
                ${
                    reasons.length
                        ? reasons.map(cgEsc).join(" • ")
                        : "No obvious client-side red flags detected. This is NOT proof that the site is safe."
                }
            </small>

            <br>

            <code>${cgEsc(u.origin)}</code>
            `,
            state
        );

    } catch {

        cgSet(
            "urlResult",
            "⚠️ Invalid URL format.",
            "danger"
        );

    }
}


/* ============================================================
   4. IP GEOLOCATION
   ============================================================ */

async function lookupIP() {

    const ip =
        document.getElementById("ipInput")
            ?.value.trim() || "";

    const result =
        document.getElementById("ipResult");

    if (!result) return;

    result.textContent =
        "⏳ Querying IP intelligence…";

    try {

        const data =
            await cgJson(
                `https://ipapi.co/${ip || "json"}/json/`
            );

        cgSet(
            "ipResult",
            `
            📍 <strong>
            ${cgEsc(data.ip || ip || "Unknown")}
            </strong>

            <br>

            Country:
            ${cgEsc(data.country_name || "—")}

            • Region:
            ${cgEsc(data.region || "—")}

            • City:
            ${cgEsc(data.city || "—")}

            <br>

            ASN:
            ${cgEsc(data.asn || "—")}

            • Org:
            ${cgEsc(data.org || "—")}
            `,
            "success"
        );

    } catch {

        cgSet(
            "ipResult",
            "⚠️ Live IP provider unavailable or rate-limited. No fabricated location shown.",
            "warning"
        );

    }
}


/* ============================================================
   5. CRYPTOGRAPHIC PASSWORD GENERATOR
   ============================================================ */

function generatePassword() {

    const output =
        document.getElementById("genPassOutput");

    if (!output) return;

    const sets = [
        "ABCDEFGHJKLMNPQRSTUVWXYZ",
        "abcdefghijkmnopqrstuvwxyz",
        "23456789",
        "!@#$%^&*_-+="
    ];

    const all =
        sets.join("");

    const bytes =
        new Uint32Array(20);

    crypto.getRandomValues(bytes);

    let password =
        sets
            .map(
                (set, index) =>
                    set[bytes[index] % set.length]
            )
            .join("");

    for (let i = 4; i < 20; i++) {

        password +=
            all[bytes[i] % all.length];

    }

    const chars =
        [...password];

    for (
        let i = chars.length - 1;
        i > 0;
        i--
    ) {

        const random =
            new Uint32Array(1);

        crypto.getRandomValues(random);

        const j =
            random[0] % (i + 1);

        [
            chars[i],
            chars[j]
        ] = [
            chars[j],
            chars[i]
        ];
    }

    output.value =
        chars.join("");

    output
        .closest(".tool-card")
        ?.setAttribute(
            "data-state",
            "success"
        );
}


/* ============================================================
   6. JWT INSPECTOR
   ============================================================ */

function b64urlToBytes(value) {

    let str =
        value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

    while (str.length % 4) {
        str += "=";
    }

    const binary =
        atob(str);

    return Uint8Array.from(
        binary,
        c => c.charCodeAt(0)
    );
}


function decodeJWT() {

    const jwt =
        document.getElementById("jwtInput")
            ?.value.trim() || "";

    if (!jwt) {

        cgSet(
            "jwtResult",
            "⚠️ Paste a JWT first.",
            "danger"
        );

        return;
    }

    try {

        const parts =
            jwt.split(".");

        if (parts.length !== 3) {
            throw new Error();
        }

        const header =
            JSON.parse(
                new TextDecoder().decode(
                    b64urlToBytes(parts[0])
                )
            );

        const payload =
            JSON.parse(
                new TextDecoder().decode(
                    b64urlToBytes(parts[1])
                )
            );

        const warning =
            String(header.alg || "")
                .toLowerCase() === "none"
                ? " ⚠️ alg=none"
                : "";

        cgSet(
            "jwtResult",
            `
            <strong>
                Header${warning}
            </strong>

            <pre>
${cgEsc(JSON.stringify(header, null, 2))}
            </pre>

            <strong>
                Payload
            </strong>

            <pre>
${cgEsc(JSON.stringify(payload, null, 2))}
            </pre>

            <small>
            Decode ≠ signature verification.
            Never paste production secrets into a public browser tool.
            </small>
            `,
            "success"
        );

    } catch {

        cgSet(
            "jwtResult",
            "⚠️ Invalid JWT / Base64URL / JSON payload.",
            "danger"
        );

    }
}


/* ============================================================
   7. BASE64
   ============================================================ */

function handleBase64(mode) {

    const input =
        document.getElementById("base64Input")
            ?.value || "";

    try {

        let output;

        if (mode === "encode") {

            output =
                btoa(
                    unescape(
                        encodeURIComponent(input)
                    )
                );

        } else {

            output =
                decodeURIComponent(
                    escape(
                        atob(input)
                    )
                );
        }

        cgSet(
            "base64Result",
            `<code>${cgEsc(output)}</code>`,
            "success"
        );

    } catch {

        cgSet(
            "base64Result",
            "⚠️ Invalid Base64 input or encoding.",
            "danger"
        );

    }
}


/* ============================================================
   8. SHA-256
   ============================================================ */

async function generateHash() {

    const text =
        document.getElementById("hashInput")
            ?.value || "";

    if (!text) {

        cgSet(
            "hashResult",
            "⚠️ Enter text to hash.",
            "danger"
        );

        return;
    }

    const buffer =
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(text)
        );

    const hex =
        [...new Uint8Array(buffer)]
            .map(
                b => b
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("");

    cgSet(
        "hashResult",
        `
        SHA-256:
        <br>
        <code>${hex}</code>
        `,
        "success"
    );
}


/* ============================================================
   9. URL ENCODER / DECODER
   ============================================================ */

function handleURLCodec(mode) {

    const input =
        document.getElementById("urlCodecInput")
            ?.value || "";

    try {

        const output =
            mode === "encode"
                ? encodeURIComponent(input)
                : decodeURIComponent(input);

        cgSet(
            "urlCodecResult",
            `<code>${cgEsc(output)}</code>`,
            "success"
        );

    } catch {

        cgSet(
            "urlCodecResult",
            "⚠️ Invalid encoded string.",
            "danger"
        );

    }
}


/* ============================================================
   10. PORT SCANNER
   ============================================================ */

function scanPorts() {

    const target =
        document.getElementById("portScanInput")
            ?.value.trim() || "";

    try {

        const url =
            cgUrl(target);

        cgSet(
            "portScanResult",
            `
            🛡️ Browser safety limitation:

            A normal webpage cannot perform a reliable
            TCP SYN/port scan.

            <br>

            Target:
            <code>${cgEsc(url.hostname)}</code>

            <br>

            <small>
            This module safely validates the target.
            Authorized port testing should run from a
            controlled server or security-testing environment.
            </small>
            `,
            "warning"
        );

    } catch {

        cgSet(
            "portScanResult",
            "⚠️ Enter a valid hostname or IP.",
            "danger"
        );

    }
}


/* ============================================================
   11. BROWSER / DEVICE ANALYZER
   ============================================================ */

function analyzeUserAgent() {

    cgSet(
        "uaResult",
        `
        Browser:
        ${cgEsc(navigator.userAgent)}

        <br>

        Platform:
        ${cgEsc(navigator.platform)}

        <br>

        Language:
        ${cgEsc(navigator.language)}

        <br>

        Online:
        ${navigator.onLine ? "YES" : "NO"}

        <br>

        Cookies:
        ${navigator.cookieEnabled
            ? "ENABLED"
            : "DISABLED"}

        <br>

        Screen:
        ${screen.width} × ${screen.height}
        `,
        "success"
    );
}


/* ============================================================
   12. DNS RECORD LOOKUP
   ============================================================ */

async function lookupDNS() {

    const domain =
        (
            document
                .getElementById("dnsInput")
                ?.value.trim() || ""
        )
            .replace(/^https?:\/\//, "")
            .split("/")[0];

    if (!domain) {

        cgSet(
            "dnsResult",
            "⚠️ Enter a domain.",
            "danger"
        );

        return;
    }

    try {

        const types = [
            "A",
            "AAAA",
            "MX",
            "TXT"
        ];

        const rows = [];

        for (const type of types) {

            const data =
                await cgJson(
                    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`
                );

            const answers =
                (data.Answer || [])
                    .map(
                        item =>
                            cgEsc(item.data)
                    )
                    .join("<br>")
                    || "—";

            rows.push(
                `
                <strong>${type}</strong>:
                ${answers}
                `
            );
        }

        cgSet(
            "dnsResult",
            rows.join("<hr>"),
            "success"
        );

    } catch {

        cgSet(
            "dnsResult",
            "⚠️ DNS-over-HTTPS provider unavailable.",
            "warning"
        );

    }
}


/* ============================================================
   13. SECURITY HEADERS
   ============================================================ */

async function auditSecurityHeaders() {

    const raw =
        document.getElementById("headerInput")
            ?.value.trim() || "";

    if (!raw) {

        cgSet(
            "headerResult",
            "⚠️ Enter a URL.",
            "danger"
        );

        return;
    }

    try {

        const url =
            cgUrl(raw);

        const response =
            await fetch(
                url.href,
                {
                    mode: "cors",
                    cache: "no-store"
                }
            );

        const headers = [
            "content-security-policy",
            "strict-transport-security",
            "x-frame-options",
            "x-content-type-options",
            "referrer-policy",
            "permissions-policy"
        ];

        const rows =
            headers.map(
                name =>
                    `
                    <strong>
                    ${name}
                    </strong>:

                    ${
                        response.headers.get(name)
                            ? '<span class="cg-ok">PRESENT</span>'
                            : '<span class="cg-bad">MISSING / UNREADABLE</span>'
                    }
                    `
            );

        cgSet(
            "headerResult",
            rows.join("<br>") +
            `
            <br>
            <small>
            CORS may prevent browser access to
            another site's headers.
            Unreadable does not necessarily mean missing.
            </small>
            `,
            "info"
        );

    } catch {

        cgSet(
            "headerResult",
            `
            ⚠️ Browser could not read this site's headers.

            <br>

            This is commonly caused by CORS.
            Use a server-side header audit for authoritative results.
            `,
            "warning"
        );

    }
}


/* ============================================================
   14. BIN INSPECTOR
   ============================================================ */

function checkBIN() {

    const bin =
        (
            document.getElementById("binInput")
                ?.value || ""
        )
            .replace(/\D/g, "")
            .slice(0, 6);

    if (bin.length !== 6) {

        cgSet(
            "binResult",
            "⚠️ Enter exactly 6 digits.",
            "danger"
        );

        return;
    }

    const first =
        bin[0];

    const two =
        Number(bin.slice(0, 2));

    const four =
        Number(bin.slice(0, 4));

    let network =
        "Unknown";

    if (first === "4") {

        network =
            "Visa family";

    } else if (
        (two >= 51 && two <= 55) ||
        (four >= 2221 && four <= 2720)
    ) {

        network =
            "Mastercard family";

    } else if (
        two === 34 ||
        two === 37
    ) {

        network =
            "American Express family";

    } else if (two === 62) {

        network =
            "UnionPay family";

    }

    cgSet(
        "binResult",
        `
        BIN prefix:
        <strong>${bin}</strong>

        <br>

        Network family:
        ${network}

        <br>

        <small>
        Prefix checks do not verify issuer,
        country, card status, CVV, or ownership.
        </small>
        `,
        "info"
    );
}


/* ============================================================
   15. QR SAFETY
   ============================================================ */

function checkQRData() {

    const raw =
        document.getElementById("qrInput")
            ?.value.trim() || "";

    if (!raw) {

        cgSet(
            "qrResult",
            "⚠️ Paste decoded QR content.",
            "danger"
        );

        return;
    }

    let risk = 0;
    const reasons = [];

    try {

        const url =
            cgUrl(raw);

        if (url.protocol !== "https:") {

            risk += 30;
            reasons.push(
                "non-HTTPS URL"
            );
        }

        if (
            /(login|verify|wallet|bank|bonus|reward|apk)/i
                .test(url.href)
        ) {

            risk += 25;
            reasons.push(
                "sensitive keyword"
            );
        }

        if (
            url.hostname.includes("xn--")
        ) {

            risk += 20;
            reasons.push(
                "punycode"
            );
        }

    } catch {

        if (
            /\.(apk|exe|scr|bat)\b/i
                .test(raw)
        ) {

            risk += 60;

            reasons.push(
                "executable file reference"
            );
        }
    }

    risk =
        Math.min(100, risk);

    cgSet(
        "qrResult",
        `
        ${
            risk >= 55
                ? "🚨 REVIEW"
                : "🛡️ LOWER RISK"
        }

        • ${risk}/100

        <br>

        ${
            reasons.length
                ? reasons.map(cgEsc).join(" • ")
                : "No obvious client-side red flags detected."
        }

        <br>

        <small>
        QR analysis cannot prove that the destination is trustworthy.
        </small>
        `,
        risk >= 55
            ? "danger"
            : risk
                ? "warning"
                : "success"
    );
}


/* ============================================================
   16. SSL INSPECTOR
   ============================================================ */

function checkSSL() {

    const raw =
        document.getElementById("sslInput")
            ?.value.trim() || "";

    try {

        const url =
            cgUrl(raw);

        const secure =
            url.protocol === "https:";

        cgSet(
            "sslResult",
            `
            ${
                secure
                    ? "🔒 HTTPS scheme detected"
                    : "🚨 HTTP scheme detected"
            }

            <br>

            Host:
            <code>${cgEsc(url.hostname)}</code>

            <br>

            <small>
            A browser page cannot reliably inspect
            certificate issuer, expiry, chain, or
            complete TLS configuration for an arbitrary host.
            </small>
            `,
            secure
                ? "success"
                : "danger"
        );

    } catch {

        cgSet(
            "sslResult",
            "⚠️ Invalid URL.",
            "danger"
        );

    }
}


/* ============================================================
   17. SUBDOMAIN FINDER
   ============================================================ */

async function findSubdomains() {

    const domain =
        (
            document
                .getElementById("subdomainInput")
                ?.value.trim() || ""
        )
            .replace(/^https?:\/\//, "")
            .split("/")[0];

    if (!domain) {

        cgSet(
            "subdomainResult",
            "⚠️ Enter a domain.",
            "danger"
        );

        return;
    }

    try {

        const data =
            await cgJson(
                `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
                {
                    timeout: 12000
                }
            );

        const names =
            [
                ...new Set(
                    data
                        .flatMap(
                            item =>
                                String(
                                    item.name_value || ""
                                )
                                    .split("\n")
                        )
                        .filter(
                            name =>
                                name.endsWith(domain) &&
                                !name.includes("*")
                        )
                )
            ]
                .slice(0, 80);

        cgSet(
            "subdomainResult",
            names.length
                ? `
                    <strong>
                    ${names.length}
                    certificate names found
                    </strong>

                    <br>

                    <code>
                    ${names.map(cgEsc).join("<br>")}
                    </code>
                  `
                : "No certificate names returned.",
            "success"
        );

    } catch {

        cgSet(
            "subdomainResult",
            "⚠️ Certificate Transparency lookup unavailable.",
            "warning"
        );

    }
}


/* ============================================================
   18. MAC VENDOR
   ============================================================ */

async function checkMAC() {

    const mac =
        (
            document.getElementById("macInput")
                ?.value.trim() || ""
        )
            .toUpperCase();

    if (
        !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/
            .test(mac)
    ) {

        cgSet(
            "macResult",
            "⚠️ Use format AA:BB:CC:DD:EE:FF.",
            "danger"
        );

        return;
    }

    try {

        const response =
            await fetch(
                `https://api.macvendors.com/${encodeURIComponent(mac)}`
            );

        const vendor =
            await response.text();

        if (!response.ok) {
            throw new Error();
        }

        cgSet(
            "macResult",
            `
            OUI:
            <strong>
            ${cgEsc(mac.slice(0, 8))}
            </strong>

            <br>

            Vendor:
            ${cgEsc(vendor)}
            `,
            "success"
        );

    } catch {

        cgSet(
            "macResult",
            `
            ⚠️ Vendor lookup unavailable.

            <br>

            MAC format is valid,
            but vendor information was not fabricated.
            `,
            "warning"
        );

    }
}


/* ============================================================
   19. FILE SHA-256
   ============================================================ */

async function calculateFileHash() {

    const input =
        document.getElementById(
            "fileHashInput"
        );

    const file =
        input?.files?.[0];

    if (!file) {

        cgSet(
            "fileHashResult",
            "⚠️ Select a file first.",
            "danger"
        );

        return;
    }

    try {

        const buffer =
            await file.arrayBuffer();

        const hash =
            await crypto.subtle.digest(
                "SHA-256",
                buffer
            );

        const hex =
            [...new Uint8Array(hash)]
                .map(
                    b =>
                        b
                            .toString(16)
                            .padStart(2, "0")
                )
                .join("");

        cgSet(
            "fileHashResult",
            `
            File:
            <strong>
            ${cgEsc(file.name)}
            </strong>

            <br>

            Size:
            ${(file.size / 1024 / 1024).toFixed(2)}
            MB

            <br>

            SHA-256:

            <br>

            <code>
            ${hex}
            </code>
            `,
            "success"
        );

    } catch {

        cgSet(
            "fileHashResult",
            "⚠️ File hashing failed.",
            "danger"
        );

    }
}


/* ============================================================
   20. REAL AES-256-GCM VAULT
   ============================================================ */

async function cgDeriveKey(passphrase, salt) {

    const material =
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(
                passphrase
            ),
            {
                name: "PBKDF2"
            },
            false,
            [
                "deriveKey"
            ]
        );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 150000,
            hash: "SHA-256"
        },
        material,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        [
            "encrypt",
            "decrypt"
        ]
    );
}


function cgB64(bytes) {

    let output = "";

    for (const byte of bytes) {
        output += String.fromCharCode(byte);
    }

    return btoa(output);
}


function cgUnb64(value) {

    const binary =
        atob(value);

    return Uint8Array.from(
        binary,
        char => char.charCodeAt(0)
    );
}


async function handleAES(mode) {

    const text =
        document.getElementById(
            "aesTextInput"
        )?.value || "";

    const passphrase =
        document.getElementById(
            "aesKeyInput"
        )?.value || "";

    if (!text || !passphrase) {

        cgSet(
            "aesResult",
            "⚠️ Text and passphrase are required.",
            "danger"
        );

        return;
    }

    try {

        if (mode === "encrypt") {

            const salt =
                crypto.getRandomValues(
                    new Uint8Array(16)
                );

            const iv =
                crypto.getRandomValues(
                    new Uint8Array(12)
                );

            const key =
                await cgDeriveKey(
                    passphrase,
                    salt
                );

            const encrypted =
                await crypto.subtle.encrypt(
                    {
                        name: "AES-GCM",
                        iv
                    },
                    key,
                    new TextEncoder().encode(
                        text
                    )
                );

            const packageData =
                [
                    "CG-AES1",
                    cgB64(salt),
                    cgB64(iv),
                    cgB64(
                        new Uint8Array(
                            encrypted
                        )
                    )
                ].join(".");

            cgSet(
                "aesResult",
                `
                <strong>
                AES-256-GCM encrypted package
                </strong>

                <br>

                <code>
                ${packageData}
                </code>
                `,
                "success"
            );

        } else {

            const parts =
                text
                    .trim()
                    .split(".");

            if (
                parts.length !== 4 ||
                parts[0] !== "CG-AES1"
            ) {
                throw new Error();
            }

            const key =
                await cgDeriveKey(
                    passphrase,
                    cgUnb64(parts[1])
                );

            const plain =
                await crypto.subtle.decrypt(
                    {
                        name: "AES-GCM",
                        iv: cgUnb64(parts[2])
                    },
                    key,
                    cgUnb64(parts[3])
                );

            cgSet(
                "aesResult",
                `
                <strong>
                Decrypted:
                </strong>

                <br>

                <code>
                ${cgEsc(
                    new TextDecoder()
                        .decode(plain)
                )}
                </code>
                `,
                "success"
            );
        }

    } catch {

        cgSet(
            "aesResult",
            "⚠️ Decryption failed or package/passphrase is invalid.",
            "danger"
        );

    }
}


/* ============================================================
   21. REAL CIDR CALCULATOR
   ============================================================ */

function calculateCIDR() {

    const raw =
        document.getElementById(
            "cidrInput"
        )?.value.trim() || "";

    const match =
        raw.match(
            /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d|[12]\d|3[0-2])$/
        );

    if (!match) {

        cgSet(
            "cidrResult",
            "⚠️ Enter IPv4 CIDR such as 192.168.1.0/24.",
            "danger"
        );

        return;
    }

    const octets =
        match
            .slice(1, 5)
            .map(Number);

    const prefix =
        Number(match[5]);

    if (
        octets.some(
            value => value > 255
        )
    ) {

        cgSet(
            "cidrResult",
            "⚠️ Invalid IPv4 address.",
            "danger"
        );

        return;
    }

    const ip =
        (
            (octets[0] << 24) >>> 0
        ) +
        (octets[1] << 16) +
        (octets[2] << 8) +
        octets[3];

    const mask =
        prefix === 0
            ? 0
            : (
                0xffffffff <<
                (32 - prefix)
            ) >>> 0;

    const network =
        (ip & mask) >>> 0;

    const total =
        2 ** (32 - prefix);

    const broadcast =
        (
            network +
            total -
            1
        ) >>> 0;

    const formatIP =
        value =>
            [
                (value >>> 24) & 255,
                (value >>> 16) & 255,
                (value >>> 8) & 255,
                value & 255
            ].join(".");

    const usable =
        prefix >= 31
            ? total
            : Math.max(
                0,
                total - 2
            );

    cgSet(
        "cidrResult",
        `
        Network:
        <strong>
        ${formatIP(network)}/${prefix}
        </strong>

        <br>

        Mask:
        ${formatIP(mask)}

        <br>

        Broadcast:
        ${formatIP(broadcast)}

        <br>

        Total:
        ${total.toLocaleString()}

        • Usable:
        ${usable.toLocaleString()}
        `,
        "success"
    );
}


/* ============================================================
   22. HTTP LATENCY TEST
   ============================================================ */

async function simulatePing() {

    const raw =
        document.getElementById(
            "pingInput"
        )?.value.trim() || "";

    if (!raw) {

        cgSet(
            "pingResult",
            "⚠️ Enter a host.",
            "danger"
        );

        return;
    }

    let url;

    try {

        url =
            cgUrl(raw);

    } catch {

        cgSet(
            "pingResult",
            "⚠️ Invalid host.",
            "danger"
        );

        return;
    }

    const times = [];

    for (let i = 0; i < 3; i++) {

        const start =
            performance.now();

        try {

            await fetch(
                url.origin +
                "/?cgping=" +
                Date.now(),
                {
                    mode: "no-cors",
                    cache: "no-store"
                }
            );

            times.push(
                performance.now() -
                start
            );

        } catch {}

    }

    if (!times.length) {

        cgSet(
            "pingResult",
            `
            ⚠️ Browser could not reach
            ${cgEsc(url.hostname)}.

            <br>

            <small>
            This is an HTTP reachability test,
            not ICMP ping.
            </small>
            `,
            "warning"
        );

        return;
    }

    const average =
        times.reduce(
            (a, b) => a + b,
            0
        ) / times.length;

    cgSet(
        "pingResult",
        `
        HTTP reachability:

        <strong>
        ${average.toFixed(1)} ms average
        </strong>

        <br>

        Samples:
        ${times
            .map(
                time =>
                    time.toFixed(1) +
                    " ms"
            )
            .join(" • ")}

        <br>

        <small>
        Browser test ≠ ICMP ping.
        CORS/network policies can affect results.
        </small>
        `,
        "success"
    );
}


/* ============================================================
   23. HONEYPOT DETECTOR
   ============================================================ */

function detectHoneypot() {

    const target =
        document.getElementById(
            "honeypotInput"
        )?.value.trim() || "";

    if (!target) {

        cgSet(
            "honeypotResult",
            "⚠️ Enter a host/IP.",
            "danger"
        );

        return;
    }

    cgSet(
        "honeypotResult",
        `
        🛡️ Browser-only honeypot analysis cannot
        reliably determine whether a remote host is a honeypot.

        <br>

        Target:
        <code>${cgEsc(target)}</code>

        <br>

        <small>
        Reliable detection requires authorized
        server telemetry, service fingerprints,
        network behavior and packet-level evidence.
        </small>
        `,
        "warning"
    );
}


/* ============================================================
   24. SCAM HANDLE OSINT
   ============================================================ */

function searchScamHandle() {

    const handle =
        document.getElementById(
            "handleInput"
        )?.value.trim() || "";

    if (!handle) {

        cgSet(
            "handleResult",
            "⚠️ Enter a username/handle.",
            "danger"
        );

        return;
    }

    const clean =
        handle.replace(/^@/, "");

    const query =
        encodeURIComponent(
            `"${clean}" scam fraud`
        );

    cgSet(
        "handleResult",
        `
        OSINT target:

        <strong>
        @${cgEsc(clean)}
        </strong>

        <br>

        <a
            class="cg-result-link"
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.google.com/search?q=${query}"
        >
            Open public web search ↗
        </a>

        <br>

        <small>
        No criminal-database claim is made
        without a verified source.
        </small>
        `,
        "info"
    );
}


/* ============================================================
   25. FILE EXTENSION RISK
   ============================================================ */

function checkFileExtension() {

    const file =
        (
            document.getElementById(
                "extInput"
            )?.value || ""
        )
            .trim()
            .toLowerCase();

    if (!file) {

        cgSet(
            "extResult",
            "⚠️ Enter a filename.",
            "danger"
        );

        return;
    }

    const dangerous =
        /\.(exe|scr|bat|cmd|com|msi|jar|js|vbs|ps1|apk|hta|dll)(?:\.|$)/i
            .test(file);

    const doubleExtension =
        /\.[a-z0-9]{1,6}\.(exe|scr|bat|cmd|com|msi|jar|js|vbs|ps1|apk|hta|dll)$/i
            .test(file);

    cgSet(
        "extResult",
        `
        ${
            dangerous || doubleExtension
                ? "🚨 HIGH RISK"
                : "🛡️ NO KNOWN EXECUTABLE EXTENSION"
        }

        <br>

        ${
            doubleExtension
                ? "Double-extension deception detected."
                : ""
        }

        <br>

        <code>
        ${cgEsc(file)}
        </code>

        <br>

        <small>
        Extension analysis alone cannot prove
        that a file is safe.
        </small>
        `,
        dangerous || doubleExtension
            ? "danger"
            : "success"
    );
}


/* ============================================================
   26. REAL IBAN MOD-97 VALIDATOR
   ============================================================ */

function validateIBAN() {

    const iban =
        (
            document.getElementById(
                "ibanInput"
            )?.value || ""
        )
            .replace(/\s+/g, "")
            .toUpperCase();

    if (
        !/^PK[0-9]{2}[A-Z]{4}[0-9A-Z]{16}$/
            .test(iban)
    ) {

        cgSet(
            "ibanResult",
            "⚠️ Invalid Pakistani IBAN structure. Expected 24 characters.",
            "danger"
        );

        return;
    }

    const rearranged =
        iban.slice(4) +
        iban.slice(0, 4);

    let remainder = 0;

    for (const char of rearranged) {

        const digits =
            /[A-Z]/.test(char)
                ? String(
                    char.charCodeAt(0) -
                    55
                )
                : char;

        for (const digit of digits) {

            remainder =
                (
                    remainder * 10 +
                    Number(digit)
                ) % 97;

        }
    }

    cgSet(
        "ibanResult",
        remainder === 1
            ? `
                ✅ IBAN checksum is mathematically valid.

                <br>

                <small>
                This does not verify account ownership
                or account status.
                </small>
              `
            : `
                🚨 IBAN checksum is invalid.
              `,
        remainder === 1
            ? "success"
            : "danger"
    );
}


/* ============================================================
   27. WI-FI SECURITY
   ============================================================ */

function analyzeWiFi() {

    const wifi =
        (
            document.getElementById(
                "wifiInput"
            )?.value || ""
        )
            .trim()
            .toUpperCase();

    if (!wifi) {

        cgSet(
            "wifiResult",
            "⚠️ Enter the Wi-Fi security mode.",
            "danger"
        );

        return;
    }

    let state =
        "success";

    let message =
        "WPA3 / WPA2-AES: preferred modern configuration.";

    if (wifi.includes("WEP")) {

        state = "danger";
        message =
            "WEP: obsolete and unsafe.";

    } else if (
        wifi.includes("TKIP")
    ) {

        state = "danger";
        message =
            "TKIP: legacy and should be replaced.";

    } else if (
        wifi.includes("WPA2") &&
        !wifi.includes("AES")
    ) {

        state = "warning";
        message =
            "WPA2 detected but AES/CCMP is not explicit.";

    } else if (
        wifi.includes("OPEN")
    ) {

        state = "danger";
        message =
            "Open network: Wi-Fi encryption is not enabled.";

    }

    cgSet(
        "wifiResult",
        `
        <strong>
        ${message}
        </strong>

        <br>

        Input:
        ${cgEsc(wifi)}

        <br>

        <small>
        Prefer WPA3 or WPA2-AES/CCMP with
        a strong unique passphrase.
        </small>
        `,
        state
    );
}


/* ============================================================
   28. SQLi HEURISTIC
   ============================================================ */

function checkSQLi() {

    const query =
        document.getElementById(
            "sqliInput"
        )?.value || "";

    if (!query) {

        cgSet(
            "sqliResult",
            "⚠️ Enter a test string.",
            "danger"
        );

        return;
    }

    const patterns = [
        /('|%27)\s*(or|and)\b/i,
        /\bunion\s+(all\s+)?select\b/i,
        /\bselect\b.+\bfrom\b/i,
        /--|\/\*/i,
        /;\s*(drop|delete|insert|update)\b/i
    ];

    const hits =
        patterns.filter(
            pattern =>
                pattern.test(query)
        ).length;

    cgSet(
        "sqliResult",
        hits
            ? `
                🚨
                ${hits}
                suspicious SQLi pattern(s) detected.

                <br>

                Treat the input as untrusted
                and use parameterized queries.
              `
            : `
                🛡️ No obvious SQLi pattern
                detected by this heuristic.

                <br>

                <small>
                Heuristic checks are not a replacement
                for a real authorized application security test.
                </small>
              `,
        hits
            ? "danger"
            : "success"
    );
}


/* ============================================================
   29. XSS SANITIZER
   ============================================================ */

function sanitizeXSS() {

    const input =
        document.getElementById(
            "xssInput"
        )?.value || "";

    if (!input) {

        cgSet(
            "xssResult",
            "⚠️ Enter HTML/text to sanitize.",
            "danger"
        );

        return;
    }

    const box =
        document.createElement("div");

    box.textContent =
        input;

    const encoded =
        box.innerHTML;

    const risky =
        /<\s*script|javascript:|on\w+\s*=|<\s*(iframe|object|embed|svg)/i
            .test(input);

    cgSet(
        "xssResult",
        `
        ${
            risky
                ? "🚨 ACTIVE-MARKUP PATTERN DETECTED"
                : "🛡️ ENCODED OUTPUT"
        }

        <br>

        <code>
        ${encoded}
        </code>

        <br>

        <small>
        Use context-aware output encoding
        and a strict CSP in real applications.
        </small>
        `,
        risky
            ? "danger"
            : "success"
    );
}


/* ============================================================
   30. DARK WEB MONITOR
   ============================================================ */

function checkDarkWeb() {

    const domain =
        (
            document.getElementById(
                "darkwebInput"
            )?.value.trim() || ""
        )
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .split("/")[0];

    if (
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i
            .test(domain)
    ) {

        cgSet(
            "darkwebResult",
            "⚠️ Enter a valid domain.",
            "danger"
        );

        return;
    }

    cgSet(
        "darkwebResult",
        `
        🛡️ Monitoring target prepared:

        <strong>
        ${cgEsc(domain)}
        </strong>

        <br>

        <small>
        No live criminal-marketplace data is queried
        in this browser-only build, so no fake leak count
        is shown.

        <br><br>

        For verified monitoring, connect a vetted
        breach-monitoring API through your own server.
        </small>
        `,
        "warning"
    );
}


/* ============================================================
   TOOL SEARCH / FILTER / MODULE UI
   ============================================================ */

function initToolUpgradeUI() {

    const cards =
        document.querySelectorAll(
            ".tool-card"
        );

    cards.forEach(
        (card, index) => {

            card.dataset.toolIndex =
                index + 1;

            const tag =
                card
                    .querySelector(
                        ".card-tag"
                    )
                    ?.textContent
                    .trim()
                    || "SECURITY";

            if (
                !card.querySelector(
                    ".tool-module-badge"
                )
            ) {

                card.insertAdjacentHTML(
                    "beforeend",
                    `
                    <span class="tool-module-badge">
                        ${String(index + 1).padStart(2, "0")}
                        •
                        ${cgEsc(tag)}
                    </span>
                    `
                );
            }

            const result =
                card.querySelector(
                    ".breach-result-text"
                );

            if (result) {

                result.setAttribute(
                    "aria-live",
                    "polite"
                );
            }
        }
    );


    const search =
        document.getElementById(
            "toolSearch"
        );

    const filters =
        document.querySelectorAll(
            ".tool-filter"
        );


    function applyFilter(mode = "ALL") {

        const query =
            (
                search?.value || ""
            )
                .toLowerCase()
                .trim();


        cards.forEach(
            card => {

                const content =
                    card.textContent
                        .toLowerCase();

                const queryMatch =
                    !query ||
                    content.includes(query);


                const modeLower =
                    mode.toLowerCase();


                const defenseMatch =
                    mode === "DEFENSE" &&
                    /darknet|financial|qr|file|banking|osint|deception|wifi/
                        .test(content);


                const categoryMatch =
                    mode === "ALL" ||
                    content.includes(
                        modeLower
                    ) ||
                    defenseMatch;


                card.hidden =
                    !(queryMatch &&
                        categoryMatch);
            }
        );
    }


    if (search) {

        search.addEventListener(
            "input",
            () => {

                const active =
                    document.querySelector(
                        ".tool-filter.active"
                    );

                applyFilter(
                    active
                        ?.textContent
                        .trim()
                        || "ALL"
                );
            }
        );
    }


    filters.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    filters.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );

                    button.classList.add(
                        "active"
                    );

                    applyFilter(
                        button.textContent
                            .trim()
                    );
                }
            );
        }
    );
}


document.addEventListener(
    "DOMContentLoaded",
    initToolUpgradeUI
);

/* --------------------------------------------------------------------------
   INTERACTIVE PHISHING SANDBOXES & QUIZ ENGINE
   -------------------------------------------------------------------------- */

const labExplanations = {
    1: { ok: "Phishing domain detected! URL me 'paypa1' likha hai (1 instead of L).", bad: "Trap triggered! Yeh fake link aapke credentials chura lega." },
    2: { ok: "Bohat khoob! Hamesha official app me actual balance verify karein.", bad: "Scam! Sender ka balance credit nahi hua tha, sirf fake SMS bheja tha." },
    3: { ok: "Perfect! WhatsApp par aane wali .apk files banking trojans hoti hain.", bad: "Infected! Is APK ne SMS steal karne wala malware install kar diya." },
    4: { ok: "Shaandar! Real bank officers phone call par kabhi OTP nahi mangte.", bad: "Compromised! OTP share karne se attacker ne account login kar liya." },
    5: { ok: "Sahi faisla! QR code scan karke PIN enter karne se hamesha paise KATT'TE hain.", bad: "Loss! QR code scan karke PIN dalne se paise account se cut gaye." },
    6: { ok: "Safe! Fake foreign visa portals hamesha upfront fees demand karte hain.", bad: "Fraud! Fake recruitment agency aapke 12,000 lekar gayab ho gayi." },
    7: { ok: "Correct! BISP ya Govt grants ke liye koi advance registration fee nahi hoti.", bad: "Trap! Government programs kabhi personal mobile wallet me fee nahi mangte." },
    8: { ok: "Protected! AnyDesk ka access kabhi unknown caller ko na dein.", bad: "Hacked! AnyDesk se attacker aapki mobile screen live dekh kar OTP read kar lega." },
    9: { ok: "Genius! Family member ko direct unke regular number par call karke verify karein.", bad: "AI Scam! Yeh voice cloning thi, brother bilkul theek ghar par tha." },
    10: { ok: "Clean! WhatsApp par lucky draw aur car win links adware virus hote hain.", bad: "Spam! Link forward karne se browser cookies aur data leak ho gaya." },
    11: { ok: "Vigilant! Loose aur wobbly card reader slot hardware skimmer hota hai.", bad: "Cloned! Tampered slot ne aapke debit card ki magnetic strip copy kar li." }
};

function checkPhishingChoice(isCorrect, labId) {
    const verdict = document.getElementById(`phishingVerdict${labId}`);
    if (!verdict) return;
    
    const info = labExplanations[labId] || { ok: "Threat neutralized successfully!", bad: "Security policy compromised!" };
    
    if (isCorrect) {
        verdict.innerHTML = `<span style="color:#00ffaa;">✅ DEFENSE SUCCESS: ${info.ok}</span>`;
        verdict.className = "phishing-verdict success";
    } else {
        verdict.innerHTML = `<span style="color:#ff3366;">🚨 COMPROMISED: ${info.bad}</span>`;
        verdict.className = "phishing-verdict error";
    }
}

/* ============================================================
   CYBERGUARD // VVIP SAFETY QUIZ ENGINE
   ============================================================ */

let totalScore = 0;
let completedQuizzes = new Set();
let answeredQuizzes = new Set();


const quizKnowledge = {

    1: {
        title: "OTP Protection",
        explanation:
            "Banking OTPs are authentication secrets. Do not disclose them to callers. If a request seems urgent, end the conversation and contact the bank through an independently verified official channel."
    },

    2: {
        title: "APK Malware Defense",
        explanation:
            "Unknown APK files can contain malware or unwanted permissions. Avoid installing apps received from untrusted sources and use official app stores whenever possible."
    },

    3: {
        title: "Wallet Verification",
        explanation:
            "An SMS is not sufficient proof that money reached your wallet. Open the official wallet application and verify the actual transaction or balance before taking action."
    },

    4: {
        title: "Public Network Safety",
        explanation:
            "Open Wi-Fi can expose users to network risks. For sensitive banking activity, prefer cellular data or a trusted security setup and avoid unnecessary exposure on public networks."
    },

    5: {
        title: "QR Payment Safety",
        explanation:
            "A QR code can initiate an action rather than simply receive money. Never enter a PIN or approve a transaction just because someone claims it is required to receive a payment."
    },

    6: {
        title: "AI Voice Scam Defense",
        explanation:
            "A familiar voice is not reliable proof of identity. AI-generated voice impersonation can sound convincing. Independently contact the person using a trusted number before sending money."
    },

    7: {
        title: "ATM Hardware Security",
        explanation:
            "Loose, unusual or tampered ATM hardware can indicate a security problem. Do not use a suspicious machine and report the issue to the bank or responsible operator."
    },

    8: {
        title: "Account Takeover Prevention",
        explanation:
            "Verification codes are intended for the account owner. Never forward a code to another person. Unexpected code requests can indicate an attempted account takeover."
    }

};


const quizCorrectAnswers = {
    1: 1,
    2: 2,
    3: 0,
    4: 1,
    5: 1,
    6: 1,
    7: 1,
    8: 1
};


/* ---------- MAIN ANSWER HANDLER ---------- */

function checkVIPQuiz(
    quizNum,
    optIndex,
    isCorrect,
    clickedButton
) {

    const card =
        document.getElementById(`quizCard${quizNum}`);

    const feedback =
        document.getElementById(`quizFeedback${quizNum}`);

    if (!card || !feedback) return;


    /*
       Prevent changing the result after a question
       has already been answered.
    */
    if (answeredQuizzes.has(quizNum)) {

        if (typeof showCyberToast === "function") {
            showCyberToast(
                "This scenario has already been locked.",
                "QUIZ LOCKED"
            );
        }

        return;
    }


    answeredQuizzes.add(quizNum);


    const buttons =
        card.querySelectorAll(".quiz-opt-btn");


    /* Lock every option */

    buttons.forEach((button, index) => {

        button.classList.add("locked");
        button.disabled = true;

        if (
            index === quizCorrectAnswers[quizNum]
        ) {
            button.classList.add("correct-answer");
        }

    });


    /* Mark selected wrong answer */

    if (
        clickedButton &&
        !isCorrect
    ) {
        clickedButton.classList.add("wrong-answer");
    }


    const knowledge =
        quizKnowledge[quizNum];


    /* ---------- CORRECT ---------- */

    if (isCorrect) {

        if (!completedQuizzes.has(quizNum)) {

            totalScore += 10;

            completedQuizzes.add(
                quizNum
            );

        }


        feedback.className =
            "quiz-message-box success";


        feedback.innerHTML = `
            <strong>✓ DEFENSE SUCCESS // +10 POINTS</strong>
            <br>
            <span>${knowledge.title}</span>
            <br>
            <small>
                ${knowledge.explanation}
            </small>
        `;


        card.classList.add(
            "quiz-completed"
        );


        if (typeof showCyberToast === "function") {

            showCyberToast(
                `Scenario ${quizNum} neutralized successfully. +10 points.`,
                "DEFENSE SUCCESS"
            );

        }

    }


    /* ---------- WRONG ---------- */

    else {

        feedback.className =
            "quiz-message-box error";


        feedback.innerHTML = `
            <strong>⚠ SECURITY LESSON TRIGGERED</strong>
            <br>
            <span>Correct defense has been highlighted.</span>
            <br>
            <small>
                ${knowledge.explanation}
            </small>
        `;


        card.classList.add(
            "quiz-reviewed"
        );


        if (typeof showCyberToast === "function") {

            showCyberToast(
                "Review the highlighted defense rule.",
                "SECURITY REVIEW"
            );

        }

    }


    updateQuizDashboard();

}


/* ============================================================
   LIVE DASHBOARD
   ============================================================ */

function updateQuizDashboard() {

    const completed =
        completedQuizzes.size;

    const progress =
        Math.round(
            (completed / 8) * 100
        );


    const scoreText =
        document.getElementById(
            "quizScoreText"
        );

    const progressText =
        document.getElementById(
            "quizProgressText"
        );

    const progressBar =
        document.getElementById(
            "quizProgressBar"
        );

    const levelText =
        document.getElementById(
            "quizLevelText"
        );

    const statusText =
        document.getElementById(
            "quizStatusText"
        );


    if (scoreText) {

        scoreText.textContent =
            `${totalScore} PTS`;

    }


    if (progressText) {

        progressText.textContent =
            `${completed} / 8 Completed`;

    }


    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;

    }


    /* ---------- LEVEL SYSTEM ---------- */

    let level =
        "ROOKIE";


    if (totalScore >= 20) {
        level = "AWARE";
    }

    if (totalScore >= 40) {
        level = "DEFENDER";
    }

    if (totalScore >= 60) {
        level = "CYBER SENTINEL";
    }

    if (totalScore >= 80) {
        level = "SECURITY MASTER";
    }


    if (levelText) {

        levelText.textContent =
            level;

    }


    if (statusText) {

        statusText.textContent =
            completed === 8
                ? "ASSESSMENT COMPLETE"
                : "ASSESSMENT ACTIVE";

    }


    /* ---------- FINAL CERTIFICATION ---------- */

    const finalScore =
        document.getElementById(
            "quizFinalScore"
        );

    const finalCompleted =
        document.getElementById(
            "quizFinalCompleted"
        );

    const finalStatus =
        document.getElementById(
            "quizFinalStatus"
        );

    const finalMessage =
        document.getElementById(
            "quizFinalMessage"
        );

    const certification =
        document.getElementById(
            "quizCertification"
        );


    if (finalScore) {

        finalScore.textContent =
            `${totalScore} / 80`;

    }


    if (finalCompleted) {

        finalCompleted.textContent =
            `${completed} / 8`;

    }


    if (completed === 8) {

        if (certification) {

            certification.classList.add(
                "unlocked"
            );

        }


        if (finalStatus) {

            finalStatus.textContent =
                totalScore >= 70
                    ? "CERTIFIED"
                    : "COMPLETED";

        }


        if (finalMessage) {

            finalMessage.innerHTML = `
                Assessment complete.
                Your final score is
                <strong>${totalScore}/80</strong>.
                You have completed all eight
                cybersecurity awareness scenarios.
            `;

        }


        if (
            typeof showCyberToast ===
            "function"
        ) {

            showCyberToast(
                `Assessment complete: ${totalScore}/80 points.`,
                "CERTIFICATION UNLOCKED"
            );

        }

    }

}


/* ============================================================
   RESET QUIZ
   ============================================================ */

function resetVIPQuiz() {

    totalScore = 0;

    completedQuizzes =
        new Set();

    answeredQuizzes =
        new Set();


    document
        .querySelectorAll(
            ".quiz-opt-btn"
        )
        .forEach(button => {

            button.disabled = false;

            button.classList.remove(
                "locked",
                "correct-answer",
                "wrong-answer"
            );

        });


    document
        .querySelectorAll(
            ".quiz-message-box"
        )
        .forEach(feedback => {

            feedback.innerHTML = "";

            feedback.className =
                "quiz-message-box";

        });


    document
        .querySelectorAll(
            ".quiz-card"
        )
        .forEach(card => {

            card.classList.remove(
                "quiz-completed",
                "quiz-reviewed"
            );

        });


    const certification =
        document.getElementById(
            "quizCertification"
        );

    if (certification) {

        certification.classList.remove(
            "unlocked"
        );

    }


    const finalMessage =
        document.getElementById(
            "quizFinalMessage"
        );

    if (finalMessage) {

        finalMessage.textContent =
            "Complete all 8 scenarios to unlock your CyberGuard readiness result.";

    }


    updateQuizDashboard();


    const quizSection =
        document.getElementById(
            "quiz"
        );

    if (quizSection) {

        quizSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }


    if (typeof showCyberToast === "function") {

        showCyberToast(
            "Quiz assessment has been reset.",
            "ASSESSMENT RESET"
        );

    }

}


/* ---------- INITIALIZE ---------- */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateQuizDashboard();

    }
);

/* ============================================================
   CENTERED POPUP MODALS & THREAT MATRIX LOGIC (FIXED CENTER)
   ============================================================ */

const threatModalDatabase = {
    phishingModal: {
        title: "🎣 Phishing Attack Analysis",
        banner: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=700&q=80",
        desc: "Attackers duplicate real brand portals (PayPal, EasyPaisa, Google) to steal login credentials, OTPs, and session cookies.",
        tech: "Typosquatted domain registration coupled with reverse proxy frameworks (Evilginx) to intercept session cookies in real-time.",
        incident: "Fake EasyPaisa & JazzCash SMS scam links stealing user wallets via fake bonus claim portals.",
        tip: "💡 Defense Rule: Always inspect link domain names letter-by-letter and enforce hardware FIDO2 2FA security keys."
    },
    malwareModal: {
        title: "🦠 Ransomware & Malware Mechanics",
        banner: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=700&q=80",
        desc: "Ransomware weaponizes asymmetric RSA-4096 / AES-256 ciphers to lock local user filesystems and demand crypto ransoms.",
        tech: "Silently executes via dual-extension email attachments, kills backup shadow copies (vssadmin delete shadows), and encrypts network drives.",
        incident: "Hospital and regional ISP systems crippled by LockBit variants demanding Monero (XMR) ransom.",
        tip: "💡 Defense Rule: Maintain isolated air-gapped 3-2-1 offline backups and activate real-time EDR behavioral monitoring."
    },
    socialModal: {
        title: "🎭 Social Engineering Vector",
        banner: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=700&q=80",
        desc: "Coercing human targets through fabricated urgency, panic, or impersonating bank helplines and police authorities.",
        tech: "Caller ID VoIP spoofing combined with OSINT harvested from victims' public Instagram and Facebook accounts.",
        incident: "Callers claiming to be State Bank officers demanding 6-digit OTPs to stop ATM account blockages.",
        tip: "💡 Defense Rule: Establish mandatory call-back procedures on verified external numbers; never share OTPs over phone."
    },
    mitmModal: {
        title: "📡 Man-in-the-Middle (MitM) Deep Dive",
        banner: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=700&q=80",
        desc: "MitM attacks intercept unencrypted network sessions on rogue Wi-Fi or compromised routers, reading sensitive data packets in transit.",
        tech: "ARP cache poisoning and rogue Evil-Twin Wi-Fi beacons forcing SSL stripping (sslstrip) to capture plain HTTP logins.",
        incident: "Public coffee shop Wi-Fi capturing bank credentials of connected patrons via unencrypted redirects.",
        tip: "💡 Defense Rule: Always use encrypted VPNs (WireGuard) on untrusted public Wi-Fi networks and enforce HSTS preloading."
    },
    ddosModal: {
        title: "⚡ DDoS Volumetric Attack Mechanics",
        banner: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=700&q=80",
        desc: "DDoS floods target servers with massive traffic bursts from global botnets, knocking online portals offline.",
        tech: "SYN flood packet storms, UDP amplification via misconfigured NTP/DNS resolvers, and Layer-7 HTTP worker thread starvation.",
        incident: "National examination results servers knocked offline during peak registration hours.",
        tip: "💡 Defense Rule: Deploy automated Anycast scrubbing centers (Cloudflare Magic Transit) to filter malicious packet surges."
    },
   sqliModal: {
        title: "💉 SQL Injection (SQLi) Prevention",
        banner: "sqli.jpg",
        desc: "Unsanitized inputs allow attackers to run database queries directly on backend servers to alter, dump, or steal records.",
   },
    zerodayModal: {
        title: "💣 Zero-Day Exploitation Vectors",
        banner: "https://images.unsplash.com/photo-1526374870839-e155464bb9b2?auto=format&fit=crop&w=700&q=80",
        desc: "Zero-day vulnerabilities target software code gaps before software vendors are aware or issue defensive patches.",
        tech: "Weaponizing memory corruption bugs (buffer overflows, Use-After-Free) to achieve Remote Code Execution (RCE).",
        incident: "Zero-click mobile vulnerabilities (Pegasus) executing code on victim phones without any user interaction.",
        tip: "💡 Defense Rule: Enforce virtual patching via Web Application Firewalls (WAF) and isolate critical nodes."
    },
    aiDeepfakeModal: {
        title: "🤖 AI Voice & Deepfake Fraud Analysis",
        banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=700&q=80",
        desc: "Deepfake AI mimics human voices and video streams from brief sample recordings to commit social fraud.",
        tech: "Real-time voice conversion (RVC) frameworks altering vocal timbre and streaming synthetic audio into live phone calls.",
        incident: "A multinational firm lost $25M after an employee joined a deepfake video conference with synthetic executives.",
        tip: "💡 Defense Rule: Establish pre-agreed secret safe words with family members for emergency calls."
    },
    xssModal: {
        title: "🕸️ Cross-Site Scripting (XSS) Mechanics",
        banner: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=700&q=80",
        desc: "XSS attacks execute malicious client scripts in victim browsers to hijack session tokens and local storage data.",
        tech: "Stored XSS embeds malicious script tags in database comments, executing inside victim browsers upon page load.",
        incident: "Social platform account hijacking via stored comment payloads stealing authentication tokens.",
        tip: "💡 Defense Rule: Sanitize HTML output, enforce strict Content Security Policies (CSP), and set HttpOnly cookie flags."
    },
    supplyChainModal: {
        title: "📦 Supply Chain Security Guardrails",
        banner: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=700&q=80",
        desc: "Supply chain compromises slip malicious backdoors into legitimate software updates before distribution.",
        tech: "Trojanizing upstream npm/PyPI dependencies or software build pipelines, signing malicious code with valid vendor certificates.",
        incident: "SolarWinds Orion supply chain breach deploying backdoors into over 18,000 corporate and government networks.",
        tip: "💡 Defense Rule: Audit software dependencies continuously using Software Bill of Materials (SBOM) and hash locks."
    }
};

/* ============================================================
   CENTERED POPUP MODAL ENGINE (GUARANTEED DEAD CENTER & OUTSIDE GAME)
   ============================================================ */

function openThreatModal(modalKey) {
    const data = threatModalDatabase[modalKey];
    if (!data) return;

    // 1. Container check: Agar body me nahi hai to auto-create karein
    let container = document.getElementById('threatModalContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'threatModalContainer';
        document.body.appendChild(container);
    } else if (container.parentElement !== document.body) {
        // AGAR CONTAINER GAME YA KISI SECTION KE ANDAR THA, TO FORAN BODY PAR MOVE KAREIN
        document.body.appendChild(container);
    }

    // 2. Fullscreen Fixed Centered Popup Render
    container.innerHTML = `
        <div id="dynamicThreatModal" class="threat-fixed-overlay" onclick="handleThreatModalBackdrop(event)">
            <div class="threat-modal-box" onclick="event.stopPropagation()">
                <button class="threat-close-btn" type="button" onclick="closeThreatModal()" title="Close Window">&times;</button>
                
                <div class="threat-banner-container">
                    <img src="${data.banner}" alt="${data.title}" class="threat-banner-img">
                    <div class="threat-banner-gradient"></div>
                    <span class="threat-banner-badge">FORENSIC THREAT VECTOR</span>
                </div>
                
                <h2 class="threat-modal-title">${data.title}</h2>
                <div class="threat-modal-divider"></div>
                
                <div class="threat-modal-grid">
                    <div class="threat-modal-item">
                        <strong class="label-green">⚡ THREAT OVERVIEW:</strong>
                        <p>${data.desc}</p>
                    </div>
                    <div class="threat-modal-item">
                        <strong class="label-blue">⚙️ TECHNICAL MECHANISM:</strong>
                        <p>${data.tech}</p>
                    </div>
                    <div class="threat-modal-item">
                        <strong class="label-amber">🚨 REGIONAL ATTACK PRECEDENT:</strong>
                        <p>${data.incident}</p>
                    </div>
                </div>
                
                <div class="threat-modal-tip">
                    ${data.tip}
                </div>
                
                <div class="threat-modal-footer">
                    <button type="button" class="threat-btn-dismiss" onclick="closeThreatModal()">Close Forensic Brief</button>
                </div>
            </div>
        </div>
    `;

    document.body.style.overflow = 'hidden';
}

function closeThreatModal() {
    const container = document.getElementById('threatModalContainer');
    if (container) container.innerHTML = '';
    document.body.style.overflow = '';
}

function handleThreatModalBackdrop(e) {
    if (e.target && (e.target.classList.contains('threat-fixed-overlay') || e.target.classList.contains('modal'))) {
        closeThreatModal();
    }
}

// Global modal center fix for emergency and other modals
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ESC Key listener to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeThreatModal();
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(m => closeModal(m.id));
    }
});
/* ==========================================================================
   CYBER DEFENSE SIMULATOR - 5 UPGRADED GAMES ENGINE
   Features: Start/End Protocol, 2-Sec Radar Loaders, Diagnostic Tools, Score Limits
   ========================================================================== */

const cyberGamesConfig = {
    1: {
        name: "Mobile Wallet Defense (EasyPaisa & JazzCash)",
        logo: "💸",
        goal: "Protect EasyPaisa & JazzCash against fake SMS & accidental transfer scams.",
        rule: "Never trust SMS headers. Always verify balance directly in official app.",
        maxScore: 300,
        specialOutput: "📱 REAL APP QUERY: Balance: Rs. 142.50. Incoming transactions: 0. SMS is 100% SPOOFED!",
        scenarios: [
            {
                title: "Level 1: The 'Accidental' Rs. 25,000 Credit SMS",
                desc: "You receive an SMS from 'EASY-PAY': 'Rs. 25,000 credited to your account by mistake. Please refund immediately to 0300-1234567 or legal action will be initiated.' A frantic caller rings your phone crying.",
                target: "Wallet Balance",
                severity: "HIGH",
                options: [
                    { text: "Transfer Rs. 25,000 back to caller immediately", correct: false, feedback: "🚨 COMPROMISED: You lost Rs. 25,000 of your OWN money! Fake SMS headers cost victims millions." },
                    { text: "Open official EasyPaisa/JazzCash app directly and verify actual balance", correct: true, feedback: "✅ DEFENSE SUCCESS: Actual balance is unchanged! You avoided a classic fake SMS refund fraud." },
                    { text: "Send half (Rs. 12,500) as a goodwill compromise", correct: false, feedback: "🚨 COMPROMISED: Scammers exploit emotional sympathy tricks. You still lost your funds." }
                ]
            },
            {
                title: "Level 2: Urgent 4-Digit Security 'Sync' OTP",
                desc: "A polite caller claiming to be 'State Bank Helpline' says: 'Your account is under attack! Quickly read the 4-digit verification code SMS sent to you right now to freeze unauthorized access.'",
                target: "Master PIN / OTP",
                severity: "CRITICAL",
                options: [
                    { text: "Read the 4-digit code so officer can protect account", correct: false, feedback: "🚨 CRITICAL BREACH: Official helplines NEVER ask for secret OTPs over the phone!" },
                    { text: "Hang up immediately and call official helpline (3737 / 4444) directly", correct: true, feedback: "✅ DEFENSE SUCCESS: Perfect protocol! Helplines never ask for OTPs or PINs over calls." }
                ]
            },
            {
                title: "Level 3: Fake Edited Bank Transfer Screenshot",
                desc: "An online marketplace buyer sends a WhatsApp screenshot showing 'Payment of Rs. 40,000 Sent Successfully' demanding you dispatch goods via courier immediately before bank closure.",
                target: "E-Commerce Goods",
                severity: "HIGH",
                options: [
                    { text: "Dispatch goods based on the valid transaction ID & stamp in photo", correct: false, feedback: "🚨 COMPROMISED: Screenshots can be fabricated in 60 seconds with mobile editing apps!" },
                    { text: "Wait until verified bank credit notification reflects inside official app", correct: true, feedback: "✅ DEFENSE SUCCESS: Outstanding security discipline! Never ship before confirmed credit." }
                ]
            }
        ]
    },
    2: {
        name: "AI Voice Clone & Deepfake Audio Defense",
        logo: "🎙️",
        goal: "Detect neural audio deepfakes and emergency extortion calls.",
        rule: "Always disconnect immediately and call back directly on family's known line.",
        maxScore: 300,
        specialOutput: "🔊 SPECTROGRAM TELEMETRY: Missing natural vocal breathing. Jitter spikes at 4.2 kHz. Synthesized deepfake model confirmed!",
        scenarios: [
            {
                title: "Level 1: The Distressed Hospital Emergency Call",
                desc: "You get a call from an unknown number. The voice is an exact acoustic clone of your brother crying: 'Bhai, I had a fatal accident! Police are arresting me, send Rs. 60,000 now!'",
                target: "Emergency Cash",
                severity: "CRITICAL",
                options: [
                    { text: "Rush and transfer funds immediately to save brother", correct: false, feedback: "🚨 SCAM TRIGGERED: Modern generative AI can clone any voice from a 3-second social media clip!" },
                    { text: "Hang up immediately and dial brother's direct personal number", correct: true, feedback: "✅ THREAT NEUTRALIZED: You called his real number; your brother is sitting safely at home!" }
                ]
            }
        ]
    },
    3: {
        name: "WhatsApp APK Malware & Spyware Shield",
        logo: "📲",
        goal: "Stop Trojan droppers and malicious accessibility service APKs.",
        rule: "Never install .apk files received via WhatsApp or unknown links.",
        maxScore: 300,
        specialOutput: "🔍 ANDROID MANIFEST EXPLOIT: Requested permissions: READ_SMS, RECORD_AUDIO, ACCESSIBILITY_SERVICE. Spyware confirmed!",
        scenarios: [
            {
                title: "Level 1: '50% Electricity Bill Discount' Package",
                desc: "A WhatsApp contact shares a file: 'Electricity_Discount_v4.apk' claiming: 'Install this official govt app to get 50% discount on your electricity bill.'",
                target: "Device Privileges",
                severity: "HIGH",
                options: [
                    { text: "Install APK package to check if discount voucher works", correct: false, feedback: "🚨 DEVICE COMPROMISED: The APK installed an SMS-forwarder trojan that steals banking OTPs!" },
                    { text: "Delete file, block sender, and warn group members", correct: true, feedback: "✅ DEFENSE SUCCESS: You prevented mobile compromise and shielded your whole group." }
                ]
            }
        ]
    },
    4: {
        name: "Scan QR Pay Deception Analyzer",
        logo: "🔍",
        goal: "Expose fraudulent reverse-payment QR traps and malicious quishing codes.",
        rule: "Scanning a QR code and entering your PIN ALWAYS debits (deducts) funds!",
        maxScore: 300,
        specialOutput: "📱 DECODED QR PAYLOAD: 'upi://pay?pa=scam_vault@bank&am=15000&action=DEBIT'. Scanning will DEDUCT Rs. 15,000!",
        scenarios: [
            {
                title: "Level 1: OLX Buyer 'Scan QR to Receive Money' Trap",
                desc: "An online buyer messages: 'Scan this QR code in your JazzCash app and enter your MPIN to credit the Rs. 15,000 advance payment into your wallet.'",
                target: "Outgoing Money",
                severity: "HIGH",
                options: [
                    { text: "Scan QR code and enter MPIN to receive payment", correct: false, feedback: "🚨 FUNDS DEDUCTED: Entering your PIN after scanning a QR code is an OUTGOING PAYMENT authorization!" },
                    { text: "Refuse request; explain scanning QR never receives money", correct: true, feedback: "✅ DEFENSE SUCCESS: Spot-on! You neutralized the #1 online marketplace scam in the subcontinent." }
                ]
            }
        ]
    },
    5: {
        name: "ATM Hardware Skimmer Inspector",
        logo: "💳",
        goal: "Identify physical hardware overlays and hidden pinhole camera lenses.",
        rule: "Wiggle the card reader before inserting. Cover the keypad with your free hand.",
        maxScore: 300,
        specialOutput: "🖐️ WIGGLE TEST FAILED: Card slot bezel detached with 2mm displacement. 3M adhesive tape and skimmer head exposed!",
        scenarios: [
            {
                title: "Level 1: The Wobbly Card Bezel with Glue Seams",
                desc: "Before inserting your debit card at an ATM, you touch the green plastic card bezel. It wobbles loosely and has sticky tape residue along the edge.",
                target: "Magnetic Track Data",
                severity: "CRITICAL",
                options: [
                    { text: "Push card through firmly anyway and enter PIN quickly", correct: false, feedback: "🚨 CARD CLONED: The loose bezel was an external magnetic skimmer that copied your card!" },
                    { text: "Do not insert card. Notify bank guard or customer helpline immediately", correct: true, feedback: "✅ DEFENSE SUCCESS: Standard ATM rule! Legitimate bank ATM components are never loose or glued." }
                ]
            }
        ]
    }
};

let currentCyberGameId = 1;
let currentScenarioIdx = 0;
let currentScore = 0;
let currentStreak = 0;
let isAnswerLocked = false;

// 1. Switch Game Tabs
function switchCyberGame(gameId) {
    currentCyberGameId = gameId;
    currentScenarioIdx = 0;
    currentScore = 0;
    currentStreak = 0;

    // Update active tab buttons
    const tabs = document.querySelectorAll('.game-tab-btn');
    tabs.forEach((tab, idx) => {
        tab.classList.toggle('active', idx + 1 === gameId);
    });

    const game = cyberGamesConfig[gameId];
    if (!game) return;

    // Set Briefing Info
    const bLogo = document.getElementById('briefingLogo');
    const bName = document.getElementById('briefingName');
    const bGoal = document.getElementById('briefingGoal');
    const bRule = document.getElementById('briefingRule');
    const bCap = document.getElementById('briefingScoreCap');

    if (bLogo) bLogo.innerText = game.logo;
    if (bName) bName.innerText = game.name;
    if (bGoal) bGoal.innerText = game.goal;
    if (bRule) bRule.innerText = game.rule;
    if (bCap) bCap.innerText = game.maxScore + " PTS MAX";

    // Show Briefing Screen first
    showScreen('gameBriefingScreen');
}

// 2. Trigger Start Game with 2-Second Loader
function triggerStartGame() {
    runRadarLoader("INITIALIZING SOC DEFENSE SANDBOX...", () => {
        showScreen('gamePlayScreen');
        loadCyberLevel(currentCyberGameId, currentScenarioIdx);
    });
}

// 3. Trigger End Game with 2-Second Loader
function triggerEndGame() {
    runRadarLoader("FINALIZING THREAT DEFENSE CERTIFICATE...", () => {
        showScreen('gameEndScreen');
        const endScore = document.getElementById('endScoreDisplay');
        const endRank = document.getElementById('endRankDisplay');
        if (endScore) endScore.innerText = currentScore + " / 300 PTS";
        
        let rank = "Rookie Defense Analyst";
        if (currentScore >= 280) rank = "Master Cyber Sentinel (Elite v5.0)";
        else if (currentScore >= 180) rank = "SOC Incident Responder";
        else if (currentScore >= 100) rank = "Cyber Threat Hunter";
        
        if (endRank) endRank.innerText = rank;
    });
}

// 2-Second Radar Loader Helper
function runRadarLoader(text, callback) {
    const loader = document.getElementById('gameLoaderOverlay');
    const loaderText = document.getElementById('loaderText');
    const bar = document.getElementById('loaderProgressBar');
    
    if (loader) loader.classList.add('active');
    if (loaderText) loaderText.innerText = text;
    if (bar) bar.style.width = '0%';

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        if (bar) bar.style.width = progress + '%';
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                if (loader) loader.classList.remove('active');
                if (callback) callback();
            }, 100);
        }
    }, 100); // 20 steps * 100ms = 2000ms (2 seconds)
}

// Show specific game screen
function showScreen(screenId) {
    const screens = ['gameBriefingScreen', 'gamePlayScreen', 'gameEndScreen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === screenId);
    });
}

function shuffleCyberOptions(options) {
    const shuffled = [...options];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
}

// Load Scenario Content
function loadCyberLevel(gameId, levelIdx) {
    isAnswerLocked = false;
    const game = cyberGamesConfig[gameId];
    if (!game) return;

    const scenario = game.scenarios[levelIdx];
    if (!scenario) return;

    document.getElementById('currentGameLogo').innerText = game.logo;
    document.getElementById('currentGameName').innerText = game.name;
    document.getElementById('gameScore').innerText = currentScore;
    document.getElementById('gameStreak').innerText = currentStreak > 0 ? "x" + currentStreak : "0";
    document.getElementById('gameLevelDisplay').innerText = (levelIdx + 1) + " / " + game.scenarios.length;
    document.getElementById('gameTargetDisplay').innerText = scenario.target;
    document.getElementById('gameSeverityDisplay').innerText = scenario.severity;

    document.getElementById('scenarioTitle').innerText = scenario.title;
    document.getElementById('scenarioDesc').innerText = scenario.desc;
    document.getElementById('gameFeedback').innerText = "";
    document.getElementById('gameFeedback').className = "game-feedback";

    // Hide special diagnostic tool result
    const specResult = document.getElementById('specialToolResult');
    if (specResult) specResult.classList.remove('active');

    // Build Options Buttons
    const optContainer = document.getElementById('gameOptions');
    optContainer.innerHTML = "";

    shuffleCyberOptions(scenario.options).forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "btn-primary-small";
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.style.margin = "6px 0";
        btn.style.display = "block";
        btn.innerHTML = "<strong>[" + (idx + 1) + "]</strong> " + opt.text;
        btn.onclick = () => selectCyberOption(opt, idx);
        optContainer.appendChild(btn);
    });
}

function selectCyberOption(opt, idx) {
    if (isAnswerLocked) return;
    isAnswerLocked = true;

    const feedbackEl = document.getElementById('gameFeedback');
    feedbackEl.innerText = opt.feedback;

    if (opt.correct) {
        feedbackEl.className = "game-feedback success";
        currentStreak++;
        const points = 100 + (currentStreak * 10);
        currentScore = Math.min(300, currentScore + points);
        document.getElementById('gameScore').innerText = currentScore;
        document.getElementById('gameStreak').innerText = "x" + currentStreak;

        // Auto move to next scenario or trigger end screen
        setTimeout(() => {
            const game = cyberGamesConfig[currentCyberGameId];
            if (currentScenarioIdx + 1 < game.scenarios.length) {
                currentScenarioIdx++;
                loadCyberLevel(currentCyberGameId, currentScenarioIdx);
            } else {
                triggerEndGame();
            }
        }, 2200);
    } else {
        feedbackEl.className = "game-feedback error";
        currentStreak = 0;
        currentScore = Math.max(0, currentScore - 30);
        document.getElementById('gameScore').innerText = currentScore;
        document.getElementById('gameStreak').innerText = "0";
    }
}

function triggerSpecialTool() {
    const game = cyberGamesConfig[currentCyberGameId];
    const specResult = document.getElementById('specialToolResult');
    if (specResult && game) {
        specResult.innerText = game.specialOutput;
        specResult.classList.add('active');
    }
}

function resetCurrentGame() {
    currentScenarioIdx = 0;
    currentScore = 0;
    currentStreak = 0;
    loadCyberLevel(currentCyberGameId, currentScenarioIdx);
}

function nextGameId() {
    return (currentCyberGameId % 5) + 1;
}

// Auto init on page load
window.addEventListener('DOMContentLoaded', () => {
    switchCyberGame(1);
});

/* =========================================================
   CYBERGUARD VVIP SCAM SHIELD ENGINE
   ========================================================= */

(function () {
    "use strict";

    const scamIntelFeed = [

        {
            title: "Social-Media Scam Network Alert",
            description:
                "Recent reporting from Singapore highlights large-scale disruption of scam-linked Facebook and Instagram entities. Impersonation, fake investment schemes and fake goods remain important social-engineering vectors.",
            region: "SINGAPORE / SOCIAL MEDIA",
            date: "SEP 2026",
            level: "HIGH"
        },

        {
            title: "Online Investment Fraud Network",
            description:
                "A recent Bengaluru investigation uncovered a large online investment-fraud network involving hundreds of mule bank accounts and cross-border movement of fraudulent funds.",
            region: "INDIA / INVESTMENT",
            date: "SEP 2026",
            level: "CRITICAL"
        },

        {
            title: "QR Payment Scam Warning",
            description:
                "QR codes can be abused to redirect victims to fraudulent payment or credential-harvesting pages. Never assume that scanning a QR code is automatically safe.",
            region: "GLOBAL / QR PHISHING",
            date: "SEP 2026",
            level: "HIGH"
        },

        {
            title: "Fake Social-Commerce Advertisements",
            description:
                "Scammers continue using social-media advertisements to imitate legitimate brands, offer unrealistic discounts and redirect users toward fraudulent stores or payment pages.",
            region: "GLOBAL / SOCIAL COMMERCE",
            date: "2026",
            level: "HIGH"
        },

        {
            title: "AI-Enhanced Fraud Monitoring",
            description:
                "Global cybercrime reporting continues to highlight the use of AI, impersonation and social engineering to make fraudulent campaigns more convincing and scalable.",
            region: "GLOBAL / AI FRAUD",
            date: "2026",
            level: "CRITICAL"
        },

        {
            title: "Impersonation Scam Pattern",
            description:
                "Unexpected callers, messages and fake support agents may create urgency and request credentials, payments or remote access. Verify independently before taking action.",
            region: "GLOBAL / IMPERSONATION",
            date: "2026",
            level: "HIGH"
        }

    ];


    let currentIntelIndex = 0;


    function updateScamIntelFeed() {

        const item = scamIntelFeed[currentIntelIndex];

        const title = document.getElementById("scamFeedTitle");
        const description = document.getElementById("scamFeedDescription");
        const region = document.getElementById("scamFeedRegion");
        const date = document.getElementById("scamFeedDate");
        const level = document.getElementById("scamFeedLevel");

        if (!title || !description || !region || !date || !level) {
            return;
        }


        const content = document.querySelector(".intel-feed-content");

        if (content) {
            content.classList.remove("intel-refresh");

            void content.offsetWidth;

            content.classList.add("intel-refresh");
        }


        title.textContent = item.title;
        description.textContent = item.description;
        region.textContent = item.region;
        date.textContent = item.date;
        level.textContent = item.level;


        level.style.color =
            item.level === "CRITICAL"
                ? "#ff3366"
                : "#ffb703";


        currentIntelIndex =
            (currentIntelIndex + 1) %
            scamIntelFeed.length;
    }


    function updateScamClock() {

        const clock =
            document.getElementById("scamFeedClock");

        if (!clock) return;

        const now = new Date();

        const time =
            now.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );

        clock.textContent =
            "LAST SYNC " + time;
    }


    function initScamIntelFeed() {

        updateScamIntelFeed();
        updateScamClock();

        setInterval(
            updateScamIntelFeed,
            7000
        );

        setInterval(
            updateScamClock,
            1000
        );
    }


    /* =====================================================
       SEARCH + CATEGORY FILTER
       ===================================================== */

    function initScamFilters() {

        const search =
            document.getElementById("scamSearch");

        const filterButtons =
            document.querySelectorAll(".scam-filter");

        const scamCards =
            document.querySelectorAll(
                ".vvip-scam-card, .recent-scam-card"
            );


        let activeFilter = "all";


                const recentGrid =
            document.querySelector(".recent-scam-grid");

        const vvipGrid =
            document.querySelector(".vvip-scam-grid");

        const recentNoResults =
            document.getElementById("recentScamNoResults");

        const vvipNoResults =
            document.getElementById("vvipScamNoResults");


        function applyScamFilter() {

            const query =
                (search?.value || "")
                    .trim()
                    .toLowerCase();

            let recentVisible = 0;
            let vvipVisible = 0;


            scamCards.forEach(card => {

                const text =
                    card.textContent.toLowerCase();

                const categories =
                    (
                        card.dataset.category ||
                        ""
                    ).toLowerCase();


                const matchesSearch =
                    !query ||
                    text.includes(query);


                const matchesFilter =
                    activeFilter === "all" ||
                    categories.includes(activeFilter);


                const isVisible =
                    matchesSearch &&
                    matchesFilter;


                if (isVisible) {

                    card.classList.remove(
                        "scam-filter-hidden"
                    );

                    card.style.position = "";

                    if (recentGrid && recentGrid.contains(card)) {
                        recentVisible++;
                    }

                    if (vvipGrid && vvipGrid.contains(card)) {
                        vvipVisible++;
                    }

                } else {

                    card.classList.add(
                        "scam-filter-hidden"
                    );

                }

            });


            if (recentNoResults) {
                recentNoResults.style.display =
                    recentVisible === 0 ? "block" : "none";
            }

            if (vvipNoResults) {
                vvipNoResults.style.display =
                    vvipVisible === 0 ? "block" : "none";
            }

        }


        filterButtons.forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    filterButtons.forEach(btn => {
                        btn.classList.remove("active");
                    });

                    this.classList.add("active");

                    activeFilter =
                        this.dataset.filter ||
                        "all";

                    applyScamFilter();

                }
            );

        });


        if (search) {

            search.addEventListener(
                "input",
                applyScamFilter
            );

        }

    }


    /* =====================================================
       LIVE STATUS COUNTER
       ===================================================== */

    function animateScamCounter() {

        const counter =
            document.getElementById(
                "scamActiveCount"
            );

        if (!counter) return;


        let current = 0;

        const target = 6;


        const timer =
            setInterval(() => {

                current++;

                counter.textContent =
                    String(current).padStart(2, "0");


                if (current >= target) {
                    clearInterval(timer);
                }

            }, 120);

    }


    /* =====================================================
       CARD HOVER GLOW
       ===================================================== */

    function initScamCardGlow() {

        const cards =
            document.querySelectorAll(
                ".vvip-scam-card, .recent-scam-card"
            );


        cards.forEach(card => {

            card.addEventListener(
                "pointermove",
                function (event) {

                    const rect =
                        card.getBoundingClientRect();

                    const x =
                        event.clientX -
                        rect.left;

                    const y =
                        event.clientY -
                        rect.top;


                    card.style.setProperty(
                        "--mouse-x",
                        x + "px"
                    );

                    card.style.setProperty(
                        "--mouse-y",
                        y + "px"
                    );

                }
            );

        });

    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initScamIntelFeed();
            initScamFilters();
            animateScamCounter();
            initScamCardGlow();

        }
    );

})();
/* =========================================================
   BACKGROUND AUDIO CONTROL ENGINE
   ========================================================= */
const CYBER_AUDIO_STATE_KEY = 'cyberguard_audio_state';
const CYBER_AUDIO_POSITION_KEY = 'cyberguard_audio_position';

function saveCyberAudioPosition(audio) {
    if (audio && Number.isFinite(audio.currentTime)) {
        localStorage.setItem(CYBER_AUDIO_POSITION_KEY, String(audio.currentTime));
    }
}

function restoreCyberAudioPosition(audio) {
    const savedPosition = Number(localStorage.getItem(CYBER_AUDIO_POSITION_KEY));
    if (Number.isFinite(savedPosition) && savedPosition > 0) {
        audio.currentTime = savedPosition;
    }
}

function syncCyberAudioUi() {
    const btn = document.getElementById('cyberAudioBtn');
    const icon = document.getElementById('audioBtnIcon');
    const text = document.getElementById('audioBtnText');
    const audio = document.getElementById('bgAudio');
    const isPlaying = audio ? !audio.paused && !audio.ended : localStorage.getItem(CYBER_AUDIO_STATE_KEY) === 'playing';
    const hasSavedPosition = Number(localStorage.getItem(CYBER_AUDIO_POSITION_KEY)) > 0;

    if (audio) {
        audio.loop = true;
    }

    if (btn) {
        btn.classList.toggle('playing', isPlaying);
        btn.classList.toggle('paused', !isPlaying);
        btn.title = isPlaying ? 'Pause Background Sound' : 'Play or resume Background Sound';
    }

    if (icon) {
        icon.textContent = isPlaying ? '🔊' : '▶️';
    }

    if (text) {
        text.textContent = isPlaying ? 'Pause Sound' : hasSavedPosition ? 'Resume Sound' : 'Play Sound';
    }
}

function toggleCyberAudio() {
    const audio = document.getElementById('bgAudio');

    if (!audio) return;

    audio.loop = true;

    if (!audio.paused && !audio.ended) {
        saveCyberAudioPosition(audio);
        audio.pause();
    } else {
        if (audio.readyState >= 1) {
            restoreCyberAudioPosition(audio);
        }
        audio.play().catch(() => {
            localStorage.setItem(CYBER_AUDIO_STATE_KEY, 'paused');
            syncCyberAudioUi();
            console.warn('Background audio could not play.');
        });
    }

    syncCyberAudioUi();
}

function startCyberAudioFromBeginning() {
    const audio = document.getElementById('bgAudio');
    if (!audio) return;

    audio.loop = true;
    localStorage.setItem(CYBER_AUDIO_POSITION_KEY, '0');
    if (audio.readyState >= 1) {
        audio.currentTime = 0;
    }

    audio.play().catch(() => {
        localStorage.setItem(CYBER_AUDIO_STATE_KEY, 'paused');
        syncCyberAudioUi();
        console.warn('Background audio could not play.');
    });
    syncCyberAudioUi();
}

window.addEventListener('storage', (event) => {
    if (event.key === CYBER_AUDIO_STATE_KEY) {
        syncCyberAudioUi();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('bgAudio');
    if (audio) {
        audio.loop = true;
        audio.addEventListener('loadedmetadata', () => restoreCyberAudioPosition(audio), { once: true });
        audio.addEventListener('timeupdate', () => saveCyberAudioPosition(audio));
        audio.addEventListener('play', () => {
            localStorage.setItem(CYBER_AUDIO_STATE_KEY, 'playing');
            syncCyberAudioUi();
        });
        audio.addEventListener('pause', () => {
            saveCyberAudioPosition(audio);
            localStorage.setItem(CYBER_AUDIO_STATE_KEY, 'paused');
            syncCyberAudioUi();
        });
        window.addEventListener('pagehide', () => saveCyberAudioPosition(audio));

        if (audio.readyState >= 1) {
            restoreCyberAudioPosition(audio);
        }
        if (localStorage.getItem(CYBER_AUDIO_STATE_KEY) === 'playing') {
            audio.play().catch(() => {});
        }
    }
    syncCyberAudioUi();
});

/* ============================================================
   CYBERGUARD // VVIP LIVE COMMUNITY FEEDBACK & ADMIN ENGINE
   ============================================================ */

const FIREBASE_RTDB_URL = "https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/feedbacks.json";
const USER_SUBMITTED_FLAG_KEY = "cyberguard_user_has_submitted_v1";
const ADMIN_FEEDBACK_COUNT_KEY = "cyberguard_admin_feedback_count_v1";
const DELETED_IDS_STORAGE_KEY = "cyberguard_deleted_ids_v1";
const OWNER_WHATSAPP_NUMBER = "923262116352"; // 0326-2116352

let currentSelectedRating = 5;
let currentFeedbackList = [];
let activeFeedbackCategory = "All";
let isAdminLoggedIn = false;
let isPostAsAdminActive = false;

// 1. Initial Verified Community Seeds
const SEED_FEEDBACKS = [
    {
        id: "seed-1",
        name: "Tariq Javed Khan",
        role: "Cybersecurity Analyst",
        rating: 5,
        category: "Scam Shield",
        mood: "🛡️ Super Secure",
        message: "EasyPaisa aur JazzCash ka scam detection suite bohot zabardast ha! Fake SMS identify karna ab bohot aasan ho gaya ha. Very well done! 🔥💯",
        createdAt: Date.now() - 3600000,
        reactions: { helpful: 45, fire: 32, love: 28, shield: 50 },
        verified: true,
        adminEmoji: { emoji: "🔥", adminName: "Hafiz Abdul Moiz" }
    },
    {
        id: "seed-2",
        name: "Ayesha Noor",
        role: "Fintech Researcher",
        rating: 5,
        category: "Threat Matrix",
        mood: "🤩 Loved It",
        message: "Phishing aur APK malware ke interactive sandbox labs bohot helpful hain. Hands-on learning ka tareeqa behtareen ha! ❤️🚀",
        createdAt: Date.now() - 7200000,
        reactions: { helpful: 29, fire: 40, love: 35, shield: 26 },
        verified: true
    }
];

// Helper: Get Deleted IDs Set
function getDeletedFeedbackIds() {
    try {
        const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveDeletedFeedbackId(id) {
    try {
        const set = getDeletedFeedbackIds();
        set.add(id);
        localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
        console.warn(e);
    }
}

// 2. Form Visibility & Limits Evaluator
function evaluateFormVisibility() {
    const userSubmittedCard = document.getElementById("userSubmittedCard");
    const adminLimitCard = document.getElementById("adminLimitCard");
    const formFields = document.getElementById("formFieldsContainer");
    const adminEditGrid = document.getElementById("adminEditButtonsGrid");

    if (isAdminLoggedIn) {
        // Admin Mode: Check Admin limit of 2 feedbacks
        const adminPosts = currentFeedbackList.filter(f => f.isAdmin || (f.name && f.name.includes("Hafiz Abdul Moiz")));
        if (adminPosts.length >= 2) {
            // Admin limit (2) reached: Hide form and show Edit Buttons
            if (formFields) formFields.style.display = "none";
            if (userSubmittedCard) userSubmittedCard.style.display = "none";
            if (adminLimitCard) adminLimitCard.style.display = "block";

            if (adminEditGrid) {
                adminEditGrid.innerHTML = adminPosts.map((post, idx) => `
                    <button type="button" class="btn-edit-founder-fb" onclick="editAdminFeedback('${post.id}')">
                        ✏️ Edit Founder Feedback #${idx + 1} (${escapeHtml(post.category)})
                    </button>
                `).join("");
            }
            return;
        } else {
            // Admin has not reached 2 feedbacks yet
            if (adminLimitCard) adminLimitCard.style.display = "none";
            if (userSubmittedCard) userSubmittedCard.style.display = "none";
            if (formFields) formFields.style.display = "block";
            return;
        }
    }

    // Normal User Mode: Single Submission check
    const userHasSubmitted = localStorage.getItem(USER_SUBMITTED_FLAG_KEY) === "true";
    if (userHasSubmitted) {
        // Form gayab! Show submission confirmation
        if (formFields) formFields.style.display = "none";
        if (adminLimitCard) adminLimitCard.style.display = "none";
        if (userSubmittedCard) userSubmittedCard.style.display = "block";
    } else {
        // User has not submitted: Form visible
        if (userSubmittedCard) userSubmittedCard.style.display = "none";
        if (adminLimitCard) adminLimitCard.style.display = "none";
        if (formFields) formFields.style.display = "block";
    }
}

// 3. Admin Login Modal Open / Close
function openAdminPassModal() {
    if (isAdminLoggedIn) {
        logoutAdminMode();
        return;
    }
    const modal = document.getElementById("adminPassModal");
    if (modal) {
        modal.style.display = "flex";
        const input = document.getElementById("adminPassInput");
        if (input) {
            input.value = "";
            input.focus();
        }
    }
}

function closeAdminPassModal() {
    const modal = document.getElementById("adminPassModal");
    if (modal) modal.style.display = "none";
}

function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const input = document.getElementById("adminPassInput");
    const err = document.getElementById("adminPassError");
    if (!input) return;

    if (input.value.trim() === "Fba@125") {
        isAdminLoggedIn = true;
        isPostAsAdminActive = true;
        closeAdminPassModal();
        updateAdminUIState();
        renderFeedbackCards();
        evaluateFormVisibility();
        alert("👑 Welcome Admin! Hafiz Abdul Moiz access unlocked .");
    } else {
        if (err) {
            err.textContent = "🚨 Incorrect password. Please try again";
            err.style.display = "block";
        }
    }
}

function logoutAdminMode() {
    isAdminLoggedIn = false;
    isPostAsAdminActive = false;
    updateAdminUIState();
    renderFeedbackCards();
    evaluateFormVisibility();
}

function updateAdminUIState() {
    const btn = document.getElementById("adminPortalBtn");
    const icon = document.getElementById("adminBtnIcon");
    const text = document.getElementById("adminBtnText");
    const banner = document.getElementById("adminActiveBanner");
    const toggleRow = document.getElementById("adminPostToggleRow");
    const nameInput = document.getElementById("fbInputName");
    const roleInput = document.getElementById("fbInputRole");
    const formBox = document.getElementById("feedbackFormBox");
    const submitBtn = document.getElementById("fbSubmitBtn");

    if (isAdminLoggedIn) {
        if (btn) btn.classList.add("admin-unlocked");
        if (icon) icon.textContent = "👑";
        if (text) text.textContent = "ADMIN ACTIVE ";
        if (banner) banner.style.display = "flex";
        if (toggleRow) toggleRow.style.display = "flex";
        if (formBox) formBox.classList.add("admin-mode-active");
        if (nameInput) nameInput.value = "Hafiz Abdul Moiz";
        if (roleInput) roleInput.value = "Project Founder & SOC Lead";
        if (submitBtn) {
            submitBtn.classList.add("btn-founder-theme");
            submitBtn.innerHTML = "<span>👑 Submit Your Feedback (Founder)</span>";
        }
    } else {
        if (btn) btn.classList.remove("admin-unlocked");
        if (icon) icon.textContent = "🔒";
        if (text) text.textContent = "Admin Login ";
        if (banner) banner.style.display = "none";
        if (toggleRow) toggleRow.style.display = "none";
        if (formBox) formBox.classList.remove("admin-mode-active");
        if (nameInput) nameInput.value = "";
        if (roleInput) roleInput.value = "";
        if (submitBtn) {
            submitBtn.classList.remove("btn-founder-theme");
            submitBtn.innerHTML = "<span>🚀 Submit Your Feedback</span>";
        }
    }
}

function togglePostAsAdmin() {
    isPostAsAdminActive = !isPostAsAdminActive;
    const btn = document.getElementById("btnAdminModeToggle");
    const nameInput = document.getElementById("fbInputName");
    const roleInput = document.getElementById("fbInputRole");

    if (btn) {
        btn.textContent = isPostAsAdminActive ? "👑 ADMIN MODE ON (Limit: 2)" : "👤 Normal Mode";
    }
    if (isPostAsAdminActive) {
        if (nameInput) nameInput.value = "Hafiz Abdul Moiz";
        if (roleInput) roleInput.value = "Project Founder & SOC Lead";
    } else {
        if (nameInput) nameInput.value = "";
        if (roleInput) roleInput.value = "";
    }
}

// 4. Star Rating
function setStarRating(stars) {
    currentSelectedRating = stars;
    document.querySelectorAll(".star-btn").forEach((btn, idx) => {
        btn.classList.toggle("active", idx < stars);
    });
    const label = document.getElementById("fbRatingLabel");
    if (label) {
        const descriptions = {
            5: "⭐⭐⭐⭐⭐ 5.0 VVIP Masterpiece!",
            4: "⭐⭐⭐⭐ 4.0 Excellent Security Portal",
            3: "⭐⭐⭐ 3.0 Good Experience",
            2: "⭐⭐ 2.0 Needs Improvement",
            1: "⭐ 1.0 Critical Issues"
        };
        label.textContent = descriptions[stars] || "⭐⭐⭐⭐⭐ 5.0 VVIP Masterpiece!";
    }
}

// 5. Emojis Insert
function insertFeedbackEmoji(emoji) {
    const textarea = document.getElementById("fbInputMessage");
    if (!textarea) return;
    textarea.value = textarea.value + (textarea.value.endsWith(" ") || textarea.value.length === 0 ? "" : " ") + emoji + " ";
    textarea.focus();
    updateFbCharCount();
}

function updateFbCharCount() {
    const textarea = document.getElementById("fbInputMessage");
    const count = document.getElementById("fbCharCount");
    if (textarea && count) count.textContent = `${textarea.value.length} / 1000 chars`;
}

// 6. Fetch from Firebase Realtime Database
async function fetchLiveFeedbacks() {
    const deleted = getDeletedFeedbackIds();
    try {
        const res = await fetch(FIREBASE_RTDB_URL);
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") {
                const remote = Object.keys(data)
                    .filter(key => !deleted.has(key))
                    .map(key => ({ id: key, ...data[key] }));
                
                const map = new Map();
                SEED_FEEDBACKS.forEach(s => {
                    if (!deleted.has(s.id)) map.set(s.id, s);
                });
                remote.forEach(r => map.set(r.id, r));
                currentFeedbackList = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            }
        }
    } catch (e) {
        console.warn("Fetch fallback:", e);
    }

    if (currentFeedbackList.length === 0) {
        currentFeedbackList = SEED_FEEDBACKS.filter(s => !deleted.has(s.id));
    }

    renderFeedbackCards();
    updateFeedbackStats();
    evaluateFormVisibility();
}

// 7. Render Feedback Cards
function renderFeedbackCards() {
    const container = document.getElementById("feedbackCardsList");
    if (!container) return;

    const query = (document.getElementById("fbSearchInput")?.value || "").toLowerCase().trim();
    const deleted = getDeletedFeedbackIds();

    const filtered = currentFeedbackList
        .filter(item => !deleted.has(item.id))
        .filter(item => {
            const matchCat = activeFeedbackCategory === "All" || item.category === activeFeedbackCategory;
            const matchQ = !query ||
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.message && item.message.toLowerCase().includes(query));
            return matchCat && matchQ;
        });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; background: rgba(8,17,32,0.5); border-radius: 14px; border: 1px dashed rgba(0,188,255,0.2);">
                <p style="color: #94a3b8; font-size: 0.9rem;">Koi feedback nahi mila. Aap apna feedback submit karein!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const initial = (item.name || "U")[0].toUpperCase();
        const starsText = "★".repeat(item.rating || 5);
        const timeAgo = formatFeedbackTime(item.createdAt);
        const reactions = item.reactions || { helpful: 0, fire: 0, love: 0, shield: 0 };
        const isFounder = item.isAdmin || (item.name && item.name.includes("Hafiz Abdul Moiz"));

        // Admin Emoji Award Display
        let adminEmojiHtml = "";
        if (item.adminEmoji && item.adminEmoji.emoji) {
            adminEmojiHtml = `
                <span class="admin-emoji-award-badge">
                    <span class="admin-award-label">👑 Admin Awarded:</span>
                    <span class="awarded-emoji-anim">${item.adminEmoji.emoji}</span>
                </span>
            `;
        }

        // Admin Action Buttons (Award Emoji, Edit, Delete)
        let adminActionHtml = "";
        if (isAdminLoggedIn) {
            adminActionHtml = `
                <div class="fb-admin-actions-right">
                    <button type="button" class="admin-action-btn btn-award-emoji" onclick="promptAdminEmoji('${item.id}')" title="Award Animated Emoji">
                        👑 Admin Emoji
                    </button>
                    ${isFounder ? `
                        <button type="button" class="admin-action-btn btn-edit-card" onclick="editAdminFeedback('${item.id}')" title="Edit Feedback Text">
                            ✏️ Edit
                        </button>
                    ` : ''}
                    <button type="button" class="admin-action-btn btn-del-card" onclick="deleteFeedbackLive('${item.id}', '${escapeHtml(item.name)}')">
                        🗑️ Delete
                    </button>
                </div>
            `;
        }

        return `
            <article class="fb-card ${isFounder ? 'card-founder-pinned' : ''}" id="card-${item.id}">
                <div class="fb-card-top">
                    <div class="fb-user-identity">
                        <div class="fb-avatar ${isFounder ? 'avatar-founder' : ''}">${isFounder ? '👑' : initial}</div>
                        <div>
                            <div class="fb-user-name">
                                <span>${escapeHtml(item.name || "Anonymous")}</span>
                                ${isFounder ? '<span class="founder-badge">👑 PROJECT FOUNDER</span>' : '<span class="verified-badge">✓ VERIFIED</span>'}
                            </div>
                            <div class="fb-user-role">${escapeHtml(item.role || "Cyber Defender")}</div>
                        </div>
                    </div>
                    <div class="fb-meta-right">
                        <div class="fb-stars-display">${starsText}</div>
                        <div class="fb-time-ago">${timeAgo}</div>
                    </div>
                </div>

                <div class="fb-tags-row">
                    <span class="fb-category-tag">${escapeHtml(item.category || "General")}</span>
                    <span class="fb-mood-tag">${escapeHtml(item.mood || "🤩 Loved It")}</span>
                    ${adminEmojiHtml}
                </div>

                <p class="fb-message-text">${escapeHtml(item.message || "")}</p>

                <div class="fb-reactions-bar">
                    <div class="fb-reactions-left">
                        <button type="button" class="reaction-btn" onclick="handleFeedbackReaction('${item.id}', 'helpful')">
                            👍 <span>${reactions.helpful || 0}</span>
                        </button>
                        <button type="button" class="reaction-btn" onclick="handleFeedbackReaction('${item.id}', 'fire')">
                            🔥 <span>${reactions.fire || 0}</span>
                        </button>
                        <button type="button" class="reaction-btn" onclick="handleFeedbackReaction('${item.id}', 'love')">
                            ❤️ <span>${reactions.love || 0}</span>
                        </button>
                        <button type="button" class="reaction-btn" onclick="handleFeedbackReaction('${item.id}', 'shield')">
                            🛡️ <span>${reactions.shield || 0}</span>
                        </button>
                    </div>

                    ${adminActionHtml}
                </div>
            </article>
        `;
    }).join("");
}

// 8. Delete Live from Firebase & Restore Form to User
async function deleteFeedbackLive(id, name) {
    if (!confirm(`Permanently delete feedback from "${name}"?`)) return;

    const deletedFeedback = currentFeedbackList.find(item => item.id === id);
    const isAdminFeedback = Boolean(
        deletedFeedback &&
        (deletedFeedback.isAdmin || (deletedFeedback.name && deletedFeedback.name.includes("Hafiz Abdul Moiz")))
    );

    saveDeletedFeedbackId(id);
    currentFeedbackList = currentFeedbackList.filter(item => item.id !== id);

    if (deletedFeedback && !isAdminFeedback) {
        localStorage.removeItem(USER_SUBMITTED_FLAG_KEY);
    }

    renderFeedbackCards();
    updateFeedbackStats();
    evaluateFormVisibility();

    try {
        await fetch(`https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/feedbacks/${id}.json`, {
            method: "DELETE"
        });
    } catch {}

    alert(isAdminFeedback
        ? "🗑️ Admin feedback permanently removed. User submission status is unchanged."
        : "🗑️ Feedback permanently removed. Users can now submit again!");
}

// 9. Admin Edit Feedback Feature (Kisi bhi waqt text edit karein)
async function editAdminFeedback(feedbackId) {
    const item = currentFeedbackList.find(f => f.id === feedbackId);
    if (!item) return;

    const newText = prompt("Admin Feedback ka naya text type karein:", item.message);
    if (newText === null || !newText.trim()) return;

    item.message = newText.trim();
    renderFeedbackCards();

    try {
        await fetch(`https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/feedbacks/${feedbackId}/message.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.message)
        });
        alert("✅ Founder feedback updated successfully!");
    } catch {
        alert("Text updated locally!");
    }
}

// 10. Admin Award Emoji Live
async function promptAdminEmoji(feedbackId) {
    const chosen = prompt("Admin Animated Emoji select karein (e.g. 🔥, 👑, 🛡️, 💯, ❤️, ⚡, 🌟):", "🔥");
    if (!chosen) return;

    const item = currentFeedbackList.find(f => f.id === feedbackId);
    if (!item) return;

    item.adminEmoji = {
        emoji: chosen.trim(),
        adminName: "Hafiz Abdul Moiz"
    };

    renderFeedbackCards();

    try {
        await fetch(`https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/feedbacks/${feedbackId}/adminEmoji.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.adminEmoji)
        });
        alert(`👑 Admin Emoji ${chosen} live display ho gaya ha!`);
    } catch {}
}

// 11. Update Stats
function updateFeedbackStats() {
    const total = currentFeedbackList.length;
    if (total === 0) return;
    const sum = currentFeedbackList.reduce((acc, curr) => acc + (curr.rating || 5), 0);
    const avg = (sum / total).toFixed(1);
    const totalReactions = currentFeedbackList.reduce((acc, curr) => {
        const r = curr.reactions || {};
        return acc + (r.helpful || 0) + (r.fire || 0) + (r.love || 0) + (r.shield || 0);
    }, 0);

    const avgEl = document.getElementById("fbAvgRating");
    const countEl = document.getElementById("fbTotalCount");
    const reactEl = document.getElementById("fbTotalReactions");

    if (avgEl) avgEl.textContent = avg;
    if (countEl) countEl.textContent = total;
    if (reactEl) reactEl.textContent = totalReactions;
}

// 12. Submit Feedback + Auto WhatsApp Alert + Hide Form
async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById("fbInputName");
    const roleInput = document.getElementById("fbInputRole");
    const msgInput = document.getElementById("fbInputMessage");
    const catSelect = document.getElementById("fbCategorySelect");
    const moodSelect = document.getElementById("fbMoodSelect");

    if (!nameInput.value.trim() || !msgInput.value.trim()) return;

    const isCurrentAdmin = isAdminLoggedIn && isPostAsAdminActive;

    // Check Admin Limit of 2
    if (isCurrentAdmin) {
        const adminPosts = currentFeedbackList.filter(f => f.isAdmin || (f.name && f.name.includes("Hafiz Abdul Moiz")));
        if (adminPosts.length >= 2) {
            alert("👑 Admin limit reached! Aap pehle se 2 official feedbacks post kar chuke hain.");
            evaluateFormVisibility();
            return;
        }
    }

    const newFeedback = {
        name: nameInput.value.trim(),
        role: roleInput.value.trim() || (isCurrentAdmin ? "Project Founder & SOC Lead" : "Cyber Defender"),
        rating: currentSelectedRating,
        category: catSelect.value || "General",
        mood: isCurrentAdmin ? "👑 Founder Announcement" : (moodSelect.value || "🤩 Loved It"),
        message: msgInput.value.trim(),
        createdAt: Date.now(),
        reactions: { helpful: 1, fire: 1, love: 1, shield: 1 },
        verified: true,
        isAdmin: isCurrentAdmin
    };

    try {
        const res = await fetch(FIREBASE_RTDB_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newFeedback)
        });
        if (res.ok) {
            const data = await res.json();
            newFeedback.id = data.name || "fb_" + Date.now();
        } else {
            newFeedback.id = "fb_" + Date.now();
        }
    } catch {
        newFeedback.id = "fb_" + Date.now();
    }

    currentFeedbackList.unshift(newFeedback);
    renderFeedbackCards();
    updateFeedbackStats();

    // Mark single submission flag for normal users so form disappears
    if (!isCurrentAdmin) {
        localStorage.setItem(USER_SUBMITTED_FLAG_KEY, "true");
    }

    // Reset textarea
    msgInput.value = "";
    updateFbCharCount();

    // Hide form & show confirmation
    evaluateFormVisibility();

    // Automatic WhatsApp Alert to 0326-2116352
    const waText = encodeURIComponent(
        `🛡️ *NEW CYBERGUARD FEEDBACK ALERT!*\n\n` +
        `👤 *Name:* ${newFeedback.name}\n` +
        `💼 *Role:* ${newFeedback.role}\n` +
        `⭐ *Rating:* ${newFeedback.rating}/5 Stars\n` +
        `🏷️ *Section:* ${newFeedback.category}\n` +
        `💬 *Feedback:* "${newFeedback.message}"\n\n` +
        `⏰ *Time:* ${new Date().toLocaleTimeString()} PKT\n` +
        `🌐 *Status:* Live on Firebase Realtime DB`
    );
    const waUrl = `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${waText}`;

    try {
        window.open(waUrl, "_blank");
    } catch {}

    const toast = document.getElementById("fbToastAlert");
    if (toast) {
        toast.textContent = "🎉 Zabardast! Feedback live Firebase par sync ho gaya aur WhatsApp alert dispatch ho gaya!";
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 5000);
    }
}

// 13. Reaction Click
async function handleFeedbackReaction(feedbackId, type) {
    const item = currentFeedbackList.find(f => f.id === feedbackId);
    if (!item) return;

    if (!item.reactions) item.reactions = { helpful: 0, fire: 0, love: 0, shield: 0 };
    item.reactions[type] = (item.reactions[type] || 0) + 1;

    renderFeedbackCards();
    updateFeedbackStats();

    try {
        await fetch(`https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/feedbacks/${feedbackId}/reactions/${type}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.reactions[type])
        });
    } catch {}
}

function setFeedbackCategoryFilter(category, btnEl) {
    activeFeedbackCategory = category;
    document.querySelectorAll(".cat-pill").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    renderFeedbackCards();
}

function filterFeedbacksLive() {
    renderFeedbackCards();
}

function formatFeedbackTime(timestamp) {
    if (timestamp == null || timestamp === "") return "Date unavailable";
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return "Date unavailable";

    const dateText = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Karachi",
        day: "numeric",
        month: "numeric",
        year: "numeric"
    }).format(date);
    const timeText = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Karachi",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(date);

    return `${dateText}, ${timeText} PKT`;
}

function escapeHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[c]));
}

const ANALYTICS_VECTOR_NAMES = [
    "Phishing Vector Volume", "Ransomware Payload Threats", "Mobile Wallet Spoofing",
    "APT Group Activity", "Government Portal Brute-Force", "Telecom Infrastructure DDoS",
    "Power Grid Intrusion", "Media & Satellite Hijacking", "Aviation Server Stress",
    "Law Enforcement Recon", "Relief Fund Phishing", "Drone & GPS Spoofing",
    "Cryptographic Key Leak Scans", "Darknet Identity Leak Trading"
];

const ANALYTICS_SAMPLE_EVENTS = [
    { vector: "Wallet OTP phishing simulation", sector: "Mobile wallet", source: "Synthetic SMS gateway", severity: "high", status: "BLOCKED" },
    { vector: "Ransomware execution scenario", sector: "Enterprise endpoint", source: "Sandbox payload", severity: "critical", status: "CONTAINED" },
    { vector: "Government portal login spray", sector: "Public services", source: "Generated test traffic", severity: "medium", status: "INVESTIGATING" },
    { vector: "GPS spoofing signal scenario", sector: "Transport systems", source: "Synthetic RF telemetry", severity: "high", status: "MONITORING" },
    { vector: "Relief fund lookalike domain", sector: "Citizen services", source: "Training indicator", severity: "critical", status: "BLOCKED" },
    { vector: "Telecom edge DDoS pattern", sector: "Telecommunications", source: "Generated packet profile", severity: "medium", status: "MITIGATED" },
    { vector: "Credential leak correlation", sector: "Identity services", source: "Local simulation engine", severity: "high", status: "INVESTIGATING" },
    { vector: "Aviation service stress test", sector: "Aviation systems", source: "Synthetic load event", severity: "medium", status: "CONTAINED" }
];

const analyticsState = {
    events: [],
    intervalId: null,
    isRunning: true,
    tick: 0
};

function initLiveAnalytics() {
    const analyticsSection = document.getElementById("analytics");
    const eventRows = document.getElementById("analyticsEventRows");
    if (!analyticsSection || !eventRows || analyticsState.intervalId) return;

    const now = Date.now();
    analyticsState.events = [
        { ...ANALYTICS_SAMPLE_EVENTS[1], timestamp: now - 95000 },
        { ...ANALYTICS_SAMPLE_EVENTS[4], timestamp: now - 47000 },
        { ...ANALYTICS_SAMPLE_EVENTS[0], timestamp: now - 12000 }
    ];

    analyticsSection.querySelectorAll(".metric-card").forEach((card, index) => {
        const heading = card.querySelector("h4");
        const bar = card.querySelector(".bar-fill");
        if (!bar) return;
        const value = Number.parseInt(bar.style.width, 10) || 50;
        bar.dataset.analyticsValue = String(value);
        bar.setAttribute("role", "progressbar");
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", "100");
        bar.setAttribute("aria-label", heading ? heading.textContent.trim() : ANALYTICS_VECTOR_NAMES[index]);
        updateAnalyticsBar(bar, value);
    });

    analyticsState.isRunning = true;
    renderAnalyticsEvents();
    updateAnalyticsSummary();
    updateAnalyticsClock();
    analyticsState.intervalId = window.setInterval(advanceAnalytics, 4000);
}

function updateAnalyticsBar(bar, value) {
    const safeValue = Math.max(8, Math.min(96, Math.round(value)));
    bar.dataset.analyticsValue = String(safeValue);
    bar.style.width = `${safeValue}%`;
    bar.setAttribute("aria-valuenow", String(safeValue));

    const level = safeValue >= 86 ? "CRITICAL" : safeValue >= 70 ? "ELEVATED" : safeValue >= 45 ? "GUARDED" : "NORMAL";
    bar.textContent = `${safeValue}% ${level}`;
    bar.classList.toggle("danger", safeValue >= 86);
    bar.classList.toggle("warning", safeValue >= 70 && safeValue < 86);
}

function advanceAnalytics() {
    if (!analyticsState.isRunning) return;
    analyticsState.tick += 1;

    document.querySelectorAll("#analytics .bar-fill").forEach(bar => {
        const currentValue = Number(bar.dataset.analyticsValue) || 50;
        updateAnalyticsBar(bar, currentValue + Math.round(Math.random() * 8 - 4));
    });

    if (analyticsState.tick % 2 === 0) {
        const sample = ANALYTICS_SAMPLE_EVENTS[Math.floor(Math.random() * ANALYTICS_SAMPLE_EVENTS.length)];
        analyticsState.events.unshift({ ...sample, timestamp: Date.now() });
        analyticsState.events = analyticsState.events.slice(0, 30);
        renderAnalyticsEvents();
    }

    updateAnalyticsSummary();
    updateAnalyticsClock();
}

function updateAnalyticsSummary() {
    const bars = Array.from(document.querySelectorAll("#analytics .bar-fill"));
    const values = bars.map(bar => Number(bar.dataset.analyticsValue) || 0);
    const contained = analyticsState.events.filter(event => ["BLOCKED", "CONTAINED", "MITIGATED"].includes(event.status)).length;
    const investigating = analyticsState.events.filter(event => ["INVESTIGATING", "MONITORING"].includes(event.status)).length;
    const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

    setAnalyticsText("analyticsEventCount", String(analyticsState.events.length));
    setAnalyticsText("analyticsContainedCount", String(contained));
    setAnalyticsText("analyticsInvestigatingCount", String(investigating));
    setAnalyticsText("analyticsAverageSignal", `${average}%`);
}

function updateAnalyticsClock() {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(now);
    setAnalyticsText("analyticsLastUpdate", `${time} PKT`);
    setAnalyticsText("analyticsStreamStatus", analyticsState.isRunning ? "SIMULATION LIVE" : "SIMULATION PAUSED");

    const indicator = document.getElementById("analyticsLiveIndicator");
    const pauseButton = document.getElementById("analyticsPauseBtn");
    if (indicator) {
        indicator.classList.toggle("is-live", analyticsState.isRunning);
        indicator.classList.toggle("is-paused", !analyticsState.isRunning);
    }
    if (pauseButton) {
        pauseButton.setAttribute("aria-pressed", String(!analyticsState.isRunning));
        pauseButton.innerHTML = analyticsState.isRunning ? "Ⅱ <span>Pause</span>" : "▶ <span>Resume</span>";
    }
}

function renderAnalyticsEvents() {
    const eventRows = document.getElementById("analyticsEventRows");
    if (!eventRows) return;

    const query = (document.getElementById("analyticsSearch")?.value || "").trim().toLowerCase();
    const severity = document.getElementById("analyticsSeverityFilter")?.value || "all";
    const filteredEvents = analyticsState.events.filter(event => {
        const searchableText = `${event.vector} ${event.sector} ${event.source} ${event.status}`.toLowerCase();
        return (severity === "all" || event.severity === severity) && searchableText.includes(query);
    });

    if (!filteredEvents.length) {
        eventRows.innerHTML = '<tr><td class="analytics-empty-row" colspan="6">No sample events match these filters.</td></tr>';
        return;
    }

    eventRows.innerHTML = filteredEvents.map((event, index) => {
        const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        }).format(new Date(event.timestamp));
        const severityClass = event.severity === "critical" || event.severity === "high" ? "danger" : "warning";
        const statusClass = ["INVESTIGATING", "MONITORING"].includes(event.status) ? "warning" : "success";
        return `<tr class="${index === 0 ? "analytics-event-new" : ""}">
            <td>${time} PKT</td><td>${event.vector}</td><td>${event.sector}</td><td>${event.source}</td>
            <td><span class="tag-badge ${severityClass}">${event.severity.toUpperCase()}</span></td>
            <td><span class="status-text ${statusClass}">${event.status}</span></td>
        </tr>`;
    }).join("");
}

function filterAnalyticsEvents() {
    renderAnalyticsEvents();
}

function analyticsToggleStream() {
    analyticsState.isRunning = !analyticsState.isRunning;
    updateAnalyticsClock();
}

function analyticsRefreshNow() {
    const sample = ANALYTICS_SAMPLE_EVENTS[Math.floor(Math.random() * ANALYTICS_SAMPLE_EVENTS.length)];
    analyticsState.events.unshift({ ...sample, timestamp: Date.now() });
    analyticsState.events = analyticsState.events.slice(0, 30);
    document.querySelectorAll("#analytics .bar-fill").forEach(bar => {
        const currentValue = Number(bar.dataset.analyticsValue) || 50;
        updateAnalyticsBar(bar, currentValue + Math.round(Math.random() * 12 - 6));
    });
    renderAnalyticsEvents();
    updateAnalyticsSummary();
    updateAnalyticsClock();
}

function setAnalyticsText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

document.addEventListener("DOMContentLoaded", () => {
    initLiveAnalytics();
    fetchLiveFeedbacks();
    setInterval(fetchLiveFeedbacks, 10000);
});