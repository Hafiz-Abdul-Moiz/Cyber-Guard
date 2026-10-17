/* ============================================================
   CYBERGUARD // GAMES-PRO.JS
   1) Games 1-5 UPGRADE : 5 levels each, timer, 3 shields (lives), hints,
      "why it was a scam" explanations, streak/time bonus, sound FX, confetti,
      keyboard 1-4, best-score stars, certificate copy.
   2) GAME 6 (NEW)      : "Scam Call Lab" - ek safe social experiment.
      Scammer bolta hai (voice + captions), aap jawab dete ho, aur end mein
      dikhaya jata hai ke kaun si psychological trick aap par chali.
   script.js ko chheda nahi gaya - ye file uske functions override karti hai.
   ============================================================ */
(function () {
"use strict";
if (typeof cyberGamesConfig === "undefined") { console.warn("Games-Pro: cyberGamesConfig not found"); return; }

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
const fxOK = () => root.dataset.perf !== "low";
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { } } };

const MAX_SCORE = 500, LEVEL_TIME = 25, LIVES = 3, TOTAL_GAMES = 6;

/* ============================================================
   SOUND FX (WebAudio - koi audio file nahi)
   ============================================================ */
const SFX = { on: store.get("cg_game_sfx", "on") !== "off", ctx: null };
function tone(freq, dur, type = "sine", vol = 0.06, delay = 0) {
    if (!SFX.on) return;
    try {
        SFX.ctx = SFX.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = SFX.ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (_) { }
}
const sfx = {
    ok() { tone(660, .14, "triangle", .07); tone(990, .22, "triangle", .07, .12); },
    bad() { tone(170, .35, "sawtooth", .06); tone(120, .35, "sawtooth", .05, .12); },
    tick() { tone(1100, .05, "square", .025); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, "triangle", .07, i * .13)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, .3, "sawtooth", .05, i * .18)); },
    sms() { tone(1320, .09, "sine", .06); tone(1760, .14, "sine", .06, .1); },
    start() { tone(440, .1, "square", .04); tone(880, .16, "square", .04, .1); }
};
function buzz(p) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (_) { } }

/* ============================================================
   1. LEVEL CONTENT  (har game ko 5 levels tak)
   ============================================================ */
const O = (text, correct, feedback) => ({ text, correct, feedback });
const META = {
    1: [
        { hint: "Check the balance inside the official app - never trust an SMS or a caller.", why: "Scammers fake SMS headers and create panic so you transfer YOUR own money. Your app balance is the only truth.", flags: ["Fake SMS header", "Panic + legal threat", "Refund request"] },
        { hint: "Banks and wallets never ask for OTP/PIN - not even to 'protect' you.", why: "An OTP is the key that authorises a transaction. Anyone asking for it is the attacker, not the helper.", flags: ["OTP request", "Fake authority", "Urgency"] },
        { hint: "Wait for the credit to show in YOUR official app before you ship anything.", why: "Payment screenshots can be edited in seconds. Only a real credit in your own account counts.", flags: ["Edited screenshot", "Dispatch pressure"] }
    ],
    2: [{ hint: "Hang up and call the real person on the number saved in YOUR phone.", why: "Three seconds of someone's voice from social media is enough for an AI clone. Emotion is used to stop you thinking.", flags: ["Voice clone", "Emergency + secrecy", "Unknown number"] }],
    3: [{ hint: "APK files sent on chat are never 'official'. Real apps come from the Play Store only.", why: "Sideloaded APKs can read your SMS and OTPs, record the screen and empty your wallet apps.", flags: ["APK via chat", "Fake government offer"] }],
    4: [{ hint: "You only ENTER a PIN to SEND money. Receiving never needs one.", why: "A scanned payment QR plus your PIN authorises an outgoing payment. 'Scan to receive' is always a trap.", flags: ["Reverse-payment QR", "'Receive money' lie"] }],
    5: [{ hint: "Real card readers are solid. Anything loose or sticky is an overlay.", why: "Skimmers are glued on top of the real reader to copy your magnetic strip, while a tiny camera records your PIN.", flags: ["Loose bezel", "Glue residue"] }]
};
const EXTRA = {
    1: [
        { title: "The 'Ehsaas Rs. 25,000 Relief' Registration Fee", desc: "An SMS says: 'Congratulations! You are selected for a Rs. 25,000 government relief grant. Send a Rs. 500 processing fee to 0345-XXXXXXX via JazzCash within 1 hour to confirm your name.'", target: "Registration Fee", severity: "HIGH",
          hint: "Real government programmes never collect 'processing fees' on a personal mobile wallet.", why: "Advance-fee scams use a small fee and a big promise. The fee IS the scam - the grant never exists.", flags: ["Advance fee", "1-hour deadline", "Personal wallet number"],
          options: [O("Send Rs. 500 - it's tiny compared to Rs. 25,000", false, "🚨 LOST: There is no grant. They also now know your number is active and will target you again."), O("Ignore it, report the number, and check only on the official government website", true, "✅ DEFENSE SUCCESS: You refused the advance-fee trap and used an official channel."), O("Reply and ask the 'officer' for more details", false, "🚨 MISTAKE: Replying confirms your number is live and invites a flood of follow-up scams.")] },
        { title: "The Franchise Agent's 'Failed Transaction' Trick", desc: "At a mobile shop your cash-out 'fails'. The agent hands you HIS phone: 'Just type your MPIN here once more, the system will retry.'", target: "MPIN", severity: "CRITICAL",
          hint: "Your MPIN belongs only inside YOUR phone's official app.", why: "A rogue agent can capture your PIN on his device, then use your SIM/wallet details to drain the account.", flags: ["MPIN on a stranger's device", "Staged failure"],
          options: [O("Type the MPIN on his phone to retry", false, "🚨 BREACHED: Your PIN was captured and your wallet was emptied minutes later."), O("Decline, check the status in your own app, retry only on your own phone", true, "✅ DEFENSE SUCCESS: PIN stays private and you verify using your own trusted device."), O("Read the MPIN aloud so he can type it", false, "🚨 BREACHED: Saying a PIN out loud is the same as handing it over.")] }
    ],
    2: [
        { title: "The Boss's Urgent WhatsApp Voice Note", desc: "A voice note in your manager's exact voice: 'I'm stuck in a meeting. Transfer Rs. 100,000 to this vendor account right now, I'll explain later.' The number is slightly different from usual.", target: "Company Funds", severity: "CRITICAL",
          hint: "Confirm through a second channel: call the boss on the known office number.", why: "CEO-fraud scams combine cloned voices with authority and urgency to bypass normal payment approval.", flags: ["Voice clone", "Urgency", "New number", "Skip-the-process request"],
          options: [O("Transfer the money - it's the boss's order", false, "🚨 FRAUD: The company lost Rs. 100,000 to a cloned voice and a mule account."), O("Call the boss on the saved office number and follow the normal payment approval process", true, "✅ THREAT NEUTRALIZED: One verification call exposed the clone and protected company funds."), O("Reply 'On it' and ask for the account details first", false, "🚨 MISTAKE: Engaging keeps the attacker in control and makes you step through their script.")] },
        { title: "The Grandchild 'Safe-Word' Test", desc: "An unknown number: 'Nana, it's me! Please don't tell Mum, I'm in trouble and need Rs. 40,000.' The voice sounds a bit like your grandson, with a cough.", target: "Family Savings", severity: "HIGH",
          hint: "Ask for the family safe word, or a question only the real person would know.", why: "Impostors rely on secrecy ('don't tell Mum') so nobody can verify. A family safe word breaks the spell.", flags: ["Secrecy request", "Unknown number", "Emotional pressure"],
          options: [O("Send the money quickly so he isn't in trouble", false, "🚨 LOST: Your grandson was safe. The 'cough' hid the voice differences."), O("Ask for the family safe word, then call him back on his saved number", true, "✅ SUCCESS: The caller could not answer, and the real grandson picked up on his own number."), O("Say 'Is that Ali?' to help him identify himself", false, "🚨 MISTAKE: You just handed the scammer the name he needed.")] },
        { title: "'Say YES' - The Voice-Signature Trick", desc: "A friendly 'bank survey' caller asks 'Can you hear me clearly?' then: 'Please say YES to confirm you are the account holder.'", target: "Voice Authorisation", severity: "HIGH",
          hint: "Don't confirm anything to unknown callers. Just hang up.", why: "Your recorded 'yes' can be replayed to fake consent for purchases and voice-verified services.", flags: ["Yes-trap", "Fake survey", "Unknown caller"],
          options: [O("Say 'Yes' clearly", false, "🚨 RECORDED: Your 'yes' was captured and later used as fake authorisation."), O("Hang up - confirm nothing to an unknown caller", true, "✅ SUCCESS: No recording, no consent. Use the bank's official number if you want to check."), O("Say 'Yes, but who are you first?'", false, "🚨 MISTAKE: The word 'yes' is still on tape.")] },
        { title: "Deepfake Video Call from an 'Inspector'", desc: "A WhatsApp video call shows an officer in uniform. His mouth glitches and the audio lags. He says you must pay a 'bail guarantee' immediately or face arrest.", target: "Bail Payment", severity: "CRITICAL",
          hint: "Real authorities don't demand money over WhatsApp. Verify with the department itself.", why: "Deepfake video plus a threat of arrest is built to scare you into paying before you think.", flags: ["Lip-sync glitches", "Arrest threat", "Payment demand"],
          options: [O("Pay - you don't want an arrest", false, "🚨 LOST: There was no case. The payment went to a mule account."), O("End the call, verify through the department's official number, and report the account", true, "✅ SUCCESS: You refused pressure and used an official channel."), O("Ask him to wave a hand over his face; pay only if the video passes", false, "🚨 MISTAKE: Visual 'tests' are unreliable, and the whole premise is still fake.")] }
    ],
    3: [
        { title: "'Parcel Delivery Failed' Tracker App", desc: "SMS: 'Your parcel could not be delivered. Download the tracker to reschedule: postex-track.apk'.", target: "Device Control", severity: "HIGH",
          hint: "Track parcels by typing the courier's official website yourself.", why: "Fake courier apps are classic SMS-stealing trojans that forward your bank OTPs to attackers.", flags: ["SMS link", "APK download", "Delivery pretext"],
          options: [O("Download the APK to reschedule", false, "🚨 INFECTED: The app read your SMS and forwarded OTPs to the attacker."), O("Ignore it and track via the courier's official app/site typed manually", true, "✅ SUCCESS: Official channel only - zero risk."), O("Open the link just to look, without installing", false, "🚨 RISKY: Opening unknown links can trigger drive-by downloads and fingerprinting.")] },
        { title: "'WhatsApp Gold' Upgrade Link", desc: "A friend sends: 'Get WhatsApp Gold with new features! Update now: (link)'", target: "Chat Account", severity: "HIGH",
          hint: "WhatsApp has no 'Gold' edition. Modded apps steal accounts.", why: "Fake WhatsApp mods hijack your account, then message YOUR contacts to spread the scam.", flags: ["Unofficial mod", "Friend's hacked account"],
          options: [O("Install it - it's from a friend", false, "🚨 HIJACKED: Your WhatsApp was taken over and your contacts got the same link."), O("Delete it, warn your friend their account may be hacked, enable 2-step verification", true, "✅ SUCCESS: You stopped the chain and hardened your account."), O("Forward it to family so they can upgrade too", false, "🚨 SPREAD: You became part of the distribution network.")] },
        { title: "Flashlight App Wants Accessibility Access", desc: "A free flashlight app from an unknown developer asks for 'Accessibility Service' and 'Read SMS' permissions.", target: "Permissions", severity: "CRITICAL",
          hint: "A flashlight needs no permissions at all - your phone already has one built in.", why: "Accessibility access lets malware click buttons for you, read the screen and approve transactions.", flags: ["Excess permissions", "Unknown developer"],
          options: [O("Allow everything so the app works", false, "🚨 COMPROMISED: The app now reads your screen and approves banking prompts."), O("Deny, uninstall it, and use the phone's built-in flashlight", true, "✅ SUCCESS: Permission requests that don't fit the app = remove it."), O("Allow only SMS access", false, "🚨 RISKY: SMS access alone is enough to steal OTPs.")] },
        { title: "'Shadi_Card.apk' from a Cousin", desc: "Your cousin's number sends 'Shadi_Card.apk - open the wedding invitation!' You know his account has been hacked before.", target: "Trusted Contacts", severity: "HIGH",
          hint: "Known sender does not mean safe file. Confirm by calling him.", why: "Attackers abuse hacked accounts because people trust the sender and skip the safety check.", flags: ["APK as invitation", "Trusted-contact abuse"],
          options: [O("Open it - it's from your cousin", false, "🚨 INFECTED: The 'invitation' was spyware that spread to your contacts."), O("Call him and ask; don't install any .apk from chat", true, "✅ SUCCESS: A 20-second call exposed the hacked account."), O("Ask a friend to open it on his phone", false, "🚨 MISTAKE: You passed the infection to someone else.")] }
    ],
    4: [
        { title: "The Sticker Pasted over the Shop's QR", desc: "At a store you notice the payment QR looks like a sticker over the original. Your app shows the merchant as 'M. Traders', not the shop's name.", target: "Merchant Payment", severity: "HIGH",
          hint: "Always read the merchant name on your payment screen before entering your PIN.", why: "Fraudsters paste their own QR over a genuine one so the money goes to their wallet.", flags: ["Overlay sticker", "Merchant name mismatch"],
          options: [O("Pay anyway - the shop looks fine", false, "🚨 LOST: Your money went to the scammer's wallet, not the shop."), O("Stop, ask the owner to confirm the name or pay another way, and report the tampering", true, "✅ SUCCESS: Name verification caught the swapped QR."), O("Pay a small amount to test it first", false, "🚨 MISTAKE: A 'test' payment is still lost money.")] },
        { title: "'Scan to Win Free Pizza + Rs. 5,000' Poster", desc: "A poster on a pole says 'Scan the QR to win!' The page it opens asks for your card number to 'verify your prize'.", target: "Card Details", severity: "HIGH",
          hint: "Random posters are not trusted sources. Ignore them.", why: "Quishing (QR phishing) hides the malicious link inside a code, so you can't see it before scanning.", flags: ["Random poster", "Prize bait", "Card data request"],
          options: [O("Scan and enter the card to claim the prize", false, "🚨 STOLEN: Card details went to a phishing page and were used within minutes."), O("Ignore the poster - don't scan random QR codes", true, "✅ SUCCESS: No scan, no risk."), O("Scan but type fake details to 'see what happens'", false, "🚨 RISKY: Even loading the page can fingerprint your device or push a download.")] },
        { title: "Quishing Email: 'Account Locked - Scan to Verify'", desc: "An email says your account is locked. 'Scan the QR code within 24 hours to unlock it.'", target: "Account Credentials", severity: "CRITICAL",
          hint: "Open your bank's official app or call the number on your card instead.", why: "QR codes in emails bypass link scanners and push you onto your phone, where it's harder to spot a fake site.", flags: ["Urgency", "QR in email", "Lock threat"],
          options: [O("Scan the code and log in", false, "🚨 CREDENTIALS STOLEN: The fake login page captured your username and password."), O("Ignore the email; open the official app directly or call the helpline", true, "✅ SUCCESS: You bypassed the phishing page completely."), O("Reply asking if the email is genuine", false, "🚨 MISTAKE: Replying to a scammer proves the address is active.")] },
        { title: "'Free Wi-Fi' QR on a Stranger's Flyer", desc: "In a café, a flyer taped to the table offers 'Free Wi-Fi - scan to connect'. It isn't from the staff.", target: "Network Traffic", severity: "HIGH",
          hint: "Ask the café staff for the official network name and password.", why: "Rogue hotspots let attackers watch or alter your traffic and capture logins.", flags: ["Unofficial QR", "Unknown network"],
          options: [O("Join, then log in to your bank app", false, "🚨 INTERCEPTED: The rogue hotspot captured your session."), O("Ask staff for the official Wi-Fi details instead", true, "✅ SUCCESS: You joined the legitimate network."), O("Join but only browse social media", false, "🚨 RISKY: Social logins and session cookies can still be hijacked.")] }
    ],
    5: [
        { title: "The 'Helpful' Stranger Behind You", desc: "Your card seems stuck. A man in the queue says: 'Let me help - enter your PIN again, I'll press the button.' He's standing very close.", target: "PIN + Card", severity: "CRITICAL",
          hint: "Never let anyone help at an ATM. Call the bank's number printed on the machine.", why: "Shoulder-surfing plus a trapped card: he watches your PIN, then takes the card after you leave.", flags: ["Unsolicited help", "Standing too close"],
          options: [O("Accept his help and re-enter the PIN", false, "🚨 CARD TAKEN: He memorised your PIN and removed the card after you left."), O("Cover the keypad, cancel, stay by the ATM and call the bank number printed on it", true, "✅ SUCCESS: You kept control and the bank blocked the card safely."), O("Walk away to find a guard, leaving the card inside", false, "🚨 MISTAKE: Leaving the machine lets him retrieve the card in seconds.")] },
        { title: "Thick Keypad + Tiny Pinhole", desc: "The keypad looks raised and thicker than normal, and a small hole sits above the screen where there wasn't one before.", target: "PIN Entry", severity: "CRITICAL",
          hint: "If the machine looks altered, don't use it. Report it to the bank.", why: "Fake keypad overlays record keystrokes and pinhole cameras capture PINs - covering your hand doesn't stop the overlay.", flags: ["Raised keypad", "Pinhole camera"],
          options: [O("Use it quickly and be done", false, "🚨 CAPTURED: The overlay logged every keystroke."), O("Don't use it - report to the bank and use another ATM", true, "✅ SUCCESS: You avoided it and flagged a compromised machine."), O("Use it but cover the keypad with your hand", false, "🚨 RISKY: A keypad overlay still reads each press beneath your hand.")] },
        { title: "The Card Trap: PIN Twice, Card Won't Return", desc: "You enter your PIN and the ATM asks again, then says 'card retained'. A stranger says 'just wait, it will come out'.", target: "Card Trap", severity: "HIGH",
          hint: "Cancel, stay near the machine, and call the bank from the number on the ATM.", why: "A card trap (like a Lebanese loop) holds your card inside; the thief retrieves it after you leave.", flags: ["Repeated PIN prompt", "Stranger reassurance"],
          options: [O("Keep re-entering the PIN and leave when told", false, "🚨 CARD STOLEN: The thief removed the trapped card after you left."), O("Press cancel, stay put, and call the bank helpline immediately", true, "✅ SUCCESS: Quick blocking made the stolen card useless."), O("Let the stranger pull it out with a tool", false, "🚨 MISTAKE: He now has your card AND saw your PIN.")] },
        { title: "Unknown Rs. 30,000 Withdrawal Alert", desc: "After your ATM visit you get an SMS: 'Rs. 30,000 withdrawn at ATM in another city.' You didn't do this.", target: "Account Funds", severity: "CRITICAL",
          hint: "Block the card right now through the official app or helpline.", why: "Speed matters. A cloned card keeps draining until you block it and dispute the transactions.", flags: ["Unknown withdrawal", "Different location"],
          options: [O("Ignore it - it must be a mistake", false, "🚨 DRAINED: Further withdrawals emptied the account within the hour."), O("Immediately block the card via official helpline/app, change the PIN, and file a dispute", true, "✅ SUCCESS: Fast action stopped further loss and started the recovery claim."), O("Call the number in the SMS to ask", false, "🚨 MISTAKE: That number belongs to the scammers.")] }
    ]
};
/* config ko merge karo (purana content intact, sirf add) */
function enrichConfig() {
    Object.keys(cyberGamesConfig).forEach(k => {
        const g = cyberGamesConfig[k];
        if (g._pro) return;
        (g.scenarios || []).forEach((s, i) => Object.assign(s, META[k]?.[i] || {}));
        if (EXTRA[k]) g.scenarios.push(...EXTRA[k]);
        g.maxScore = MAX_SCORE;
        g._pro = true;
    });
    cyberGamesConfig[6] = {
        name: "Scam Call Lab - The Social Engineering Experiment", logo: "🎭",
        goal: "A safe, real-feel experiment: a scammer calls YOU. Stay calm, spot the psychological tricks, and protect your wallet.",
        rule: "Stop. Hang up. Verify through an official number. Urgency + fear + authority = scam.",
        maxScore: 100, specialOutput: "", scenarios: [], lab: true
    };
}
enrichConfig();

/* ============================================================
   2. GAME STATE + UI INJECTION
   ============================================================ */
const G = { id: 1, order: [], idx: 0, score: 0, streak: 0, bestStreak: 0, lives: LIVES, right: 0, wrong: 0, hints: 0, hintUsed: false, locked: false, timeLeft: LEVEL_TIME, timer: null, t0: 0, over: false };

function injectUI() {
    const play = $("gamePlayScreen");
    if (play && !$("gpHud")) {
        const meta = play.querySelector(".game-meta-box");
        const hud = document.createElement("div");
        hud.id = "gpHud"; hud.className = "gp-hud";
        hud.innerHTML = `
            <div class="gp-lives" id="gpLives" aria-label="Shields"></div>
            <div class="gp-timer" id="gpTimer"><div class="gp-timer-bar" id="gpTimerBar"></div><span id="gpTimerTxt">${LEVEL_TIME}s</span></div>
            <div class="gp-progress" id="gpProgress"></div>
            <button type="button" class="gp-sfx" id="gpSfx" title="Sound effects"></button>`;
        meta ? meta.after(hud) : play.prepend(hud);
        $("gpSfx").addEventListener("click", () => { SFX.on = !SFX.on; store.set("cg_game_sfx", SFX.on ? "on" : "off"); syncSfxBtn(); if (SFX.on) sfx.ok(); });
        syncSfxBtn();
        const sc = play.querySelector(".game-score");
        if (sc) sc.innerHTML = `Score: <span id="gameScore">0</span> / <span id="gpMax">${MAX_SCORE}</span> PTS`;
        const tool = $("specialToolBtn");
        if (tool && !$("gpHintBtn")) {
            tool.insertAdjacentHTML("afterend", `<button type="button" id="gpHintBtn" class="btn-special-tool gp-hint"><span>💡 Hint (-10 pts)</span></button><div id="gpHintBox" class="gp-hintbox"></div>`);
            $("gpHintBtn").addEventListener("click", useHint);
        }
        const fb = $("gameFeedback");
        if (fb && !$("gpWhy")) fb.insertAdjacentHTML("afterend", `<div id="gpWhy" class="gp-why" hidden></div>`);
    }
    const end = $("gameEndScreen");
    if (end && !$("gpEndStats")) {
        const card = end.querySelector(".end-score-card");
        (card || end).insertAdjacentHTML("afterend", `<div id="gpEndStats" class="gp-endstats"></div><div class="gp-endtools"><button type="button" id="gpCopy" class="btn-secondary-small">📋 Copy my certificate</button></div>`);
        $("gpCopy").addEventListener("click", copyCert);
    }
    /* 6th tab */
    const tabs = document.querySelector(".game-tabs-navigation");
    if (tabs && !tabs.querySelector('[onclick="switchCyberGame(6)"]')) {
        tabs.insertAdjacentHTML("beforeend", `<button class="game-tab-btn game-tab-new" onclick="switchCyberGame(6)"><span class="game-tab-logo">🎭</span><span class="game-tab-title">Scam Call Lab</span><span class="gt-new">NEW</span></button>`);
    }
    document.querySelectorAll(".game-tab-btn").forEach((b, i) => { if (!b.querySelector(".gt-stars")) b.insertAdjacentHTML("beforeend", `<span class="gt-stars" data-g="${i + 1}"></span>`); });
    refreshStars();
    const sec = document.querySelector("#game .section-desc");
    if (sec) sec.textContent = "6 live cybersecurity scam games: timed levels, shields, hints, explanations - plus the NEW Scam Call Lab, a safe social experiment where a scammer calls YOU.";
}
function syncSfxBtn() { const b = $("gpSfx"); if (b) { b.textContent = SFX.on ? "🔊" : "🔇"; b.setAttribute("aria-pressed", String(SFX.on)); } }

/* best-score stars */
const bests = () => { try { return JSON.parse(store.get("cg_game_best", "{}")) || {}; } catch (_) { return {}; } };
function starsFor(pct) { return pct >= 85 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0; }
function refreshStars() {
    const b = bests();
    document.querySelectorAll(".gt-stars").forEach(el => {
        const r = b[el.dataset.g]; if (!r) { el.textContent = ""; return; }
        el.textContent = "★".repeat(r.stars) + "☆".repeat(3 - r.stars); el.title = `Best: ${r.score}/${r.max}`;
    });
}
function saveBest(id, score, max) {
    const b = bests(), stars = starsFor(score / max * 100);
    if (!b[id] || score > b[id].score) b[id] = { score, max, stars };
    store.set("cg_game_best", JSON.stringify(b)); refreshStars();
}

/* ============================================================
   3. GAMES 1-5 ENGINE (overrides)
   ============================================================ */
function stopTimer() { clearInterval(G.timer); G.timer = null; }
function rankFor(pct) { return pct >= 90 ? "Master Cyber Sentinel (Elite v5.0)" : pct >= 70 ? "SOC Incident Responder" : pct >= 45 ? "Cyber Threat Hunter" : "Rookie Defense Analyst"; }
const stripLevel = t => String(t || "").replace(/^Level\s*\d+\s*:\s*/i, "");

window.switchCyberGame = function (gameId) {
    gameId = Math.min(TOTAL_GAMES, Math.max(1, +gameId || 1));
    injectUI(); stopTimer(); stopLab();
    G.id = gameId; G.idx = 0; G.score = 0; G.streak = 0; G.over = false;
    try { currentCyberGameId = gameId; currentScenarioIdx = 0; currentScore = 0; currentStreak = 0; } catch (_) { }
    document.querySelectorAll(".game-tab-btn").forEach((t, i) => t.classList.toggle("active", i + 1 === gameId));
    const g = cyberGamesConfig[gameId];
    $("briefingLogo").innerText = g.logo; $("briefingName").innerText = g.name;
    $("briefingGoal").innerText = g.goal; $("briefingRule").innerText = g.rule;
    $("briefingScoreCap").innerText = g.lab ? "100 DEFENSE SCORE" : MAX_SCORE + " PTS MAX";
    const hint = document.querySelector("#gameBriefingScreen .briefing-hint");
    if (hint) hint.textContent = g.lab ? "🎭 Safe experiment: nothing is real, nothing is recorded. Answer how you would naturally respond." : "💡 5 timed levels · 3 shields · hints & explanations · beat your best stars.";
    const btn = document.querySelector("#gameBriefingScreen .btn-start-game span");
    if (btn) btn.textContent = g.lab ? "📞 ENTER THE LAB" : "🚀 START GAME (2-SEC SCAN)";
    const pc = document.querySelector("#gameBriefingScreen .protocol-code"); if (pc) pc.textContent = "SOC-DEFENSE // v5.0";
    showScreen("gameBriefingScreen");
};
window.showScreen = function (id) {
    ["gameBriefingScreen", "gamePlayScreen", "gameEndScreen", "gameScamLabScreen"].forEach(s => { const el = $(s); if (el) el.classList.toggle("active", s === id); });
};
window.nextGameId = function () { return (G.id % TOTAL_GAMES) + 1; };
window.triggerStartGame = function () {
    sfx.start();
    runRadarLoader(G.id === 6 ? "OPENING SCAM CALL LAB..." : "INITIALIZING SOC DEFENSE SANDBOX...", () => { G.id === 6 ? startLab() : startGame(); });
};
function startGame() {
    const g = cyberGamesConfig[G.id];
    G.order = shuffle(g.scenarios.map((_, i) => i)); G.idx = 0; G.score = 0; G.streak = 0; G.bestStreak = 0; G.lives = LIVES;
    G.right = 0; G.wrong = 0; G.hints = 0; G.over = false; G.t0 = Date.now();
    showScreen("gamePlayScreen"); window.loadCyberLevel(G.id, 0);
}
window.resetCurrentGame = function () { if (G.id === 6) return startLab(); stopTimer(); startGame(); };

function renderLives() { const el = $("gpLives"); if (el) el.innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="gp-heart ${i < G.lives ? "on" : "off"}">🛡️</span>`).join(""); }
function renderProgress(total) { const el = $("gpProgress"); if (el) el.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < G.idx ? "done" : i === G.idx ? "now" : ""}"></i>`).join(""); }
function updateHud() {
    const g = cyberGamesConfig[G.id], pct = G.score / MAX_SCORE * 100;
    $("gameScore").innerText = G.score; $("gameStreak").innerText = G.streak > 0 ? "x" + G.streak : "0";
    const r = $("gameRank"); if (r) r.innerText = rankFor(pct);
    const m = $("gpMax"); if (m) m.textContent = MAX_SCORE;
    renderLives(); renderProgress(g.scenarios.length);
}
window.loadCyberLevel = function (gameId, levelIdx) {
    injectUI();
    const g = cyberGamesConfig[gameId]; if (!g) return;
    G.idx = levelIdx; G.locked = false; G.hintUsed = false;
    const sc = g.scenarios[G.order[levelIdx] ?? levelIdx]; if (!sc) return;
    $("currentGameLogo").innerText = g.logo; $("currentGameName").innerText = g.name;
    $("gameLevelDisplay").innerText = (levelIdx + 1) + " / " + g.scenarios.length;
    $("gameTargetDisplay").innerText = sc.target; $("gameSeverityDisplay").innerText = sc.severity;
    $("scenarioTitle").innerText = `Level ${levelIdx + 1}: ${stripLevel(sc.title)}`; $("scenarioDesc").innerText = sc.desc;
    const fb = $("gameFeedback"); fb.innerText = ""; fb.className = "game-feedback";
    const why = $("gpWhy"); if (why) { why.hidden = true; why.innerHTML = ""; }
    const hb = $("gpHintBox"); if (hb) { hb.classList.remove("active"); hb.textContent = ""; }
    const hbtn = $("gpHintBtn"); if (hbtn) hbtn.disabled = false;
    const sp = $("specialToolResult"); if (sp) sp.classList.remove("active");
    const box = $("gameBoxContainer"); if (box) { box.classList.remove("gp-shake", "gp-flash-ok"); }
    const oc = $("gameOptions"); oc.innerHTML = "";
    shuffle(sc.options).forEach((opt, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn-primary-small gp-opt";
        b.innerHTML = `<strong>[${i + 1}]</strong> ${esc(opt.text)}`;
        b.onclick = () => window.selectCyberOption(opt, i, b);
        b._opt = opt; oc.appendChild(b);
    });
    updateHud(); startTimer();
};
function startTimer() {
    stopTimer(); G.timeLeft = LEVEL_TIME;
    const bar = $("gpTimerBar"), txt = $("gpTimerTxt"), wrap = $("gpTimer");
    const paint = () => { if (bar) bar.style.width = (G.timeLeft / LEVEL_TIME * 100) + "%"; if (txt) txt.textContent = Math.ceil(G.timeLeft) + "s"; if (wrap) wrap.classList.toggle("gp-danger", G.timeLeft <= 7); };
    paint(); let lastTick = 99;
    G.timer = setInterval(() => {
        if (document.hidden) return;
        G.timeLeft = Math.max(0, G.timeLeft - 0.25); paint();
        if (G.timeLeft <= 5 && Math.ceil(G.timeLeft) !== lastTick && G.timeLeft > 0) { lastTick = Math.ceil(G.timeLeft); sfx.tick(); }
        if (G.timeLeft <= 0) { stopTimer(); timeUp(); }
    }, 250);
}
function useHint() {
    if (G.locked) return;
    const g = cyberGamesConfig[G.id], sc = g.scenarios[G.order[G.idx]];
    const hb = $("gpHintBox"); if (!hb || !sc) return;
    hb.textContent = "💡 " + (sc.hint || "Think: who benefits if I act right now?"); hb.classList.add("active");
    if (!G.hintUsed) { G.hintUsed = true; G.hints++; G.score = Math.max(0, G.score - 10); updateHud(); }
    $("gpHintBtn").disabled = true;
}
function reveal(chosenBtn, correctOpt, feedbackText, ok) {
    const oc = $("gameOptions");
    oc.querySelectorAll("button").forEach(b => { b.disabled = true; if (b._opt && b._opt.correct) b.classList.add("is-correct"); });
    if (chosenBtn && !ok) chosenBtn.classList.add("is-wrong");
    const fb = $("gameFeedback"); fb.innerText = feedbackText; fb.className = "game-feedback " + (ok ? "success" : "error");
    const g = cyberGamesConfig[G.id], sc = g.scenarios[G.order[G.idx]];
    const why = $("gpWhy");
    if (why) {
        const last = G.lives <= 0 && !ok, finalLvl = G.idx + 1 >= g.scenarios.length;
        why.innerHTML = `<div class="gp-why-h">🧠 WHY THIS IS A SCAM</div><p>${esc(sc.why || "Scammers rely on urgency and emotion so you act before you verify. Stop, verify, then decide.")}</p>` +
            ((sc.flags || []).length ? `<div class="gp-flags">${sc.flags.map(f => `<span>🚩 ${esc(f)}</span>`).join("")}</div>` : "") +
            `<button type="button" id="gpNext" class="btn-start-game gp-next"><span>${last ? "💥 See Debrief" : finalLvl ? "🏁 Finish Mission" : "Next Level ▶"}</span></button>`;
        why.hidden = false;
        $("gpNext").addEventListener("click", advance);
        setTimeout(() => $("gpNext") && $("gpNext").focus({ preventScroll: true }), 60);
    }
}
window.selectCyberOption = function (opt, idx, btn) {
    if (G.locked) return; G.locked = true; stopTimer();
    const box = $("gameBoxContainer");
    if (opt.correct) {
        G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.right++;
        const pts = Math.max(0, 70 + Math.min(20, (G.streak - 1) * 10) + Math.round(G.timeLeft / LEVEL_TIME * 10) - (G.hintUsed ? 10 : 0));
        G.score = Math.min(MAX_SCORE, G.score + pts);
        sfx.ok(); buzz(30); if (box) box.classList.add("gp-flash-ok"); if (fxOK()) confetti();
        reveal(btn, opt, `${opt.feedback}  (+${pts} pts)`, true);
    } else {
        G.streak = 0; G.wrong++; G.lives--; G.score = Math.max(0, G.score - 20);
        sfx.bad(); buzz([120, 60, 120]); if (box && fxOK()) { void box.offsetWidth; box.classList.add("gp-shake"); }
        reveal(btn, opt, `${opt.feedback}  (-20 pts, -1 shield)`, false);
    }
    updateHud();
};
function timeUp() {
    if (G.locked) return; G.locked = true;
    G.streak = 0; G.wrong++; G.lives--; G.score = Math.max(0, G.score - 20);
    sfx.bad(); buzz([200]);
    const box = $("gameBoxContainer"); if (box && fxOK()) { void box.offsetWidth; box.classList.add("gp-shake"); }
    reveal(null, null, "⏱️ TIME'S UP! Scammers WANT you to rush. When pressured, stop and verify. (-20 pts, -1 shield)", false);
    updateHud();
}
function advance() {
    const g = cyberGamesConfig[G.id];
    if (G.lives <= 0) { G.over = true; return window.triggerEndGame(); }
    if (G.idx + 1 < g.scenarios.length) window.loadCyberLevel(G.id, G.idx + 1); else window.triggerEndGame();
}
window.triggerSpecialTool = function () {
    const g = cyberGamesConfig[G.id], r = $("specialToolResult");
    if (r && g && g.specialOutput) { r.innerText = g.specialOutput; r.classList.add("active"); }
};
window.triggerEndGame = function () {
    stopTimer();
    if (G.id === 6) return;
    runRadarLoader("FINALIZING THREAT DEFENSE CERTIFICATE...", () => {
        showScreen("gameEndScreen");
        const pct = G.score / MAX_SCORE * 100, rank = rankFor(pct), breached = G.lives <= 0;
        $("endScoreDisplay").innerText = `${G.score} / ${MAX_SCORE} PTS`;
        const er = $("endRankDisplay"); if (er) er.innerText = breached ? "Breached - " + rank : rank;
        const t = document.querySelector("#gameEndScreen .end-title"); if (t) t.textContent = breached ? "SYSTEM BREACHED - TRY AGAIN" : pct >= 70 ? "MISSION ACCOMPLISHED" : "MISSION DEBRIEF COMPLETE";
        const tr = document.querySelector("#gameEndScreen .end-trophy"); if (tr) tr.textContent = breached ? "💥" : pct >= 85 ? "🏆" : pct >= 60 ? "🥈" : "🎖️";
        const secs = Math.round((Date.now() - G.t0) / 1000), done = G.right + G.wrong, acc = done ? Math.round(G.right / done * 100) : 0;
        const st = $("gpEndStats");
        if (st) st.innerHTML = [["🎯", "Accuracy", acc + "%"], ["🔥", "Best streak", "x" + G.bestStreak], ["🛡️", "Shields left", G.lives + "/" + LIVES], ["💡", "Hints used", G.hints], ["⏱️", "Time", Math.floor(secs / 60) + "m " + (secs % 60) + "s"], ["⭐", "Stars", "★".repeat(starsFor(pct)) + "☆".repeat(3 - starsFor(pct))]].map(([i, l, v]) => `<div class="gp-stat"><span>${i}</span><small>${l}</small><b>${v}</b></div>`).join("");
        saveBest(G.id, G.score, MAX_SCORE);
        (breached ? sfx.lose : sfx.win)(); if (!breached && pct >= 60 && fxOK()) confetti(34);
        G.cert = `🛡️ CyberGuard SOC v5.0 Certificate\nGame: ${cyberGamesConfig[G.id].name}\nScore: ${G.score}/${MAX_SCORE} · Accuracy ${acc}% · Rank: ${rank}\nCan YOU beat my score? Play at CyberGuard.`;
    });
};
function copyCert() {
    const txt = G.cert || "CyberGuard SOC v5.0 - play the Cyber Defense Simulator!";
    const done = () => { const b = $("gpCopy"); if (b) { b.textContent = "✓ Copied!"; setTimeout(() => (b.textContent = "📋 Copy my certificate"), 1800); } };
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done).catch(() => { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (_) { } ta.remove(); });
}
function confetti(n = 22) {
    const host = document.querySelector(".game-container"); if (!host) return;
    const em = ["🛡️", "✅", "⭐", "💚", "🔒", "✨"];
    for (let i = 0; i < n; i++) {
        const s = document.createElement("span"); s.className = "gp-confetti"; s.textContent = em[i % em.length];
        s.style.cssText = `left:${10 + Math.random() * 80}%;--dx:${(Math.random() - .5) * 220}px;--dy:${-80 - Math.random() * 160}px;--r:${(Math.random() - .5) * 540}deg;animation-delay:${Math.random() * .15}s`;
        host.appendChild(s); setTimeout(() => s.remove(), 1700);
    }
}
document.addEventListener("keydown", e => {
    const play = $("gamePlayScreen"); if (!play || !play.classList.contains("active")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ""))) return;
    if (e.key >= "1" && e.key <= "4" && !G.locked) { const b = $("gameOptions").querySelectorAll("button")[+e.key - 1]; if (b) b.click(); }
    else if ((e.key === "Enter" || e.key === " ") && G.locked && $("gpNext") && e.target.id !== "gpNext") { e.preventDefault(); $("gpNext").click(); }
});

/* ============================================================
   4. GAME 6 - SCAM CALL LAB  (safe social-engineering experiment)
   ============================================================ */
const num = n => Number(n).toLocaleString("en-US");
const TACTIC_ICON = { Authority: "🎖️", Urgency: "⏱️", Fear: "😨", Greed: "💰", Trust: "🤝", Isolation: "🔒", Reciprocity: "🎁", "Social proof": "👥", "Sunk cost": "⛓️", Deflection: "🙈", Escalation: "📈", Intimidation: "👊" };
const PRESSURE = ["Hello? Sir, are you still there? Please hurry!", "Sir, time is running out. Please answer me now!", "Sir, I am only trying to help you. Don't waste time!"];
const W = (t, hook, next, extra) => Object.assign({ t, hook, next }, extra || {});

const CASES = [
    {
        id: "bank", icon: "🏦", title: "The 'Bank Fraud Officer'", tag: "OTP Vishing · Beginner", wallet: 120000, forcedLoss: 48500,
        blurb: "An urgent call from your 'bank' says a fraud transaction is in progress. Can you keep your OTP to yourself?",
        persona: { name: "Officer Kamran Ali", role: "Fraud Prevention Unit", avatar: "🧑‍💼", number: "+92 21 3••• 4410", callerId: "Bank Helpline", gender: "m", pitch: 0.9, bank: "BANK" },
        nodes: {
            start: { tactic: ["Authority"], say: ["Assalam-o-Alaikum, sir. I am Kamran from the Fraud Prevention Unit of your bank.", "Am I speaking with the account holder? This call is about an urgent security matter."], opts: [
                W("Walaikum Assalam. Yes, I'm the account holder. What happened?", 12, "n2"),
                W("Which bank? Tell me my account's last four digits first.", -12, "n2v"),
                W("I'll hang up and call the number printed on my card.", 0, "WIN")] },
            n2: { tactic: ["Fear", "Urgency"], say: ["Sir, a transaction of Rs. 48,500 is being made from your account to an unknown wallet right now. We have put it on a five-minute hold.", "To cancel it, I must verify you. Please tell me your full name and CNIC number."], opts: [
                W("Sure. My name is … and my CNIC number is …", 20, "n3", { info: "CNIC" }),
                W("Why do you need my CNIC? The bank already has it.", -12, "n3v"),
                W("Banks don't ask this on calls. Goodbye.", 0, "WIN")] },
            n2v: { tactic: ["Deflection"], say: ["Sir, for security policy I cannot read account details on an open line.", "Do you want your money stolen? Every second counts."], opts: [
                W("Okay, okay. What do you need from me?", 15, "n3"),
                W("No proof, no talk. I'm calling the bank myself.", 0, "WIN")] },
            n3v: { tactic: ["Urgency"], say: ["Sir, I understand, but the transaction completes in four minutes.", "Just confirm your name so I can open your file."], opts: [
                W("Fine, my name is …", 12, "n3", { info: "Name" }),
                W("Send me an official SMS from the bank first.", -10, "n4"),
                W("Goodbye.", 0, "WIN")] },
            n3: { tactic: ["Trust", "Authority"], sms: { from: "BANK-ALERT", text: "Your OTP for transfer of Rs. 48,500 to a new beneficiary is {otp}. Do NOT share it with anyone.", otp: true }, say: ["Thank you, sir. Now a verification code has been sent to your phone. This is to CANCEL the fraud.", "Please read that code to me right now."], opts: [
                W("The code is {otp}.", 40, "LOSE", { info: "OTP", money: 48500 }),
                W("The SMS says it's for a transfer. Why must I share it?", -14, "n4"),
                W("I never share OTPs with anyone.", -18, "n4"),
                W("I'm hanging up.", 0, "WIN")] },
            n4: { tactic: ["Fear", "Deflection"], say: ["Sir, that message wording is automatic, it is a system error. I am trying to SAVE your money.", "Two minutes left! If you refuse, the bank will not be responsible."], opts: [
                W("Okay, the code is {otp}.", 40, "LOSE", { info: "OTP", money: 48500 }),
                W("I'll visit my branch tomorrow instead.", -12, "n5"),
                W("This is a scam. Goodbye.", 0, "WIN")] },
            n5: { tactic: ["Escalation", "Urgency"], say: ["Sir, branch is closed, no time. Alternate method: I will WhatsApp you a link to our 'Bank Security App'.", "Install it and it will freeze the fraud automatically."], opts: [
                W("Alright, send the link. I'll install it.", 30, "LOSE", { info: "Device access", money: 71500 }),
                W("Never. I'm calling the helpline now.", 0, "WIN"),
                W("Blocking this number.", 0, "WIN")] }
        },
        endings: {
            WIN: { say: "Sir? Hello? … Tch.", sys: "📵 Call ended. The scammer got nothing." },
            LOSE: { say: "Thank you, sir. The case is now closed. Have a good day.", sys: "📵 Caller hung up. The 'case' was never real." },
            PARTIAL: { say: "Hello? Sir?", sys: "📵 Call ended." }
        },
        after: ["The OTP authorised a REAL transfer. The 'cancel the fraud' story was only cover.", "Your name and CNIC can be used to reset passwords, open mule accounts or sell your identity."],
        rules: ["Banks never ask for OTP, PIN or CNIC on a call.", "Caller ID can be faked. Hang up and dial the number printed on your card.", "Urgency + fear + authority is the classic vishing recipe.", "Never install an app from a link sent by a caller."]
    },
    {
        id: "courier", icon: "📦", title: "The 'Customs Parcel' Call", tag: "Digital-Arrest Scam · Advanced", wallet: 120000, forcedLoss: 100000,
        blurb: "A courier says a parcel in your name was seized. Then 'police' join the call. Will you stay calm?",
        persona: { name: "Sana (Global Express)", role: "Customs Desk", avatar: "👩‍💼", number: "+92 300 ••• 5521", callerId: "Global Express Courier", gender: "f", pitch: 1.1, bank: "BANK" },
        nodes: {
            start: { tactic: ["Fear"], say: ["Hello, this is Sana from Global Express Courier customs desk.", "A parcel booked under your CNIC from Malaysia has been seized. It contains five passports and illegal items. Do you know about this?"], opts: [
                W("No! I haven't ordered anything! What do I do?", 18, "b2"),
                W("Give me the tracking number. I'll check the courier's official app.", -14, "b2v"),
                W("Couriers don't call about customs like this. Goodbye.", 0, "WIN")] },
            b2v: { tactic: ["Deflection", "Authority"], say: ["Sir, the tracking number is confidential because of the investigation.", "I am now transferring you to the Cyber Crime Wing inspector."], opts: [
                W("Okay, connect me.", 10, "b3"),
                W("No tracking number, no conversation. Bye.", 0, "WIN")] },
            b2: { tactic: ["Authority", "Escalation"], say: ["Sir, this is serious. I am connecting you to Inspector Raza of the Cyber Crime Wing right now."], opts: [
                W("Please connect me.", 10, "b3"),
                W("Police don't take over a courier call. I'm hanging up.", 0, "WIN")] },
            b3: { tactic: ["Isolation", "Fear"], speaker: { name: "Inspector Raza", role: "Cyber Crime Wing", avatar: "👮", gender: "m", pitch: 0.78 }, say: ["Your CNIC is linked to money laundering. You are under digital investigation.", "Do not disconnect. Do not tell anyone, not even your family. This is confidential, or an arrest warrant will be issued."], opts: [
                W("I'm scared… what should I do?", 22, "b4"),
                W("I need to call my brother or a lawyer first.", -18, "b3v"),
                W("There is no 'digital arrest'. I'm reporting this number.", 0, "WIN")] },
            b3v: { tactic: ["Isolation", "Intimidation"], speaker: { name: "Inspector Raza", role: "Cyber Crime Wing", avatar: "👮", gender: "m", pitch: 0.78 }, say: ["If you tell anyone, the case becomes obstruction of justice.", "You have two minutes to cooperate."], opts: [
                W("Okay… I'll cooperate.", 16, "b4"),
                W("Goodbye. I'm calling the police myself.", 0, "WIN")] },
            b4: { tactic: ["Fear", "Trust"], speaker: { name: "Inspector Raza", role: "Cyber Crime Wing", avatar: "👮", gender: "m", pitch: 0.78 }, say: ["To prove your innocence, deposit Rs. 100,000 into our 'safe verification account'.", "It is fully refundable within twenty-four hours after verification."], opts: [
                W("Transferring it now…", 30, "LOSE", { info: "Bank transfer", money: 100000 }),
                W("Authorities never ask for money to prove innocence.", 0, "WIN"),
                W("I'll go to the nearest police station in person.", -8, "b5")] },
            b5: { tactic: ["Intimidation", "Urgency"], speaker: { name: "Inspector Raza", role: "Cyber Crime Wing", avatar: "👮", gender: "m", pitch: 0.78 }, say: ["If you step out, police will be at your door in twenty minutes with a warrant.", "Your family and neighbours will see everything. Pay now and avoid the shame."], opts: [
                W("Okay, I'll pay… please stop them.", 30, "LOSE", { info: "Bank transfer", money: 100000 }),
                W("Let them come. Goodbye.", 0, "WIN")] }
        },
        endings: {
            WIN: { say: "Sir? Sir, don't disconnect!", sys: "📵 You hung up. A 'digital arrest' only works if you stay on the line." },
            LOSE: { say: "Good. Stay on the line until the verification is complete.", sys: "📵 The money is gone. There was never a case, a warrant or an inspector." },
            PARTIAL: { say: "Hello?", sys: "📵 Call ended." }
        },
        after: ["There was no investigation. The 'safe account' belongs to a mule network and the money moves out within minutes.", "The 'tell nobody' rule exists so no one can tell you it's a scam."],
        rules: ["No real agency arrests or investigates over a phone or video call.", "Never move money to a 'safe' or 'verification' account.", "'Tell no one' is the biggest red flag - talk to someone you trust immediately.", "Hang up, then verify using the official helpline."]
    },
    {
        id: "job", icon: "💼", title: "The 'Easy Online Job' Recruiter", tag: "Task Scam · Intermediate", wallet: 120000, forcedLoss: 25000,
        blurb: "A friendly recruiter offers Rs. 8,000 a day for rating products. The first payout is real... Will you stop in time?",
        persona: { name: "Ayesha (Partner Team)", role: "HR Recruiter", avatar: "👩‍💻", number: "+44 7•• ••• 2093", callerId: "WhatsApp: Online Jobs", gender: "f", pitch: 1.15, bank: "JazzCash" },
        nodes: {
            start: { tactic: ["Greed"], say: ["Hi! I'm Ayesha from the partner team. You applied for our part-time job, right?", "You can earn Rs. 8,000 per day just by rating products for thirty minutes."], opts: [
                W("Sounds great! How does it work?", 16, "c2"),
                W("I never applied. How did you get my number?", -10, "c2v"),
                W("Real companies don't hire like this. Not interested.", 0, "WIN")] },
            c2v: { tactic: ["Reciprocity"], say: ["No problem, many people forget. Our system picks numbers from a database.", "Try one free task and see. No risk at all."], opts: [
                W("Okay, one free task.", 12, "c2"),
                W("Random numbers from a database? No thanks.", 0, "WIN")] },
            c2: { tactic: ["Reciprocity", "Greed"], say: ["Do three simple ratings now, and I will send Rs. 800 straight to your wallet as a welcome bonus."], opts: [
                W("Sure, send it.", 14, "c3"),
                W("Free money from a stranger? I'll pass.", 0, "WIN")] },
            c3: { tactic: ["Social proof", "Trust"], sms: { from: "JAZZCASH", text: "You have received Rs. 800 from AYESHA TRD. Your new balance has been updated.", otp: false }, say: ["See? Real money! Now join our private Telegram VIP group where members earn Rs. 15,000 daily.", "One step: deposit Rs. 5,000 to activate your merchant account. It is refundable with thirty percent profit."], opts: [
                W("Okay, depositing Rs. 5,000.", 26, "c4", { info: "Deposit", money: 5000 }),
                W("Why would I pay to get a job?", -14, "c3v"),
                W("That's the task-scam pattern. Blocking you.", 0, "WIN")] },
            c3v: { tactic: ["Social proof"], say: ["It's only a refundable security deposit, like a rental agreement.", "Look, two hundred and fourteen members are online in the group right now."], opts: [
                W("Fine, Rs. 5,000.", 20, "c4", { info: "Deposit", money: 5000 }),
                W("No deposit. Goodbye.", 0, "WIN")] },
            c4: { tactic: ["Escalation", "Urgency", "Sunk cost"], say: ["Congratulations! Level two tasks pay Rs. 60,000 commission, but need a Rs. 25,000 deposit.", "Don't lose the opportunity. The batch closes tonight."], opts: [
                W("Pay Rs. 25,000 to unlock the big commission.", 28, "c5", { money: 25000 }),
                W("I want to withdraw my money right now.", -6, "c5w"),
                W("I'm done. I'm reporting this.", 0, "PARTIAL")] },
            c5w: { tactic: ["Sunk cost", "Escalation"], say: ["Withdrawal is frozen: your task is incomplete. You must clear a Rs. 40,000 'tax' first.", "Then everything unlocks at once."], opts: [
                W("OK, paying the tax to get my money out.", 30, "LOSE", { money: 40000 }),
                W("This is a trap. I'm cutting my losses.", 0, "PARTIAL")] },
            c5: { tactic: ["Sunk cost", "Urgency"], say: ["Great. Task complete! To withdraw you must pass final verification: a Rs. 60,000 tax.", "After that, all your money arrives in one transfer."], opts: [
                W("Pay the tax.", 30, "LOSE", { money: 60000 }),
                W("No more. I'm reporting this.", 0, "PARTIAL")] }
        },
        endings: {
            WIN: { say: "Sir? Hello?", sys: "📵 You blocked the recruiter at the first request. Cost: Rs. 0." },
            LOSE: { say: "Thank you. Please wait 24 hours for processing.", sys: "📵 Blocked. The 'withdrawal' will never arrive." },
            PARTIAL: { say: "Wait, you will lose your earnings!", sys: "📵 You stopped - but the deposits already paid are gone." }
        },
        after: ["The Rs. 800 'bonus' was bait. Every deposit raises the next demand and withdrawals are never allowed.", "Task scams run on sunk cost: the more you've paid, the harder it feels to stop."],
        rules: ["A real job never asks you to pay to start working.", "Small early payouts are bait (reciprocity).", "Quit at the FIRST payment request - every extra deposit is lost.", "Never pay 'tax' or 'fees' to withdraw. Block and report."]
    }
];

/* ---------- lab state ---------- */
const L = { c: null, node: "start", hook: 0, peak: 0, lost: 0, info: [], log: [], voice: store.get("cg_lab_voice", "on") !== "off", running: false, token: 0, otp: "", t0: 0, callTimer: null, turnTimer: null, turnLeft: 0, ringTimer: null, speaker: null, caseIdx: 0 };
const fill = t => String(t).replace(/\{otp\}/g, L.otp);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function injectLab() {
    const host = document.querySelector(".game-container");
    if (!host || $("gameScamLabScreen")) return;
    host.insertAdjacentHTML("beforeend", `
    <div id="gameScamLabScreen" class="game-screen sl-screen">
        <div id="slPick" class="sl-pick">
            <div class="sl-pick-head"><span class="sl-kicker">🎭 SOCIAL EXPERIMENT · SCAM CALL LAB</span><h3>Pick a case file. A scammer is about to call YOU.</h3>
            <p>Everything is simulated. Nothing is recorded or sent anywhere. Answer the way you naturally would - the reveal shows which psychological tricks worked on you.</p></div>
            <div class="sl-cases" id="slCases"></div>
        </div>
        <div id="slCall" class="sl-call" hidden>
            <div class="sl-phone">
                <div class="sl-notch"></div>
                <div class="sl-statusbar"><span id="slClock">12:00</span><span>📶 🔋</span></div>
                <div class="sl-callhead">
                    <div class="sl-avatar" id="slAvatar"><span id="slAvatarEmoji">📞</span></div>
                    <div class="sl-callinfo"><b id="slName">Unknown</b><small id="slRole"></small><small id="slNumber"></small></div>
                    <div class="sl-callmeta"><span id="slTimer">00:00</span><div class="sl-wave" id="slWave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
                </div>
                <div class="sl-ring" id="slRing">
                    <div class="sl-ring-circle"><span id="slRingEmoji">📞</span></div>
                    <b id="slRingName">Incoming call…</b><small id="slRingId"></small><em>Incoming call · unknown number</em>
                    <div class="sl-ring-btns"><button type="button" class="sl-decline" id="slDecline">📵<span>Decline</span></button><button type="button" class="sl-accept" id="slAccept">📞<span>Accept</span></button></div>
                </div>
                <div class="sl-chat" id="slChat" aria-live="polite"></div>
                <div class="sl-turn" id="slTurn"><div id="slTurnFill"></div></div>
                <div class="sl-replies" id="slReplies"></div>
            </div>
            <aside class="sl-panel">
                <div class="sl-box"><div class="sl-box-h">🧠 SCAMMER'S HOLD ON YOU <b id="slHookEmoji">😎</b></div><div class="sl-hook"><i id="slHookFill"></i></div><small id="slHookTxt">Calm &amp; in control</small></div>
                <div class="sl-box"><div class="sl-box-h">💰 YOUR WALLET</div><div class="sl-wallet" id="slWallet">Rs. 0</div><small id="slLostTxt"></small></div>
                <div class="sl-box"><div class="sl-box-h">📲 YOUR PHONE</div><div class="sl-sms" id="slSms"><small>No new messages</small></div></div>
                <div class="sl-box"><div class="sl-box-h">🕵️ INFO YOU'VE GIVEN</div><div id="slInfo" class="sl-info"><small>Nothing yet</small></div></div>
                <div class="sl-controls"><button type="button" id="slVoice" class="btn-secondary-small"></button><button type="button" id="slHang" class="sl-hang">📵 Hang up</button></div>
            </aside>
        </div>
        <div id="slReveal" class="sl-reveal" hidden></div>
    </div>`);
    $("slAccept").addEventListener("click", acceptCall);
    $("slDecline").addEventListener("click", () => finish("DECLINED"));
    $("slHang").addEventListener("click", hangUp);
    $("slVoice").addEventListener("click", () => { L.voice = !L.voice; store.set("cg_lab_voice", L.voice ? "on" : "off"); if (!L.voice) speechCancel(); syncVoiceBtn(); });
    syncVoiceBtn();
}
function syncVoiceBtn() { const b = $("slVoice"); if (b) b.textContent = L.voice ? "🔊 Voice ON" : "🔇 Voice OFF (captions)"; }

function stopLab() {
    L.running = false; L.token++;
    clearInterval(L.ringTimer); L.ringTimer = null; clearInterval(L.callTimer); L.callTimer = null; clearInterval(L.turnTimer); L.turnTimer = null;
    speechCancel(); buzz(0);
}
function speechCancel() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) { } const w = $("slWave"); if (w) w.classList.remove("talking"); }
function pickVoice(p) {
    try {
        const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; if (!vs.length) return null;
        const en = vs.filter(v => /^en/i.test(v.lang)), pool = en.length ? en : vs;
        const rank = v => { let s = 0; if (/en-IN|en-PK/i.test(v.lang)) s += 4; else if (/en-GB/i.test(v.lang)) s += 2; const fem = /female|zira|samantha|susan|heera|neerja|aria|jenny|hazel|libby|sonia|karen|tessa|veena/i.test(v.name); if ((p.gender === "f") === fem) s += 3; if (/natural|neural|online/i.test(v.name)) s += 1; return s; };
        return [...pool].sort((a, b) => rank(b) - rank(a))[0];
    } catch (_) { return null; }
}
function speak(text, who) {
    const tok = L.token;
    const wave = $("slWave");
    const fallback = Math.min(3200, 700 + text.length * 24);
    if (!L.voice || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return sleep(fallback);
    return new Promise(res => {
        let done = false; const end = () => { if (done) return; done = true; if (wave) wave.classList.remove("talking"); res(); };
        try {
            const u = new SpeechSynthesisUtterance(text.replace(/…/g, "..."));
            const v = pickVoice(who || L.c.persona); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
            u.rate = 0.98; u.pitch = (who || L.c.persona).pitch || 1; u.onend = end; u.onerror = end;
            if (wave) wave.classList.add("talking");
            window.speechSynthesis.speak(u);
            setTimeout(end, Math.min(16000, text.length * 95 + 2500));
        } catch (_) { end(); }
    }).then(() => { if (tok !== L.token) return; });
}

/* ---------- case selection ---------- */
function startLab() {
    injectLab(); stopLab();
    showScreen("gameScamLabScreen");
    $("slPick").hidden = false; $("slCall").hidden = true; $("slReveal").hidden = true;
    const b = bests()[6];
    $("slCases").innerHTML = CASES.map((c, i) => `<button type="button" class="sl-case" data-i="${i}"><span class="sl-case-ico">${c.icon}</span><b>${esc(c.title)}</b><small>${esc(c.tag)}</small><p>${esc(c.blurb)}</p><span class="sl-case-go">📞 Take the call</span></button>`).join("") +
        (b ? `<div class="sl-best">🏅 Best defense score: <b>${b.score}/100</b> ${"★".repeat(b.stars)}${"☆".repeat(3 - b.stars)}</div>` : "");
    $("slCases").querySelectorAll(".sl-case").forEach(el => el.addEventListener("click", () => pickCase(+el.dataset.i)));
    const sec = $("game"); if (sec && sec.scrollIntoView && window.innerWidth < 900) sec.scrollIntoView({ block: "start", behavior: "smooth" });
}
function pickCase(i) {
    stopLab(); injectLab();
    const c = CASES[i]; L.c = c; L.caseIdx = i; L.node = "start"; L.hook = 0; L.peak = 0; L.lost = 0; L.info = []; L.log = []; L.speaker = null;
    L.otp = String(Math.floor(100000 + Math.random() * 900000)); L.running = false;
    $("slPick").hidden = true; $("slReveal").hidden = true; $("slCall").hidden = false;
    $("slChat").innerHTML = ""; $("slReplies").innerHTML = ""; $("slSms").innerHTML = "<small>No new messages</small>"; $("slInfo").innerHTML = "<small>Nothing yet</small>";
    setSpeaker(c.persona, true);
    $("slRingName").textContent = c.persona.callerId; $("slRingId").textContent = c.persona.number; $("slRingEmoji").textContent = "📞";
    $("slTimer").textContent = "00:00"; $("slTurn").classList.remove("on");
    $("slRing").hidden = false; $("slCall").classList.add("is-ringing");
    $("slClock").textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    updateMeters(true);
    startRing();
    const ph = document.querySelector(".sl-phone"); if (ph && ph.scrollIntoView && window.innerWidth < 900) ph.scrollIntoView({ block: "center", behavior: "smooth" });
}
function setSpeaker(p, initial) {
    L.speaker = p;
    $("slName").textContent = p.name; $("slRole").textContent = p.role || ""; if (p.number) $("slNumber").textContent = p.number;
    $("slAvatarEmoji").textContent = p.avatar || "📞";
}
function startRing() {
    clearInterval(L.ringTimer);
    const pat = () => { tone(440, .32, "sine", .07); tone(480, .32, "sine", .07); tone(440, .32, "sine", .07, .5); tone(480, .32, "sine", .07, .5); buzz([300, 150, 300]); };
    pat(); L.ringTimer = setInterval(pat, 2800);
}
function acceptCall() {
    clearInterval(L.ringTimer); L.ringTimer = null; buzz(0);
    $("slRing").hidden = true; $("slCall").classList.remove("is-ringing");
    L.running = true; L.t0 = Date.now();
    clearInterval(L.callTimer);
    L.callTimer = setInterval(() => { const s = Math.floor((Date.now() - L.t0) / 1000); $("slTimer").textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 1000);
    sfx.start();
    try { if (window.speechSynthesis) { window.speechSynthesis.getVoices(); } } catch (_) { }
    playNode("start");
}
function hangUp() {
    if (!L.c) return;
    if (!L.running && !$("slRing").hidden) return finish("DECLINED");
    if (!L.running) return;
    finish(L.lost > 0 ? "PARTIAL" : "WIN");
}

/* ---------- conversation ---------- */
function addBubble(side, text) {
    const chat = $("slChat"), d = document.createElement("div");
    d.className = "sl-b sl-" + side; d.textContent = text;
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
}
function addSystem(text) { const chat = $("slChat"), d = document.createElement("div"); d.className = "sl-sys"; d.textContent = text; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; }
async function typing(tok, text) {
    const chat = $("slChat"), d = document.createElement("div"); d.className = "sl-b sl-them sl-typing"; d.innerHTML = "<i></i><i></i><i></i>";
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
    await sleep(Math.min(1500, 450 + text.length * 9)); d.remove();
}
function pushSms(s) {
    sfx.sms(); buzz([80, 40, 80]);
    const box = $("slSms"); if (box.querySelector("small")) box.innerHTML = "";
    const d = document.createElement("div"); d.className = "sl-sms-item" + (s.otp ? " is-otp" : "");
    d.innerHTML = `<b>${esc(s.from)}</b><span>${esc(fill(s.text))}</span>`;
    box.prepend(d); while (box.children.length > 3) box.lastChild.remove();
}
async function playNode(id) {
    const tok = ++L.token, n = L.c.nodes[id]; if (!n) return;
    L.node = id; clearReplies(); stopTurn();
    if (n.speaker && (!L.speaker || L.speaker.name !== n.speaker.name)) { addSystem("📞 Call transferred to " + n.speaker.name); setSpeaker(Object.assign({}, L.c.persona, n.speaker), false); sfx.sms(); }
    for (let i = 0; i < n.say.length; i++) {
        if (tok !== L.token) return;
        await typing(tok, n.say[i]); if (tok !== L.token) return;
        addBubble("them", n.say[i]);
        if (i === 0 && n.sms) setTimeout(() => { if (tok === L.token) pushSms(n.sms); }, 700);
        await speak(n.say[i], L.speaker); if (tok !== L.token) return;
        if (i < n.say.length - 1) await sleep(250);
    }
    if (tok !== L.token || !L.running) return;
    showReplies(n);
}
function clearReplies() { const r = $("slReplies"); if (r) r.innerHTML = ""; }
function showReplies(n) {
    const box = $("slReplies"); box.innerHTML = "";
    shuffle(n.opts).forEach(o => {
        const b = document.createElement("button"); b.type = "button"; b.className = "sl-reply"; b.textContent = fill(o.t);
        b.addEventListener("click", () => choose(o)); box.appendChild(b);
    });
    startTurn();
}
function startTurn() {
    stopTurn(); L.turnLeft = 15; const fillEl = $("slTurnFill"), wrap = $("slTurn"); wrap.classList.add("on");
    const paint = () => { fillEl.style.width = (L.turnLeft / 15 * 100) + "%"; wrap.classList.toggle("low", L.turnLeft <= 5); };
    paint();
    L.turnTimer = setInterval(() => {
        if (document.hidden) return;
        L.turnLeft = Math.max(0, L.turnLeft - 0.25); paint();
        if (L.turnLeft <= 0) { stopTurn(); onTimeout(); }
    }, 250);
}
function stopTurn() { clearInterval(L.turnTimer); L.turnTimer = null; const w = $("slTurn"); if (w) w.classList.remove("on"); }
async function onTimeout() {
    if (!L.running) return;
    const tok = ++L.token;
    L.hook = clamp(L.hook + 10, 0, 100); L.peak = Math.max(L.peak, L.hook); updateMeters();
    const line = PRESSURE[Math.floor(Math.random() * PRESSURE.length)];
    addBubble("them", line); sfx.bad();
    await speak(line, L.speaker); if (tok !== L.token || !L.running) return;
    if (L.hook >= 100) return finish("LOSE");
    startTurn();
}
function choose(opt) {
    if (!L.running) return; stopTurn(); L.token++;
    const n = L.c.nodes[L.node];
    addBubble("me", fill(opt.t)); clearReplies();
    L.log.push({ tactics: n.tactic || [], worked: (opt.hook || 0) > 0 });
    L.hook = clamp(L.hook + (opt.hook || 0), 0, 100); L.peak = Math.max(L.peak, L.hook);
    if (opt.info && !L.info.includes(opt.info)) L.info.push(opt.info);
    if (opt.money) L.lost += opt.money;
    updateMeters();
    let next = opt.next;
    if (L.hook >= 100 && next !== "WIN") next = "LOSE";
    if (next === "WIN" || next === "LOSE" || next === "PARTIAL") return finish(next);
    playNode(next);
}
function updateMeters(first) {
    const h = L.hook, f = $("slHookFill"); if (f) f.style.width = Math.max(3, h) + "%";
    const emo = h < 25 ? ["😎", "Calm & in control"] : h < 50 ? ["🤔", "Doubtful - good instincts"] : h < 75 ? ["😰", "Feeling pressured"] : ["🥴", "The scammer is in control"];
    $("slHookEmoji").textContent = emo[0]; $("slHookTxt").textContent = emo[1];
    const bar = $("slHookFill"); if (bar) bar.className = h < 25 ? "ok" : h < 50 ? "mid" : h < 75 ? "warn" : "bad";
    const wal = $("slWallet"); if (wal && first) { delete wal.dataset.anim; wal.classList.remove("is-drain"); wal.textContent = "Rs. " + num(L.c.wallet); }
    $("slLostTxt").textContent = L.lost ? "⚠️ Rs. " + num(L.lost) + " at risk / lost" : "";
    const inf = $("slInfo"); if (inf) inf.innerHTML = L.info.length ? L.info.map(i => `<span class="sl-chip">${esc(i)}</span>`).join("") : "<small>Nothing yet</small>";
}
async function animateWallet() {
    const wal = $("slWallet"), from = L.c.wallet, to = Math.max(0, from - L.lost);
    wal.dataset.anim = "1"; wal.classList.add("is-drain");
    if (!fxOK()) { wal.textContent = "Rs. " + num(to); return; }
    const t0 = performance.now(), dur = 1400;
    await new Promise(res => { (function step(t) { const p = Math.min(1, (t - t0) / dur); wal.textContent = "Rs. " + num(Math.round(from - (from - to) * p)); if (p < 1) requestAnimationFrame(step); else res(); })(t0); });
}

/* ---------- ending + reveal ---------- */
async function finish(type) {
    if (L.ending) return; L.ending = true;
    try {
        L.running = false; stopTurn(); clearInterval(L.callTimer); L.callTimer = null; clearInterval(L.ringTimer); L.ringTimer = null; buzz(0);
        const tok = ++L.token; speechCancel(); clearReplies();
        if (type === "LOSE" && L.lost === 0) L.lost = L.c.forcedLoss;
        if (type === "WIN" && L.lost > 0) type = "PARTIAL";
        if (type === "DECLINED") { $("slRing").hidden = true; $("slCall").classList.remove("is-ringing"); showReveal("DECLINED"); return; }
        const e = L.c.endings[type];
        if (e.say) { addBubble("them", e.say); await speak(e.say, L.speaker); }
        addSystem(e.sys);
        if (L.lost > 0) {
            await animateWallet();
            pushSms({ from: L.c.persona.bank || "BANK", text: "Rs. " + num(L.lost) + " debited from your account. If this wasn't you, call the helpline immediately.", otp: false });
            $("slLostTxt").textContent = "💥 Rs. " + num(L.lost) + " lost";
        }
        (type === "WIN" ? sfx.win : sfx.lose)();
        if (type === "WIN" && fxOK()) confetti(18);
        await sleep(type === "WIN" ? 1500 : 2200);
        showReveal(type);
    } finally { L.ending = false; }
}
function defenseScore(type) {
    let s;
    if (type === "WIN") s = 100 - Math.round(L.peak * 0.35) - 6 * L.info.length;
    else if (type === "DECLINED") s = 88;
    else if (type === "PARTIAL") s = 62 - Math.round(L.lost / L.c.wallet * 60) - 4 * L.info.length;
    else s = 26 - Math.round(L.lost / L.c.wallet * 20);
    return clamp(Math.round(s), type === "LOSE" ? 3 : 10, 100);
}
function showReveal(type) {
    const c = L.c, score = defenseScore(type), stars = starsFor(score);
    const tacMap = new Map();
    L.log.forEach(l => (l.tactics || []).forEach(t => tacMap.set(t, (tacMap.get(t) || false) || l.worked)));
    const worked = [...tacMap.values()].filter(Boolean).length;
    const head = {
        WIN: ["🏆", "SCAM DEFEATED", "You ended the call before the scammer got what he wanted."],
        PARTIAL: ["⚠️", "PARTIAL DAMAGE", "You stopped - but only after Rs. " + num(L.lost) + " was already gone."],
        LOSE: ["💥", "YOU GOT SCAMMED (in the experiment)", "Nothing was real. Millions of people fall for exactly this - here is why it works."],
        DECLINED: ["📵", "YOU DIDN'T PICK UP", "Ignoring unknown callers is a strong first defence."]
    }[type];
    const cls = type === "WIN" || type === "DECLINED" ? "ok" : type === "PARTIAL" ? "mid" : "bad";
    const secs = L.t0 && type !== "DECLINED" ? Math.round((Date.now() - L.t0) / 1000) : 0;
    const tactics = [...tacMap.entries()].map(([t, w]) => `<li class="${w ? "worked" : "resisted"}"><span>${TACTIC_ICON[t] || "🎭"}</span><b>${esc(t)}</b><em>${w ? "⚠️ worked on you" : "✅ you resisted"}</em></li>`).join("");
    const body = type === "DECLINED"
        ? `<p class="sl-rv-p">But scammers use spoofed caller IDs and call again from new numbers. <b>Block and report</b> the number, and never call back unknown numbers. Want to feel how the tricks actually work? Answer the call in the experiment.</p>`
        : `${tactics ? `<h4>🕵️ Tricks used on you <small>${worked}/${tacMap.size} worked</small></h4><ul class="sl-tactics">${tactics}</ul>` : ""}
           ${type !== "WIN" ? `<h4>🎯 What would have happened next</h4><ul class="sl-ul">${c.after.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : `<h4>🎯 Why you won</h4><ul class="sl-ul"><li>You stopped, refused to be rushed, and verified instead of obeying.</li>${L.info.length ? `<li>Careful: you shared <b>${esc(L.info.join(", "))}</b> earlier - watch for follow-up scams and change passwords/PINs if needed.</li>` : ""}</ul>`}
           <h4>✅ Do this instead</h4><ul class="sl-ul">${c.rules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>`;
    const rv = $("slReveal");
    rv.innerHTML = `
        <div class="sl-rv-head ${cls}"><div class="sl-rv-ico">${head[0]}</div><div class="sl-rv-t"><h3>${head[1]}</h3><p>${head[2]}</p></div>
            <div class="sl-rv-score"><b>${score}</b><small>/100 · ${"★".repeat(stars)}${"☆".repeat(3 - stars)}</small></div></div>
        ${type === "DECLINED" ? "" : `<div class="sl-rv-grid"><div><small>Call length</small><b>${Math.floor(secs / 60)}m ${secs % 60}s</b></div><div><small>Peak 'hold' on you</small><b>${L.peak}%</b></div><div><small>Info shared</small><b>${L.info.length ? esc(L.info.join(", ")) : "none"}</b></div><div><small>Money lost</small><b>${L.lost ? "Rs. " + num(L.lost) : "Rs. 0"}</b></div></div>`}
        ${body}
        <div class="sl-rv-actions">
            ${type === "DECLINED" ? `<button type="button" class="btn-start-game" id="slAnswer"><span>📞 Answer the call</span></button>` : `<button type="button" class="btn-start-game" id="slAgain"><span>🔁 Replay this case</span></button>`}
            <button type="button" class="btn-secondary" id="slOther">🎭 Another case</button>
            <button type="button" class="btn-secondary" id="slNext">🎮 Next game →</button>
        </div>`;
    $("slCall").hidden = true; rv.hidden = false;
    if (type !== "DECLINED") saveBest(6, score, 100);
    const again = () => pickCase(L.caseIdx);
    $("slAgain")?.addEventListener("click", again);
    $("slAnswer")?.addEventListener("click", () => { pickCase(L.caseIdx); });
    $("slOther").addEventListener("click", startLab);
    $("slNext").addEventListener("click", () => window.switchCyberGame(1));
    rv.scrollIntoView && window.innerWidth < 900 && rv.scrollIntoView({ block: "start", behavior: "smooth" });
}

/* ---------- boot ---------- */
function boot() {
    injectUI(); injectLab();
    if (window.speechSynthesis) { try { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => { }; } catch (_) { } }
    window.switchCyberGame(1);
}
window.addEventListener("beforeunload", stopLab);
document.addEventListener("visibilitychange", () => { if (document.hidden) speechCancel(); });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
window.CG_GAMES_PRO = { CASES, config: cyberGamesConfig, EXTRA };
})();