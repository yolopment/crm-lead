package com.crmlead.companion.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSms(sms: SmsEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(messages: List<SmsEntity>)

    @Update
    suspend fun updateSms(sms: SmsEntity)

    @Query("SELECT * FROM sms_messages WHERE isSynced = 0 ORDER BY timestamp ASC")
    suspend fun getUnsyncedSms(): List<SmsEntity>

    @Query("SELECT * FROM sms_messages ORDER BY timestamp DESC LIMIT 100")
    fun getAllSmsFlow(): Flow<List<SmsEntity>>

    @Query("SELECT * FROM sms_messages ORDER BY timestamp DESC LIMIT 200")
    suspend fun getAllSmsList(): List<SmsEntity>

    @Query("SELECT * FROM sms_messages WHERE address = :phone AND timestamp = :timestamp LIMIT 1")
    suspend fun findExisting(phone: String, timestamp: Long): SmsEntity?
}
