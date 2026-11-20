package com.crmlead.companion.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.crmlead.companion.service.CallRecordingService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            CallRecordingService.start(context)

            // Reschedule pending follow-up notifications after reboot
            val prefs = context.getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("server_url", "") ?: ""
            val token = prefs.getString("user_token", "") ?: prefs.getString("device_token", "") ?: ""
            if (serverUrl.isNotBlank() && token.isNotBlank()) {
                com.crmlead.companion.notification.FollowupNotificationManager.checkAndSchedulePendingFollowups(
                    context,
                    serverUrl,
                    token
                )
            }
        }
    }
}

