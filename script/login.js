/**
 * Ni-Kshay Automation - Phone User Activation Controller
 */
(function () {
    const usernameInput = document.getElementById("username");
    const tokenInput = document.getElementById("token");
    const btnPaste = document.getElementById("btnPaste");
    const authForm = document.getElementById("authForm");
    const alertBox = document.getElementById("alertBox");
    const btnWhatsAppAdmin = document.getElementById("btnWhatsAppAdmin");

    function showAlert(msg, isSuccess = false) {
        alertBox.style.display = "block";
        if (isSuccess) {
            alertBox.style.background = "#0e2a1a";
            alertBox.style.borderColor = "#2ecc71";
            alertBox.style.color = "#c8e6c9";
        } else {
            alertBox.style.background = "#3b1111";
            alertBox.style.borderColor = "#e74c3c";
            alertBox.style.color = "#ffb3ba";
        }
        alertBox.innerText = msg;
    }

    // Check query params for expired flag
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("expired")) {
        showAlert("⚠️ Your access token has expired. Please enter the new renewed token provided by your Admin.");
    }

    // Pre-fill previously stored username if available
    window.NikshayAuth.getAuthSession().then(session => {
        if (session?.username) {
            if (!usernameInput.value) {
                usernameInput.value = session.username;
            }
            updateWhatsAppLink();
            if (!urlParams.has("expired")) {
                const daysLeft = Math.ceil(Math.max(0, session.expiresAt - Date.now()) / 86400000);
                if (daysLeft > 0) {
                    showAlert(`Active License: ${session.username} (${daysLeft} days remaining). Paste a new token below to renew or extend access.`, true);
                }
            }
        }
    }).catch(() => {});

    function updateWhatsAppLink() {
        const u = usernameInput.value.trim() || "my account";
        const text = `Hello Admin, please provide a Ni-Kshay Automation access token for Login ID: ${u}`;
        btnWhatsAppAdmin.href = `https://api.whatsapp.com/send?phone=917006444824&text=${encodeURIComponent(text)}`;
    }

    usernameInput.addEventListener("input", updateWhatsAppLink);

    // Paste button
    btnPaste.addEventListener("click", async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                tokenInput.value = text.trim();
                tokenInput.focus();
                autoExtractUsernameFromToken();
            }
        } catch (_) {
            alert("Please paste the token manually into the text box.");
        }
    });

    function autoExtractUsernameFromToken() {
        try {
            const val = tokenInput.value.trim();
            const parts = val.split(".");
            if (parts.length === 3 && parts[0] === "NKA1") {
                let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
                while (base64.length % 4) base64 += "=";
                const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
                if (payload && payload.u && !usernameInput.value.trim()) {
                    usernameInput.value = payload.u;
                    updateWhatsAppLink();
                }
            }
        } catch (_) {}
    }

    tokenInput.addEventListener("input", autoExtractUsernameFromToken);

    // Form submission
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const token = tokenInput.value.trim();

        if (!username) {
            showAlert("Please enter your Login ID / Username.");
            return;
        }

        if (!token) {
            showAlert("Please paste your access token.");
            return;
        }

        try {
            showAlert("Validating token signature...", true);
            const session = await window.NikshayAuth.saveAuthSession(token, username);

            const expDate = new Date(session.expiresAt).toLocaleDateString("en-IN");
            showAlert(`✅ Access Granted! Token active until ${expDate}. Loading app...`, true);

            setTimeout(() => {
                location.href = "option.html";
            }, 1200);
        } catch (err) {
            showAlert("❌ " + err.message);
        }
    });

    updateWhatsAppLink();

    // Ensure soft keyboard opens when user taps input fields
    [usernameInput, tokenInput].forEach(el => {
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

    // Hide Admin Console link if running in the client Automation app
    try {
        if (window.AndroidBridge && typeof window.AndroidBridge.getAppFlavor === "function") {
            if (window.AndroidBridge.getAppFlavor() === "automation") {
                const adminLink = document.querySelector('a[href="admin.html"]');
                if (adminLink) {
                    const sep = adminLink.nextElementSibling;
                    if (sep && sep.tagName === "SPAN") sep.remove();
                    adminLink.remove();
                }
            }
        }
    } catch (_) {}
})();
