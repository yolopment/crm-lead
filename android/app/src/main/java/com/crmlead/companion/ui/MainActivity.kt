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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.crmlead.companion.service.CallRecordingService
import com.crmlead.companion.sync.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    companion object {
        const val KEY_PAIRED_USER = "paired_user"
        const val KEY_PAIRED_ORG = "paired_org"
        const val KEY_IS_PAIRED = "is_paired"
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        if (allGranted) {
            Toast.makeText(this, "All permissions granted!", Toast.LENGTH_SHORT).show()
            CallRecordingService.start(this)
        } else {
            Toast.makeText(this, "Permissions needed for automatic call tracking.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    var isConnecting by remember { mutableStateOf(false) }
                    var pairedUser by remember { mutableStateOf(prefs.getString(KEY_PAIRED_USER, "") ?: "") }
                    var pairedOrg by remember { mutableStateOf(prefs.getString(KEY_PAIRED_ORG, "") ?: "") }
                    var isPaired by remember { mutableStateOf(prefs.getBoolean(KEY_IS_PAIRED, false)) }

                    CompanionScreen(
                        currentServerUrl = prefs.getString(SyncWorker.KEY_SERVER_URL, "http://192.168.1.40:5001") ?: "",
                        currentDeviceToken = prefs.getString(SyncWorker.KEY_DEVICE_TOKEN, "") ?: "",
                        isConnecting = isConnecting,
                        isPaired = isPaired,
                        pairedUser = pairedUser,
                        pairedOrg = pairedOrg,
                        onSaveSettings = { url, token ->
                            isConnecting = true
                            verifyAndPairDevice(url, token) { success, user, org, msg ->
                                isConnecting = false
                                if (success) {
                                    isPaired = true
                                    pairedUser = user
                                    pairedOrg = org
                                    Toast.makeText(this, "✅ $msg", Toast.LENGTH_LONG).show()
                                    CallRecordingService.start(this)
                                } else {
                                    isPaired = false
                                    Toast.makeText(this, "❌ $msg", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        onRequestPermissions = { requestAppPermissions() },
                        onRequestBatteryOptimization = { requestBatteryWhitelist() }
                    )
                }
            }
        }
    }

    private fun verifyAndPairDevice(
        serverUrl: String,
        deviceToken: String,
        onResult: (Boolean, String, String, String) -> Unit
    ) {
        val cleanUrl = serverUrl.trim().trimEnd('/')
        val cleanToken = deviceToken.trim()

        if (cleanUrl.isEmpty() || cleanToken.isEmpty()) {
            onResult(false, "", "", "Server URL and Device Token cannot be empty.")
            return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val hardwareId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                    ?: "${Build.MANUFACTURER}-${Build.MODEL}"

                val deviceName = "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}"
                val osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"

                val payload = JSONObject().apply {
                    put("deviceToken", cleanToken)
                    put("deviceHardwareId", hardwareId)
                    put("deviceName", deviceName)
                    put("androidVersion", osVersion)
                    put("appVersion", "1.0.0")
                }

                val body = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
                val request = Request.Builder()
                    .url("$cleanUrl/api/v1/devices/pair")
                    .post(body)
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseStr = response.body?.string() ?: "{}"
                val json = JSONObject(responseStr)

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && json.optBoolean("success", false)) {
                        val userObj = json.optJSONObject("user")
                        val userName = userObj?.optString("name", "Agent") ?: "Agent"
                        val orgName = userObj?.optString("organization", "CRM") ?: "CRM"

                        // Save to preferences
                        val prefs = getSharedPreferences(SyncWorker.PREFS_NAME, Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString(SyncWorker.KEY_SERVER_URL, cleanUrl)
                            .putString(SyncWorker.KEY_DEVICE_TOKEN, cleanToken)
                            .putString(KEY_PAIRED_USER, userName)
                            .putString(KEY_PAIRED_ORG, orgName)
                            .putBoolean(KEY_IS_PAIRED, true)
                            .apply()

                        onResult(true, userName, orgName, "Device successfully paired to $userName ($orgName)!")
                    } else {
                        val errorMsg = json.optString("error", "Pairing failed. Check pairing token.")
                        onResult(false, "", "", errorMsg)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onResult(false, "", "", "Could not reach server at $cleanUrl: ${e.localizedMessage ?: "Connection error"}")
                }
            }
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.CALL_PHONE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }

        permissionLauncher.launch(permissions.toTypedArray())
    }

    private fun requestBatteryWhitelist() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } else {
                Toast.makeText(this, "Battery optimization is already disabled.", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

@Composable
fun CompanionScreen(
    currentServerUrl: String,
    currentDeviceToken: String,
    isConnecting: Boolean,
    isPaired: Boolean,
    pairedUser: String,
    pairedOrg: String,
    onSaveSettings: (String, String) -> Unit,
    onRequestPermissions: () -> Unit,
    onRequestBatteryOptimization: () -> Unit
) {
    var serverUrl by remember { mutableStateOf(currentServerUrl) }
    var deviceToken by remember { mutableStateOf(currentDeviceToken) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header
        Text(
            text = "Lead CRM Companion",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF0F172A)
        )
        Text(
            text = "Automatic Call Tracking & Audio Sync",
            fontSize = 14.sp,
            color = Color(0xFF64748B),
            modifier = Modifier.padding(top = 4.dp, bottom = 24.dp)
        )

        // Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isPaired) Color(0xFFDCFCE7) else Color(0xFFFEF3C7)
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(
                            color = if (isPaired) Color(0xFF16A34A) else Color(0xFFD97706),
                            shape = RoundedCornerShape(6.dp)
                        )
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (isPaired) "Connected: $pairedUser" else "Device Not Connected",
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A)
                    )
                    Text(
                        text = if (isPaired) "Ready & monitoring calls for $pairedOrg" else "Enter valid pairing token from CRM dashboard",
                        fontSize = 12.sp,
                        color = Color(0xFF475569)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Device Pairing Form
        Text(
            text = "Server Configuration",
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it },
            label = { Text("Server URL") },
            placeholder = { Text("http://192.168.1.40:5001") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = deviceToken,
            onValueChange = { deviceToken = it },
            label = { Text("Device Pairing Token") },
            placeholder = { Text("From CRM Settings > Team") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { onSaveSettings(serverUrl, deviceToken) },
            enabled = !isConnecting && serverUrl.isNotEmpty() && deviceToken.isNotEmpty(),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            if (isConnecting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Connecting...")
            } else {
                Text(if (isPaired) "Reconnect & Refresh" else "Connect & Authorize")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Permission Actions
        Text(
            text = "Device Permissions",
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onRequestPermissions,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("Grant Call & Audio Permissions")
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onRequestBatteryOptimization,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("Disable Battery Optimization")
        }
    }
}
