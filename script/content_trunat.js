(() => {
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitforid(id, timeout = 10000) {
    return new Promise(resolve => {
        const start = Date.now();
        const check = setInterval(() => {
            const el = document.querySelector(`#${id}`);
            if (el != null) {
                clearInterval(check);
                resolve(el);
            } else if (Date.now() - start > timeout) {
                clearInterval(check);
                resolve(null);
            }
        }, 100);
    });
}

function waitForSelector(selector, timeout = 10000) {
    return new Promise(resolve => {
        const start = Date.now();
        const check = setInterval(() => {
            const el = document.querySelector(selector);
            if (el != null) {
                clearInterval(check);
                resolve(el);
            } else if (Date.now() - start > timeout) {
                clearInterval(check);
                resolve(null);
            }
        }, 100);
    });
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

function cleanStr(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function setInputValueWithReactivity(input, val) {
    if (!input) return;
    input.focus();
    input.click();

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) {
        nativeSetter.call(input, val);
    } else {
        input.value = val;
    }

    ["input", "change"].forEach(evtName => {
        input.dispatchEvent(new Event(evtName, { bubbles: true, cancelable: true }));
        input.dispatchEvent(new CustomEvent(evtName, { bubbles: true, detail: val }));
    });
}

function triggerFullClick(el) {
    if (!el) return false;
    try {
        ["pointerdown", "mousedown", "mouseup", "click"].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        });
        if (typeof el.click === "function") {
            el.click();
        }
        return true;
    } catch (e) {
        console.error("[Nikshay Trunat] Error clicking element:", el, e);
        return false;
    }
}

async function fillNativeSelect(selectEl, value) {
    const sel = selectEl?.tagName === "SELECT" ? selectEl : selectEl?.querySelector?.("select");
    if (!sel) return false;

    const options = Array.from(sel.options);
    const cleanTarget = cleanStr(value);

    let match = options.find(opt => {
        const optTxt = cleanStr(opt.text);
        const optVal = cleanStr(opt.value);
        return optTxt === cleanTarget || optVal === cleanTarget;
    });

    if (!match) {
        match = options.find(opt => {
            const optTxt = cleanStr(opt.text);
            const optVal = cleanStr(opt.value);
            return (optTxt && (optTxt.includes(cleanTarget) || cleanTarget.includes(optTxt))) ||
                   (optVal && (optVal.includes(cleanTarget) || cleanTarget.includes(optVal)));
        });
    }

    if (!match) {
        const words = cleanTarget.match(/[a-z0-9]+/g) || [];
        if (words.length > 0) {
            match = options.find(opt => {
                const optTxt = cleanStr(opt.text);
                return words.every(w => optTxt.includes(w));
            });
        }
    }

    if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        if (window.$) {
            try { $(sel).val(match.value).trigger("change"); } catch (e) {}
        }
        console.log(`[Nikshay Trunat] Selected native dropdown option: ${match.text}`);
        await sleep(350);
        return true;
    } else {
        console.warn(`[Nikshay Trunat] Option "${value}" not found in native select.`);
        return false;
    }
}

async function fillVueSelect(vSelectEl, value) {
    if (!vSelectEl || !value) return false;
    const wrapper = vSelectEl.classList?.contains("v-select") ? vSelectEl : (vSelectEl.closest?.(".v-select") || vSelectEl.querySelector?.(".v-select") || vSelectEl);
    let searchInput = wrapper.querySelector?.('input[type="search"]') || 
                      wrapper.querySelector?.('[role="combobox"] input') || 
                      wrapper.querySelector?.('input');

    if (!searchInput) {
        console.warn("[Nikshay Trunat] Search input inside Vue select not found:", wrapper);
        return false;
    }

    searchInput.focus();
    searchInput.click();
    await sleep(200);

    // Clear and enter value with reactivity
    setInputValueWithReactivity(searchInput, "");
    await sleep(100);

    setInputValueWithReactivity(searchInput, value.trim());
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: value.trim()[0] }));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: value.trim()[0] }));
    await sleep(600);

    // Locate dropdown listbox
    let listbox = wrapper.querySelector?.(".vs__dropdown-menu, [role='listbox'], .dropdown-menu") ||
                  document.querySelector(".vs__dropdown-menu:not([style*='display: none']), [role='listbox']:not([style*='display: none'])");

    if (!listbox) {
        const toggle = wrapper.querySelector?.(".vs__dropdown-toggle") || searchInput;
        triggerFullClick(toggle);
        await sleep(350);
        listbox = wrapper.querySelector?.(".vs__dropdown-menu, [role='listbox'], .dropdown-menu") ||
                  document.querySelector(".vs__dropdown-menu, [role='listbox']");
    }

    const spinner = wrapper.querySelector?.(".vs__spinner");
    if (spinner && spinner.style.display !== "none") {
        await sleep(500);
    }

    if (listbox) {
        const options = Array.from(listbox.querySelectorAll("li, .vs__dropdown-option, [role='option']"));
        const cleanTarget = cleanStr(value);

        let targetOption = options.find(li => cleanStr(li.innerText) === cleanTarget);

        if (!targetOption) {
            targetOption = options.find(li => {
                const itemText = cleanStr(li.innerText);
                return itemText.includes(cleanTarget) || cleanTarget.includes(itemText);
            });
        }

        if (!targetOption) {
            const words = cleanTarget.match(/[a-z0-9]+/g) || [];
            if (words.length > 0) {
                targetOption = options.find(li => {
                    const itemText = cleanStr(li.innerText);
                    return words.every(w => itemText.includes(w));
                });
            }
        }

        if (!targetOption && options.length === 1 && cleanStr(options[0].innerText).length > 0) {
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
            targetOption.dispatchEvent(new CustomEvent("mousedown", { bubbles: true }));
            if (typeof targetOption.click === "function") {
                targetOption.click();
            }
            console.log("[Nikshay Trunat] Selected Vue dropdown option:", targetOption.innerText.trim());
            await sleep(400);
            return true;
        } else {
            console.warn(`[Nikshay Trunat] Option "${value}" not found in Vue dropdown. Available:`, options.map(o => o.innerText.trim()));
            return false;
        }
    } else {
        console.warn("[Nikshay Trunat] Dropdown menu for Vue select did not open.");
        return false;
    }
}

async function fillTextInput(inputEl, value) {
    const inp = inputEl?.tagName === "INPUT" ? inputEl : inputEl?.querySelector?.('input:not([type="radio"]):not([type="checkbox"])');
    if (!inp) return false;

    inp.focus();
    inp.click();
    setInputValueWithReactivity(inp, value.trim());
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new Event("blur", { bubbles: true }));

    if (window.$) {
        try { $(inp).val(value.trim()).trigger("input").trigger("change"); } catch (e) {}
    }

    await sleep(300);

    const suggestions = Array.from(document.querySelectorAll(".ui-autocomplete li, .typeahead li, .autocomplete-suggestions div, .dropdown-menu li:not([style*='display: none'])"));
    if (suggestions.length > 0) {
        const cleanTarget = cleanStr(value);
        let match = suggestions.find(s => cleanStr(s.innerText) === cleanTarget);
        if (!match) {
            match = suggestions.find(s => cleanStr(s.innerText).includes(cleanTarget) || cleanTarget.includes(cleanStr(s.innerText)));
        }
        if (!match && suggestions.length === 1) {
            match = suggestions[0];
        }
        if (match) {
            triggerFullClick(match);
            await sleep(300);
        }
    }

    console.log(`[Nikshay Trunat] Set text input value:`, value.trim());
    return true;
}

// Universal select handler for native <select> elements and fallbacks
async function selectDropdown(idOrLabelKeyword, targetText) {
    if (!targetText) return false;
    const cleanTarget = cleanStr(targetText);
    const cleanKeyword = cleanStr(idOrLabelKeyword);

    // 1. Try by ID or Name attribute
    let select = document.getElementById(idOrLabelKeyword) || 
                 document.getElementById(cleanKeyword) ||
                 document.querySelector(`select[name="${idOrLabelKeyword}"]`) ||
                 document.querySelector(`select[name*="${cleanKeyword}" i]`) ||
                 document.querySelector(`select[id*="${cleanKeyword}" i]`);

    // 2. Try by associated label
    if (!select) {
        const labels = Array.from(document.querySelectorAll("label, .control-label, strong, th, td"));
        const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanKeyword));
        if (matchedLabel) {
            if (matchedLabel.htmlFor) {
                select = document.getElementById(matchedLabel.htmlFor);
            }
            if (!select || select.tagName !== "SELECT") {
                let p = matchedLabel.parentElement;
                while (p && p !== document.body) {
                    const s = p.querySelector("select");
                    if (s) { select = s; break; }
                    if (p.classList.contains("form-group") || p.classList.contains("row") || p.tagName === "TR") break;
                    p = p.parentElement;
                }
            }
        }
    }

    if (select && select.tagName === "SELECT") {
        return await fillNativeSelect(select, targetText);
    }

    // 3. Fallback to Vue Select
    return await selectVueDropdown(idOrLabelKeyword, targetText);
}

// Universal Vue-select handler for vue-select components
async function selectVueDropdown(labelKeyword, targetText) {
    if (!targetText) return false;

    // 1. Locate container by label
    const labels = Array.from(document.querySelectorAll("label, .control-label, strong"));
    const cleanKeyword = cleanStr(labelKeyword);
    const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanKeyword));

    let input = null;
    let container = null;

    if (matchedLabel) {
        let p = matchedLabel.parentElement;
        while (p && p !== document.body) {
            input = p.querySelector('input[type="search"]') || 
                    p.querySelector('[role="combobox"] input') || 
                    p.querySelector('.v-select input');
            if (input) {
                container = p;
                break;
            }
            if (p.classList.contains("form-group") || p.classList.contains("row") || p.tagName === "TR") {
                break;
            }
            p = p.parentElement;
        }
    }

    // Fallback: search vue-select inputs only if keyword relates to Testing Lab
    if (!input && (cleanKeyword.includes("lab") || cleanKeyword.includes("testinglab"))) {
        const allInputs = Array.from(document.querySelectorAll('.v-select input[type="search"]'));
        if (allInputs.length > 0) {
            input = allInputs[0];
        }
    }

    if (!input) {
        console.warn(`[Nikshay Trunat] Input field for Vue dropdown "${labelKeyword}" not found.`);
        return false;
    }

    return await fillVueSelect(input.closest(".v-select") || input, targetText);
}

// Select radio button in a labeled container or globally
async function selectRadioInContainer(containerKeyword, targetRadioValueOrText) {
    const cleanContainer = cleanStr(containerKeyword);
    const cleanVal = cleanStr(targetRadioValueOrText);

    // 1. Locate container
    const labels = Array.from(document.querySelectorAll("label, .control-label, legend, strong, h4, h5, th"));
    const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanContainer));

    if (matchedLabel) {
        const container = matchedLabel.closest(".form-group, .row, fieldset, div, tr") || matchedLabel.parentElement;
        if (container) {
            const radios = Array.from(container.querySelectorAll('input[type="radio"]'));

            // Match by value
            let r = radios.find(radio => cleanStr(radio.value) === cleanVal || cleanStr(radio.value).includes(cleanVal));

            // Match by parent/adjacent label
            if (!r) {
                r = radios.find(radio => {
                    const parentLabel = radio.closest("label") || document.querySelector(`label[for="${radio.id}"]`);
                    return parentLabel && cleanStr(parentLabel.innerText).includes(cleanVal);
                });
            }

            if (r) {
                r.checked = true;
                r.click();
                r.dispatchEvent(new Event("change", { bubbles: true }));
                r.dispatchEvent(new Event("input", { bubbles: true }));
                console.log(`[Nikshay Trunat] Selected radio "${targetRadioValueOrText}" in container "${containerKeyword}"`);
                return true;
            }
        }
    }

    // 2. Global search by value or label
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
    let matchedRadio = allRadios.find(r => cleanStr(r.value) === cleanVal || cleanStr(r.value).includes(cleanVal));

    if (!matchedRadio) {
        const allLabels = Array.from(document.querySelectorAll("label, .radio-inline, .radio, span"));
        const lbl = allLabels.find(l => cleanStr(l.innerText) === cleanVal || cleanStr(l.innerText).includes(cleanVal));
        if (lbl) {
            matchedRadio = lbl.querySelector('input[type="radio"]') || 
                           (lbl.htmlFor ? document.getElementById(lbl.htmlFor) : null);
            if (!matchedRadio) {
                lbl.click();
                return true;
            }
        }
    }

    if (matchedRadio) {
        matchedRadio.checked = true;
        matchedRadio.click();
        matchedRadio.dispatchEvent(new Event("change", { bubbles: true }));
        matchedRadio.dispatchEvent(new Event("input", { bubbles: true }));
        console.log(`[Nikshay Trunat] Selected global radio "${targetRadioValueOrText}"`);
        return true;
    }

    console.warn(`[Nikshay Trunat] Radio button "${targetRadioValueOrText}" for "${containerKeyword}" not found.`);
    return false;
}

// Robust datepicker today selector
async function setDatePickerToday(containerLabelKeyword) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateFormatted = `${dd}-${mm}-${yyyy}`;
    const dateSlashFormatted = `${dd}/${mm}/${yyyy}`;

    const cleanLabel = cleanStr(containerLabelKeyword);
    const labels = Array.from(document.querySelectorAll("label, .control-label, strong, th"));
    const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanLabel));

    let container = null;
    if (matchedLabel) {
        container = matchedLabel.closest(".form-group, .row, div, td") || matchedLabel.parentElement;
    }

    if (container) {
        const input = container.querySelector("input");
        if (input) {
            input.focus();
            input.click();
            await sleep(250);

            // Check if vue-datepicker calendar opened
            const calendar = container.querySelector(".vdp-datepicker__calendar") || 
                             document.querySelector(".vdp-datepicker__calendar:not([style*='display: none'])");
            if (calendar) {
                const todayCell = calendar.querySelector(".cell.day.today, .today");
                if (todayCell) {
                    todayCell.click();
                    console.log(`[Nikshay Trunat] Clicked today in datepicker for "${containerLabelKeyword}"`);
                    await sleep(300);
                    return true;
                }
            }

            // Set input value directly
            input.value = dateFormatted;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("blur", { bubbles: true }));
            console.log(`[Nikshay Trunat] Set date input value "${dateFormatted}" for "${containerLabelKeyword}"`);
            return true;
        }
    }

    // Fallback: click any visible .today cell in datepickers
    const calendars = document.querySelectorAll(".vdp-datepicker__calendar");
    for (const cal of calendars) {
        const todayCell = cal.querySelector(".today, .cell.day.today");
        if (todayCell) {
            todayCell.click();
            await sleep(250);
            return true;
        }
    }

    return false;
}

// Generate random collection time between 10:30 and 15:00
async function setCollectionTime() {
    // 10:30 is 630 minutes, 15:00 is 900 minutes
    const totalMinutes = Math.floor(Math.random() * (900 - 630 + 1)) + 630;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const time24 = `${hh}:${mm}`;
    const hours12 = hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? "PM" : "AM";
    const time12 = `${String(hours12).padStart(2, '0')}:${mm} ${ampm}`;

    console.log(`[Nikshay Trunat] Random Collection Time: ${time24} (${time12})`);

    // 1. Search by ID or name
    let input = document.getElementById("CollectionTime") || 
                document.querySelector('[name*="CollectionTime" i]') ||
                document.querySelector('[id*="CollectionTime" i]');

    // 2. Search by label
    if (!input) {
        const labels = Array.from(document.querySelectorAll("label, .control-label, strong"));
        const matchedLabel = labels.find(l => cleanStr(l.innerText).includes("collectiontime"));
        if (matchedLabel) {
            const container = matchedLabel.closest(".form-group, .row, div, td") || matchedLabel.parentElement;
            input = container?.querySelector("input");
        }
    }

    if (input) {
        input.focus();
        input.click();
        input.value = time24;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
    }

    // 3. Check for separate hour/minute select elements
    const hourSelect = document.querySelector('select[name*="Hour" i], select[id*="Hour" i]');
    const minSelect = document.querySelector('select[name*="Minute" i], select[id*="Minute" i]');
    if (hourSelect) {
        hourSelect.value = String(hours);
        hourSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (minSelect) {
        minSelect.value = String(mins);
        minSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
}

function findSampleDetailsSection() {
    const sectionHeaders = Array.from(document.querySelectorAll("legend, h1, h2, h3, h4, h5, h6, strong, b, .card-header, .panel-heading, .box-header, th, label, .form-section-title"));
    const match = sectionHeaders.find(h => {
        const t = cleanStr(h.innerText);
        return t.includes("sampledetail") || t === "sampledetails" || t === "sampledetail";
    });
    if (match) {
        return match.closest("fieldset, .card, .panel, .box, .form-section, section, form, div.row, div") || match.parentElement;
    }
    return null;
}

function getControlType(el) {
    if (!el) return "unknown";
    if (el.classList?.contains("v-select") || el.closest?.(".v-select") || el.querySelector?.(".v-select")) return "v-select";
    if (el.tagName === "SELECT") return "select";
    if (el.tagName === "INPUT") {
        if (el.type === "search" && el.closest?.(".v-select")) return "v-select";
        return "input";
    }
    if (el.querySelector?.("select")) return "select";
    if (el.querySelector?.(".v-select")) return "v-select";
    if (el.querySelector?.("input")) return "input";
    return "unknown";
}

function findCollectionSiteControl() {
    const sampleSection = findSampleDetailsSection();

    // 1. Direct ID matches on known patterns
    const idCandidates = [
        "CollectionSite",
        "collectionsite",
        "collectionSite",
        "CollectionSiteId",
        "collectionSiteId",
        "SampleCollectionSite",
        "sampleCollectionSite",
        "CollectionFacility",
        "collectionFacility",
        "CollectionCenter",
        "collectionCenter",
        "SampleSite",
        "SiteId",
        "Site"
    ];

    for (const id of idCandidates) {
        if (sampleSection) {
            const el = sampleSection.querySelector(`#${id}, [name="${id}" i]`);
            if (el) return { element: el, type: getControlType(el), section: sampleSection };
        }
        const el = document.getElementById(id) || document.querySelector(`[name="${id}" i]`);
        if (el) return { element: el, type: getControlType(el), section: sampleSection };
    }

    // 2. Partial ID or Name matches
    const partialSelectors = [
        '[id*="collectionsite" i]',
        '[id*="collection_site" i]',
        '[id*="samplecollectionsite" i]',
        '[id*="collectionfacility" i]',
        '[name*="collectionsite" i]',
        '[name*="collection_site" i]',
        '[name*="samplecollectionsite" i]',
        '[name*="collectionfacility" i]',
        '[placeholder*="collection site" i]',
        '[placeholder*="collectionsite" i]',
        '[placeholder*="sample site" i]'
    ];

    for (const sel of partialSelectors) {
        if (sampleSection) {
            const el = sampleSection.querySelector(sel);
            if (el) return { element: el, type: getControlType(el), section: sampleSection };
        }
        const el = document.querySelector(sel);
        if (el) return { element: el, type: getControlType(el), section: sampleSection };
    }

    // 3. Label-based search
    const labelKeywords = [
        "collectionsite",
        "samplecollectionsite",
        "siteofcollection",
        "collectionfacility",
        "collectioncenter",
        "collectioncentre",
        "collectionplace",
        "site"
    ];

    const allLabels = Array.from((sampleSection || document).querySelectorAll("label, .control-label, strong, th, td"));
    for (const kw of labelKeywords) {
        const matchedLabel = allLabels.find(l => {
            const txt = cleanStr(l.innerText);
            if (kw === "site") {
                return txt === "site" || txt === "site*" || (sampleSection && txt.includes("site") && !txt.includes("testing"));
            }
            return txt.includes(kw);
        });

        if (matchedLabel) {
            if (matchedLabel.htmlFor) {
                const targetEl = document.getElementById(matchedLabel.htmlFor);
                if (targetEl) return { element: targetEl, type: getControlType(targetEl), section: sampleSection };
            }

            let container = matchedLabel.parentElement;
            while (container && container !== document.body) {
                const vSelect = container.querySelector(".v-select");
                if (vSelect) return { element: vSelect, type: "v-select", section: sampleSection };

                const select = container.querySelector("select");
                if (select) return { element: select, type: "select", section: sampleSection };

                const input = container.querySelector('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])');
                if (input) return { element: input, type: "input", section: sampleSection };

                if (container.classList.contains("form-group") || container.classList.contains("row") || container.tagName === "TR") {
                    break;
                }
                container = container.parentElement;
            }
        }
    }

    // 4. If inside sampleSection, find any unassigned control
    if (sampleSection) {
        const vSelect = sampleSection.querySelector(".v-select");
        if (vSelect) return { element: vSelect, type: "v-select", section: sampleSection };

        const selects = Array.from(sampleSection.querySelectorAll("select")).filter(s => {
            const sId = (s.id || s.name || "").toLowerCase();
            return !sId.includes("sputum") && !sId.includes("description") && !sId.includes("reason") && !sId.includes("case") && !sId.includes("testtype");
        });
        if (selects.length > 0) return { element: selects[0], type: "select", section: sampleSection };

        const inputs = Array.from(sampleSection.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])')).filter(inp => {
            const inpId = (inp.id || inp.name || inp.placeholder || "").toLowerCase();
            const isDate = inpId.includes("date") || inp.closest(".vdp-datepicker") || inp.classList.contains("vdp-datepicker__input");
            const isTime = inpId.includes("time") || cleanStr(inpId).includes("collectiontime");
            return !isDate && !isTime;
        });
        if (inputs.length > 0) return { element: inputs[0], type: "input", section: sampleSection };
    }

    return null;
}

// Dedicated robust handler for Collection Site under Sample Details
async function setCollectionSite(value) {
    if (!value || String(value).trim() === "") {
        console.warn("[Nikshay Trunat] No Collection Site value provided in current record.");
        return false;
    }

    const trimmedValue = String(value).trim();
    console.log(`[Nikshay Trunat] Setting Collection Site under Sample Details: "${trimmedValue}"`);

    for (let attempt = 1; attempt <= 2; attempt++) {
        const controlInfo = findCollectionSiteControl();

        if (controlInfo) {
            console.log(`[Nikshay Trunat] Found Collection Site control (attempt ${attempt}):`, controlInfo.type, controlInfo.element);
            let success = false;

            if (controlInfo.type === "v-select") {
                success = await fillVueSelect(controlInfo.element, trimmedValue);
            } else if (controlInfo.type === "select") {
                success = await fillNativeSelect(controlInfo.element, trimmedValue);
            } else if (controlInfo.type === "input") {
                success = await fillTextInput(controlInfo.element, trimmedValue);
            } else {
                if (controlInfo.element.querySelector("select")) {
                    success = await fillNativeSelect(controlInfo.element, trimmedValue);
                } else if (controlInfo.element.querySelector(".v-select") || controlInfo.element.querySelector('input[type="search"]')) {
                    success = await fillVueSelect(controlInfo.element, trimmedValue);
                } else {
                    success = await fillTextInput(controlInfo.element, trimmedValue);
                }
            }

            if (success) {
                console.log(`[Nikshay Trunat] Collection Site successfully set to "${trimmedValue}" on attempt ${attempt}.`);
                return true;
            }
        } else {
            console.warn(`[Nikshay Trunat] Collection Site control not found on attempt ${attempt}.`);
        }

        if (attempt < 2) {
            await sleep(600);
        }
    }

    // Fallback: try selectDropdownOrInput
    console.log("[Nikshay Trunat] Trying selectDropdownOrInput fallback for Collection Site...");
    return await selectDropdownOrInput("Collection Site", trimmedValue);
}

// Select dropdown or fill input for fields like Collection Site
async function selectDropdownOrInput(containerLabelKeyword, value) {
    if (!value) return false;

    // Try native select first
    const cleanLabel = cleanStr(containerLabelKeyword);
    let select = document.getElementById(containerLabelKeyword) ||
                 document.getElementById(cleanLabel) ||
                 document.querySelector(`select[name="${containerLabelKeyword}"]`) ||
                 document.querySelector(`select[name*="${cleanLabel}" i]`) ||
                 document.querySelector(`select[id*="${cleanLabel}" i]`);

    if (!select) {
        const labels = Array.from(document.querySelectorAll("label, .control-label, strong, th, td"));
        const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanLabel));
        if (matchedLabel) {
            if (matchedLabel.htmlFor) {
                select = document.getElementById(matchedLabel.htmlFor);
            }
            if (!select || select.tagName !== "SELECT") {
                let p = matchedLabel.parentElement;
                while (p && p !== document.body) {
                    const sel = p.querySelector("select");
                    if (sel) { select = sel; break; }
                    if (p.classList.contains("form-group") || p.classList.contains("row")) break;
                    p = p.parentElement;
                }
            }
        }
    }

    if (select && select.tagName === "SELECT") {
        return await fillNativeSelect(select, value);
    }

    // Try Vue Select
    const labels = Array.from(document.querySelectorAll("label, .control-label, strong"));
    const matchedLabel = labels.find(l => cleanStr(l.innerText).includes(cleanLabel));
    if (matchedLabel) {
        let p = matchedLabel.parentElement;
        while (p && p !== document.body) {
            const vs = p.querySelector(".v-select");
            if (vs) {
                return await fillVueSelect(vs, value);
            }
            if (p.classList.contains("form-group") || p.classList.contains("row")) break;
            p = p.parentElement;
        }
    }

    // Try text input
    let input = document.getElementById(containerLabelKeyword) ||
                document.getElementById(cleanLabel) ||
                document.querySelector(`input[name*="${cleanLabel}" i]`) ||
                document.querySelector(`input[id*="${cleanLabel}" i]`);

    if (!input && matchedLabel) {
        if (matchedLabel.htmlFor) {
            input = document.getElementById(matchedLabel.htmlFor);
        }
        if (!input) {
            let p = matchedLabel.parentElement;
            while (p && p !== document.body) {
                const inp = p.querySelector('input:not([type="radio"]):not([type="checkbox"])');
                if (inp) { input = inp; break; }
                if (p.classList.contains("form-group") || p.classList.contains("row")) break;
                p = p.parentElement;
            }
        }
    }

    if (input) {
        return await fillTextInput(input, value);
    }

    return false;
}

// Wait for toast notification
function getToast() {
    return new Promise(resolve => {
        let count = 0;
        const inter = setInterval(() => {
            count++;
            const toast = document.getElementById("toast-container");
            if (toast || count > 100) {
                clearInterval(inter);
                resolve();
            }
        }, 100);
    });
}

// Find sidebar menu item
function findMenuItem(keyword) {
    const cleanKey = cleanStr(keyword);
    const items = Array.from(document.querySelectorAll("aside a, .sidebar a, nav a, .sidebar-menu a, a, button, span"));
    return items.find(el => cleanStr(el.innerText).includes(cleanKey));
}

async function clickMagnifyingGlass(searchInput) {
    console.log("[Nikshay Trunat] Locating and clicking magnifying glass icon...");
    let clickedCount = 0;

    // 1. Container-level search (input-group or immediate parent)
    const container = searchInput.closest(".input-group") || 
                      searchInput.closest(".form-group") || 
                      searchInput.parentElement;

    if (container) {
        const selectors = [
            '[data-icon="search"]',
            'i.fa-search',
            'span.fa-search',
            '.fa-search',
            'svg.fa-search',
            '[class*="search" i]',
            '.glyphicon-search',
            '.input-group-addon',
            '.input-group-append',
            '.input-group-btn',
            '.pointerCursor',
            'button',
            'a'
        ];

        const elements = Array.from(container.querySelectorAll(selectors.join(",")))
                              .filter(el => el !== searchInput && !el.contains(searchInput));

        for (const el of elements) {
            console.log("[Nikshay Trunat] Clicking candidate in search container:", el);
            triggerFullClick(el);
            clickedCount++;
            const clickableParent = el.closest(".input-group-addon, .input-group-append, .input-group-btn, button, a, .pointerCursor");
            if (clickableParent && clickableParent !== el && clickableParent !== container) {
                triggerFullClick(clickableParent);
                clickedCount++;
            }
        }

        // Direct siblings of input inside container
        let sibling = searchInput.nextElementSibling;
        while (sibling) {
            console.log("[Nikshay Trunat] Clicking sibling of search input:", sibling);
            triggerFullClick(sibling);
            clickedCount++;
            const innerClickables = Array.from(sibling.querySelectorAll("button, i, svg, span, a"));
            for (const inner of innerClickables) {
                triggerFullClick(inner);
                clickedCount++;
            }
            sibling = sibling.nextElementSibling;
        }
    }

    // 2. Global search for visible magnifying glass / search elements
    const globalSearchElements = Array.from(document.querySelectorAll(
        '[data-icon="search"], i.fa-search, span.fa-search, svg.fa-search, .fa-search, [class*="fa-search" i], .glyphicon-search, button[id*="search" i], button[name*="search" i]'
    )).filter(el => el !== searchInput && !el.contains(searchInput) && el.offsetParent !== null);

    for (const el of globalSearchElements) {
        console.log("[Nikshay Trunat] Clicking global search element:", el);
        triggerFullClick(el);
        clickedCount++;
        const parentBtn = el.closest(".input-group-addon, .input-group-append, .input-group-btn, button, a, .pointerCursor");
        if (parentBtn && parentBtn !== el) {
            triggerFullClick(parentBtn);
            clickedCount++;
        }
    }

    // 3. Dispatch Enter key events on the search input itself
    console.log("[Nikshay Trunat] Dispatching Enter key sequence on search input...");
    ["keydown", "keypress", "keyup"].forEach(evtType => {
        searchInput.dispatchEvent(new KeyboardEvent(evtType, {
            bubbles: true,
            cancelable: true,
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            view: window
        }));
    });

    console.log(`[Nikshay Trunat] Magnifying glass click complete (${clickedCount} targets triggered).`);
    return clickedCount > 0;
}

function waitForAddTestTab(timeout = 10000) {
    return new Promise(resolve => {
        const start = Date.now();
        const interval = setInterval(() => {
            // Check if test form is already visible
            if (document.getElementById("ReasonForTesting") || document.getElementById("TestType")) {
                clearInterval(interval);
                resolve(null);
                return;
            }

            // Find Add Test tab / button outside sidebar
            const candidates = Array.from(document.querySelectorAll("a, button, [role='tab'], .nav-link, .btn, span, li"));
            const addTestTab = candidates.find(el => {
                const txt = (el.innerText || "").trim().toLowerCase();
                const isSidebar = el.closest("aside, .sidebar, nav, .sidebar-menu");
                return (txt === "add test" || txt.includes("add test")) && !isSidebar && el.offsetParent !== null;
            });

            if (addTestTab) {
                clearInterval(interval);
                resolve(addTestTab);
                return;
            }

            if (Date.now() - start > timeout) {
                clearInterval(interval);
                resolve(null);
            }
        }, 200);
    });
}

// Select "Patient ID" from search dropdown menu before entering ID
async function selectSearchTypePatientId(searchInput) {
    console.log("[Nikshay Trunat] Selecting 'Patient ID' from search dropdown...");

    const isPatientIdOption = (opt) => {
        const txt = cleanStr(opt.text || opt.innerText);
        const val = cleanStr(opt.value);
        return txt.includes("patientid") || val.includes("patientid") ||
               txt.includes("nikshayid") || val.includes("nikshayid") ||
               (txt.includes("patient") && txt.includes("id"));
    };

    // 1. Check all <select> elements (check nearest container first, then document)
    const container = searchInput ? (
        searchInput.closest(".input-group") || 
        searchInput.closest(".form-group") || 
        searchInput.closest(".row") || 
        searchInput.parentElement?.parentElement
    ) : null;

    let selects = [];
    if (container) {
        selects = Array.from(container.querySelectorAll("select"));
    }
    if (selects.length === 0) {
        selects = Array.from(document.querySelectorAll("select"));
    }

    for (const sel of selects) {
        const options = Array.from(sel.options);
        const match = options.find(isPatientIdOption);
        if (match) {
            console.log(`[Nikshay Trunat] Selecting '${match.text}' in select element #${sel.id || sel.name || 'unnamed'}`);
            sel.value = match.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            sel.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(350);
            return true;
        }
    }

    // 2. Check Bootstrap / Vue dropdown buttons (.dropdown-toggle, .btn-group, .v-select)
    const dropdownContainers = Array.from(document.querySelectorAll(".dropdown, .input-group-btn, .btn-group, .v-select"));
    for (const drop of dropdownContainers) {
        const toggleBtn = drop.querySelector(".dropdown-toggle, button, input[type='search'], [role='combobox']");
        if (toggleBtn) {
            toggleBtn.click();
            await sleep(250);
            const menu = drop.querySelector(".dropdown-menu, .vs__dropdown-menu, ul");
            if (menu) {
                const items = Array.from(menu.querySelectorAll("a, li, button, span, .vs__dropdown-option"));
                const targetItem = items.find(isPatientIdOption);
                if (targetItem) {
                    console.log("[Nikshay Trunat] Selected Patient ID from dropdown menu item:", targetItem.innerText);
                    triggerFullClick(targetItem);
                    await sleep(350);
                    return true;
                }
            }
        }
    }

    // 3. Fallback: VueSelect with keyword "search" or "patient"
    await selectVueDropdown("search", "Patient ID");
    return false;
}

// Main automation runner
async function Main() {
    const local = await chrome.storage.local.get();
    const sync = await chrome.storage.sync.get();

    if (sync.isOn_trunat !== true) {
        console.log("[Nikshay Trunat] Automation switch is OFF.");
        return;
    }

    const current = sync?.current_trunat || 0;
    const data = local?.data_trunat;

    if (!data || !data[current]) {
        console.log("[Nikshay Trunat] No more Trunat records to process.");
        return;
    }

    const currentData = data[current];
    const current_id = getRowVal(currentData, "NIKSHAY ID", "Nikshay ID", "Patient ID", "Patient Id", "ID", "id");
    const current_lab = getRowVal(currentData, "TESTING LAB", "Testing Lab", "Lab", "LAB");
    const current_site = getRowVal(currentData, ...COLLECTION_SITE_KEYS);

    console.log(`[Nikshay Trunat] Processing record ${current + 1}/${data.length}:`, {
        patientId: current_id,
        testingLab: current_lab,
        collectionSite: current_site
    });

    // Check current page location
    const pathname = location.pathname;

    // Step 1 & 2: If on home page or non-diagnostics page, navigate to Diagnostics -> Add Test
    if (!pathname.includes("/Dashboard/Diagnostics")) {
        console.log("[Nikshay Trunat] Navigating to Diagnostics...");
        const diagItem = findMenuItem("Diagnostics");
        if (diagItem) {
            diagItem.click();
            await sleep(500);
            const addTestItem = findMenuItem("Add Test");
            if (addTestItem) {
                addTestItem.click();
                await sleep(1000);
                return;
            }
        }
        // Fallback direct URL navigation
        location.replace("https://nikshay.in/Dashboard/Diagnostics/0");
        return;
    }

    // We are on /Dashboard/Diagnostics/*
    // Check if Test Details form is ALREADY visible
    let testFormVisible = document.getElementById("ReasonForTesting") || 
                          document.getElementById("TestType") ||
                          document.querySelector('[name="ResultAvailability"]');

    if (!testFormVisible) {
        // Step 3: Under Add Test in patient id field click on Search By Patient Id & insert id
        let searchInput = document.querySelector('input[placeholder*="Patient" i]') ||
                          document.querySelector('input[placeholder*="Search" i]') ||
                          document.getElementById("searchPatientId") ||
                          document.getElementById("txtPatientId") ||
                          document.querySelector('input[name*="search" i]') ||
                          document.querySelector('input[name*="patient" i]') ||
                          document.querySelector('.input-group input');

        if (!searchInput) {
            const labels = Array.from(document.querySelectorAll("label, .control-label, strong, th, span"));
            const matchedLabel = labels.find(l => cleanStr(l.innerText).includes("patientid") || cleanStr(l.innerText).includes("searchbypatient"));
            if (matchedLabel) {
                const container = matchedLabel.closest(".form-group, .row, div, td") || matchedLabel.parentElement;
                searchInput = container?.querySelector("input");
            }
        }

        // Before inserting patient ID, select "Patient ID" from the dropdown menu
        console.log("[Nikshay Trunat] Step 3: Selecting 'Patient ID' from search dropdown...");
        await selectSearchTypePatientId(searchInput);
        await sleep(350);

        // Re-locate search input in case changing the dropdown refreshed the input field
        searchInput = document.querySelector('input[placeholder*="Patient" i]') ||
                      document.querySelector('input[placeholder*="Search" i]') ||
                      document.getElementById("searchPatientId") ||
                      document.getElementById("txtPatientId") ||
                      document.querySelector('.input-group input') ||
                      searchInput;

        if (searchInput && current_id) {
            console.log("[Nikshay Trunat] Step 3: Entering Patient ID:", current_id);
            setInputValueWithReactivity(searchInput, current_id);
            await sleep(400);

            // Step 4: Click on magnifying glass sign
            console.log("[Nikshay Trunat] Step 4: Clicking magnifying glass sign...");
            await clickMagnifyingGlass(searchInput);
            await sleep(1000);

            // Step 5: After getting patient details click on Add Test tab
            console.log("[Nikshay Trunat] Step 5: Waiting for patient details & Add Test tab...");
            let addTestTab = await waitForAddTestTab(8000);

            if (addTestTab) {
                console.log("[Nikshay Trunat] Clicking Add Test tab:", addTestTab);
                triggerFullClick(addTestTab);
                await sleep(1000);
            } else {
                console.warn("[Nikshay Trunat] Add Test tab not detected within 8s. Checking if form is already loaded...");
            }
        } else if (current_id && location.pathname.split("/")[3] !== current_id) {
            // Direct URL accelerator fallback
            console.log("[Nikshay Trunat] Direct URL navigation to patient:", current_id);
            location.replace(`/Dashboard/Diagnostics/${current_id}`);
            return;
        }

        // Wait for test form to be ready
        testFormVisible = await waitForSelector("#ReasonForTesting, #TestType, [name='ResultAvailability']", 6000);

        if (!testFormVisible && current_id && location.pathname.split("/")[3] !== current_id) {
            console.log("[Nikshay Trunat] Test form not visible after search. Trying direct navigation to /Dashboard/Diagnostics/" + current_id);
            location.replace(`/Dashboard/Diagnostics/${current_id}`);
            return;
        }
    }

    console.log("[Nikshay Trunat] Filling Test Details form...");

    // Step 6: Under Test Details in Reason for testing select "Diagnosis of TB"
    await selectDropdown("ReasonForTesting", "Diagnosis of TB");
    await sleep(350);

    // Step 7: Under Test Details in Type of Case select "New"
    await selectDropdown("TypeOfCase", "New");
    await sleep(350);

    // Step 8: Under Test Details in Diagnosis of TB select "Presumptive" radio button
    await selectRadioInContainer("Diagnosis of TB", "Presumptive");
    await sleep(350);

    // Step 9: Under Test Details in Test Type select "Truenat (MTB)"
    await selectDropdown("TestType", "Truenat (MTB)");
    await sleep(600);

    // Step 10: Under Facility Details in Testing Lab according to uploaded excel
    if (current_lab) {
        await selectVueDropdown("Testing Lab", current_lab);
        await sleep(400);
    }

    // Step 11: Under Facility Details in Sample Availability click "Present" radio button
    await selectRadioInContainer("Sample Availability", "Present");
    await sleep(300);

    // Step 12: Under Facility Details in Result Available click "Present" radio button
    await selectRadioInContainer("Result Available", "Present");
    await sleep(300);

    // Step 13: Under Sample Details in Sputum Collection Detail select "Early Morning"
    await selectDropdown("SputumCollectionDetail", "Early Morning");
    await sleep(300);

    // Step 14: Under Sample Details in Sample Description select "Mucopurulent"
    await selectDropdown("SampleDescription", "Mucopurulent");
    await sleep(300);

    // Step 15: Under Sample Details in Collection Date select current date
    await setDatePickerToday("Collection Date");
    await sleep(350);

    // Step 16: Under Sample Details in Collection Time select time randomly between 10:30 to 15:00
    await setCollectionTime();
    await sleep(350);

    // Step 17: Under Sample Details in Collection Site select data from uploaded excel file
    if (current_site) {
        console.log(`[Nikshay Trunat] Step 17: Setting Collection Site to "${current_site}"...`);
        const siteSuccess = await setCollectionSite(current_site);
        if (siteSuccess) {
            console.log(`[Nikshay Trunat] Step 17: Collection Site set successfully to "${current_site}".`);
        } else {
            console.warn(`[Nikshay Trunat] Step 17: Could not set Collection Site to "${current_site}".`);
        }
        await sleep(350);
    } else {
        console.warn("[Nikshay Trunat] Step 17: Warning - Collection Site value is empty in uploaded excel data for this record.");
    }

    // Step 18: Under Test Results in Sample ID select "Sample-1"
    await selectDropdown("SampleId", "Sample-1");
    await sleep(300);

    // Step 19: Under Test Results in Date Reported select current date
    await setDatePickerToday("Date Reported");
    await sleep(350);

    // Step 20: Under Test Results in Final Interpretation select "M.Tb. not detected"
    await selectDropdown("FinalInterpretation", "M.Tb. not detected");
    await sleep(400);

    // Step 21: Click Submit Test
    const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], .btn"));
    let submitBtn = buttons.find(b => {
        const txt = (b.innerText || b.value || "").trim().toLowerCase();
        return txt === "submit test" || txt === "submit";
    });

    if (!submitBtn) {
        submitBtn = document.querySelector("button.btn.btn-primary") || document.querySelector("button.btn-success");
    }

    if (submitBtn) {
        console.log("[Nikshay Trunat] Clicking Submit Test button...");
        submitBtn.click();
        await sleep(500);
    } else {
        console.error("[Nikshay Trunat] Submit Test button not found!");
    }

    // Wait for submission response / toast message
    await getToast();
    const toastMsg = document.getElementById("toast-container")?.querySelector(".toast-message")?.innerText || "Submitted successfully";
    console.log("[Nikshay Trunat] Toast Result:", toastMsg);
    document.title = toastMsg;

    // Save status and progress
    currentData["id"] = toastMsg;
    data[current] = currentData;
    await chrome.storage.local.set({ data_trunat: data });
    await chrome.storage.sync.set({ current_trunat: current + 1 });

    // Step 22: Loop for all IDs provided in the uploaded excel file
    if (current + 1 < data.length) {
        console.log(`[Nikshay Trunat] Moving to next record (${current + 2}/${data.length})...`);
        await sleep(1500);

        const nextData = data[current + 1];
        const next_id = getRowVal(nextData, "NIKSHAY ID", "Nikshay ID", "Patient ID", "Patient Id", "ID", "id");
        if (next_id) {
            location.replace(`/Dashboard/Diagnostics/${next_id}`);
        } else {
            location.replace(`/Dashboard/Diagnostics/0`);
        }
    } else {
        console.log("[Nikshay Trunat] All records completed successfully!");
        alert("All Trunat test records have been processed successfully!");
    }
}

window.__nikshayTrunatHeartbeat = function () {
    try {
        const toastMsg = document.getElementById("toast-container")?.querySelector(".toast-message")?.innerText;
        if (toastMsg) return { state: "submitted", text: toastMsg };
        const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], .btn"));
        const submitBtn = buttons.find(b => {
            const txt = (b.innerText || b.value || "").trim().toLowerCase();
            return txt === "submit test" || txt === "submit";
        });
        if (submitBtn) return { state: "ready_to_submit" };
        return { state: "in_progress" };
    } catch (e) {
        return { state: "heartbeat_error", error: e.message };
    }
};

async function startTrunat() {
    if (window.__nikshayTrunatStarted) return;
    window.__nikshayTrunatStarted = true;
    await sleep(1500);
    Main();
}

if (document.readyState === "complete") {
    startTrunat();
} else {
    window.addEventListener("load", startTrunat);
}
})();
