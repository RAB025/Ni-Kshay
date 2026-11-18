package com.nikshay.manager

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class ModeStatus(
    val mode: String,
    val label: String,
    val isOnKey: String,
    val isOn: Boolean,
    val done: Int,
    val total: Int
)

class NikshayStorage(context: Context) {

    private val syncPrefs: SharedPreferences =
        context.getSharedPreferences("nikshay_sync_prefs", Context.MODE_PRIVATE)
    private val localDir: File = File(context.filesDir, "nikshay_local").apply { mkdirs() }
    private val lock = Any()

    init {
        synchronized(lock) {
            if (!syncPrefs.contains("status")) {
                syncPrefs.edit()
                    .putString("status", JSONObject.quote("true").let { "true" })
                    .putString("isOn", "true")
                    .apply()
            }
        }
    }

    private fun localFileForKey(key: String): File {
        val safeName = key.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        return File(localDir, "$safeName.json")
    }

    private fun readLocalKey(key: String): Any? {
        val file = localFileForKey(key)
        if (!file.exists()) return null
        return try {
            val raw = file.readText(Charsets.UTF_8)
            val wrapper = JSONObject(raw)
            if (wrapper.isNull("v")) null else wrapper.get("v")
        } catch (_: Exception) {
            null
        }
    }

    private fun writeLocalKey(key: String, value: Any?) {
        val file = localFileForKey(key)
        val tmp = File(localDir, "${file.name}.tmp")
        val wrapper = JSONObject()
        wrapper.put("v", value ?: JSONObject.NULL)
        tmp.writeText(wrapper.toString(), Charsets.UTF_8)
        if (file.exists()) file.delete()
        tmp.renameTo(file)
    }

    private fun listLocalKeys(): List<String> {
        return localDir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(".json") && !it.name.endsWith(".tmp") }
            ?.map { it.name.removeSuffix(".json") }
            ?: emptyList()
    }

    private fun readSyncKey(key: String): Any? {
        val raw = syncPrefs.getString(key, null) ?: return null
        return try {
            val wrapper = JSONObject("{\"v\":$raw}")
            val v = wrapper.get("v")
            if (v === JSONObject.NULL) null else v
        } catch (_: Exception) {
            raw
        }
    }

    private fun writeSyncKey(editor: SharedPreferences.Editor, key: String, value: Any?) {
        val serialized = when (value) {
            null, JSONObject.NULL -> "null"
            is Boolean, is Number -> value.toString()
            is JSONObject, is JSONArray -> value.toString()
            else -> JSONObject.quote(value.toString())
        }
        editor.putString(key, serialized)
    }

    fun get(namespace: String, keysJson: String?): String = synchronized(lock) {
        val result = JSONObject()
        if (keysJson.isNullOrBlank() || keysJson == "null") {
            if (namespace == "sync") {
                for (k in syncPrefs.all.keys) {
                    readSyncKey(k)?.let { result.put(k, it) }
                }
            } else {
                for (k in listLocalKeys()) {
                    readLocalKey(k)?.let { result.put(k, it) }
                }
            }
            return result.toString()
        }

        val trimmed = keysJson.trim()
        when {
            trimmed.startsWith("[") -> {
                val arr = JSONArray(trimmed)
                for (i in 0 until arr.length()) {
                    val key = arr.optString(i)
                    val value = if (namespace == "sync") readSyncKey(key) else readLocalKey(key)
                    if (value != null) result.put(key, value)
                }
            }
            trimmed.startsWith("{") -> {
                val obj = JSONObject(trimmed)
                val it = obj.keys()
                while (it.hasNext()) {
                    val key = it.next()
                    val value = if (namespace == "sync") readSyncKey(key) else readLocalKey(key)
                    result.put(key, value ?: obj.get(key))
                }
            }
            else -> {
                val key = try {
                    JSONObject("{\"k\":$trimmed}").optString("k", trimmed)
                } catch (_: Exception) {
                    trimmed.trim('"')
                }
                val value = if (namespace == "sync") readSyncKey(key) else readLocalKey(key)
                if (value != null) result.put(key, value)
            }
        }
        return result.toString()
    }

    fun set(namespace: String, itemsJson: String): JSONObject = synchronized(lock) {
        val items = JSONObject(itemsJson)
        val changes = JSONObject()
        val editor = if (namespace == "sync") syncPrefs.edit() else null
        val it = items.keys()
        while (it.hasNext()) {
            val key = it.next()
            val newVal = items.get(key)
            val oldVal = if (namespace == "sync") readSyncKey(key) else readLocalKey(key)
            if (namespace == "sync" && editor != null) {
                writeSyncKey(editor, key, newVal)
            } else {
                writeLocalKey(key, newVal)
            }
            val diff = JSONObject()
            val largePayload = (namespace == "local") && (newVal.toString().length > 16384 || (oldVal?.toString()?.length ?: 0) > 16384)
            if (largePayload) {
                diff.put("changed", true)
            } else {
                diff.put("oldValue", oldVal ?: JSONObject.NULL)
                diff.put("newValue", newVal)
            }
            changes.put(key, diff)
        }
        editor?.apply()
        changes
    }

    fun remove(namespace: String, keysJson: String): JSONObject = synchronized(lock) {
        val arr = JSONArray(keysJson)
        val changes = JSONObject()
        val editor = if (namespace == "sync") syncPrefs.edit() else null
        for (i in 0 until arr.length()) {
            val key = arr.optString(i)
            val oldVal = if (namespace == "sync") readSyncKey(key) else readLocalKey(key)
            if (namespace == "sync" && editor != null) {
                editor.remove(key)
            } else {
                localFileForKey(key).delete()
            }
            if (oldVal != null) {
                val diff = JSONObject()
                diff.put("oldValue", oldVal)
                changes.put(key, diff)
            }
        }
        editor?.apply()
        changes
    }

    fun clear(namespace: String) = synchronized(lock) {
        if (namespace == "sync") {
            syncPrefs.edit().clear().apply()
        } else {
            localDir.listFiles()?.forEach { it.delete() }
        }
    }

    fun getModeStatus(preferredMode: String): ModeStatus = synchronized(lock) {
        return when (preferredMode) {
            "x_ray" -> {
                val total = (readLocalKey("data_x_ray") as? JSONArray)?.length() ?: 0
                val done = (readSyncKey("current_x_ray") as? Number)?.toInt() ?: 0
                val isOn = (readSyncKey("isOn_x_ray") as? Boolean) ?: false
                ModeStatus("x_ray", "X-Ray", "isOn_x_ray", isOn, done, total)
            }
            "trunat" -> {
                val total = (readLocalKey("data_trunat") as? JSONArray)?.length() ?: 0
                val done = (readSyncKey("current_trunat") as? Number)?.toInt() ?: 0
                val isOn = (readSyncKey("isOn_trunat") as? Boolean) ?: false
                ModeStatus("trunat", "Trunat", "isOn_trunat", isOn, done, total)
            }
            else -> {
                val total = (readLocalKey("data") as? JSONArray)?.length() ?: 0
                val done = (readSyncKey("current") as? Number)?.toInt() ?: 0
                val isOn = (readSyncKey("isOn") as? Boolean) ?: true
                ModeStatus("enrollment", "Enroll", "isOn", isOn, done, total)
            }
        }
    }

    fun isAnyAutomationActive(): Boolean = synchronized(lock) {
        val enrollStatus = getModeStatus("enrollment")
        if (enrollStatus.isOn) {
            if (enrollStatus.total == 0 || enrollStatus.done < enrollStatus.total) return true
        }

        val xrayStatus = getModeStatus("x_ray")
        if (xrayStatus.isOn) {
            if (xrayStatus.total == 0 || xrayStatus.done < xrayStatus.total) return true
        }

        val trunatStatus = getModeStatus("trunat")
        if (trunatStatus.isOn) {
            if (trunatStatus.total == 0 || trunatStatus.done < trunatStatus.total) return true
        }

        return false
    }

    fun stopAllAutomations(): JSONObject = synchronized(lock) {
        val payload = JSONObject()
            .put("isOn", false)
            .put("isOn_x_ray", false)
            .put("isOn_trunat", false)
        return set("sync", payload.toString())
    }

    fun isLicenseValid(): Boolean = synchronized(lock) {
        try {
            val raw = syncPrefs.getString("nikshay_auth_session", null) ?: return false
            val obj = JSONObject(raw)
            val exp = obj.optLong("expiresAt", 0L)
            val iat = obj.optLong("issuedAt", 0L)
            val token = obj.optString("token", "")
            val now = System.currentTimeMillis()
            if (token.isBlank()) return false
            if (now >= exp) return false
            if (iat > 0 && now < (iat - 300000L)) return false
            return true
        } catch (_: Exception) {
            return false
        }
    }

    fun getLicenseUsername(): String? = synchronized(lock) {
        try {
            val raw = syncPrefs.getString("nikshay_auth_session", null) ?: return null
            val obj = JSONObject(raw)
            return obj.optString("username", "").takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }

    fun getLicenseRemainingDays(): Long = synchronized(lock) {
        try {
            val raw = syncPrefs.getString("nikshay_auth_session", null) ?: return 0L
            val obj = JSONObject(raw)
            val exp = obj.optLong("expiresAt", 0L)
            val diff = exp - System.currentTimeMillis()
            return if (diff > 0) Math.ceil(diff / 86400000.0).toLong() else 0L
        } catch (_: Exception) {
            0L
        }
    }
}
