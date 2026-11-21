package com.crmlead.companion.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.ui.screens.*

enum class AppNavScreen {
    CALLS,
    LEADS,
    FOLLOW_UPS,
    WHATSAPP,
    ANALYTICS,
    SIM_CALLING,
    PERMISSIONS,
    SETTINGS
}

@Composable
fun LeadZamDrawerContent(
    currentScreen: AppNavScreen,
    userName: String,
    orgName: String,
    onNavigate: (AppNavScreen) -> Unit,
    onSignOut: () -> Unit
) {
    ModalDrawerSheet(
        modifier = Modifier.width(300.dp),
        drawerContainerColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            // Brand & Version Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(BrandBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Phone,
                            contentDescription = "Logo",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "StaffCaller",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextDark,
                        letterSpacing = (-0.5).sp
                    )
                }

                Text(
                    text = "v1.7.54",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextSubtle
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // User Profile Card
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFF8FAFC))
                    .padding(12.dp)
            ) {
                val initials = userName.split(" ")
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .take(2)
                    .joinToString("")
                    .ifEmpty { "AS" }

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFEFF6FF)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = initials,
                        fontWeight = FontWeight.Bold,
                        color = BrandBlue,
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = userName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = TextDark
                    )
                    Text(
                        text = "Agent · $orgName",
                        fontSize = 11.sp,
                        color = TextSubtle,
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Tracking Calls Status Pill
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigate(AppNavScreen.PERMISSIONS) },
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(BrandGreen)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Live call monitoring active",
                            color = Color(0xFF166534),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp
                        )
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF166534), modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Main Navigation Items
            DrawerNavItem(
                icon = Icons.Default.Phone,
                label = "Calls",
                isSelected = currentScreen == AppNavScreen.CALLS,
                onClick = { onNavigate(AppNavScreen.CALLS) }
            )

            DrawerNavItem(
                icon = Icons.Default.People,
                label = "All Leads",
                isSelected = currentScreen == AppNavScreen.LEADS,
                onClick = { onNavigate(AppNavScreen.LEADS) }
            )

            DrawerNavItem(
                icon = Icons.Default.Schedule,
                label = "Follow-ups",
                isSelected = currentScreen == AppNavScreen.FOLLOW_UPS,
                onClick = { onNavigate(AppNavScreen.FOLLOW_UPS) }
            )

            DrawerNavItem(
                icon = Icons.Default.Chat,
                label = "WhatsApp",
                isSelected = currentScreen == AppNavScreen.WHATSAPP,
                onClick = { onNavigate(AppNavScreen.WHATSAPP) }
            )

            DrawerNavItem(
                icon = Icons.Default.QueryStats,
                label = "Analytics",
                isSelected = currentScreen == AppNavScreen.ANALYTICS,
                onClick = { onNavigate(AppNavScreen.ANALYTICS) }
            )

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "THIS DEVICE",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = TextSubtle,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )

            DrawerNavItem(
                icon = Icons.Default.Phone,
                label = "SIM & Calling",
                isSelected = currentScreen == AppNavScreen.SIM_CALLING,
                onClick = { onNavigate(AppNavScreen.SIM_CALLING) }
            )

            DrawerNavItem(
                icon = Icons.Default.Lock,
                label = "Permissions & Health",
                isSelected = currentScreen == AppNavScreen.PERMISSIONS,
                onClick = { onNavigate(AppNavScreen.PERMISSIONS) }
            )

            DrawerNavItem(
                icon = Icons.Default.Settings,
                label = "Settings",
                isSelected = currentScreen == AppNavScreen.SETTINGS,
                onClick = { onNavigate(AppNavScreen.SETTINGS) }
            )

            Spacer(modifier = Modifier.weight(1f))

            // Sign out
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onSignOut() }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.ExitToApp,
                    contentDescription = "Sign out",
                    tint = BrandRed,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Sign out",
                    color = BrandRed,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
fun DrawerNavItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) Color(0xFFEFF6FF) else Color.Transparent)
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (isSelected) BrandBlue else TextSubtle,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) BrandBlue else TextDark
        )
    }
}
