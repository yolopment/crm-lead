package com.crmlead.companion.ui.screens

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.crmlead.companion.data.CallEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallDetailScreen(
    call: CallEntity,
    serverUrl: String,
    token: String,
    onBack: () -> Unit,
    onOpenLead: (String) -> Unit,
    onOutcomeSaved: (CallEntity) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var showOutcomeSheet by remember { mutableStateOf(false) }
    var showConvertSheet by remember { mutableStateOf(false) }
    var callInfoExpanded by remember { mutableStateOf(true) }
    var currentCall by remember { mutableStateOf(call) }

    // Audio Playback State
    var isPlaying by remember { mutableStateOf(false) }
    var currentPositionMs by remember { mutableStateOf(0) }
    var durationMs by remember { mutableStateOf(call.durationSec * 1000) }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    // Cleanup MediaPlayer on exit
    DisposableEffect(Unit) {
        onDispose {
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    // Progress updater coroutine
    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    currentPositionMs = it.currentPosition
                    durationMs = it.duration
                }
            }
            delay(200)
        }
    }

    val togglePlayPause = {
        val path = currentCall.audioFilePath
        if (path.isNullOrEmpty() || !File(path).exists()) {
            Toast.makeText(context, "Audio file not available locally", Toast.LENGTH_SHORT).show()
        } else {
            try {
                if (mediaPlayer == null) {
                    mediaPlayer = MediaPlayer().apply {
                        setDataSource(path)
                        prepare()
                        setOnCompletionListener {
                            isPlaying = false
                            currentPositionMs = 0
                        }
                    }
                }
                if (isPlaying) {
                    mediaPlayer?.pause()
                    isPlaying = false
                } else {
                    mediaPlayer?.start()
                    isPlaying = true
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Playback error: ${e.message}", Toast.LENGTH_SHORT).show()
                isPlaying = false
            }
        }
    }

    val seekTo: (Float) -> Unit = { progress ->
        mediaPlayer?.let {
            val targetMs = (progress * durationMs).toInt()
            it.seekTo(targetMs)
            currentPositionMs = targetMs
        }
    }

    val formattedTime = remember(currentCall.startedAt) {
        val sdf = SimpleDateFormat("EEE, dd MMM · hh:mm a", Locale.getDefault())
        sdf.format(Date(currentCall.startedAt))
    }

    val formatSecToMinSec: (Int) -> String = { totalSec ->
        val m = totalSec / 60
        val s = totalSec % 60
        String.format(Locale.getDefault(), "%02d:%02d", m, s)
    }

    val leadName = currentCall.contactName?.takeIf { it.isNotBlank() } ?: currentCall.phoneNumber

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
        containerColor = ScreenBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            // Contact Header matching Screenshots 7 & 9
            Text(
                text = leadName,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = TextDark,
                letterSpacing = (-0.5).sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = currentCall.phoneNumber,
                fontSize = 14.sp,
                color = TextSubtle,
                fontWeight = FontWeight.Medium
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Badges Row (Stage & Direction/Duration)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Stage Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFFDCFCE7))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = currentCall.tags?.takeIf { it.isNotBlank() } ?: "Connected",
                        color = Color(0xFF166534),
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }

                // Call metadata pill
                val isOutgoing = currentCall.direction.equals("OUTBOUND", ignoreCase = true)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFFF1F5F9))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = if (isOutgoing) Icons.Default.CallMade else Icons.Default.CallReceived,
                        contentDescription = null,
                        tint = BrandBlue,
                        modifier = Modifier.size(13.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${if (isOutgoing) "Outgoing" else "Incoming"} · ${currentCall.durationSec}s · $formattedTime",
                        fontSize = 11.sp,
                        color = TextDark,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Action Buttons: [+ Add outcome] & [+ Convert to Lead]
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = { showOutcomeSheet = true },
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (currentCall.notes.isNullOrBlank() && currentCall.tags.isNullOrBlank()) "Outcome" else "Outcome",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Button(
                    onClick = { showConvertSheet = true },
                    modifier = Modifier
                        .weight(1.3f)
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Convert to Lead",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 3 Quick Action Buttons: [Call] [WhatsApp] [Open lead] matching Screenshots 7 & 9
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Call
                OutlinedButton(
                    onClick = {
                        val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${currentCall.phoneNumber}"))
                        context.startActivity(dialIntent)
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = CardBackground),
                    border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null, tint = BrandBlue, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Call", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                }

                // WhatsApp
                OutlinedButton(
                    onClick = {
                        try {
                            val cleanPhone = currentCall.phoneNumber.replace("+", "").replace(" ", "").trim()
                            val waIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$cleanPhone"))
                            context.startActivity(waIntent)
                        } catch (e: Exception) {
                            Toast.makeText(context, "Could not open WhatsApp", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier
                        .weight(1.1f)
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = CardBackground),
                    border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Icon(Icons.Default.Chat, contentDescription = null, tint = Color(0xFF25D366), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("WhatsApp", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                }

                // Open Lead
                OutlinedButton(
                    onClick = { onOpenLead(currentCall.phoneNumber) },
                    modifier = Modifier
                        .weight(1.2f)
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = CardBackground),
                    border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = TextDark, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Open lead", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextDark)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Audio Player Card matching Screenshots 7 & 9
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // Play/Pause circular button
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF0F172A))
                                .clickable { togglePlayPause() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        // Draggable Slider
                        val progress = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f
                        Slider(
                            value = progress,
                            onValueChange = { seekTo(it) },
                            modifier = Modifier.weight(1f),
                            colors = SliderDefaults.colors(
                                thumbColor = BrandBlue,
                                activeTrackColor = BrandBlue,
                                inactiveTrackColor = Color(0xFFE2E8F0)
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatSecToMinSec(currentPositionMs / 1000),
                            fontSize = 11.sp,
                            color = TextSubtle,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = formatSecToMinSec(if (durationMs > 0) durationMs / 1000 else currentCall.durationSec),
                            fontSize = 11.sp,
                            color = TextSubtle,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Collapsible "Call info" Card matching Screenshots 9 & 10
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { callInfoExpanded = !callInfoExpanded },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Call info", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextDark)
                        Icon(
                            imageVector = if (callInfoExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            contentDescription = null,
                            tint = TextSubtle,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    AnimatedVisibility(visible = callInfoExpanded) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Started", fontSize = 13.sp, color = TextSubtle)
                                Text(formattedTime, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextDark)
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Duration", fontSize = 13.sp, color = TextSubtle)
                                Text("${currentCall.durationSec}s", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextDark)
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Direction", fontSize = 13.sp, color = TextSubtle)
                                Text(
                                    if (currentCall.direction.equals("OUTBOUND", ignoreCase = true)) "Outgoing" else "Incoming",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextDark
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Recording", fontSize = 13.sp, color = TextSubtle)
                                Text(
                                    if (!currentCall.audioFilePath.isNullOrEmpty()) "Attached" else "Not available",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (!currentCall.audioFilePath.isNullOrEmpty()) Color(0xFF16A34A) else TextSubtle
                                )
                            }
                            val callNotes = currentCall.notes
                            if (!callNotes.isNullOrBlank()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Notes", fontSize = 13.sp, color = TextSubtle)
                                    Text(callNotes, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = TextDark)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Call Outcome Modal Bottom Sheet matching Screenshots 7 & 8
    if (showOutcomeSheet) {
        CallOutcomeBottomSheet(
            call = currentCall,
            serverUrl = serverUrl,
            token = token,
            onDismiss = { showOutcomeSheet = false },
            onSaved = { updatedCall ->
                currentCall = updatedCall
                onOutcomeSaved(updatedCall)
                showOutcomeSheet = false
            }
        )
    }

    if (showConvertSheet) {
        ConvertToLeadBottomSheet(
            phoneNumber = currentCall.phoneNumber,
            initialName = currentCall.contactName?.takeIf { it.isNotBlank() } ?: currentCall.phoneNumber,
            serverUrl = serverUrl,
            token = token,
            onDismiss = { showConvertSheet = false },
            onConverted = { newName ->
                currentCall = currentCall.copy(contactName = newName)
                onOutcomeSaved(currentCall)
                showConvertSheet = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallOutcomeBottomSheet(
    call: CallEntity,
    serverUrl: String,
    token: String,
    onDismiss: () -> Unit,
    onSaved: (CallEntity) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var isConnectedSelected by remember { mutableStateOf(call.status == "CONNECTED") }
    var selectedOutcome by remember { mutableStateOf(call.tags ?: "") }
    var scheduleFollowup by remember { mutableStateOf(false) }
    var notesText by remember { mutableStateOf(call.notes ?: "") }
    var isSaving by remember { mutableStateOf(false) }

    val connectedOptions = listOf("Interested", "Callback Requested", "Not Interested", "Converted")
    val notConnectedOptions = listOf("Not Picked", "Wrong Number")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .padding(bottom = 32.dp)
        ) {
            Text(
                text = "Call outcome",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Connected vs Not Connected Segmented Switch matching Screenshots 7 & 8
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFFF1F5F9))
                    .padding(4.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isConnectedSelected) Color.White else Color.Transparent)
                            .clickable {
                                isConnectedSelected = true
                                selectedOutcome = ""
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Connected",
                            fontWeight = if (isConnectedSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isConnectedSelected) TextDark else TextSubtle,
                            fontSize = 13.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (!isConnectedSelected) Color.White else Color.Transparent)
                            .clickable {
                                isConnectedSelected = false
                                selectedOutcome = ""
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Not connected",
                            fontWeight = if (!isConnectedSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (!isConnectedSelected) TextDark else TextSubtle,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text("Outcome", fontSize = 12.sp, color = TextSubtle, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(8.dp))

            // Chips List
            val currentOptions = if (isConnectedSelected) connectedOptions else notConnectedOptions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                currentOptions.forEach { opt ->
                    val isSelected = selectedOutcome == opt
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .border(
                                width = 1.dp,
                                color = if (isSelected) BrandBlue else BorderLight,
                                shape = RoundedCornerShape(20.dp)
                            )
                            .background(if (isSelected) Color(0xFFEFF6FF) else Color.White)
                            .clickable { selectedOutcome = opt }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = opt,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) BrandBlue else TextDark
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Follow-up Switch Row matching Screenshots 7 & 8
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val tomorrow = Calendar.getInstance().apply {
                        add(Calendar.DAY_OF_YEAR, 1)
                        set(Calendar.HOUR_OF_DAY, 10)
                        set(Calendar.MINUTE, 0)
                    }
                    val formattedTomorrow = SimpleDateFormat("EEE, dd MMM · 10:00 AM", Locale.getDefault()).format(tomorrow.time)

                    Text(
                        text = "Follow up $formattedTomorrow",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextDark
                    )

                    Switch(
                        checked = scheduleFollowup,
                        onCheckedChange = { scheduleFollowup = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = BrandBlue
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Notes Text Input
            OutlinedTextField(
                value = notesText,
                onValueChange = { notesText = it },
                placeholder = { Text("Notes (optional)", fontSize = 13.sp, color = TextSubtle) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = Color(0xFFF8FAFC),
                    focusedContainerColor = Color.White,
                    unfocusedBorderColor = BorderLight,
                    focusedBorderColor = BrandBlue
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = if (selectedOutcome.isEmpty()) "Pick an outcome to save" else "Ready to save",
                fontSize = 11.sp,
                color = TextSubtle
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Save Outcome CTA Button
            val canSave = selectedOutcome.isNotEmpty()
            Button(
                onClick = {
                    if (!canSave) return@Button
                    isSaving = true
                    coroutineScope.launch {
                        withContext(Dispatchers.IO) {
                            try {
                                val cleanBase = serverUrl.removeSuffix("/")
                                val url = "$cleanBase/api/v1/calls/${call.id}/outcome"

                                val tomorrow = Calendar.getInstance().apply {
                                    add(Calendar.DAY_OF_YEAR, 1)
                                    set(Calendar.HOUR_OF_DAY, 10)
                                    set(Calendar.MINUTE, 0)
                                }
                                val isoDate = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                                    timeZone = TimeZone.getTimeZone("UTC")
                                }.format(tomorrow.time)

                                val json = JSONObject().apply {
                                    put("status", if (isConnectedSelected) "CONNECTED" else "NOT_CONNECTED")
                                    put("outcome", selectedOutcome)
                                    put("notes", notesText.trim())
                                    put("scheduleFollowup", scheduleFollowup)
                                    put("followupDate", isoDate)
                                    if (selectedOutcome == "Converted") {
                                        put("updateLeadStage", "WON")
                                    }
                                }

                                val body = json.toString().toRequestBody("application/json".toMediaType())
                                val request = Request.Builder()
                                    .url(url)
                                    .addHeader("Authorization", "Bearer $token")
                                    .post(body)
                                    .build()

                                val response = client.newCall(request).execute()
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful) {
                                        Toast.makeText(context, "Call outcome saved!", Toast.LENGTH_SHORT).show()
                                        val updatedCall = call.copy(
                                            status = if (isConnectedSelected) "CONNECTED" else "MISSED",
                                            tags = selectedOutcome,
                                            notes = notesText.trim()
                                        )
                                        onSaved(updatedCall)
                                    } else {
                                        Toast.makeText(context, "Failed to save outcome", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            } finally {
                                withContext(Dispatchers.Main) {
                                    isSaving = false
                                }
                            }
                        }
                    }
                },
                enabled = canSave && !isSaving,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BrandBlue,
                    disabledContainerColor = Color(0xFFE2E8F0),
                    disabledContentColor = Color(0xFF94A3B8)
                )
            ) {
                Text(
                    text = if (isSaving) "Saving..." else "Save outcome",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConvertToLeadBottomSheet(
    phoneNumber: String,
    initialName: String,
    serverUrl: String,
    token: String,
    onDismiss: () -> Unit,
    onConverted: (String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val client = remember { OkHttpClient() }

    var leadName by remember { mutableStateOf(initialName) }
    var leadStage by remember { mutableStateOf("NEW") }
    var notesText by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    val stageOptions = listOf("NEW", "CONTACTED", "QUALIFIED", "WON")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .padding(bottom = 32.dp)
        ) {
            Text(
                text = "Convert to CRM Lead",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark
            )
            Text(
                text = "Record this contact and all its past/future calls under a Lead",
                fontSize = 12.sp,
                color = TextSubtle
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Contact Name Input
            Text("Lead Name", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextDark)
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = leadName,
                onValueChange = { leadName = it },
                placeholder = { Text("e.g. Rahul Sharma") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Phone number
            Text("Phone Number", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextDark)
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = phoneNumber,
                onValueChange = {},
                readOnly = true,
                enabled = false,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Stage Selection
            Text("Stage", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextDark)
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                stageOptions.forEach { stage ->
                    val isSelected = leadStage == stage
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSelected) BrandBlue else Color(0xFFF1F5F9))
                            .clickable { leadStage = stage }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stage,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else TextDark
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Notes
            Text("Notes (optional)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextDark)
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = notesText,
                onValueChange = { notesText = it },
                placeholder = { Text("Call summary or requirements...") },
                modifier = Modifier.fillMaxWidth().height(60.dp),
                shape = RoundedCornerShape(10.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    if (leadName.isBlank()) return@Button
                    isSaving = true
                    coroutineScope.launch {
                        withContext(Dispatchers.IO) {
                            try {
                                val cleanBase = serverUrl.removeSuffix("/")
                                val url = "$cleanBase/api/v1/calls/convert-to-lead"
                                val json = JSONObject().apply {
                                    put("phoneNumber", phoneNumber)
                                    put("fullName", leadName.trim())
                                    put("stage", leadStage)
                                    put("notes", notesText.trim())
                                }
                                val body = json.toString().toRequestBody("application/json".toMediaType())
                                val request = Request.Builder()
                                    .url(url)
                                    .addHeader("Authorization", "Bearer $token")
                                    .post(body)
                                    .build()

                                val response = client.newCall(request).execute()
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful) {
                                        Toast.makeText(context, "Converted to CRM Lead!", Toast.LENGTH_SHORT).show()
                                        onConverted(leadName.trim())
                                    } else {
                                        Toast.makeText(context, "Failed to convert lead", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            } catch (e: Exception) {
                                withContext(Dispatchers.Main) {
                                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            } finally {
                                withContext(Dispatchers.Main) {
                                    isSaving = false
                                }
                            }
                        }
                    }
                },
                enabled = leadName.isNotBlank() && !isSaving,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
            ) {
                Text(
                    text = if (isSaving) "Saving Lead..." else "Save as Lead",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
