package com.crmlead.companion.sync

import android.content.Context
import android.util.Log
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.CallEntity
import com.crmlead.companion.detector.CallAudioDetector
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

object RecordingSyncManager {

    private const val TAG = "RecordingSyncManager"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .build()

    /**
     * Scans storage for audio recordings, matches them against calls in local database,
     * and uploads matched recordings to the CRM server.
     *
     * @return Pair of (matchedRecordingsCount, uploadedRecordingsCount)
     */
    suspend fun scanAndSyncAllRecordings(
        context: Context,
        onProgress: ((status: String) -> Unit)? = null
    ): Result<Pair<Int, Int>> = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val serverUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, "http://192.168.1.27:5001") ?: "http://192.168.1.27:5001"
        val deviceToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""

        if (serverUrl.isEmpty() || deviceToken.isEmpty()) {
            return@withContext Result.failure(IllegalStateException("Device is not paired with CRM server."))
        }

        val db = AppDatabase.getDatabase(context)
        val allCalls = db.callDao().getAllCallsList()

        if (allCalls.isEmpty()) {
            return@withContext Result.success(Pair(0, 0))
        }

        onProgress?.invoke("Scanning audio files on device...")
        val allDiscoveredAudio = CallAudioDetector.scanAllAudioRecordings(context)
        Log.d(TAG, "Discovered ${allDiscoveredAudio.size} total audio files on phone.")

        var matchedCount = 0
        var uploadedCount = 0

        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        for ((index, call) in allCalls.withIndex()) {
            var audioFile: File? = null

            // 1. Check if audio file already assigned and exists on disk
            if (!call.audioFilePath.isNullOrEmpty()) {
                val existingFile = File(call.audioFilePath)
                if (existingFile.exists() && existingFile.length() > 1024) {
                    audioFile = existingFile
                }
            }

            // 2. If no valid audio file yet, attempt to find a match
            if (audioFile == null) {
                // Try targeted detector
                audioFile = CallAudioDetector.findRecordingForCall(
                    context,
                    call.phoneNumber,
                    call.startedAt,
                    call.endedAt ?: call.startedAt,
                    call.durationSec
                )

                // Fallback: match from discovered list
                if (audioFile == null && allDiscoveredAudio.isNotEmpty()) {
                    val cleanPhone = call.phoneNumber.replace(Regex("[^0-9]"), "")
                    audioFile = allDiscoveredAudio.firstOrNull { f ->
                        val name = f.name.lowercase()
                        (cleanPhone.length >= 7 && name.contains(cleanPhone.takeLast(7))) ||
                        (f.lastModified() in (call.startedAt - 120_000)..(call.startedAt + 180_000))
                    }
                }

                if (audioFile != null && audioFile.exists()) {
                    matchedCount++
                    db.callDao().updateCall(call.copy(audioFilePath = audioFile.absolutePath))
                }
            }

            // 3. Upload audio if not yet uploaded
            if (audioFile != null && audioFile.exists() && !call.isAudioUploaded) {
                onProgress?.invoke("Uploading recording for ${call.phoneNumber} (${index + 1}/${allCalls.size})...")

                val uploadSuccess = uploadAudioFile(
                    serverUrl = serverUrl,
                    deviceToken = deviceToken,
                    audioFile = audioFile,
                    call = call,
                    isoFormat = isoFormat
                )

                if (uploadSuccess) {
                    uploadedCount++
                    db.callDao().updateCall(
                        call.copy(
                            audioFilePath = audioFile.absolutePath,
                            isAudioUploaded = true
                        )
                    )
                }
            }
        }

        Log.d(TAG, "Completed audio scan: matched=$matchedCount, uploaded=$uploadedCount")
        Result.success(Pair(matchedCount, uploadedCount))
    }

    private fun uploadAudioFile(
        serverUrl: String,
        deviceToken: String,
        audioFile: File,
        call: CallEntity,
        isoFormat: SimpleDateFormat
    ): Boolean {
        try {
            val cleanUrl = serverUrl.trimEnd('/')

            val multipartBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "audio",
                    audioFile.name,
                    audioFile.asRequestBody("audio/*".toMediaType())
                )
                .addFormDataPart("phoneNumber", call.phoneNumber)
                .addFormDataPart("startedAt", isoFormat.format(Date(call.startedAt)))
                .addFormDataPart("durationSec", call.durationSec.toString())

            if (!call.serverCallId.isNullOrEmpty()) {
                multipartBody.addFormDataPart("callId", call.serverCallId)
            }

            // Use upload-by-match which works whether serverCallId is known or not
            val uploadUrl = if (!call.serverCallId.isNullOrEmpty()) {
                "$cleanUrl/api/v1/calls/${call.serverCallId}/upload-recording"
            } else {
                "$cleanUrl/api/v1/calls/upload-by-match"
            }

            val request = Request.Builder()
                .url(uploadUrl)
                .header("x-device-token", deviceToken)
                .post(multipartBody.build())
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (response.isSuccessful) {
                Log.d(TAG, "Audio successfully uploaded: ${response.code} for ${call.phoneNumber}")
                return true
            } else {
                Log.w(TAG, "Audio upload returned error ${response.code}: $body")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upload audio for ${call.phoneNumber}", e)
        }
        return false
    }
}
