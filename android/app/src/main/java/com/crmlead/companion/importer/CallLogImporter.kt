package com.crmlead.companion.importer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.os.Build
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.CallEntity
import com.crmlead.companion.sync.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

object CallLogImporter {

    private const val TAG = "CallLogImporter"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    suspend fun importRecentCalls(
        context: Context,
        days: Int,
        workSimSlot: Int = -1 // -1 means all SIMs
    ): Result<Int> = withContext(Dispatchers.IO) {
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            return@withContext Result.failure(SecurityException("Call log permission not granted."))
        }

        val prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val serverUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, "http://192.168.1.40:5001") ?: ""
        val deviceToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""

        val cutoffTime = System.currentTimeMillis() - (days.toLong() * 24 * 60 * 60 * 1000)
        val projection = arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.TYPE
        )

        val cursor: Cursor? = try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(cutoffTime.toString()),
                "${CallLog.Calls.DATE} DESC"
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error querying CallLog provider", e)
            null
        }

        if (cursor == null) {
            return@withContext Result.success(0)
        }

        val callsToSync = mutableListOf<CallEntity>()
        val jsonCallsArray = JSONArray()
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        try {
            val numIdx = cursor.getColumnIndex(CallLog.Calls.NUMBER)
            val dateIdx = cursor.getColumnIndex(CallLog.Calls.DATE)
            val durIdx = cursor.getColumnIndex(CallLog.Calls.DURATION)
            val typeIdx = cursor.getColumnIndex(CallLog.Calls.TYPE)

            while (cursor.moveToNext()) {
                val phone = cursor.getString(numIdx) ?: continue
                val callDate = cursor.getLong(dateIdx)
                val duration = cursor.getInt(durIdx)
                val type = cursor.getInt(typeIdx)

                val direction = when (type) {
                    CallLog.Calls.INCOMING_TYPE, CallLog.Calls.MISSED_TYPE, CallLog.Calls.REJECTED_TYPE -> "INBOUND"
                    else -> "OUTBOUND"
                }

                val status = when {
                    type == CallLog.Calls.MISSED_TYPE || type == CallLog.Calls.REJECTED_TYPE -> "MISSED"
                    duration > 0 -> "CONNECTED"
                    else -> "MISSED"
                }

                // Check for matching audio recording on device
                val matchedRecording = try {
                    com.crmlead.companion.detector.CallAudioDetector.findRecordingForCall(
                        context,
                        phone,
                        callDate,
                        callDate + duration * 1000L,
                        duration
                    )
                } catch (e: Exception) {
                    null
                }

                val hasAudio = matchedRecording != null && matchedRecording.exists()

                val callObj = JSONObject().apply {
                    put("phoneNumber", phone)
                    put("direction", direction)
                    put("status", status)
                    put("durationSec", duration)
                    put("startedAt", isoFormat.format(Date(callDate)))
                    put("endedAt", isoFormat.format(Date(callDate + duration * 1000L)))
                    put("hasAudio", hasAudio)
                }
                jsonCallsArray.put(callObj)

                callsToSync.add(
                    CallEntity(
                        phoneNumber = phone,
                        direction = direction,
                        status = status,
                        durationSec = duration,
                        startedAt = callDate,
                        endedAt = callDate + duration * 1000L,
                        audioFilePath = matchedRecording?.absolutePath,
                        isSynced = true
                    )
                )

                // Limit import batch size to 250 calls max to avoid network timeouts
                if (callsToSync.size >= 250) break
            }
        } finally {
            cursor.close()
        }

        if (callsToSync.isEmpty()) {
            return@withContext Result.success(0)
        }

        // Store into local SQLite Room database
        val db = AppDatabase.getDatabase(context)
        for (call in callsToSync) {
            try {
                db.callDao().insertCall(call)
            } catch (e: Exception) {
                // Ignore duplicate inserts
            }
        }

        // Send to CRM backend
        if (serverUrl.isNotEmpty() && deviceToken.isNotEmpty()) {
            try {
                val payload = JSONObject().apply {
                    put("calls", jsonCallsArray)
                }

                val request = Request.Builder()
                    .url("${serverUrl.trimEnd('/')}/api/v1/calls/sync")
                    .header("x-device-token", deviceToken)
                    .header("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                if (!response.isSuccessful) {
                    Log.w(TAG, "Server sync returned status ${response.code}")
                } else {
                    // Trigger recording upload for any matched audio files
                    try {
                        com.crmlead.companion.sync.RecordingSyncManager.scanAndSyncAllRecordings(context)
                    } catch (e: Exception) {
                        Log.w(TAG, "Background recording sync error", e)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload imported calls to CRM server", e)
            }
        }

        Result.success(callsToSync.size)
    }
}

