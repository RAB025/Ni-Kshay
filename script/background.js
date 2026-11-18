chrome.runtime.onInstalled.addListener(async () => {
    await chrome.storage.sync.set({ status: true, isOn: true });
    chrome.tabs.create({ url: "option.html" });
});

chrome.runtime.onStartup.addListener(async () => {
    await chrome.storage.sync.set({ status: true });
});

chrome.runtime.onConnect.addListener(function (port) {
    port.onMessage.addListener(async (message) => {
        if (message?.class === "check") {
            await chrome.storage.sync.set({ status: true });
            port.postMessage({ reply: "ok" });
        } else if (message?.mobileUpdate) {
            await chrome.storage.sync.set({ mobile: message.mobileUpdate });
        } else if (message?.usernameUpdate) {
            await chrome.storage.sync.set({ username: message.usernameUpdate });
        }
        return true;
    });

    port.postMessage({ reply: "ok" });
});