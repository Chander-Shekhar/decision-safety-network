package com.dsncompanion

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
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
 * DSN-025 (decision 0012): LABELED PROTOTYPE call capture.
 * Records from the device MICROPHONE (RECORD_AUDIO) while the user has the call on SPEAKERPHONE and
 * transcribes on-device with SpeechRecognizer. This does NOT tap the telephony/carrier audio stream.
 * Only recognised TEXT leaves this module (events below); raw audio is never stored or uploaded.
 *
 * Capture runs ONLY between startCapture() and stopCapture() (JS calls these only while the session is
 * open, consented, and the app is foreground). It is never started from a manifest component or service.
 * Events: "dsn:transcript-segment" { text, at }  and  "dsn:capture-status" { active }.
 */
// verify against RN <version> on scaffold: ReactContextBaseJavaModule / invalidate() signatures.
class CallCaptureModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  private val main = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var active = false

  override fun getName() = "CallCapture"

  @ReactMethod
  fun startCapture(promise: Promise) {
    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("NO_PERMISSION", "RECORD_AUDIO not granted")
      return
    }
    main.post {
      if (active) { promise.resolve(true); return@post }
      if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
        // Graceful fallback: caller keeps the controlled transcript. No audio is captured.
        promise.reject("STT_UNAVAILABLE", "On-device speech recognition is not available")
        return@post
      }
      val r = SpeechRecognizer.createSpeechRecognizer(ctx)
      r.setRecognitionListener(listener)
      recognizer = r
      active = true
      emitStatus(true)
      listenOnce()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun stopCapture(promise: Promise) {
    main.post {
      teardown()
      promise.resolve(true)
    }
  }

  // Stubs required by JS NativeEventEmitter.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  // Never leak a live recognizer/mic past the React context.
  override fun invalidate() {
    main.post { teardown() }
    super.invalidate()
  }

  private fun listenOnce() {
    val r = recognizer ?: return
    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false) // final segments only
      putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true) // keep audio on-device where the engine supports it
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }
    runCatching { r.startListening(intent) }.onFailure { teardown() }
  }

  private val listener = object : RecognitionListener {
    override fun onResults(results: Bundle?) {
      val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim()
      if (!text.isNullOrEmpty()) {
        emit("dsn:transcript-segment", Arguments.createMap().apply {
          putString("text", text)
          putString("at", nowIso())
        })
      }
      if (active) listenOnce() // recognizer is one-utterance-at-a-time; keep going while capturing
    }

    override fun onError(error: Int) {
      if (!active) return
      when (error) {
        // Silence / no match are normal on a call; re-arm after a short pause.
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> main.postDelayed({ if (active) listenOnce() }, 300)
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> main.postDelayed({ if (active) { recognizer?.cancel(); listenOnce() } }, 500)
        // Permission revoked, engine failure, etc: stop honestly (status event tells the UI we are NOT capturing).
        else -> teardown()
      }
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onPartialResults(partialResults: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  private fun teardown() {
    val was = active
    active = false
    main.removeCallbacksAndMessages(null)
    recognizer?.let { runCatching { it.cancel() }; runCatching { it.destroy() } }
    recognizer = null
    if (was) emitStatus(false)
  }

  private fun emitStatus(on: Boolean) {
    emit("dsn:capture-status", Arguments.createMap().apply { putBoolean("active", on) })
  }

  // ISO-8601 UTC without java.time, so it works below API 26 (minSdk) without desugaring.
  private fun nowIso(): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    fmt.timeZone = TimeZone.getTimeZone("UTC")
    return fmt.format(Date())
  }

  // Emitting on an inactive catalyst/React instance throws; drop the event safely if so.
  private fun emit(name: String, payload: WritableMap) {
    runCatching {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, payload)
    }
  }
}
