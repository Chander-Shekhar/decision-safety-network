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
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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
        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (parts.isEmpty()) return
        // A long SMS arrives as several PDU parts; concatenate into ONE message/claim so the
        // web dedupe key (from, receivedAt) does not fragment it into multiple signals.
        val payload = Arguments.createMap().apply {
          putString("from", parts[0].originatingAddress ?: "unknown")
          putString("body", parts.joinToString(separator = "") { it.messageBody ?: "" })
          putString("receivedAt", nowIso())
        }
        emitSignal(payload)
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

  // ISO-8601 UTC without java.time, so it works below API 26 (minSdk) without desugaring.
  private fun nowIso(): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("UTC")
    return fmt.format(Date())
  }

  // Emitting on an inactive catalyst/React instance throws; drop the signal safely if so.
  private fun emitSignal(payload: WritableMap) {
    runCatching {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("dsn:sms-signal", payload)
    }
  }
}
