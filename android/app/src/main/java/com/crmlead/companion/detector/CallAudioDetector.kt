package com.crmlead.companion.detector

import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File

object CallAudioDetector {
    private const val TAG = "CallAudioDetector"

    // Exhaustive list of directories used by Vivo (FuntouchOS/OriginOS), Samsung, Xiaomi, Oppo/Realme, and Stock Android
    private val RECORDING_DIRECTORIES = listOf(
        "Recordings/Call",
        "Recordings/Call Recordings",
        "Recordings/CallRecord",
        "Recordings/call",
        "Recordings",
        "Music/PhoneRecord",
        "Music/Recordings/Call",
        "Music/Recordings",
        "Record/Call",
        "Record/PhoneRecord",
        "Record",
        "Sounds/Call",
        "Sounds/CallRecord",
        "VoiceRecorder/Call",
        "VoiceRecorder",
        "CallRecordings",
        "MIUI/sound_recorder/call_rec",
        "ColorOS/Recordings",
        "Android/data/com.vivo.record/files"
    )

    private val AUDIO_EXTENSIONS = listOf(".m4a", ".mp3", ".wav", ".aac", ".amr", ".3gp", ".ogg")

    /**
     * Finds the recording file associated with phone number, timestamp, and duration.
     * Uses a dual-engine search:
     *  1. System MediaStore (works with READ_MEDIA_AUDIO / READ_EXTERNAL_STORAGE)
     *  2. Direct Filesystem Traversal across Vivo and OEM recording folders
     */
    fun findRecordingForCall(
        context: Context,
        phoneNumber: String,
        callStartTime: Long,
        callEndTime: Long,
        durationSec: Int = 0
    ): File? {
        val cleanPhone = phoneNumber.replace(Regex("[^0-9]"), "")
        val searchStart = callStartTime - 180_000 // 3-minute tolerance before call
        val searchEnd = (if (callEndTime > 0) callEndTime else callStartTime) + 180_000 // 3-minute tolerance after call

        Log.d(TAG, "Searching recording for phone: $cleanPhone between $searchStart and $searchEnd (dur: ${durationSec}s)")

        // --- Engine 1: Query System MediaStore ---
        try {
            val mediaStoreFile = queryMediaStore(context, cleanPhone, searchStart, searchEnd, durationSec)
            if (mediaStoreFile != null && mediaStoreFile.exists() && mediaStoreFile.length() > 1024) {
                Log.d(TAG, "Found recording via MediaStore: ${mediaStoreFile.absolutePath}")
                return mediaStoreFile
            }
        } catch (e: Exception) {
            Log.w(TAG, "MediaStore search warning", e)
        }

        // --- Engine 2: Direct OEM Directory Scan ---
        try {
            val storageRoots = mutableListOf<File>()
            Environment.getExternalStorageDirectory()?.let { storageRoots.add(it) }
            context.getExternalFilesDir(null)?.let { storageRoots.add(it) }

            for (root in storageRoots) {
                if (!root.exists()) continue

                for (dirName in RECORDING_DIRECTORIES) {
                    val dir = File(root, dirName)
                    if (dir.exists() && dir.isDirectory) {
                        val match = scanDirectory(dir, cleanPhone, searchStart, searchEnd, durationSec)
                        if (match != null && match.exists() && match.length() > 1024) {
                            Log.d(TAG, "Found recording in filesystem dir '$dirName': ${match.absolutePath}")
                            return match
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Filesystem scan warning", e)
        }

        return null
    }

    /**
     * Scans Android system MediaStore for matching audio recording files
     */
    private fun queryMediaStore(
        context: Context,
        cleanPhone: String,
        startTime: Long,
        endTime: Long,
        durationSec: Int
    ): File? {
        val uri: Uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE
        )

        // Find recent audio files
        val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"
        val cursor: Cursor? = context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            sortOrder
        )

        cursor?.use {
            val dataIdx = it.getColumnIndex(MediaStore.Audio.Media.DATA)
            val nameIdx = it.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
            val modifiedIdx = it.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED)
            val durIdx = it.getColumnIndex(MediaStore.Audio.Media.DURATION)
            val sizeIdx = it.getColumnIndex(MediaStore.Audio.Media.SIZE)

            while (it.moveToNext()) {
                val filePath = if (dataIdx >= 0) it.getString(dataIdx) else null ?: continue
                val fileName = if (nameIdx >= 0) it.getString(nameIdx)?.lowercase() ?: "" else ""
                val modifiedSec = if (modifiedIdx >= 0) it.getLong(modifiedIdx) else 0L
                val modifiedMillis = modifiedSec * 1000L
                val fileDurationMs = if (durIdx >= 0) it.getLong(durIdx) else 0L
                val fileSize = if (sizeIdx >= 0) it.getLong(sizeIdx) else 0L

                if (fileSize < 2048) continue // Ignore corrupt/empty files

                val file = File(filePath)
                if (!file.exists()) continue

                // Check extension
                val isValidExt = AUDIO_EXTENSIONS.any { ext -> fileName.endsWith(ext) || filePath.lowercase().endsWith(ext) }
                if (!isValidExt) continue

                // Condition 1: Direct phone number in filename (last 7-10 digits)
                if (cleanPhone.length >= 7 && (fileName.contains(cleanPhone.takeLast(7)) || filePath.contains(cleanPhone.takeLast(7)))) {
                    Log.d(TAG, "MediaStore matched phone number in filename: $filePath")
                    return file
                }

                // Condition 2: Timestamp window overlap
                if (modifiedMillis in startTime..endTime) {
                    if (durationSec > 0 && fileDurationMs > 0) {
                        val diff = Math.abs((fileDurationMs / 1000) - durationSec)
                        if (diff <= 15) { // Within 15s of call length
                            Log.d(TAG, "MediaStore matched timestamp & duration: $filePath")
                            return file
                        }
                    }
                    Log.d(TAG, "MediaStore matched timestamp window: $filePath")
                    return file
                }
            }
        }

        return null
    }

    /**
     * Direct directory file search for matching audio
     */
    private fun scanDirectory(
        dir: File,
        cleanPhone: String,
        startTime: Long,
        endTime: Long,
        durationSec: Int
    ): File? {
        val files = dir.listFiles() ?: return null
        files.sortByDescending { it.lastModified() }

        for (file in files) {
            if (file.isDirectory) continue

            val name = file.name.lowercase()
            val hasValidExt = AUDIO_EXTENSIONS.any { name.endsWith(it) }
            if (!hasValidExt) continue

            val lastModified = file.lastModified()
            val fileSize = file.length()
            if (fileSize < 2048) continue

            // 1. Phone number substring match (Vivo: e.g. 6295925064_Aftab_20261118170322.m4a)
            if (cleanPhone.length >= 7 && name.contains(cleanPhone.takeLast(7))) {
                return file
            }

            // 2. Timestamp window match
            if (lastModified in startTime..endTime) {
                return file
            }
        }

        return null
    }

    /**
     * Scans and returns all audio recording files discovered across device storage
     */
    fun scanAllAudioRecordings(context: Context): List<File> {
        val result = LinkedHashSet<File>()

        // 1. From MediaStore
        try {
            val uri: Uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            val projection = arrayOf(MediaStore.Audio.Media.DATA, MediaStore.Audio.Media.SIZE)
            val cursor = context.contentResolver.query(uri, projection, null, null, "${MediaStore.Audio.Media.DATE_MODIFIED} DESC")
            cursor?.use {
                val dataIdx = it.getColumnIndex(MediaStore.Audio.Media.DATA)
                val sizeIdx = it.getColumnIndex(MediaStore.Audio.Media.SIZE)
                while (it.moveToNext()) {
                    val path = if (dataIdx >= 0) it.getString(dataIdx) else null ?: continue
                    val size = if (sizeIdx >= 0) it.getLong(sizeIdx) else 0L
                    if (size < 2048) continue

                    val file = File(path)
                    val lower = file.name.lowercase()
                    if (file.exists() && AUDIO_EXTENSIONS.any { ext -> lower.endsWith(ext) }) {
                        // Filter for likely call recordings
                        if (lower.contains("call") || lower.contains("record") || lower.contains("phone") ||
                            path.lowercase().contains("recording") || path.lowercase().contains("phonerecord")) {
                            result.add(file)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error querying all MediaStore audio", e)
        }

        // 2. From OEM directories
        val storageRoots = mutableListOf<File>()
        Environment.getExternalStorageDirectory()?.let { storageRoots.add(it) }
        context.getExternalFilesDir(null)?.let { storageRoots.add(it) }

        for (root in storageRoots) {
            if (!root.exists()) continue
            for (dirName in RECORDING_DIRECTORIES) {
                val dir = File(root, dirName)
                if (dir.exists() && dir.isDirectory) {
                    val files = dir.listFiles() ?: continue
                    for (f in files) {
                        if (!f.isDirectory && f.length() >= 2048) {
                            val lower = f.name.lowercase()
                            if (AUDIO_EXTENSIONS.any { lower.endsWith(it) }) {
                                result.add(f)
                            }
                        }
                    }
                }
            }
        }

        return result.toList()
    }
}
