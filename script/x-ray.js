const {
    parseSpreadsheetFile,
    showLoading,
    initProfileAndVersion,
    exportDatasetToCSV,
    exportTableToCSV,
    bindAndroidLinks,
    checkAuthPort
} = window.NikshayCommon;

let sheet = "";
let local = {};
let sync = {};

async function excelToJson(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: ""
    });
    const data = rows.slice(4);
    const headers = data[0];
    return data.slice(1).map(row =>
        Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );
}

async function upload(elem) {
    const files = elem.target.files;
    if (!files || files.length === 0) {
        alert("Please choose any file...");
        return;
    }

    showLoading(true);
    try {
        sync = await chrome.storage.sync.get();
        sheet = await parseSpreadsheetFile(files[0]);
        window.sheet = sheet;

        await chrome.storage.local.set({ "data_x_ray": sheet });
        await chrome.storage.sync.set({ "current_x_ray": 0 });
        document.title = "Upload Successfully!!";
        location.reload();
    } catch (err) {
        showLoading(false);
        console.error("Upload failed:", err);
        alert("Could not read file: " + (err?.message || err));
    }
}

const HeaderArray = ["NIKSHAY ID", "TESTING LAB"];

async function dataShow(from = 0, to = 9999999) {
    const elm = document.getElementById("tableList");
    if (!elm) return;
    elm.innerHTML = "";

    const headerTr = document.createElement("tr");
    ["S.N", "Id", ...HeaderArray].forEach(item => {
        const th = document.createElement("th");
        th.innerText = item;
        headerTr.appendChild(th);
    });
    elm.appendChild(headerTr);

    local?.data_x_ray?.slice(from, from + to).forEach((element, n) => {
        const tr = document.createElement("tr");

        const tdSn = document.createElement("td");
        tdSn.innerText = n + from + 1;
        tr.appendChild(tdSn);

        ["id", ...HeaderArray].forEach(item => {
            const td = document.createElement("td");
            td.innerText = element[item] || "";
            if (item === "id") {
                td.classList.add("yellow-bg");
            }
            tr.appendChild(td);
        });

        elm.appendChild(tr);
    });
}

async function updateInfo() {
    local = await chrome.storage.local.get();
    sync = await chrome.storage.sync.get();

    document.getElementById("switch").checked = sync?.isOn_x_ray === true;

    const infoTotal = document.getElementById("infoTotal");
    const totalCount = local?.data_x_ray?.length || 0;
    infoTotal.innerText = totalCount;

    const infoDone = document.getElementById("infoDone");
    const doneCount = sync?.current_x_ray || 0;
    infoDone.innerText = doneCount;

    document.getElementById("infoRemain").innerText = Math.max(0, totalCount - doneCount);
}

async function refreshView() {
    await updateInfo();
    const currentCount = sync?.current_x_ray || 0;
    const dataListCount = currentCount > 3 ? currentCount - 2 : currentCount;
    await dataShow(dataListCount, 50);
}

async function Main() {
    await refreshView();
    showLoading(false);
}

initProfileAndVersion();
bindAndroidLinks();
checkAuthPort();
Main();

document.getElementById("upload").addEventListener("change", upload);

document.getElementsByName("skip").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
        const s = await chrome.storage.sync.get();
        const count = s?.current_x_ray || 0;
        if (e.target.id === "skip") {
            await chrome.storage.sync.set({ "current_x_ray": count + 1 });
        } else if (count > 0) {
            await chrome.storage.sync.set({ "current_x_ray": count - 1 });
        }
        await refreshView();
    });
});

document.getElementById("deleteSheet").addEventListener("click", async () => {
    if (confirm("Do you want to delete sheet")) {
        await chrome.storage.local.set({ "data_x_ray": [] });
        await chrome.storage.sync.set({ "current_x_ray": 0 });
        location.reload();
    }
});

document.getElementById("switch").addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ "isOn_x_ray": e.target.checked });
});

chrome.storage.onChanged.addListener(async (change, namespace) => {
    if (
        (namespace === "sync" && (change.hasOwnProperty("current_x_ray") || change.hasOwnProperty("isOn_x_ray"))) ||
        (namespace === "local" && change.hasOwnProperty("data_x_ray"))
    ) {
        await refreshView();
    }
});

document.getElementById("exportSheet").addEventListener("click", async () => {
    local = await chrome.storage.local.get();
    const data = local?.data_x_ray;
    if (!data || !data.length) {
        alert("No X-Ray data found. Please upload a sheet first.");
        return;
    }
    exportDatasetToCSV(data, HeaderArray, "Nikshay_XRay.csv");
});
