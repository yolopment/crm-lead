package com.crmlead.companion.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.crmlead.companion.data.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val TAG = "SyncWorker"
        const val PREFS_NAME = "crm_prefs"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_DEVICE_TOKEN = "device_token"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val serverUrl = prefs.getString(KEY_SERVER_URL, "") ?: ""
        val deviceToken = prefs.getString(KEY_DEVICE_TOKEN, "") ?: ""

        if (serverUrl.isEmpty() || deviceToken.isEmpty()) {
            Log.w(TAG, "Sync aborted: Device not paired with CRM server yet.")
            return@withContext Result.success()
        }

        // Send live device telemetry heartbeat (battery level, charging status, network/IP, permissions)
        try {
            val telemetryPayload = com.crmlead.companion.telemetry.DeviceTelemetryHelper.getTelemetryPayload(
                applicationContext,
                deviceToken
            )
            val heartbeatRequest = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/v1/devices/pair")
                .header("Content-Type", "application/json")
                .post(RequestBody.create("application/json".toMediaType(), telemetryPayload.toString()))
                .build()
            client.newCall(heartbeatRequest).execute()
        } catch (e: Exception) {
            Log.w(TAG, "Heartbeat telemetry update failed: ${e.message}")
        }

        val db = AppDatabase.getDatabase(applicationContext)
        val unsyncedCalls = db.callDao().getUnsyncedCalls()

        if (unsyncedCalls.isEmpty()) {
            Log.d(TAG, "No unsynced calls to upload.")
            return@withContext Result.success()
        }

        try {
            // 1. Sync Call Metadata
            val callsArray = JSONArray()
            for (call in unsyncedCalls) {
                val callJson = JSONObject().apply {
                    put("phoneNumber", call.phoneNumber)
                    if (!call.contactName.isNullOrBlank()) {
                        put("contactName", call.contactName)
                    }
                    put("direction", call.direction)
                    put("status", call.status)
                    put("durationSec", call.durationSec)
                    put("startedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date(call.startedAt)))
                    if (call.endedAt != null) {
                        put("endedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date(call.endedAt)))
                    }
                    put("hasAudio", call.audioFilePath != null)
                }
                callsArray.put(callJson)
            }

            val syncPayload = JSONObject().apply {
                put("calls", callsArray)
            }

            val syncRequest = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/v1/calls/sync")
                .header("x-device-token", deviceToken)
                .header("Content-Type", "application/json")
                .post(RequestBody.create("application/json".toMediaType(), syncPayload.toString()))
                .build()

            val syncResponse = client.newCall(syncRequest).execute()
            if (!syncResponse.isSuccessful) {
                Log.e(TAG, "Sync API call failed with code: ${syncResponse.code}")
                return@withContext Result.retry()
            }

            val responseBody = syncResponse.body?.string() ?: ""
            val jsonResponse = JSONObject(responseBody)
            val syncedArray = jsonResponse.optJSONArray("synced")

            // Mark calls as synced in local DB and associate returned server IDs
            if (syncedArray != null) {
                for (i in 0 until syncedArray.length()) {
                    val item = syncedArray.getJSONObject(i)
                    val serverId = item.getString("id")
                    if (i < unsyncedCalls.size) {
                        val localCall = unsyncedCalls[i]
                        db.callDao().updateCall(
                            localCall.copy(
                                isSynced = true,
                                serverCallId = serverId
                            )
                        )
                    }
                }
            }

            // 2. Upload Audio Recordings for Synced Calls
            val callsToUploadAudio = db.callDao().getCallsPendingAudioUpload()
            for (call in callsToUploadAudio) {
                val filePath = call.audioFilePath ?: continue
                val file = File(filePath)
                if (!file.exists()) continue

                val serverId = call.serverCallId ?: continue
                val uploadUrl = "${serverUrl.trimEnd('/')}/api/v1/calls/$serverId/upload-recording"

                val multipartBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart(
                        "audio",
                        file.name,
                        file.asRequestBody("audio/*".toMediaType())
                    )
                    .build()

                val uploadRequest = Request.Builder()
                    .url(uploadUrl)
                    .header("x-device-token", deviceToken)
                    .post(multipartBody)
                    .build()

                val uploadResponse = client.newCall(uploadRequest).execute()
                if (uploadResponse.isSuccessful) {
                    db.callDao().updateCall(call.copy(isAudioUploaded = true))
                    Log.d(TAG, "Audio recording successfully uploaded for call: $serverId")
                }
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error during sync worker execution", e)
            Result.retry()
        }
    }
}

