
// =========================================================
// CYBERGUARD // VVIP LIVE CYBER THREAT MAP ENGINE
// FULL FUNCTIONAL VERSION
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const THREAT_MAP_FIREBASE_URL =
        "https://cyber-guard-live-feedback-default-rtdb.firebaseio.com/threat_map.json";

    // =====================================================
    // MAIN SECTION
    // =====================================================

    const section = document.getElementById("Live-Cyber-Threat-Map");

    if (!section) {
        console.warn("CYBERGUARD: Live Threat Map section not found.");
        return;
    }


    // =====================================================
    // DOM ELEMENTS
    // =====================================================

    const attackCountElem =
        document.getElementById("threatActiveCount");

    const blockedCountElem =
        document.getElementById("threatBlockedCount");

    const pingTimeElem =
        document.getElementById("threatPingTime");

    const regionValue =
        document.getElementById("tmRegionValue");

    const lastSync =
        document.getElementById("tmLastSync");

    const regionFilter =
        document.getElementById("tmRegionFilter");

    const threatFilter =
        document.getElementById("tmThreatFilter");

    const searchInput =
        document.getElementById("tmSearch");

    const pauseBtn =
        document.getElementById("tmPauseBtn");

    const refreshBtn =
        document.getElementById("tmRefreshBtn");

    const fullscreenBtn =
        document.getElementById("tmFullscreenBtn");

    const clearBtn =
        document.getElementById("tmClearBtn");

    const threatFeedList =
        document.getElementById("threatFeedList");

    const feedCounter =
        document.getElementById("tmFeedCounter");

    const radar =
        section.querySelector(".tm-radar");


    // =====================================================
    // STATE
    // =====================================================

    let isPaused = false;

    let selectedRegion = "ALL";

    let selectedThreat = "ALL";

    let searchTerm = "";

    let liveFeedTimer = null;

    let radarTimer = null;

    let metricsTimer = null;

    let clockTimer = null;

    let refreshResetTimer = null;

    let liveThreatSource = [];


    // =====================================================
    // SIMULATED THREAT INTELLIGENCE DATA
    // =====================================================

    const threatPool = [

        {
            level: "CRITICAL",
            className: "critical",
            type: "DDoS",
            title: "DDoS Attack Detected",
            location: "Karachi Gateway",
            region: "PK",
            origin: "185.220.101.5"
        },

        {
            level: "HIGH",
            className: "warning",
            type: "PHISHING",
            title: "Phishing Campaign Detected",
            location: "Mobile Wallet Infrastructure",
            region: "PK",
            origin: "192.168.4.12"
        },

        {
            level: "INFO",
            className: "info",
            type: "RECON",
            title: "Port Scan Recon Activity",
            location: "Islamabad Server",
            region: "PK",
            origin: "45.154.255.8"
        },

        {
            level: "CRITICAL",
            className: "critical",
            type: "RANSOMWARE",
            title: "Ransomware Payload Flagged",
            location: "Cloud Infrastructure",
            region: "ME",
            origin: "103.21.244.0"
        },

        {
            level: "HIGH",
            className: "warning",
            type: "DDoS",
            title: "Traffic Flood Anomaly",
            location: "Mumbai Network",
            region: "IN",
            origin: "182.176.12.9"
        },

        {
            level: "INFO",
            className: "info",
            type: "BRUTE FORCE",
            title: "Brute Force Attempt Blocked",
            location: "SSH Port 22",
            region: "EU",
            origin: "91.240.118.172"
        },

        {
            level: "CRITICAL",
            className: "critical",
            type: "MALWARE",
            title: "Malware Payload Signature Found",
            location: "Enterprise Network",
            region: "US",
            origin: "198.51.100.42"
        },

        {
            level: "HIGH",
            className: "warning",
            type: "PHISHING",
            title: "Credential Harvesting Campaign",
            location: "Payment Infrastructure",
            region: "IN",
            origin: "203.0.113.45"
        },

        {
            level: "HIGH",
            className: "warning",
            type: "BRUTE FORCE",
            title: "Authentication Attack Blocked",
            location: "Remote Access Gateway",
            region: "US",
            origin: "198.51.100.71"
        },

        {
            level: "INFO",
            className: "info",
            type: "RECON",
            title: "Network Reconnaissance Activity",
            location: "European Edge Node",
            region: "EU",
            origin: "203.0.113.81"
        }

    ];


    function normalizeThreatEntry(entry) {

        if (!entry || typeof entry !== "object") {
            return null;
        }

        const severityMap = {
            critical: "CRITICAL",
            warning: "HIGH",
            info: "INFO",
            high: "HIGH",
            medium: "INFO"
        };

        const level =
            severityMap[String(entry.level || "").toLowerCase()] ||
            entry.level ||
            "INFO";

        const threatType =
            entry.type ||
            "RECON";

        const region = entry.region || "PK";

        return {
            level,
            className: level === "CRITICAL" ? "critical" : level === "HIGH" ? "warning" : "info",
            type: threatType,
            title: entry.title || "Regional Threat Event",
            location: entry.location || "Global Edge Node",
            region,
            origin: entry.origin || "10.0.0.1"
        };

    }

    async function fetchThreatMapFeed() {

        try {
            const response = await fetch(THREAT_MAP_FIREBASE_URL, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Threat map endpoint unavailable");
            }

            const data = await response.json();

            if (data && typeof data === "object") {
                const entries = Object.values(data)
                    .map(item => normalizeThreatEntry(item))
                    .filter(Boolean);

                if (entries.length > 0) {
                    liveThreatSource = entries;
                    return;
                }
            }
        } catch (error) {
            console.info("Using fallback threat telemetry for Cyber Threat Map.", error.message || error);
        }

        liveThreatSource = threatPool.slice();

    }

    // =====================================================
    // UTILITY
    // =====================================================

    function getCurrentTime() {

        return new Date().toLocaleTimeString("en-GB", {
            hour12: false
        });

    }


    function updateClock() {

        if (lastSync) {
            lastSync.textContent = getCurrentTime();
        }

    }


    // =====================================================
    // CREATE THREAT ITEM
    // =====================================================

    function createThreatItem(threat) {

        const li = document.createElement("li");

        li.className =
            `tm-feed-item ${threat.className}`;

        li.dataset.region =
            threat.region;

        li.dataset.type =
            threat.type;

        li.innerHTML = `

            <div class="tm-feed-time">
                ${getCurrentTime()}
            </div>

            <div class="tm-feed-severity">
                ${threat.level}
            </div>

            <div class="tm-feed-content">

                <strong>
                    ${threat.title}
                </strong>

                <span>
                    ${threat.location}
                </span>

            </div>

            <div class="tm-feed-origin">
                ${threat.origin}
            </div>

        `;

        return li;

    }


    // =====================================================
    // FILTER MATCHING
    // =====================================================

    function itemMatchesFilters(item) {

        const regionMatches =
            selectedRegion === "ALL" ||
            item.dataset.region === selectedRegion;

        const threatMatches =
            selectedThreat === "ALL" ||
            item.dataset.type === selectedThreat;

        const searchText =
            item.textContent.toLowerCase();

        const searchMatches =
            searchTerm === "" ||
            searchText.includes(
                searchTerm.toLowerCase()
            );

        return (
            regionMatches &&
            threatMatches &&
            searchMatches
        );

    }


    // =====================================================
    // APPLY FILTERS
    // =====================================================

    function applyFilters() {

        if (!threatFeedList) {
            return;
        }

        const items =
            threatFeedList.querySelectorAll(
                ".tm-feed-item"
            );

        let visibleCount = 0;

        items.forEach(item => {

            const visible =
                itemMatchesFilters(item);

            item.style.display =
                visible ? "" : "none";

            if (visible) {
                visibleCount++;
            }

        });

        if (feedCounter) {

            feedCounter.textContent =
                `${visibleCount} EVENTS`;

        }

    }


    // =====================================================
    // ADD LIVE THREAT
    // =====================================================

    function pushLiveThreat() {

        const sourcePool =
            liveThreatSource.length > 0 ?
                liveThreatSource :
                threatPool;

        if (
            isPaused ||
            !threatFeedList ||
            sourcePool.length === 0
        ) {
            return;
        }

        const randomIndex =
            Math.floor(
                Math.random() *
                sourcePool.length
            );

        const threat =
            sourcePool[randomIndex];

        const item =
            createThreatItem(threat);


        // Initial animation state
        item.style.opacity = "0";

        item.style.transform =
            "translateY(-14px)";


        item.style.transition =
            "opacity .35s ease, transform .35s ease";


        threatFeedList.insertBefore(
            item,
            threatFeedList.firstChild
        );


        requestAnimationFrame(() => {

            item.style.opacity = "1";

            item.style.transform =
                "translateY(0)";

        });


        // Keep feed clean
        while (
            threatFeedList.children.length > 12
        ) {

            threatFeedList.removeChild(
                threatFeedList.lastElementChild
            );

        }


        applyFilters();

    }


    // =====================================================
    // RADAR BLIPS
    // =====================================================

    function spawnRadarBlip() {

        if (
            isPaused ||
            !radar
        ) {
            return;
        }

        const blip =
            document.createElement("div");


        const types = [
            "",
            "warning",
            "critical",
            "info"
        ];


        const randomType =
            types[
                Math.floor(
                    Math.random() *
                    types.length
                )
            ];


        blip.className =
            `tm-radar-blip ${randomType}`;


        const top =
            Math.floor(
                Math.random() * 72
            ) + 14;


        const left =
            Math.floor(
                Math.random() * 72
            ) + 14;


        blip.style.top =
            `${top}%`;

        blip.style.left =
            `${left}%`;


        radar.appendChild(blip);


        setTimeout(() => {

            if (blip.parentNode) {
                blip.remove();
            }

        }, 3500);

    }


    // =====================================================
    // UPDATE KPI METRICS
    // =====================================================

    function updateMetrics() {

        if (isPaused) {
            return;
        }


        const attacks =
            Math.floor(
                Math.random() * 271
            ) + 1380;


        const efficiency =
            (
                99 +
                Math.random() * 0.8
            ).toFixed(1);


        const ping =
            Math.floor(
                Math.random() * 11
            ) + 8;


        if (attackCountElem) {

            attackCountElem.textContent =
                attacks.toLocaleString();

        }


        if (blockedCountElem) {

            blockedCountElem.textContent =
                `${efficiency}%`;

        }


        if (pingTimeElem) {

            pingTimeElem.textContent =
                `${ping}ms`;

        }

    }


    // =====================================================
    // REGION FILTER
    // =====================================================

    if (regionFilter) {

        regionFilter.addEventListener(
            "change",
            () => {

                selectedRegion =
                    regionFilter.value;


                const option =
                    regionFilter.options[
                        regionFilter.selectedIndex
                    ];


                if (
                    regionValue &&
                    option
                ) {

                    regionValue.textContent =
                        option.textContent
                            .replace(
                                /[^\w\s/]/g,
                                ""
                            )
                            .trim();

                }


                applyFilters();

            }
        );

    }


    // =====================================================
    // THREAT TYPE FILTER
    // =====================================================

    if (threatFilter) {

        threatFilter.addEventListener(
            "change",
            () => {

                selectedThreat =
                    threatFilter.value;

                applyFilters();

            }
        );

    }


    // =====================================================
    // SEARCH
    // =====================================================

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                searchTerm =
                    searchInput.value.trim();

                applyFilters();

            }
        );

    }


    // =====================================================
    // PAUSE / RESUME
    // =====================================================

    if (pauseBtn) {

        pauseBtn.addEventListener(
            "click",
            () => {

                isPaused =
                    !isPaused;


                if (isPaused) {

                    pauseBtn.textContent =
                        "▶ RESUME";

                    pauseBtn.setAttribute(
                        "aria-pressed",
                        "true"
                    );

                } else {

                    pauseBtn.textContent =
                        "⏸ PAUSE";

                    pauseBtn.setAttribute(
                        "aria-pressed",
                        "false"
                    );

                    updateMetrics();

                }

            }
        );

    }


    // =====================================================
    // REFRESH
    // =====================================================

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            () => {

                updateClock();

                if (!isPaused) {
                    updateMetrics();
                    pushLiveThreat();
                    spawnRadarBlip();
                }


                refreshBtn.textContent =
                    "✓ UPDATED";


                clearTimeout(
                    refreshResetTimer
                );


                refreshResetTimer =
                    setTimeout(() => {

                        refreshBtn.textContent =
                            "↻ REFRESH";

                    }, 1200);

            }
        );

    }


    // =====================================================
    // FULLSCREEN
    // =====================================================

    if (fullscreenBtn) {

        fullscreenBtn.addEventListener(
            "click",
            () => {

                const active =
                    section.classList.toggle(
                        "tm-fullscreen"
                    );


                if (active) {

                    fullscreenBtn.textContent =
                        "✕ EXIT FULLSCREEN";

                } else {

                    fullscreenBtn.textContent =
                        "⛶ FULLSCREEN";

                }

            }
        );

    }


    // =====================================================
    // ESCAPE FULLSCREEN
    // =====================================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                section.classList.contains(
                    "tm-fullscreen"
                )
            ) {

                section.classList.remove(
                    "tm-fullscreen"
                );


                if (fullscreenBtn) {

                    fullscreenBtn.textContent =
                        "⛶ FULLSCREEN";

                }

            }

        }
    );


    // =====================================================
    // CLEAR FEED
    // =====================================================

    if (clearBtn) {

        clearBtn.addEventListener(
            "click",
            () => {

                if (!threatFeedList) {
                    return;
                }


                threatFeedList.innerHTML =
                    "";


                if (feedCounter) {

                    feedCounter.textContent =
                        "0 EVENTS";

                }

            }
        );

    }


    // =====================================================
    // INITIALIZATION
    // =====================================================

    updateClock();

    updateMetrics();

    applyFilters();


    // =====================================================
    // LIVE ENGINE
    // =====================================================

    liveFeedTimer =
        setInterval(
            pushLiveThreat,
            2500
        );


    radarTimer =
        setInterval(
            spawnRadarBlip,
            1800
        );


    metricsTimer =
        setInterval(
            updateMetrics,
            3000
        );


    clockTimer =
        setInterval(
            updateClock,
            1000
        );


    // =====================================================
    // PAGE CLEANUP
    // =====================================================

    window.addEventListener(
        "beforeunload",
        () => {

            clearInterval(
                liveFeedTimer
            );

            clearInterval(
                radarTimer
            );

            clearInterval(
                metricsTimer
            );

            clearInterval(
                clockTimer
            );

            clearTimeout(
                refreshResetTimer
            );

        }
    );


    // =====================================================
    // CONSOLE STATUS
    // =====================================================

    console.log(
        "CYBERGUARD // VVIP LIVE THREAT MAP // ONLINE"
    );

});

