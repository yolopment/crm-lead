package com.crmlead.companion.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

data class LeadDetailData(
    val id: String,
    val fullName: String?,
    val phone: String,
    val email: String?,
    val stage: String,
    val source: String?,
    val company: String?,
    val assignedToName: String?,
    val createdAt: String,
    val totalCalls: Int,
    val connectedCalls: Int,
    val nextFollowup: String?
)

data class TimelineItem(
    val id: String,
    val type: String, // "call_logged", "note_added", "stage_changed", "followup_set", "followup_cancelled", "lead_created"
    val title: String,
    val subtitle: String?,
    val author: String?,
    val timestamp: String,
    val audioPath: String? = null,
    val callId: String? = null,
    val tags: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeadDetailScreen(
    leadId: String,
    serverUrl: String,
    token: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var leadData by remember { mutableStateOf<LeadDetailData?>(null) }
    var timelineList by remember { mutableStateOf<List<TimelineItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedSubTab by remember { mutableStateOf(0) } // 0 = Activity, 1 = Details, 2 = Tasks
    var activityFilter by remember { mutableStateOf("ALL") } // ALL, CALLS, NOTES, TASKS
    var showEmptyFields by remember { mutableStateOf(false) }
    var editingOutcomeCall by remember { mutableStateOf<CallEntity?>(null) }

    // Modals
    var showAddNoteSheet by remember { mutableStateOf(false) }
    var showScheduleSheet by remember { mutableStateOf(false) }
    var showStagePicker by remember { mutableStateOf(false) }

    // Audio Playback
    var playingCallId by remember { mutableStateOf<String?>(null) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    // Fetch lead details & timeline from backend
    val loadLeadDetails: () -> Unit = {
        coroutineScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                try {
                    val cleanBase = serverUrl.removeSuffix("/")
                    val url = "$cleanBase/api/v1/leads/$leadId"
                    val request = Request.Builder()
                        .url(url)
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                    val response = client.newCall(request).execute()
                    val body = response.body?.string()

                    if (response.isSuccessful && body != null) {
                        val json = JSONObject(body)
                        val leadObj = json.optJSONObject("lead")
                        val timelineArr = json.optJSONArray("timeline") ?: JSONArray()

                        if (leadObj != null) {
                            val callsCount = leadObj.optJSONObject("_count")?.optInt("calls") ?: 0
                            val connectedCount = callsCount

                            val nextFollowupObj = leadObj.optJSONObject("nextFollowup")
                            val nextFollowupStr = nextFollowupObj?.let {
                                val title = it.optString("title", "Follow-up")
                                val dateStr = it.optString("scheduledAt")
                                val fmtDate = try {
                                    val d = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).parse(dateStr)
                                    SimpleDateFormat("EEE, d MMM · h:mm a", Locale.US).format(d ?: Date())
                                } catch (e: Exception) {
                                    dateStr.take(16)
                                }
                                "$title ($fmtDate)"
                            }

                            val parsedLead = LeadDetailData(
                                id = leadObj.optString("id"),
                                fullName = leadObj.optString("fullName").takeIf { it.isNotBlank() },
                                phone = leadObj.optString("phone"),
                                email = leadObj.optString("email").takeIf { it.isNotBlank() },
                                stage = leadObj.optString("stage", "NEW"),
                                source = leadObj.optString("source", "Website"),
                                company = leadObj.optString("company").takeIf { it.isNotBlank() },
                                assignedToName = leadObj.optJSONObject("assignedTo")?.optString("name") ?: "Aftab Sk",
                                createdAt = leadObj.optString("createdAt"),
                                totalCalls = callsCount,
                                connectedCalls = connectedCount,
                                nextFollowup = nextFollowupStr
                            )

                            val parsedTimeline = mutableListOf<TimelineItem>()
                            for (i in 0 until timelineArr.length()) {
                                val item = timelineArr.getJSONObject(i)
                                parsedTimeline.add(
                                    TimelineItem(
                                        id = item.optString("id"),
                                        type = item.optString("type"),
                                        title = item.optString("title"),
                                        subtitle = item.optString("subtitle").takeIf { it.isNotBlank() },
                                        author = item.optString("author", "Aftab Sk"),
                                        timestamp = item.optString("timestamp"),
                                        audioPath = item.optString("audioPath").takeIf { it.isNotBlank() },
                                        callId = item.optString("callId").takeIf { it.isNotBlank() },
                                        tags = item.optString("tags").takeIf { it.isNotBlank() }
                                    )
                                )
                            }

                            withContext(Dispatchers.Main) {
                                leadData = parsedLead
                                timelineList = parsedTimeline
                            }
                        }
                    }
                } catch (e: Exception) {
                    // Fallback
                } finally {
                    withContext(Dispatchers.Main) {
                        isLoading = false
                    }
                }
            }
        }
    }

    LaunchedEffect(leadId) {
        loadLeadDetails()
    }

    val updateLeadStage: (String) -> Unit = { newStage ->
        coroutineScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val cleanBase = serverUrl.removeSuffix("/")
                    val url = "$cleanBase/api/v1/leads/$leadId/stage"
                    val json = JSONObject().apply { put("stage", newStage) }
                    val body = json.toString().toRequestBody("application/json".toMediaType())
                    val request = Request.Builder()
                        .url(url)
                        .addHeader("Authorization", "Bearer $token")
                        .patch(body)
                        .build()
                    val response = client.newCall(request).execute()
                    withContext(Dispatchers.Main) {
                        if (response.isSuccessful) {
                            leadData = leadData?.copy(stage = newStage)
                            Toast.makeText(context, "Stage updated to $newStage", Toast.LENGTH_SHORT).show()
                            loadLeadDetails()
                        }
                    }
                } catch (e: Exception) {
                    // Error handling
                }
            }
        }
    }

    val copyToClipboard: (String, String) -> Unit = { label, text ->
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "$label copied", Toast.LENGTH_SHORT).show()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextDark)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ScreenBackground)
            )
        },
        bottomBar = {
            // Persistent Bottom Action Bar matching Images 8, 9, 10
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 8.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 1. Call
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable {
                            leadData?.phone?.let {
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$it"))
                                context.startActivity(intent)
                            }
                        }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(BrandBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Phone, contentDescription = "Call", tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Text("Call", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = BrandBlue, modifier = Modifier.padding(top = 2.dp))
                    }

                    // 2. WhatsApp
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable {
                            leadData?.phone?.let {
                                val clean = it.replace("+", "").replace(" ", "").trim()
                                try {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$clean")))
                                } catch (e: Exception) {
                                    Toast.makeText(context, "WhatsApp error", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFDCFCE7)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Chat, contentDescription = "WhatsApp", tint = Color(0xFF16A34A), modifier = Modifier.size(18.dp))
                        }
                        Text("WhatsApp", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextDark, modifier = Modifier.padding(top = 2.dp))
                    }

                    // 3. Note
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable { showAddNoteSheet = true }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.EditNote, contentDescription = "Note", tint = BrandBlue, modifier = Modifier.size(20.dp))
                        }
                        Text("Note", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextDark, modifier = Modifier.padding(top = 2.dp))
                    }

                    // 4. Task
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable { showScheduleSheet = true }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFF1F5F9)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Task", tint = TextDark, modifier = Modifier.size(18.dp))
                        }
                        Text("Task", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextDark, modifier = Modifier.padding(top = 2.dp))
                    }

                    // 5. Follow-up
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.clickable { showScheduleSheet = true }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFFEF3C7)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Schedule, contentDescription = "Follow-up", tint = Color(0xFFD97706), modifier = Modifier.size(18.dp))
                        }
                        Text("Follow-up", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextDark, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
        },
        containerColor = ScreenBackground
    ) { paddingValues ->
        if (isLoading && leadData == null) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandBlue)
            }
        } else {
            val lead = leadData ?: return@Scaffold

            val filteredTimeline = remember(timelineList, activityFilter) {
                when (activityFilter) {
                    "CALLS" -> timelineList.filter { it.type == "call_logged" }
                    "NOTES" -> timelineList.filter { it.type == "note_added" }
                    "TASKS" -> timelineList.filter { it.type.startsWith("followup") }
                    else -> timelineList
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    // Header Card matching Images 8, 9, 10
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Avatar Circle
                        val initials = (lead.fullName ?: lead.phone)
                            .split(" ")
                            .mapNotNull { it.firstOrNull()?.toString() }
                            .take(2)
                            .joinToString("")
                            .ifEmpty { "AS" }

                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFEFF6FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = initials, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = BrandBlue)
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = lead.fullName ?: lead.phone,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextDark
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(Icons.Default.Edit, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(14.dp))
                            }

                            // Phone Row with copy & edit icons
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = lead.phone, fontSize = 13.sp, color = TextSubtle)
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(
                                    Icons.Default.ContentCopy,
                                    contentDescription = "Copy phone",
                                    tint = TextSubtle,
                                    modifier = Modifier
                                        .size(14.dp)
                                        .clickable { copyToClipboard("Phone", lead.phone) }
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Icon(Icons.Default.Edit, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                            }

                            // Email Row with copy & edit icons
                            if (!lead.email.isNullOrBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(text = lead.email, fontSize = 12.sp, color = TextSubtle)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(
                                        Icons.Default.ContentCopy,
                                        contentDescription = "Copy email",
                                        tint = TextSubtle,
                                        modifier = Modifier
                                            .size(13.dp)
                                            .clickable { copyToClipboard("Email", lead.email) }
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Icon(Icons.Default.Edit, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Pills Row: Stage Dropdown, Agent Dropdown, Calls Pill
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Stage Dropdown Pill
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFDCFCE7))
                                .clickable { showStagePicker = true }
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = lead.stage.lowercase().replaceFirstChar { it.uppercase() },
                                color = Color(0xFF166534),
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = Color(0xFF166534), modifier = Modifier.size(14.dp))
                        }

                        // Agent Dropdown Pill
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Person, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = lead.assignedToName ?: "Aftab Sk",
                                color = TextDark,
                                fontWeight = FontWeight.Medium,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                        }

                        // Calls Count Pill
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFF1F5F9))
                                .padding(horizontal = 8.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Phone, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "${lead.totalCalls} calls · ${lead.connectedCalls} connected",
                                color = TextDark,
                                fontWeight = FontWeight.Medium,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Next Follow-up Card matching Images 8 & 9
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = CardBackground),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFFEFF6FF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Schedule, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text("Next follow-up", fontSize = 11.sp, color = TextSubtle)
                                    Text(
                                        text = lead.nextFollowup ?: "No follow-up scheduled",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextDark
                                    )
                                }
                            }
                            Text(
                                text = "Set",
                                color = BrandBlue,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                modifier = Modifier
                                    .clickable { showScheduleSheet = true }
                                    .padding(4.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // 3 Sub-Tabs: [Activity] [Details] [Tasks] matching Images 8, 9, 10
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFE2E8F0))
                            .padding(3.dp)
                    ) {
                        listOf("Activity", "Details", "Tasks").forEachIndexed { index, tabName ->
                            val isSelected = selectedSubTab == index
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Color.White else Color.Transparent)
                                    .clickable { selectedSubTab = index }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = tabName,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) BrandBlue else TextSubtle,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }

                // SUB-TAB 0: ACTIVITY (matching Image 10)
                if (selectedSubTab == 0) {
                    item {
                        // Filter Chips: [All] [Calls] [Notes] [Tasks]
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            listOf("ALL" to "All", "CALLS" to "Calls", "NOTES" to "Notes", "TASKS" to "Tasks").forEach { (filterKey, label) ->
                                val isSelected = activityFilter == filterKey
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(if (isSelected) Color(0xFF0F172A) else Color(0xFFF1F5F9))
                                        .clickable { activityFilter = filterKey }
                                        .padding(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = label,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) Color.White else TextDark
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // "How did your last call go?" Banner
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFBFDBFE)))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Phone, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("How did your last call go?", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                                }
                                Text(
                                    text = "Add outcome",
                                    color = BrandBlue,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    modifier = Modifier
                                        .clickable {
                                            val dummyCall = CallEntity(
                                                id = 0L,
                                                phoneNumber = lead.phone,
                                                contactName = lead.fullName,
                                                direction = "OUTBOUND",
                                                status = "CONNECTED",
                                                durationSec = 0,
                                                startedAt = System.currentTimeMillis(),
                                                endedAt = null,
                                                audioFilePath = null,
                                                isSynced = true,
                                                serverCallId = null
                                            )
                                            editingOutcomeCall = dummyCall
                                        }
                                        .padding(4.dp)
                                )
                            }
                        }
                    }

                    if (filteredTimeline.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 30.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No activity recorded yet", fontSize = 13.sp, color = TextSubtle)
                            }
                        }
                    } else {
                        items(filteredTimeline) { item ->
                            val isCall = item.type == "call_logged"
                            val isFollowup = item.type.startsWith("followup")
                            val isStage = item.type == "stage_changed"

                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = isCall) {
                                        if (isCall) {
                                            val cEntity = CallEntity(
                                                id = item.callId?.toLongOrNull() ?: 0L,
                                                phoneNumber = lead.phone,
                                                contactName = lead.fullName,
                                                direction = if (item.title.contains("Incoming", ignoreCase = true)) "INBOUND" else "OUTBOUND",
                                                status = if (item.subtitle?.contains("Not connected", ignoreCase = true) == true) "MISSED" else "CONNECTED",
                                                durationSec = 0,
                                                startedAt = System.currentTimeMillis(),
                                                endedAt = null,
                                                audioFilePath = item.audioPath,
                                                isSynced = true,
                                                serverCallId = item.callId,
                                                tags = item.tags ?: item.subtitle,
                                                notes = null
                                            )
                                            editingOutcomeCall = cEntity
                                        }
                                    },
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CardBackground),
                                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.Top
                                ) {
                                    // Circle icon on left matching Image 10
                                    val iconBg = if (isFollowup || isStage || isCall) Color(0xFFEFF6FF) else Color(0xFFF1F5F9)
                                    val iconTint = if (isFollowup || isStage || isCall) BrandBlue else TextSubtle
                                    val icon = when {
                                        isFollowup -> Icons.Default.Schedule
                                        isStage -> Icons.Default.Sync
                                        isCall -> Icons.Default.CallMade
                                        else -> Icons.Default.Description
                                    }

                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(iconBg),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
                                    }

                                    Spacer(modifier = Modifier.width(12.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = item.title,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = TextDark
                                        )

                                        if (!item.subtitle.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = item.subtitle,
                                                fontSize = 13.sp,
                                                fontWeight = if (isCall) FontWeight.SemiBold else FontWeight.Normal,
                                                color = if (isCall) Color(0xFF166534) else TextDark
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(3.dp))
                                        val authorText = item.author ?: "Aftab Sk"
                                        val timeDisplay = try {
                                            item.timestamp.take(16).replace("T", " · ")
                                        } catch (e: Exception) {
                                            item.timestamp
                                        }
                                        Text(
                                            text = "$timeDisplay · $authorText",
                                            fontSize = 11.sp,
                                            color = TextSubtle
                                        )

                                        if (isCall) {
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = "Edit outcome",
                                                    color = BrandBlue,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    modifier = Modifier.clickable {
                                                        val cEntity = CallEntity(
                                                            id = item.callId?.toLongOrNull() ?: 0L,
                                                            phoneNumber = lead.phone,
                                                            contactName = lead.fullName,
                                                            direction = if (item.title.contains("Incoming", ignoreCase = true)) "INBOUND" else "OUTBOUND",
                                                            status = if (item.subtitle?.contains("Not connected", ignoreCase = true) == true) "MISSED" else "CONNECTED",
                                                            durationSec = 0,
                                                            startedAt = System.currentTimeMillis(),
                                                            endedAt = null,
                                                            audioFilePath = item.audioPath,
                                                            isSynced = true,
                                                            serverCallId = item.callId,
                                                            tags = item.tags ?: item.subtitle,
                                                            notes = null
                                                        )
                                                        editingOutcomeCall = cEntity
                                                    }
                                                )
                                                Icon(
                                                    Icons.Default.ChevronRight,
                                                    contentDescription = null,
                                                    tint = TextSubtle,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // SUB-TAB 1: DETAILS (matching Image 9)
                if (selectedSubTab == 1) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Lead details", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CardBackground),
                                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    if (!lead.company.isNullOrBlank()) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("Company", fontSize = 13.sp, color = TextSubtle)
                                            Text(lead.company, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextDark)
                                        }
                                    } else {
                                        Text("Every field is empty", fontSize = 13.sp, color = TextSubtle)
                                    }

                                    if (showEmptyFields) {
                                        HorizontalDivider(color = BorderLight)
                                        listOf(
                                            "Alternate Phone" to "—",
                                            "Company" to (lead.company ?: "—"),
                                            "Job Title" to "—",
                                            "Country" to "—",
                                            "State" to "—",
                                            "City" to "—",
                                            "Street Address" to "—",
                                            "Postal Code" to "—"
                                        ).forEach { (field, value) ->
                                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                Text(field, fontSize = 12.sp, color = TextSubtle)
                                                Text(value, fontSize = 12.sp, color = TextSubtle)
                                            }
                                        }
                                    }
                                }
                            }

                            Text(
                                text = if (showEmptyFields) "Hide empty fields" else "Show 8 empty fields",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = BrandBlue,
                                modifier = Modifier
                                    .clickable { showEmptyFields = !showEmptyFields }
                                    .padding(vertical = 4.dp, horizontal = 2.dp)
                            )

                            Spacer(modifier = Modifier.height(6.dp))

                            Text("About this lead", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextDark)

                            val formattedCreated = remember(lead.createdAt) {
                                try {
                                    val sdfIn = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                                    val date = sdfIn.parse(lead.createdAt) ?: Date()
                                    val sdfOut = SimpleDateFormat("EEE, d MMM · h:mm a", Locale.US)
                                    sdfOut.format(date)
                                } catch (e: Exception) {
                                    lead.createdAt.take(16).replace("T", " · ")
                                }
                            }

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CardBackground),
                                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Source", fontSize = 13.sp, color = TextSubtle)
                                        Text(lead.source ?: "Website", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextDark)
                                    }
                                    HorizontalDivider(color = BorderLight)
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Form", fontSize = 13.sp, color = TextSubtle)
                                        Text("Manual Entry", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextDark)
                                    }
                                    HorizontalDivider(color = BorderLight)
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Created", fontSize = 13.sp, color = TextSubtle)
                                        Text(formattedCreated, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextDark)
                                    }
                                }
                            }
                        }
                    }
                }

                // SUB-TAB 2: TASKS (matching Image 8)
                if (selectedSubTab == 2) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            // Next follow-up card
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = CardBackground),
                                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Next follow-up", fontSize = 13.sp, color = TextSubtle)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = lead.nextFollowup ?: "No follow-up scheduled",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextDark
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    OutlinedButton(
                                        onClick = { showScheduleSheet = true },
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, BorderLight),
                                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White),
                                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                                    ) {
                                        Text("Schedule", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                                    }
                                }
                            }

                            // Open tasks • 0 & Add task
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Open tasks · 0", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextDark)
                                Text(
                                    text = "Add task",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = BrandBlue,
                                    modifier = Modifier
                                        .clickable { showScheduleSheet = true }
                                        .padding(vertical = 4.dp, horizontal = 2.dp)
                                )
                            }

                            // No tasks on this lead yet
                            Text(
                                text = "No tasks on this lead yet",
                                fontSize = 13.sp,
                                color = TextSubtle,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }
        }
    }

    // Add Note Bottom Sheet
    if (showAddNoteSheet) {
        var noteInput by remember { mutableStateOf("") }
        var isSavingNote by remember { mutableStateOf(false) }

        ModalBottomSheet(
            onDismissRequest = { showAddNoteSheet = false },
            containerColor = Color.White
        ) {
            Column(modifier = Modifier.padding(20.dp).padding(bottom = 32.dp)) {
                Text("Add Note", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = noteInput,
                    onValueChange = { noteInput = it },
                    placeholder = { Text("Enter internal note about this lead...") },
                    modifier = Modifier.fillMaxWidth().height(100.dp),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        if (noteInput.isBlank()) return@Button
                        isSavingNote = true
                        coroutineScope.launch {
                            withContext(Dispatchers.IO) {
                                try {
                                    val cleanBase = serverUrl.removeSuffix("/")
                                    val url = "$cleanBase/api/v1/leads/$leadId/notes"
                                    val body = JSONObject().apply { put("content", noteInput.trim()) }.toString()
                                        .toRequestBody("application/json".toMediaType())
                                    val req = Request.Builder()
                                        .url(url)
                                        .addHeader("Authorization", "Bearer $token")
                                        .post(body)
                                        .build()
                                    val res = client.newCall(req).execute()
                                    withContext(Dispatchers.Main) {
                                        if (res.isSuccessful) {
                                            Toast.makeText(context, "Note added!", Toast.LENGTH_SHORT).show()
                                            showAddNoteSheet = false
                                            loadLeadDetails()
                                        }
                                    }
                                } catch (e: Exception) {
                                    // Error
                                } finally {
                                    withContext(Dispatchers.Main) { isSavingNote = false }
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                    enabled = noteInput.isNotBlank() && !isSavingNote
                ) {
                    Text(if (isSavingNote) "Saving..." else "Save Note", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    // Schedule Follow-up Bottom Sheet
    if (showScheduleSheet) {
        var followupTitle by remember { mutableStateOf("Follow-up phone call") }
        var isSavingFollowup by remember { mutableStateOf(false) }

        ModalBottomSheet(
            onDismissRequest = { showScheduleSheet = false },
            containerColor = Color.White
        ) {
            Column(modifier = Modifier.padding(20.dp).padding(bottom = 32.dp)) {
                Text("Schedule Follow-up / Task", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = followupTitle,
                    onValueChange = { followupTitle = it },
                    placeholder = { Text("Task or follow-up title") },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(10.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = {
                        isSavingFollowup = true
                        coroutineScope.launch {
                            withContext(Dispatchers.IO) {
                                try {
                                    val cleanBase = serverUrl.removeSuffix("/")
                                    val url = "$cleanBase/api/v1/followups"
                                    val tomorrow = Calendar.getInstance().apply {
                                        add(Calendar.DAY_OF_YEAR, 1)
                                        set(Calendar.HOUR_OF_DAY, 10)
                                        set(Calendar.MINUTE, 0)
                                    }
                                    val isoDate = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                                        timeZone = TimeZone.getTimeZone("UTC")
                                    }.format(tomorrow.time)

                                    val body = JSONObject().apply {
                                        put("leadId", leadId)
                                        put("type", "CALL")
                                        put("title", followupTitle.trim())
                                        put("scheduledAt", isoDate)
                                    }.toString().toRequestBody("application/json".toMediaType())

                                    val req = Request.Builder()
                                        .url(url)
                                        .addHeader("Authorization", "Bearer $token")
                                        .post(body)
                                        .build()
                                    val res = client.newCall(req).execute()
                                    withContext(Dispatchers.Main) {
                                        if (res.isSuccessful) {
                                            // Immediately schedule exact Android OS Alarm Notification
                                            val lName = leadData?.fullName ?: (leadData?.phone ?: "Lead")
                                            val lPhone = leadData?.phone ?: ""
                                            com.crmlead.companion.notification.FollowupNotificationManager.scheduleFollowupAlarm(
                                                context = context,
                                                followupId = UUID.randomUUID().toString(),
                                                leadName = lName,
                                                leadPhone = lPhone,
                                                title = followupTitle.trim(),
                                                note = "Scheduled from companion app",
                                                triggerAtMillis = tomorrow.timeInMillis
                                            )

                                            Toast.makeText(context, "⏰ Follow-up reminder alarm set for Tomorrow 10:00 AM!", Toast.LENGTH_LONG).show()
                                            showScheduleSheet = false
                                            loadLeadDetails()
                                        }
                                    }
                                } catch (e: Exception) {
                                    // Error
                                } finally {
                                    withContext(Dispatchers.Main) { isSavingFollowup = false }
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                    enabled = !isSavingFollowup
                ) {
                    Text(if (isSavingFollowup) "Scheduling..." else "Schedule for Tomorrow 10:00 AM", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    // Stage Picker Sheet
    if (showStagePicker) {
        val stages = listOf("NEW" to "Fresh", "CONTACTED" to "Contacted", "QUALIFIED" to "Qualified", "WON" to "Won", "LOST" to "Lost")
        ModalBottomSheet(
            onDismissRequest = { showStagePicker = false },
            containerColor = Color.White
        ) {
            Column(modifier = Modifier.padding(20.dp).padding(bottom = 32.dp)) {
                Text("Select Stage", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Spacer(modifier = Modifier.height(12.dp))
                stages.forEach { (stgKey, label) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                updateLeadStage(stgKey)
                                showStagePicker = false
                            }
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(label, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = TextDark)
                        if (leadData?.stage == stgKey) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }

    // Call Outcome Modal Bottom Sheet
    if (editingOutcomeCall != null) {
        CallOutcomeBottomSheet(
            call = editingOutcomeCall!!,
            serverUrl = serverUrl,
            token = token,
            onDismiss = { editingOutcomeCall = null },
            onSaved = { _ ->
                editingOutcomeCall = null
                loadLeadDetails()
            }
        )
    }
}
