/**
 * Ni-Kshay Manager - Admin Console & User Management Controller
 */
(function () {
    const DEFAULT_PINS = ["admin2026", "2026"];
    const HISTORY_KEY = "nikshay_admin_token_history";
    const PIN_KEY = "nikshay_master_pin";

    let selectedDays = 30;
    let customDate = null;
    let currentGeneratedToken = null;

    // DOM Elements
    const loginGate = document.getElementById("loginGate");
    const adminDashboard = document.getElementById("adminDashboard");
    const adminPinInput = document.getElementById("adminPinInput");
    const btnUnlockAdmin = document.getElementById("btnUnlockAdmin");
    const btnLockConsole = document.getElementById("btnLockConsole");
    const pinError = document.getElementById("pinError");
    const pinDots = document.getElementById("pinDots")?.querySelectorAll(".pin-dot") || [];

    const inputUsername = document.getElementById("inputUsername");
    const inputPasscode = document.getElementById("inputPasscode");
    const presetButtons = document.querySelectorAll(".preset-btn");
    const btnCustomExpiry = document.getElementById("btnCustomExpiry");
    const customDateContainer = document.getElementById("customDateContainer");
    const customExpiryDate = document.getElementById("customExpiryDate");
    const btnGenerate = document.getElementById("btnGenerate");

    const resultCard = document.getElementById("resultCard");
    const resultBadge = document.getElementById("resultBadge");
    const resultUser = document.getElementById("resultUser");
    const resultExpires = document.getElementById("resultExpires");
    const resultTokenText = document.getElementById("resultTokenText");
    const btnCopyToken = document.getElementById("btnCopyToken");
    const btnShareWhatsApp = document.getElementById("btnShareWhatsApp");

    const verifyInput = document.getElementById("verifyInput");
    const btnVerify = document.getElementById("btnVerify");
    const verifyResult = document.getElementById("verifyResult");

    const historyList = document.getElementById("historyList");
    const historySearch = document.getElementById("historySearch");
    const btnClearHistory = document.getElementById("btnClearHistory");

    // 1. PIN Gate Logic & Keypad
    function updateDots() {
        const len = (adminPinInput?.value || "").length;
        pinDots.forEach((dot, idx) => {
            if (idx < len) {
                dot.classList.add("filled");
            } else {
                dot.classList.remove("filled");
            }
        });
    }

    function checkPinSession() {
        const unlocked = sessionStorage.getItem("nikshay_admin_unlocked") === "true";
        if (unlocked) {
            loginGate.style.display = "none";
            adminDashboard.style.display = "block";
            renderHistory();
        } else {
            loginGate.style.display = "flex";
            adminDashboard.style.display = "none";
            adminPinInput.value = "";
            updateDots();
        }
    }

    function isPinValid(pin) {
        const customPin = localStorage.getItem(PIN_KEY);
        if (customPin && pin === customPin) return true;
        return DEFAULT_PINS.includes(pin);
    }

    function unlockConsole() {
        const pin = adminPinInput.value.trim();
        if (isPinValid(pin)) {
            sessionStorage.setItem("nikshay_admin_unlocked", "true");
            pinError.style.display = "none";
            checkPinSession();
        } else {
            pinError.style.display = "block";
            pinError.innerText = "Invalid Access PIN. Try default (admin2026 or 2026)";
            adminPinInput.value = "";
            updateDots();
            adminPinInput.focus();
        }
    }

    btnUnlockAdmin.addEventListener("click", unlockConsole);

    adminPinInput.addEventListener("input", updateDots);
    adminPinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") unlockConsole();
    });

    // On-screen numeric keypad
    document.querySelectorAll(".keypad-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.getAttribute("data-key");
            if (key === "clear") {
                adminPinInput.value = adminPinInput.value.slice(0, -1);
            } else if (key === "enter") {
                unlockConsole();
                return;
            } else if (key !== null) {
                if (adminPinInput.value.length < 12) {
                    adminPinInput.value += key;
                }
            }
            updateDots();
            if (adminPinInput.value.length === 4 && (adminPinInput.value === "2026")) {
                unlockConsole();
            }
        });
    });

    if (btnLockConsole) {
        btnLockConsole.addEventListener("click", () => {
            sessionStorage.removeItem("nikshay_admin_unlocked");
            checkPinSession();
        });
    }

    // 2. Preset Duration Buttons
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            presetButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            if (btn === btnCustomExpiry) {
                customDateContainer.style.display = "block";
                selectedDays = null;
            } else {
                customDateContainer.style.display = "none";
                selectedDays = parseInt(btn.getAttribute("data-days"), 10) || 30;
                customDate = null;
            }
        });
    });

    customExpiryDate.addEventListener("change", (e) => {
        if (e.target.value) {
            customDate = new Date(e.target.value);
        }
    });

    // 3. Generate Token
    btnGenerate.addEventListener("click", async () => {
        const username = inputUsername.value.trim();
        const passcode = inputPasscode.value.trim();

        if (!username) {
            alert("Please enter a Client Login ID / Username (e.g. dr_sharma or health_center_01).");
            inputUsername.focus();
            return;
        }

        try {
            const targetDuration = customDate || selectedDays || 30;
            const res = await window.NikshayAuth.generateToken(username, targetDuration, passcode);
            currentGeneratedToken = res;

            resultUser.innerText = res.username;
            resultExpires.innerText = res.expiresAt.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
            });
            resultBadge.innerText = `${res.durationDays} Days`;
            resultTokenText.innerText = res.token;
            resultCard.style.display = "block";
            resultCard.scrollIntoView({ behavior: "smooth" });

            saveToHistory(res);
        } catch (err) {
            alert("Token generation failed: " + err.message);
        }
    });

    // 4. Copy Token
    btnCopyToken.addEventListener("click", () => {
        if (!currentGeneratedToken?.token) return;
        navigator.clipboard.writeText(currentGeneratedToken.token).then(() => {
            const originalText = btnCopyToken.innerText;
            btnCopyToken.innerText = "✅ Copied to Clipboard!";
            setTimeout(() => { btnCopyToken.innerText = originalText; }, 2000);
        }).catch(() => {
            alert("Please copy the token text manually from the box.");
        });
    });

    // 5. Share via WhatsApp
    function shareTokenWhatsApp(item) {
        const expDate = new Date(item.expiresAt).toLocaleDateString("en-IN");
        const msg = `*Ni-Kshay Automation Access Token*\n` +
            `👤 *User ID:* ${item.username}\n` +
            `⏳ *Valid For:* ${item.durationDays} Days\n` +
            `📅 *Expires On:* ${expDate}\n\n` +
            `🔑 *Token:*\n\`\`\`${item.token}\`\`\`\n\n` +
            `_Open Ni-Kshay Automation app, enter your Login ID, paste this token, and tap Activate._`;

        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, "_blank");
    }

    btnShareWhatsApp.addEventListener("click", () => {
        if (currentGeneratedToken) {
            shareTokenWhatsApp(currentGeneratedToken);
        }
    });

    // 6. Token Inspector / Verifier
    btnVerify.addEventListener("click", async () => {
        const token = verifyInput.value.trim();
        if (!token) {
            alert("Please paste a token to verify.");
            return;
        }

        const check = await window.NikshayAuth.verifyToken(token);
        verifyResult.style.display = "block";

        if (!check.valid) {
            verifyResult.innerHTML = `
                <div style="background:rgba(239,68,68,0.15); border:1px solid #EF4444; border-radius:10px; padding:14px;">
                    <strong style="color:#EF4444; font-size:14px;">❌ Invalid or Expired Token</strong>
                    <p style="margin:6px 0 0; font-size:12px; color:#ffb3ba;">${check.reason}</p>
                </div>
            `;
        } else {
            verifyResult.innerHTML = `
                <div style="background:rgba(16,185,129,0.15); border:1px solid #10B981; border-radius:10px; padding:14px;">
                    <strong style="color:#10B981; font-size:14px;">✅ Valid & Active Token</strong>
                    <div style="margin:8px 0 0; font-size:12px; color:#c8e6c9; line-height:1.6;">
                        • <strong>Client ID:</strong> ${check.username}<br>
                        • <strong>Issued On:</strong> ${check.issuedAt.toLocaleDateString("en-IN")}<br>
                        • <strong>Expires On:</strong> ${check.expiresAt.toLocaleString("en-IN")}<br>
                        • <strong>Remaining:</strong> ${check.remainingDays} days left
                    </div>
                </div>
            `;
        }
    });

    // 7. Token History & One-Click Renewal
    function getHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function saveToHistory(item) {
        const history = getHistory();
        history.unshift({
            username: item.username,
            durationDays: item.durationDays,
            expiresAt: item.expiresAt.getTime(),
            token: item.token
        });
        if (history.length > 50) history.pop();
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (_) {}
        renderHistory();
    }

    async function renewUser(username, days = 30) {
        if (!confirm(`Generate new ${days}-day renewal token for client '${username}'?`)) return;
        try {
            const res = await window.NikshayAuth.generateToken(username, days);
            currentGeneratedToken = res;

            resultUser.innerText = res.username;
            resultExpires.innerText = res.expiresAt.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
            });
            resultBadge.innerText = `${res.durationDays} Days (Renewed)`;
            resultTokenText.innerText = res.token;
            resultCard.style.display = "block";
            resultCard.scrollIntoView({ behavior: "smooth" });

            saveToHistory(res);

            // Open WhatsApp share immediately
            shareTokenWhatsApp(res);
        } catch (err) {
            alert("Renewal failed: " + err.message);
        }
    }

    if (historySearch) {
        historySearch.addEventListener("input", () => {
            renderHistory(historySearch.value.trim().toLowerCase());
        });
    }

    function renderHistory(filter = "") {
        const history = getHistory();
        if (!history || history.length === 0) {
            historyList.innerHTML = `<p style="color:#666; font-size:13px; text-align:center; padding:20px;">No clients registered yet.</p>`;
            return;
        }

        const filtered = filter ? history.filter(h => h.username.toLowerCase().includes(filter)) : history;
        if (filtered.length === 0) {
            historyList.innerHTML = `<p style="color:#888; font-size:13px; text-align:center; padding:20px;">No clients match '${filter}'.</p>`;
            return;
        }

        historyList.innerHTML = "";
        filtered.forEach((h) => {
            const isExp = Date.now() >= h.expiresAt;
            const daysRemaining = Math.max(0, Math.ceil((h.expiresAt - Date.now()) / 86400000));
            const expDateStr = new Date(h.expiresAt).toLocaleDateString("en-IN");
            const div = document.createElement("div");
            div.className = "history-card";

            div.innerHTML = `
                <div class="history-meta">
                    <div>
                        <span class="client-name">👤 ${h.username}</span>
                        <span class="badge ${isExp ? 'badge-red' : 'badge-green'}" style="margin-left:8px;">${isExp ? 'Expired' : daysRemaining + 'd left'}</span>
                    </div>
                    <span style="color:#888; font-size:11px;">Expires: ${expDateStr}</span>
                </div>
                <div class="history-actions">
                    <button class="btn-renew" style="padding:6px 12px;">⚡ Renew (+30d)</button>
                    <button class="btn-copy" style="padding:6px 12px;">📋 Copy</button>
                    <button class="btn-wa" style="padding:6px 12px;">💬 WhatsApp</button>
                </div>
            `;

            div.querySelector(".btn-renew").addEventListener("click", () => renewUser(h.username, 30));
            div.querySelector(".btn-copy").addEventListener("click", () => {
                navigator.clipboard.writeText(h.token).then(() => {
                    alert(`Token for ${h.username} copied to clipboard!`);
                });
            });
            div.querySelector(".btn-wa").addEventListener("click", () => shareTokenWhatsApp(h));

            historyList.appendChild(div);
        });
    }

    if (btnClearHistory) {
        btnClearHistory.addEventListener("click", () => {
            if (confirm("Clear client history list?")) {
                localStorage.removeItem(HISTORY_KEY);
                renderHistory();
            }
        });
    }

    // Ensure soft keyboard opens when user taps input fields
    [inputUsername, inputPasscode, verifyInput, historySearch, adminPinInput].forEach(el => {
        if (!el) return;
        el.addEventListener("click", () => {
            el.focus();
            try {
                if (window.AndroidBridge && typeof window.AndroidBridge.showKeyboard === "function") {
                    window.AndroidBridge.showKeyboard();
                }
            } catch (_) {}
        });
    });

    // Initialize
    checkPinSession();
})();
