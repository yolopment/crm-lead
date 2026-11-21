package com.crmlead.companion.ui.screens

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.widget.Toast
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CallMade
import androidx.compose.material.icons.filled.CallMissed
import androidx.compose.material.icons.filled.CallReceived
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhoneCallback
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Stop
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.data.CallEntity
import java.text.SimpleDateFormat
import java.util.*

enum class CallDateFilter(val displayName: String) {
    TODAY("Today"),
    YESTERDAY("Yesterday"),
    THIS_WEEK("This week"),
    THIS_MONTH("This month"),
    ALL_TIME("All time"),
    CUSTOM("Custom date")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallsScreen(
    callsList: List<CallEntity>,
    serverUrl: String,
    token: String,
    userName: String,
    userRole: String = "AGENT",
    onOpenDrawer: () -> Unit,
    onCheckNewRecordings: () -> Unit,
    onRetrySync: () -> Unit,
    onChangeWifiIp: () -> Unit,
    onOpenLead: (String) -> Unit = {},
    isBackgroundImporting: Boolean = false,
    backgroundImportStatus: String = "",
    showImportPrompt: Boolean = false,
    onImportRecentCalls: (days: Int) -> Unit = {},
    onDismissImportPrompt: () -> Unit = {},
    onLeadCreated: (phone: String, name: String) -> Unit = { _, _ -> }
) {
    val context = LocalContext.current
    val isAgent = userRole.equals("AGENT", ignoreCase = true)
    var selectedCallForDetail by remember { mutableStateOf<CallEntity?>(null) }
    var selectedTab by remember { mutableStateOf(0) } // 0 = My calls, 1 = Team
    val effectiveTab = if (isAgent) 0 else selectedTab
    var showMenu by remember { mutableStateOf(false) }
    var showRepsSheet by remember { mutableStateOf(false) }
    var selectedRepFilter by remember { mutableStateOf("All reps") }
    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }
    var playingAudioCallId by remember { mutableStateOf<Long?>(null) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    // Date Filter State
    var selectedDateFilter by remember { mutableStateOf(CallDateFilter.TODAY) }
    var customDateTimestamp by remember { mutableStateOf(System.currentTimeMillis()) }
    var showDateDropdown by remember { mutableStateOf(false) }

    // Convert unlinked call to Lead state
    var callToConvertToLead by remember { mutableStateOf<CallEntity?>(null) }

    if (selectedCallForDetail != null) {
        CallDetailScreen(
            call = selectedCallForDetail!!,
            serverUrl = serverUrl,
            token = token,
            onBack = { selectedCallForDetail = null },
            onOpenLead = onOpenLead,
            onOutcomeSaved = { updated ->
                selectedCallForDetail = updated
            }
        )
        return
    }

    // Audio Playback cleanup
    DisposableEffect(Unit) {
        onDispose {
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    // Dynamic Date Range Calculation
    val (rangeStart, rangeEnd) = remember(selectedDateFilter, customDateTimestamp) {
        val cal = Calendar.getInstance()
        when (selectedDateFilter) {
            CallDateFilter.TODAY -> {
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val start = cal.timeInMillis
                val end = start + 86_400_000L - 1L
                Pair(start, end)
            }
            CallDateFilter.YESTERDAY -> {
                cal.add(Calendar.DAY_OF_YEAR, -1)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val start = cal.timeInMillis
                val end = start + 86_400_000L - 1L
                Pair(start, end)
            }
            CallDateFilter.THIS_WEEK -> {
                cal.set(Calendar.DAY_OF_WEEK, cal.firstDayOfWeek)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val start = cal.timeInMillis
                Pair(start, Long.MAX_VALUE)
            }
            CallDateFilter.THIS_MONTH -> {
                cal.set(Calendar.DAY_OF_MONTH, 1)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val start = cal.timeInMillis
                Pair(start, Long.MAX_VALUE)
            }
            CallDateFilter.ALL_TIME -> {
                Pair(0L, Long.MAX_VALUE)
            }
            CallDateFilter.CUSTOM -> {
                val c = Calendar.getInstance().apply {
                    timeInMillis = customDateTimestamp
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val start = c.timeInMillis
                val end = start + 86_400_000L - 1L
                Pair(start, end)
            }
        }
    }

    // Filter calls in the active date window
    val callsInDateRange = remember(callsList, rangeStart, rangeEnd) {
        callsList.filter { it.startedAt in rangeStart..rangeEnd }
    }

    // Dynamic Summary calculations for the selected filter
    val summaryCount = callsInDateRange.size
    val summaryTalkTimeSec = callsInDateRange.sumOf { it.durationSec }
    val summaryConnected = callsInDateRange.count { it.status == "CONNECTED" }
    val summaryConnectRate = if (summaryCount > 0) ((summaryConnected * 100) / summaryCount) else 0

    val formattedTalkTime = remember(summaryTalkTimeSec) {
        val m = summaryTalkTimeSec / 60
        val s = summaryTalkTimeSec % 60
        if (m > 0) "${m}m ${s}s" else "${s}s"
    }

    val dateFilterLabel = remember(selectedDateFilter, customDateTimestamp) {
        when (selectedDateFilter) {
            CallDateFilter.TODAY -> "Today"
            CallDateFilter.YESTERDAY -> "Yesterday"
            CallDateFilter.THIS_WEEK -> "This week"
            CallDateFilter.THIS_MONTH -> "This month"
            CallDateFilter.ALL_TIME -> "All time"
            CallDateFilter.CUSTOM -> SimpleDateFormat("d MMM", Locale.getDefault()).format(Date(customDateTimestamp))
        }
    }

    // Calls filtered by date range and search query
    val filteredCalls = remember(callsList, callsInDateRange, selectedDateFilter, searchQuery) {
        val baseList = if (selectedDateFilter == CallDateFilter.ALL_TIME) callsList else callsInDateRange
        if (searchQuery.isBlank()) baseList
        else baseList.filter {
            it.phoneNumber.contains(searchQuery.trim(), ignoreCase = true) ||
            (!it.contactName.isNullOrBlank() && it.contactName.contains(searchQuery.trim(), ignoreCase = true))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    if (isSearchActive) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search phone number or contact...", fontSize = 14.sp) },
                            singleLine = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(10.dp)
                        )
                    } else {
                        Text(
                            text = "Calls",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp,
                            color = TextDark
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = TextDark)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        isSearchActive = !isSearchActive
                        if (!isSearchActive) searchQuery = ""
                    }) {
                        Icon(
                            imageVector = if (isSearchActive) Icons.Default.Close else Icons.Default.Search,
                            contentDescription = "Search",
                            tint = TextDark
                        )
                    }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Options", tint = TextDark)
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Check for new recordings") },
                                onClick = {
                                    showMenu = false
                                    onCheckNewRecordings()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Retry unsynced calls") },
                                onClick = {
                                    showMenu = false
                                    onRetrySync()
                                }
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("Import calls (last 7 days)") },
                                onClick = {
                                    showMenu = false
                                    onImportRecentCalls(7)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Import calls (last 30 days)") },
                                onClick = {
                                    showMenu = false
                                    onImportRecentCalls(30)
                                }
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text("Change Wi-Fi / Server IP") },
                                onClick = {
                                    showMenu = false
                                    onChangeWifiIp()
                                }
                            )
                        }
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
            if (!isAgent) {
                // Segmented Tab Selector (My calls | Team) for Admins
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
                                text = "My calls",
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

                Spacer(modifier = Modifier.height(6.dp))
            }

            // Subtitle Caption matching Images 6 & 7
            Text(
                text = if (effectiveTab == 0) "Calls on this device · captured & synchronized" else "Saved in StaffCaller · a call shows after the rep's phone uploads it",
                fontSize = 12.sp,
                color = TextSubtle,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (effectiveTab == 0) {
                // Background Import Progress Status (Non-blocking)
                if (isBackgroundImporting) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFBFDBFE)))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.5.dp,
                                color = BrandBlue
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Syncing in background...",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = TextDark
                                )
                                Text(
                                    text = backgroundImportStatus.ifEmpty { "Matching recordings & syncing call logs to CRM..." },
                                    fontSize = 12.sp,
                                    color = TextSubtle,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                } else if (showImportPrompt) {
                    // First-time Onboarding Call Import Prompt (Dismissible, Non-blocking)
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFBBF7D0)))
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                    Box(
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(Color(0xFFDCFCE7)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.History,
                                            contentDescription = null,
                                            tint = Color(0xFF16A34A),
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = "Import recent calls & recordings?",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = TextDark
                                    )
                                }
                                IconButton(
                                    onClick = onDismissImportPrompt,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Dismiss",
                                        tint = TextSubtle,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            Text(
                                text = "Add past call history and recordings to StaffCaller CRM. Runs in the background so you can keep working uninterrupted.",
                                fontSize = 12.sp,
                                color = TextMuted,
                                lineHeight = 18.sp
                            )

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { onImportRecentCalls(7) },
                                    modifier = Modifier
                                        .weight(1.1f)
                                        .height(38.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                ) {
                                    Text("Import last 7 days", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }

                                OutlinedButton(
                                    onClick = { onImportRecentCalls(30) },
                                    modifier = Modifier
                                        .weight(0.9f)
                                        .height(38.dp),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                ) {
                                    Text("Last 30 days", fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                                }

                                TextButton(
                                    onClick = onDismissImportPrompt,
                                    modifier = Modifier.height(38.dp),
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                ) {
                                    Text("Not now", fontSize = 12.sp, color = TextSubtle)
                                }
                            }
                        }
                    }
                }



                // Summary Card (My calls)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Summary", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Box {
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFF1F5F9))
                                        .clickable { showDateDropdown = true }
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(dateFilterLabel, fontSize = 11.sp, color = TextDark, fontWeight = FontWeight.SemiBold)
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Select Date Filter", tint = TextSubtle, modifier = Modifier.size(14.dp))
                                }

                                DropdownMenu(
                                    expanded = showDateDropdown,
                                    onDismissRequest = { showDateDropdown = false }
                                ) {
                                    CallDateFilter.values().forEach { filter ->
                                        if (filter != CallDateFilter.CUSTOM) {
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        filter.displayName,
                                                        fontWeight = if (selectedDateFilter == filter) FontWeight.Bold else FontWeight.Normal,
                                                        color = if (selectedDateFilter == filter) BrandBlue else TextDark
                                                    )
                                                },
                                                onClick = {
                                                    selectedDateFilter = filter
                                                    showDateDropdown = false
                                                }
                                            )
                                        }
                                    }
                                    HorizontalDivider()
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                if (selectedDateFilter == CallDateFilter.CUSTOM) "Custom: $dateFilterLabel" else "Custom date...",
                                                fontWeight = if (selectedDateFilter == CallDateFilter.CUSTOM) FontWeight.Bold else FontWeight.Normal,
                                                color = if (selectedDateFilter == CallDateFilter.CUSTOM) BrandBlue else TextDark
                                            )
                                        },
                                        onClick = {
                                            showDateDropdown = false
                                            val cal = Calendar.getInstance().apply { timeInMillis = customDateTimestamp }
                                            android.app.DatePickerDialog(
                                                context,
                                                { _, year, month, dayOfMonth ->
                                                    val picked = Calendar.getInstance().apply {
                                                        set(year, month, dayOfMonth, 0, 0, 0)
                                                        set(Calendar.MILLISECOND, 0)
                                                    }
                                                    customDateTimestamp = picked.timeInMillis
                                                    selectedDateFilter = CallDateFilter.CUSTOM
                                                },
                                                cal.get(Calendar.YEAR),
                                                cal.get(Calendar.MONTH),
                                                cal.get(Calendar.DAY_OF_MONTH)
                                            ).show()
                                        }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Calls", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(summaryCount.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Connect rate", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("$summaryConnectRate%", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                        }
                    }
                }
            } else {
                // Summary Card (Team Tab matching Images 6 & 7)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Summary", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                            Box {
                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(Color(0xFFF1F5F9))
                                        .clickable { showDateDropdown = true }
                                        .padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(dateFilterLabel, fontSize = 11.sp, color = TextDark, fontWeight = FontWeight.SemiBold)
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Select Date Filter", tint = TextSubtle, modifier = Modifier.size(14.dp))
                                }

                                DropdownMenu(
                                    expanded = showDateDropdown,
                                    onDismissRequest = { showDateDropdown = false }
                                ) {
                                    CallDateFilter.values().forEach { filter ->
                                        if (filter != CallDateFilter.CUSTOM) {
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        filter.displayName,
                                                        fontWeight = if (selectedDateFilter == filter) FontWeight.Bold else FontWeight.Normal,
                                                        color = if (selectedDateFilter == filter) BrandBlue else TextDark
                                                    )
                                                },
                                                onClick = {
                                                    selectedDateFilter = filter
                                                    showDateDropdown = false
                                                }
                                            )
                                        }
                                    }
                                    HorizontalDivider()
                                    DropdownMenuItem(
                                        text = {
                                            Text(
                                                if (selectedDateFilter == CallDateFilter.CUSTOM) "Custom: $dateFilterLabel" else "Custom date...",
                                                fontWeight = if (selectedDateFilter == CallDateFilter.CUSTOM) FontWeight.Bold else FontWeight.Normal,
                                                color = if (selectedDateFilter == CallDateFilter.CUSTOM) BrandBlue else TextDark
                                            )
                                        },
                                        onClick = {
                                            showDateDropdown = false
                                            val cal = Calendar.getInstance().apply { timeInMillis = customDateTimestamp }
                                            android.app.DatePickerDialog(
                                                context,
                                                { _, year, month, dayOfMonth ->
                                                    val picked = Calendar.getInstance().apply {
                                                        set(year, month, dayOfMonth, 0, 0, 0)
                                                        set(Calendar.MILLISECOND, 0)
                                                    }
                                                    customDateTimestamp = picked.timeInMillis
                                                    selectedDateFilter = CallDateFilter.CUSTOM
                                                },
                                                cal.get(Calendar.YEAR),
                                                cal.get(Calendar.MONTH),
                                                cal.get(Calendar.DAY_OF_MONTH)
                                            ).show()
                                        }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Your team made $summaryCount calls and connected on $summaryConnected — a $summaryConnectRate% connect rate.",
                            fontSize = 13.sp,
                            color = TextDark,
                            lineHeight = 18.sp
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Calls", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(summaryCount.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Connect rate", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("$summaryConnectRate%", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Filter button row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (!isAgent) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFF1F5F9))
                                .clickable { showRepsSheet = true }
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (effectiveTab == 0) {
                                Icon(Icons.Default.FilterList, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(selectedRepFilter, fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                            } else {
                                Icon(Icons.Default.Group, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(selectedRepFilter, fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.width(2.dp))
                                Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }
                        }
                    } else {
                        Text(
                            text = "My Activity",
                            fontSize = 12.sp,
                            color = TextSubtle,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    if (selectedDateFilter != CallDateFilter.ALL_TIME) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFFEFF6FF))
                                .clickable { selectedDateFilter = CallDateFilter.ALL_TIME }
                                .padding(horizontal = 6.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(dateFilterLabel, fontSize = 11.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                            Spacer(modifier = Modifier.width(3.dp))
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = BrandBlue, modifier = Modifier.size(12.dp))
                        }
                    }
                }

                Text(
                    text = "${filteredCalls.size} calls",
                    fontSize = 12.sp,
                    color = TextSubtle,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Calls List
            if (filteredCalls.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFF1F5F9)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PhoneCallback,
                                contentDescription = null,
                                tint = TextSubtle,
                                modifier = Modifier.size(28.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = if (selectedDateFilter != CallDateFilter.ALL_TIME) "No calls for $dateFilterLabel" else "No calls logged yet",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp,
                            color = TextDark
                        )
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = if (selectedDateFilter != CallDateFilter.ALL_TIME && callsList.isNotEmpty())
                                "Calls exist for other dates. Tap below to view all calls."
                            else
                                "Calls made or received will sync here automatically",
                            fontSize = 12.sp,
                            color = TextSubtle
                        )
                        if (selectedDateFilter != CallDateFilter.ALL_TIME && callsList.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = { selectedDateFilter = CallDateFilter.ALL_TIME },
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Show all ${callsList.size} calls", fontSize = 12.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    items(filteredCalls) { call ->
                        val hasAudio = !call.audioFilePath.isNullOrEmpty()
                        val isPlaying = playingAudioCallId == call.id

                        val isInbound = call.direction.equals("INBOUND", ignoreCase = true)
                        val isMissed = call.status.equals("MISSED", ignoreCase = true)

                        val isLead = !call.contactName.isNullOrBlank() && call.contactName != call.phoneNumber
                        val displayName = if (isLead) call.contactName!! else call.phoneNumber

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (!isLead) {
                                        // Not yet in leads: prompt quick Add to Lead sheet
                                        callToConvertToLead = call
                                    } else {
                                        // Known lead: open detail view
                                        selectedCallForDetail = call
                                    }
                                },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = CardBackground),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Avatar: Initials if Lead, "+" if Unknown Number
                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(if (isLead) Color(0xFFEFF6FF) else Color(0xFFEFF6FF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isLead) {
                                        val initials = displayName
                                            .split(" ")
                                            .mapNotNull { it.firstOrNull()?.toString() }
                                            .take(2)
                                            .joinToString("")
                                            .ifEmpty { "L" }
                                        Text(
                                            text = initials.uppercase(),
                                            color = BrandBlue,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp
                                        )
                                    } else {
                                        Icon(
                                            imageVector = Icons.Default.Add,
                                            contentDescription = "Add to Lead",
                                            tint = BrandBlue,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                // Contact Info & Meta
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = displayName.uppercase(),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = TextDark,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.weight(1f, fill = false)
                                        )
                                        if (!isLead) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(Color(0xFFFEF3C7))
                                                    .padding(horizontal = 5.dp, vertical = 1.dp)
                                            ) {
                                                Text("NOT IN LEADS", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color(0xFF92400E))
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(2.dp))

                                    Text(
                                        text = "By ${userName.ifBlank { "Agent" }}",
                                        fontSize = 12.sp,
                                        color = TextSubtle
                                    )

                                    Spacer(modifier = Modifier.height(2.dp))

                                    val dateFormatted = SimpleDateFormat("d MMM, h:mm a", Locale.getDefault()).format(Date(call.startedAt))
                                    val dirStr = call.direction.lowercase().replaceFirstChar { it.uppercase() }
                                    val durationStr = if (call.status == "CONNECTED" && call.durationSec > 0) "${call.durationSec}s" else "Not connected"

                                    Text(
                                        text = "$dirStr · $durationStr · $dateFormatted",
                                        fontSize = 12.sp,
                                        color = TextSubtle
                                    )
                                }

                                // Right Action: Waveform, "+ Lead" chip, and Chevron
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(start = 6.dp)
                                ) {
                                    if (hasAudio) {
                                        Icon(
                                            imageVector = Icons.Default.GraphicEq,
                                            contentDescription = "Audio Recorded",
                                            tint = Color(0xFF16A34A),
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                    }

                                    if (!isLead) {
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(Color(0xFFEFF6FF))
                                                .border(1.dp, Color(0xFFBFDBFE), RoundedCornerShape(6.dp))
                                                .clickable { callToConvertToLead = call }
                                                .padding(horizontal = 7.dp, vertical = 4.dp)
                                        ) {
                                            Text("+ Lead", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandBlue)
                                        }
                                        Spacer(modifier = Modifier.width(4.dp))
                                    }

                                    IconButton(
                                        onClick = { selectedCallForDetail = call },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.ChevronRight,
                                            contentDescription = "Open Call Detail",
                                            tint = TextSubtle,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Quick "Add to Lead" Bottom Sheet for unlinked numbers
    if (callToConvertToLead != null) {
        val targetCall = callToConvertToLead!!
        ConvertToLeadBottomSheet(
            phoneNumber = targetCall.phoneNumber,
            initialName = "",
            serverUrl = serverUrl,
            token = token,
            onDismiss = { callToConvertToLead = null },
            onConverted = { newLeadName ->
                callToConvertToLead = null
                onLeadCreated(targetCall.phoneNumber, newLeadName)
            }
        )
    }

    // "Show calls by · 1" Rep Bottom Sheet matching Screenshot 1
    if (showRepsSheet) {
        ModalBottomSheet(
            onDismissRequest = { showRepsSheet = false },
            containerColor = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .padding(bottom = 32.dp)
            ) {
                Text(
                    text = "Show calls by · 1",
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = TextDark
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Option: All reps
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedRepFilter = "All reps"
                            showRepsSheet = false
                        }
                        .padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "All reps",
                        fontSize = 15.sp,
                        fontWeight = if (selectedRepFilter == "All reps") FontWeight.Bold else FontWeight.Medium,
                        color = TextDark
                    )
                    if (selectedRepFilter == "All reps") {
                        Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                    }
                }

                HorizontalDivider(color = BorderLight)

                // Option: Current User Rep
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedRepFilter = userName
                            showRepsSheet = false
                        }
                        .padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = userName,
                        fontSize = 15.sp,
                        fontWeight = if (selectedRepFilter == userName) FontWeight.Bold else FontWeight.Medium,
                        color = TextDark
                    )
                    if (selectedRepFilter == userName) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}
