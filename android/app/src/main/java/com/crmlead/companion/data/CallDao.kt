package com.crmlead.companion.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface CallDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCall(call: CallEntity): Long

    @Update
    suspend fun updateCall(call: CallEntity)

    @Query("SELECT * FROM calls WHERE isSynced = 0 ORDER BY startedAt ASC")
    suspend fun getUnsyncedCalls(): List<CallEntity>

    @Query("SELECT * FROM calls WHERE isSynced = 1 AND isAudioUploaded = 0 AND audioFilePath IS NOT NULL")
    suspend fun getCallsPendingAudioUpload(): List<CallEntity>

    @Query("SELECT * FROM calls ORDER BY startedAt DESC LIMIT 50")
    fun getAllCallsFlow(): Flow<List<CallEntity>>

    @Query("SELECT * FROM calls ORDER BY startedAt DESC LIMIT 200")
    suspend fun getAllCallsList(): List<CallEntity>

    @Query("SELECT * FROM calls WHERE (:allowedSlot = -1 OR simSlot IS NULL OR simSlot = :allowedSlot) ORDER BY startedAt DESC LIMIT 200")
    suspend fun getFilteredCallsList(allowedSlot: Int): List<CallEntity>

    @Query("DELETE FROM calls WHERE simSlot IS NOT NULL AND simSlot != :allowedSlot")
    suspend fun deleteCallsFromOtherSimSlots(allowedSlot: Int)

    @Query("SELECT * FROM calls WHERE phoneNumber = :phone AND startedAt >= :sinceTime ORDER BY startedAt DESC LIMIT 1")
    suspend fun findRecentCall(phone: String, sinceTime: Long): CallEntity?

    @Query("UPDATE calls SET contactName = :name WHERE phoneNumber = :phone")
    suspend fun updateContactNameByPhone(phone: String, name: String)
}
