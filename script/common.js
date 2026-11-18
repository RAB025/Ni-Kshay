(function (global) {
    function cleanStr(s) {
        return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    const COLLECTION_SITE_KEYS = [
        "COLLECTION SITE",
        "Collection Site",
        "Collection site",
        "collection site",
        "COLLECTIONSITE",
        "CollectionSite",
        "COLLECTION_SITE",
        "collection_site",
        "Sample Collection Site",
        "SAMPLE COLLECTION SITE",
        "Sample Collection site",
        "sample collection site",
        "Collection Facility",
        "COLLECTION FACILITY",
        "Collection Center",
        "COLLECTION CENTER",
        "Collection Centre",
        "COLLECTION CENTRE",
        "Sample Site",
        "SAMPLE SITE",
        "Site",
        "SITE",
        "site",
        "Site Name",
        "SITE NAME",
        "Facility",
        "FACILITY",
        "Health Facility",
        "HEALTH FACILITY"
    ];

    function getRowVal(row, ...keys) {
        if (!row) return "";
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
                return String(row[key]).trim();
            }
            const found = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
                return String(row[found]).trim();
            }
        }
        for (const key of keys) {
            const cleanKey = cleanStr(key);
            if (!cleanKey) continue;
            const found = Object.keys(row).find(k => cleanStr(k) === cleanKey);
            if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
                return String(row[found]).trim();
            }
        }
        for (const key of keys) {
            const cleanKey = cleanStr(key);
            if (cleanKey.length >= 4) {
                const found = Object.keys(row).find(k => {
                    const cK = cleanStr(k);
                    return cK && (cK.includes(cleanKey) || cleanKey.includes(cK));
                });
                if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
                    return String(row[found]).trim();
                }
            }
        }
        return "";
    }

    function parseCSVLine(text) {
        const p = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                if (inQuotes && text[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                p.push(cur.trim());
                cur = "";
            } else {
                cur += c;
            }
        }
        p.push(cur.trim());
        return p;
    }

    async function csvToSheet(file) {
        const text = await file.text();
        const array = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (array.length === 0) return [];

        const titleArray = parseCSVLine(array[0]);
        array.shift();

        const tmp = [];
        for (let index = 0; index < array.length; index++) {
            const json = {};
            const values = parseCSVLine(array[index]);
            for (let index2 = 0; index2 < titleArray.length; index2++) {
                const title = titleArray[index2];
                if (title) {
                    json[title] = values[index2] !== undefined ? values[index2].trim() : "";
                }
            }
            tmp.push(json);
        }
        return tmp;
    }

    function excelToSheet(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const result = {};
                    workbook.SheetNames.forEach(function (sheetName) {
                        const roa = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                        if (roa.length > 0) {
                            result[sheetName] = roa;
                        }
                    });

                    const firstKey = Object.keys(result)[0];
                    const rawSheet = firstKey ? result[firstKey] : [];
                    const sheet = rawSheet.map(row => {
                        const cleanRow = {};
                        for (const key in row) {
                            const cleanKey = key.trim();
                            cleanRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
                        }
                        return cleanRow;
                    });
                    resolve(sheet);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
            reader.readAsArrayBuffer(file);
        });
    }

    async function parseSpreadsheetFile(file) {
        const filename = file.name || "";
        const dotIdx = filename.lastIndexOf(".");
        const extension = dotIdx >= 0 ? filename.substring(dotIdx).toUpperCase() : "";
        if (extension === ".CSV") {
            return await csvToSheet(file);
        }
        return await excelToSheet(file);
    }

    function showLoading(show = true) {
        const el = document.getElementById("loading");
        if (el) {
            el.style.display = show ? "flex" : "none";
        }
    }

    function initProfileAndVersion() {
        const emailEl = document.getElementById("email");
        const verEl = document.getElementById("version");

        let versionLabel = "V2.2.0";
        try {
            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
                const manifest = chrome.runtime.getManifest();
                if (manifest) {
                    versionLabel = manifest.version_name || ("V" + manifest.version);
                }
            } else if (global.AndroidBridge && global.AndroidBridge.getAppVersion) {
                versionLabel = global.AndroidBridge.getAppVersion() || versionLabel;
            }
        } catch (e) {}
        if (verEl) verEl.innerText = versionLabel;

        if (emailEl) emailEl.innerText = "Unlocked";
        try {
            if (global.NikshayAuth && typeof global.NikshayAuth.getAuthSession === "function") {
                global.NikshayAuth.getAuthSession().then(session => {
                    if (session && session.username) {
                        const daysLeft = Math.ceil(Math.max(0, session.expiresAt - Date.now()) / 86400000);
                        if (emailEl) {
                            const color = daysLeft <= 3 ? '#e74c3c' : '#2ecc71';
                            emailEl.innerHTML = `👤 ${session.username} <span style="font-size:11px;color:${color};">(${daysLeft}d left)</span>`;
                            emailEl.style.cursor = "pointer";
                            emailEl.title = "Click to view license or renew token";
                            emailEl.onclick = () => { location.href = "login.html"; };
                        }
                    }
                }).catch(() => {});
            } else if (typeof chrome !== "undefined" && chrome.identity && chrome.identity.getProfileUserInfo) {
                chrome.identity.getProfileUserInfo(function (info) {
                    if (emailEl) {
                        emailEl.innerText = info?.email || (global.AndroidBridge ? "Android App" : "Unlocked");
                    }
                });
            } else if (global.AndroidBridge) {
                if (emailEl) emailEl.innerText = "Android App";
            }
        } catch (e) {
            if (emailEl) emailEl.innerText = "Unlocked";
        }
    }

    function formatTimestampForFilename() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    }

    function escapeCsvCell(val) {
        if (val === undefined || val === null) return '""';
        const str = String(val);
        return '"' + str.replace(/"/g, '""') + '"';
    }

    function exportDatasetToCSV(dataArray, headers = [], baseFilename = "data.csv") {
        if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
            alert("No data found to export! Please upload and process a file first.");
            return;
        }

        // Generate timestamped filename to prevent MediaStore collisions on Android
        const dotIdx = baseFilename.lastIndexOf(".");
        const prefix = dotIdx >= 0 ? baseFilename.substring(0, dotIdx) : baseFilename;
        const ext = dotIdx >= 0 ? baseFilename.substring(dotIdx) : ".csv";
        const filename = `${prefix}_${formatTimestampForFilename()}${ext}`;

        // Build columns: S.N, Id (Nikshay generated ID), then all specified headers
        const cols = ["S.N", "Id"];
        const cleanHeaderList = (headers || []).filter(h => {
            const low = (h || "").trim().toLowerCase();
            return low !== "id" && low !== "s.n" && low !== "sn";
        });
        cols.push(...cleanHeaderList);

        const lines = [];
        lines.push(cols.map(escapeCsvCell).join(","));

        for (let i = 0; i < dataArray.length; i++) {
            const row = dataArray[i];
            const line = [];

            // 1. S.N
            line.push(escapeCsvCell(i + 1));

            // 2. Extracted / Generated Nikshay ID
            const idVal = row["id"] || row["Id"] || row["NIKSHAY ID"] ||
                getRowVal(row, "NIKSHAY ID", "Nikshay ID", "Patient ID", "Patient Id", "ID", "id") || "";
            line.push(escapeCsvCell(idVal));

            // 3. Remaining fields
            for (let j = 2; j < cols.length; j++) {
                const header = cols[j];
                let cellVal = "";
                const cleanH = (header || "").trim().toUpperCase();

                if (cleanH === "COLLECTION SITE" || cleanH === "COLLECTIONSITE") {
                    cellVal = getRowVal(row, ...COLLECTION_SITE_KEYS);
                } else if (cleanH === "TESTING LAB" || cleanH === "TESTINGLAB") {
                    cellVal = getRowVal(row, "TESTING LAB", "Testing Lab", "Lab", "LAB");
                } else if (cleanH === "NIKSHAY ID" || cleanH === "PATIENT ID") {
                    cellVal = getRowVal(row, "NIKSHAY ID", "Nikshay ID", "Patient ID", "Patient Id", "ID", "id");
                } else {
                    if (row[header] !== undefined && row[header] !== null) {
                        cellVal = row[header];
                    } else if (row[header.toLowerCase()] !== undefined && row[header.toLowerCase()] !== null) {
                        cellVal = row[header.toLowerCase()];
                    } else if (row[header.toUpperCase()] !== undefined && row[header.toUpperCase()] !== null) {
                        cellVal = row[header.toUpperCase()];
                    } else {
                        cellVal = getRowVal(row, header);
                    }
                }
                line.push(escapeCsvCell(cellVal));
            }

            lines.push(line.join(","));
        }

        const csvContent = "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM for Excel compatibility

        if (global.AndroidBridge && typeof global.AndroidBridge.saveCsvFile === "function") {
            global.AndroidBridge.saveCsvFile(filename, csvContent);
            return;
        }

        // Browser fallback
        const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(csvBlob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportTableToCSV(tableId, filename = "data.csv") {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Table with ID '${tableId}' not found.`);
            return;
        }

        const rows = table.querySelectorAll("tr");
        if (!rows || rows.length === 0) {
            alert("No table rows found to export.");
            return;
        }

        const csv = [];
        for (const row of rows) {
            const cells = row.querySelectorAll("th, td");
            const rowText = Array.from(cells).map(cell => escapeCsvCell(cell.innerText.trim()));
            csv.push(rowText.join(","));
        }

        const csvContent = "\uFEFF" + csv.join("\r\n");
        const dotIdx = filename.lastIndexOf(".");
        const prefix = dotIdx >= 0 ? filename.substring(0, dotIdx) : filename;
        const ext = dotIdx >= 0 ? filename.substring(dotIdx) : ".csv";
        const finalFilename = `${prefix}_${formatTimestampForFilename()}${ext}`;

        if (global.AndroidBridge && typeof global.AndroidBridge.saveCsvFile === "function") {
            global.AndroidBridge.saveCsvFile(finalFilename, csvContent);
            return;
        }

        const csvFile = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(csvFile);
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function bindAndroidLinks() {
        if (!global.AndroidBridge) return;

        document.querySelectorAll("a[data-template]").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const tpl = link.getAttribute("data-template");
                if (tpl && global.AndroidBridge.downloadAssetTemplate) {
                    global.AndroidBridge.downloadAssetTemplate(tpl);
                }
            });
        });

        document.querySelectorAll('a[href^="https://nikshay.in"]').forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                if (global.AndroidBridge.openPortalUrl) {
                    global.AndroidBridge.openPortalUrl(link.href);
                }
            });
        });

        bindLogButtons();
    }

    function bindLogButtons() {
        const btnExport = document.getElementById("btnExportLogs");
        if (btnExport) {
            btnExport.addEventListener("click", () => {
                if (global.AndroidBridge && typeof global.AndroidBridge.exportLogs === "function") {
                    global.AndroidBridge.exportLogs();
                } else {
                    alert("Log export is available on Android.");
                }
            });
        }
        const btnView = document.getElementById("btnViewLogs");
        if (btnView) {
            btnView.addEventListener("click", () => {
                if (global.AndroidBridge && typeof global.AndroidBridge.openLogViewer === "function") {
                    global.AndroidBridge.openLogViewer();
                } else {
                    alert("Live Log Viewer is available on Android.");
                }
            });
        }
    }

    async function checkAuthPort(onReady) {
        if (global.NikshayAuth && typeof global.NikshayAuth.checkAuthOrRedirect === "function") {
            try {
                const check = await global.NikshayAuth.checkAuthOrRedirect(true);
                if (!check.authenticated) {
                    return; // redirected to login.html
                }
            } catch (err) {
                console.error("Auth check failed:", err);
            }
        }

        if (global.AndroidBridge || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.connect) {
            showLoading(false);
            if (onReady) onReady();
            return;
        }

        let settled = false;
        function finish() {
            if (!settled) {
                settled = true;
                showLoading(false);
                if (onReady) onReady();
            }
        }

        function connectPort() {
            try {
                const port = chrome.runtime.connect({ name: "knockknock" });
                global.port = port;
                port.onDisconnect.addListener(() => {
                    if (!settled) {
                        finish();
                    }
                });
                port.onMessage.addListener((reply) => {
                    const msg = reply?.reply;
                    if (msg && msg !== "ok") {
                        location.href = "login.html";
                        return;
                    }
                    finish();
                });
                port.postMessage({ "class": "check" });
            } catch (e) {
                finish();
            }
        }

        connectPort();
        setTimeout(finish, 1500);
    }

    global.NikshayCommon = {
        cleanStr,
        COLLECTION_SITE_KEYS,
        getRowVal,
        parseCSVLine,
        csvToSheet,
        excelToSheet,
        parseSpreadsheetFile,
        showLoading,
        initProfileAndVersion,
        exportDatasetToCSV,
        exportTableToCSV,
        bindAndroidLinks,
        checkAuthPort
    };
})(window);
