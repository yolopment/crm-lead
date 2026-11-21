package com.crmlead.companion.ui.screens

import android.os.Build
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.R
import com.crmlead.companion.data.CallEntity
import com.crmlead.companion.sim.SimInfo

// --- Colors matching LeadZam Design System ---
val BrandBlue = Color(0xFF2563EB)
val BrandBlueDark = Color(0xFF1D4ED8)
val BrandRed = Color(0xFFDC2626)
val BrandGreen = Color(0xFF16A34A)
val TextDark = Color(0xFF0F172A)
val TextMuted = Color(0xFF475569)
val TextSubtle = Color(0xFF64748B)
val BorderLight = Color(0xFFE2E8F0)
val CardBackground = Color.White
val ScreenBackground = Color(0xFFF8FAFC)

// --- Reusable Progress Indicator (Step X of 3) ---
@Composable
fun StepProgressHeader(currentStep: Int, totalSteps: Int = 3) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            for (i in 1..totalSteps) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (i <= currentStep) BrandBlue else Color(0xFFE2E8F0))
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Step $currentStep of $totalSteps",
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = TextSubtle
        )
    }
}

// --- Illustration: Phone with Red/Blue Action Pill ---
@Composable
fun PhoneCallIllustration(
    isCallStep: Boolean = false,
    isCallingStep: Boolean = false,
    isNotificationStep: Boolean = false
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp),
        contentAlignment = Alignment.Center
    ) {
        // Outer stylized phone outline
        Box(
            modifier = Modifier
                .width(180.dp)
                .height(160.dp)
                .border(2.dp, Color(0xFFE2E8F0), RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(Color(0xFFF1F5F9).copy(alpha = 0.5f), RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
        )

        // Horizontal pill row
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Left contact pill
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .height(28.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFE2E8F0)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(16.dp))
            }

            Spacer(modifier = Modifier.width(10.dp))

            // Center highlighted pill
            if (isCallStep || isCallingStep) {
                Box(
                    modifier = Modifier
                        .width(130.dp)
                        .height(38.dp)
                        .clip(RoundedCornerShape(19.dp))
                        .background(BrandRed),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            if (isCallingStep) Icons.Default.CallMade else Icons.Default.Phone,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .width(50.dp)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(Color.White.copy(alpha = 0.8f))
                        )
                    }
                }
            } else if (isNotificationStep) {
                Box(
                    modifier = Modifier
                        .width(130.dp)
                        .height(38.dp)
                        .clip(RoundedCornerShape(19.dp))
                        .background(BrandBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .width(50.dp)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(Color.White.copy(alpha = 0.8f))
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            // Right bell / action pill
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .height(28.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFE2E8F0)),
                contentAlignment = Alignment.Center
            ) {
                Text(if (isCallStep || isCallingStep) "🔔" else "📱", fontSize = 12.sp)
            }
        }
    }
}

// ==========================================
// SCREEN 1: SIGN IN SCREEN
// ==========================================
@Composable
fun SignInScreen(
    initialEmail: String = "",
    initialServerUrl: String = "https://staffcaller.cloud",
    initialToken: String = "",
    isLoading: Boolean,
    onSignIn: (email: String, pass: String, serverUrl: String) -> Unit,
    onPairWithToken: (serverUrl: String, token: String) -> Unit
) {
    var email by remember { mutableStateOf(initialEmail.ifEmpty { "yolopment@gmail.com" }) }
    var password by remember { mutableStateOf("admin123") }
    var passwordVisible by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf(initialServerUrl) }
    var deviceToken by remember { mutableStateOf(initialToken) }
    var showServerConfig by remember { mutableStateOf(false) }
    var useTokenPairing by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // StaffCaller Logo
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.app_logo),
                contentDescription = "StaffCaller Logo",
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "StaffCaller",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Main Login Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Text(
                    text = if (useTokenPairing) "Pair Device" else "Sign in",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextDark
                )
                Text(
                    text = if (useTokenPairing) "Enter device token from CRM dashboard" else "Use your workspace credentials",
                    fontSize = 14.sp,
                    color = TextSubtle,
                    modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                )

                if (!useTokenPairing) {
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            Text(
                                text = if (passwordVisible) "👁" else "👁‍🗨",
                                modifier = Modifier
                                    .clickable { passwordVisible = !passwordVisible }
                                    .padding(8.dp)
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                } else {
                    OutlinedTextField(
                        value = deviceToken,
                        onValueChange = { deviceToken = it },
                        label = { Text("Device Pairing Token") },
                        placeholder = { Text("e.g. c89fae019b88231c") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                // Collapsible Server URL option
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showServerConfig = !showServerConfig }
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Server: ${serverUrl.replace("http://", "").replace("https://", "")}",
                        fontSize = 12.sp,
                        color = TextSubtle
                    )
                    Text(
                        text = if (showServerConfig) "▲" else "▼",
                        fontSize = 10.sp,
                        color = TextSubtle
                    )
                }

                if (showServerConfig) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("Server URL") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = {
                        if (useTokenPairing) {
                            onPairWithToken(serverUrl, deviceToken)
                        } else {
                            onSignIn(email, password, serverUrl)
                        }
                    },
                    enabled = !isLoading && (
                        (useTokenPairing && deviceToken.isNotBlank()) ||
                        (!useTokenPairing && email.isNotBlank() && password.isNotBlank())
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Signing in...", fontWeight = FontWeight.SemiBold)
                    } else {
                        Text(
                            text = if (useTokenPairing) "Connect Device" else "Sign in",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f).height(1.dp).background(BorderLight))
                    Text(
                        text = "or",
                        modifier = Modifier.padding(horizontal = 12.dp),
                        fontSize = 13.sp,
                        color = TextSubtle
                    )
                    Box(modifier = Modifier.weight(1f).height(1.dp).background(BorderLight))
                }

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedButton(
                    onClick = {
                        useTokenPairing = !useTokenPairing
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(10.dp),
                    border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.linearGradient(listOf(BorderLight, BorderLight)))
                ) {
                    Text(
                        text = if (useTokenPairing) "Sign in with Credentials" else "Sign in with Pairing Token",
                        color = TextDark,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

// ==========================================
// SCREEN 2: SETUP OVERVIEW SCREEN
// ==========================================
@Composable
fun SetupOverviewScreen(
    onGetStarted: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp)
    ) {
        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Set up LeadZam on this\nphone",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark,
            lineHeight = 32.sp
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "A few quick steps so your calls and recordings sync on their own.",
            fontSize = 15.sp,
            color = TextMuted,
            lineHeight = 22.sp
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Steps counter header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "3 steps on this phone",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = TextDark
            )
            Text(
                text = "About 1 minute",
                fontSize = 13.sp,
                color = TextSubtle
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 3-Step Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Step 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("1", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Call tracking", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                        Text("Save every work call", fontSize = 13.sp, color = TextSubtle)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFFEE2E2))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text("Required", color = BrandRed, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Step 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("2", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Calling", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                        Text("Start calls from the StaffCaller website", fontSize = 13.sp, color = TextSubtle)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFFEE2E2))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text("Required", color = BrandRed, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Step 3
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("3", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Notifications", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                        Text("Know if syncing stops", fontSize = 13.sp, color = TextSubtle)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFFEF3C7))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text("Recommended", color = Color(0xFFD97706), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = onGetStarted,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            Text("Get started", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

// ==========================================
// SCREEN 3 & 4: STEP 1 OF 3 (CALL TRACKING)
// ==========================================
@Composable
fun StepCallTrackingScreen(
    onAllow: () -> Unit,
    onSignOut: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StepProgressHeader(currentStep = 1, totalSteps = 3)

        Spacer(modifier = Modifier.height(16.dp))

        // Phone call illustration
        PhoneCallIllustration(isCallStep = true)

        Spacer(modifier = Modifier.height(16.dp))

        // Badge: Required
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFFFEE2E2))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text("Required", color = BrandRed, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Turn on call tracking",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "LeadZam needs your call history to save your work calls automatically.",
            fontSize = 14.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Info Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Sees the number, time and length of each call",
                        fontSize = 14.sp,
                        color = TextDark
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color(0xFFF1F5F9))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Block, contentDescription = null, tint = BrandRed, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Never listens to or records your calls",
                        fontSize = 14.sp,
                        color = TextDark
                    )
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = onAllow,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandRed)
        ) {
            Text("Allow", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(8.dp))

        TextButton(onClick = onSignOut) {
            Text("Sign out", color = TextSubtle, fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "🔒 Only work calls are synced.",
            fontSize = 12.sp,
            color = TextSubtle
        )

        Spacer(modifier = Modifier.height(12.dp))
    }
}

// ==========================================
// SCREEN 4B: STEP 2 OF 3 (ALLOW CALLING)
// ==========================================
@Composable
fun StepAllowCallingScreen(
    onAllow: () -> Unit,
    onLater: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StepProgressHeader(currentStep = 2, totalSteps = 3)

        Spacer(modifier = Modifier.height(16.dp))

        // Phone call illustration with CallMade icon
        PhoneCallIllustration(isCallingStep = true)

        Spacer(modifier = Modifier.height(16.dp))

        // Badge: Required
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFFFEE2E2))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text("Required", color = BrandRed, fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Allow calling",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "When you tap Call on the StaffCaller website, this phone dials the number for you straight away.",
            fontSize = 14.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Info Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "It only dials when you start a call from StaffCaller",
                        fontSize = 14.sp,
                        color = TextDark
                    )
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = onAllow,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandRed)
        ) {
            Text("Allow", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(8.dp))

        TextButton(onClick = onLater) {
            Text("I'll do this later", color = TextSubtle, fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "🔒 Only work calls are synced.",
            fontSize = 12.sp,
            color = TextSubtle
        )

        Spacer(modifier = Modifier.height(12.dp))
    }
}

// ==========================================
// SCREEN 5 & 6: STEP 3 OF 3 (NOTIFICATIONS)
// ==========================================
@Composable
fun StepNotificationsScreen(
    onAllow: () -> Unit,
    onSkip: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StepProgressHeader(currentStep = 3, totalSteps = 3)

        Spacer(modifier = Modifier.height(16.dp))

        PhoneCallIllustration(isCallStep = false, isNotificationStep = true)

        Spacer(modifier = Modifier.height(16.dp))

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFFFEF3C7))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text("Recommended", color = Color(0xFFD97706), fontWeight = FontWeight.Bold, fontSize = 12.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Turn on notifications",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "We'll let you know if call syncing stops or a follow-up is due.",
            fontSize = 14.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = onAllow,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            Text("Allow", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(8.dp))

        TextButton(onClick = onSkip) {
            Text("Skip", color = TextSubtle, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "🔒 Only work calls are synced.",
            fontSize = 12.sp,
            color = TextSubtle
        )

        Spacer(modifier = Modifier.height(12.dp))
    }
}

// ==========================================
// SCREEN 7, 8, 9: STEP 3 OF 3 (WORK SIM)
// ==========================================
@Composable
fun StepWorkSimScreen(
    hasPhonePermission: Boolean,
    simCards: List<SimInfo>,
    selectedSimSlot: Int,
    onRequestPhonePermission: () -> Unit,
    onSelectSim: (slot: Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StepProgressHeader(currentStep = 3, totalSteps = 3)

        Spacer(modifier = Modifier.height(16.dp))

        // Dual SIM chip illustration
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFFEFF6FF)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.SimCard, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(48.dp))
        }

        Spacer(modifier = Modifier.height(20.dp))

        if (!hasPhonePermission) {
            // Screen 7: Permission Request State
            Text(
                text = "Choose the SIM you use for\nwork",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark,
                textAlign = TextAlign.Center,
                lineHeight = 30.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "LeadZam is tracking calls on all SIMs.\nTo list the SIMs in this phone so you can choose one, LeadZam needs Phone access.",
                fontSize = 14.sp,
                color = TextMuted,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = onRequestPhonePermission,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
            ) {
                Text("Allow Phone access", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedButton(
                onClick = { onSelectSim(-1) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Track all SIMs", color = TextDark, fontWeight = FontWeight.Medium, fontSize = 15.sp)
            }
        } else {
            // Screen 9: SIM Selection List
            Text(
                text = "Which SIM should LeadZam\ntrack?",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark,
                textAlign = TextAlign.Center,
                lineHeight = 30.sp
            )

            Spacer(modifier = Modifier.height(20.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Option 1: All SIMs
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectSim(-1) }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedSimSlot == -1,
                            onClick = { onSelectSim(-1) },
                            colors = RadioButtonDefaults.colors(selectedColor = BrandBlue)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("All SIMs", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                            Text("Every call on this phone", fontSize = 13.sp, color = TextSubtle)
                        }
                        if (selectedSimSlot == -1) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFDCFCE7))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text("Tracking now", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        }
                    }

                    // Dynamically render SIM 1, SIM 2, etc.
                    val activeSims = if (simCards.isNotEmpty()) simCards else listOf(
                        SimInfo(0, 1, "SIM 1", "SIM 1"),
                        SimInfo(1, 2, "SIM 2", "SIM 2")
                    )

                    for (sim in activeSims) {
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelectSim(sim.slotIndex) }
                                .padding(vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selectedSimSlot == sim.slotIndex,
                                onClick = { onSelectSim(sim.slotIndex) },
                                colors = RadioButtonDefaults.colors(selectedColor = BrandBlue)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${sim.displayName} · ${sim.carrierName}",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                    color = TextDark
                                )
                                Text("Only track calls on slot ${sim.slotIndex + 1}", fontSize = 13.sp, color = TextSubtle)
                            }
                            if (selectedSimSlot == sim.slotIndex) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFDCFCE7))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text("Tracking now", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                    }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = { onSelectSim(selectedSimSlot) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
            ) {
                Text("Confirm Selection", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(Icons.Default.Lock, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Your data stays private & secure", fontSize = 12.sp, color = TextSubtle)
        }
        Text(
            text = "Only matched call activity is synced. Privacy Policy",
            fontSize = 11.sp,
            color = TextSubtle,
            modifier = Modifier.padding(top = 2.dp, bottom = 8.dp)
        )
    }
}

// ==========================================
// SCREEN 10: SETUP COMPLETE SCREEN
// ==========================================
@Composable
fun SetupCompleteScreen(
    onContinue: () -> Unit,
    onKeepRunningClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        // Checkmark badge in circle
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(Color(0xFFDCFCE7)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Check, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(36.dp))
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "You're all set",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "StaffCaller will sync your calls automatically.\nCheck status any time in Menu > Permissions.",
            fontSize = 14.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Permissions Status Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                // Row 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Phone, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Call tracking", fontWeight = FontWeight.Medium, fontSize = 15.sp, color = TextDark)
                    }
                    Text("✓ On", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Row 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Notifications", fontWeight = FontWeight.Medium, fontSize = 15.sp, color = TextDark)
                    }
                    Text("✓ On", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Row 3
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.GraphicEq, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Call recordings", fontWeight = FontWeight.Medium, fontSize = 15.sp, color = TextDark)
                    }
                    Text("✓ Working", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Row 4: Calling
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CallMade, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Calling", fontWeight = FontWeight.Medium, fontSize = 15.sp, color = TextDark)
                    }
                    Text("✓ On", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 14.dp), color = Color(0xFFF1F5F9))

                // Row 5
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onKeepRunningClick() },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Bolt, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Keep StaffCaller running", fontWeight = FontWeight.Medium, fontSize = 15.sp, color = TextDark)
                    }
                    Text("✓ On", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = onContinue,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            Text("Continue", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

// ==========================================
// SCREEN 11: IMPORT RECENT CALLS SCREEN
// ==========================================
@Composable
fun ImportRecentCallsScreen(
    isImporting: Boolean,
    importStatusText: String,
    onImportLast30Days: () -> Unit,
    onImportLast7Days: () -> Unit,
    onNotNow: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        // History Clock / Calendar Illustration
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFFEFF6FF)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.History, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(42.dp))
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Import your recent calls?",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = TextDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "We can add your recent call history so your timeline isn't empty. Imported calls show as a log only — recordings aren't available for calls from before setup.",
            fontSize = 14.sp,
            color = TextMuted,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )

        Spacer(modifier = Modifier.weight(1f))

        if (isImporting) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(36.dp),
                    color = BrandBlue,
                    strokeWidth = 3.dp
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = importStatusText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextDark
                )
            }
        } else {
            Button(
                onClick = onImportLast30Days,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
            ) {
                Text("Import last 30 days", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedButton(
                onClick = onImportLast7Days,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Import last 7 days", color = BrandBlue, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }

            Spacer(modifier = Modifier.height(8.dp))

            TextButton(onClick = onNotNow) {
                Text("Not now", color = TextSubtle, fontSize = 15.sp)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

// ==========================================
// SCREEN 12: MAIN CRM COMPANION DASHBOARD
// ==========================================
@Composable
fun CompanionDashboardScreen(
    userName: String,
    orgName: String,
    serverUrl: String,
    workSimName: String,
    recentCalls: List<CallEntity>,
    isStorageAccessGranted: Boolean,
    isSyncingRecordings: Boolean,
    syncProgressStatus: String,
    onSyncNow: () -> Unit,
    onSyncRecordings: () -> Unit,
    onRequestStorageAccess: () -> Unit,
    onUpdateServerUrl: (newUrl: String) -> Unit,
    onReviewPermissions: () -> Unit,
    onSignOut: () -> Unit
) {
    var showServerDialog by remember { mutableStateOf(false) }
    var tempServerUrl by remember { mutableStateOf(serverUrl) }

    if (showServerDialog) {
        AlertDialog(
            onDismissRequest = { showServerDialog = false },
            title = {
                Text("Change Server / Wi-Fi IP", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
            },
            text = {
                Column {
                    Text(
                        text = "Enter your current local Wi-Fi IP or Hostinger server domain. If you changed Wi-Fi, update the IP here.",
                        fontSize = 13.sp,
                        color = TextMuted,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                    OutlinedTextField(
                        value = tempServerUrl,
                        onValueChange = { tempServerUrl = it },
                        label = { Text("Server URL") },
                        placeholder = { Text("https://staffcaller.cloud") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (tempServerUrl.isNotBlank()) {
                            onUpdateServerUrl(tempServerUrl.trim())
                            showServerDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                ) {
                    Text("Save & Connect")
                }
            },
            dismissButton = {
                TextButton(onClick = { showServerDialog = false }) {
                    Text("Cancel", color = TextSubtle)
                }
            }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(20.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = R.drawable.app_logo),
                    contentDescription = "StaffCaller Logo",
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "StaffCaller",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextDark
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFDCFCE7))
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(BrandGreen))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Connected", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Storage Permission Alert Banner (if needed for Vivo recordings)
        if (!isStorageAccessGranted) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onRequestStorageAccess() },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.linearGradient(listOf(Color(0xFFFCD34D), Color(0xFFFCD34D))))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Enable Recording File Access",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF92400E)
                        )
                        Text(
                            text = "Tap to grant storage permission so StaffCaller can auto-fetch Vivo call audio.",
                            fontSize = 12.sp,
                            color = Color(0xFFB45309)
                        )
                    }
                    Text(
                        text = "Grant",
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFB45309),
                        fontSize = 13.sp
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        // Live Health Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7).copy(alpha = 0.5f)),
            border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.linearGradient(listOf(Color(0xFF86EFAC), Color(0xFF86EFAC))))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(BrandGreen))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Service Ready & Monitoring", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextDark)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Calls & recordings auto-sync for $userName ($orgName).",
                    fontSize = 13.sp,
                    color = TextMuted
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Server IP & Wi-Fi row
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("CONNECTED SERVER", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle)
                    Text(
                        text = serverUrl.replace("http://", "").replace("https://", ""),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextDark
                    )
                }
                OutlinedButton(
                    onClick = {
                        tempServerUrl = serverUrl
                        showServerDialog = true
                    },
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("Change IP", fontSize = 11.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Diagnostic Grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("WORK SIM", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSubtle)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(workSimName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                }
            }
            Card(
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("RECORDINGS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSubtle)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (isStorageAccessGranted) "🟢 Ready" else "🟡 Need Perm",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isStorageAccessGranted) BrandGreen else Color(0xFFD97706)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // PRIMARY ACTION BUTTON: Scan & Sync Call Recordings
        Button(
            onClick = onSyncRecordings,
            enabled = !isSyncingRecordings,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
        ) {
            if (isSyncingRecordings) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (syncProgressStatus.isNotBlank()) syncProgressStatus else "Scanning Recordings...",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.GraphicEq, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Scan & Sync Call Recordings", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Secondary Action Buttons Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedButton(
                onClick = onSyncNow,
                modifier = Modifier.weight(1f).height(40.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Sync Call Logs", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextDark)
            }
            OutlinedButton(
                onClick = onReviewPermissions,
                modifier = Modifier.weight(1f).height(40.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Permissions", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextDark)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Call Timeline Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Recent Calls Timeline", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
            Text("${recentCalls.size} calls", fontSize = 12.sp, color = TextSubtle)
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (recentCalls.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(CardBackground),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.PhoneCallback, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(36.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No calls logged yet", fontWeight = FontWeight.Medium, color = TextSubtle)
                    Text("Calls will appear here automatically", fontSize = 12.sp, color = TextSubtle)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(recentCalls) { call ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(containerColor = CardBackground),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (call.direction.equals("INBOUND", ignoreCase = true)) Icons.Default.CallReceived else Icons.Default.CallMade,
                                contentDescription = call.direction,
                                tint = if (call.status == "MISSED") BrandRed else BrandBlue,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(call.phoneNumber, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = TextDark)
                                Text(
                                    text = "${call.direction} · ${call.durationSec}s · ${call.status}",
                                    fontSize = 12.sp,
                                    color = TextSubtle
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                if (call.audioFilePath != null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = if (call.isAudioUploaded) Icons.Default.Mic else Icons.Default.Schedule,
                                            contentDescription = null,
                                            tint = if (call.isAudioUploaded) BrandGreen else Color(0xFFD97706),
                                            modifier = Modifier.size(12.dp)
                                        )
                                        Spacer(modifier = Modifier.width(2.dp))
                                        Text(
                                            text = if (call.isAudioUploaded) "Recorded" else "Audio Pending",
                                            color = if (call.isAudioUploaded) BrandGreen else Color(0xFFD97706),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                } else {
                                    Text("No rec.", color = TextSubtle, fontSize = 11.sp)
                                }
                                if (call.isSynced) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(10.dp))
                                        Spacer(modifier = Modifier.width(2.dp))
                                        Text("Synced", color = BrandGreen, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        TextButton(
            onClick = onSignOut,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text("Switch Account / Sign out", color = TextSubtle, fontSize = 12.sp)
        }
    }
}


