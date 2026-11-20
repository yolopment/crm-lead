package com.crmlead.companion.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Menu
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PermissionsScreen(
    onOpenDrawer: () -> Unit,
    onRequestStorageAccess: () -> Unit,
    onRequestBatteryWhitelist: () -> Unit,
    onNavigateToSim: () -> Unit
) {
    val context = LocalContext.current

    val hasCallLog = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
    val hasPhoneState = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
    val hasNotifications = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    } else true

    val hasStorage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
    } else true

    val hasBattery = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        pm?.isIgnoringBatteryOptimizations(context.packageName) == true
    } else true

    val hasContacts = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Permissions", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = TextDark)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ScreenBackground)
            )
        },
        containerColor = ScreenBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // Banner: Everything is working
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7).copy(alpha = 0.7f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(BrandGreen),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Everything is working",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = Color(0xFF14532D)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Permissions Card (6 rows)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Row 1: Call tracking
                    PermissionRow(
                        icon = "📞",
                        title = "Call tracking",
                        subtitle = "Saving your work calls",
                        statusText = if (hasCallLog && hasPhoneState) "✓ On" else "Off",
                        isGood = hasCallLog && hasPhoneState,
                        onClick = {
                            openAppSettings(context)
                        }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    // Row 2: Call recordings
                    PermissionRow(
                        icon = "|||",
                        title = "Call recordings",
                        subtitle = "Attaching automatically",
                        statusText = if (hasStorage) "✓ Working ›" else "Grant ›",
                        isGood = hasStorage,
                        onClick = onRequestStorageAccess
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    // Row 3: Notifications
                    PermissionRow(
                        icon = "🔔",
                        title = "Notifications",
                        subtitle = "Alerts if syncing stops",
                        statusText = if (hasNotifications) "✓ On" else "Off",
                        isGood = hasNotifications,
                        onClick = {
                            openAppSettings(context)
                        }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    // Row 4: Keep LeadZam running
                    PermissionRow(
                        icon = "⚡",
                        title = "Keep LeadZam running",
                        subtitle = "Calls sync right away",
                        statusText = if (hasBattery) "✓ On" else "Setup ›",
                        isGood = hasBattery,
                        onClick = onRequestBatteryWhitelist
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    // Row 5: Contacts
                    PermissionRow(
                        icon = "👤",
                        title = "Contacts",
                        subtitle = "Only needed for some phones",
                        statusText = if (hasContacts) "✓ On ›" else "⊖ Optional ›",
                        isGood = true,
                        isOptional = !hasContacts,
                        onClick = {
                            openAppSettings(context)
                        }
                    )

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    // Row 6: Work SIM
                    PermissionRow(
                        icon = "📶",
                        title = "Work SIM",
                        subtitle = "Saving calls from your work SIM",
                        statusText = "✓ On ›",
                        isGood = true,
                        onClick = onNavigateToSim
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Tap any row to fix it. Steps this phone or workspace doesn't need are hidden.",
                fontSize = 12.sp,
                color = TextSubtle,
                lineHeight = 16.sp,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}

@Composable
fun PermissionRow(
    icon: String,
    title: String,
    subtitle: String,
    statusText: String,
    isGood: Boolean,
    isOptional: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(36.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(icon, fontSize = 18.sp)
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
            Text(subtitle, fontSize = 12.sp, color = TextSubtle)
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(
                    when {
                        isOptional -> Color(0xFFF1F5F9)
                        isGood -> Color(0xFFDCFCE7)
                        else -> Color(0xFFFEE2E2)
                    }
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = statusText,
                color = when {
                    isOptional -> TextSubtle
                    isGood -> BrandGreen
                    else -> BrandRed
                },
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp
            )
        }
    }
}

private fun openAppSettings(context: Context) {
    try {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "Cannot open settings", Toast.LENGTH_SHORT).show()
    }
}

