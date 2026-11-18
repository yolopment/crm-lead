package com.crmlead.companion.detector

import android.content.Context
import android.os.Environment
import android.util.Log
import java.io.File

object CallAudioDetector {
    private const val TAG = "CallAudioDetector"

    // Standard directories where Android OEMs save native call recordings
    private val RECORDING_DIRECTORIES = listOf(
        "Recordings/Call",
        "Recordings/call",
        "Recordings",
        "CallRecordings",
        "Sounds/Call",
        "MIUI/sound_recorder/call_rec",
        "ColorOS/Recordings",
        "VoiceRecorder"
    )

    /**
     * Finds recording file associated with phone number and call timestamp
     */
    fun findRecordingForCall(context: Context, phoneNumber: String, callStartTime: Long, callEndTime: Long): File? {
        val cleanPhone = phoneNumber.replace(Regex("[^0-9]"), "")
        val searchWindowStart = callStartTime - 30_000 // 30s buffer
        val searchWindowEnd = (if (callEndTime > 0) callEndTime else System.currentTimeMillis()) + 60_000

        val storageRoots = listOf(
            Environment.getExternalStorageDirectory(),
            context.getExternalFilesDir(null)
        )

        for (root in storageRoots) {
            if (root == null || !root.exists()) continue

            for (dirName in RECORDING_DIRECTORIES) {
                val dir = File(root, dirName)
                if (dir.exists() && dir.isDirectory) {
                    val matchingFile = scanDirectory(dir, cleanPhone, searchWindowStart, searchWindowEnd)
                    if (matchingFile != null) {
                        Log.d(TAG, "Found call recording: ${matchingFile.absolutePath}")
                        return matchingFile
                    }
                }
            }
        }
        return null
    }

    private fun scanDirectory(dir: File, cleanPhone: String, startTime: Long, endTime: Long): File? {
        val files = dir.listFiles() ?: return null
        // Sort newest first
        files.sortByDescending { it.lastModified() }

        for (file in files) {
            if (file.isDirectory) continue

            val name = file.name.lowercase()
            val extValid = name.endsWith(".m4a") || name.endsWith(".mp3") || name.endsWith(".wav") ||
                    name.endsWith(".aac") || name.endsWith(".amr") || name.endsWith(".3gp")

            if (!extValid) continue

            val lastModified = file.lastModified()
            val isInTimeRange = lastModified in startTime..endTime

            // Match phone number substring or matching time range
            if (isInTimeRange) {
                if (cleanPhone.isNotEmpty() && name.contains(cleanPhone.takeLast(7))) {
                    return file
                }
                // Fallback: file created immediately during this call window
                return file
            }
        }
        return null
    }
}

