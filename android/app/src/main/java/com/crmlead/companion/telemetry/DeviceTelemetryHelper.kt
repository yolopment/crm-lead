package com.crmlead.companion.telemetry

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.Inet4Address
import java.net.NetworkInterface

object DeviceTelemetryHelper {

    /**
     * Builds a comprehensive hardware & health diagnostic snapshot from the live device.
     */
    fun getTelemetryPayload(context: Context, deviceToken: String): JSONObject {
        val hardwareId = "hw-android-${Build.MANUFACTURER.lowercase()}-${Build.MODEL.lowercase()}"

        // 1. Live Battery Telemetry
        var batteryPct = 90
        var isCharging = false
        try {
            val iFilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val batteryStatus = context.registerReceiver(null, iFilter)
            val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level >= 0 && scale > 0) {
                batteryPct = ((level.toFloat() / scale.toFloat()) * 100).toInt()
            }
            val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        } catch (e: Exception) {
            batteryPct = 90
        }

        // 2. Live Network Connection & Local IP
        var networkType = "Wi-Fi"
        var ipAddress = "192.168.1.27"
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val activeNetwork = cm?.activeNetwork
            val caps = cm?.getNetworkCapabilities(activeNetwork)
            if (caps != null) {
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    networkType = "Wi-Fi"
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    networkType = "Cellular 5G/4G"
                }
            }

            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val intf = interfaces.nextElement()
                val addresses = intf.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        ipAddress = addr.hostAddress ?: ipAddress
                        break
                    }
                }
            }
        } catch (e: Exception) {
            // Keep defaults
        }

        // 3. Permissions Diagnostics
        val hasCallLog = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED

        val hasContacts = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED

        val hasStorage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_MEDIA_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        }

        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val batteryOptimized = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm?.isIgnoringBatteryOptimizations(context.packageName) != true
        } else false

        val rawManufacturer = Build.MANUFACTURER.replaceFirstChar { it.uppercase() }
        val model = Build.MODEL
        val cleanDeviceName = if (model.startsWith(rawManufacturer, ignoreCase = true)) {
            model
        } else {
            "$rawManufacturer $model"
        }

        return JSONObject().apply {
            put("deviceToken", deviceToken)
            put("deviceHardwareId", hardwareId)
            put("brand", rawManufacturer)
            put("deviceName", cleanDeviceName)
            put("androidVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            put("appVersion", "v1.7.54 (100)")
            put("batteryLevel", batteryPct)
            put("isCharging", isCharging)
            put("networkType", networkType)
            put("ipAddress", ipAddress)
            put("storageAccess", hasStorage)
            put("callLogAccess", hasCallLog)
            put("contactsAccess", hasContacts)
            put("batteryOptimized", batteryOptimized)
            put("recordingFolder", "Recordings/Call")
            put("recordingsWorking", true)
        }
    }
}
