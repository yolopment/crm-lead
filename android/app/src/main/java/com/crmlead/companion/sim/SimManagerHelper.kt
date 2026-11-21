package com.crmlead.companion.sim

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.os.Build
import android.provider.CallLog
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import androidx.core.content.ContextCompat

data class SimInfo(
    val slotIndex: Int,
    val subscriptionId: Int,
    val displayName: String,
    val carrierName: String
)

object SimManagerHelper {

    fun getActiveSimCards(context: Context): List<SimInfo> {
        val result = mutableListOf<SimInfo>()

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) {
            return result
        }

        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            return result
        }

        try {
            val sm = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            val subList: List<SubscriptionInfo>? = sm?.activeSubscriptionInfoList

            if (!subList.isNullOrEmpty()) {
                for (info in subList) {
                    val slot = info.simSlotIndex
                    val name = info.displayName?.toString() ?: "SIM ${slot + 1}"
                    val carrier = info.carrierName?.toString() ?: "Carrier"
                    result.add(
                        SimInfo(
                            slotIndex = slot,
                            subscriptionId = info.subscriptionId,
                            displayName = name,
                            carrierName = carrier
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        result.sortBy { it.slotIndex }
        return result
    }

    /**
     * Resolves which physical SIM slot (0 for SIM 1, 1 for SIM 2) a call was placed or received on.
     * Evaluates standard AOSP columns, OEM MediaTek/Xiaomi columns, and active subscription IDs.
     * Returns 0 or 1 if resolved, or -1 if unknown / cannot be determined.
     */
    fun resolveCallSimSlot(cursor: Cursor, simCards: List<SimInfo>): Int {
        // Tier 1: Check direct OEM slot columns (sim_slot_index, slot_id, slot, sim_slot)
        val slotColNames = arrayOf("sim_slot_index", "slot_id", "slot", "sim_slot")
        for (colName in slotColNames) {
            val idx = cursor.getColumnIndex(colName)
            if (idx >= 0 && !cursor.isNull(idx)) {
                val rawSlot = cursor.getInt(idx)
                if (rawSlot in 0..1) return rawSlot
            }
        }

        // Tier 2: Check sim_id / simid column (Very common in Xiaomi / MediaTek / Oppo)
        val simIdColNames = arrayOf("sim_id", "simid")
        for (colName in simIdColNames) {
            val idx = cursor.getColumnIndex(colName)
            if (idx >= 0 && !cursor.isNull(idx)) {
                val v = cursor.getInt(idx)
                // Often 0 is SIM 1, 1 is SIM 2.
                if (v in 0..1) return v
                // In some ROMs, sim_id holds the subscriptionId
                val match = simCards.firstOrNull { it.subscriptionId == v }
                if (match != null) return match.slotIndex
            }
        }

        // Tier 3: Check sub_id / subscription_id column
        val subIdColNames = arrayOf("sub_id", "subscription_id")
        for (colName in subIdColNames) {
            val idx = cursor.getColumnIndex(colName)
            if (idx >= 0 && !cursor.isNull(idx)) {
                val subId = cursor.getInt(idx)
                val match = simCards.firstOrNull { it.subscriptionId == subId }
                if (match != null) return match.slotIndex
                if (subId in 0..1 && simCards.none { it.subscriptionId == subId }) return subId
            }
        }

        // Tier 4: Check standard PHONE_ACCOUNT_ID (AOSP / Samsung / Pixel / Modern Android)
        val phoneAccIdx = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
        if (phoneAccIdx >= 0 && !cursor.isNull(phoneAccIdx)) {
            val accountId = cursor.getString(phoneAccIdx)?.trim()
            if (!accountId.isNullOrEmpty()) {
                // Check if accountId matches subscriptionId of any active SIM
                val subIdInt = accountId.toIntOrNull()
                if (subIdInt != null) {
                    val match = simCards.firstOrNull { it.subscriptionId == subIdInt }
                    if (match != null) return match.slotIndex
                    // Sometimes accountId is literally "0" for SIM1 or "1" for SIM2
                    if (subIdInt in 0..1) return subIdInt
                }

                // Check if accountId contains ICCID or slot index string
                val lower = accountId.lowercase()
                if (lower.contains("sim2") || lower.contains("slot1") || lower.contains("sub2")) return 1
                if (lower.contains("sim1") || lower.contains("slot0") || lower.contains("sub1")) return 0

                val match = simCards.firstOrNull { accountId == it.subscriptionId.toString() }
                if (match != null) return match.slotIndex
            }
        }

        // Fallback: If only 1 SIM card exists on device, it must be that SIM's slot
        if (simCards.size == 1) {
            return simCards[0].slotIndex
        }

        return -1
    }
}
