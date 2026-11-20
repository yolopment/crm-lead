package com.crmlead.companion.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

data class FollowUpEntity(
    val id: String,
    val leadId: String,
    val title: String,
    val note: String?,
    val scheduledAt: String?,
    val status: String,
    val type: String,
    val priority: String,
    val leadName: String?,
    val leadPhone: String,
    val leadStage: String?
)

data class FollowUpCountsDto(
    val overdue: Int = 0,
    val today: Int = 0,
    val upcoming: Int = 0,
    val done: Int = 0
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FollowupsScreen(
    serverUrl: String,
    token: String,
    onOpenDrawer: () -> Unit,
    onBrowseLeads: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var selectedTab by remember { mutableStateOf(0) } // 0 = Call follow-ups, 1 = To-dos
    var scopeFilter by remember { mutableStateOf("Mine") } // "Mine" vs "Whole team"
    var showScopeDropdown by remember { mutableStateOf(false) }
    var selectedChipIndex by remember { mutableStateOf(1) } // 0 = Overdue, 1 = Today, 2 = Upcoming, 3 = Done

    var itemsList by remember { mutableStateOf<List<FollowUpEntity>>(emptyList()) }
    var counts by remember { mutableStateOf(FollowUpCountsDto()) }
    var isLoading by remember { mutableStateOf(false) }

    val formattedDate = remember {
        SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())
    }

    // Fetch followups from backend /api/v1/followups
    val fetchFollowups = {
        coroutineScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                try {
                    val cleanBase = serverUrl.removeSuffix("/")
                    val scopeParam = if (scopeFilter == "Mine") "me" else "team"
                    val tabParam = if (selectedTab == 0) "call_followups" else "todos"
                    val statusParam = if (selectedChipIndex == 3) "completed" else "open"
                    val timeFilterParam = when (selectedChipIndex) {
                        0 -> "overdue"
                        1 -> "today"
                        else -> "all"
                    }

                    val url = "$cleanBase/api/v1/followups?tab=$tabParam&scope=$scopeParam&status=$statusParam&timeFilter=$timeFilterParam"
                    val request = Request.Builder()
                        .url(url)
                        .addHeader("Authorization", "Bearer $token")
                        .build()

                    val response = client.newCall(request).execute()
                    val body = response.body?.string()
                    if (response.isSuccessful && body != null) {
                        val json = JSONObject(body)
                        val itemsArray = json.optJSONArray("items") ?: JSONArray()
                        val countsObj = json.optJSONObject("counts")

                        val parsedItems = mutableListOf<FollowUpEntity>()
                        for (i in 0 until itemsArray.length()) {
                            val obj = itemsArray.getJSONObject(i)
                            val leadObj = obj.optJSONObject("lead")
                            parsedItems.add(
                                FollowUpEntity(
                                    id = obj.optString("id"),
                                    leadId = obj.optString("leadId"),
                                    title = obj.optString("title"),
                                    note = obj.optString("note").takeIf { it.isNotBlank() },
                                    scheduledAt = obj.optString("scheduledAt").takeIf { it.isNotBlank() },
                                    status = obj.optString("status", "PENDING"),
                                    type = obj.optString("type", "CALL"),
                                    priority = obj.optString("priority", "NORMAL"),
                                    leadName = leadObj?.optString("fullName")?.takeIf { it.isNotBlank() },
                                    leadPhone = leadObj?.optString("phone") ?: "",
                                    leadStage = leadObj?.optString("stageName") ?: leadObj?.optString("stage")
                                )
                            )
                        }

                        val parsedCounts = if (countsObj != null) {
                            FollowUpCountsDto(
                                overdue = countsObj.optInt("overdue", 0),
                                today = countsObj.optInt("today", 0),
                                upcoming = countsObj.optInt("upcoming", 0),
                                done = countsObj.optInt("done", 0)
                            )
                        } else FollowUpCountsDto()

                        withContext(Dispatchers.Main) {
                            itemsList = parsedItems
                            counts = parsedCounts
                            // Sync local alarms for due followups
                            com.crmlead.companion.notification.FollowupNotificationManager.checkAndSchedulePendingFollowups(
                                context,
                                serverUrl,
                                token
                            )
                        }
                    }
                } catch (e: Exception) {
                    // Ignore offline
                } finally {
                    withContext(Dispatchers.Main) {
                        isLoading = false
                    }
                }
            }
        }
    }

    val completeFollowup: (String) -> Unit = { id ->
        coroutineScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val cleanBase = serverUrl.removeSuffix("/")
                    val emptyBody = "".toRequestBody("application/json".toMediaType())
                    val request = Request.Builder()
                        .url("$cleanBase/api/v1/followups/$id/complete")
                        .patch(emptyBody)
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                    val response = client.newCall(request).execute()
                    if (response.isSuccessful) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(context, "Completed!", Toast.LENGTH_SHORT).show()
                            fetchFollowups()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Failed to complete", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    LaunchedEffect(scopeFilter, selectedTab, selectedChipIndex) {
        fetchFollowups()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Follow-ups", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                            Text(formattedDate, fontSize = 12.sp, color = TextSubtle)
                        }

                        // Scope dropdown (Mine vs Whole team)
                        Box {
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFFEFF6FF))
                                    .clickable { showScopeDropdown = true }
                                    .padding(horizontal = 10.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Group, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(scopeFilter, fontSize = 12.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                                Spacer(modifier = Modifier.width(2.dp))
                                Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(14.dp))
                            }

                            DropdownMenu(
                                expanded = showScopeDropdown,
                                onDismissRequest = { showScopeDropdown = false }
                            ) {
                                DropdownMenuItem(
                                    text = {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("Mine", fontWeight = if (scopeFilter == "Mine") FontWeight.Bold else FontWeight.Normal)
                                            if (scopeFilter == "Mine") {
                                                Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    },
                                    onClick = {
                                        scopeFilter = "Mine"
                                        showScopeDropdown = false
                                    }
                                )
                                DropdownMenuItem(
                                    text = {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("Whole team", fontWeight = if (scopeFilter == "Whole team") FontWeight.Bold else FontWeight.Normal)
                                            if (scopeFilter == "Whole team") {
                                                Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                                            }
                                        }
                                    },
                                    onClick = {
                                        scopeFilter = "Whole team"
                                        showScopeDropdown = false
                                    }
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = TextDark)
                    }
                },
                actions = {
                    IconButton(onClick = { fetchFollowups() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = BrandBlue)
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
            // Tabs: Call follow-ups | To-dos
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { selectedTab = 0 }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Call follow-ups",
                            fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedTab == 0) BrandBlue else TextSubtle,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (selectedTab == 0) BrandBlue else Color.Transparent)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { selectedTab = 1 }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "To-dos",
                            fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Medium,
                            color = if (selectedTab == 1) BrandBlue else TextSubtle,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (selectedTab == 1) BrandBlue else Color.Transparent)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Chips Row: Overdue (X) | Today (X) | Upcoming (X) | Done (X)
            val chips = listOf(
                "Overdue (${counts.overdue})",
                "Today (${counts.today})",
                "Upcoming (${counts.upcoming})",
                "Done (${counts.done})"
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                chips.forEachIndexed { index, label ->
                    val isSelected = selectedChipIndex == index
                    val isOverdueChip = index == 0 && counts.overdue > 0

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                when {
                                    isSelected -> Color.White
                                    isOverdueChip -> Color(0xFFFEE2E2)
                                    else -> Color(0xFFF1F5F9)
                                }
                            )
                            .clickable { selectedChipIndex = index }
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = label,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = when {
                                isSelected -> if (isOverdueChip) BrandRed else BrandBlue
                                isOverdueChip -> BrandRed
                                else -> TextSubtle
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Loading state
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = BrandBlue)
                }
            } else if (itemsList.isEmpty()) {
                // Empty state matching Screenshot 7
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFDCFCE7)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = BrandGreen, modifier = Modifier.size(28.dp))
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "You're all caught up",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = TextDark
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "No follow-ups or tasks due here right now.",
                            fontSize = 13.sp,
                            color = TextSubtle,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 18.sp
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        OutlinedButton(
                            onClick = onBrowseLeads,
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Text("Browse leads", fontSize = 13.sp, color = TextDark, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 24.dp)
                ) {
                    items(itemsList) { item ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = CardBackground),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Checkbox to mark complete
                                if (item.status == "PENDING") {
                                    IconButton(
                                        onClick = { completeFollowup(item.id) },
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.RadioButtonUnchecked,
                                            contentDescription = "Complete",
                                            tint = TextSubtle,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                } else {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = "Completed",
                                        tint = BrandGreen,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = item.leadName ?: item.leadPhone,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = TextDark
                                        )
                                        if (item.leadStage != null) {
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .background(Color(0xFFDCFCE7))
                                                    .padding(horizontal = 5.dp, vertical = 1.dp)
                                            ) {
                                                Text(
                                                    item.leadStage,
                                                    fontSize = 10.sp,
                                                    color = BrandGreen,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }

                                    Text(
                                        text = item.title,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = TextDark
                                    )

                                    if (item.note != null) {
                                        Text(
                                            text = item.note,
                                            fontSize = 11.sp,
                                            color = TextSubtle,
                                            maxLines = 1
                                        )
                                    }

                                    Text(
                                        text = item.leadPhone,
                                        fontSize = 11.sp,
                                        color = TextMuted,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }

                                // 1-tap WhatsApp Action
                                IconButton(
                                    onClick = {
                                        try {
                                            val cleanPhone = item.leadPhone.filter { it.isDigit() }
                                            val waIntent = Intent(Intent.ACTION_VIEW).apply {
                                                data = Uri.parse("https://wa.me/$cleanPhone")
                                            }
                                            context.startActivity(waIntent)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "WhatsApp not installed", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Chat,
                                        contentDescription = "WhatsApp",
                                        tint = BrandGreen,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }

                                // 1-tap Phone Call Action
                                IconButton(
                                    onClick = {
                                        try {
                                            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                                                data = Uri.parse("tel:${item.leadPhone}")
                                            }
                                            context.startActivity(dialIntent)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "Dialer unavailable", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Phone,
                                        contentDescription = "Call",
                                        tint = BrandBlue,
                                        modifier = Modifier.size(20.dp)
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
