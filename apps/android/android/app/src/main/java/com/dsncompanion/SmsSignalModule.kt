package com.dsncompanion

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * DSN-020: consented, session-scoped SMS signal.
 * The SMS_RECEIVED receiver is registered programmatically ONLY between startListening() and
 * stopListening() (never in the manifest, so never always-on/background). Never reads SMS history.
 * Emits one "dsn:sms-signal" event per incoming message: { from, body, receivedAt }.
 */
// verify against RN <version> on scaffold: ReactContextBaseJavaModule / invalidate() signatures.
class SmsSignalModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private var receiver: BroadcastReceiver? = null

  override fun getName() = "SmsSignal"

  @ReactMethod
  fun startListening(promise: Promise) {
    if (receiver != null) { promise.resolve(true); return }
    val r = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        for (msg in Telephony.Sms.Intents.getMessagesFromIntent(intent)) {
          val payload = Arguments.createMap().apply {
            putString("from", msg.originatingAddress ?: "unknown")
            putString("body", msg.messageBody ?: "")
            putString("receivedAt", java.time.Instant.now().toString())
          }
          ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("dsn:sms-signal", payload)
        }
      }
    }
    // SMS_RECEIVED is a system broadcast: require the sender to hold BROADCAST_SMS; exported flag for API 33+.
    ContextCompat.registerReceiver(
      ctx, r, IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION),
      Manifest.permission.BROADCAST_SMS, null, ContextCompat.RECEIVER_EXPORTED
    )
    receiver = r
    promise.resolve(true)
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    unregister()
    promise.resolve(true)
  }

  // Stubs required by JS NativeEventEmitter.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  // Never leak a live receiver past the React context.
  override fun invalidate() {
    unregister()
    super.invalidate()
  }

  private fun unregister() {
    receiver?.let { runCatching { ctx.unregisterReceiver(it) } }
    receiver = null
  }
}
