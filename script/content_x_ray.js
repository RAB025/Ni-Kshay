(() => {
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitforid(id) {
    return new Promise(resolve => {
        const check = setInterval(() => {
            const el = document.querySelector(`#${id}`);
            if (el != null) {
                clearInterval(check);
                resolve(el);
            }
        }, 100);
    });
}

function waitForSelector(selector) {
    return new Promise(resolve => {
        const check = setInterval(() => {
            const el = document.querySelector(selector);
            if (el != null) {
                clearInterval(check);
                resolve(el);
            }
        }, 100);
    });
}

async function selectById(id, value) {
    await waitforid(id);
    const re = document.querySelector(`#${id}`);
    if (!re) return false;
    
    const list = [...re.options];
    if (!list.some(e => e.value && e.value.includes(value))) {
        console.warn(value + " not found in #" + id);
        return false;
    }

    re.value = value;
    re.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

// Universal Vue-select handler for State and Lab
async function selectVueDropdown(labelKeyword, targetText) {
    if (!targetText) return false;

    // 1. Locate the container by its label text
    const labels = Array.from(document.querySelectorAll("label"));
    const matchedLabel = labels.find(l => 
        l.innerText.toLowerCase().includes(labelKeyword.toLowerCase())
    );

    let container = null;
    let input = null;

    if (matchedLabel) {
        container = matchedLabel.closest(".form-group") || matchedLabel.parentElement;
        if (container) {
            input = container.querySelector('input[type="search"]') || 
                    container.querySelector('[role="combobox"] input') || 
                    container.querySelector('input');
        }
    }

    // Fallback: search all vue-select search inputs on page
    if (!input) {
        const allInputs = Array.from(document.querySelectorAll('.v-select input[type="search"]'));
        if (labelKeyword.toLowerCase().includes("state")) {
            input = allInputs[0];
        } else {
            input = allInputs.length > 1 ? allInputs[1] : allInputs[0];
        }
    }

    if (!input) {
        console.error(`Input field for "${labelKeyword}" not found.`);
        return false;
    }

    // 2. Click and focus the input field
    input.focus();
    input.click();
    await sleep(200);

    // 3. Clear and simulate typing to trigger Vue search filters
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    
    input.value = targetText.trim();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: targetText[0] }));
    await sleep(600);

    // 4. Locate the dropdown list
    let listbox = input.closest(".v-select")?.querySelector(".vs__dropdown-menu") ||
                  document.querySelector(".vs__dropdown-menu");

    if (!listbox) {
        input.click();
        await sleep(300);
        listbox = document.querySelector(".vs__dropdown-menu");
    }

    if (!listbox) {
        console.error(`Dropdown list for "${labelKeyword}" did not open.`);
        return false;
    }

    // 5. Find the matching option
    const options = Array.from(listbox.querySelectorAll("li, .vs__dropdown-option"));
    const cleanTarget = targetText.toLowerCase().replace(/[^a-z0-9]/g, "");

    let targetOption = options.find(li => {
        const itemText = li.innerText.toLowerCase().replace(/[^a-z0-9]/g, "");
        return itemText.includes(cleanTarget) || cleanTarget.includes(itemText);
    });

    if (!targetOption && options.length > 0) {
        targetOption = options[0];
    }

    if (targetOption) {
        ["pointerdown", "mousedown", "mouseup", "click"].forEach(eventType => {
            targetOption.dispatchEvent(new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
        console.log(`Selected ${labelKeyword}:`, targetOption.innerText.trim());
        await sleep(500);
        return true;
    } else {
        console.warn(`Option "${targetText}" not found for "${labelKeyword}".`);
        return false;
    }
}

function getToast() {
    return new Promise(resolve => {
        const inter = setInterval(() => {
            const toast = document.getElementById("toast-container");
            if (toast) {
                clearInterval(inter);
                resolve();
            }
        }, 100);
    });
}

async function Main() {
    const local = await chrome.storage.local.get();
    const sync = await chrome.storage.sync.get();

    if (sync.isOn_x_ray !== true) {
        return;
    }

    const current = sync?.current_x_ray || 0;
    const data = local?.data_x_ray;

    if (!data || !data[current]) {
        console.log("No more X-Ray records to process.");
        return;
    }

    const currentData = data[current];
    const current_id = currentData["NIKSHAY ID"];
    const current_lab = currentData["TESTING LAB"];
    const id_from_url = location.pathname.split("/")[3];

    if (current_id && current_id != id_from_url) {
        location.replace(`/Dashboard/Diagnostics/${current_id}`);
        document.title = "Searching";
        return;
    }

    // 1. Reason for testing & Test Type
    await selectById("ReasonForTesting", "TB Screening");
    await sleep(250);
    await selectById("TestType", "Chest X Ray");
    await sleep(500);

    // 2. Result availability & Type of case
    const resultAvail = document.querySelector("[name=ResultAvailability]");
    if (resultAvail) resultAvail.click();
    await sleep(250);

    await selectById("TypeOfCase", "New");
    await sleep(250);

    // 3. Date selection
    const datepickers = document.querySelectorAll(".vdp-datepicker__calendar");
    if (datepickers.length > 3) {
        const todayBtn = datepickers[3].querySelector(".today");
        if (todayBtn) todayBtn.click();
    }
    await sleep(400);

    // 4. Select State (Default: Jammu & Kashmir)
    await selectVueDropdown("State", "Jammu & Kashmir");
    await sleep(800);

    // 5. Select Testing Lab from Excel
    await selectVueDropdown("Testing Lab", current_lab);
    await sleep(400);

    // 6. Interpretation
    const interpretation = document.getElementById("FinalInterpretation");
    if (interpretation) {
        interpretation.selectedIndex = 0;
        interpretation.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(300);

    // 7. Submit
    const submitBtn = await waitForSelector('button.btn.btn-primary', 8000);
    if (submitBtn) submitBtn.click();

    await sleep(300);
    await getToast();

    const msg = document.getElementById("toast-container")?.querySelector(".toast-message")?.innerText || "Processed";
    console.log("Toast message:", msg);
    if (msg) document.title = msg;

    currentData["id"] = msg;
    data[current] = currentData;
    await chrome.storage.local.set({ data_x_ray: data });
    await chrome.storage.sync.set({ current_x_ray: current + 1 });

    Main();
}

window.__nikshayXRayHeartbeat = function () {
    try {
        const msg = document.getElementById("toast-container")?.querySelector(".toast-message")?.innerText;
        if (msg) return { state: "submitted", text: msg };
        const submitBtn = document.querySelector('button.btn.btn-primary');
        if (submitBtn) return { state: "ready_to_submit" };
        return { state: "in_progress" };
    } catch (e) {
        return { state: "heartbeat_error", error: e.message };
    }
};

async function startXRay() {
    if (window.__nikshayXRayStarted) return;
    window.__nikshayXRayStarted = true;
    await sleep(1500);
    Main();
}

if (document.readyState === "complete") {
    startXRay();
} else {
    window.addEventListener("load", startXRay);
}
})();