package com.dsncompanion

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// verify against RN <version> on scaffold: ReactPackage signatures (generated MainApplication.kt registers this).
class SmsSignalPackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
    listOf(SmsSignalModule(ctx), CallCaptureModule(ctx)) // CallCapture: DSN-025 labeled prototype

  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
