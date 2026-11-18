package com.nikshay.manager

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.InputStream

class AssetServer(private val context: Context) {

    companion object {
        const val HOST = "nikshay-manager.local"
        const val BASE_URL = "https://$HOST/"
        private const val SHIM_PATH = "__android_shim__.js"
    }

    fun readAssetText(assetPath: String): String {
        return context.assets.open(assetPath).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    fun handleRequest(uri: Uri): WebResourceResponse? {
        if (uri.host != HOST) return null

        val rawPath = (uri.path ?: "/").trimStart('/')
        var path = if (rawPath.isEmpty()) "option.html" else rawPath

        if (path.contains("..")) {
            return WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
        }

        // In Manager/Admin App flavor, redirect login and option requests directly to admin console
        if (context.packageName == "com.nikshay.admin" && (path.isEmpty() || path.equals("option.html", ignoreCase = true) || path.equals("login.html", ignoreCase = true))) {
            path = "admin.html"
        }

        // In Client Automation App flavor, completely block admin.html
        if (context.packageName == "com.nikshay.automation" && path.equals("admin.html", ignoreCase = true)) {
            val html = """
                <!DOCTYPE html>
                <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Access Denied</title>
                <style>body{background:#0B0F19;color:#F9FAFB;font-family:sans-serif;padding:30px;text-align:center;}
                .box{background:#1F2937;border:1px solid #EF4444;border-radius:12px;padding:24px;max-width:380px;margin:40px auto;box-shadow:0 10px 25px rgba(0,0,0,0.5);}
                h3{color:#EF4444;margin-top:0;}
                a{color:#10B981;display:inline-block;margin-top:16px;text-decoration:none;font-weight:bold;}
                </style></head>
                <body><div class="box"><h3>⛔ Access Restricted</h3>
                <p>The Admin Token Console is only available in the <strong>Ni-Kshay Manager</strong> application.</p>
                <a href="login.html">← Return to Login</a></div></body></html>
            """.trimIndent()
            return WebResourceResponse("text/html", "UTF-8", 403, "Forbidden", emptyMap(), ByteArrayInputStream(html.toByteArray(Charsets.UTF_8)))
        }

        if (path == SHIM_PATH) {
            return try {
                val stream = context.assets.open("android_chrome_shim.js")
                WebResourceResponse("application/javascript", "UTF-8", 200, "OK", emptyMap(), stream)
            } catch (_: Exception) {
                notFound()
            }
        }

        val assetPath = "extension/$path"
        return try {
            if (path.endsWith(".html", ignoreCase = true)) {
                val html = readAssetText(assetPath)
                val shimTag = "<script src=\"/$SHIM_PATH\"></script>"
                val injectedHtml = if (html.contains("<head>", ignoreCase = true)) {
                    html.replaceFirst(Regex("(?i)<head>"), "<head>\n    $shimTag")
                } else {
                    "$shimTag\n$html"
                }
                WebResourceResponse(
                    "text/html",
                    "UTF-8",
                    200,
                    "OK",
                    mapOf("Cache-Control" to "no-store"),
                    ByteArrayInputStream(injectedHtml.toByteArray(Charsets.UTF_8))
                )
            } else {
                val stream: InputStream = context.assets.open(assetPath)
                WebResourceResponse(mimeTypeFor(path), encodingFor(path), 200, "OK", emptyMap(), stream)
            }
        } catch (_: Exception) {
            notFound()
        }
    }

    private fun notFound(): WebResourceResponse {
        return WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    }

    private fun mimeTypeFor(path: String): String {
        return when {
            path.endsWith(".js", true) -> "application/javascript"
            path.endsWith(".css", true) -> "text/css"
            path.endsWith(".html", true) -> "text/html"
            path.endsWith(".json", true) -> "application/json"
            path.endsWith(".png", true) -> "image/png"
            path.endsWith(".webp", true) -> "image/webp"
            path.endsWith(".jpg", true) || path.endsWith(".jpeg", true) -> "image/jpeg"
            path.endsWith(".svg", true) -> "image/svg+xml"
            path.endsWith(".xlsx", true) -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            path.endsWith(".csv", true) -> "text/csv"
            else -> "application/octet-stream"
        }
    }

    private fun encodingFor(path: String): String? {
        return when {
            path.endsWith(".js", true) ||
                path.endsWith(".css", true) ||
                path.endsWith(".html", true) ||
                path.endsWith(".json", true) ||
                path.endsWith(".csv", true) -> "UTF-8"
            else -> null
        }
    }
}
