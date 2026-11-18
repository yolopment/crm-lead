package com.crmlead.companion.sim

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
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

        return result
    }
}

