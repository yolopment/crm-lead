package com.crmlead.companion.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class FollowupAlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "FollowupAlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val followupId = intent.getStringExtra(FollowupNotificationManager.EXTRA_FOLLOWUP_ID) ?: return
        val leadName = intent.getStringExtra(FollowupNotificationManager.EXTRA_LEAD_NAME) ?: "Lead"
        val leadPhone = intent.getStringExtra(FollowupNotificationManager.EXTRA_LEAD_PHONE) ?: ""
        val title = intent.getStringExtra(FollowupNotificationManager.EXTRA_TITLE) ?: "Scheduled Call"
        val note = intent.getStringExtra(FollowupNotificationManager.EXTRA_NOTE)

        Log.d(TAG, "Follow-up alarm received for id: $followupId, lead: $leadName")

        FollowupNotificationManager.showFollowupNotification(
            context = context,
            followupId = followupId,
            leadName = leadName,
            leadPhone = leadPhone,
            title = title,
            note = note
        )
    }
}
