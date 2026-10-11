import { NativeModules, NativeEventEmitter } from 'react-native';

// DSN-025: typed wrapper over the native CallCapture module (CallCaptureModule.kt).
// LABELED PROTOTYPE: microphone + speakerphone, on-device STT. See decision 0012 and apps/android/README.md.
export type TranscriptSegmentPayload = { text: string; at: string };
export type CaptureStatusPayload = { active: boolean; onDevice: boolean };

const { CallCapture } = NativeModules;
// verify against RN <version> on scaffold: NativeEventEmitter ctor takes the native module (needs addListener/removeListeners).
const emitter = new NativeEventEmitter(CallCapture);

export function startCapture(): Promise<boolean> {
  return CallCapture.startCapture();
}
export function stopCapture(): Promise<boolean> {
  return CallCapture.stopCapture();
}
export function onTranscriptSegment(cb: (p: TranscriptSegmentPayload) => void) {
  return emitter.addListener('dsn:transcript-segment', cb);
}
export function onCaptureStatus(cb: (p: CaptureStatusPayload) => void) {
  return emitter.addListener('dsn:capture-status', cb);
}
