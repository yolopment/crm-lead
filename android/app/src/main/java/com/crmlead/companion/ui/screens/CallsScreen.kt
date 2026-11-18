package com.crmlead.companion.ui.screens

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.crmlead.companion.data.CallEntity
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallsScreen(
    callsList: List<CallEntity>,
    serverUrl: String,
    userName: String,
    onOpenDrawer: () -> Unit,
    onCheckNewRecordings: () -> Unit,
    onRetrySync: () -> Unit,
    onChangeWifiIp: () -> Unit
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(0) } // 0 = My calls, 1 = Team
    var showMenu by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }
    var playingAudioCallId by remember { mutableStateOf<Long?>(null) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

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
                            placeholder = { Text("Search phone number...", fontSize = 14.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(8.dp)
                        )
                    } else {
                        Text("Calls", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Text("≡", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = TextDark)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        isSearchActive = !isSearchActive
                        if (!isSearchActive) searchQuery = ""
                    }) {
                        Text(if (isSearchActive) "✕" else "🔍", fontSize = 16.sp)
                    }
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Text("⋮", fontSize = 20.sp, fontWeight = FontWeight.Bold)
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
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF))
            ) {
                Row(modifier = Modifier.padding(4.dp)) {
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
                            fontSize = 14.sp
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
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Subtitle Caption
            Text(
                text = if (selectedTab == 0) "Calls on this phone" else "Saved in LeadZam · a call shows after the rep's phone uploads it",
                fontSize = 12.sp,
                color = TextSubtle,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )

            Spacer(modifier = Modifier.height(10.dp))

            if (selectedTab == 0) {
                // Trial Status Banner
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF).copy(alpha = 0.6f)),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFBFDBFE)))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🕒", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("14 days left in your trial", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = TextDark)
                        }
                        OutlinedButton(
                            onClick = { Toast.makeText(context, "Contact support: yolopment@gmail.com", Toast.LENGTH_SHORT).show() },
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("Contact us", fontSize = 11.sp, color = TextDark)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Summary Card (My calls)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Summary", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextDark)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text("Today ⌄", fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Calls", fontSize = 12.sp, color = TextSubtle)
                                Text(todayCount.toString(), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Text(formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(BrandGreen))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Recorded", fontSize = 12.sp, color = TextSubtle)
                                }
                                Text(todayRecordedCount.toString(), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                        }
                    }
                }
            } else {
                // Summary Card (Team Tab)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Summary", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextDark)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFF1F5F9))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text("Today ⌄", fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Your team made $todayCount calls and connected on $todayConnected — a $todayConnectRate% connect rate.",
                            fontSize = 13.sp,
                            color = TextMuted
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Calls", fontSize = 12.sp, color = TextSubtle)
                                Text(todayCount.toString(), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                            Column {
                                Text("Connect rate", fontSize = 12.sp, color = TextSubtle)
                                Text("$todayConnectRate%", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                            Column {
                                Text("Talk time", fontSize = 12.sp, color = TextSubtle)
                                Text(formattedTalkTime, fontWeight = FontWeight.Bold, fontSize = 22.sp, color = TextDark)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Filter button row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF1F5F9))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(if (selectedTab == 0) "≡ Filter" else "👥 All reps ⌄", fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                }

                Text("${filteredCalls.size} calls", fontSize = 12.sp, color = TextSubtle)
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Calls List
            if (filteredCalls.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("📞", fontSize = 36.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No calls logged yet", fontWeight = FontWeight.SemiBold, color = TextSubtle)
                        Text("Calls made or received will sync here", fontSize = 12.sp, color = TextSubtle)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredCalls) { call ->
                        val hasAudio = !call.audioFilePath.isNullOrEmpty()
                        val isPlaying = playingAudioCallId == call.id

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (hasAudio) {
                                        if (isPlaying) {
                                            mediaPlayer?.stop()
                                            mediaPlayer?.release()
                                            mediaPlayer = null
                                            playingAudioCallId = null
                                        } else {
                                            try {
                                                mediaPlayer?.release()
                                                mediaPlayer = MediaPlayer().apply {
                                                    setDataSource(call.audioFilePath)
                                                    prepare()
                                                    start()
                                                    setOnCompletionListener {
                                                        playingAudioCallId = null
                                                    }
                                                }
                                                playingAudioCallId = call.id
                                                Toast.makeText(context, "Playing call audio...", Toast.LENGTH_SHORT).show()
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Unable to play audio: ${e.message}", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = CardBackground),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (selectedTab == 0) {
                                    // My calls avatar (# with direction badge)
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFF1F5F9)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("#", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextSubtle)
                                    }
                                } else {
                                    // Team tab avatar (AS)
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFF3E8FF)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("AS", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color(0xFF7E22CE))
                                    }
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    val displayName = if (!call.contactName.isNullOrBlank()) call.contactName else call.phoneNumber
                                    Text(
                                        text = displayName,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = if (call.status == "MISSED") BrandRed else TextDark
                                    )
                                    if (!call.contactName.isNullOrBlank()) {
                                        Text(
                                            text = call.phoneNumber,
                                            fontSize = 11.sp,
                                            color = TextSubtle,
                                            fontWeight = FontWeight.Normal
                                        )
                                    }
                                    if (selectedTab == 1) {
                                        Text(
                                            text = "By $userName",
                                            fontSize = 12.sp,
                                            color = TextSubtle
                                        )
                                    }
                                    val timeStr = SimpleDateFormat("h:mm a", Locale.getDefault()).format(Date(call.startedAt))
                                    val durStr = if (call.durationSec > 0) "${call.durationSec}s · " else ""
                                    Text(
                                        text = "${call.direction.lowercase().capitalize(Locale.ROOT)} · $durStr$timeStr",
                                        fontSize = 12.sp,
                                        color = if (call.status == "MISSED") BrandRed else TextSubtle
                                    )
                                }

                                // Right Action: Green Waveform if recorded, or Phone icon
                                if (hasAudio) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(end = 4.dp)
                                    ) {
                                        Text(
                                            text = if (isPlaying) "⏸️" else "|||",
                                            color = BrandGreen,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 16.sp
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("›", fontSize = 16.sp, color = TextSubtle)
                                    }
                                } else {
                                    IconButton(
                                        onClick = {
                                            try {
                                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                                    data = Uri.parse("tel:${call.phoneNumber}")
                                                }
                                                context.startActivity(intent)
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Dialer unavailable", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFEFF6FF))
                                    ) {
                                        Text("📞", fontSize = 14.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

