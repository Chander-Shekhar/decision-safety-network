import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Button, PermissionsAndroid, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { onSms, startListening, stopListening } from './src/SmsSignal';
import { onCaptureStatus, onTranscriptSegment, startCapture, stopCapture } from './src/CallCapture';

// Demo: the web dev server is exposed to the device via `adb reverse tcp:5173 tcp:5173`
// (and tcp:8787 for the API). Never hard-code a private host or credential here.
const WEB_URL = 'http://localhost:5173';
// DSN-025 / decision 0012: the label reflects what is ACTUALLY happening on this device.
const LABEL_NOT_CAPTURING = 'Not capturing call audio — controlled transcript only. Prototype call capture is off.';
const LABEL_CAPTURING =
  "Prototype capture — recording this call's audio via the microphone on speakerphone, with your consent.";

export default function App(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  // Session is open only after explicit consent + granted permission.
  const [sessionOpen, setSessionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // DSN-025: prototype call capture is a SEPARATE explicit opt-in on top of the session, gated on the
  // saved call-listening preference relayed by the web app (`dsn:capture-policy`).
  const [captureOn, setCaptureOn] = useState(false);
  const [capturing, setCapturing] = useState(false); // true only while native reports the mic is live
  const [policy, setPolicy] = useState<{ allowed: boolean; callListening: string | null }>({ allowed: false, callListening: null });

  const accept = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        setNotice('SMS permission was not granted. No messages will be observed.');
        return;
      }
      setNotice(null);
      setSessionOpen(true); // the lifecycle effect below registers the native receiver
    } catch {
      setNotice('Could not start the session. No messages are being observed.');
    }
  }, []);

  const withdraw = useCallback(() => {
    setCaptureOn(false);
    setSessionOpen(false); // triggers the lifecycle effect cleanup, which unregisters the receiver
  }, []);

  // Native listening is scoped to an open session AND the foreground. The receiver is registered
  // only while the app is active and unregistered on background or session end, so the consent
  // promise ("never listens in the background") stays literally true.
  useEffect(() => {
    if (!sessionOpen) return undefined;
    if (AppState.currentState === 'active') void startListening();
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void startListening();
      else void stopListening();
    });
    return () => {
      appSub.remove();
      void stopListening(); // session end / unmount: receiver is unregistered
    };
  }, [sessionOpen]);

  // Bridge: native event -> fixed envelope -> WebView. Subscribed only while a session is open.
  useEffect(() => {
    if (!sessionOpen) return undefined;
    const sub = onSms(({ from, body, receivedAt }) => {
      const envelope = JSON.stringify({ type: 'dsn:sms-signal', from, body, receivedAt });
      webViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(envelope)}, '*'); true;`);
    });
    return () => sub.remove();
  }, [sessionOpen]);

  // Belt and braces: whenever capture is not allowed, the opt-in is cleared (also fixes the bar state).
  useEffect(() => {
    if (!policy.allowed) setCaptureOn(false);
  }, [policy.allowed]);

  // Prototype capture: mic is live only while a session is open, capture is opted in, the saved
  // preference allows it, and the app is in the foreground. Torn down on background/withdrawal/end.
  useEffect(() => {
    if (!sessionOpen || !captureOn || !policy.allowed) return undefined;
    const begin = () => startCapture().catch(() => {
      setCaptureOn(false);
      setNotice('On-device speech recognition is unavailable or permission was lost. Not capturing; use the controlled transcript.');
    });
    if (AppState.currentState === 'active') void begin();
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void begin();
      else void stopCapture();
    });
    return () => {
      appSub.remove();
      void stopCapture();
    };
  }, [sessionOpen, captureOn, policy.allowed]);

  // Bridge: recognised text -> fixed envelope -> WebView (same segment pipeline as the controlled transcript).
  useEffect(() => {
    if (!sessionOpen) return undefined;
    const post = (envelope: object) =>
      webViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify(envelope))}, '*'); true;`);
    const segSub = onTranscriptSegment(({ text, at }) => post({ type: 'dsn:transcript-segment', text, at }));
    const statusSub = onCaptureStatus(({ active, onDevice }) => {
      setCapturing(active);
      post({ type: 'dsn:capture-status', active, onDevice: active && onDevice === true });
    });
    return () => {
      segSub.remove();
      statusSub.remove();
      setCapturing(false);
    };
  }, [sessionOpen]);

  const startPrototypeCapture = useCallback(async () => {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        setNotice('Microphone permission was not granted. Not capturing.');
        return;
      }
      setNotice(null);
      setCaptureOn(true);
    } catch {
      setNotice('Could not start capture. Not capturing.');
    }
  }, []);

  // The web app reports the saved call-listening preference; anything else from the page is ignored.
  const onWebMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type?: string; allowed?: unknown; callListening?: unknown };
      if (m.type !== 'dsn:capture-policy') return;
      // Any disallow clears the opt-in at once: consent must be re-tapped before the mic can run again.
      if (m.allowed !== true) setCaptureOn(false);
      setPolicy({ allowed: m.allowed === true, callListening: typeof m.callListening === 'string' ? m.callListening : null });
    } catch {
      /* ignore non-JSON */
    }
  }, []);

  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.label} accessibilityRole="text">
        <Text style={styles.labelText}>{capturing ? LABEL_CAPTURING : LABEL_NOT_CAPTURING}</Text>
      </View>
      {sessionOpen ? (
        <>
          <WebView ref={webViewRef} source={{ uri: WEB_URL }} style={styles.fill} onMessage={onWebMessage} />
          <View style={styles.bar}>
            <Text style={styles.barText}>Listening for incoming SMS (this session only)</Text>
            {captureOn ? (
              <Button title="Stop prototype call capture" onPress={() => setCaptureOn(false)} />
            ) : policy.allowed ? (
              <>
                <Text style={styles.barText}>
                  Prototype call capture (call-listening: {policy.callListening}): records via the microphone while your
                  call is on speakerphone, transcribes with the device's speech recognizer (offline preferred; some engines may use an online service), and sends only text to DSN. Foreground only.
                </Text>
                <Button title="I consent - start prototype call capture" onPress={startPrototypeCapture} />
              </>
            ) : (
              <Text style={styles.barText}>
                Prototype call capture unavailable: finish setup and enable processing consent in your Safety Plan.
              </Text>
            )}
            <Button title="Withdraw consent / end session" onPress={withdraw} />
          </View>
        </>
      ) : (
        <View style={styles.consent}>
          <Text style={styles.title}>Consent to observe incoming SMS</Text>
          <Text style={styles.body}>
            While this demo session is open, the app observes incoming SMS messages and shows them in the
            Decision view as message claims (not verified facts). It never reads your SMS history and
            observes only while this session is open and the app is in the foreground — never in the
            background — and stops when you end the session. Call audio is NOT captured unless you separately opt
            in to the prototype call capture after the session starts (microphone on speakerphone; text only).
          </Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Button title="I consent - start session" onPress={accept} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  label: { backgroundColor: '#fff4cc', padding: 6 },
  labelText: { color: '#5c4400', fontSize: 12, textAlign: 'center' },
  consent: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 15, marginBottom: 16 },
  notice: { color: '#8a1c1c', marginBottom: 12 },
  bar: { padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  barText: { fontSize: 12, marginBottom: 4 },
});
