package com.crmlead.companion.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.ui.screens.*

enum class AppNavScreen {
    CALLS,
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
                            .size(26.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(BrandBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("✓", color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Leadzam",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextDark
                    )
                }

                Text(
                    text = "v1.7.54",
                    fontSize = 12.sp,
                    color = TextSubtle
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // User Profile Section
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                val initials = userName.split(" ")
                    .mapNotNull { it.firstOrNull()?.toString() }
                    .take(2)
                    .joinToString("")
                    .ifEmpty { "AS" }

                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFEFF6FF)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = initials,
                        fontWeight = FontWeight.Bold,
                        color = BrandBlue,
                        fontSize = 16.sp
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = userName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = TextDark
                    )
                    Text(
                        text = "Admin · $orgName",
                        fontSize = 12.sp,
                        color = TextSubtle,
                        maxLines = 1
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Tracking Calls Status Pill
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigate(AppNavScreen.PERMISSIONS) },
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
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
                            text = "Tracking calls",
                            color = Color(0xFF166534),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp
                        )
                    }
                    Text("›", color = Color(0xFF166534), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Main Nav Items
            DrawerNavItem(
                icon = "📞",
                label = "Calls",
                isSelected = currentScreen == AppNavScreen.CALLS,
                onClick = { onNavigate(AppNavScreen.CALLS) }
            )

            DrawerNavItem(
                icon = "📈",
                label = "Analytics",
                isSelected = currentScreen == AppNavScreen.ANALYTICS,
                onClick = { onNavigate(AppNavScreen.ANALYTICS) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Group: This phone
            Text(
                text = "This phone",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSubtle,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )

            DrawerNavItem(
                icon = "📱",
                label = "SIM & calling",
                isSelected = currentScreen == AppNavScreen.SIM_CALLING,
                onClick = { onNavigate(AppNavScreen.SIM_CALLING) }
            )

            DrawerNavItem(
                icon = "🛡️",
                label = "Permissions",
                isSelected = currentScreen == AppNavScreen.PERMISSIONS,
                onClick = { onNavigate(AppNavScreen.PERMISSIONS) }
            )

            DrawerNavItem(
                icon = "⚙️",
                label = "Settings",
                isSelected = currentScreen == AppNavScreen.SETTINGS,
                onClick = { onNavigate(AppNavScreen.SETTINGS) }
            )

            Spacer(modifier = Modifier.weight(1f))

            // Sign out
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSignOut() }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🚪", fontSize = 16.sp)
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
    icon: String,
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
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 16.sp)
        Spacer(modifier = Modifier.width(14.dp))
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) BrandBlue else TextDark
        )
    }
}
