package com.crmlead.companion.service

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.crmlead.companion.R
import com.crmlead.companion.sync.SyncWorker
import com.crmlead.companion.telemetry.DeviceTelemetryHelper
import com.crmlead.companion.ui.MainActivity
import kotlinx.coroutines.*

class CallRecordingService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private val telemetryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.d(TAG, "Hardware event detected: ${intent?.action}, updating telemetry...")
            triggerTelemetrySync()
        }
    }

    companion object {
        private const val TAG = "CallRecordingService"
        const val CHANNEL_ID = "crm_call_service_channel"
        const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, CallRecordingService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Register broadcast receivers for power & connectivity changes
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
            addAction(Intent.ACTION_BATTERY_LOW)
            addAction(Intent.ACTION_BATTERY_OKAY)
            @Suppress("DEPRECATION")
            addAction(ConnectivityManager.CONNECTIVITY_ACTION)
        }
        registerReceiver(telemetryReceiver, filter)

        // Periodic telemetry ticker (every 60 seconds)
        serviceScope.launch {
            while (isActive) {
                triggerTelemetrySync()
                delay(60_000L)
            }
        }
    }

    private fun triggerTelemetrySync() {
        serviceScope.launch {
            try {
                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                val serverUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, "") ?: ""
                val deviceToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
                if (serverUrl.isNotEmpty() && deviceToken.isNotEmpty()) {
                    DeviceTelemetryHelper.sendTelemetry(applicationContext, serverUrl, deviceToken)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to run telemetry sync: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(telemetryReceiver)
        } catch (e: Exception) {
            // Already unregistered
        }
        serviceJob.cancel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Return START_STICKY so Android OS recreates service if killed under memory pressure
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.service_running_title))
            .setContentText(getString(R.string.service_running_desc))
            .setSmallIcon(android.R.drawable.sym_call_outgoing)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.service_notification_channel),
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}

