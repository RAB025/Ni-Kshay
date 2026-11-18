const {
    COLLECTION_SITE_KEYS,
    getRowVal,
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

async function upload(elem) {
    const files = elem.target.files;
    if (!files || files.length === 0) {
        alert("Please choose any file...");
        return;
    }

    showLoading(true);
    try {
        sheet = await parseSpreadsheetFile(files[0]);
        window.sheet = sheet;

        await chrome.storage.local.set({ "data_trunat": sheet });
        await chrome.storage.sync.set({ "current_trunat": 0, "isOn_trunat": true });
        document.title = "Upload Successfully!!";
        location.reload();
    } catch (err) {
        showLoading(false);
        console.error("Upload failed:", err);
        alert("Could not read file: " + (err?.message || err));
    }
}

const HeaderArray = ["NIKSHAY ID", "TESTING LAB", "COLLECTION SITE"];

async function dataShow(from = 0, to = 9999999) {
    const elm = document.getElementById("tableList");
    if (!elm) return;
    elm.innerHTML = "";

    const tr = document.createElement("tr");
    ["S.N", "Id", ...HeaderArray].forEach(item => {
        const th = document.createElement("th");
        th.innerText = item;
        tr.appendChild(th);
    });
    elm.appendChild(tr);

    local?.data_trunat?.slice(from, from + to).forEach((element, n) => {
        const trRow = document.createElement("tr");

        const tdSn = document.createElement("td");
        tdSn.innerText = n + from + 1;
        trRow.appendChild(tdSn);

        ["id", ...HeaderArray].forEach(item => {
            const tdCol = document.createElement("td");
            let val = "";
            if (item === "id") {
                val = element["id"] || element["Id"] || "";
                tdCol.classList.add("yellow-bg");
            } else if (item === "NIKSHAY ID") {
                val = getRowVal(element, "NIKSHAY ID", "Nikshay ID", "Patient ID", "Patient Id", "ID", "id");
            } else if (item === "TESTING LAB") {
                val = getRowVal(element, "TESTING LAB", "Testing Lab", "Lab", "LAB");
            } else if (item === "COLLECTION SITE") {
                val = getRowVal(element, ...COLLECTION_SITE_KEYS);
            } else {
                val = element[item] || "";
            }
            tdCol.innerText = val;
            trRow.appendChild(tdCol);
        });

        elm.appendChild(trRow);
    });
}

async function updateInfo() {
    local = await chrome.storage.local.get();
    sync = await chrome.storage.sync.get();

    document.getElementById("switch").checked = sync?.isOn_trunat === true;

    const infoTotal = document.getElementById("infoTotal");
    const totalCount = local?.data_trunat?.length || 0;
    infoTotal.innerText = totalCount;

    const infoDone = document.getElementById("infoDone");
    const doneCount = sync?.current_trunat || 0;
    infoDone.innerText = doneCount;

    document.getElementById("infoRemain").innerText = Math.max(0, totalCount - doneCount);
}

async function refreshView() {
    await updateInfo();
    const currentCount = sync?.current_trunat || 0;
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
    btn.addEventListener("click", async (ev) => {
        const s = await chrome.storage.sync.get();
        const count = s?.current_trunat || 0;
        if (ev.target.id === "skip") {
            await chrome.storage.sync.set({ "current_trunat": count + 1 });
        } else if (count > 0) {
            await chrome.storage.sync.set({ "current_trunat": count - 1 });
        }
        await refreshView();
    });
});

document.getElementById("deleteSheet").addEventListener("click", async () => {
    if (confirm("Do you want to delete sheet?")) {
        await chrome.storage.local.set({ "data_trunat": [] });
        await chrome.storage.sync.set({ "current_trunat": 0 });
        location.reload();
    }
});

document.getElementById("switch").addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ "isOn_trunat": e.target.checked });
});

chrome.storage.onChanged.addListener(async (change, namespace) => {
    if (
        (namespace === "sync" && (change.hasOwnProperty("current_trunat") || change.hasOwnProperty("isOn_trunat"))) ||
        (namespace === "local" && change.hasOwnProperty("data_trunat"))
    ) {
        await refreshView();
    }
});

document.getElementById("exportSheet").addEventListener("click", async () => {
    local = await chrome.storage.local.get();
    const data = local?.data_trunat;
    if (!data || !data.length) {
        alert("No Trunat data found. Please upload a sheet first.");
        return;
    }
    exportDatasetToCSV(data, HeaderArray, "Nikshay_Trunat.csv");
});
