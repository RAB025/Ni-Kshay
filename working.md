# Ni-Kshay Automation — Comprehensive Architecture, Permissions & Working Guide

> **Internal Reference & Complete Technical Documentation**  
> **App Name:** Ni-Kshay Automation (formerly Ni-Kshay Manager)  
> **Version:** 2.2.0 (`V2.2.0`)  
> **Package ID (Android):**
>   - **Admin / User Management App:** `com.nikshay.admin` (`Nikshay-Manager.apk`)
>   - **Client Automation App:** `com.nikshay.automation` (`Ni-Kshay-Automation.apk`)  
> **Target Portal:** [Ni-Kshay India TB Elimination Portal](https://nikshay.in)  
> **Author:** Antigravity AI Engine  
> **Last Updated:** 2026-11-11

---

## 0. Dual-App Architecture & Access PIN Security Vault

To completely isolate administration controls from field clients and prevent Android package update collisions, the project is structured as **two independent product flavors with unique package IDs**:

| Characteristic | Ni-Kshay Manager (Admin Console) | Ni-Kshay Automation (Client App) |
| :--- | :--- | :--- |
| **Package ID** | `com.nikshay.admin` | `com.nikshay.automation` |
| **Release Binary** | `dist/Nikshay-Manager.apk` (5.46 MB) | `dist/Ni-Kshay-Automation.apk` (5.46 MB) |
| **Target User** | Program Director / District Administrator | Field Health Staff / Lab Technicians / Clients |
| **Primary Tab 1** | `👑 User Manager` (`admin.html`) | `⚡ Automation` (`option.html` / `login.html`) |
| **Security Gate** | **Access PIN Security Vault Gate** (`#loginGate`) | **HMAC-SHA256 Signed Token Gate** (`login.html`) |
| **PIN Mechanism** | Touch numeric keypad (0–9, ⌫, 🔓) + 4 masked dots | Auto-extracts Login ID when token is pasted |
| **Default PINs** | `admin2026` or `2026` (or custom stored PIN) | N/A (Requires Admin-generated token) |
| **Asset Server Routing** | Maps `option.html` / `login.html` ➔ `admin.html` | Returns **403 Forbidden** for `admin.html` |
| **Management UI** | Quick duration pills (7d, 15d, 30d, 90d, 1y, custom), client history with search & 1-click `⚡ Renew (+30d)`, token verifier, session lock | Complete removal of manager console links and backdoor navigation |

```
                                  ┌─────────────────────────────┐
                                  │      Ni-Kshay Ecosystem     │
                                  └──────────────┬──────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
    ┌─────────────────────────────┐                             ┌─────────────────────────────┐
    │   Ni-Kshay Manager (Admin)  │                             │ Ni-Kshay Automation (Client)│
    │    [com.nikshay.admin]      │                             │  [com.nikshay.automation]   │
    ├─────────────────────────────┤                             ├─────────────────────────────┤
    │ • Access PIN Security Gate  │                             │ • Token Login (NKA1...)     │
    │   (Keypad + PIN dots)       │                             │ • Field Staff Enrollment    │
    │ • Token Generator (HMAC)    │ ──── WhatsApp / Share ────> │ • X-Ray / Trunat Automation │
    │ • Client Directory & Search │       (Signed Token)        │ • Background Service        │
    │ • 1-Click Renew (+30d)      │                             │ • Zero Admin Controls       │
    └─────────────────────────────┘                             └─────────────────────────────┘
```

---

## 1. Executive Summary & Core Purpose

**Ni-Kshay Automation** is a high-efficiency automation and bulk-entry platform created for Indian healthcare workers, lab technicians, and National Tuberculosis Elimination Programme (NTEP) field staff. 

The Government of India's [Ni-Kshay Portal](https://nikshay.in) requires extensive multi-step manual data entry for presumptive TB patients, diagnostic tests, and lab results. Performing this manually for hundreds of field screening patients involves significant repetitive labor, cascading AJAX delays, and human error.

Ni-Kshay Automation provides an **automated end-to-end workflow**:
1. Users upload structured spreadsheets (`.xlsx` / `.xls` / `.csv`).
2. The system reads and stages patient rows in persistent local storage.
3. The engine automates form filling on `nikshay.in` in real time: selecting radio buttons, navigating cascading Vue dropdowns, waiting for asynchronous AJAX loaders, inputting demographic data, handling Aadhaar & caste categorizations, and submitting the forms.
4. It extracts generated **Nikshay Patient IDs** or **Diagnostic Test Result Toasts** from the live DOM and updates the dataset.
5. Users can export the completed dataset back to Excel/CSV with the assigned Nikshay IDs.

The project exists as **two unified implementations**:
1. **Desktop / Chromium Browser Extension:** Manifest V3 extension (`manifest.json`) running background service workers and content scripts.
2. **Native Android Application (`com.nikshay.manager`):** A dual-WebView hybrid Android application that packages the extension UI, hosts it locally via an internal asset server (`AssetServer.kt`), bridges Chrome Extension APIs to native Kotlin code (`android_chrome_shim.js`), and controls a live portal WebView (`MainActivity.kt`).

---

## 2. All Permissions and Accesses

The solution operates on two platforms (Android Native App and Browser Extension). Below is the comprehensive breakdown of all permissions, hardware/system accesses, network policies, and host permissions.

### A. Android Application Permissions (`AndroidManifest.xml`)

| Permission / Access | Level | Declaration & Target | Why It Is Needed / What It Accesses |
| :--- | :--- | :--- | :--- |
| **`android.permission.INTERNET`** | Normal | Manifest | Essential for all network communication with `https://nikshay.in`: logging in, fetching user facility trees, adding India TB patients, executing live portal navigation in `portalWebView`, and downloading server-side reports. |
| **`android.permission.ACCESS_NETWORK_STATE`** | Normal | Manifest | Monitors active network state and connectivity status before initiating heavy webview page loads and network requests. |
| **`android.permission.FOREGROUND_SERVICE`** | Normal | Manifest | Enables running `AutomationService` as an Android Foreground Service so the process is never terminated by the OS when minimized. |
| **`android.permission.FOREGROUND_SERVICE_DATA_SYNC`** | Normal (API 34+) | Manifest | Required by Android 14+ for foreground services conducting background data synchronization/processing (`dataSync`). |
| **`android.permission.POST_NOTIFICATIONS`** | Runtime (API 33+) | Manifest | Allows posting the ongoing background automation progress notification on Android 13+. |
| **`android.permission.WAKE_LOCK`** | Normal | Manifest | Allows acquiring a `PARTIAL_WAKE_LOCK` while automation is running so the device CPU remains awake and timers execute even when the screen is locked. |
| **`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`** | Normal | Manifest | Allows prompting the user to whitelist the app from OEM battery kill policies (Xiaomi, Samsung, OnePlus) to guarantee non-stop background operation. |
| **`WRITE_EXTERNAL_STORAGE` (Removed)** | None (Zero Dangerous) | Removed from Manifest | **Eliminated.** Previously included for legacy devices (Android 9 / API 28 and below), but completely redundant because modern Android (Android 10+ / API 29-15) uses `MediaStore.Downloads` for public downloads, and app-specific directories (`getExternalFilesDir()`) require zero permissions across all Android versions. Removing it leaves the app with **ZERO dangerous / runtime permissions**, avoiding privacy warnings, permission dialogs, and Play Store review delays. |
| **`FileProvider` Access** | Component | `<provider>`: `${applicationId}.fileprovider` | Maps private app storage (`Downloads/NikshayManager/`) to secure `content://` URIs with `FLAG_GRANT_READ_URI_PERMISSION`. Allows user to open or share exported CSVs and templates directly with Excel, Google Sheets, WhatsApp, Gmail, etc. |
| **System File Picker (`ACTION_OPEN_DOCUMENT`)** | Intent | `fileChooserLauncher` | Triggers the system document picker (`*/*`, `.xlsx`, `.csv`) when the user taps "Choose File" inside the manager webview. |
| **System `DownloadManager`** | System Service | `Context.DOWNLOAD_SERVICE` | Intercepts native file download links inside `portalWebView` (e.g. portal patient reports), forwards current session cookies & User-Agent, and queues downloads into Android's public `Downloads` folder. |
| **Cleartext Traffic Policy** | Security Config | `android:usesCleartextTraffic="false"` | Enforces strict HTTPS communication. Disallows unencrypted HTTP traffic to protect sensitive patient medical data. |
| **WebView JavaScript Interface (`NikshayBridge`)** | IPC / Bridge | `@JavascriptInterface` | Exposes native Android functions to the embedded WebView under `window.AndroidBridge`. Provides persistent storage operations (`SharedPreferences` & local files), native CSV file creation, and template downloads. |
| **Cookie Management (`CookieManager`)** | Web Security | `CookieManager.getInstance()` | Enables cookies and third-party cookies across both `portalWebView` and `managerWebView`, ensuring seamless session sharing between the user's portal login and background scripts. |

---

### B. Chrome / Browser Extension Permissions (`manifest.json`)

| Permission | Manifest Field | Purpose & Scope of Access |
| :--- | :--- | :--- |
| **`unlimitedStorage`** | `permissions` | Bypasses standard browser quota limits (typically 5MB/10MB) for `chrome.storage.local`. Required because patient spreadsheets can contain thousands of records with extensive demographic and diagnostic JSON data. |
| **`storage`** | `permissions` | Grants access to `chrome.storage.local` (for storing patient datasets `data`, `data_x_ray`, `data_trunat`) and `chrome.storage.sync` (for state flags `isOn`, `isOn_x_ray`, `isOn_trunat`, counters `current`, `current_x_ray`, `current_trunat`, and user preferences). |
| **`identity`** | `permissions` | Allows calling `chrome.identity.getProfileUserInfo()` to query the authenticated Chrome user profile. Used to verify authorization and display user identity in the UI. |
| **`identity.email`** | `permissions` | Sub-permission of `identity` granting read access to the email address of the active signed-in Chrome profile. |
| **`*://*.nikshay.in/*`** (Optimized from `<all_urls>`) | `host_permissions` | Scoped strictly to the Ni-Kshay domain. Replaced broad `<all_urls>` to eliminate browser store security warnings ("Can read and change your data on all websites") without affecting any functionality. Grants permission to inject content scripts and perform cross-origin `fetch()` calls to `https://nikshay.in/*` and internal API endpoints (`/api/patients/AddIndiaTB`, `/API/UserFacility/...`, `/API/Hierarchy/...`). |
| **Content Scripts Injection** | `content_scripts` | Injects automation scripts into active browser tabs: <br>• `script/content.js` into `https://nikshay.in/Dashboard/NewEnrollment/*`<br>• `script/content_x_ray.js` into `https://nikshay.in/Dashboard/Diagnostics/*`<br>• `script/content_trunat.js` into `https://nikshay.in/*` |
| **Background Service Worker** | `background.service_worker` | Runs `script/background.js` in the background for extension install/startup lifecycle events and communication port handling. |

---

## 3. High-Level Architecture

The repository is structured with a shared web core that runs both as a standard browser extension and inside a custom Android native wrapper.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Ni-Kshay Manager Core                           │
│  (HTML, CSS, JS, SheetJS, XLSX Export, Automation Scripts, Templates)  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       Chrome / Kiwi Extension        │  │       Native Android Application     │
│       (Manifest V3 Ecosystem)        │  │        (`com.nikshay.manager`)       │
├──────────────────────────────────────┤  ├──────────────────────────────────────┤
│ • manifest.json                      │  │ • AssetServer (nikshay-manager.local)│
│ • script/background.js (Worker)      │  │ • android_chrome_shim.js (Polyfill)  │
│ • popup.html + popup.js              │  │ • NikshayStorage (Prefs + JSON file) │
│ • option.html + x-ray.html + trunat  │  │ • Dual-WebView (Manager + Portal)    │
│ • content.js / x_ray.js / trunat.js  │  │ • FileDownloadHelper (MediaStore)    │
│ • Storage: chrome.storage API        │  │ • Storage: NikshayBridge -> Kotlin   │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## 4. Component Deep Dive

### 4.1. Android Native Core (`android-app/`)

#### 1. `MainActivity.kt` (`com.nikshay.manager.MainActivity`)
The central UI container and controller.
- **Dual WebView Architecture:**
  - `managerWebView`: Displays the internal manager interface (`https://nikshay-manager.local/option.html`, `x-ray.html`, `trunat.html`).
  - `portalWebView`: Loads the live government portal (`https://nikshay.in/`).
- **Tab Switcher:** Bottom navigation toggles between "Manager" and "Nikshay Site" tabs smoothly while keeping both WebViews active in memory.
- **Portal Automation Injection (`injectPortalAutomation`):**
  - When `portalWebView` finishes loading a page matching `nikshay.in`:
    1. Injects `android_chrome_shim.js` into the page context.
    2. Inspects `location.pathname`.
    3. If `/Dashboard/NewEnrollment/*` -> injects `script/content.js`.
    4. If `/Dashboard/Diagnostics/*` -> injects `script/content_x_ray.js`.
    5. Always injects `script/content_trunat.js`.
- **Top Portal Toolbar:**
  - Back button (navigates portal history or returns to manager).
  - Reload button.
  - Live progress display (`tvPortalStatus` e.g. `Enroll: 45/120`). Tapping this cycles through modes (`enrollment` ➔ `x_ray` ➔ `trunat`).
  - Auto-automation toggle switch (`switchPortalAuto`). When turned ON, reloads the portal and starts automated data entry.
  - Desktop Mode toggle (`btnDesktopMode`): Switches `User-Agent` between desktop Chrome (`Windows NT 10.0`) and mobile Chrome (`Linux; Android 13`), adjusting viewport zooming accordingly.
- **File Chooser Handler (`fileChooserLauncher`):** Implements `WebChromeClient.onShowFileChooser()` using `ACTION_OPEN_DOCUMENT` to allow spreadsheet file selection from Android's file system.
- **Web Alerts & Prompts:** Implements `onJsAlert`, `onJsConfirm`, `onJsPrompt` transforming browser popups into native Material AlertDialogs.
- **JavaScript Bridge (`NikshayBridge`):**
  - `@JavascriptInterface storageGet(namespace, keysJson)`
  - `@JavascriptInterface storageSet(namespace, itemsJson)`
  - `@JavascriptInterface storageRemove(namespace, keysJson)`
  - `@JavascriptInterface storageClear(namespace)`
  - `@JavascriptInterface getAppVersion()`
  - `@JavascriptInterface openPortalUrl(url)`
  - `@JavascriptInterface onPortalUrlChanged(url)`
  - `@JavascriptInterface saveCsvFile(filename, csvContent)`
  - `@JavascriptInterface downloadAssetTemplate(assetName)`

#### 2. `AssetServer.kt` (`com.nikshay.manager.AssetServer`)
A virtual local web server that intercepts WebView network requests:
- **Host:** Intercepts all requests targeting `https://nikshay-manager.local/`.
- **Security:** Sanitizes paths and blocks path traversal attempts (`..`).
- **Dynamic Shim Injection:** Automatically intercepts any `.html` asset read and injects `<script src="/__android_shim__.js"></script>` into the `<head>` tag.
- **MIME Type Mapping:** Properly returns MIME types for `.js`, `.css`, `.html`, `.json`, `.png`, `.webp`, `.xlsx`, `.csv`.

#### 3. `android_chrome_shim.js` (`assets/android_chrome_shim.js`)
The bridge shim injected into all web contexts running inside the Android app.
- **Emulates `chrome.storage.local` and `chrome.storage.sync`:** Maps `.get()`, `.set()`, `.remove()`, `.clear()` calls directly to `window.AndroidBridge`.
- **Emulates `chrome.storage.onChanged`:** Maintains listeners and fires change events when Android broadcasts state changes (`window.__dispatchChromeStorageChanged`).
- **Emulates `chrome.runtime`:** Provides mock `getManifest()` returning `V2.2.0`, `getURL(path)`, and connection ports.
- **Emulates `chrome.identity`:** Mock returns identity as `Android App` (`id: android`).
- **Single Page App (SPA) Navigation Hook:** Intercepts `history.pushState`, `history.replaceState`, `popstate`, and `hashchange` on `nikshay.in` to notify native Android when routes change, re-triggering script injection when appropriate.

#### 4. `NikshayStorage.kt` (`com.nikshay.manager.NikshayStorage`)
The multi-tier persistence engine for Android:
- **`sync` Namespace:** Backed by Android `SharedPreferences` (`nikshay_sync_prefs`). Stores lightweight flags, sync counters, and configuration values (`isOn`, `current`, `username`, `mobile`).
- **`local` Namespace:** Backed by atomic JSON files in app internal storage (`/files/nikshay_local/{key}.json`). Safely stores high-volume arrays (`data`, `data_x_ray`, `data_trunat`) avoiding `SharedPreferences` payload limits and preventing memory crashes.
- **Mode Status Helper (`getModeStatus`):** Computes total rows, completed rows, and active toggle state for any mode (`enrollment`, `x_ray`, `trunat`).

#### 5. `FileDownloadHelper.kt` (`com.nikshay.manager.FileDownloadHelper`)
Handles cross-version Android file persistence:
- **Android 10+ (Q / API 29 to Android 15):** Uses `MediaStore.Downloads` (`MediaStore.Downloads.EXTERNAL_CONTENT_URI`) with `IS_PENDING` flags to write directly into `Downloads/NikshayManager` without requiring broad storage permissions.
- **Android 7-9 (API 24 to 28):** Writes to `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)`.
- **FileProvider Integration:** Writes an internal app copy in `context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)` and issues a `content://` URI via `FileProvider` so users can instantly open or share the file.

#### 6. `AutomationService.kt` (`com.nikshay.manager.AutomationService`)
The dedicated Foreground Service that powers non-stop background execution:
- **Foreground Service (`dataSync`):** Binds to Android 14+ `FOREGROUND_SERVICE_DATA_SYNC` to guarantee process survival when the app is minimized.
- **CPU WakeLock:** Acquires a `PowerManager.PARTIAL_WAKE_LOCK` with an 8-hour safety window, preventing CPU sleep and maintaining timer execution even when the screen is locked or in pocket.
- **Ongoing Notification:** Displays real-time progress (`Truenat: 14/150 - Running in background`) with single-tap "Open App" and "Stop" actions.
- **Battery Optimization Whitelist Prompt:** Proactively offers users a one-tap grant to disable aggressive OEM battery killing (Xiaomi, Samsung, OnePlus).
- **Accidental Exit Prevention:** Back navigation automatically calls `moveTaskToBack(true)` while automation is running instead of killing the activity.

---

### 4.2. Core Functional Modules & Automation Scripts

The tool provides three primary automation pipelines, each with its own management screen, spreadsheet template, and DOM automation content script.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3 Core Automation Modules                       │
├──────────────────────┬─────────────────────────┬───────────────────────┤
│  1. New Enrollment   │    2. Chest X-Ray       │    3. Truenat (MTB)   │
├──────────────────────┼─────────────────────────┼───────────────────────┤
│ • UI: option.html    │ • UI: x-ray.html        │ • UI: trunat.html     │
│ • JS: option.js      │ • JS: x-ray.js          │ • JS: trunat.js       │
│ • Script: content.js │ • Script: content_x_ray │ • Script: content_tru │
│ • Template:          │ • Template:             │ • Template:           │
│   Nikshay Tamplate   │   X-Ray Tamplate        │   Trunat Tamplate     │
│ • Storage: data      │ • Storage: data_x_ray   │ • Storage: data_trunat│
│ • Counter: current   │ • Counter: current_x_ray│ • Counter: current_tru│
└──────────────────────┴─────────────────────────┴───────────────────────┘
```

---

### Module 1: Patient Enrollment (`option.html` & `content.js`)

- **Template:** `Nikshay Tamplate.xlsx`
- **Key Columns:** `Type of Case Finding`, `First Name`, `Last Name`, `Father/Husband's Name`, `Age`, `Gender`, `Mobile`, `Caste`, `Address`, `Health Facility`, `Village`, `Pincode`, `Area`, `Marital Status`, `Symptoms`, `If Symptoms Others`, `Key Population`, `HIV Status`, `PHI`.
- **Automation Pipeline (`script/content.js`):**
  1. Reads staged records from `chrome.storage.local.get("data")` and counter from `chrome.storage.sync.get("current")`.
  2. Navigates to `https://nikshay.in/Dashboard/NewEnrollment/*`.
  3. Automatically clicks patient type (`[name=patientTypeRadio]`).
  4. Resolves PHI (Public Health Institution) selection modal if configured.
  5. Selects Case Finding radio (`Active (Active Case Finding)` vs `Passive (Routine programme)`).
  6. Fills demographic fields: First Name, Last Name, Father's Name, Age, Gender.
  7. Bypasses Aadhaar biometric verification by toggling `[name=aadhaarAvailable]` to "No".
  8. Selects Caste (`SC`, `ST`, `Others`) using multi-tier fallback selectors (by value, radio container, label text, or native select).
  9. Handles symptoms checklist (clears "Asymptomatic", checks specified symptom e.g. "Cough for more than 2 weeks").
  10. Asynchronously waits for cascading administrative boundary loaders:
      - Waits for `.vs__spinner` on State, District, and Tuberculosis Unit (TU).
  11. Types and searches the `Health Facility` inside the Vue-select listbox using string cleaning/normalization.
  12. Types and searches the `Village` in the subsequent dropdown.
  13. Fills Primary Mobile Number.
  14. Clicks "ADD CASE AND PROCEED TO ADD TEST".
  15. Monitors the DOM for success bubble (`#patientAddedBubble` or `.toast-message`).
  16. Extracts the 5 to 12 digit **Nikshay Patient ID** using regex: `/\d{5,12}/`.
  17. Stores the extracted ID into `data[current].id`, updates `chrome.storage.local`, increments `current`, and triggers `location.reload()` to process the next row!
- **Fast-Track "Boost" Direct API Mode (`script/option.js`):**
  - Includes a direct API enrollment runner (`boost()`) that bypasses UI clicks entirely:
  - Validates session with `https://nikshay.in/UserManagement/UserFacilityList`.
  - Resolves facility hierarchy IDs via `/API/UserFacility/GetWithChildren/` and `/API/Hierarchy/GetHierarchyChildrenKeyValue`.
  - Directly POSTs patient payload to `https://nikshay.in/api/patients/AddIndiaTB` with the user's active session cookies, achieving rapid bulk enrollment.

---

### Module 2: Chest X-Ray Diagnostics (`x-ray.html` & `content_x_ray.js`)

- **Template:** `X-Ray Tamplate.xlsx`
- **Key Columns:** `NIKSHAY ID`, `TESTING LAB`.
- **Automation Pipeline (`script/content_x_ray.js`):**
  1. Reads active index `current_x_ray` and dataset `data_x_ray`.
  2. Ensures the current page is `/Dashboard/Diagnostics/{NIKSHAY_ID}`. If not, redirects automatically.
  3. Selects Reason for Testing: `TB Screening`.
  4. Selects Test Type: `Chest X Ray`.
  5. Sets Result Availability to `Present` and Type of Case to `New`.
  6. Selects test date as Today via datepicker.
  7. Selects State (Default: `Jammu & Kashmir`).
  8. Selects the designated `Testing Lab` from the spreadsheet using Vue dropdown interaction (`selectVueDropdown`).
  9. Sets Final Interpretation (`#FinalInterpretation`).
  10. Clicks submit (`button.btn.btn-primary`).
  11. Captures the toast result message (`#toast-container .toast-message`), records it into the dataset, increments counter, and advances to the next record.

---

### Module 3: Truenat (MTB) Testing Automation (`trunat.html` & `content_trunat.js`)

- **Template:** `Trunat Tamplate.xlsx`
- **Key Columns:** `NIKSHAY ID`, `TESTING LAB`, `COLLECTION SITE` (supports flexible column header aliases via `COLLECTION_SITE_KEYS`).
- **Automation Pipeline (`script/content_trunat.js` - 1346 lines):**
  1. Verifies automation switch `isOn_trunat == true`.
  2. If not on Diagnostics page, navigates via menu or direct URL `https://nikshay.in/Dashboard/Diagnostics/0`.
  3. Sets search dropdown filter specifically to **"Patient ID"** (`selectSearchTypePatientId`).
  4. Inputs the Nikshay Patient ID and triggers the search magnifying glass.
  5. Detects patient details card and clicks the **"Add Test"** tab (`waitForAddTestTab`).
  6. Reason for Testing: `Diagnosis of TB`.
  7. Type of Case: `New`.
  8. Selects `Presumptive` radio button under Diagnosis of TB.
  9. Test Type: `Truenat (MTB)`.
  10. Testing Lab: Matches laboratory name from Excel.
  11. Sets Sample Availability to `Present` & Result Available to `Present`.
  12. Sputum Collection Detail: `Early Morning`.
  13. Sample Description: `Mucopurulent`.
  14. Collection Date: Sets to Today's date.
  15. Collection Time: Computes a realistic random collection time between **10:30 AM and 3:00 PM** (`setCollectionTime`).
  16. Collection Site: Selects site matching spreadsheet data (`setCollectionSite`).
  17. Sample ID: `Sample-1`.
  18. Date Reported: Sets to Today's date.
  19. Final Interpretation: `M.Tb. not detected`.
  20. Clicks `Submit Test`.
  21. Listens for toast confirmation, writes status to storage, and automatically navigates to the next patient ID until all rows complete.

---

### 4.3. Shared Utilities (`script/common.js`)

Central shared library used across all manager pages:
- **`parseSpreadsheetFile(file)`:** Auto-detects extension:
  - If `.CSV`: parses with custom CSV reader (`parseCSVLine`).
  - If `.XLS` / `.XLSX`: parses using SheetJS (`XLSX.read`).
- **`getRowVal(row, ...keys)`:** Robust case-insensitive and fuzzy header matcher to safely extract cell values even if users rename or format column headers slightly differently.
- **`exportTableToCSV(tableId, filename)`:** Dumps HTML table data into a clean CSV format and routes export through `AndroidBridge.saveCsvFile` on mobile or `URL.createObjectURL` Blob download on desktop.
- **`bindAndroidLinks()`:** Intercepts template download anchors (`data-template`) and portal links (`href="https://nikshay.in"`) to trigger native Android bridge methods (`downloadAssetTemplate` and `openPortalUrl`).
- **`checkAuthPort()`:** Performs license check handshake with `background.js` via runtime message port.

---

## 5. File Structure Reference

```
Ni-Kshay Manager Source/
│
├── manifest.json                    # Extension Manifest V3 configuration
├── login.html                       # Auth verification & status display
├── option.html                      # Manager UI: Patient Enrollment
├── x-ray.html                       # Manager UI: Chest X-Ray
├── trunat.html                      # Manager UI: Truenat (MTB)
├── popup.html                       # Extension action toolbar popup
├── Nikshay Tamplate.xlsx            # Default Excel template for Enrollment
├── X-Ray Tamplate.xlsx              # Default Excel template for X-Ray
├── Trunat Tamplate.xlsx             # Default Excel template for Truenat
│
├── script/                          # Frontend & Automation Logic
│   ├── background.js                # Extension service worker (startup & sync)
│   ├── common.js                    # Shared parsing, fuzzy header & CSV logic
│   ├── option.js                    # UI logic for Patient Enrollment page
│   ├── x-ray.js                     # UI logic for Chest X-Ray page
│   ├── trunat.js                    # UI logic for Truenat page
│   ├── login.js                     # Login screen logic & QR handler
│   ├── popup.js                     # Popup menu navigation logic
│   ├── content.js                   # DOM automation for New Enrollment
│   ├── content_x_ray.js             # DOM automation for Chest X-Ray
│   └── content_trunat.js            # DOM automation for Truenat Testing
│
├── lib/                             # Vendored Libraries
│   ├── jquery.min.js                # jQuery DOM library
│   ├── qrcode.min.js                # QR Code generator
│   ├── xlsx.js                      # SheetJS Excel parser
│   └── xlsxEport.js                 # SheetJS Export helper
│
├── css/                             # Stylesheets
│   ├── login.css                    # Login styling
│   └── option.css                   # Manager dashboard & table styling
│
├── Assets/                          # Extension icons & logos
│   ├── 16.png, 48.png, 128.png      # Application icons
│   ├── callLogo.png, whatsapp.png   # Support icons
│   └── sync.webp                    # Sync indicator icon
│
└── android-app/                     # Native Android Studio Project
    ├── build.gradle.kts             # Project root build config
    ├── settings.gradle.kts          # Gradle settings
    ├── nikshay-release.jks          # Release signing keystore
    └── app/
        ├── build.gradle.kts         # App module config (asset sync task, packaging)
        └── src/main/
            ├── AndroidManifest.xml  # Permissions, activity, fileprovider
            ├── assets/
            │   └── android_chrome_shim.js  # Chrome API polyfill for WebView
            ├── java/com/nikshay/manager/
            │   ├── MainActivity.kt         # Dual-WebView manager & portal host
            │   ├── AssetServer.kt          # Virtual https://nikshay-manager.local/
            │   ├── NikshayStorage.kt       # Prefs + Atomic JSON file storage
            │   └── FileDownloadHelper.kt   # Scoped storage & FileProvider exports
            └── res/
                ├── layout/activity_main.xml# Dual-view layout with portal toolbar
                ├── values/colors.xml       # Limegreen dark theme colors
                ├── values/strings.xml      # App name & tab labels
                └── xml/file_paths.xml      # FileProvider external path grants
```

---

## 6. How the Synchronization & Storage Engine Works

### Storage Namespaces

1. **`sync` Namespace:**
   - Stores control flags, automation switches, and progress counters:
     - `isOn`: Master boolean for Enrollment automation.
     - `current`: Integer pointer (row index) for Enrollment.
     - `isOn_x_ray` / `current_x_ray`: Boolean & counter for X-Ray.
     - `isOn_trunat` / `current_trunat`: Boolean & counter for Truenat.
     - `status`: License/activation status (`true`).
     - `username`, `mobile`: Logged-in health worker credentials.
2. **`local` Namespace:**
   - Stores the full dataset loaded from files:
     - `data`: Array of Enrollment patient objects.
     - `data_x_ray`: Array of X-Ray patient objects.
     - `data_trunat`: Array of Truenat patient objects.

### Reactivity Across Environments
- When a user uploads a sheet or toggles a switch on `option.html`:
  - Desktop Chrome: `chrome.storage.local.set()` triggers `chrome.storage.onChanged` across tabs.
  - Android App: `window.AndroidBridge.storageSet()` updates `NikshayStorage`. `MainActivity.bbroadcastStorageChange()` executes `window.__dispatchChromeStorageChanged()` on both `managerWebView` and `portalWebView`. The top portal status bar (`tvPortalStatus`) updates immediately without a page refresh!

---

## 7. Build and Deployment Notes

### Building the Android APK

#### Method 1: Command Line (PowerShell)
From the workspace root, run:
```powershell
# 1. Point JAVA_HOME to JDK 17+ (e.g. JetBrains JBR or your JDK installation)
$env:JAVA_HOME = "C:\Program Files\JetBrains\PyCharm Community Edition 2024.2.3\jbr"

# 2. Navigate to the android-app folder
cd "Ni-Kshay Manager Source\android-app"

# 3. Build signed Release APK
.\gradlew.bat assembleRelease

# 4. Copy to dist/
Copy-Item "app\build\outputs\apk\release\app-release.apk" "..\dist\Nikshay-Manager.apk" -Force
```

#### Method 2: Android Studio GUI
1. Open **Android Studio** (`C:\Program Files\Android\Android Studio`).
2. Click **File** ➔ **Open** and select the folder:
   `c:\Users\rzbb9\Downloads\Ni-Kshay Manager Source\Ni-Kshay Manager Source\android-app`
3. Wait for Gradle project sync to finish.
4. From the menu bar, click **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**, or use the Gradle panel on the right: `app ➔ Tasks ➔ build ➔ assembleRelease`.
5. Android Studio will show a popup with a `locate` link directly opening the built APK in File Explorer.

#### Build Automation Details
The Android Gradle build automatically synchronizes web assets during `preBuild`:
1. Task `syncExtensionAssets` copies `option.html`, `x-ray.html`, `trunat.html`, `login.html`, Excel templates, `css/`, `script/`, `lib/`, and `Assets/` directly from the parent directory into `app/build/generated/extensionAssets/extension/`.
2. Task `syncExtensionIcon` copies `Assets/128.png` to `ic_nikshay_logo.png`.
3. The release keystore `nikshay-release.jks` signs the release build:
   - Keystore: `nikshay-release.jks`
   - Store Password / Key Password: `nikshay2026`
   - Alias: `nikshay`
4. Generated APK location:
   - `android-app/app/build/outputs/apk/release/app-release.apk`
   - Mirrored to: `dist/Nikshay-Manager.apk`

### Packing the Chrome Extension
1. Pack root directory (excluding `android-app/` and `.git/`) into a `.zip`.
2. Distributed artifact: `dist/Nikshay-Manager-Mobile-Extension.zip`.

---

## 8. Summary Checklist for Future Inquiries

When modifying or debugging this project in the future, check this quick reference:

1. **Adding a new field to Enrollment:**
   - Add column to `HeaderArray` in [option.js](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/script/option.js#L54-L74).
   - Add DOM handling / input selector in [content.js](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/script/content.js#L260-L315).
   - Add field to `Nikshay Tamplate.xlsx`.
2. **Updating Truenat Automation:**
   - All logic is in [content_trunat.js](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/script/content_trunat.js). Note that collection site headers use fuzzy matching via `COLLECTION_SITE_KEYS`.
3. **Android Storage or Crash Issues with Large Spreadsheets:**
   - Checked in [NikshayStorage.kt](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/android-app/app/src/main/java/com/nikshay/manager/NikshayStorage.kt). Remember that `data`, `data_x_ray`, and `data_trunat` must remain in file-backed `local` storage, NOT `SharedPreferences`.
4. **Android Asset Updates:**
   - Edits made to root HTML, JS, CSS files are automatically mirrored to the Android app on build via Gradle task `syncExtensionAssets`.

---

## 9. Temporary Access Tokens & Renewal System

### A. Core Architecture
To prevent unauthorized usage and ensure time-bound operational control, the app uses a cryptographic, zero-dependency token system implemented in [`script/auth.js`](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/script/auth.js).

1. **Tamper-Proof Design:**
   - Tokens are signed with standard **HMAC-SHA256** using an Admin Master Secret Key.
   - The payload binds the **Login ID / Username**, optional **Password/PIN Hash**, **Creation Timestamp (`iat`)**, and exact **Expiration Timestamp (`exp`)**.
   - If a user attempts to alter the expiration date or modify their username, the HMAC signature validation fails instantly.

2. **Token Format:**
   ```
   NKA1-<Base64UrlPayload>-<HMAC-SHA256SignatureHex>
   ```

3. **Lifecycle & Expiration Flow:**
   ```
   [Admin Console (admin.html)]
         │
         │ (Admin inputs Login ID + Selects Duration e.g. 30 Days)
         ▼
   [Generated Signed Token (NKA1-...)]
         │
         │ (Sent via WhatsApp / SMS to health worker)
         ▼
   [Phone Activation (login.html)]
         │
         │ (User inputs Login ID + Pastes Token)
         ▼
   [Verification in auth.js]
         │
         ├─► Valid & Not Expired ──► [Unlocks App + Shows Days Countdown]
         │
         └─► Expired / Altered   ──► [Blocks Automation + Shows Renewal Screen]
   ```

### B. Admin Console (`admin.html`)
- **Access:** Open `admin.html` in any browser or on phone.
- **Security Gate:** Requires the Admin Master PIN (Default: `admin2026`).
- **Token Generator:**
  - Enter the staff member's Login ID / Username (e.g. `sts_anantnag` or `nurse_01`).
  - Optional Passcode / PIN.
  - Select Validity Preset: `1 Day`, `7 Days`, `15 Days`, `30 Days` (default), `60 Days`, `90 Days`, `1 Year`, or pick an exact calendar date/time.
  - Click **"Generate Signed Access Token"**.
  - One-click **"Copy Token"** or **"Share on WhatsApp"** with a pre-formatted message.
- **Token Verifier:**
  - Paste any token to inspect its owner, issue date, exact expiration, and validity status.

### C. Phone User Flow & Expiration Handling
- **Active State:** The app header displays the user ID and remaining validity countdown (e.g., `ID: nurse_01 | ⏱️ 24d left`).
- **Expiring Soon:** When <= 3 days remain, the badge highlights in red with a direct link to renew early.
- **Expired State:**
  - If a token expires while running or upon launching, the app locks and redirects to [`login.html`](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/login.html).
  - The user sees: *"Your access token expired on [Date]. Please enter the new token from your Admin."*
  - A single-tap **"Request Token on WhatsApp"** button opens a chat with Admin (`+91 7006444824`), pre-filling:
    `"Hello Admin, please provide a Ni-Kshay Automation token for Login ID: [user]"`
  - When the admin replies with the new token, the user taps **"Paste Token"**, clicks **"Activate / Renew Access"**, and the app immediately unlocks with the extended expiration date.

---

## 10. CSV File Export Architecture & Reliability Engine

### A. Root Cause of Previous Export Failures
1. **DOM Table Scraping Bottleneck:** Previously, clicking "Export Sheet" triggered `dataShow()` to render the entire dataset into the HTML DOM, followed by querying `tableList.querySelectorAll("tr")`. With hundreds or thousands of patients, forcing thousands of DOM layout computations and calling `cell.innerText` caused Chromium to freeze, timeout, or drop execution before reaching the Android bridge.
2. **Android MediaStore Name Collisions:** On Android 10+ (API 29–15), repeated exports to a fixed filename (`data.csv`) caused `contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, ...)` to throw `IllegalArgumentException` or fail silently due to existing pending files.
3. **Hidden Feedback:** Previous notification relied on a `Snackbar` bound to a WebView that was frequently unattached or hidden, making it appear as though nothing happened.

### B. Resolved Implementation
1. **Direct In-Memory Generation (`exportDatasetToCSV` in `script/common.js`):**
   - Directly serializes `chrome.storage.local.get("data")` in pure JavaScript memory without rendering or touching DOM elements.
   - Automatically handles UTF-8 Byte Order Mark (`\uFEFF`) for seamless compatibility with Microsoft Excel, Google Sheets, and LibreOffice.
   - Places the extracted Nikshay Patient ID (`Id`) in the second column (`S.N`, `Id`, ...data fields), ensuring generated IDs are immediately prominent.
   - Automatically resolves fuzzy headers (e.g. `COLLECTION SITE`, `TESTING LAB`).
2. **Timestamped Safe Filenames:**
   - Appends date/time to the export: `Nikshay_Enrollment_YYYYMMDD_HHmmss.csv`, `Nikshay_XRay_YYYYMMDD_HHmmss.csv`, `Nikshay_Trunat_YYYYMMDD_HHmmss.csv`.
   - Completely eliminates MediaStore conflicts and accidental file overwrites.
3. **Robust Multi-Tier File Storage (`FileDownloadHelper.kt`):**
   - **Tier 1 (Public Downloads):** Saved to `Downloads/NikshayManager/` via `MediaStore.Downloads` on Android 10+ and public external storage on Android 9 and below.
   - **Tier 2 (App-External Fallback):** Saved to `context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)/NikshayManager/`, guaranteeing 100% write success without requiring any runtime storage permissions.
   - **Media Scanner Indexing:** Immediately calls `MediaScannerConnection.scanFile` so newly exported sheets appear instantly in the phone's "Files" and "Downloads" apps.
4. **Interactive Action Dialog:**
   - Instead of a silent or hidden snackbar, the app displays a prominent `AlertDialog`:
     - **"Open File":** Directly launches the CSV in Microsoft Excel, Google Sheets, or WPS Office.
     - **"Share":** Opens the native Android share sheet to send the file directly over WhatsApp, Gmail, Google Drive, or Bluetooth.
     - **"Dismiss":** Clears the dialog while leaving the file saved.

---

## 11. Continuous Background Automation Engine & WebView Persistence

### A. Root Cause of Background Stalling ("Simply Starting")
1. **Chromium Background Throttling:** When an Android Activity moves to `onStop()` (minimized or screen off), Android notifies the View tree that the window is hidden (`dispatchWindowVisibilityChanged(View.GONE)`). Chromium aggressively throttles JavaScript timers (`setTimeout` and `setInterval`) to once per minute or freezes them completely.
2. **View Visibility Bug (`View.GONE`):** In `switchTab()`, the inactive WebView was marked `View.GONE`. In Android, `View.GONE` stops all layout and drawing passes, causing Chromium to halt all script execution.
3. **Missing Initial Navigation:** If the user toggled "Switch" / "Auto" from the Manager tab (`option.html`), `portalWebView` remained on `about:blank` or `Overview` without ever navigating to the active automation endpoint (`/Dashboard/NewEnrollment/0` or `/Dashboard/Diagnostics/0`).
4. **Infinite Error Loops in Content Scripts:** If an input field or dropdown (e.g. Village or PHI) was unmatched for record 0, `content.js` called `location.reload()` without advancing `current`, resulting in an infinite reload loop on record 0.

### B. Resolved Architecture
1. **Permanent `View.VISIBLE` View Hierarchy:**
   - Both `managerWebView` and `portalWebView` now continuously remain `View.VISIBLE` in the root `FrameLayout`.
   - Tab switching is achieved by layering `alpha = 1f` / `alpha = 0f` and calling `bringToFront()`. Chromium never receives `View.GONE` and never halts its internal render loop.
2. **Offscreen Rendering & Timer Un-throttling:**
   - Configured `portalWebView.settings.setOffscreenPreRaster(true)`.
   - `portalWebView.resumeTimers()` is continuously invoked in `onResume()`, `onPause()`, `onStop()`, and throughout the background heartbeat.
3. **Automatic Portal Routing on Start:**
   - Toggling the automation switch (either from the toolbar or inside `option.html` / `x-ray.html` / `trunat.html`) automatically checks `portalWebView.url`.
   - If not already on the required workflow page, it immediately navigates:
     - **Enrollment:** `https://nikshay.in/Dashboard/NewEnrollment/0`
     - **X-Ray:** `https://nikshay.in/Dashboard/Diagnostics/0`
     - **Trunat:** `https://nikshay.in/Dashboard/Diagnostics/0`
   - If the user lands on the Login screen, the app detects this and updates status to: *"Please log in to Nikshay"*.
4. **Dual Heartbeat Engine (`AutomationService` + `MainActivity`):**
   - `AutomationService` holds a `PARTIAL_WAKE_LOCK` to keep the phone's CPU running while minimized or with screen off.
   - Every 2.5 seconds, the engine executes `portalWebView.resumeTimers()` and evaluates `__nikshayHeartbeatTick()` via `evaluateJavascript()`.
   - Because `evaluateJavascript()` runs directly on the V8 engine on Android's main looper, it bypasses background timer throttling and forces pending DOM actions, toast inspections, and record submissions to progress.
   - Live progress is continuously published to the Android status bar notification:
     `Ni-Kshay Automation: Enroll: 4/25 - Running in background`.
5. **Resilient Error Recovery in Content Scripts:**
   - In `content.js`, if dropdown matching fails, the error is recorded directly into `currentData["id"] = "Error: ..."` and `current` advances by 1 before reloading.
   - The automation smoothly advances through remaining records instead of locking up on record 0.

---

## 12. Real-Time Logging System & Diagnostics Engine

### A. Root Causes of "Stopped Working" Crash
1. **Premature Service Shutdown:** `NikshayStorage.isAnyAutomationActive()` required `done < total`. When an operator flipped the switch ON prior to selecting or parsing an Excel file, `total` was 0 (`0 < 0` = false). The storage layer treated this as finished, immediately stopped `AutomationService`, reverted `isOn = false`, and posted `"Automation stopped"`.
2. **Android 12+ Background Service Restrictions:** Starting a foreground service from a background/stopped Activity state (`onStop()`) on Android 12–15 threw an uncaught `ForegroundServiceStartNotAllowedException`, crashing the app with the system dialog *"Ni-Kshay Automation has stopped working"*.

### B. Diagnostics & Logging Architecture ([`NikshayLogger.kt`](file:///c:/Users/rzbb9/Downloads/Ni-Kshay%20Manager%20Source/Ni-Kshay%20Manager%20Source/android-app/app/src/main/java/com/nikshay/manager/NikshayLogger.kt))
To eliminate guesswork and pinpoint exact runtime issues, the app now incorporates a comprehensive, real-time logging pipeline:

1. **Dual-Tier Logging Storage:**
   - **Persistent File Log:** Writes every event to disk at `Downloads/NikshayManager/automation_running.log` with high-precision timestamps: `[yyyy-MM-dd HH:mm:ss.SSS] [LEVEL] [TAG] Message`.
   - **Circular Memory Buffer:** Retains the latest 600 log lines in memory for instant retrieval in the UI without causing disk I/O bottlenecks.
2. **Comprehensive Capture Points:**
   - **JavaScript Console Messages:** Captures all `console.log`, `console.warn`, and `console.error` calls from `content.js`, `content_x_ray.js`, `content_trunat.js`, and `option.js` via `WebChromeClient.onConsoleMessage()`.
   - **WebView Navigation & Resource Errors:** Logs page start/finish events, SSL errors, HTTP status failures, and resource errors via `WebViewClient`.
   - **Automation State Machine:** Logs each heartbeat tick, form field evaluation, radio selection, toast extraction, and record incrementation.
   - **Global Fatal Crash Handler:** Uses `Thread.setDefaultUncaughtExceptionHandler` to trap any uncaught exceptions and write full stack traces to the log file before process termination.
3. **In-App Live Log Viewer & One-Click Sharing:**
   - **Bottom Navigation Bar:** Dedicated **"Logs 📋"** button accessible from both the Manager and Portal views.
   - **Top Portal Toolbar:** **"Logs"** action button in the portal control bar.
   - **Web UI Buttons:** **"View Logs"** and **"Export Logs"** buttons embedded directly in `option.html`, `x-ray.html`, and `trunat.html`.
   - **Log Viewer Dialog:** Displays live color-coded logs in a monospace scrollable window with three actions:
     - **Export & Share:** Generates `Nikshay_Automation_Log_YYYYMMDD_HHmmss.txt`, saves it to `Downloads/NikshayManager/`, and opens the native Android share sheet to forward directly via WhatsApp, Gmail, or Google Drive.
     - **Clear:** Wipes logs for a fresh debugging session.
     - **Close:** Returns to the active screen.




---

## 13. Dual App Flavors & Switch-Off ANR Resolution

### A. Independent App Flavors for Simultaneous Installation
To allow users to install and run both **Ni-Kshay Automation** and **Ni-Kshay Manager** simultaneously on the same device without one overwriting the other, the Gradle build system defines distinct product flavors under the `edition` dimension:

| Attribute | Flavor: `automation` | Flavor: `manager` |
| :--- | :--- | :--- |
| **App Name** | Ni-Kshay Automation | Ni-Kshay Manager |
| **Application ID (Package Name)** | com.nikshay.automation | com.nikshay.manager |
| **FileProvider Authority** | com.nikshay.automation.fileprovider | com.nikshay.manager.fileprovider |
| **Generated Release APK** | dist/Ni-Kshay-Automation.apk | dist/Nikshay-Manager.apk |
| **Coexistence** | Independent launcher icon, private app data, independent background foreground service | Independent launcher icon, private app data, independent background foreground service |

### B. Root Cause & Fix for Switch Turn-Off ANR ("App Not Responding")
#### Root Cause:
When turning the automation switch OFF:
1. The switch event listener invoked broadcastStorageChange("sync", changes).
2. broadcastStorageChange detected !storage.isAnyAutomationActive() and dispatched an ACTION_STOP intent to AutomationService.
3. updatePortalToolbar() was also called, which redundantly sent another AutomationService.stop() intent.
4. AutomationService.handleStop() executed storage.stopAllAutomations() and signaled MainActivity.onAutomationStoppedFromService(changes).
5. MainActivity.onAutomationStoppedFromService() was calling broadcastStorageChange("sync", changes).
6. This re-triggered step 1, generating an infinite ping-pong loop between MainActivity and AutomationService on the Android Main Looper.
7. Evaluating JavaScript on both WebViews and broadcasting IPC intents hundreds of times within seconds completely saturated the main thread, resulting in a system freeze and an ANR dialog.

#### Engineering Resolution:
1. **Re-Entrancy Guard:** Added isBroadcasting flag in MainActivity.kt to prevent recursive re-entry inside broadcastStorageChange().
2. **Eliminated Cascade in onAutomationStoppedFromService:** Replaced the re-call to broadcastStorageChange() with direct, one-way JavaScript evaluation (window.__dispatchChromeStorageChanged) to both WebViews and updated the toolbar UI without triggering background service lifecycle calls.
3. **Pure UI Toolbar Updates:** Removed side-effect service stop invocations from updatePortalToolbar().
4. **Idempotent Service Shutdown:** Added if (!isRunning) return; isRunning = false; at the very start of AutomationService.handleStop(), ensuring that any redundant ACTION_STOP intents are immediately discarded.

---

## 14. Two-App Architecture: User Manager App vs Client Automation App

### A. Clear Separation of Roles

To satisfy the operational workflow where you manage clients and distribute time-limited access to users, the project is structured into two purpose-built, installable Android apps:

| Aspect | 📱 App 1: **Ni-Kshay Manager** (Admin) | 📱 App 2: **Ni-Kshay Automation** (Client) |
| :--- | :--- | :--- |
| **Target Audience** | **You (Admin)** | **Your Clients / Field Staff** |
| **Package ID** | com.nikshay.admin | com.nikshay.automation |
| **APK File** | dist/Nikshay-Manager.apk | dist/Ni-Kshay-Automation.apk |
| **Startup Screen** | **Admin Token Console (admin.html)** | **Activation / Login Screen (login.html)** |
| **Security Gate** | Protected by Master Admin PIN (admin2026) | Protected by HMAC-SHA256 Signed Token |
| **Primary Capabilities** | • Create client Login IDs<br>• Select duration (1d, 7d, 15d, 30d, 60d, 90d, custom)<br>• 1-Click WhatsApp token sharing<br>• User Management list with search<br>• 1-Click "⚡ Renew (+30d)" per user<br>• Token Verifier & Inspector | • Enter Login ID & paste token<br>• 1-Click WhatsApp "Request Token from Admin"<br>• Full Ni-Kshay portal automation (Enrollment, X-Ray, Trunat)<br>• Live remaining days display (👤 client (28d left))<br>• Quick "🔑 Renew Token" button |
| **Admin Console Access** | Full access to generate & manage tokens | **Completely Blocked** (AssetServer returns 403 Forbidden; admin links hidden) |
| **Expiry Enforcement** | Displays expired badges in user list | **Hard Cutoff**: Stops automation, pauses background service, and redirects to login.html?expired=1 |

---

### B. Step-by-Step Client Onboarding & Renewal Workflow

#### Step 1: Onboarding a New Client
1. Open **Ni-Kshay Manager** on your phone (Enter PIN admin2026).
2. Enter the client's Login ID / Username (e.g., dr_sharma or lab_delhi).
3. Select the validity duration (e.g. **30 Days**).
4. Tap **"Generate Signed Access Token"**.
5. Tap **"💬 Send via WhatsApp"** — this immediately opens WhatsApp with a pre-formatted message containing the client ID, validity dates, and the token.
6. Send the **Ni-Kshay-Automation.apk** to the client.

#### Step 2: Client Activation
1. The client installs and opens **Ni-Kshay Automation**.
2. They are greeted by the clean **Activation & License screen (login.html)**.
3. They paste the token (the app automatically detects and pre-fills their Login ID).
4. They tap **"Activate / Renew Access"**.
5. Access is verified instantly via cryptographic HMAC-SHA256 signature verification.
6. The app unlocks the full automation suite (option.html, x-ray.html, trunat.html) and displays their license status: e.g. 👤 dr_sharma (30d left).

#### Step 3: Fast Renewal Process
1. When the client's token is near expiry or expires:
   - The app notifies the client and redirects to login.html?expired=1.
   - The client taps **"💬 Request Token from Admin on WhatsApp"** to send you their renewal request with their ID.
2. In **Ni-Kshay Manager**:
   - Open the app, search for the client's name in **"📜 User Management & Issued Tokens"**.
   - Tap **"⚡ Renew (+30d)"**.
   - Tap **"💬 WhatsApp"** to send them their new token.
3. The client pastes the new token in their app and taps **"Activate / Renew Access"** — their access is instantly renewed without reinstalling or losing any local data!