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
import androidx.compose.material.icons.filled.CallMade
import androidx.compose.material.icons.filled.CallMissed
import androidx.compose.material.icons.filled.CallReceived
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallsScreen(
    callsList: List<CallEntity>,
    serverUrl: String,
    token: String,
    userName: String,
    onOpenDrawer: () -> Unit,
    onCheckNewRecordings: () -> Unit,
    onRetrySync: () -> Unit,
    onChangeWifiIp: () -> Unit,
    onOpenLead: (String) -> Unit = {}
) {
    val context = LocalContext.current
    var selectedCallForDetail by remember { mutableStateOf<CallEntity?>(null) }
    var selectedTab by remember { mutableStateOf(0) } // 0 = My calls, 1 = Team
    var showMenu by remember { mutableStateOf(false) }
    var showRepsSheet by remember { mutableStateOf(false) }
    var selectedRepFilter by remember { mutableStateOf("All reps") }
    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }
    var playingAudioCallId by remember { mutableStateOf<Long?>(null) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

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

    // Filter calls based on search (by phone or contact name)
    val filteredCalls = remember(callsList, searchQuery) {
        if (searchQuery.isBlank()) callsList
        else callsList.filter {
            it.phoneNumber.contains(searchQuery.trim(), ignoreCase = true) ||
            (!it.contactName.isNullOrBlank() && it.contactName.contains(searchQuery.trim(), ignoreCase = true))
        }
    }

    // Today's summary calculations
    val todayStart = remember {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        cal.timeInMillis
    }

    val todayCalls = remember(callsList) {
        callsList.filter { it.startedAt >= todayStart }
    }

    val todayCount = todayCalls.size
    val todayTalkTimeSec = todayCalls.sumOf { it.durationSec }
    val todayConnected = todayCalls.count { it.status == "CONNECTED" }
    val todayConnectRate = if (todayCount > 0) ((todayConnected * 100) / todayCount) else 0
    val todayRecordedCount = todayCalls.count { !it.audioFilePath.isNullOrEmpty() }

    val formattedTalkTime = remember(todayTalkTimeSec) {
        val m = todayTalkTimeSec / 60
        val s = todayTalkTimeSec % 60
        "${m}m ${s}s"
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
            // Segmented Tab Selector (My calls | Team)
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

            // Subtitle Caption matching Images 6 & 7
            Text(
                text = if (selectedTab == 0) "Calls on this device · captured & synchronized" else "Saved in Lead CRM · a call shows after the rep's phone uploads it",
                fontSize = 12.sp,
                color = TextSubtle,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (selectedTab == 0) {
                // Trial Status Banner
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFBFDBFE)))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = BrandBlue,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "14 days left in your trial",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = TextDark
                            )
                        }
                        OutlinedButton(
                            onClick = { Toast.makeText(context, "Contact support: support@yolopment.com", Toast.LENGTH_SHORT).show() },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(28.dp)
                        ) {
                            Text("Contact us", fontSize = 11.sp, color = TextDark, fontWeight = FontWeight.Medium)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

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
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Today", fontSize = 11.sp, color = TextDark, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.width(2.dp))
                                Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
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
                                Text(todayCount.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Connect rate", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("$todayConnectRate%", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(if (todayTalkTimeSec < 60) "${todayTalkTimeSec}s" else formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
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
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Today", fontSize = 11.sp, color = TextDark, fontWeight = FontWeight.Medium)
                                Spacer(modifier = Modifier.width(2.dp))
                                Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "Your team made $todayCount calls and connected on $todayConnected — a $todayConnectRate% connect rate.",
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
                                Text(todayCount.toString(), fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Connect rate", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("$todayConnectRate%", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(if (todayTalkTimeSec < 60) "${todayTalkTimeSec}s" else formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
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
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF1F5F9))
                        .clickable { showRepsSheet = true }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (selectedTab == 0) {
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
                        Text("No calls logged yet", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text("Calls made or received will sync here automatically", fontSize = 12.sp, color = TextSubtle)
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

                        val avatarBg = when {
                            isMissed -> Color(0xFFFEF2F2)
                            isInbound -> Color(0xFFECFDF5)
                            else -> Color(0xFFEFF6FF)
                        }
                        val iconColor = when {
                            isMissed -> BrandRed
                            isInbound -> BrandGreen
                            else -> BrandBlue
                        }
                        val directionIcon = when {
                            isMissed -> Icons.Default.CallMissed
                            isInbound -> Icons.Default.CallReceived
                            else -> Icons.Default.CallMade
                        }

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedCallForDetail = call },
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
                                // Initials Avatar matching Images 6 & 7
                                val displayName = if (!call.contactName.isNullOrBlank()) call.contactName else call.phoneNumber
                                val initials = displayName
                                    .split(" ")
                                    .mapNotNull { it.firstOrNull()?.toString() }
                                    .take(2)
                                    .joinToString("")
                                    .ifEmpty { "AS" }

                                Box(
                                    modifier = Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFFEFF6FF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = initials.uppercase(),
                                        color = BrandBlue,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                // Contact Info & Meta matching Images 6 & 7
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = displayName.uppercase(),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = TextDark,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )

                                    Spacer(modifier = Modifier.height(2.dp))

                                    Text(
                                        text = "By ${userName.ifBlank { "Aftab Sk" }}",
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

                                // Right Action: Waveform icon + ChevronRight matching Screenshots 1 & 2
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
