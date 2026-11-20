package com.crmlead.companion.notification

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.crmlead.companion.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

object FollowupNotificationManager {
    private const val TAG = "FollowupNotifMgr"
    const val CHANNEL_ID = "crm_followups_high_priority"
    const val CHANNEL_NAME = "Follow-up Reminders"

    // Action strings
    const val ACTION_ALARM_TRIGGER = "com.crmlead.companion.ACTION_FOLLOWUP_ALARM"
    const val ACTION_COMPLETE = "com.crmlead.companion.ACTION_COMPLETE_FOLLOWUP"

    // Extra keys
    const val EXTRA_FOLLOWUP_ID = "followup_id"
    const val EXTRA_LEAD_NAME = "lead_name"
    const val EXTRA_LEAD_PHONE = "lead_phone"
    const val EXTRA_TITLE = "title"
    const val EXTRA_NOTE = "note"
    const val EXTRA_SCHEDULED_AT = "scheduled_at"

    /**
     * Initialize high-importance Notification Channel with sound and vibration.
     */
    fun initChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical reminders for upcoming and overdue customer follow-up calls"
                enableLights(true)
                lightColor = android.graphics.Color.BLUE
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 200, 400)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * Schedule an exact system alarm using AlarmManager.
     */
    fun scheduleFollowupAlarm(
        context: Context,
        followupId: String,
        leadName: String,
        leadPhone: String,
        title: String,
        note: String?,
        triggerAtMillis: Long
    ) {
        initChannel(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, FollowupAlarmReceiver::class.java).apply {
            action = ACTION_ALARM_TRIGGER
            putExtra(EXTRA_FOLLOWUP_ID, followupId)
            putExtra(EXTRA_LEAD_NAME, leadName)
            putExtra(EXTRA_LEAD_PHONE, leadPhone)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_NOTE, note)
            putExtra(EXTRA_SCHEDULED_AT, triggerAtMillis)
        }

        val requestCode = followupId.hashCode()
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }
            Log.d(TAG, "Exact alarm scheduled for followup '$followupId' at $triggerAtMillis")
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot set exact alarm (permission missing?), falling back to standard: ${e.message}")
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
    }

    /**
     * Displays a Heads-Up notification for a due follow-up with Call, WhatsApp, and Done actions.
     */
    fun showFollowupNotification(
        context: Context,
        followupId: String,
        leadName: String,
        leadPhone: String,
        title: String,
        note: String?
    ) {
        initChannel(context)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notifId = followupId.hashCode()

        // 1. Content Intent: Tap notification to open App
        val contentIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. Action: Call Now
        val cleanPhone = leadPhone.trim()
        val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleanPhone"))
        val callPendingIntent = PendingIntent.getActivity(
            context,
            notifId + 1,
            callIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. Action: WhatsApp
        val waClean = cleanPhone.replace("+", "").replace(" ", "").trim()
        val waIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$waClean"))
        val waPendingIntent = PendingIntent.getActivity(
            context,
            notifId + 2,
            waIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 4. Action: Mark Done
        val doneIntent = Intent(context, FollowupActionReceiver::class.java).apply {
            action = ACTION_COMPLETE
            putExtra(EXTRA_FOLLOWUP_ID, followupId)
            putExtra("notification_id", notifId)
        }
        val donePendingIntent = PendingIntent.getBroadcast(
            context,
            notifId + 3,
            doneIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("⏰ Follow-up Due: $leadName")
            .setContentText("$title · $cleanPhone")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("$title\nPhone: $cleanPhone${if (!note.isNullOrBlank()) "\nNote: $note" else ""}")
            )
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 400, 200, 400))
            .setContentIntent(contentPendingIntent)
            .addAction(android.R.drawable.ic_menu_call, "Call Now", callPendingIntent)
            .addAction(android.R.drawable.ic_menu_send, "WhatsApp", waPendingIntent)
            .addAction(android.R.drawable.ic_menu_save, "Mark Done", donePendingIntent)
            .build()

        notificationManager.notify(notifId, notification)
        Log.d(TAG, "Notification delivered for followup '$followupId' to '$leadName'")
    }

    /**
     * Polls the backend for today's pending follow-ups and schedules alarms.
     */
    fun checkAndSchedulePendingFollowups(context: Context, serverUrl: String, token: String) {
        if (serverUrl.isBlank() || token.isBlank()) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val cleanBase = serverUrl.trimEnd('/')
                val url = "$cleanBase/api/v1/followups?scope=me&timeFilter=today&status=open"

                val client = OkHttpClient()
                val req = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("x-device-token", token)
                    .build()

                val res = client.newCall(req).execute()
                val body = res.body?.string() ?: return@launch

                if (res.isSuccessful) {
                    val json = JSONObject(body)
                    val followups = json.optJSONArray("followups") ?: return@launch
                    val now = System.currentTimeMillis()

                    for (i in 0 until followups.length()) {
                        val item = followups.getJSONObject(i)
                        val id = item.optString("id")
                        val title = item.optString("title", "Follow-up")
                        val note = item.optString("note").takeIf { it.isNotBlank() }
                        val schedStr = item.optString("scheduledAt")
                        val leadObj = item.optJSONObject("lead")
                        val leadName = leadObj?.optString("fullName")?.takeIf { it.isNotBlank() } ?: "Lead"
                        val leadPhone = leadObj?.optString("phone") ?: ""

                        if (schedStr.isNotBlank()) {
                            val schedTime = try {
                                SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(schedStr)?.time ?: 0L
                            } catch (e: Exception) {
                                0L
                            }

                            if (schedTime > now) {
                                // Future follow-up today: schedule exact alarm
                                scheduleFollowupAlarm(context, id, leadName, leadPhone, title, note, schedTime)
                            } else if (now - schedTime < 4 * 3600 * 1000L) {
                                // Overdue within last 4 hours: show immediate notification
                                showFollowupNotification(context, id, leadName, leadPhone, title, note)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to sync pending followups: ${e.message}")
            }
        }
    }
}
