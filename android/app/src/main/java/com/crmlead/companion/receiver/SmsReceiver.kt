package com.crmlead.companion.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.crmlead.companion.contact.ContactHelper
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.SmsEntity
import com.crmlead.companion.sync.SyncWorker
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val sender = messages[0].displayOriginatingAddress ?: return
            val timestamp = messages[0].timestampMillis
            val bodyBuilder = StringBuilder()
            for (msg in messages) {
                bodyBuilder.append(msg.displayMessageBody)
            }
            val body = bodyBuilder.toString()

            Log.d(TAG, "Incoming SMS from $sender (${body.take(20)}...)")

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val contactName = ContactHelper.resolveContactName(context, sender)
                    val db = AppDatabase.getDatabase(context)
                    val sms = SmsEntity(
                        address = sender,
                        contactName = contactName,
                        body = body,
                        timestamp = timestamp,
                        direction = "INBOUND",
                        isSynced = false
                    )
                    db.smsDao().insertSms(sms)

                    // Trigger immediate background sync
                    val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>().build()
                    WorkManager.getInstance(context).enqueue(syncRequest)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to persist incoming SMS: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in SmsReceiver: ${e.message}")
        }
    }
}
