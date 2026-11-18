package com.crmlead.companion.contact

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat

object ContactHelper {

    private const val TAG = "ContactHelper"

    /**
     * Look up the contact's saved name from the Android phonebook given a phone number.
     * Checks PhoneLookup first, then falls back to normalized substring search on CommonDataKinds.Phone.
     */
    fun resolveContactName(context: Context, rawPhoneNumber: String?): String? {
        if (rawPhoneNumber.isNullOrBlank()) return null

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            return null
        }

        val cleanNumber = rawPhoneNumber.replace(Regex("[^0-9+]"), "")
        if (cleanNumber.isBlank()) return null

        // 1. First attempt: Standard ContactsContract.PhoneLookup
        try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(cleanNumber)
            )
            val projection = arrayOf(
                ContactsContract.PhoneLookup.DISPLAY_NAME
            )

            context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                    if (nameIdx >= 0) {
                        val name = cursor.getString(nameIdx)
                        if (!name.isNullOrBlank()) {
                            return name.trim()
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "PhoneLookup failed for $cleanNumber: ${e.message}")
        }

        // 2. Second attempt: Search using the last 10 digits (handling +91/0 prefixes)
        val digitsOnly = cleanNumber.replace("+", "")
        if (digitsOnly.length >= 7) {
            val suffix = digitsOnly.takeLast(10)
            try {
                val projection = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                )
                val selection = "${ContactsContract.CommonDataKinds.Phone.NUMBER} LIKE ?"
                val selectionArgs = arrayOf("%$suffix%")

                context.contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    null
                )?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val nameIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                        if (nameIdx >= 0) {
                            val name = cursor.getString(nameIdx)
                            if (!name.isNullOrBlank()) {
                                return name.trim()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "CommonDataKinds search failed for $suffix: ${e.message}")
            }
        }

        return null
    }

    /**
     * Checks whether a phone number is saved in the phonebook.
     */
    fun isContactSaved(context: Context, rawPhoneNumber: String?): Boolean {
        return resolveContactName(context, rawPhoneNumber) != null
    }

    /**
     * Scans local SQLite Room database and resolves missing contact names from the phonebook.
     */
    suspend fun syncContactNamesWithLocalDb(context: Context) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        try {
            val db = com.crmlead.companion.data.AppDatabase.getDatabase(context)
            val calls = db.callDao().getAllCallsList()
            for (call in calls) {
                if (call.contactName.isNullOrBlank()) {
                    val name = resolveContactName(context, call.phoneNumber)
                    if (!name.isNullOrBlank()) {
                        db.callDao().updateCall(call.copy(contactName = name))
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing contact names with local DB: ${e.message}")
        }
    }
}
