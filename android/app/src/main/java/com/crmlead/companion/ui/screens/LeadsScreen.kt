package com.crmlead.companion.ui.screens

import android.content.Intent
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

data class LeadItem(
    val id: String,
    val fullName: String?,
    val phone: String,
    val email: String?,
    val stage: String,
    val source: String?
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeadsScreen(
    serverUrl: String,
    token: String,
    userRole: String = "AGENT",
    initialSearchQuery: String = "",
    onOpenDrawer: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var selectedLeadId by remember { mutableStateOf<String?>(null) }
    var leadsList by remember { mutableStateOf<List<LeadItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf(initialSearchQuery) }
    var stageFilter by remember { mutableStateOf("ALL") }

    if (selectedLeadId != null) {
        LeadDetailScreen(
            leadId = selectedLeadId!!,
            serverUrl = serverUrl,
            token = token,
            onBack = { selectedLeadId = null }
        )
        return
    }

    // Bottom Sheets
    var showViewsSheet by remember { mutableStateOf(false) }
    var showAddLeadSheet by remember { mutableStateOf(false) }

    // Add Lead Form State
    var newName by remember { mutableStateOf("") }
    var newPhone by remember { mutableStateOf("") }
    var newEmail by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }

    // Fetch leads from backend
    val fetchLeads = {
        coroutineScope.launch {
            isLoading = true
            withContext(Dispatchers.IO) {
                try {
                    val cleanBase = serverUrl.removeSuffix("/")
                    val url = "$cleanBase/api/v1/leads?limit=100"
                    val request = Request.Builder()
                        .url(url)
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                    val response = client.newCall(request).execute()
                    val body = response.body?.string()
                    if (response.isSuccessful && body != null) {
                        val json = JSONObject(body)
                        val array = json.optJSONArray("leads") ?: JSONArray()
                        val parsed = mutableListOf<LeadItem>()
                        for (i in 0 until array.length()) {
                            val item = array.getJSONObject(i)
                            parsed.add(
                                LeadItem(
                                    id = item.optString("id"),
                                    fullName = item.optString("fullName").takeIf { it.isNotBlank() },
                                    phone = item.optString("phone"),
                                    email = item.optString("email").takeIf { it.isNotBlank() },
                                    stage = item.optString("stage", "NEW"),
                                    source = item.optString("source", "manual")
                                )
                            )
                        }
                        withContext(Dispatchers.Main) {
                            leadsList = parsed
                        }
                    }
                } catch (e: Exception) {
                    // Fallback or offline state
                } finally {
                    withContext(Dispatchers.Main) {
                        isLoading = false
                    }
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchLeads()
    }

    // Filter leads
    val filteredLeads = remember(leadsList, searchQuery, stageFilter) {
        leadsList.filter { lead ->
            val matchesQuery = searchQuery.isBlank() ||
                (lead.fullName?.contains(searchQuery, ignoreCase = true) == true) ||
                lead.phone.contains(searchQuery, ignoreCase = true) ||
                (lead.email?.contains(searchQuery, ignoreCase = true) == true)
            val matchesStage = stageFilter == "ALL" || lead.stage.equals(stageFilter, ignoreCase = true)
            matchesQuery && matchesStage
        }
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
                        Text(if (userRole.equals("AGENT", ignoreCase = true)) "My Leads" else "All Leads", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)

                        // Views Dropdown Pill
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFEFF6FF))
                                .clickable { showViewsSheet = true }
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Views", fontSize = 12.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(14.dp))
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = TextDark)
                    }
                },
                actions = {
                    IconButton(onClick = { fetchLeads() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = TextDark)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ScreenBackground)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddLeadSheet = true },
                containerColor = BrandBlue,
                contentColor = Color.White,
                shape = CircleShape
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Lead")
            }
        },
        containerColor = ScreenBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search name, email, company, phone...", fontSize = 13.sp, color = TextSubtle) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(18.dp))
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextSubtle, modifier = Modifier.size(16.dp))
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = CardBackground,
                    focusedContainerColor = CardBackground,
                    unfocusedBorderColor = BorderLight,
                    focusedBorderColor = BrandBlue
                )
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Sub-bar: Count, Filters, Sort
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${filteredLeads.size} ${if (filteredLeads.size == 1) "lead" else "leads"}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextSubtle
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Filter Pill
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF1F5F9))
                            .clickable {
                                // Cycle stage filter
                                stageFilter = when (stageFilter) {
                                    "ALL" -> "NEW"
                                    "NEW" -> "CONTACTED"
                                    "CONTACTED" -> "WON"
                                    else -> "ALL"
                                }
                            }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.FilterList, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (stageFilter == "ALL") "Filters" else stageFilter,
                            fontSize = 12.sp,
                            color = TextDark,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Sort Pill
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFF1F5F9))
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Sort: Newest", fontSize = 12.sp, color = TextDark, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.width(2.dp))
                        Icon(Icons.Default.KeyboardArrowDown, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(13.dp))
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Leads List or Empty State
            if (filteredLeads.isEmpty()) {
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
                            Icon(Icons.Default.People, contentDescription = null, tint = TextSubtle, modifier = Modifier.size(28.dp))
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("No leads found", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = TextDark)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Tap + below to add your first lead", fontSize = 12.sp, color = TextSubtle)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(filteredLeads) { lead ->
                        val initials = (lead.fullName ?: lead.phone)
                            .split(" ")
                            .mapNotNull { it.firstOrNull()?.toString() }
                            .take(2)
                            .joinToString("")
                            .ifEmpty { "L" }

                        val stageColor = when (lead.stage.uppercase()) {
                            "WON" -> Color(0xFF16A34A)
                            "NEW" -> BrandBlue
                            "CONTACTED" -> Color(0xFF0284C7)
                            "QUALIFIED" -> Color(0xFF7C3AED)
                            "LOST" -> BrandRed
                            else -> TextSubtle
                        }

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedLeadId = lead.id },
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
                                // Avatar circle
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFFEFF6FF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = initials,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = BrandBlue
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                // Contact Info
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = lead.fullName ?: lead.phone,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = TextDark,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = lead.phone,
                                        fontSize = 12.sp,
                                        color = TextSubtle,
                                        fontWeight = FontWeight.Normal
                                    )
                                    if (!lead.email.isNullOrBlank()) {
                                        Text(
                                            text = lead.email,
                                            fontSize = 11.sp,
                                            color = TextSubtle,
                                            maxLines = 1
                                        )
                                    }
                                }

                                // Stage Pill
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(stageColor.copy(alpha = 0.1f))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = lead.stage.lowercase().replaceFirstChar { it.uppercase() },
                                        color = stageColor,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                // Action Buttons (Call + WhatsApp)
                                IconButton(
                                    onClick = {
                                        try {
                                            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                                                data = Uri.parse("tel:${lead.phone}")
                                            }
                                            context.startActivity(dialIntent)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "Dialer unavailable", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Phone, contentDescription = "Call", tint = BrandBlue, modifier = Modifier.size(18.dp))
                                }

                                IconButton(
                                    onClick = {
                                        try {
                                            val cleanPhone = lead.phone.replace(Regex("[^0-9]"), "")
                                            val waIntent = Intent(Intent.ACTION_VIEW).apply {
                                                data = Uri.parse("https://wa.me/$cleanPhone")
                                            }
                                            context.startActivity(waIntent)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, "WhatsApp unavailable", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Default.Chat, contentDescription = "WhatsApp", tint = Color(0xFF16A34A), modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // Bottom Sheet: Views (Image 11)
    // ==========================================
    if (showViewsSheet) {
        ModalBottomSheet(
            onDismissRequest = { showViewsSheet = false },
            containerColor = CardBackground
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
            ) {
                Text("Views", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextDark)
                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showViewsSheet = false }
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("All Leads", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = BrandBlue)
                    Icon(Icons.Default.Check, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(18.dp))
                }

                HorizontalDivider(color = BorderLight, modifier = Modifier.padding(vertical = 8.dp))

                Text("No saved views yet.", fontSize = 13.sp, color = TextSubtle)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Create and edit views on StaffCaller Web. They show up here automatically.",
                    fontSize = 12.sp,
                    color = TextSubtle
                )

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // ==========================================
    // Bottom Sheet: Add Lead (Image 12)
    // ==========================================
    if (showAddLeadSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAddLeadSheet = false },
            containerColor = CardBackground
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
            ) {
                Text("Add lead", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = TextDark)
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = newName,
                    onValueChange = { newName = it },
                    label = { Text("Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = newPhone,
                    onValueChange = { newPhone = it },
                    label = { Text("Phone") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = newEmail,
                    onValueChange = { newEmail = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Add the rest — stage, owner, other details — on the lead after it is saved.",
                    fontSize = 12.sp,
                    color = TextSubtle
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = {
                        if (newPhone.isBlank()) {
                            Toast.makeText(context, "Phone number is required", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        isSubmitting = true
                        coroutineScope.launch {
                            withContext(Dispatchers.IO) {
                                try {
                                    val cleanBase = serverUrl.removeSuffix("/")
                                    val jsonPayload = JSONObject().apply {
                                        put("fullName", newName.trim())
                                        put("phone", newPhone.trim())
                                        if (newEmail.isNotBlank()) put("email", newEmail.trim())
                                        put("source", "mobile_companion")
                                    }
                                    val request = Request.Builder()
                                        .url("$cleanBase/api/v1/leads")
                                        .addHeader("Authorization", "Bearer $token")
                                        .post(jsonPayload.toString().toRequestBody("application/json".toMediaType()))
                                        .build()
                                    val response = client.newCall(request).execute()
                                    withContext(Dispatchers.Main) {
                                        if (response.isSuccessful) {
                                            Toast.makeText(context, "Lead added successfully!", Toast.LENGTH_SHORT).show()
                                            newName = ""
                                            newPhone = ""
                                            newEmail = ""
                                            showAddLeadSheet = false
                                            fetchLeads()
                                        } else {
                                            Toast.makeText(context, "Failed to create lead", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                } catch (e: Exception) {
                                    withContext(Dispatchers.Main) {
                                        Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                    }
                                } finally {
                                    withContext(Dispatchers.Main) {
                                        isSubmitting = false
                                    }
                                }
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                    enabled = !isSubmitting
                ) {
                    Text(if (isSubmitting) "Adding..." else "Add lead", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}

