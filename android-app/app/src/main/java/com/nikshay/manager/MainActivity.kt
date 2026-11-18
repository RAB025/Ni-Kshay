package com.nikshay.manager

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Typeface
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.switchmaterial.SwitchMaterial
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    companion object {
        var activeInstance: MainActivity? = null
    }

    private lateinit var managerWebView: WebView
    private lateinit var portalWebView: WebView
    private lateinit var portalToolbar: LinearLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var tabManager: Button
    private lateinit var tabPortal: Button
    private lateinit var tabLogs: Button
    private lateinit var btnToolbarLogs: Button
    private lateinit var tvPortalStatus: TextView
    private lateinit var switchPortalAuto: SwitchMaterial
    private lateinit var btnDesktopMode: Button

    private lateinit var storage: NikshayStorage
    private lateinit var assetServer: AssetServer
    private val mainHandler = Handler(Looper.getMainLooper())

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var activeTab = "manager"
    private var activeMode = "enrollment"
    private var isDesktopMode = true
    private var suppressSwitchEvent = false
    private var portalLoadedOnce = false
    private var isHeartbeatActive = false
    private var isBroadcasting = false

    private val desktopUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    private val mobileUserAgent =
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!isHeartbeatActive) return
            runHeartbeatStep()
            mainHandler.postDelayed(this, 2500L)
        }
    }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            if (callback == null) return@registerForActivityResult

            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                val data = result.data
                val uris = mutableListOf<Uri>()
                data?.clipData?.let { clip ->
                    for (i in 0 until clip.itemCount) {
                        clip.getItemAt(i).uri?.let { uris.add(it) }
                    }
                } ?: data?.data?.let { uris.add(it) }
                callback.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
            } else {
                callback.onReceiveValue(null)
            }
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun promptBatteryOptimizationIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    @SuppressLint("BatteryLife")
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (_: Exception) {}
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        activeInstance = this

        NikshayLogger.init(this)
        NikshayLogger.i("ACTIVITY", "MainActivity onCreate started")

        // Global uncaught crash handler to log all fatal errors to disk
        val originalUncaughtHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            NikshayLogger.e("CRASH", "Fatal uncaught crash on thread ${thread.name}: ${throwable.message}", throwable)
            originalUncaughtHandler?.uncaughtException(thread, throwable)
        }

        setContentView(R.layout.activity_main)

        storage = NikshayStorage(this)
        assetServer = AssetServer(this)

        managerWebView = findViewById(R.id.managerWebView)
        portalWebView = findViewById(R.id.portalWebView)
        portalToolbar = findViewById(R.id.portalToolbar)
        progressBar = findViewById(R.id.progressBar)
        tabManager = findViewById(R.id.tabManager)
        tabPortal = findViewById(R.id.tabPortal)
        tabLogs = findViewById(R.id.tabLogs)
        btnToolbarLogs = findViewById(R.id.btnToolbarLogs)
        tvPortalStatus = findViewById(R.id.tvPortalStatus)
        switchPortalAuto = findViewById(R.id.switchPortalAuto)
        btnDesktopMode = findViewById(R.id.btnDesktopMode)

        setupCookies()
        setupManagerWebView()
        setupPortalWebView()
        setupControls()
        setupBackNavigation()

        val isManagerEdition = packageName == "com.nikshay.admin" || packageName == "com.nikshay.manager"
        if (isManagerEdition) {
            tabManager.text = "👑 User Admin"
            tabPortal.text = "🌐 Portal Site"
            NikshayLogger.i("APP", "Starting Ni-Kshay Manager Edition (User Admin Console)")
            managerWebView.loadUrl("${AssetServer.BASE_URL}admin.html")
        } else {
            tabManager.text = "⚡ Automation"
            tabPortal.text = "🌐 Nikshay Site"
            NikshayLogger.i("APP", "Starting Ni-Kshay Automation Edition (Client Mode)")
            if (!storage.isLicenseValid()) {
                NikshayLogger.i("AUTH", "License invalid or missing on startup. Directing to login.html")
                managerWebView.loadUrl("${AssetServer.BASE_URL}login.html")
            } else {
                NikshayLogger.i("AUTH", "License valid for ${storage.getLicenseUsername()} (${storage.getLicenseRemainingDays()} days left)")
                managerWebView.loadUrl("${AssetServer.BASE_URL}option.html")
            }
        }
        switchTab("manager")
        updatePortalToolbar()

        if (storage.isAnyAutomationActive()) {
            startAutomationHeartbeat()
        }
    }

    private fun setupCookies() {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(portalWebView, true)
        cookieManager.setAcceptThirdPartyCookies(managerWebView, true)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureCommonSettings(settings: WebSettings) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.setSupportMultipleWindows(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        // Keeps background webview rendering and timer loop active offscreen
        settings.setOffscreenPreRaster(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = false
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupManagerWebView() {
        configureCommonSettings(managerWebView.settings)
        managerWebView.settings.useWideViewPort = false
        managerWebView.settings.loadWithOverviewMode = false
        managerWebView.isFocusable = true
        managerWebView.isFocusableInTouchMode = true
        managerWebView.requestFocus(View.FOCUS_DOWN)
        managerWebView.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP -> {
                    if (!v.hasFocus()) {
                        v.requestFocus()
                    }
                }
            }
            false
        }
        managerWebView.addJavascriptInterface(NikshayBridge(), "AndroidBridge")

        managerWebView.webChromeClient = createCommonChromeClient("MANAGER")
        managerWebView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                return assetServer.handleRequest(uri)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                val url = uri.toString()
                if (uri.host == AssetServer.HOST) {
                    val isManagerEdition = packageName == "com.nikshay.admin" || packageName == "com.nikshay.manager"
                    if (isManagerEdition) {
                        val p = uri.path ?: ""
                        if (p.contains("login.html") || p.contains("option.html") || p.contains("x-ray.html") || p.contains("trunat.html")) {
                            managerWebView.loadUrl("${AssetServer.BASE_URL}admin.html")
                            return true
                        }
                    }
                    updateModeFromUrl(url)
                    return false
                }
                if (uri.host?.endsWith("nikshay.in") == true) {
                    openInPortal(url)
                    return true
                }
                openExternalUri(uri)
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (url != null) {
                    updateModeFromUrl(url)
                }
                progressBar.visibility = View.GONE
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupPortalWebView() {
        configureCommonSettings(portalWebView.settings)
        applyDesktopMode(isDesktopMode, reload = false)
        portalWebView.isFocusable = true
        portalWebView.isFocusableInTouchMode = true
        portalWebView.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP -> {
                    if (!v.hasFocus()) {
                        v.requestFocus()
                    }
                }
            }
            false
        }
        portalWebView.addJavascriptInterface(NikshayBridge(), "AndroidBridge")

        portalWebView.webChromeClient = createCommonChromeClient("PORTAL")
        portalWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: ""
                if (scheme == "http" || scheme == "https") {
                    return false
                }
                openExternalUri(uri)
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                NikshayLogger.i("PORTAL", "Page started: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                NikshayLogger.i("PORTAL", "Page finished: $url")
                progressBar.visibility = View.GONE
                CookieManager.getInstance().flush()
                if (url != null && isNikshayUrl(url)) {
                    injectPortalAutomation(url)
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                NikshayLogger.e("PORTAL", "Resource error on ${request?.url}: ${error?.description} (code ${error?.errorCode})")
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                NikshayLogger.w("PORTAL", "HTTP ${errorResponse?.statusCode} on ${request?.url}")
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                NikshayLogger.e("PORTAL", "SSL Error on portal webview: $error")
                handler?.cancel()
            }
        }

        portalWebView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            if (url.startsWith("http://") || url.startsWith("https://")) {
                try {
                    val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    val req = DownloadManager.Request(Uri.parse(url)).apply {
                        setMimeType(mimetype)
                        addRequestHeader("User-Agent", userAgent)
                        addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    }
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(req)
                    Toast.makeText(this, "Downloading $fileName...", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    openExternalUri(Uri.parse(url))
                }
            }
        }
    }

    private fun createCommonChromeClient(clientTag: String): WebChromeClient {
        return object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage != null) {
                    val level = when (consoleMessage.messageLevel()) {
                        ConsoleMessage.MessageLevel.ERROR -> "ERROR"
                        ConsoleMessage.MessageLevel.WARNING -> "WARN"
                        else -> "INFO"
                    }
                    val source = consoleMessage.sourceId() ?: "inline"
                    val line = consoleMessage.lineNumber()
                    val msg = consoleMessage.message() ?: ""
                    NikshayLogger.log(level, clientTag, "[$source:$line] $msg")
                }
                return true
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (view?.alpha == 1f && newProgress in 1..99) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onJsAlert(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult?
            ): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(R.string.app_name)
                    .setMessage(message ?: "")
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult?
            ): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(R.string.app_name)
                    .setMessage(message ?: "")
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsPrompt(
                view: WebView?,
                url: String?,
                message: String?,
                defaultValue: String?,
                result: JsPromptResult?
            ): Boolean {
                val input = EditText(this@MainActivity).apply {
                    setText(defaultValue ?: "")
                }
                AlertDialog.Builder(this@MainActivity)
                    .setTitle(R.string.app_name)
                    .setMessage(message ?: "")
                    .setView(input)
                    .setPositiveButton("OK") { _, _ -> result?.confirm(input.text.toString()) }
                    .setNegativeButton("Cancel") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        arrayOf(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "application/vnd.ms-excel",
                            "text/csv",
                            "text/comma-separated-values",
                            "application/csv",
                            "*/*"
                        )
                    )
                }
                return try {
                    fileChooserLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
    }

    private fun setupControls() {
        val isManagerEdition = packageName == "com.nikshay.admin" || packageName == "com.nikshay.manager"

        tabManager.setOnClickListener {
            if (isManagerEdition) {
                val current = managerWebView.url ?: ""
                if (!current.contains("admin.html")) {
                    managerWebView.loadUrl("${AssetServer.BASE_URL}admin.html")
                }
            }
            switchTab("manager")
        }

        tabPortal.setOnClickListener {
            if (!isManagerEdition && !storage.isLicenseValid()) {
                Toast.makeText(this, "License inactive or expired. Please activate token.", Toast.LENGTH_SHORT).show()
                switchTab("manager")
                managerWebView.loadUrl("${AssetServer.BASE_URL}login.html")
                return@setOnClickListener
            }
            ensurePortalLoadedForMode(activeMode)
            switchTab("portal")
        }

        tabLogs.setOnClickListener { showLogViewerDialog() }
        btnToolbarLogs.setOnClickListener { showLogViewerDialog() }

        findViewById<Button>(R.id.btnPortalBack).setOnClickListener {
            if (portalWebView.canGoBack()) {
                portalWebView.goBack()
            } else {
                switchTab("manager")
            }
        }

        findViewById<Button>(R.id.btnPortalReload).setOnClickListener {
            portalWebView.reload()
        }

        tvPortalStatus.setOnClickListener {
            activeMode = when (activeMode) {
                "enrollment" -> "x_ray"
                "x_ray" -> "trunat"
                else -> "enrollment"
            }
            updatePortalToolbar()
        }

        switchPortalAuto.setOnCheckedChangeListener { _, isChecked ->
            if (suppressSwitchEvent) return@setOnCheckedChangeListener
            if (!isManagerEdition && isChecked && !storage.isLicenseValid()) {
                suppressSwitchEvent = true
                switchPortalAuto.isChecked = false
                suppressSwitchEvent = false
                Toast.makeText(this, "Cannot start automation: License inactive or expired.", Toast.LENGTH_LONG).show()
                switchTab("manager")
                managerWebView.loadUrl("${AssetServer.BASE_URL}login.html")
                return@setOnCheckedChangeListener
            }
            NikshayLogger.i("UI", "Automation switch changed by user to $isChecked (mode: $activeMode)")
            val status = storage.getModeStatus(activeMode)
            val payload = JSONObject().put(status.isOnKey, isChecked).toString()
            val changes = storage.set("sync", payload)
            broadcastStorageChange("sync", changes)
        }

        btnDesktopMode.setOnClickListener {
            isDesktopMode = !isDesktopMode
            applyDesktopMode(isDesktopMode, reload = true)
        }
    }

    fun getPortalTargetUrl(mode: String): String {
        return when (mode) {
            "x_ray" -> "https://nikshay.in/Dashboard/Diagnostics/0"
            "trunat" -> "https://nikshay.in/Dashboard/Diagnostics/0"
            else -> "https://nikshay.in/Dashboard/NewEnrollment/0"
        }
    }

    fun ensurePortalLoadedForMode(mode: String) {
        portalLoadedOnce = true
        val targetUrl = getPortalTargetUrl(mode)
        val currentUrl = portalWebView.url ?: ""
        if (currentUrl.isBlank() || currentUrl == "about:blank") {
            NikshayLogger.i("PORTAL_ROUTER", "Navigating idle portalWebView to $targetUrl")
            portalWebView.loadUrl(targetUrl)
        } else if (isNikshayUrl(currentUrl)) {
            val path = Uri.parse(currentUrl).path ?: "/"
            if (path == "/" || path.equals("/Dashboard/Overview", ignoreCase = true) || path.equals("/Dashboard", ignoreCase = true)) {
                NikshayLogger.i("PORTAL_ROUTER", "Redirecting from $path to target $targetUrl")
                portalWebView.loadUrl(targetUrl)
            }
        }
    }

    private fun applyDesktopMode(desktop: Boolean, reload: Boolean) {
        val settings = portalWebView.settings
        settings.userAgentString = if (desktop) desktopUserAgent else mobileUserAgent
        settings.useWideViewPort = desktop
        settings.loadWithOverviewMode = desktop
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        btnDesktopMode.text = if (desktop) "PC" else "Mob"
        if (reload && portalLoadedOnce) {
            portalWebView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (activeTab == "portal") {
                    if (portalWebView.canGoBack()) {
                        portalWebView.goBack()
                    } else {
                        switchTab("manager")
                    }
                } else {
                    if (managerWebView.canGoBack()) {
                        managerWebView.goBack()
                    } else {
                        if (storage.isAnyAutomationActive()) {
                            moveTaskToBack(true)
                            Toast.makeText(
                                this@MainActivity,
                                "Automation continuing in background. Tap notification to reopen.",
                                Toast.LENGTH_SHORT
                            ).show()
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        })
    }

    private fun switchTab(tab: String) {
        activeTab = tab
        val isPortal = tab == "portal"

        if (isPortal) {
            tabPortal.backgroundTintList = ContextCompat.getColorStateList(this, R.color.limegreen)
            tabPortal.setTextColor(ContextCompat.getColor(this, R.color.black))
            tabManager.backgroundTintList = ContextCompat.getColorStateList(this, R.color.border_dark)
            tabManager.setTextColor(ContextCompat.getColor(this, R.color.white))

            portalToolbar.visibility = View.VISIBLE
            portalWebView.alpha = 1f
            portalWebView.isClickable = true
            portalWebView.isFocusable = true
            portalWebView.isFocusableInTouchMode = true
            portalWebView.bringToFront()
            portalWebView.requestFocus(View.FOCUS_DOWN)

            managerWebView.alpha = 0f
            managerWebView.isClickable = false
            managerWebView.isFocusable = false
            managerWebView.isFocusableInTouchMode = false
        } else {
            tabManager.backgroundTintList = ContextCompat.getColorStateList(this, R.color.limegreen)
            tabManager.setTextColor(ContextCompat.getColor(this, R.color.black))
            tabPortal.backgroundTintList = ContextCompat.getColorStateList(this, R.color.border_dark)
            tabPortal.setTextColor(ContextCompat.getColor(this, R.color.white))

            portalToolbar.visibility = View.GONE
            managerWebView.alpha = 1f
            managerWebView.isClickable = true
            managerWebView.isFocusable = true
            managerWebView.isFocusableInTouchMode = true
            managerWebView.bringToFront()
            managerWebView.requestFocus(View.FOCUS_DOWN)

            portalWebView.alpha = 0f
            portalWebView.isClickable = false
            portalWebView.isFocusable = false
            portalWebView.isFocusableInTouchMode = false
        }

        // Keep BOTH WebViews View.VISIBLE in FrameLayout so Chromium never pauses the rendering/JS pipeline!
        managerWebView.visibility = View.VISIBLE
        portalWebView.visibility = View.VISIBLE
        updatePortalToolbar()
    }

    private fun openInPortal(url: String) {
        portalLoadedOnce = true
        switchTab("portal")
        portalWebView.loadUrl(url)
    }

    private fun updateModeFromUrl(url: String) {
        val nextMode = when {
            url.contains("x-ray.html", ignoreCase = true) -> "x_ray"
            url.contains("trunat.html", ignoreCase = true) -> "trunat"
            url.contains("option.html", ignoreCase = true) -> "enrollment"
            else -> activeMode
        }
        if (nextMode != activeMode) {
            activeMode = nextMode
            NikshayLogger.i("MODE", "Active mode switched to $activeMode based on URL: $url")
            updatePortalToolbar()
        }
    }

    private fun updatePortalToolbar() {
        val status = storage.getModeStatus(activeMode)
        val statusStr = "${status.label}: ${status.done}/${status.total}"
        tvPortalStatus.text = statusStr
        suppressSwitchEvent = true
        switchPortalAuto.isChecked = status.isOn
        suppressSwitchEvent = false

        if (status.isOn && AutomationService.isRunning) {
            AutomationService.update(this, "$statusStr - Running in background")
        }
    }

    private fun isNikshayUrl(url: String): Boolean {
        val host = Uri.parse(url).host?.lowercase() ?: return false
        return host == "nikshay.in" || host.endsWith(".nikshay.in")
    }

    private fun injectPortalAutomation(url: String) {
        try {
            val shimJs = assetServer.readAssetText("android_chrome_shim.js")
            portalWebView.evaluateJavascript(shimJs, null)

            val path = Uri.parse(url).path ?: "/"
            val scriptsToInject = mutableListOf<String>()
            if (path.startsWith("/Dashboard/NewEnrollment", ignoreCase = true)) {
                scriptsToInject.add("extension/script/content.js")
            }
            if (path.startsWith("/Dashboard/Diagnostics", ignoreCase = true)) {
                scriptsToInject.add("extension/script/content_x_ray.js")
            }
            scriptsToInject.add("extension/script/content_trunat.js")

            NikshayLogger.d("INJECTOR", "Injecting scripts for path: $path (${scriptsToInject.joinToString()})")
            for (scriptPath in scriptsToInject) {
                val js = assetServer.readAssetText(scriptPath)
                portalWebView.evaluateJavascript(js, null)
            }
        } catch (e: Exception) {
            NikshayLogger.e("INJECTOR", "Script injection failed: ${e.message}", e)
        }
    }

    private fun broadcastStorageChange(namespace: String, changes: JSONObject) {
        if (changes.length() == 0) return
        if (isBroadcasting) {
            NikshayLogger.d("STORAGE", "Suppressing re-entrant broadcastStorageChange")
            return
        }
        val jsCall =
            "if (window.__dispatchChromeStorageChanged) { window.__dispatchChromeStorageChanged($changes, ${JSONObject.quote(namespace)}); }"
        mainHandler.post {
            try {
                isBroadcasting = true
                managerWebView.evaluateJavascript(jsCall, null)
                portalWebView.evaluateJavascript(jsCall, null)
                updatePortalToolbar()

                if (storage.isAnyAutomationActive()) {
                    requestNotificationPermissionIfNeeded()
                    promptBatteryOptimizationIfNeeded()
                    val status = storage.getModeStatus(activeMode)
                    val statusStr = "${status.label}: ${status.done}/${status.total} - Running in background"
                    if (!AutomationService.isRunning) {
                        AutomationService.start(this, activeMode, statusStr)
                    }
                    ensurePortalLoadedForMode(activeMode)
                    startAutomationHeartbeat()
                } else {
                    if (AutomationService.isRunning) {
                        AutomationService.stop(this)
                        stopAutomationHeartbeat()
                    }
                }
            } finally {
                isBroadcasting = false
            }
        }
    }

    private fun startAutomationHeartbeat() {
        if (!isHeartbeatActive) {
            isHeartbeatActive = true
            NikshayLogger.i("HEARTBEAT", "Automation heartbeat loop started")
            mainHandler.removeCallbacks(heartbeatRunnable)
            mainHandler.post(heartbeatRunnable)
        }
    }

    private fun stopAutomationHeartbeat() {
        if (isHeartbeatActive) {
            isHeartbeatActive = false
            NikshayLogger.i("HEARTBEAT", "Automation heartbeat loop stopped")
            mainHandler.removeCallbacks(heartbeatRunnable)
        }
    }

    fun runHeartbeatStep() {
        mainHandler.post {
            try {
                if (!storage.isLicenseValid()) {
                    NikshayLogger.w("HEARTBEAT", "License expired during run. Stopping automation.")
                    if (AutomationService.isRunning) {
                        AutomationService.stop(this)
                    }
                    stopAutomationHeartbeat()
                    switchTab("manager")
                    managerWebView.loadUrl("${AssetServer.BASE_URL}login.html?expired=1")
                    return@post
                }

                if (!storage.isAnyAutomationActive()) {
                    if (AutomationService.isRunning) {
                        AutomationService.stop(this)
                    }
                    stopAutomationHeartbeat()
                    return@post
                }

                // Un-throttle Chromium timers
                portalWebView.resumeTimers()

                val currentUrl = portalWebView.url ?: ""
                if (currentUrl.isBlank() || currentUrl == "about:blank") {
                    ensurePortalLoadedForMode(activeMode)
                    return@post
                }

                val heartbeatJs = """
                    (function() {
                        try {
                            const host = location.hostname;
                            if (!host.includes("nikshay.in")) {
                                return JSON.stringify({ state: "offsite", url: location.href });
                            }
                            const pathname = location.pathname;
                            
                            // Check if login needed
                            if (document.querySelector("#Username") || document.querySelector("#Password") || pathname.toLowerCase().includes("login")) {
                                return JSON.stringify({ state: "needs_login" });
                            }
                            
                            // Redirect from Overview to actual automation page
                            if (pathname === "/Dashboard/Overview" || pathname === "/Dashboard" || pathname === "/") {
                                return JSON.stringify({ state: "redirecting_to_work" });
                            }
                            
                            if (window.__nikshayEnrollmentHeartbeat) {
                                return JSON.stringify(window.__nikshayEnrollmentHeartbeat());
                            }
                            if (window.__nikshayXRayHeartbeat) {
                                return JSON.stringify(window.__nikshayXRayHeartbeat());
                            }
                            if (window.__nikshayTrunatHeartbeat) {
                                return JSON.stringify(window.__nikshayTrunatHeartbeat());
                            }
                            
                            return JSON.stringify({ state: "active", path: pathname });
                        } catch(e) {
                            return JSON.stringify({ state: "error", message: e.message });
                        }
                    })();
                """.trimIndent()

                portalWebView.evaluateJavascript(heartbeatJs) { rawResult ->
                    try {
                        val clean = rawResult?.trim()?.trim('"')?.replace("\\\"", "\"") ?: ""
                        if (clean.contains("redirecting_to_work")) {
                            NikshayLogger.i("HEARTBEAT", "Heartbeat triggered redirection to work page")
                            ensurePortalLoadedForMode(activeMode)
                        } else if (clean.contains("needs_login")) {
                            val status = storage.getModeStatus(activeMode)
                            val text = "${status.label}: Please log in to Nikshay"
                            tvPortalStatus.text = text
                            AutomationService.update(this, text)
                        } else {
                            val status = storage.getModeStatus(activeMode)
                            val statusStr = "${status.label}: ${status.done}/${status.total} - Running in background"
                            tvPortalStatus.text = "${status.label}: ${status.done}/${status.total}"
                            AutomationService.update(this, statusStr)
                        }
                    } catch (_: Exception) {}
                }
            } catch (e: Exception) {
                NikshayLogger.e("HEARTBEAT", "Error in runHeartbeatStep: ${e.message}", e)
            }
        }
    }

    fun showLogViewerDialog() {
        val scroll = ScrollView(this).apply {
            setPadding(24, 20, 24, 20)
        }
        val tvLogs = TextView(this).apply {
            typeface = Typeface.MONOSPACE
            textSize = 11f
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.limegreen))
            text = NikshayLogger.getRecentLogs(400).ifBlank { "No logs recorded yet." }
            setTextIsSelectable(true)
        }
        scroll.addView(tvLogs)

        AlertDialog.Builder(this)
            .setTitle("📋 Live Automation Logs")
            .setView(scroll)
            .setPositiveButton("Export & Share") { _, _ ->
                try {
                    val result = NikshayLogger.exportLogFile(this)
                    startActivity(FileDownloadHelper.openOrShareIntent(result))
                } catch (e: Exception) {
                    Toast.makeText(this, "Failed to export logs: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
            .setNeutralButton("Clear") { _, _ ->
                NikshayLogger.clear()
                Toast.makeText(this, "Logs cleared", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun showSavedFileFeedback(result: FileDownloadHelper.SavedFileResult) {
        Toast.makeText(this, "Saved: ${result.displayLocation}", Toast.LENGTH_LONG).show()

        try {
            AlertDialog.Builder(this)
                .setTitle("Sheet Exported Successfully")
                .setMessage("Saved to:\n${result.displayLocation}\n\nWhat would you like to do?")
                .setPositiveButton("Open File") { _, _ ->
                    try {
                        startActivity(FileDownloadHelper.viewIntent(result))
                    } catch (_: Exception) {
                        try {
                            startActivity(FileDownloadHelper.openOrShareIntent(result))
                        } catch (ex: Exception) {
                            Toast.makeText(this, "Cannot open viewer: ${ex.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                .setNeutralButton("Share") { _, _ ->
                    try {
                        startActivity(FileDownloadHelper.shareIntent(result))
                    } catch (ex: Exception) {
                        Toast.makeText(this, "Cannot share: ${ex.message}", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Dismiss", null)
                .show()
        } catch (_: Exception) {
            try {
                Snackbar.make(managerWebView, "Saved: ${result.fileName}", Snackbar.LENGTH_LONG)
                    .setAction("Share") {
                        try {
                            startActivity(FileDownloadHelper.openOrShareIntent(result))
                        } catch (_: Exception) {}
                    }
                    .show()
            } catch (_: Exception) {}
        }
    }

    private fun openExternalUri(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            Toast.makeText(this, "Cannot open: $uri", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        NikshayLogger.i("ACTIVITY", "onResume called")
        portalWebView.resumeTimers()
        managerWebView.resumeTimers()
        updatePortalToolbar()
        if (storage.isAnyAutomationActive()) {
            startAutomationHeartbeat()
        }
    }

    override fun onPause() {
        super.onPause()
        NikshayLogger.i("ACTIVITY", "onPause called")
        CookieManager.getInstance().flush()
        if (storage.isAnyAutomationActive()) {
            portalWebView.resumeTimers()
        }
    }

    override fun onStop() {
        super.onStop()
        NikshayLogger.i("ACTIVITY", "onStop called (active: ${storage.isAnyAutomationActive()})")
        if (storage.isAnyAutomationActive()) {
            portalWebView.resumeTimers()
            val status = storage.getModeStatus(activeMode)
            if (!AutomationService.isRunning) {
                try {
                    AutomationService.start(
                        this,
                        activeMode,
                        "${status.label}: ${status.done}/${status.total} - Running in background"
                    )
                } catch (e: Exception) {
                    NikshayLogger.e("ACTIVITY", "Failed to start service from onStop: ${e.message}", e)
                }
            }
            startAutomationHeartbeat()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        NikshayLogger.i("ACTIVITY", "onDestroy called")
        stopAutomationHeartbeat()
        if (activeInstance == this) {
            activeInstance = null
        }
    }

    fun onAutomationStoppedFromService(changes: JSONObject) {
        NikshayLogger.i("ACTIVITY", "onAutomationStoppedFromService received")
        stopAutomationHeartbeat()
        if (changes.length() > 0) {
            val jsCall =
                "if (window.__dispatchChromeStorageChanged) { window.__dispatchChromeStorageChanged($changes, 'sync'); }"
            managerWebView.evaluateJavascript(jsCall, null)
            portalWebView.evaluateJavascript(jsCall, null)
        }
        updatePortalToolbar()
        Toast.makeText(this, "Automation stopped", Toast.LENGTH_SHORT).show()
    }

    inner class NikshayBridge {

        @JavascriptInterface
        fun storageGet(namespace: String, keysJson: String?): String {
            return storage.get(namespace, keysJson)
        }

        @JavascriptInterface
        fun storageSet(namespace: String, itemsJson: String): String {
            val changes = storage.set(namespace, itemsJson)
            broadcastStorageChange(namespace, changes)
            return "ok"
        }

        @JavascriptInterface
        fun storageRemove(namespace: String, keysJson: String): String {
            val changes = storage.remove(namespace, keysJson)
            broadcastStorageChange(namespace, changes)
            return "ok"
        }

        @JavascriptInterface
        fun storageClear(namespace: String): String {
            storage.clear(namespace)
            mainHandler.post { updatePortalToolbar() }
            return "ok"
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return "V2.2.0"
        }

        @JavascriptInterface
        fun getAppFlavor(): String {
            return if (packageName == "com.nikshay.admin" || packageName == "com.nikshay.manager") "manager" else "automation"
        }

        @JavascriptInterface
        fun openPortalUrl(url: String) {
            mainHandler.post { openInPortal(url) }
        }

        @JavascriptInterface
        fun onPortalUrlChanged(url: String) {
            mainHandler.post {
                if (isNikshayUrl(url)) {
                    injectPortalAutomation(url)
                }
            }
        }

        @JavascriptInterface
        fun saveCsvFile(filename: String, csvContent: String) {
            try {
                val res = FileDownloadHelper.saveBytes(
                    this@MainActivity,
                    filename,
                    "text/csv",
                    csvContent.toByteArray(Charsets.UTF_8)
                )
                mainHandler.post { showSavedFileFeedback(res) }
            } catch (e: Exception) {
                NikshayLogger.e("EXPORT", "Export CSV failed: ${e.message}", e)
                mainHandler.post {
                    Toast.makeText(this@MainActivity, "Export failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun downloadAssetTemplate(assetName: String) {
            try {
                val safeAsset = assetName.replace("..", "").trimStart('/')
                val bytes = assets.open("extension/$safeAsset").use { it.readBytes() }
                val res = FileDownloadHelper.saveBytes(
                    this@MainActivity,
                    safeAsset,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    bytes
                )
                mainHandler.post { showSavedFileFeedback(res) }
            } catch (e: Exception) {
                NikshayLogger.e("TEMPLATE", "Template download failed: ${e.message}", e)
                mainHandler.post {
                    Toast.makeText(this@MainActivity, "Template save failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        @JavascriptInterface
        fun log(level: String, tag: String, message: String) {
            NikshayLogger.log(level, tag, message)
        }

        @JavascriptInterface
        fun getLogs(): String {
            return NikshayLogger.getRecentLogs(350)
        }

        @JavascriptInterface
        fun exportLogs() {
            mainHandler.post {
                try {
                    val result = NikshayLogger.exportLogFile(this@MainActivity)
                    startActivity(FileDownloadHelper.openOrShareIntent(result))
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Failed to export logs: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openLogViewer() {
            mainHandler.post { showLogViewerDialog() }
        }

        @JavascriptInterface
        fun showKeyboard() {
            mainHandler.post {
                val target = if (activeTab == "portal") portalWebView else managerWebView
                target.isFocusable = true
                target.isFocusableInTouchMode = true
                target.requestFocus(View.FOCUS_DOWN)
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.showSoftInput(target, InputMethodManager.SHOW_IMPLICIT)
            }
        }

        @JavascriptInterface
        fun hideKeyboard() {
            mainHandler.post {
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                val token = currentFocus?.windowToken ?: managerWebView.windowToken
                imm?.hideSoftInputFromWindow(token, 0)
            }
        }
    }
}
