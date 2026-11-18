package com.crmlead.companion.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.CallEntity
import com.crmlead.companion.detector.CallAudioDetector
import com.crmlead.companion.sync.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class PhoneStateReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PhoneStateReceiver"
        private var lastState = TelephonyManager.CALL_STATE_IDLE
        private var callStartTime: Long = 0
        private var isIncoming = false
        private var savedNumber: String? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_NEW_OUTGOING_CALL) {
            savedNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)
            isIncoming = false
            return
        }

        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

            if (!incomingNumber.isNullOrEmpty()) {
                savedNumber = incomingNumber
            }

            val state = when (stateStr) {
                TelephonyManager.EXTRA_STATE_IDLE -> TelephonyManager.CALL_STATE_IDLE
                TelephonyManager.EXTRA_STATE_OFFHOOK -> TelephonyManager.CALL_STATE_OFFHOOK
                TelephonyManager.EXTRA_STATE_RINGING -> TelephonyManager.CALL_STATE_RINGING
                else -> TelephonyManager.CALL_STATE_IDLE
            }

            onCustomCallStateChanged(context, state, savedNumber)
        }
    }

    private fun onCustomCallStateChanged(context: Context, state: Int, number: String?) {
        if (lastState == state) return

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                isIncoming = true
                callStartTime = System.currentTimeMillis()
                Log.d(TAG, "Incoming call ringing from: $number")
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (lastState != TelephonyManager.CALL_STATE_RINGING) {
                    isIncoming = false
                    Log.d(TAG, "Outgoing call started to: $number")
                }
                callStartTime = System.currentTimeMillis()
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                val callEndTime = System.currentTimeMillis()
                val durationSec = if (callStartTime > 0) ((callEndTime - callStartTime) / 1000).toInt() else 0
                val phone = number ?: "Unknown"

                val direction = if (isIncoming) "INBOUND" else "OUTBOUND"
                val status = if (durationSec > 0) "CONNECTED" else "MISSED"

                Log.d(TAG, "Call ended. Phone: $phone, Dir: $direction, Status: $status, Duration: ${durationSec}s")

                // Delay 2 seconds to allow native dialer to finalize writing recording file to disk
                CoroutineScope(Dispatchers.IO).launch {
                    delay(2500)
                    val recordingFile = CallAudioDetector.findRecordingForCall(context, phone, callStartTime, callEndTime, durationSec)
                    val contactName = com.crmlead.companion.contact.ContactHelper.resolveContactName(context, phone)

                    val callEntity = CallEntity(
                        phoneNumber = phone,
                        contactName = contactName,
                        direction = direction,
                        status = status,
                        durationSec = durationSec,
                        startedAt = if (callStartTime > 0) callStartTime else callEndTime,
                        endedAt = callEndTime,
                        audioFilePath = recordingFile?.absolutePath
                    )

                    val db = AppDatabase.getDatabase(context)
                    db.callDao().insertCall(callEntity)

                    // Trigger immediate background sync
                    val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>().build()
                    WorkManager.getInstance(context).enqueue(syncRequest)
                }

                // Reset state
                callStartTime = 0
                savedNumber = null
            }
        }
        lastState = state
    }
}

