package com.crmlead.companion.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_messages")
data class SmsEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val address: String, // Phone number
    val contactName: String? = null,
    val body: String,
    val timestamp: Long,
    val direction: String, // "INBOUND" or "OUTBOUND"
    val isSynced: Boolean = false,
    val serverSmsId: String? = null
)
