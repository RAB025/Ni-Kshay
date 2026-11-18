function openPage(path) {
    const url = path.startsWith("http") ? path : chrome.runtime.getURL(path);
    if (chrome?.tabs?.create) {
        chrome.tabs.create({ url });
        window.close();
    } else {
        window.open(url, "_blank");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const map = {
        openEnrollment: "option.html",
        openXray: "x-ray.html",
        openTrunat: "trunat.html",
        openPortal: "https://nikshay.in/Dashboard/Overview"
    };

    Object.entries(map).forEach(([id, target]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                openPage(target);
            });
        }
    });

    // Auto-open or focus Manager tab when extension icon is clicked (especially helpful on mobile browsers)
    if (chrome?.tabs?.query && chrome?.tabs?.create) {
        const anyManagerPattern = chrome.runtime.getURL("*.html");
        const defaultUrl = chrome.runtime.getURL("option.html");
        chrome.tabs.query({ url: anyManagerPattern }, (tabs) => {
            const activeExtTab = (tabs || []).find(t => t.url && !t.url.endsWith("popup.html"));
            if (activeExtTab && activeExtTab.id) {
                chrome.tabs.update(activeExtTab.id, { active: true });
                window.close();
            } else {
                chrome.tabs.create({ url: defaultUrl });
                window.close();
            }
        });
    }
});
