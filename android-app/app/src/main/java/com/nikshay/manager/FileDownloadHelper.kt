package com.nikshay.manager

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object FileDownloadHelper {

    data class SavedFileResult(
        val displayLocation: String,
        val shareUri: Uri,
        val mimeType: String,
        val fileName: String,
        val absolutePath: String
    )

    fun saveBytes(
        context: Context,
        fileName: String,
        mimeType: String,
        bytes: ByteArray
    ): SavedFileResult {
        var safeName = fileName.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        if (safeName.isEmpty()) {
            val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            safeName = "export_$ts.csv"
        }

        // Always keep a primary copy in app-external Downloads for reliable FileProvider Open/Share across Android 7-15
        val appDownloadDir = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "NikshayManager")
        if (!appDownloadDir.exists()) {
            appDownloadDir.mkdirs()
        }
        val shareCopy = File(appDownloadDir, safeName)
        shareCopy.writeBytes(bytes)
        val shareUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", shareCopy)

        var displayLocation = "Downloads/NikshayManager/$safeName"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val resolver = context.contentResolver
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/NikshayManager")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
                val itemUri = resolver.insert(collection, values)
                if (itemUri != null) {
                    resolver.openOutputStream(itemUri)?.use { out ->
                        out.write(bytes)
                    }
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(itemUri, values, null, null)
                    displayLocation = "Downloads/NikshayManager/$safeName"
                }
            } catch (_: Exception) {
                // Keep appDownloadDir copy if MediaStore throws security/quota exception
                displayLocation = "Downloads/NikshayManager/$safeName"
            }
        } else {
            try {
                @Suppress("DEPRECATION")
                val publicDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "NikshayManager")
                if (!publicDir.exists()) {
                    publicDir.mkdirs()
                }
                val outFile = File(publicDir, safeName)
                outFile.writeBytes(bytes)
                displayLocation = "Downloads/NikshayManager/$safeName"
                MediaScannerConnection.scanFile(context, arrayOf(outFile.absolutePath), arrayOf(mimeType), null)
            } catch (_: Exception) {
                // Fallback already saved in appDownloadDir
            }
        }

        try {
            MediaScannerConnection.scanFile(context, arrayOf(shareCopy.absolutePath), arrayOf(mimeType), null)
        } catch (_: Exception) {}

        return SavedFileResult(
            displayLocation = displayLocation,
            shareUri = shareUri,
            mimeType = mimeType,
            fileName = safeName,
            absolutePath = shareCopy.absolutePath
        )
    }

    fun viewIntent(result: SavedFileResult): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(result.shareUri, result.mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    fun shareIntent(result: SavedFileResult): Intent {
        return Intent(Intent.ACTION_SEND).apply {
            type = result.mimeType
            putExtra(Intent.EXTRA_STREAM, result.shareUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    fun openOrShareIntent(result: SavedFileResult): Intent {
        val share = shareIntent(result)
        val chooser = Intent.createChooser(share, "Share ${result.fileName}")
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(viewIntent(result)))
        return chooser
    }
}
