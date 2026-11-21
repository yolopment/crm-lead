package com.crmlead.companion.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "calls")
data class CallEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val phoneNumber: String,
    val contactName: String? = null,
    val direction: String, // "INBOUND" or "OUTBOUND"
    val status: String,    // "CONNECTED", "MISSED", "BUSY"
    val durationSec: Int,
    val startedAt: Long,
    val endedAt: Long?,
    val audioFilePath: String?,
    val isSynced: Boolean = false,
    val isAudioUploaded: Boolean = false,
    val serverCallId: String? = null,
    val tags: String? = null,
    val notes: String? = null,
    val simSlot: Int? = null // 0 for SIM 1, 1 for SIM 2, null if untracked / single SIM
)
