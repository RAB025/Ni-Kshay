package com.nikshay.manager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class AutomationService : Service() {

    companion object {
        const val CHANNEL_ID = "nikshay_automation_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.nikshay.manager.action.START"
        const val ACTION_UPDATE = "com.nikshay.manager.action.UPDATE"
        const val ACTION_STOP = "com.nikshay.manager.action.STOP"

        const val EXTRA_STATUS = "extra_status"
        const val EXTRA_MODE = "extra_mode"

        @Volatile
        var isRunning = false
            private set

        fun start(context: Context, mode: String = "enrollment", statusText: String? = null) {
            try {
                val intent = Intent(context, AutomationService::class.java).apply {
                    action = ACTION_START
                    putExtra(EXTRA_MODE, mode)
                    putExtra(EXTRA_STATUS, statusText)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ContextCompat.startForegroundService(context, intent)
                } else {
                    context.startService(intent)
                }
                NikshayLogger.i("SERVICE", "AutomationService.start called (mode: $mode, status: $statusText)")
            } catch (e: Exception) {
                NikshayLogger.e("SERVICE", "Failed to start AutomationService: ${e.message}", e)
            }
        }

        fun update(context: Context, statusText: String) {
            if (!isRunning) return
            try {
                val intent = Intent(context, AutomationService::class.java).apply {
                    action = ACTION_UPDATE
                    putExtra(EXTRA_STATUS, statusText)
                }
                context.startService(intent)
            } catch (e: Exception) {
                NikshayLogger.w("SERVICE", "Failed to update notification: ${e.message}")
            }
        }

        fun stop(context: Context) {
            try {
                val intent = Intent(context, AutomationService::class.java).apply {
                    action = ACTION_STOP
                }
                context.startService(intent)
                NikshayLogger.i("SERVICE", "AutomationService.stop called")
            } catch (e: Exception) {
                NikshayLogger.w("SERVICE", "Failed to send stop intent: ${e.message}")
            }
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private lateinit var storage: NikshayStorage
    private var lastStatusText: String = "Automation is running in the background"
    private val serviceHandler = Handler(Looper.getMainLooper())

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            try {
                acquireWakeLock()
                MainActivity.activeInstance?.runHeartbeatStep()
            } catch (e: Exception) {
                NikshayLogger.e("SERVICE", "Heartbeat step exception: ${e.message}", e)
            }
            serviceHandler.postDelayed(this, 2500L)
        }
    }

    override fun onCreate() {
        super.onCreate()
        NikshayLogger.init(this)
        NikshayLogger.i("SERVICE", "AutomationService onCreate")
        storage = NikshayStorage(this)
        createNotificationChannel()
        acquireWakeLock()
        isRunning = true
        serviceHandler.post(heartbeatRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        NikshayLogger.d("SERVICE", "onStartCommand: action=$action")

        when (action) {
            ACTION_STOP -> {
                handleStop()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val newStatus = intent?.getStringExtra(EXTRA_STATUS)
                if (!newStatus.isNullOrBlank()) {
                    lastStatusText = newStatus
                }
                updateNotification(lastStatusText)
                return START_STICKY
            }
            ACTION_START -> {
                val statusText = intent?.getStringExtra(EXTRA_STATUS)
                if (!statusText.isNullOrBlank()) {
                    lastStatusText = statusText
                } else {
                    val mode = intent?.getStringExtra(EXTRA_MODE) ?: "enrollment"
                    val status = storage.getModeStatus(mode)
                    lastStatusText = "${status.label}: ${status.done}/${status.total} - Running in background"
                }

                val notification = buildNotification(lastStatusText)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(
                            NOTIFICATION_ID,
                            notification,
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                        )
                    } else {
                        startForeground(NOTIFICATION_ID, notification)
                    }
                    NikshayLogger.i("SERVICE", "Foreground service started with notification: $lastStatusText")
                } catch (e: Exception) {
                    NikshayLogger.e("SERVICE", "startForeground failed: ${e.message}", e)
                }
                serviceHandler.removeCallbacks(heartbeatRunnable)
                serviceHandler.post(heartbeatRunnable)
                return START_STICKY
            }
        }

        return START_STICKY
    }

    private fun handleStop() {
        if (!isRunning) {
            NikshayLogger.d("SERVICE", "handleStop skipped: service is not running")
            return
        }
        isRunning = false
        NikshayLogger.i("SERVICE", "handleStop executing")
        serviceHandler.removeCallbacks(heartbeatRunnable)
        val changes = storage.stopAllAutomations()
        MainActivity.activeInstance?.runOnUiThread {
            MainActivity.activeInstance?.onAutomationStoppedFromService(changes)
        }
        releaseWakeLock()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (e: Exception) {
            NikshayLogger.w("SERVICE", "stopForeground error: ${e.message}")
        }
        stopSelf()
    }

    private fun buildNotification(statusText: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val stopIntent = Intent(this, AutomationService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_nikshay_logo)
            .setContentTitle("Ni-Kshay Automation (Active)")
            .setContentText(statusText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(statusText))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openPendingIntent)
            .addAction(0, "Open App", openPendingIntent)
            .addAction(0, "Stop", stopPendingIntent)
            .build()
    }

    private fun updateNotification(statusText: String) {
        try {
            val notification = buildNotification(statusText)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            NikshayLogger.w("SERVICE", "updateNotification failed: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Ni-Kshay Automation Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Ni-Kshay portal data entry active when the app is minimized"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "NikshayManager::AutomationWakeLock"
            )?.apply {
                setReferenceCounted(false)
                // 8 hour safety timeout to prevent permanent drain if something stalls
                acquire(8 * 60 * 60 * 1000L)
            }
            NikshayLogger.d("SERVICE", "WakeLock acquired")
        } else if (wakeLock?.isHeld == false) {
            try {
                wakeLock?.acquire(8 * 60 * 60 * 1000L)
                NikshayLogger.d("SERVICE", "WakeLock re-acquired")
            } catch (e: Exception) {
                NikshayLogger.w("SERVICE", "WakeLock acquire error: ${e.message}")
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                NikshayLogger.d("SERVICE", "WakeLock released")
            }
        } catch (_: Exception) {}
        wakeLock = null
    }

    override fun onDestroy() {
        super.onDestroy()
        NikshayLogger.i("SERVICE", "AutomationService onDestroy")
        serviceHandler.removeCallbacks(heartbeatRunnable)
        releaseWakeLock()
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
