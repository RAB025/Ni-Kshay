(function () {
    if (window.__nikshayChromeShimLoaded) return;
    window.__nikshayChromeShimLoaded = true;

    const storageListeners = new Set();

    window.__dispatchChromeStorageChanged = function (changes, namespace) {
        storageListeners.forEach((fn) => {
            try {
                fn(changes, namespace);
            } catch (e) {
                console.error("chrome.storage.onChanged listener error:", e);
            }
        });
    };

    function createStorageArea(namespace) {
        return {
            get(keys, callback) {
                let result = {};
                try {
                    const keysArg = keys === undefined || keys === null
                        ? "null"
                        : JSON.stringify(keys);
                    const raw = window.AndroidBridge
                        ? window.AndroidBridge.storageGet(namespace, keysArg)
                        : "{}";
                    result = raw ? JSON.parse(raw) : {};
                } catch (e) {
                    console.error("storageGet error:", e);
                    result = {};
                }
                if (typeof callback === "function") {
                    setTimeout(() => callback(result), 0);
                }
                return Promise.resolve(result);
            },
            set(items, callback) {
                try {
                    if (window.AndroidBridge && items && typeof items === "object") {
                        window.AndroidBridge.storageSet(namespace, JSON.stringify(items));
                    }
                } catch (e) {
                    console.error("storageSet error:", e);
                }
                if (typeof callback === "function") {
                    setTimeout(() => callback(), 0);
                }
                return Promise.resolve();
            },
            remove(keys, callback) {
                try {
                    const list = Array.isArray(keys) ? keys : [keys];
                    if (window.AndroidBridge) {
                        window.AndroidBridge.storageRemove(namespace, JSON.stringify(list));
                    }
                } catch (e) {
                    console.error("storageRemove error:", e);
                }
                if (typeof callback === "function") {
                    setTimeout(() => callback(), 0);
                }
                return Promise.resolve();
            },
            clear(callback) {
                try {
                    if (window.AndroidBridge) {
                        window.AndroidBridge.storageClear(namespace);
                    }
                } catch (e) {
                    console.error("storageClear error:", e);
                }
                if (typeof callback === "function") {
                    setTimeout(() => callback(), 0);
                }
                return Promise.resolve();
            }
        };
    }

    const existingChrome = window.chrome || {};
    window.chrome = Object.assign(existingChrome, {
        storage: {
            local: createStorageArea("local"),
            sync: createStorageArea("sync"),
            onChanged: {
                addListener(fn) {
                    if (typeof fn === "function") storageListeners.add(fn);
                },
                removeListener(fn) {
                    storageListeners.delete(fn);
                },
                hasListener(fn) {
                    return storageListeners.has(fn);
                }
            }
        },
        runtime: {
            getManifest() {
                const version = (window.AndroidBridge && window.AndroidBridge.getAppVersion)
                    ? window.AndroidBridge.getAppVersion()
                    : "V2.2.0";
                return {
                    name: "Ni-Kshay Automation",
                    version: "2.2.0",
                    version_name: version
                };
            },
            getURL(path) {
                const clean = String(path || "").replace(/^\//, "");
                return "https://nikshay-manager.local/" + clean;
            },
            connect() {
                const msgListeners = [];
                const discListeners = [];
                const port = {
                    onMessage: {
                        addListener(fn) { msgListeners.push(fn); }
                    },
                    onDisconnect: {
                        addListener(fn) { discListeners.push(fn); }
                    },
                    postMessage() {
                        setTimeout(() => {
                            msgListeners.forEach((fn) => {
                                try { fn({ reply: "ok" }); } catch (e) {}
                            });
                        }, 0);
                    }
                };
                setTimeout(() => {
                    msgListeners.forEach((fn) => {
                        try { fn({ reply: "ok" }); } catch (e) {}
                    });
                }, 0);
                return port;
            }
        },
        identity: {
            getProfileUserInfo(callback) {
                if (typeof callback === "function") {
                    setTimeout(() => callback({ email: "Android App", id: "android" }), 0);
                }
            }
        }
    });

    // Notify Android host on SPA history navigation inside Nikshay portal
    if (location.hostname.includes("nikshay.in") && window.AndroidBridge && window.AndroidBridge.onPortalUrlChanged) {
        const notifyUrl = () => {
            try {
                window.AndroidBridge.onPortalUrlChanged(location.href);
            } catch (e) {}
        };
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function () {
            const ret = origPush.apply(this, arguments);
            setTimeout(notifyUrl, 100);
            return ret;
        };
        history.replaceState = function () {
            const ret = origReplace.apply(this, arguments);
            setTimeout(notifyUrl, 100);
            return ret;
        };
        window.addEventListener("popstate", () => setTimeout(notifyUrl, 100));
        window.addEventListener("hashchange", () => setTimeout(notifyUrl, 100));
    }

    // Ensure Android soft keyboard opens reliably when tapping any text field
    function triggerAndroidKeyboard(target) {
        if (!target) return;
        var tag = target.tagName ? target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
            try {
                if (window.AndroidBridge && typeof window.AndroidBridge.showKeyboard === "function") {
                    window.AndroidBridge.showKeyboard();
                }
            } catch (_) {}
        }
    }
    document.addEventListener("focusin", function (e) { triggerAndroidKeyboard(e.target); }, true);
    document.addEventListener("click", function (e) { triggerAndroidKeyboard(e.target); }, true);
    document.addEventListener("touchend", function (e) { triggerAndroidKeyboard(e.target); }, true);
})();
