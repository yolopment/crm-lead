package com.crmlead.companion.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    serverUrl: String,
    onOpenDrawer: () -> Unit,
    onChangeServerUrl: () -> Unit,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    var appearanceMode by remember { mutableStateOf("System") }
    var captureScope by remember { mutableStateOf("All calls") }
    var showScopeDialog by remember { mutableStateOf(false) }

    if (showScopeDialog) {
        AlertDialog(
            onDismissRequest = { showScopeDialog = false },
            title = {
                Text("Capture Scope", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
            },
            text = {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { captureScope = "All calls"; showScopeDialog = false }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = captureScope == "All calls",
                            onClick = { captureScope = "All calls"; showScopeDialog = false }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("All calls", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("Every call on the device is captured", fontSize = 12.sp, color = TextSubtle)
                        }
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { captureScope = "Saved contacts only"; showScopeDialog = false }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = captureScope == "Saved contacts only",
                            onClick = { captureScope = "Saved contacts only"; showScopeDialog = false }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("Saved contacts only", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("Only calls with saved phone contacts", fontSize = 12.sp, color = TextSubtle)
                        }
                    }
                }
            },
            confirmButton = {}
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Settings", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Text("≡", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = TextDark)
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
                .verticalScroll(rememberScrollState())
        ) {
            // Workspace
            Text("Workspace", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            Toast.makeText(context, "Manage team on web dashboard: /dashboard/calls", Toast.LENGTH_SHORT).show()
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("👥", fontSize = 18.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Team", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        Text("Invite teammates and see their status", fontSize = 12.sp, color = TextSubtle)
                    }
                    Text("›", fontSize = 18.sp, color = TextSubtle)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Call tracking
            Text("Call tracking", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Box(
                                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("≡", fontSize = 18.sp)
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Capture scope", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                                Text(captureScope, fontSize = 12.sp, color = TextSubtle)
                            }
                        }
                        OutlinedButton(
                            onClick = { showScopeDialog = true },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("Change", fontSize = 12.sp, color = TextDark)
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                Toast.makeText(context, "Configured in Company Do-Not-Track list", Toast.LENGTH_SHORT).show()
                            },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🔒", fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Private numbers", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Text("1 number excluded", fontSize = 12.sp, color = TextSubtle)
                        }
                        Text("›", fontSize = 18.sp, color = TextSubtle)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Recordings
            Text("Recordings", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            Toast.makeText(context, "Watched: /storage/emulated/0/Recordings/Call", Toast.LENGTH_LONG).show()
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("📁", fontSize = 18.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Recording folders", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        Text("1 folder watched · Call", fontSize = 12.sp, color = TextSubtle)
                    }
                    Text("›", fontSize = 18.sp, color = TextSubtle)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Server & Wi-Fi Configuration
            Text("Server & Connection", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Box(
                            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🌐", fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("Server URL", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Text(serverUrl, fontSize = 12.sp, color = TextSubtle, maxLines = 1)
                        }
                    }
                    OutlinedButton(
                        onClick = onChangeServerUrl,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Text("Change IP", fontSize = 12.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // App updates
            Text("App updates", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(24.dp).clip(CircleShape).background(Color(0xFFDCFCE7)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("✓", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("LeadZam is up to date", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Text("You have 1.7.54 (100)", fontSize = 12.sp, color = TextSubtle)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedButton(
                        onClick = { Toast.makeText(context, "App is on the latest version (1.7.54)", Toast.LENGTH_SHORT).show() },
                        modifier = Modifier.fillMaxWidth().height(42.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Check for updates", color = TextDark, fontWeight = FontWeight.Medium, fontSize = 13.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // App
            Text("App", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextSubtle)
            Spacer(modifier = Modifier.height(6.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Appearance", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)

                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(2.dp)
                        ) {
                            listOf("System", "Light", "Dark").forEach { mode ->
                                val isSelected = appearanceMode == mode
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(if (isSelected) Color(0xFFEFF6FF) else Color.Transparent)
                                        .clickable { appearanceMode = mode }
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = mode,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) BrandBlue else TextSubtle
                                    )
                                }
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                Toast.makeText(context, "Support: yolopment@gmail.com", Toast.LENGTH_SHORT).show()
                            },
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🎧", fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Help & support", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Text("Contact us, or fix a problem with call tracking", fontSize = 12.sp, color = TextSubtle)
                        }
                        Text("›", fontSize = 18.sp, color = TextSubtle)
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Version", fontSize = 14.sp, color = TextSubtle)
                        Text("1.7.54 (100)", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = TextDark)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Sign out button
            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandRed)
            ) {
                Text("Sign out", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

