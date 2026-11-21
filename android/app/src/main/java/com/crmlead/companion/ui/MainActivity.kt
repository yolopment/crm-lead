package com.crmlead.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.crmlead.companion.data.AppDatabase
import com.crmlead.companion.importer.CallLogImporter
import com.crmlead.companion.service.CallRecordingService
import com.crmlead.companion.sim.SimInfo
import com.crmlead.companion.sim.SimManagerHelper
import com.crmlead.companion.sync.RecordingSyncManager
import com.crmlead.companion.sync.SyncWorker
import com.crmlead.companion.telemetry.DeviceTelemetryHelper
import com.crmlead.companion.ui.navigation.AppNavScreen
import com.crmlead.companion.ui.navigation.StaffCallerDrawerContent
import com.crmlead.companion.ui.screens.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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
    STEP_ALLOW_CALLING,
    STEP_NOTIFICATIONS,
    STEP_WORK_SIM,
    SETUP_COMPLETE,
    IMPORT_CALLS,
    MAIN_APP
}

class MainActivity : ComponentActivity() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    companion object {
        const val KEY_PAIRED_USER = "paired_user"
        const val KEY_PAIRED_ROLE = "paired_role"
        const val KEY_PAIRED_ORG = "paired_org"
        const val KEY_IS_PAIRED = "is_paired"
        const val KEY_ONBOARDING_COMPLETED = "onboarding_completed"
        const val KEY_WORK_SIM_SLOT = "work_sim_slot"
        const val KEY_WORK_SIM_NAME = "work_sim_name"
        const val DEFAULT_SERVER_URL = "https://staffcaller.cloud"
    }

    // Permission Launchers
    private val callTrackingPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.values.all { it }
        if (granted) {
            Toast.makeText(this, "Call tracking enabled!", Toast.LENGTH_SHORT).show()
        }
        currentStep = SetupStep.STEP_ALLOW_CALLING
    }

    private val callingPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            Toast.makeText(this, "Remote calling enabled!", Toast.LENGTH_SHORT).show()
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
    ) {
        refreshSimList()
    }

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        isStorageAccessGranted = checkStorageAccess()
    }

    private var currentStep by mutableStateOf(SetupStep.SIGN_IN)
    private var currentNavScreen by mutableStateOf(AppNavScreen.CALLS)
    private var targetLeadQuery by mutableStateOf("")
    private var isSigningIn by mutableStateOf(false)
    private var isImporting by mutableStateOf(false)
    private var importStatusText by mutableStateOf("")
    private var isBackgroundImporting by mutableStateOf(false)
    private var backgroundImportStatusText by mutableStateOf("")
    private var showImportPrompt by mutableStateOf(false)
    private var isSyncingRecordings by mutableStateOf(false)
    private var isStorageAccessGranted by mutableStateOf(false)
    private var detectedSims by mutableStateOf<List<SimInfo>>(emptyList())
    private var selectedSimSlot by mutableStateOf(-1)
    private var serverUrlState by mutableStateOf(DEFAULT_SERVER_URL)
    private var showServerChangeDialog by mutableStateOf(false)
    private var showGoogleAuthDialog by mutableStateOf(false)
    private var tempServerUrl by mutableStateOf(DEFAULT_SERVER_URL)
    private var userRoleState by mutableStateOf("AGENT")

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleAuthIntent(intent)
    }

    private fun handleAuthIntent(intent: Intent?) {
        val data = intent?.data ?: return
        val token = data.getQueryParameter("google_token") ?: data.getQueryParameter("token")
        if (!token.isNullOrBlank()) {
            showGoogleAuthDialog = false
            loginWithGoogleToken(token, serverUrlState)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        userRoleState = prefs.getString(KEY_PAIRED_ROLE, "AGENT") ?: "AGENT"

        // Check for any Google OAuth redirect token
        handleAuthIntent(intent)

        // Automatic Server Migration to staffcaller.cloud
        var currentSavedUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        if (currentSavedUrl.contains("192.168.") || currentSavedUrl.contains("localhost")) {
            currentSavedUrl = DEFAULT_SERVER_URL
            prefs.edit().putString(SyncWorker.KEY_SERVER_URL, currentSavedUrl).apply()
        }
        serverUrlState = currentSavedUrl
        tempServerUrl = currentSavedUrl

        val isOnboardingCompleted = prefs.getBoolean(KEY_ONBOARDING_COMPLETED, false)
        val isPaired = prefs.getBoolean(KEY_IS_PAIRED, false)
        selectedSimSlot = prefs.getInt(KEY_WORK_SIM_SLOT, -1)
        val permissionsGranted = areEssentialPermissionsGranted()

        val hasImported = prefs.getBoolean("has_imported_calls", false)
        val dismissedPrompt = prefs.getBoolean("dismissed_import_prompt", false)
        showImportPrompt = !hasImported && !dismissedPrompt

        currentStep = if (isPaired && (isOnboardingCompleted || permissionsGranted)) {
            if (!isOnboardingCompleted) {
                prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
            }
            SetupStep.MAIN_APP
        } else if (isPaired) {
            SetupStep.SETUP_OVERVIEW
        } else {
            SetupStep.SIGN_IN
        }

        refreshSimList()
        isStorageAccessGranted = checkStorageAccess()

        // Start background call recording service & report telemetry if paired
        if (isPaired) {
            CallRecordingService.start(this)
            val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
            if (devToken.isNotEmpty()) {
                lifecycleScope.launch(Dispatchers.IO) {
                    pairDeviceHardware(currentSavedUrl, devToken)
                }
            }
        }

        val db = AppDatabase.getDatabase(this)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    val callsList by db.callDao().getAllCallsFlow().collectAsState(initial = emptyList())
                    val userName = prefs.getString(KEY_PAIRED_USER, "Agent") ?: "Agent"
                    val orgName = prefs.getString(KEY_PAIRED_ORG, "StaffCaller") ?: "StaffCaller"

                    // Server Change Dialog
                    if (showServerChangeDialog) {
                        AlertDialog(
                            onDismissRequest = { showServerChangeDialog = false },
                            title = {
                                Text("Change Wi-Fi / Server IP", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                            },
                            text = {
                                Column {
                                    Text(
                                        text = "Enter current server URL (e.g. https://staffcaller.cloud)",
                                        fontSize = 13.sp,
                                        color = TextMuted,
                                        modifier = Modifier.padding(bottom = 12.dp)
                                    )
                                    OutlinedTextField(
                                        value = tempServerUrl,
                                        onValueChange = { tempServerUrl = it },
                                        label = { Text("Server URL") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                }
                            },
                            confirmButton = {
                                Button(
                                    onClick = {
                                        updateServerUrl(tempServerUrl)
                                        showServerChangeDialog = false
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                                ) {
                                    Text("Save & Connect")
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = { showServerChangeDialog = false }) {
                                    Text("Cancel", color = TextSubtle)
                                }
                            }
                        )
                    }

                    // Google OAuth In-App Web Dialog
                    if (showGoogleAuthDialog) {
                        Dialog(
                            onDismissRequest = { showGoogleAuthDialog = false },
                            properties = DialogProperties(usePlatformDefaultWidth = false)
                        ) {
                            Surface(
                                modifier = Modifier.fillMaxSize(),
                                color = Color.White
                            ) {
                                Column(modifier = Modifier.fillMaxSize()) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 16.dp, vertical = 12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                                    ) {
                                        Text("Sign in with Google", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = TextDark)
                                        IconButton(onClick = { showGoogleAuthDialog = false }) {
                                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextDark)
                                        }
                                    }
                                    HorizontalDivider(color = BorderLight)
                                    AndroidView(
                                        modifier = Modifier.fillMaxSize(),
                                        factory = { ctx ->
                                            WebView(ctx).apply {
                                                settings.javaScriptEnabled = true
                                                settings.domStorageEnabled = true
                                                settings.setSupportZoom(false)
                                                webViewClient = object : WebViewClient() {
                                                    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                                        val uri = request?.url ?: return false
                                                        val urlStr = uri.toString()
                                                        val token = uri.getQueryParameter("google_token") ?: uri.getQueryParameter("token")
                                                        if (!token.isNullOrBlank()) {
                                                            showGoogleAuthDialog = false
                                                            loginWithGoogleToken(token, serverUrlState)
                                                            return true
                                                        }
                                                        if (urlStr.startsWith("staffcaller://")) {
                                                            val customToken = uri.getQueryParameter("token") ?: uri.getQueryParameter("google_token")
                                                            if (!customToken.isNullOrBlank()) {
                                                                showGoogleAuthDialog = false
                                                                loginWithGoogleToken(customToken, serverUrlState)
                                                                return true
                                                            }
                                                        }
                                                        return false
                                                    }
                                                }
                                                loadUrl("${serverUrlState.trimEnd('/')}/api/v1/auth/google")
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Background listener for Web-to-Phone remote calling ("Allow Calling" feature)
                    LaunchedEffect(currentStep, serverUrlState) {
                        if (currentStep == SetupStep.MAIN_APP) {
                            while (true) {
                                try {
                                    val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
                                    if (devToken.isNotEmpty() && serverUrlState.isNotEmpty()) {
                                        val req = Request.Builder()
                                            .url("${serverUrlState.trimEnd('/')}/api/v1/calls/pending-dial")
                                            .header("x-device-token", devToken)
                                            .header("Authorization", "Device $devToken")
                                            .get()
                                            .build()

                                        val resp = withContext(Dispatchers.IO) {
                                            try { httpClient.newCall(req).execute() } catch (e: Exception) { null }
                                        }

                                        if (resp != null && resp.isSuccessful) {
                                            val bodyStr = resp.body?.string() ?: ""
                                            val json = JSONObject(bodyStr)
                                            val pending = json.optJSONObject("pendingDial")
                                            if (pending != null) {
                                                val rawPhone = pending.optString("phoneNumber", "").trim()
                                                val cleanPhone = rawPhone.filter { it.isDigit() || it == '+' }
                                                if (cleanPhone.isNotEmpty()) {
                                                    withContext(Dispatchers.Main) {
                                                        Toast.makeText(this@MainActivity, "📞 Calling $cleanPhone from StaffCaller web...", Toast.LENGTH_SHORT).show()
                                                        val hasCallPerm = androidx.core.content.ContextCompat.checkSelfPermission(
                                                            this@MainActivity,
                                                            android.Manifest.permission.CALL_PHONE
                                                        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                                                        val dialAction = if (hasCallPerm) Intent.ACTION_CALL else Intent.ACTION_DIAL
                                                        val dialIntent = Intent(dialAction, Uri.fromParts("tel", cleanPhone, null)).apply {
                                                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                                        }
                                                        startActivity(dialIntent)
                                                    }

                                                    // Mark complete on server
                                                    withContext(Dispatchers.IO) {
                                                        try {
                                                            val compReq = Request.Builder()
                                                                .url("${serverUrlState.trimEnd('/')}/api/v1/calls/dial-complete")
                                                                .header("x-device-token", devToken)
                                                                .header("Authorization", "Device $devToken")
                                                                .post("{}".toRequestBody("application/json".toMediaType()))
                                                                .build()
                                                            httpClient.newCall(compReq).execute()
                                                        } catch (e: Exception) {
                                                            e.printStackTrace()
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    // Ignore background polling network glitches
                                }
                                delay(3500)
                            }
                        }
                    }

                    if (currentStep == SetupStep.MAIN_APP) {
                        // FULL MAIN STAFFCALLER APP WITH NAVIGATION DRAWER
                        val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
                        val scope = rememberCoroutineScope()

                        ModalNavigationDrawer(
                            drawerState = drawerState,
                            drawerContent = {
                                StaffCallerDrawerContent(
                                    currentScreen = currentNavScreen,
                                    userName = userName,
                                    orgName = orgName,
                                    userRole = userRoleState,
                                    onNavigate = { screen ->
                                        currentNavScreen = screen
                                        scope.launch { drawerState.close() }
                                    },
                                    onSignOut = {
                                        scope.launch { drawerState.close() }
                                        signOut()
                                    }
                                )
                            }
                        ) {
                            when (currentNavScreen) {
                                AppNavScreen.CALLS -> {
                                    val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
                                    CallsScreen(
                                        callsList = callsList,
                                        serverUrl = serverUrlState,
                                        token = devToken,
                                        userName = userName,
                                        userRole = userRoleState,
                                        currentSimSlot = selectedSimSlot,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onCheckNewRecordings = { syncRecordingsWithBackend() },
                                        onRetrySync = { triggerManualSync() },
                                        onChangeWifiIp = { showServerChangeDialog = true },
                                        onOpenLead = { leadPhone ->
                                            targetLeadQuery = leadPhone
                                            currentNavScreen = AppNavScreen.LEADS
                                        },
                                        isBackgroundImporting = isBackgroundImporting,
                                        backgroundImportStatus = backgroundImportStatusText,
                                        showImportPrompt = showImportPrompt,
                                        onImportRecentCalls = { days -> startBackgroundCallImport(days) },
                                        onDismissImportPrompt = {
                                            showImportPrompt = false
                                            prefs.edit().putBoolean("dismissed_import_prompt", true).apply()
                                        },
                                        onLeadCreated = { phone, name ->
                                            lifecycleScope.launch(Dispatchers.IO) {
                                                db.callDao().updateContactNameByPhone(phone, name)
                                            }
                                        }
                                    )
                                }
                                AppNavScreen.LEADS -> {
                                    val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
                                    LeadsScreen(
                                        serverUrl = serverUrlState,
                                        token = devToken,
                                        userRole = userRoleState,
                                        initialSearchQuery = targetLeadQuery,
                                        onOpenDrawer = { scope.launch { drawerState.open() } }
                                    )
                                }
                                AppNavScreen.FOLLOW_UPS -> {
                                    val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
                                    FollowupsScreen(
                                        serverUrl = serverUrlState,
                                        token = devToken,
                                        userRole = userRoleState,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onBrowseLeads = { currentNavScreen = AppNavScreen.LEADS }
                                    )
                                }
                                AppNavScreen.WHATSAPP -> {
                                    LaunchedEffect(Unit) {
                                        try {
                                            val waIntent = packageManager.getLaunchIntentForPackage("com.whatsapp")
                                                ?: Intent(Intent.ACTION_VIEW, Uri.parse("https://api.whatsapp.com"))
                                            startActivity(waIntent)
                                        } catch (e: Exception) {
                                            Toast.makeText(this@MainActivity, "WhatsApp not installed", Toast.LENGTH_SHORT).show()
                                        }
                                        currentNavScreen = AppNavScreen.CALLS
                                    }
                                }
                                AppNavScreen.ANALYTICS -> {
                                    AnalyticsScreen(
                                        callsList = callsList,
                                        userName = userName,
                                        userRole = userRoleState,
                                        onOpenDrawer = { scope.launch { drawerState.open() } }
                                    )
                                }
                                AppNavScreen.SIM_CALLING -> {
                                    SimCallingScreen(
                                        currentSimSlot = selectedSimSlot,
                                        simCards = detectedSims,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onSaveSimSelection = { slot ->
                                            selectedSimSlot = slot
                                            val simName = if (slot == -1) "All SIMs" else "SIM ${slot + 1}"
                                            prefs.edit()
                                                .putInt(KEY_WORK_SIM_SLOT, slot)
                                                .putString(KEY_WORK_SIM_NAME, simName)
                                                .apply()

                                            // Purge local calls from other SIMs if user switched to a single SIM
                                            lifecycleScope.launch(Dispatchers.IO) {
                                                if (slot != -1) {
                                                    db.callDao().deleteCallsFromOtherSimSlots(slot)
                                                }
                                            }

                                            Toast.makeText(this@MainActivity, "Tracking $simName · Other calls remain private", Toast.LENGTH_SHORT).show()
                                        }
                                    )
                                }
                                AppNavScreen.PERMISSIONS -> {
                                    PermissionsScreen(
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onRequestStorageAccess = { requestStorageAccess() },
                                        onRequestBatteryWhitelist = { requestBatteryWhitelist() },
                                        onNavigateToSim = { currentNavScreen = AppNavScreen.SIM_CALLING }
                                    )
                                }
                                AppNavScreen.SETTINGS -> {
                                    SettingsScreen(
                                        serverUrl = serverUrlState,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onChangeServerUrl = { showServerChangeDialog = true },
                                        onSignOut = { signOut() },
                                        onImportRecentCalls = { days -> startBackgroundCallImport(days) }
                                    )
                                }
                            }
                        }
                    } else {
                        // ONBOARDING & SETUP MULTI-STEP FLOW
                        AnimatedContent(
                            targetState = currentStep,
                            transitionSpec = { fadeIn() togetherWith fadeOut() },
                            label = "onboarding_navigation"
                        ) { step ->
                            when (step) {
                                SetupStep.SIGN_IN -> {
                                    SignInScreen(
                                        initialServerUrl = serverUrlState,
                                        initialToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: "",
                                        isLoading = isSigningIn,
                                        onSignIn = { email, pass, url ->
                                            serverUrlState = url
                                            loginWithCredentials(email, pass, url)
                                        },
                                        onPairWithToken = { url, token ->
                                            serverUrlState = url
                                            pairWithToken(url, token)
                                        },
                                        onGoogleSignIn = {
                                            showGoogleAuthDialog = true
                                        }
                                    )
                                }
                                SetupStep.SETUP_OVERVIEW -> {
                                    SetupOverviewScreen(
                                        onGetStarted = { currentStep = SetupStep.STEP_CALL_TRACKING }
                                    )
                                }
                                SetupStep.STEP_CALL_TRACKING -> {
                                    StepCallTrackingScreen(
                                        onAllow = { requestCallTrackingPermissions() },
                                        onSignOut = { signOut() }
                                    )
                                }
                                SetupStep.STEP_ALLOW_CALLING -> {
                                    StepAllowCallingScreen(
                                        onAllow = {
                                            callingPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
                                        },
                                        onLater = {
                                            currentStep = SetupStep.STEP_NOTIFICATIONS
                                        }
                                    )
                                }
                                SetupStep.STEP_NOTIFICATIONS -> {
                                    StepNotificationsScreen(
                                        onAllow = { requestNotificationPermissions() },
                                        onSkip = { currentStep = SetupStep.STEP_WORK_SIM }
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
                                        onContinue = { finishOnboarding() },
                                        onKeepRunningClick = { requestBatteryWhitelist() }
                                    )
                                }
                                SetupStep.IMPORT_CALLS -> {
                                    ImportRecentCallsScreen(
                                        isImporting = false,
                                        importStatusText = "",
                                        onImportLast30Days = {
                                            finishOnboarding()
                                            startBackgroundCallImport(30)
                                        },
                                        onImportLast7Days = {
                                            finishOnboarding()
                                            startBackgroundCallImport(7)
                                        },
                                        onNotNow = { finishOnboarding() }
                                    )
                                }
                                else -> {}
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        isStorageAccessGranted = checkStorageAccess()
        lifecycleScope.launch {
            com.crmlead.companion.contact.ContactHelper.syncContactNamesWithLocalDb(this@MainActivity)
        }
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        val isPaired = prefs.getBoolean(KEY_IS_PAIRED, false)
        val serverUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        val devToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: ""
        if (isPaired && devToken.isNotEmpty()) {
            lifecycleScope.launch(Dispatchers.IO) {
                DeviceTelemetryHelper.sendTelemetry(this@MainActivity, serverUrl, devToken)
            }
        }
    }

    private fun areEssentialPermissionsGranted(): Boolean {
        val hasCallLog = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
        val hasPhoneState = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
        return hasCallLog && hasPhoneState
    }

    private fun checkStorageAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestStorageAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                startActivity(intent)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            storagePermissionLauncher.launch(arrayOf(Manifest.permission.READ_MEDIA_AUDIO))
        } else {
            storagePermissionLauncher.launch(arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE))
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

    private fun updateServerUrl(newUrl: String) {
        val clean = newUrl.trimEnd('/')
        serverUrlState = clean
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(SyncWorker.KEY_SERVER_URL, clean).apply()
        Toast.makeText(this, "✅ Server updated to $clean", Toast.LENGTH_SHORT).show()
    }

    private fun syncRecordingsWithBackend() {
        if (!isStorageAccessGranted) {
            requestStorageAccess()
            return
        }

        isSyncingRecordings = true
        Toast.makeText(this, "Scanning phone for call recordings...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch {
            val result = RecordingSyncManager.scanAndSyncAllRecordings(this@MainActivity)
            isSyncingRecordings = false

            result.onSuccess { (matched, uploaded) ->
                Toast.makeText(
                    this@MainActivity,
                    "🎉 Matched $matched recordings · $uploaded uploaded to CRM!",
                    Toast.LENGTH_LONG
                ).show()
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Notice: ${err.message}", Toast.LENGTH_LONG).show()
            }
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
                val userRole = userObj.optString("role", "AGENT")
                val orgName = orgObj.optString("name", "Organization")

                // Save auth & server configuration
                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                    .putString(SyncWorker.KEY_DEVICE_TOKEN, deviceToken)
                    .putString(KEY_PAIRED_USER, userName)
                    .putString(KEY_PAIRED_ROLE, userRole)
                    .putString(KEY_PAIRED_ORG, orgName)
                    .putBoolean(KEY_IS_PAIRED, true)
                    .apply()

                userRoleState = userRole

                // Register device with backend
                pairDeviceHardware(cleanUrl, deviceToken)

                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    CallRecordingService.start(this@MainActivity)
                    Toast.makeText(this@MainActivity, "✅ Welcome back, $userName!", Toast.LENGTH_SHORT).show()
                    val alreadyGranted = areEssentialPermissionsGranted()
                    if (alreadyGranted) {
                        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
                        currentStep = SetupStep.MAIN_APP
                    } else {
                        currentStep = SetupStep.SETUP_OVERVIEW
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    Toast.makeText(this@MainActivity, "❌ Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun loginWithGoogleToken(token: String, serverUrl: String) {
        isSigningIn = true
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val cleanUrl = serverUrl.trimEnd('/')
                val request = Request.Builder()
                    .url("$cleanUrl/api/v1/auth/me")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (!response.isSuccessful) {
                    withContext(Dispatchers.Main) {
                        isSigningIn = false
                        Toast.makeText(this@MainActivity, "❌ Google Sign-In failed to fetch profile", Toast.LENGTH_LONG).show()
                    }
                    return@launch
                }

                val userObj = JSONObject(responseBody)
                val orgObj = userObj.optJSONObject("organization") ?: JSONObject()
                var deviceToken = userObj.optString("deviceToken", "")
                if (deviceToken.isBlank()) {
                    deviceToken = token.take(16)
                }
                val userName = userObj.optString("name", "User")
                val userRole = userObj.optString("role", "AGENT")
                val orgName = orgObj.optString("name", "Organization")

                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                    .putString(SyncWorker.KEY_DEVICE_TOKEN, deviceToken)
                    .putString("crm_auth_token", token)
                    .putString(KEY_PAIRED_USER, userName)
                    .putString(KEY_PAIRED_ROLE, userRole)
                    .putString(KEY_PAIRED_ORG, orgName)
                    .putBoolean(KEY_IS_PAIRED, true)
                    .apply()

                userRoleState = userRole

                pairDeviceHardware(cleanUrl, deviceToken)

                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    CallRecordingService.start(this@MainActivity)
                    Toast.makeText(this@MainActivity, "✅ Welcome back, $userName!", Toast.LENGTH_SHORT).show()
                    val alreadyGranted = areEssentialPermissionsGranted()
                    if (alreadyGranted) {
                        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
                        currentStep = SetupStep.MAIN_APP
                    } else {
                        currentStep = SetupStep.SETUP_OVERVIEW
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    Toast.makeText(this@MainActivity, "❌ Google Sign-In Error: ${e.message}", Toast.LENGTH_LONG).show()
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

                val payload = DeviceTelemetryHelper.getTelemetryPayload(this@MainActivity, cleanToken)

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
                val userRole = userObj.optString("role", "AGENT")

                val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit()
                    .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                    .putString(SyncWorker.KEY_DEVICE_TOKEN, cleanToken)
                    .putString(KEY_PAIRED_USER, userName)
                    .putString(KEY_PAIRED_ROLE, userRole)
                    .putString(KEY_PAIRED_ORG, orgName)
                    .putBoolean(KEY_IS_PAIRED, true)
                    .apply()

                userRoleState = userRole

                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    CallRecordingService.start(this@MainActivity)
                    Toast.makeText(this@MainActivity, "✅ Paired to $userName!", Toast.LENGTH_SHORT).show()
                    val alreadyGranted = areEssentialPermissionsGranted()
                    if (alreadyGranted) {
                        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
                        currentStep = SetupStep.MAIN_APP
                    } else {
                        currentStep = SetupStep.SETUP_OVERVIEW
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isSigningIn = false
                    Toast.makeText(this@MainActivity, "❌ Connection error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun pairDeviceHardware(cleanUrl: String, deviceToken: String) {
        try {
            val payload = DeviceTelemetryHelper.getTelemetryPayload(this, deviceToken)

            val request = Request.Builder()
                .url("$cleanUrl/api/v1/devices/pair")
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            val resp = httpClient.newCall(request).execute()
            if (resp.isSuccessful) {
                val respBody = resp.body?.string() ?: ""
                val json = JSONObject(respBody)
                val userObj = json.optJSONObject("user")
                if (userObj != null) {
                    val role = userObj.optString("role", "AGENT")
                    val name = userObj.optString("name", "")
                    val org = userObj.optString("organization", "")
                    val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                    val editor = prefs.edit().putString(KEY_PAIRED_ROLE, role)
                    if (name.isNotEmpty()) editor.putString(KEY_PAIRED_USER, name)
                    if (org.isNotEmpty()) editor.putString(KEY_PAIRED_ORG, org)
                    editor.apply()
                    userRoleState = role
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startBackgroundCallImport(days: Int) {
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean("has_imported_calls", true)
            .putBoolean("dismissed_import_prompt", true)
            .apply()
        showImportPrompt = false
        isBackgroundImporting = true
        backgroundImportStatusText = "Reading call history (last $days days)..."

        Toast.makeText(this, "⏳ Importing call history in background... You can keep using StaffCaller.", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val result = CallLogImporter.importRecentCalls(
                    context = this@MainActivity,
                    days = days,
                    workSimSlot = selectedSimSlot,
                    onProgress = { status ->
                        backgroundImportStatusText = status
                    }
                )
                withContext(Dispatchers.Main) {
                    isBackgroundImporting = false
                    result.onSuccess { count ->
                        Toast.makeText(this@MainActivity, "✅ Imported $count calls to CRM!", Toast.LENGTH_LONG).show()
                    }.onFailure { err ->
                        Toast.makeText(this@MainActivity, "Notice: ${err.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    isBackgroundImporting = false
                    Toast.makeText(this@MainActivity, "Import notice: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun finishOnboarding() {
        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_ONBOARDING_COMPLETED, true).apply()
        CallRecordingService.start(this)
        currentNavScreen = AppNavScreen.CALLS
        currentStep = SetupStep.MAIN_APP

        val hasImported = prefs.getBoolean("has_imported_calls", false)
        val dismissedPrompt = prefs.getBoolean("dismissed_import_prompt", false)
        showImportPrompt = !hasImported && !dismissedPrompt

        // Trigger recording scanner in background
        lifecycleScope.launch(Dispatchers.IO) {
            RecordingSyncManager.scanAndSyncAllRecordings(this@MainActivity)
        }
    }

    private fun triggerManualSync() {
        lifecycleScope.launch {
            Toast.makeText(this@MainActivity, "Syncing call logs with CRM...", Toast.LENGTH_SHORT).show()
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
            .remove(KEY_PAIRED_USER)
            .remove(KEY_PAIRED_ROLE)
            .remove(KEY_PAIRED_ORG)
            .remove(SyncWorker.KEY_DEVICE_TOKEN)
            .apply()
        userRoleState = "AGENT"
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
