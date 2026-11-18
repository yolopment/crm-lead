package com.crmlead.companion.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.crmlead.companion.sim.SimInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SimCallingScreen(
    currentSimSlot: Int,
    simCards: List<SimInfo>,
    onOpenDrawer: () -> Unit,
    onSaveSimSelection: (slot: Int) -> Unit
) {
    val context = LocalContext.current
    var showChangeDialog by remember { mutableStateOf(false) }
    var tempSelectedSlot by remember { mutableStateOf(currentSimSlot) }

    val activeSimTitle = remember(currentSimSlot, simCards) {
        when {
            currentSimSlot == -1 -> "All SIMs"
            currentSimSlot < simCards.size -> "${simCards[currentSimSlot].displayName} · ${simCards[currentSimSlot].carrierName}"
            else -> "SIM ${currentSimSlot + 1}"
        }
    }

    if (showChangeDialog) {
        AlertDialog(
            onDismissRequest = { showChangeDialog = false },
            title = {
                Text(
                    text = "Which SIM should LeadZam track?",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TextDark
                )
            },
            text = {
                Column {
                    // Option 1: All SIMs
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { tempSelectedSlot = -1 }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = tempSelectedSlot == -1,
                            onClick = { tempSelectedSlot = -1 },
                            colors = RadioButtonDefaults.colors(selectedColor = BrandBlue)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("All SIMs", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                            Text("Every call on this phone", fontSize = 12.sp, color = TextSubtle)
                        }
                        if (tempSelectedSlot == -1) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFDCFCE7))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("Tracking now", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                            }
                        }
                    }

                    // Dynamically list detected SIMs
                    val displaySims = if (simCards.isNotEmpty()) simCards else listOf(
                        SimInfo(0, 1, "SIM 1", "SIM 1"),
                        SimInfo(1, 2, "SIM 2", "SIM 2")
                    )

                    displaySims.forEach { sim ->
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { tempSelectedSlot = sim.slotIndex }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = tempSelectedSlot == sim.slotIndex,
                                onClick = { tempSelectedSlot = sim.slotIndex },
                                colors = RadioButtonDefaults.colors(selectedColor = BrandBlue)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${sim.displayName} · ${sim.carrierName}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                                Text("Only calls on SIM ${sim.slotIndex + 1}", fontSize = 12.sp, color = TextSubtle)
                            }
                            if (tempSelectedSlot == sim.slotIndex) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFDCFCE7))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text("Tracking now", color = BrandGreen, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Calls on other SIMs stay on your phone.",
                        fontSize = 12.sp,
                        color = TextSubtle
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Can't find or identify your SIM?",
                        fontSize = 12.sp,
                        color = TextSubtle
                    )
                    Text(
                        text = "Identify using a quick test call",
                        color = BrandBlue,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .clickable {
                                try {
                                    val intent = Intent(Intent.ACTION_DIAL).apply {
                                        data = Uri.parse("tel:198")
                                    }
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Dialer unavailable", Toast.LENGTH_SHORT).show()
                                }
                            }
                            .padding(vertical = 4.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onSaveSimSelection(tempSelectedSlot)
                        showChangeDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showChangeDialog = false }) {
                    Text("Cancel", color = TextSubtle)
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("SIM & calling", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
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
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            Text("Tracked SIM", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
            Spacer(modifier = Modifier.height(10.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFEFF6FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("📶", fontSize = 20.sp)
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text("SIM selection", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        Text("Tracking $activeSimTitle", fontSize = 13.sp, color = TextSubtle)
                    }

                    OutlinedButton(
                        onClick = {
                            tempSelectedSlot = currentSimSlot
                            showChangeDialog = true
                        },
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Text("Change", fontSize = 13.sp, color = TextDark, fontWeight = FontWeight.Medium)
                    }

                    if (currentSimSlot != -1) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Track all SIMs",
                            color = BrandBlue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clickable { onSaveSimSelection(-1) }
                                .padding(4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "On a phone with two SIMs, choose the one you use for work. Calls on the other SIM are not tracked.",
                fontSize = 13.sp,
                color = TextMuted,
                lineHeight = 18.sp
            )
        }
    }
}
