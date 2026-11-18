package com.crmlead.companion

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.crmlead.companion.service.CallRecordingService
import com.crmlead.companion.sync.SyncWorker
import java.util.concurrent.TimeUnit

class CompanionApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Start Call Recording foreground service
        CallRecordingService.start(this)

        // Schedule periodic background sync every 15 minutes as fallback
        val periodicSyncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "PeriodicCallSync",
            ExistingPeriodicWorkPolicy.KEEP,
            periodicSyncRequest
        )
    }
}

