package com.crmlead.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.data.CallEntity
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
    callsList: List<CallEntity>,
    userName: String,
    userRole: String = "AGENT",
    onOpenDrawer: () -> Unit
) {
    val isAgent = userRole.equals("AGENT", ignoreCase = true)
    var selectedTab by remember { mutableStateOf(0) } // 0 = My numbers, 1 = Team
    val effectiveTab = if (isAgent) 0 else selectedTab
    var selectedRangeIndex by remember { mutableStateOf(0) } // 0 = 7 days, 1 = 30 days, 2 = 12 weeks, etc.
    val ranges = listOf("7 days", "30 days", "12 weeks", "This month", "Custom")

    // Filter calls based on selected range (default: 7 days)
    val daysCutoff = when (selectedRangeIndex) {
        0 -> 7
        1 -> 30
        2 -> 84
        3 -> 30
        else -> 7
    }

    val cutoffTime = remember(daysCutoff) {
        val cal = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, -daysCutoff)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
        }
        cal.timeInMillis
    }

    val periodCalls = remember(callsList, cutoffTime) {
        callsList.filter { it.startedAt >= cutoffTime }
    }

    // Compute Metrics
    val totalCalls = periodCalls.size
    val totalTalkTimeSec = periodCalls.sumOf { it.durationSec }
    val connectedCalls = periodCalls.count { it.status == "CONNECTED" }
    val connectRate = if (totalCalls > 0) ((connectedCalls * 100) / totalCalls) else 0

    val talkTimeFormatted = remember(totalTalkTimeSec) {
        val m = totalTalkTimeSec / 60
        val s = totalTalkTimeSec % 60
        "${m}m ${s}s"
    }

    val avgHandleTimeSec = if (connectedCalls > 0) (totalTalkTimeSec / connectedCalls) else 0
    val avgHandleFormatted = remember(avgHandleTimeSec) {
        val m = avgHandleTimeSec / 60
        val s = avgHandleTimeSec % 60
        "${m}m ${s}s"
    }

    val uniqueContacts = periodCalls.map { it.phoneNumber }.distinct().size
    val missedCount = periodCalls.count { it.status == "MISSED" }

    // Breakdown: Inbound vs Outbound
    val outboundCalls = periodCalls.filter { it.direction.equals("OUTBOUND", ignoreCase = true) }
    val outboundConnected = outboundCalls.count { it.status == "CONNECTED" }
    val outboundNoAnswer = outboundCalls.size - outboundConnected

    val inboundCalls = periodCalls.filter { it.direction.equals("INBOUND", ignoreCase = true) }
    val inboundAnswered = inboundCalls.count { it.status == "CONNECTED" }
    val inboundMissed = inboundCalls.count { it.status == "MISSED" }

    // 7-day Bar Chart Calculation
    val daysOfWeek = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    val dailyCounts = remember(periodCalls) {
        val counts = IntArray(7) { 0 }
        val cal = Calendar.getInstance()
        periodCalls.forEach { call ->
            cal.timeInMillis = call.startedAt
            val dayOfWeek = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7 // Monday = 0
            if (dayOfWeek in 0..6) {
                counts[dayOfWeek]++
            }
        }
        counts.toList()
    }
    val maxDaily = (dailyCounts.maxOrNull() ?: 1).coerceAtLeast(5)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Analytics", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                        Text("Synced CRM call intelligence", fontSize = 12.sp, color = TextSubtle)
                    }
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
                .verticalScroll(rememberScrollState())
        ) {
            if (!isAgent) {
                // Segmented Tab Selector for Admins
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFE2E8F0))
                        .padding(3.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (selectedTab == 0) Color.White else Color.Transparent)
                                .clickable { selectedTab = 0 }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "My numbers",
                                fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedTab == 0) BrandBlue else TextSubtle,
                                fontSize = 13.sp
                            )
                        }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (selectedTab == 1) Color.White else Color.Transparent)
                                .clickable { selectedTab = 1 }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Team",
                                fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedTab == 1) BrandBlue else TextSubtle,
                                fontSize = 13.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
            }

            // Time Range Pill Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ranges.forEachIndexed { index, label ->
                    val isSelected = selectedRangeIndex == index
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (isSelected) Color.White else Color(0xFFF1F5F9))
                            .border(1.dp, if (isSelected) BrandBlue else Color.Transparent, RoundedCornerShape(16.dp))
                            .clickable { selectedRangeIndex = index }
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = label,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) BrandBlue else TextSubtle
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            if (effectiveTab == 0) {
                // TAB 1: MY NUMBERS

                // Card 1: Your overview
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.QueryStats, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Your Overview", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        }
                        Spacer(modifier = Modifier.height(14.dp))

                        // Row 1
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("CALLS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(totalCalls.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("TALK TIME", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(talkTimeFormatted, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("CONNECT RATE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text("$connectRate%", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Row 2
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("AVG HANDLE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(avgHandleFormatted, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                            }
                            Column {
                                Text("PEOPLE CALLED", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(uniqueContacts.toString(), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                            }
                            Column {
                                Text("MISSED", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(missedCount.toString(), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = BrandRed)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Card 2: Calls per day · last 7 days (Bar Chart)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Calls Per Day", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                            Text("Last 7 days", fontSize = 11.sp, color = TextSubtle)
                        }
                        Spacer(modifier = Modifier.height(20.dp))

                        // Render Bar Chart
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            dailyCounts.forEachIndexed { i, count ->
                                val heightFrac = (count.toFloat() / maxDaily).coerceIn(0.12f, 1f)
                                val isToday = i == dailyCounts.size - 1

                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = count.toString(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (isToday) BrandBlue else TextSubtle
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Box(
                                        modifier = Modifier
                                            .width(24.dp)
                                            .fillMaxHeight(heightFrac)
                                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                            .background(if (isToday) BrandBlue else Color(0xFFBFDBFE))
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = daysOfWeek[i],
                                        fontSize = 11.sp,
                                        fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isToday) TextDark else TextSubtle
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Card 3: Outbound Breakdown
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Outbound Performance", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Total Calls", fontSize = 13.sp, color = TextSubtle)
                            Text(outboundCalls.size.toString(), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextDark)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Connected", fontSize = 13.sp, color = TextSubtle)
                            Text(outboundConnected.toString(), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = BrandGreen)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("No Answer / Unreachable", fontSize = 13.sp, color = TextSubtle)
                            Text(outboundNoAnswer.toString(), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextDark)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Card 4: Inbound Breakdown
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Inbound Performance", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Answered Calls", fontSize = 13.sp, color = TextSubtle)
                            Text(inboundAnswered.toString(), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = BrandGreen)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Missed Calls", fontSize = 13.sp, color = TextSubtle)
                            Text(inboundMissed.toString(), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = BrandRed)
                        }
                    }
                }
            } else {
                // TAB 2: TEAM
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.TrendingUp, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Team Overview", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        }
                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("CALLS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(totalCalls.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("TALK TIME", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text(talkTimeFormatted, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("ACTIVE MEMBERS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextSubtle, letterSpacing = 0.5.sp)
                                Text("1", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Leaderboard Section
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Leaderboard, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Rep Leaderboard", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFEFF6FF))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("All", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("Inbound", color = TextSubtle, fontSize = 11.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("Outbound", color = TextSubtle, fontSize = 11.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Member Ranking Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("1", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(userName, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)
                                Spacer(modifier = Modifier.width(6.dp))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(Color(0xFFEFF6FF))
                                        .padding(horizontal = 6.dp, vertical = 1.dp)
                                ) {
                                    Text("You", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                            }
                            Text(
                                text = "$talkTimeFormatted talk · $connectRate% connect",
                                fontSize = 11.sp,
                                color = TextSubtle
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "$totalCalls calls",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                                color = TextDark
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
