package com.nikshay.manager

import android.content.Context
import android.os.Environment
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.LinkedList
import java.util.Locale

object NikshayLogger {

    private const val TAG = "NikshayLogger"
    private const val MAX_MEMORY_LINES = 600

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
    private val fileTimestampFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
    private val memoryLogs = LinkedList<String>()
    private val lock = Any()

    private var logFile: File? = null

    fun init(context: Context) {
        synchronized(lock) {
            try {
                val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "NikshayManager")
                if (!dir.exists()) {
                    dir.mkdirs()
                }
                logFile = File(dir, "automation_running.log")
                if (logFile?.exists() == true && logFile!!.length() > 5 * 1024 * 1024) {
                    // Rotate if larger than 5MB
                    val backup = File(dir, "automation_running_prev.log")
                    if (backup.exists()) backup.delete()
                    logFile!!.renameTo(backup)
                    logFile = File(dir, "automation_running.log")
                }
                log("INFO", "SYSTEM", "=== Ni-Kshay Automation Logger Initialized ===")
                log("INFO", "SYSTEM", "App Version: V2.2.0 | Android SDK: ${android.os.Build.VERSION.SDK_INT}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to init log file", e)
            }
        }
    }

    fun d(tag: String, message: String) = log("DEBUG", tag, message)
    fun i(tag: String, message: String) = log("INFO", tag, message)
    fun w(tag: String, message: String) = log("WARN", tag, message)
    fun e(tag: String, message: String, throwable: Throwable? = null) {
        val extra = if (throwable != null) {
            val sw = StringWriter()
            throwable.printStackTrace(PrintWriter(sw))
            "\n" + sw.toString()
        } else ""
        log("ERROR", tag, message + extra)
    }

    fun log(level: String, tag: String, message: String) {
        val timestamp = synchronized(dateFormat) { dateFormat.format(Date()) }
        val line = "[$timestamp] [$level] [$tag] $message"

        when (level) {
            "DEBUG" -> Log.d(tag, message)
            "INFO" -> Log.i(tag, message)
            "WARN" -> Log.w(tag, message)
            "ERROR" -> Log.e(tag, message)
            else -> Log.i(tag, message)
        }

        synchronized(lock) {
            memoryLogs.addLast(line)
            while (memoryLogs.size > MAX_MEMORY_LINES) {
                memoryLogs.removeFirst()
            }

            try {
                logFile?.let { file ->
                    FileWriter(file, true).use { writer ->
                        writer.write(line)
                        writer.write("\n")
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun getRecentLogs(maxLines: Int = 300): String {
        synchronized(lock) {
            val count = minOf(maxLines, memoryLogs.size)
            val subList = memoryLogs.takeLast(count)
            return subList.joinToString("\n")
        }
    }

    fun getAllLogsText(): String {
        synchronized(lock) {
            val diskContent = try {
                if (logFile?.exists() == true) logFile!!.readText(Charsets.UTF_8) else ""
            } catch (_: Exception) { "" }

            if (diskContent.isNotBlank()) return diskContent
            return memoryLogs.joinToString("\n")
        }
    }

    fun exportLogFile(context: Context): FileDownloadHelper.SavedFileResult {
        val allLogs = getAllLogsText()
        val ts = synchronized(fileTimestampFormat) { fileTimestampFormat.format(Date()) }
        val filename = "Nikshay_Automation_Log_$ts.txt"
        val bytes = (allLogs.ifBlank { "No logs recorded yet." }).toByteArray(Charsets.UTF_8)

        i("LOGGER", "Exporting automation log file ($filename, ${bytes.size} bytes)...")
        return FileDownloadHelper.saveBytes(context, filename, "text/plain", bytes)
    }

    fun clear() {
        synchronized(lock) {
            memoryLogs.clear()
            try {
                logFile?.delete()
                logFile?.createNewFile()
            } catch (_: Exception) {}
            log("INFO", "SYSTEM", "=== Logs Cleared by User ===")
        }
    }
}
