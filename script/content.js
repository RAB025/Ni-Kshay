(() => {
let currentData = null;

function findRadioGroupByChildRadioValue(childValue) {
    if (!childValue) return null;
    return document.querySelector(`input[value="${childValue}"]`) || 
           document.querySelector(`input[value="${childValue}" i]`);
}

function clickAndTrigger(el) {
    if (!el) return;
    el.checked = true;
    el.click();
    el.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    el.dispatchEvent(new CustomEvent("input", { bubbles: true }));
}

function selectCaste(rawCaste) {
    if (!rawCaste) return false;
    const casteStr = rawCaste.toString().trim();
    if (!casteStr) return false;

    const lower = casteStr.toLowerCase();
    let candidates = [];
    if (lower === "sc") {
        candidates = ["SC", "sc", "Sc"];
    } else if (lower === "st") {
        candidates = ["ST", "st", "St"];
    } else if (lower.startsWith("other")) {
        candidates = ["Others", "Other", "others", "other", "OTHERS", "OTHER"];
    } else {
        candidates = [casteStr, lower, casteStr.toUpperCase()];
    }

    // 1. Direct input[value] selector matching
    for (const val of candidates) {
        const el = document.querySelector(`input[value="${val}"]`) || 
                   document.querySelector(`input[value="${val}" i]`);
        if (el) {
            clickAndTrigger(el);
            console.log("Caste radio selected by value:", val);
            return true;
        }
    }

    // 2. Radio group by name/id containing caste or social
    const casteRadios = Array.from(document.querySelectorAll('input[type="radio"]')).filter(r => 
        (r.name && /caste|social/i.test(r.name)) ||
        (r.id && /caste|social/i.test(r.id))
    );
    for (const radio of casteRadios) {
        const rVal = (radio.value || "").trim().toLowerCase();
        if (candidates.some(c => c.toLowerCase() === rVal)) {
            clickAndTrigger(radio);
            console.log("Caste radio selected by group name/id:", radio.value);
            return true;
        }
    }

    // 3. Container labeled Caste or Social Category
    const casteContainer = [...document.querySelectorAll(".form-group, .row, .col-xs-12, .col-md-6, fieldset, div")].find(div => {
        const lbl = div.querySelector("label, .control-label");
        return lbl && /caste|social\s*category/i.test(lbl.innerText);
    });
    if (casteContainer) {
        const radios = casteContainer.querySelectorAll('input[type="radio"]');
        for (const r of radios) {
            const rVal = (r.value || "").trim().toLowerCase();
            if (candidates.some(c => c.toLowerCase() === rVal)) {
                clickAndTrigger(r);
                console.log("Caste radio selected within container:", r.value);
                return true;
            }
        }
        const labels = casteContainer.querySelectorAll("label");
        for (const lbl of labels) {
            const txt = lbl.innerText.trim().toLowerCase();
            if (candidates.some(c => c.toLowerCase() === txt)) {
                const r = lbl.querySelector('input[type="radio"]') || 
                          (lbl.htmlFor ? document.getElementById(lbl.htmlFor) : null);
                if (r) {
                    clickAndTrigger(r);
                } else {
                    lbl.click();
                }
                console.log("Caste label clicked within container:", txt);
                return true;
            }
        }
    }

    // 4. Label text across document matching candidate names
    const allLabels = Array.from(document.querySelectorAll("label, .radio-inline, .radio"));
    for (const lbl of allLabels) {
        const txt = lbl.innerText.trim().toLowerCase();
        if (candidates.some(c => c.toLowerCase() === txt)) {
            const r = lbl.querySelector('input[type="radio"]') || 
                      (lbl.htmlFor ? document.getElementById(lbl.htmlFor) : null);
            if (r) {
                clickAndTrigger(r);
            } else {
                lbl.click();
            }
            console.log("Caste radio selected via label:", txt);
            return true;
        }
    }

    // 5. Select dropdown fallback
    const casteSelect = document.querySelector('select[name*="caste" i], select[id*="caste" i]') ||
                        findInputByInnerText("Caste", "select");
    if (casteSelect) {
        const option = Array.from(casteSelect.options).find(opt => 
            candidates.some(c => opt.text.trim().toLowerCase() === c.toLowerCase() || opt.value.trim().toLowerCase() === c.toLowerCase())
        );
        if (option) {
            casteSelect.value = option.value;
            casteSelect.dispatchEvent(new CustomEvent("change", { bubbles: true }));
            console.log("Caste dropdown option selected:", option.value);
            return true;
        }
    }

    console.warn("Could not find Caste input element for:", rawCaste);
    return false;
}

function findInputByInnerText(text, type = "input") {
    const labels = [...document.querySelectorAll(".control-label")].filter(e => e.innerText.includes(text));
    if (labels.length > 0 && labels[0].parentElement) {
        return labels[0].parentElement.querySelector(type);
    }
    return null;
}

function waitForLoading(text) {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const input = findInputByInnerText(text);
            const spinner = input?.parentElement?.parentElement?.querySelector(".vs__spinner");
            if (!spinner || spinner.style.display === "none") {
                console.log(text);
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

function waitForListbox() {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (document.querySelector(`[role="listbox"]`) !== null) {
                console.log("listBox Found");
                clearInterval(interval);
                resolve();
            }
        }, 50);
    });
}

function setInput(elem, value) {
    if (!elem) return;
    elem.value = "";
    elem.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    elem.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    elem.value = value || "";
    elem.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    elem.dispatchEvent(new CustomEvent("change", { bubbles: true }));
}

function waitToReady() {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const targetVal = CaseFindingJson[currentData["Type of Case Finding"]];
                const radio = findRadioGroupByChildRadioValue(targetVal);
                if (radio) {
                    radio.click();
                    resolve();
                } else {
                    waitToReady().then(resolve);
                }
            } catch (e) {
                waitToReady().then(resolve);
            }
        }, 500);
    });
}

function selectById(id, index) {
    const re = document.querySelector(`#${id}`);
    if (re && re.options.length > index) {
        re.value = [...re.options].map(e => e.value)[index];
        re.dispatchEvent(new CustomEvent("change", { bubbles: true }));
    }
}

const CaseFindingJson = {
    Passive: "Passive (Routine programme)",
    Active: "Active (Active Case Finding)"
};

const GenderJson = {
    M: "Male",
    F: "Female",
    T: "Transgender"
};

async function Main() {
    let errMsg = "";
    const local = await chrome.storage.local.get();
    const sync = await chrome.storage.sync.get();

    const current = sync?.current || 0;
    const data = local?.data;

    if (!data?.length || sync?.isOn === false) {
        return;
    }

    setTimeout(() => {
        location.reload();
    }, 1000 * 60 * 1);

    currentData = data[current];
    if (!currentData) return;

    {

        console.log("Processing record:", current, currentData);

        const patientType = document.querySelector("[name=patientTypeRadio]");
        if (patientType) patientType.click();

        await waitToReady();

        const phi = [...document.querySelectorAll(".pointerCursor")].filter(e => e.innerText);
        if (phi.length > 0) {
            phi[0].click();
            const phiLabels = [...document.querySelectorAll(".control-label.col-xs-2")].filter(e => e.innerText.includes("PHI"));
            if (phiLabels.length > 0) {
                phiLabels[0].parentElement.querySelector("input")?.dispatchEvent(new CustomEvent("focus"));
                await waitForListbox();
                const listbox = document.querySelector(`[role="listbox"]`);
                if (listbox && currentData["PHI"]) {
                    const phiOption = [...listbox.querySelectorAll("li")].find(e => e.innerText.toLowerCase().trim() === currentData["PHI"].toLowerCase().trim());
                    if (phiOption) {
                        phiOption.dispatchEvent(new CustomEvent("mousedown", { bubbles: true }));
                    } else {
                        errMsg += "PHI Not Found,";
                    }
                }
                document.querySelector("#phiSelectModal button.btn.btn-primary")?.click();
            }
        }

        const caseRadio = findRadioGroupByChildRadioValue(CaseFindingJson[currentData["Type of Case Finding"]]);
        if (caseRadio) caseRadio.click();

        setInput(findInputByInnerText("First Name"), currentData["First Name"]);
        setInput(findInputByInnerText("Last Name"), currentData["Last Name"]);
        setInput(findInputByInnerText("Father/Husband's Name"), currentData["Father/Husband's Name"]);
        setInput(findInputByInnerText("Age"), currentData["Age"]);

        if (currentData["Gender"]) {
            const genderKey = currentData["Gender"].trim().substring(0, 1).toUpperCase();
            const genderRadio = findRadioGroupByChildRadioValue(GenderJson[genderKey]);
            if (genderRadio) genderRadio.click();
        }

        const aadhaarRadios = document.querySelectorAll("[name=aadhaarAvailable]");
        if (aadhaarRadios.length > 1) {
            aadhaarRadios[1].removeAttribute("disabled");
            aadhaarRadios[1].click();
        }

        const asymp = document.querySelector(`[value="Asymptomatic"]`);
        if (asymp) {
            asymp.checked = false;
            asymp.dispatchEvent(new CustomEvent("change", { bubbles: true }));
        }

        const notApp = document.querySelector(`[value="Not Applicable"]`);
        if (notApp) {
            notApp.checked = false;
            notApp.dispatchEvent(new CustomEvent("change", { bubbles: true }));
        }

        setInput(findInputByInnerText("Address", "textarea"), currentData["Address"]);
        setInput(findInputByInnerText("Pincode"), currentData["Pincode"]);

        if (currentData["Area"]) findRadioGroupByChildRadioValue(currentData["Area"])?.click();
        if (currentData["Marital Status"]) findRadioGroupByChildRadioValue(currentData["Marital Status"])?.click();
        const casteValue = currentData["Caste"] || currentData["caste"] || currentData["CASTE"];
        if (casteValue) selectCaste(casteValue);

        if (currentData["Symptoms"]) {
            const symEl = document.querySelector(`[value="${currentData["Symptoms"]}"]`);
            if (symEl) {
                symEl.checked = true;
                symEl.dispatchEvent(new CustomEvent("change", { bubbles: true }));
            }
        }

        if (currentData["Key Population"]) {
            const keyEl = document.querySelector(`[value="${currentData["Key Population"]}"]`);
            if (keyEl) {
                keyEl.checked = true;
                keyEl.dispatchEvent(new CustomEvent("change", { bubbles: true }));
            }
        }
    }

    const unknowns = document.querySelectorAll(`input[value="Unknown"]`);
    if (unknowns.length > 1) unknowns[1].click();
    if (unknowns.length > 2) unknowns[2].click();

    await waitForLoading("State");
    await waitForLoading("District");
    await waitForLoading("TU");

    const othersinputbox = document.querySelector("#othersymptomText");
    if (othersinputbox && !othersinputbox.disabled) {
        othersinputbox.value = currentData?.["If Symptoms Others"] ?? "";
        othersinputbox.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    }

    await waitForLoading("Health Facility");
    const hfInput = findInputByInnerText("Health Facility");
    if (hfInput) {
        hfInput.dispatchEvent(new CustomEvent("focus"));
        await waitForLoading("Health Facility");
        await waitForListbox();
        const list = document.querySelector(`[role="listbox"]`);
        const hfOption = [...list.querySelectorAll("li")].find(e => {
            const cleanA = (e.innerText.toLowerCase().match(/[a-z]/g) || []).join("");
            const cleanB = (currentData["Health Facility"]?.toLowerCase().trim().match(/[a-z]/g) || []).join("");
            return cleanA === cleanB;
        });

        if (hfOption) {
            hfOption.dispatchEvent(new CustomEvent("mousedown", { bubbles: true }));
        } else {
            errMsg += "Health Facility Not Found,";
        }
    }

    await waitForLoading("Village");
    const vInput = findInputByInnerText("Village");
    if (vInput) {
        vInput.dispatchEvent(new CustomEvent("focus"));
        await waitForLoading("Village");
        await waitForListbox();
        const list = document.querySelector(`[role="listbox"]`);
        const vOption = [...list.querySelectorAll("li")].find(e => {
            const cleanA = (e.innerText.toLowerCase().trim().match(/[a-z]/g) || []).join("");
            const cleanB = (currentData["Village"]?.toLowerCase().trim().match(/[a-z]/g) || []).join("");
            return cleanA === cleanB;
        });

        if (vOption) {
            vOption.dispatchEvent(new CustomEvent("mousedown", { bubbles: true }));
        } else {
            errMsg += "Village Not Found,";
        }
    }

    if (errMsg) {
        console.warn("Validation / Finding Error:", errMsg);
        currentData["id"] = "Error: " + errMsg.replace(/,+$/, "");
        data[current] = currentData;
        await chrome.storage.local.set({ data: data });
        await chrome.storage.sync.set({ current: current + 1 });
        location.reload();
        return;
    }

    setInput(findInputByInnerText("Primary Phone"), currentData["Mobile"]);

    await waitForSubmit();
    
    // Robust ID Extraction using Regular Expressions
    const statusBubble = document.querySelector(`[id="patientAddedBubble"]`) || document.querySelector(".toast-message");
    const statusText = statusBubble?.innerText || "";
    console.log("Status text found:", statusText);

    const match = statusText.match(/\d{5,12}/);

    if (match) {
        const extractedId = match[0];
        console.log("Successfully extracted Nikshay ID:", extractedId);
        
        currentData["id"] = extractedId;
        currentData["Id"] = extractedId;
        currentData["NIKSHAY ID"] = extractedId;
        
        data[current] = currentData;
        await chrome.storage.local.set({ data: data });
        await chrome.storage.sync.set({ current: current + 1 });

        const addAnotherBtn = [...document.querySelectorAll("button")].find(i => i.innerText.trim().toUpperCase().includes("ADD ANOTHER CASE"));
        if (addAnotherBtn) addAnotherBtn.click();

        location.reload();
    } else {
        console.error("Could not find Nikshay ID in status message:", statusText);
        currentData["id"] = statusText || "Submitted";
        data[current] = currentData;
        await chrome.storage.local.set({ data: data });
        await chrome.storage.sync.set({ current: current + 1 });
        location.reload();
    }
}

function waitForSubmit() {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const bubble = document.querySelector(`[id="patientAddedBubble"]`) || document.querySelector(".toast-message");
            if (bubble && bubble.innerText.trim().length > 0) {
                clearInterval(interval);
                resolve();
            } else {
                const proceedBtn = [...document.querySelectorAll("button")].find(i => i.innerText.trim().includes("ADD CASE AND PROCEED TO ADD TEST"));
                if (proceedBtn) proceedBtn.click();

                document.querySelector(`[data-dismiss="modal"]`)?.click();
            }
            if (attempts >= 30) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });
}

window.__nikshayEnrollmentHeartbeat = function () {
    try {
        const bubble = document.querySelector(`[id="patientAddedBubble"]`) || document.querySelector(".toast-message");
        if (bubble && bubble.innerText.trim().length > 0) {
            console.log("[Heartbeat] Submit response detected, nudging...");
            return { state: "submitted", text: bubble.innerText.trim() };
        }
        const proceedBtn = [...document.querySelectorAll("button")].find(i => i.innerText.trim().includes("ADD CASE AND PROCEED TO ADD TEST"));
        if (proceedBtn) {
            proceedBtn.click();
            document.querySelector(`[data-dismiss="modal"]`)?.click();
            return { state: "clicking_submit" };
        }
        return { state: "in_progress" };
    } catch (e) {
        return { state: "heartbeat_error", error: e.message };
    }
};

function startEnrollment() {
    if (window.__nikshayEnrollmentStarted) return;
    window.__nikshayEnrollmentStarted = true;
    setTimeout(Main, 800);
    console.log("The DOM is fully loaded and parsed.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startEnrollment);
} else {
    startEnrollment();
}
})();