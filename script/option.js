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

        await chrome.storage.local.set({ "data": sheet });
        await chrome.storage.sync.set({ "current": 0 });
        document.title = "Upload Successfully!!";
        location.reload();
    } catch (err) {
        showLoading(false);
        console.error("Upload failed:", err);
        alert("Could not read file: " + (err?.message || err));
    }
}

const HeaderArray = [
    "Type of Case Finding",
    "First Name",
    "Last Name",
    "Father/Husband's Name",
    "Age",
    "Gender",
    "Mobile",
    "Caste",
    "Address",
    "Health Facility",
    "Village",
    "Pincode",
    "Area",
    "Marital Status",
    "Symptoms",
    "If Symptoms Others",
    "Key Population",
    "HIV Status",
    "PHI"
];

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

    local?.data?.slice(from, from + to).forEach((element, n) => {
        const tr = document.createElement("tr");

        const tdSn = document.createElement("td");
        tdSn.innerText = n + from + 1;
        tr.appendChild(tdSn);

        ["id", ...HeaderArray].forEach(item => {
            const td = document.createElement("td");
            td.innerText = element[item] || element[item.toLowerCase()] || element[item.toUpperCase()] || "";
            tr.appendChild(td);
        });

        elm.appendChild(tr);
    });
}

async function updateInfo() {
    local = await chrome.storage.local.get();
    sync = await chrome.storage.sync.get();

    document.getElementById("switch").checked = sync?.isOn === true;

    const infoTotal = document.getElementById("infoTotal");
    const totalCount = local?.data?.length || 0;
    infoTotal.innerText = totalCount;

    const infoDone = document.getElementById("infoDone");
    const doneCount = sync?.current || 0;
    infoDone.innerText = doneCount;

    document.getElementById("infoRemain").innerText = Math.max(0, totalCount - doneCount);
}

async function refreshView() {
    await updateInfo();
    const current = sync?.current || 0;
    const dataListCount = current > 3 ? current - 2 : current;
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
        const count = s?.current || 0;
        if (e.target.id === "skip") {
            await chrome.storage.sync.set({ "current": count + 1 });
        } else if (count > 0) {
            await chrome.storage.sync.set({ "current": count - 1 });
        }
        await refreshView();
    });
});

document.getElementById("deleteSheet").addEventListener("click", async () => {
    if (confirm("Do you want to delete sheet")) {
        await chrome.storage.local.set({ "data": [] });
        await chrome.storage.sync.set({ "current": 0 });
        location.reload();
    }
});

document.getElementById("switch").addEventListener("change", async (e) => {
    await chrome.storage.sync.set({ "isOn": e.target.checked });
});

chrome.storage.onChanged.addListener(async (change, namespace) => {
    if (
        (namespace === "sync" && (change.hasOwnProperty("current") || change.hasOwnProperty("isOn"))) ||
        (namespace === "local" && change.hasOwnProperty("data"))
    ) {
        await refreshView();
    }
});

document.getElementById("exportSheet").addEventListener("click", async () => {
    local = await chrome.storage.local.get();
    const data = local?.data;
    if (!data || !data.length) {
        alert("No enrollment data found. Please upload a sheet first.");
        return;
    }
    exportDatasetToCSV(data, HeaderArray, "Nikshay_Enrollment.csv");
});

function capitalizeFirstLetter(string) {
    string = string.trim();
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function checkSymptoms(sym) {
    return [
        "Asymptomatic",
        "Cough for more than 2 weeks",
        "Coughing up blood",
        "Fever",
        "Weight loss",
        "Night sweat",
        "Chest pain",
        "Shortness of breath",
        "Fatigue",
        "Failure to gain weight (in children)",
        "Decreased activity or playfulness (in children)",
        "Others"
    ].includes(sym) ? sym : "Cough for more than 2 weeks";
}

function activeOrPasive(isActive) {
    return isActive.toLowerCase().includes("active") ? "Active (Active Case Finding)" : "Passive (Routine programme)";
}

function checkKeyPop(key) {
    return [
        "Anti-TNF treatment",
        "Bronchial Asthma",
        "Cancer",
        "Cardiovascular Disorder",
        "Contact of Known TB Patients",
        "COPD",
        "COVID recovered patients",
        "Diabetes",
        "Dialysis",
        "Health Care Worker",
        "Hypertensive",
        "Lactating mother",
        "Liver Impairment",
        "Migrant",
        "Miner",
        "Palliative Care",
        "Patient on immunosuppressants",
        "Pregnancy",
        "Prison",
        "Illegal Immigrant",
        "Renal Impairment",
        "Transplantation",
        "Urban Slum",
        "H/o Adult BCG Vaccination",
        "Undernourished / Malnourished (BMI <18.5 kg/m2)",
        "Elderly (age >60 years)",
        "Workplace settings (coal/ sandblasting/ brick kiln)",
        "Tea garden worker",
        "Construction site worker",
        "Congregate settings",
        "Attendees of de-addiction centers",
        "Person exposed to indoor air pollution",
        "Marginalized populations at risk of HIV",
        "LGBTQAI++",
        "Substance abuse (alcoholic/ intravenous drug users)",
        "Tobacco/smoker",
        "Silica exposure/silicosis",
        "Other",
        "Not Applicable"
    ].includes(key) ? key : "Other";
}

function checkCaste(caste) {
    if (!caste) return null;
    const c = caste.toString().trim();
    const upper = c.toUpperCase();
    if (upper === "SC") return "SC";
    if (upper === "ST") return "ST";
    if (upper.startsWith("OTHER")) return "Others";
    return c;
}

async function add(data, userjson) {
    let currentDate = new Date();
    const age = data["Age"] - 0;
    currentDate.setFullYear(currentDate.getFullYear() - age);
    const dob = currentDate.toISOString().split("-")[0];

    const res = await fetch("https://nikshay.in/api/patients/AddIndiaTB?" + (new Date()).getTime(), {
        method: "POST",
        headers: {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9,hi;q=0.8",
            "content-type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
            "TypeOfPatient": "IndiaTbPublic",
            "Stage": "PRESUMPTIVE_OPEN",
            "RegistrationDate": (new Date()).toISOString().split("T")[0].split("-").reverse().join("-"),
            "SelectedHierarchyId": userjson.Id,
            "FirstName": data["First Name"],
            "LastName": data["Last Name"],
            "FathersName": data["Father/Husband's Name"],
            "Age": age,
            "Gender": capitalizeFirstLetter(data["Gender"]),
            "PrimaryPhone": data["Mobile"],
            "SecondaryPhone1": null,
            "SecondaryPhone2": null,
            "SecondaryPhone3": null,
            "Address": data["Address"],
            "Ward": null,
            "Taluka": null,
            "Landmark": null,
            "ResidenceHierarchyId": userjson.Level_6_Id,
            "ResidenceHierarchyAll": [
                userjson.Level_1_Id,
                userjson.Level_2_Id,
                userjson.Level_3_Id,
                userjson.Level_4_Id,
                userjson.Level_5_Id,
                userjson.Level_6_Id
            ],
            "Pincode": data["Pincode"],
            "Area": data["Area"],
            "MaritalStatus": data["Marital Status"],
            "Occupation": "Unknown",
            "SocioeconomicStatus": "Unknown",
            "KeyPopulation": checkKeyPop(data["Key Population"]),
            "VaccinationDate": null,
            "Symptom": checkSymptoms(data["Symptoms"]),
            "HIVStatus": "Unknown",
            "ContactPersonPhone": null,
            "ContactPersonName": null,
            "ContactPersonAddress": null,
            "parentEpisodeId": null,
            "IsPossibleDuplicate": false,
            "Source": null,
            "SourcePatientId": null,
            "TypeOfCaseFinding": activeOrPasive(data["Type of Case Finding"]),
            "InformantId": null,
            "DateOfBirth": "01-01-" + dob,
            "FollowUpsDone": [],
            "TbWinReferenceId": null,
            "Caste": checkCaste(data["Caste"] || data["caste"] || data["CASTE"]),
            "caste": checkCaste(data["Caste"] || data["caste"] || data["CASTE"])
        })
    });

    const json = await res.json();
    return json.PatientId;
}

class TrackablePromise {
    constructor(promise) {
        this._promise = promise;
        this._state = "pending";

        promise
            .then((res) => {
                this._state = res;
            })
            .catch(() => {
                this._state = "rejected";
            });
    }

    getState() {
        return this._state;
    }

    then(onFulfilled, onRejected) {
        return this._promise.then(onFulfilled, onRejected);
    }

    catch(onRejected) {
        return this._promise.catch(onRejected);
    }

    finally(onFinally) {
        return this._promise.finally(onFinally);
    }
}

async function boost() {
    const holdHelth = { "Name": "", "Id": "" };
    const holdVillage = { "Name": "", "Id": "" };
    const username = sync.username;
    const isUserFound = (await (await fetch("https://nikshay.in/UserManagement/UserFacilityList")).text()).toLowerCase().includes(username.toLowerCase());
    if (!isUserFound) {
        alert("Please Login With: " + username);
        return;
    }
    const userjson = (await (await fetch(`https://nikshay.in/API/UserFacility/getListDataUpdate/?UserName=${username}`)).json())[0];
    const Health = (await (await fetch(`https://nikshay.in/API/UserFacility/GetWithChildren/${userjson.Level_4_Id}?`)).json());
    for (let index = sync.current; index < local.data.length; index++) {
        const allData = local.data;
        const data = allData[index];
        if (holdHelth.Name != data["Health Facility"]) {
            console.log("new Health Facility Loading");
            userjson["Level_5_Id"] = Health.filter((e) => (e.Name.toLowerCase() == data["Health Facility"]?.toLowerCase()?.trim()) && e.Level == 5).reverse()[0]?.Id;
            if (!userjson["Level_5_Id"]) {
                alert("Health Facility Not Found: " + data["Health Facility"]);
                break;
            } else {
                holdHelth.Name = data["Health Facility"];
                holdHelth.Id = userjson["Level_5_Id"];
            }
        } else {
            userjson["Level_5_Id"] = holdHelth.Id;
        }

        if (holdVillage.Name != data["Village"]) {
            console.log("new Village Loading");
            const village = (await (await fetch(`https://nikshay.in/API/Hierarchy/GetHierarchyChildrenKeyValue?id=${userjson["Level_5_Id"]}&type=VILLAGE&fromAssociation=true&onlyActiveHierarchies=true&`)).json()).Data;
            userjson["Level_6_Id"] = village.filter((e) => e.Name.toLowerCase() == data["Village"]?.toLowerCase()?.trim())[0]?.id;
            if (!userjson["Level_6_Id"]) {
                alert("Village Not Found: " + data["Village"]);
                break;
            } else {
                holdVillage.Name = data["Village"];
                holdVillage.Id = userjson["Level_6_Id"];
            }
        } else {
            userjson["Level_6_Id"] = holdVillage.Id;
        }
        const ids = await add(data, userjson);

        console.log(ids, data);
        data["id"] = ids;
        await chrome.storage.local.set({ data: allData });
        await chrome.storage.sync.set({ current: index });
    }
}
