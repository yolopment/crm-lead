package com.crmlead.companion.notification

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class FollowupActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val followupId = intent.getStringExtra(FollowupNotificationManager.EXTRA_FOLLOWUP_ID) ?: return
        val notifId = intent.getIntExtra("notification_id", followupId.hashCode())

        // Dismiss notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(notifId)

        if (action == FollowupNotificationManager.ACTION_COMPLETE) {
            val prefs = context.getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("server_url", "") ?: ""
            val token = prefs.getString("user_token", "") ?: prefs.getString("device_token", "") ?: ""

            if (serverUrl.isNotBlank() && token.isNotBlank()) {
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val client = OkHttpClient()
                        val cleanBase = serverUrl.trimEnd('/')
                        val url = "$cleanBase/api/v1/followups/$followupId/complete"
                        val body = JSONObject().toString().toRequestBody("application/json".toMediaType())
                        val req = Request.Builder()
                            .url(url)
                            .addHeader("Authorization", "Bearer $token")
                            .addHeader("x-device-token", token)
                            .post(body)
                            .build()
                        client.newCall(req).execute()
                    } catch (e: Exception) {
                        // Ignore
                    }
                }
            }

            Toast.makeText(context, "✅ Follow-up marked as completed", Toast.LENGTH_SHORT).show()
        }
    }
}
