package com.crmlead.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.data.CallEntity
import com.crmlead.companion.importer.CallLogImporter
import com.crmlead.companion.service.CallRecordingService
import com.crmlead.companion.sim.SimInfo
import com.crmlead.companion.sim.SimManagerHelper
import com.crmlead.companion.sync.SyncWorker
import com.crmlead.companion.ui.screens.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

enum class SetupStep {
    SIGN_IN,
    SETUP_OVERVIEW,
    STEP_CALL_TRACKING,
    STEP_NOTIFICATIONS,
    STEP_WORK_SIM,
    SETUP_COMPLETE,
    IMPORT_CALLS,
    DASHBOARD
}

class MainActivity : ComponentActivity() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    companion object {
        const val KEY_PAIRED_USER = "paired_user"
        const val KEY_PAIRED_ORG = "paired_org"
        const val KEY_IS_PAIRED = "is_paired"
        const val KEY_ONBOARDING_COMPLETED = "onboarding_completed"
        const val KEY_WORK_SIM_SLOT = "work_sim_slot"
        const val KEY_WORK_SIM_NAME = "work_sim_name"
    }

    // Permission Launchers
    private val callTrackingPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.values.all { it }
        if (granted) {
            Toast.makeText(this, "Call tracking enabled!", Toast.LENGTH_SHORT).show()
        }
        currentStep = SetupStep.STEP_NOTIFICATIONS
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            Toast.makeText(this, "Notifications enabled!", Toast.LENGTH_SHORT).show()
        }
        currentStep = SetupStep.STEP_WORK_SIM
    }

    private val phoneStatePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        refreshSimList()
    }

    private var currentStep by mutableStateOf(SetupStep.SIGN_IN)
    private var isSigningIn by mutableStateOf(false)
    private var isImporting by mutableStateOf(false)
    private var importStatusText by mutableStateOf("")
    private var detectedSims by mutableStateOf<List<SimInfo>>(emptyList())
    private var selectedSimSlot by mutableStateOf(-1)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val isOnboardingCompleted = prefs.getBoolean(KEY_ONBOARDING_COMPLETED, false)
        val isPaired = prefs.getBoolean(KEY_IS_PAIRED, false)
        selectedSimSlot = prefs.getInt(KEY_WORK_SIM_SLOT, -1)

        currentStep = if (isOnboardingCompleted && isPaired) {
            SetupStep.DASHBOARD
        } else if (isPaired) {
            SetupStep.SETUP_OVERVIEW
        } else {
            SetupStep.SIGN_IN
        }

        refreshSimList()

        // Start background call recording service if paired
        if (isPaired) {
            CallRecordingService.start(this)
        }

        val db = AppDatabase.getDatabase(this)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    val callsList by db.callDao().getAllCallsFlow().collectAsState(initial = emptyList())
                    val userName = prefs.getString(KEY_PAIRED_USER, "AFTAB SEKH") ?: "AFTAB SEKH"
                    val orgName = prefs.getString(KEY_PAIRED_ORG, "YOLOPMENT") ?: "YOLOPMENT"
                    val serverUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, "http://192.168.1.40:5001") ?: "http://192.168.1.40:5001"
                    val workSimName = prefs.getString(KEY_WORK_SIM_NAME, "All SIMs") ?: "All SIMs"

                    AnimatedContent(
                        targetState = currentStep,
                        transitionSpec = {
                            fadeIn() togetherWith fadeOut()
                        },
                        label = "onboarding_navigation"
                    ) { step ->
                        when (step) {
                            SetupStep.SIGN_IN -> {
                                SignInScreen(
                                    initialServerUrl = serverUrl,
                                    initialToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: "",
                                    isLoading = isSigningIn,
                                    onSignIn = { email, pass, url ->
                                        loginWithCredentials(email, pass, url)
                                    },
                                    onPairWithToken = { url, token ->
                                        pairWithToken(url, token)
                                    }
                                )
                            }
                            SetupStep.SETUP_OVERVIEW -> {
                                SetupOverviewScreen(
                                    onGetStarted = {
                                        currentStep = SetupStep.STEP_CALL_TRACKING
                                    }
                                )
                            }
                            SetupStep.STEP_CALL_TRACKING -> {
                                StepCallTrackingScreen(
                                    onAllow = {
                                        requestCallTrackingPermissions()
                                    },
                                    onSignOut = {
                                        signOut()
                                    }
                                )
                            }
                            SetupStep.STEP_NOTIFICATIONS -> {
                                StepNotificationsScreen(
                                    onAllow = {
                                        requestNotificationPermissions()
                                    },
                                    onSkip = {
                                        currentStep = SetupStep.STEP_WORK_SIM
                                    }
                                )
                            }
                            SetupStep.STEP_WORK_SIM -> {
                                val hasPhonePermission = ContextCompat.checkSelfPermission(
                                    this@MainActivity,
                                    Manifest.permission.READ_PHONE_STATE
                                ) == PackageManager.PERMISSION_GRANTED

                                StepWorkSimScreen(
                                    hasPhonePermission = hasPhonePermission,
                                    simCards = detectedSims,
                                    selectedSimSlot = selectedSimSlot,
                                    onRequestPhonePermission = {
                                        phoneStatePermissionLauncher.launch(
                                            arrayOf(
                                                Manifest.permission.READ_PHONE_STATE,
                                                Manifest.permission.READ_PHONE_NUMBERS
                                            )
                                        )
                                    },
                                    onSelectSim = { slot ->
                                        selectedSimSlot = slot
                                        val simName = if (slot == -1) "All SIMs" else "SIM ${slot + 1}"
                                        prefs.edit()
                                            .putInt(KEY_WORK_SIM_SLOT, slot)
                                            .putString(KEY_WORK_SIM_NAME, simName)
                                            .apply()
                                        currentStep = SetupStep.SETUP_COMPLETE
                                    }
                                )
                            }
                            SetupStep.SETUP_COMPLETE -> {
                                SetupCompleteScreen(
                                    onContinue = {
                                        currentStep = SetupStep.IMPORT_CALLS
                                    },
                                    onKeepRunningClick = {
                                        requestBatteryWhitelist()
                                    }
                                )
                            }
                            SetupStep.IMPORT_CALLS -> {
                                ImportRecentCallsScreen(
                                    isImporting = isImporting,
                                    importStatusText = importStatusText,
                                    onImportLast30Days = {
                                        importCallHistory(30)
                                    },
                                    onImportLast7Days = {
                                        importCallHistory(7)
                                    },
                                    onNotNow = {
                                        finishOnboarding()
                                    }
                                )
                            }
                            SetupStep.DASHBOARD -> {
                                CompanionDashboardScreen(
                                    userName = userName,
                                    orgName = orgName,
                                    serverUrl = serverUrl,
                                    workSimName = workSimName,
                                    recentCalls = callsList,
                                    onSyncNow = {
                                        triggerManualSync()
                                    },
                                    onReviewPermissions = {
                                        currentStep = SetupStep.SETUP_COMPLETE
                                    },
                                    onSignOut = {
                                        signOut()
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    private fun refreshSimList() {
        detectedSims = SimManagerHelper.getActiveSimCards(this)
    }

    private fun requestCallTrackingPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_CONTACTS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        callTrackingPermissionLauncher.launch(permissions.toTypedArray())
    }

    private fun requestNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            currentStep = SetupStep.STEP_WORK_SIM
        }
    }

    private fun loginWithCredentials(email: String, pass: String, serverUrl: String) {
        isSigningIn = true
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val cleanUrl = serverUrl.trimEnd('/')
                val payload = JSONObject().apply {
                    put("email", email.trim())
                    put("password", pass.trim())
                }

                val request = Request.Builder()
                    .url("$cleanUrl/api/v1/auth/login")
                    .header("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (!response.isSuccessful) {
                    val errorMsg = try {
                        JSONObject(responseBody).optString("error", "Login failed")
                    } catch (e: Exception) {
                        "HTTP ${response.code}"
                    }
                    withContext(Dispatchers.Main) {
                        isSigningIn = false
                        Toast.makeText(this@MainActivity, "❌ $errorMsg", Toast.LENGTH_LONG).show()
                    }
                    return@launch
                }

                val json = JSONObject(responseBody)
                val userObj = json.getJSONObject("user")
                val orgObj = json.getJSONObject("organization")
                val deviceToken = userObj.optString("deviceToken", "")
                val userName = userObj.optString("name", "User")
                val orgName = orgObj.optString("name", "Organization")

                // Save auth & server configuration
                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                    .putString(SyncWorker.KEY_DEVICE_TOKEN, deviceToken)
                    .putString(KEY_PAIRED_USER, userName)
                    .putString(KEY_PAIRED_ORG, orgName)
                    .putBoolean(KEY_IS_PAIRED, true)
                    .apply()

                // Register device with backend
                pairDeviceHardware(cleanUrl, deviceToken, userName, orgName)

                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    CallRecordingService.start(this@MainActivity)
                    Toast.makeText(this@MainActivity, "✅ Welcome back, $userName!", Toast.LENGTH_SHORT).show()
                    currentStep = SetupStep.SETUP_OVERVIEW
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    Toast.makeText(this@MainActivity, "❌ Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun pairWithToken(serverUrl: String, token: String) {
        isSigningIn = true
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val cleanUrl = serverUrl.trimEnd('/')
                val cleanToken = token.trim()

                val hardwareId = "hw-android-${Build.MANUFACTURER.lowercase()}-${Build.MODEL.lowercase()}"
                val payload = JSONObject().apply {
                    put("deviceToken", cleanToken)
                    put("deviceHardwareId", hardwareId)
                    put("deviceName", "${Build.MANUFACTURER} · ${Build.MODEL}")
                    put("androidVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                    put("appVersion", "v1.7.54")
                    put("batteryLevel", 95)
                }

                val request = Request.Builder()
                    .url("$cleanUrl/api/v1/devices/pair")
                    .header("Content-Type", "application/json")
                    .post(payload.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (!response.isSuccessful) {
                    val errorMsg = try {
                        JSONObject(responseBody).optString("error", "Pairing failed")
                    } catch (e: Exception) {
                        "HTTP ${response.code}"
                    }
                    withContext(Dispatchers.Main) {
                        isSigningIn = false
                        Toast.makeText(this@MainActivity, "❌ $errorMsg", Toast.LENGTH_LONG).show()
                    }
                    return@launch
                }

                val json = JSONObject(responseBody)
                val userObj = json.getJSONObject("user")
                val userName = userObj.getString("name")
                val orgName = userObj.getString("organization")

                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                    .putString(SyncWorker.KEY_DEVICE_TOKEN, cleanToken)
                    .putString(KEY_PAIRED_USER, userName)
                    .putString(KEY_PAIRED_ORG, orgName)
                    .putBoolean(KEY_IS_PAIRED, true)
                    .apply()

                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    CallRecordingService.start(this@MainActivity)
                    Toast.makeText(this@MainActivity, "✅ Paired to $userName!", Toast.LENGTH_SHORT).show()
                    currentStep = SetupStep.SETUP_OVERVIEW
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    Toast.makeText(this@MainActivity, "❌ Connection error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun pairDeviceHardware(cleanUrl: String, deviceToken: String, userName: String, orgName: String) {
        try {
            val hardwareId = "hw-android-${Build.MANUFACTURER.lowercase()}-${Build.MODEL.lowercase()}"
            val payload = JSONObject().apply {
                put("deviceToken", deviceToken)
                put("deviceHardwareId", hardwareId)
                put("deviceName", "${Build.MANUFACTURER} · ${Build.MODEL}")
                put("androidVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                put("appVersion", "v1.7.54")
                put("batteryLevel", 90)
            }

            val request = Request.Builder()
                .url("$cleanUrl/api/v1/devices/pair")
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            httpClient.newCall(request).execute()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun importCallHistory(days: Int) {
        isImporting = true
        importStatusText = "Importing call history from last $days days..."

        lifecycleScope.launch {
            val result = CallLogImporter.importRecentCalls(this@MainActivity, days, selectedSimSlot)
            isImporting = false

            result.onSuccess { count ->
                Toast.makeText(this@MainActivity, "✅ Imported $count calls to CRM!", Toast.LENGTH_LONG).show()
                finishOnboarding()
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Notice: ${err.message}", Toast.LENGTH_SHORT).show()
                finishOnboarding()
            }
        }
    }

    private fun finishOnboarding() {
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
        CallRecordingService.start(this)
        currentStep = SetupStep.DASHBOARD
    }

    private fun triggerManualSync() {
        lifecycleScope.launch {
            Toast.makeText(this@MainActivity, "Syncing calls with CRM...", Toast.LENGTH_SHORT).show()
            val result = CallLogImporter.importRecentCalls(this@MainActivity, 3, selectedSimSlot)
            result.onSuccess { count ->
                Toast.makeText(this@MainActivity, "Synced! $count calls updated.", Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(this@MainActivity, "Sync completed.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun signOut() {
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_IS_PAIRED, false)
            .putBoolean(KEY_ONBOARDING_COMPLETED, false)
            .apply()
        currentStep = SetupStep.SIGN_IN
    }

    private fun requestBatteryWhitelist() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    startActivity(intent)
                }
            } else {
                Toast.makeText(this, "Battery optimization already disabled! ✓", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
