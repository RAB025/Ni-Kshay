/**
 * Ni-Kshay Automation - Cryptographic Token & Authentication Engine
 * Implements tamper-proof HMAC-SHA256 signed tokens for time-bound user access.
 */
(function (global) {
    // Default Admin Master Secret (changeable in Admin Console)
    const DEFAULT_SECRET = "NiKshay_Automation_Master_Secret_2026_SecureKey#99";
    const SESSION_STORAGE_KEY = "nikshay_auth_session";

    /**
     * Converts string to Uint8Array UTF-8 bytes
     */
    function strToBytes(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Converts Uint8Array bytes to hex string
     */
    function bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * Base64URL encode string
     */
    function base64UrlEncode(str) {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    /**
     * Base64URL decode string
     */
    function base64UrlDecode(str) {
        let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
            base64 += "=";
        }
        return decodeURIComponent(escape(atob(base64)));
    }

    /**
     * Computes HMAC-SHA256 signature using Web Crypto API
     */
    async function computeHmacSha256(dataStr, secretKey) {
        const keyData = strToBytes(secretKey);
        const cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: { name: "SHA-256" } },
            false,
            ["sign", "verify"]
        );
        const signatureBytes = await window.crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            strToBytes(dataStr)
        );
        return bytesToHex(new Uint8Array(signatureBytes));
    }

    /**
     * Generates a signed tamper-proof token
     * @param {string} username - User/Staff Login ID (e.g. nurse_01 or sts_anantnag)
     * @param {number|Date} durationOrExpiry - Duration in days OR exact Date object / timestamp
     * @param {string} [passcode] - Optional user passcode
     * @param {string} [secretKey] - Master Admin signing key
     */
    async function generateToken(username, durationOrExpiry, passcode = "", secretKey = DEFAULT_SECRET) {
        const cleanUser = String(username || "").trim().toLowerCase();
        if (!cleanUser) {
            throw new Error("Login ID / Username is required to generate a token.");
        }

        const now = Date.now();
        let expTime;

        if (durationOrExpiry instanceof Date) {
            expTime = durationOrExpiry.getTime();
        } else if (typeof durationOrExpiry === "number") {
            if (durationOrExpiry > 1000000000000) {
                // Already a timestamp in ms
                expTime = durationOrExpiry;
            } else {
                // Duration in days
                expTime = now + (durationOrExpiry > 0 ? durationOrExpiry * 86400000 : 30 * 86400000);
            }
        } else {
            // Default 30 days
            expTime = now + (30 * 86400000);
        }

        if (expTime <= now) {
            throw new Error("Expiration time must be in the future.");
        }

        const payloadObj = {
            u: cleanUser,
            p: passcode ? passcode.trim() : "",
            iat: now,
            exp: expTime
        };

        const payloadJson = JSON.stringify(payloadObj);
        const payloadBase64 = base64UrlEncode(payloadJson);
        const messageToSign = `NKA1.${payloadBase64}`;
        const signatureHex = await computeHmacSha256(messageToSign, secretKey);

        const token = `${messageToSign}.${signatureHex}`;
        return {
            token,
            username: cleanUser,
            issuedAt: new Date(now),
            expiresAt: new Date(expTime),
            durationDays: Math.round((expTime - now) / 86400000)
        };
    }

    /**
     * Verifies and inspects a token
     * @param {string} tokenStr - The token string (NKA1.<base64>.<signature>)
     * @param {string} [expectedUser] - Optional username to match against
     * @param {string} [secretKey] - Master Admin secret key
     */
    async function verifyToken(tokenStr, expectedUser = "", secretKey = DEFAULT_SECRET) {
        if (!tokenStr || typeof tokenStr !== "string") {
            return { valid: false, reason: "Token is missing or empty." };
        }

        const cleanToken = tokenStr.trim();
        const parts = cleanToken.split(".");
        if (parts.length !== 3 || parts[0] !== "NKA1") {
            return { valid: false, reason: "Invalid token format. Must be an NKA1 token." };
        }

        const [prefix, payloadBase64, providedSig] = parts;
        let payload;
        try {
            const jsonStr = base64UrlDecode(payloadBase64);
            payload = JSON.parse(jsonStr);
        } catch (e) {
            return { valid: false, reason: "Corrupted token payload." };
        }

        if (!payload || !payload.u || !payload.exp) {
            return { valid: false, reason: "Invalid payload fields in token." };
        }

        // Verify cryptographic HMAC-SHA256 signature
        const expectedSig = await computeHmacSha256(`${prefix}.${payloadBase64}`, secretKey);
        if (expectedSig.toLowerCase() !== providedSig.toLowerCase()) {
            return { valid: false, reason: "Invalid or forged token signature. Token has been modified or created with wrong key." };
        }

        // Verify username match if expected
        if (expectedUser) {
            const cleanExpected = expectedUser.trim().toLowerCase();
            if (payload.u.toLowerCase() !== cleanExpected) {
                return {
                    valid: false,
                    reason: `Token is for username '${payload.u}', but entered username is '${cleanExpected}'.`
                };
            }
        }

        // Verify expiration & anti-tamper clock check
        const now = Date.now();
        if (payload.iat && (now < payload.iat - 300000)) {
            return {
                valid: false,
                reason: "Device clock error: Phone date is set before token issue date. Please set automatic date & time."
            };
        }
        const isExpired = now >= payload.exp;
        const remainingMs = Math.max(0, payload.exp - now);
        const remainingDays = Math.ceil(remainingMs / 86400000);

        return {
            valid: !isExpired,
            isExpired,
            reason: isExpired ? `Token expired on ${new Date(payload.exp).toLocaleDateString()}` : "Token is active and valid.",
            username: payload.u,
            passcode: payload.p || "",
            issuedAt: new Date(payload.iat),
            expiresAt: new Date(payload.exp),
            remainingDays,
            remainingMs
        };
    }

    /**
     * Stores active auth session in chrome.storage.sync and localStorage
     */
    async function saveAuthSession(token, username, passcode = "") {
        const verification = await verifyToken(token, username);
        if (!verification.valid) {
            throw new Error(verification.reason);
        }

        const sessionData = {
            token: token.trim(),
            username: verification.username,
            passcode: passcode || verification.passcode,
            expiresAt: verification.expiresAt.getTime(),
            issuedAt: verification.issuedAt.getTime(),
            activatedAt: Date.now()
        };

        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
                await chrome.storage.sync.set({ [SESSION_STORAGE_KEY]: sessionData, "status": true });
            }
        } catch (e) {}

        try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        } catch (e) {}

        return sessionData;
    }

    /**
     * Gets current auth session from storage
     */
    async function getAuthSession() {
        let session = null;
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
                const syncData = await chrome.storage.sync.get(SESSION_STORAGE_KEY);
                session = syncData?.[SESSION_STORAGE_KEY];
            }
        } catch (e) {}

        if (!session) {
            try {
                const raw = localStorage.getItem(SESSION_STORAGE_KEY);
                if (raw) session = JSON.parse(raw);
            } catch (e) {}
        }

        return session;
    }

    /**
     * Clears current auth session
     */
    async function clearAuthSession() {
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
                await chrome.storage.sync.remove(SESSION_STORAGE_KEY);
            }
        } catch (e) {}
        try {
            localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch (e) {}
    }

    /**
     * Checks if user has a valid, non-expired session.
     * Redirects to login.html if invalid or expired.
     * @param {boolean} [redirect=true]
     */
    async function checkAuthOrRedirect(redirect = true) {
        const session = await getAuthSession();
        if (!session || !session.token) {
            if (redirect && !location.pathname.includes("login.html") && !location.pathname.includes("admin.html")) {
                location.href = "login.html";
            }
            return { authenticated: false, reason: "No active session." };
        }

        const check = await verifyToken(session.token, session.username);
        if (!check.valid) {
            if (redirect && !location.pathname.includes("login.html") && !location.pathname.includes("admin.html")) {
                location.href = "login.html?expired=1";
            }
            return { authenticated: false, reason: check.reason, expired: check.isExpired };
        }

        return {
            authenticated: true,
            username: check.username,
            remainingDays: check.remainingDays,
            expiresAt: check.expiresAt
        };
    }

    global.NikshayAuth = {
        DEFAULT_SECRET,
        generateToken,
        verifyToken,
        saveAuthSession,
        getAuthSession,
        clearAuthSession,
        checkAuthOrRedirect
    };

})(typeof window !== "undefined" ? window : this);
