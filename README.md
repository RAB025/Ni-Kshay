# Ni-Kshay Automation & Management Suite

<p align="center">
  <img src="Assets/128.png" width="100" height="100" alt="Ni-Kshay Logo" />
</p>

<p align="center">
  <strong>High-Efficiency Automation, Diagnostic Reporting & License Management Platform for the National Tuberculosis Elimination Programme (NTEP)</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Chromium%20Extension-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/Version-v2.2.0-emerald?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Architecture-Dual--App%20Flavor-indigo?style=for-the-badge" alt="Architecture" />
  <img src="https://img.shields.io/badge/Security-HMAC--SHA256%20Offline%20Crypto-orange?style=for-the-badge" alt="Security" />
  <img src="https://img.shields.io/badge/Permissions-Zero%20Dangerous-green?style=for-the-badge" alt="Permissions" />
</p>

---

## 📖 Overview

The Government of India's [Ni-Kshay Portal](https://nikshay.in) requires extensive multi-step data entry for presumptive TB patients, diagnostic tests (X-Ray, Truenat), and treatment outcome registers. 

Entering hundreds of patient screenings manually through cascading Vue dropdowns and dynamic web forms causes severe staff fatigue, cascading AJAX timeouts, and data entry errors.

**Ni-Kshay Automation & Management Suite** provides an end-to-end automated pipeline:
1. **Spreadsheet Ingestion:** Field staff upload screening rosters in standard Excel (`.xlsx`) or CSV formats.
2. **Automated Submission:** The automation engine fills demographic forms, navigates facility hierarchies, submits records, and captures generated **Nikshay Patient IDs** and test confirmation toasts.
3. **Automated Export:** Real-time generation of updated spreadsheets containing assigned Nikshay IDs and diagnostic results.
4. **Offline Token Administration:** A built-in cryptographic licensing engine allowing program managers to issue time-bound, tamper-proof client tokens without requiring cloud server infrastructure.

---

## 📱 Dual-App Architecture

The Android solution is configured with **two distinct Gradle product flavors and package IDs**, allowing both applications to be installed side-by-side on the same device without update conflicts:

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
    │   (Touch Keypad + PIN dots) │                             │ • Field Staff Enrollment    │
    │ • Offline HMAC Token Engine │ ──── WhatsApp / Share ────> │ • X-Ray / Truenat Automation│
    │ • Client Directory & Search │       (Signed Token)        │ • Foreground Service Sync   │
    │ • 1-Click Renew (+30d)      │                             │ • Zero Admin Controls       │
    └─────────────────────────────┘                             └─────────────────────────────┘
```

### Application Comparison

| Feature / Attribute | 👑 Ni-Kshay Manager (Admin) | ⚡ Ni-Kshay Automation (Client) |
| :--- | :--- | :--- |
| **Package ID** | `com.nikshay.admin` | `com.nikshay.automation` |
| **APK Binary** | `dist/Nikshay-Manager.apk` | `dist/Ni-Kshay-Automation.apk` |
| **Target Audience** | District Program Manager / Admin | Field Health Staff / Lab Technicians |
| **Primary Tab 1** | `👑 User Manager` (`admin.html`) | `⚡ Automation` (`option.html` / `login.html`) |
| **Access Gate** | **Access PIN Security Vault** | **Cryptographic Token Activation** |
| **Default PIN** | `2026` or `admin2026` (Customizable) | N/A (Requires Admin Token) |
| **Admin Route Protection** | Routes client paths directly to `admin.html` | Strictly returns **403 Forbidden** for `admin.html` |
| **Soft Keyboard** | Native Touch-Mode focus with instant keypad | Native Touch-Mode focus with instant keypad |
| **Client Directory** | Searchable history with 1-click `⚡ Renew (+30d)` | N/A |

---

## 🔐 Offline Cryptographic Communication Protocol

The two applications communicate **asynchronously and cryptographically** using **Offline HMAC-SHA256 Signed License Tokens**, completely eliminating the need for paid cloud servers or Firebase databases:

$$\text{Token} = \text{NKA1} \mathbin{.} \text{Base64URL(Payload)} \mathbin{.} \text{HMAC-SHA256(Secret, Header + Payload)}$$

### Protocol Lifecycle:
1. **Admin Generates Token:** Inside `Ni-Kshay Manager`, enter client ID (e.g., `nurse_01`) and select validity (`7d`, `15d`, `30d`, `90d`, `1y`, or custom date). The app generates an `NKA1` token.
2. **Delivery:** Admin sends the token to the client via WhatsApp, SMS, or Telegram.
3. **Activation:** Client opens `Ni-Kshay Automation`, pastes the token, and taps **Activate Access**. The app verifies the HMAC signature and expiration timestamp offline.
4. **One-Click Renewal:** When the token expires, the client taps **`💬 Request Token from Admin on WhatsApp`**, opening a pre-filled WhatsApp message. The Admin taps **`⚡ Renew (+30d)`** in their directory and shares the new token.

---

## ✨ Key Features

- **Multi-Module Support:**
  - **Presumptive TB Enrollment:** Full demographic, address, Aadhaar, key population, and health facility automation (`option.html`).
  - **Chest X-Ray Diagnostics:** Automated X-Ray test result entry and reporting (`x-ray.html`).
  - **Truenat / CBNAAT Laboratory:** Molecular test outcome recording and toast notification capture (`trunat.html`).
- **Modern Dark UI:** Deep slate/emerald SaaS styling (`#0B0F19`, `#10B981`) with glassmorphic cards, stat counters, and responsive tables.
- **Uninterrupted Background Operation:** Native Android Foreground Service (`AutomationService.kt`) with `PARTIAL_WAKE_LOCK` keeps automation executing even when the screen is locked or the app is minimized.
- **Persistent In-App Logging:** High-capacity rotating log buffer (`NikshayLogger.kt`) with live on-screen viewer and one-click log export.
- **Zero Dangerous Permissions:** Uses modern Android storage APIs (`MediaStore` & `FileProvider`), eliminating high-risk permission prompts.

---

## 📁 Repository Structure

```
Ni-Kshay/
├── admin.html                     # Admin Console & PIN Vault Gate UI
├── login.html                     # Client Token Activation UI
├── option.html                    # Presumptive TB Enrollment Automation UI
├── x-ray.html                     # X-Ray Diagnostic Entry UI
├── trunat.html                    # Truenat / Molecular Test Automation UI
├── popup.html                     # Browser Extension Popup Interface
├── manifest.json                  # Chromium Extension Manifest (MV3)
├── working.md                     # Comprehensive 700+ Line Architecture & Working Guide
│
├── dist/                          # Compiled & Verified Release Binaries
│   ├── Nikshay-Manager.apk        # Admin Application APK (com.nikshay.admin)
│   └── Ni-Kshay-Automation.apk    # Client Automation APK (com.nikshay.automation)
│
├── Assets/                        # App & Extension Icons and Graphics
├── css/                           # Modern Dark UI Stylesheets
├── lib/                           # Vendor Libraries (SheetJS, QRCode, jQuery)
├── script/                        # Automation & Cryptographic Engines
│   ├── admin.js                   # Admin Dashboard & Token Generator Controller
│   ├── auth.js                    # HMAC-SHA256 Token Crypto Engine
│   ├── login.js                   # Client Login & Activation Controller
│   ├── option.js                  # Enrollment Workflow Controller
│   ├── content.js                 # Portal Injection Engine for Enrollment
│   ├── content_x_ray.js           # Portal Injection Engine for X-Ray
│   └── content_trunat.js          # Portal Injection Engine for Truenat
│
└── android-app/                   # Complete Native Android Gradle Project
    ├── app/src/main/
    │   ├── java/com/nikshay/manager/
    │   │   ├── MainActivity.kt        # Dual-WebView & Tab Navigation Controller
    │   │   ├── AssetServer.kt         # Virtual HTTPS Local Asset Server
    │   │   ├── AutomationService.kt   # Foreground Service & Wake Lock Manager
    │   │   ├── FileDownloadHelper.kt  # MediaStore & FileProvider Export Bridge
    │   │   ├── NikshayLogger.kt       # Persistent Disk & Memory Logger
    │   │   └── NikshayStorage.kt      # SharedPreferences Web Bridge
    │   ├── assets/
    │   │   └── android_chrome_shim.js # Chrome Extension API Shim for WebView
    │   └── res/                       # Native Layouts, Colors & Resources
    └── build.gradle.kts               # Dual-Flavor Build Configuration
```

---

## 🚀 Getting Started

### 1. Direct APK Installation
Pre-compiled release APKs are available in the [`dist/`](dist/) folder:
- **For District Admin / Supervisors:** Install [`dist/Nikshay-Manager.apk`](dist/Nikshay-Manager.apk). Default PIN: **`2026`**.
- **For Field Workers & Clients:** Install [`dist/Ni-Kshay-Automation.apk`](dist/Ni-Kshay-Automation.apk). Paste your assigned license token to unlock.

### 2. Building from Source
Ensure you have **JDK 17+** and the Android SDK (API 34) installed.

```bash
# Navigate to the Android project root
cd android-app

# Build both release APKs
./gradlew assembleRelease
```

Generated binaries will be located at:
- `android-app/app/build/outputs/apk/manager/release/app-manager-release.apk`
- `android-app/app/build/outputs/apk/automation/release/app-automation-release.apk`

---

## 🛡️ Security & Privacy

- **Strict HTTPS Only:** `android:usesCleartextTraffic="false"` prevents unencrypted HTTP transmission of sensitive patient data.
- **Isolated Sandboxing:** In the client automation app, access to `admin.html` is strictly blocked with an HTTP 403 response.
- **Mathematical Tamper Protection:** Client tokens cannot be modified or forged without the private Master Secret.
- **Local Data Storage:** All screening records and credentials reside exclusively on device memory and are never sent to third-party tracking servers.

---

## 📄 License & Attribution

Developed for field staff and health administrators working under the **National Tuberculosis Elimination Programme (NTEP)**.  
Reference portal: [nikshay.in](https://nikshay.in)
