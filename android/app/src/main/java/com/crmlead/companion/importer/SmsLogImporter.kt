package com.crmlead.companion.importer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.crmlead.companion.contact.ContactHelper
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.SmsEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object SmsLogImporter {

    private const val TAG = "SmsLogImporter"

    suspend fun importRecentSms(
        context: Context,
        days: Int = 30
    ): Result<Int> = withContext(Dispatchers.IO) {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            return@withContext Result.failure(SecurityException("READ_SMS permission not granted."))
        }

        val cutoffTime = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE
        )

        var count = 0
        val db = AppDatabase.getDatabase(context)

        try {
            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection,
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(cutoffTime.toString()),
                "${Telephony.Sms.DATE} DESC LIMIT 300"
            )

            cursor?.use {
                val addressIdx = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = it.getColumnIndex(Telephony.Sms.DATE)
                val typeIdx = it.getColumnIndex(Telephony.Sms.TYPE)

                while (it.moveToNext()) {
                    val address = it.getString(addressIdx) ?: continue
                    val body = it.getString(bodyIdx) ?: ""
                    val timestamp = it.getLong(dateIdx)
                    val rawType = it.getInt(typeIdx)

                    val direction = if (rawType == Telephony.Sms.MESSAGE_TYPE_SENT) "OUTBOUND" else "INBOUND"

                    // Check if already in Room
                    val existing = db.smsDao().findExisting(address, timestamp)
                    if (existing == null) {
                        val contactName = ContactHelper.resolveContactName(context, address)
                        db.smsDao().insertSms(
                            SmsEntity(
                                address = address,
                                contactName = contactName,
                                body = body,
                                timestamp = timestamp,
                                direction = direction,
                                isSynced = false
                            )
                        )
                        count++
                    }
                }
            }

            Log.d(TAG, "Imported $count SMS messages from device storage.")
            Result.success(count)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to import SMS messages: ${e.message}", e)
            Result.failure(e)
        }
    }
}
