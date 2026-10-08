import { NativeModules, NativeEventEmitter } from 'react-native';

// DSN-020: typed wrapper over the native SmsSignal module (SmsSignalModule.kt).
// Listening is consented and session-scoped; see apps/android/README.md.
export type SmsSignalPayload = { from: string; body: string; receivedAt: string };

const { SmsSignal } = NativeModules;
// verify against RN <version> on scaffold: NativeEventEmitter ctor takes the native module (needs addListener/removeListeners).
const emitter = new NativeEventEmitter(SmsSignal);

export function startListening(): Promise<boolean> {
  return SmsSignal.startListening();
}
export function stopListening(): Promise<boolean> {
  return SmsSignal.stopListening();
}
export function onSms(cb: (p: SmsSignalPayload) => void) {
  return emitter.addListener('dsn:sms-signal', cb);
}
