import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Button, PermissionsAndroid, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { onSms, startListening, stopListening } from './src/SmsSignal';

// Demo: the web dev server is exposed to the device via `adb reverse tcp:5173 tcp:5173`
// (and tcp:8787 for the API). Never hard-code a private host or credential here.
const WEB_URL = 'http://localhost:5173';
const HONESTY_LABEL = 'Simulated call audio — this demo does not record calls.';

export default function App(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  // Session is open only after explicit consent + granted permission.
  const [sessionOpen, setSessionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.label} accessibilityRole="text">
        <Text style={styles.labelText}>{HONESTY_LABEL}</Text>
      </View>
      {sessionOpen ? (
        <>
          <WebView ref={webViewRef} source={{ uri: WEB_URL }} style={styles.fill} />
          <View style={styles.bar}>
            <Text style={styles.barText}>Listening for incoming SMS (this session only)</Text>
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
            background — and stops when you end the session. Call audio is simulated; no calls are recorded.
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
