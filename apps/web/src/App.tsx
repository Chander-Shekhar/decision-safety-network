import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceSignalList } from './DeviceSignalList';
import { announceCapturePolicy, nextLiveSegment, parseCaptureStatusMessage, parseTranscriptSegmentMessage } from './liveTranscript';
import { parseSmsSignalMessage, ingestSmsSignal, type DeviceSignal } from './deviceSignals';
import type { AllyCallerContact, AllyPacket, AllyPacketContent, AllyWhatsAppSummary } from '../../../packages/contracts/src/ally';
import type { Fact } from '../../../packages/contracts/src/facts';
import type { Plan } from '../../../packages/contracts/src/plan';
import type { PaymentProjection } from '../../../packages/contracts/src/payment';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';
import type { WebVerificationEvidence } from '../../../packages/contracts/src/web-verification';
import type { ReportDraft, ReportHandoffResult } from '../../../packages/contracts/src/report';
import { AboutScreen } from './AboutScreen';
import { ActionConsole } from './ActionConsole';
import { AllyEvidenceSelector, MAX_ALLY_EVIDENCE } from './AllyEvidenceSelector';
import { AllyScreen } from './AllyScreen';
import { AllySharePreview } from './AllySharePreview';
import { ApiError, createApiClient, newIdempotencyKey, withKey, type GetIdToken } from './api-client';
import { AppShell, type AppView } from './AppShell';
import { CasesScreen } from './CasesScreen';
import { DecisionMap } from './DecisionMap';
import { EvidenceScreen, type ReportDraftView } from './EvidenceScreen';
import { HomeScreen } from './HomeScreen';
import { ConfirmFraudPanel, IncomingCallScreen } from './ScreeningScreen';
import type { ScreeningVerdict } from '../../../packages/contracts/src/screening';
import { canVerify, initialStep, journeySteps, type JourneyState, type Step } from './journey';
import { PaymentPanel } from './PaymentPanel';
import { PlanScreen, type AllyStatus } from './PlanScreen';
import { RecoveryScreen } from './RecoveryScreen';
import { SettingsScreen, type SettingsValues } from './SettingsScreen';
import { SessionInput } from './SessionInput';
import { SessionScreen, type SessionSegmentView } from './SessionScreen';
import { Button, Callout, Dialog, StepRail } from './ui';
import { VerifyPanel, type VerifyPanelRegistry, type VerifyPanelResult } from './VerifyPanel';

/** The pre-added sample Safety Ally, so the ally setup reads as ready out of the box. */
const SAMPLE_ALLY_NAME = 'Priya Nair';

/**
 * Auth boundary injected by `main.tsx`. The real implementation (Firebase
 * client SDK sign-in against the Auth emulator or production) is the
 * DSN-014-blocked wiring point: the `firebase` client package is not a
 * dependency yet, so this shell depends only on this interface.
 */
export interface AuthProvider {
  signInSynthetic(role: 'owner' | 'ally'): Promise<void>;
  getIdToken: GetIdToken;
}

type CaseView = Partial<PaymentProjection> & {
  id: string;
  version: number;
  facts?: Record<string, Fact>;
  confirmed?: Record<string, Fact>;
};

interface AllyPreview {
  packet: AllyPacketContent;
  packetHash: string;
  caseVersion: number;
  selectedEvidenceIds: string[];
}

/** Reads a File into base64 (no `data:` prefix), for the transcription upload (DSN-030). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function App({ auth }: { auth: AuthProvider }): React.JSX.Element {
  const api = useMemo(() => createApiClient(auth.getIdToken), [auth]);
  const [role, setRole] = useState<'owner' | 'ally' | null>(null);
  const [step, setStep] = useState<Step>('Plan');
  const [caseId, setCaseId] = useState<string>(() => /cases\/([^/]+)/.exec(window.location.pathname)?.[1] ?? '');
  const [caseView, setCaseView] = useState<CaseView | null>(null);
  const [segments, setSegments] = useState<SessionSegmentView[]>([]);
  // Ally evidence selection: every segment is shared by default. We track the
  // owner's DE-selections, so segments that arrive after the owner opened the
  // Ally step default to selected without resurrecting ones already dropped.
  const [deselectedEvidenceIds, setDeselectedEvidenceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [allyUid, setAllyUid] = useState<string | null>(null);
  // Ally session: the id of the invitation addressed to this ally (null until the
  // owner redeems this ally's pairing code and the discovery poll finds it).
  const [allyInvitationId, setAllyInvitationId] = useState<string | null>(null);
  // Payee picker (DSN-030): the owner's registered accounts plus a free-text
  // "new payee" the caller named. `newPayee` stays server-derived - the id is
  // only input. '__new__' selects the free-text field.
  const [draftPayee, setDraftPayee] = useState('__new__');
  const [newPayeeId, setNewPayeeId] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  // DSN-030: a transcript paste/audio submit is in flight.
  const [transcriptBusy, setTranscriptBusy] = useState(false);
  // Session step: once a call has been added, the transcript (not the input) is
  // shown; this reveals the "Add the call" input again on demand so the two are
  // never both visible by default.
  const [editingCall, setEditingCall] = useState(false);
  // A sample ally is pre-added so setup reads as ready out of the box; pairing a real ally clears the sample flag.
  const [allyStatus, setAllyStatus] = useState<AllyStatus>('ready');
  const [allyIsSample, setAllyIsSample] = useState(true);
  const [registry, setRegistry] = useState<VerifyPanelRegistry | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyPanelResult | undefined>();
  const [preview, setPreview] = useState<AllyPreview | null>(null);
  const [allyPacket, setAllyPacket] = useState<AllyPacket | null>(null);
  // DSN-027: owner-side WhatsApp summary (minimum packet only) + ally-side contact-caller script.
  const [allyShared, setAllyShared] = useState(false);
  const [whatsappSummary, setWhatsappSummary] = useState<AllyWhatsAppSummary | undefined>();
  const [callerContact, setCallerContact] = useState<AllyCallerContact | undefined>();
  const [allyAccess, setAllyAccess] = useState<'active' | 'stale' | 'revoked'>('active');
  // DSN-028: pre-filled 1930/NCRP report draft + the user-opens-it-themselves handoff.
  const [reportDraft, setReportDraft] = useState<ReportDraftView | undefined>();
  const [reportChannelUrl, setReportChannelUrl] = useState('');
  const [reportHandedOff, setReportHandedOff] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planSavedFlag, setPlanSavedFlag] = useState(false);
  // DSN-023: the owner's saved plan (null = none yet). `planLoaded` gates first-run routing.
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  // Only a 404 means "fresh user". Any other failure leaves planLoaded false so setup can never overwrite a plan we failed to read.
  const [planLoadFailed, setPlanLoadFailed] = useState(false);
  const [planReloadKey, setPlanReloadKey] = useState(0);
  // Top-level navigation surface (burger menu). The in-case journey renders inside the Home view.
  const [view, setView] = useState<AppView>('home');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [deviceSignals, setDeviceSignals] = useState<DeviceSignal[]>([]);
  const [incomingCall, setIncomingCall] = useState(false);
  const [screenedNumber, setScreenedNumber] = useState('');
  // DSN-026: untrusted public-web supporting evidence about the claimed identity, and the number to check.
  const [webEvidence, setWebEvidence] = useState<readonly WebVerificationEvidence[]>([]);
  const [webCheckNumber, setWebCheckNumber] = useState('');
  const stepInitialised = useRef(false);
  const [captureActive, setCaptureActive] = useState(false);
  // Processing revoked / segment refused for this case: tell native to stop the mic (allowed:false).
  const [captureOnDevice, setCaptureOnDevice] = useState(false);
  const [captureEnded, setCaptureEnded] = useState(false);
  const caseIdRef = useRef(caseId);
  caseIdRef.current = caseId;
  const segmentsRef = useRef<SessionSegmentView[]>(segments);
  segmentsRef.current = segments;
  const seenLiveRef = useRef(new Set<string>());

  // Auto sign-in on first load: the demo opens straight into the app, no role picker.
  // Role comes from the URL (`?role=ally` for the ally's own window/device, per the
  // documented two-context model); everyone else is the owner. Anonymous auth returns
  // the same persisted user for a given browser context, so the owner's setup survives
  // reloads within that context.
  const signedInRef = useRef(false);
  useEffect(() => {
    if (signedInRef.current || role) return;
    signedInRef.current = true;
    const initialRole: 'owner' | 'ally' = new URLSearchParams(window.location.search).get('role') === 'ally' ? 'ally' : 'owner';
    void (async () => {
      try {
        await auth.signInSynthetic(initialRole);
        if (initialRole === 'ally') {
          stepInitialised.current = true;
          setStep('Plan');
        }
        setRole(initialRole);
      } catch {
        signedInRef.current = false;
        setError('We could not open the app. Please reload.');
      }
    })();
  }, [auth, role]);

  // Ally session: discover and track the invitation addressed to this ally. The
  // owner usually invites AFTER the ally window is already open, so poll until an
  // invitation appears and is accepted; this is what makes the ally screen react
  // to an invitation and gives "Accept" a real invitation id to act on.
  useEffect(() => {
    if (role !== 'ally') return;
    let cancelled = false;
    const sync = async () => {
      try {
        const { invitations } = await api.get<{ invitations: { id: string; acceptedAt?: string | null }[] }>('ally/invitations');
        if (cancelled) return;
        const active = invitations[0];
        if (!active) {
          setAllyInvitationId(null);
          setAllyStatus('none');
        } else {
          setAllyInvitationId(active.id);
          setAllyStatus(active.acceptedAt ? 'ready' : 'invited');
        }
      } catch {
        // Transient read failure: leave the current state; the next poll retries.
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role, api]);

  // Owner session: once a real ally has been nominated (the client-only sample
  // ally is cleared), poll the owner-keyed invitation read so the Plan/Settings
  // screen reflects when the ally accepts. Acceptance is written on the ally's
  // own device/context, so without this the owner would sit at "awaiting
  // acceptance" forever. The sample-ally demo state is left untouched.
  useEffect(() => {
    if (role !== 'owner' || allyIsSample) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const { invitations } = await api.get<{ invitations: { id: string; allyUid: string; acceptedAt?: string | null }[] }>(
          'owner/invitations',
        );
        if (cancelled) return;
        const active = invitations[0];
        if (!active) {
          setAllyStatus('none');
        } else {
          setAllyUid(active.allyUid);
          setAllyInvitationId(active.id);
          setAllyStatus(active.acceptedAt ? 'ready' : 'invited');
        }
      } catch {
        // Transient read failure: leave the current state; the next poll retries.
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role, allyIsSample, api]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? `Request failed (${e.code}). Nothing was changed.` : 'Something went wrong. Nothing was changed.');
    }
  }, []);

  const refreshCase = useCallback(
    async (id: string) => {
      setCaseView(await api.get<CaseView>(`cases/${id}`));
    },
    [api],
  );

  // Ids the owner is sharing with the ally: all current segments minus any de-selected.
  const selectedEvidenceIds = useMemo(
    () => segments.filter((segment) => !deselectedEvidenceIds.has(segment.id)).map((segment) => segment.id),
    [segments, deselectedEvidenceIds],
  );
  const toggleEvidence = useCallback((id: string) => {
    setDeselectedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // DSN-026: fetch the case's stored untrusted web evidence. Supporting evidence only; never the official route.
  const loadWebEvidence = useCallback(
    async (id: string) => {
      const res = await api.get<{ evidence: WebVerificationEvidence[] }>(`cases/${id}/web-verification`);
      setWebEvidence(res.evidence);
    },
    [api],
  );

  const version = caseView?.version ?? 0;
  const facts = Object.keys({ ...caseView?.facts, ...caseView?.confirmed }).map(
    (field) => (caseView?.confirmed?.[field] ?? caseView?.facts?.[field]) as Fact,
  );
  // The caller's claimed identity, as currently displayed; drives the public-web lookup.
  const claimedIdentity = (caseView?.confirmed?.claimedIdentity ?? caseView?.facts?.claimedIdentity)?.value;
  const owner = role === 'owner';
  const configured = !!plan?.setupCompletedAt;
  // A fresh owner (no completed setup, not deep-linked into a case) is routed into guided setup.
  const needsSetup = owner && planLoaded && !configured && !caseId;

  const journeyState: JourneyState = {
    role,
    planSaved: planSavedFlag || !!caseView || !!plan?.setupCompletedAt,
    caseId,
    phase: caseView?.phase,
    factsExtracted: facts.length > 0,
    paymentExists: !!caseView?.paymentDraft,
    hasVerification: !!verifyResult,
    recoveryEntered: !!recovery || caseView?.phase === 'Recover',
    hasConfirmedFacts: facts.some((f) => !!caseView?.confirmed?.[f.field]),
  };
  const verifyGate = canVerify(journeyState);
  // The ally still needs the Plan step to accept an invitation, so keep it reachable for that role.
  const railSteps = journeySteps(journeyState).map((s) => (role === 'ally' && s.step === 'Plan' ? { step: s.step, available: true } : s));

  // DSN-020: consented on-device SMS signals (native shell only). Inert in a plain browser.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return; // only the page's own bridge (injectJavaScript), not frames/other windows
      const sig = parseSmsSignalMessage(e.data);
      if (sig) setDeviceSignals((prev) => ingestSmsSignal(prev, sig));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // DSN-025: labeled prototype capture. The native shell sends final STT text segments (never audio)
  // and a capture-status flag. Segments join the SAME segment API + extraction pass as the controlled
  // transcript; nothing downstream changes. Inert in a plain browser and until a case is open.
  useEffect(() => {
    let queue: Promise<void> = Promise.resolve();
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return; // only the page's own bridge (injectJavaScript), not frames/other windows
      const status = parseCaptureStatusMessage(e.data);
      if (status) {
        setCaptureActive(status.active);
        setCaptureOnDevice(status.onDevice);
        return;
      }
      const sig = parseTranscriptSegmentMessage(e.data);
      const id = caseIdRef.current;
      if (!sig || !id) return;
      const segment = nextLiveSegment(segmentsRef.current, seenLiveRef.current, sig);
      if (!segment) return;
      segmentsRef.current = [...segmentsRef.current, segment];
      setSegments(segmentsRef.current);
      // Serialized so orders stay gap-free and in order on the server.
      queue = queue.then(() =>
        run(async () => {
          try {
            await api.command('POST', `cases/${id}/segments`, segment);
          } catch (err) {
            // Not accepted (e.g. processing revoked): drop it locally so the view never shows unaccepted text.
            setCaptureEnded(true); // fail safe: a refused segment means the session no longer accepts capture
            segmentsRef.current = segmentsRef.current.filter((s) => s.id !== segment.id);
            setSegments(segmentsRef.current);
            throw err;
          }
          await refreshCase(id);
          const latest = await api.get<CaseView>(`cases/${id}`);
          await api.command('POST', `cases/${id}/facts/extract`, { expectedVersion: latest.version });
          await refreshCase(id);
        }),
      );
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [api, run, refreshCase]);

  // DSN-025: relay the saved call-listening preference to the native shell so capture is gated on it.
  useEffect(() => {
    announceCapturePolicy(plan, captureEnded);
  }, [plan, captureEnded]);

  // Load the owner's plan once signed in; a missing plan (404) simply means a fresh user.
  useEffect(() => {
    if (!owner) return;
    let live = true;
    setPlanLoadFailed(false);
    api
      .get<Plan>('plan')
      .then((loaded) => {
        if (!live) return;
        setPlan(loaded);
        setPlanLoaded(true);
        // A stored real nomination clears the client-only sample ally, so the
        // owner invitation poll (below) runs and reflects true acceptance state
        // even on a fresh reload.
        if (loaded.nominatedAllyUid) setAllyIsSample(false);
      })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setPlanLoaded(true);
        else setPlanLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [owner, api, planReloadKey]);

  // Deep-link / reload: load the case once the owner is signed in, so gating sees the real phase.
  useEffect(() => {
    if (owner && caseId) void run(() => refreshCase(caseId));
  }, [owner, caseId, run, refreshCase]);

  // DSN-026: load any stored web evidence when the case opens; default the lookup number to the screened one.
  useEffect(() => {
    if (owner && caseId) void run(() => loadWebEvidence(caseId));
  }, [owner, caseId, run, loadWebEvidence]);
  useEffect(() => {
    if (screenedNumber) setWebCheckNumber(screenedNumber);
  }, [screenedNumber]);

  // DSN-028: load the pre-filled report draft when the owner is on the Evidence step (and when the case changes there).
  useEffect(() => {
    if (!(owner && caseId && step === 'Evidence')) return;
    void run(async () => {
      const draft = await api.get<ReportDraft>(`cases/${caseId}/report-draft`);
      setReportChannelUrl(draft.handoff.channelUrl);
      setReportDraft({
        label: draft.label,
        sourceDate: draft.sourceDate,
        fields: draft.fields.map((f) => ({
          ncrpField: f.ncrpField,
          value: f.value,
          blank: f.blank,
          provenanceLabel: f.provenance?.provenanceLabel ?? '',
        })),
        recoveryScamWarning: draft.recoveryScamWarning,
        channelLabel: draft.handoff.channelLabel,
      });
    });
  }, [owner, caseId, step, version, api, run]);

  // Pick the starting step once, after the case (if any) has loaded. Pure client state; no API call.
  useEffect(() => {
    if (!role || stepInitialised.current) return;
    if (role === 'owner' && caseId && !caseView) return;
    if (role === 'owner' && !caseId && !planLoaded) return;
    stepInitialised.current = true;
    // A configured owner with no open case lands on Home (the Plan step); everyone else follows the journey.
    setStep(role === 'owner' && configured && !caseId ? 'Plan' : initialStep(journeyState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, caseId, caseView, planLoaded]);

  return (
    <AppShell
      view={view}
      onNavigate={navigate}
      allyMode={role === 'ally'}
      onExitAllyView={exitAllyView}
      banner={
        error ? (
          <Callout kind="error" role="alert">
            {error}
          </Callout>
        ) : undefined
      }
    >
      {!role && <p className="text-text-muted">Opening…</p>}

      {owner && view === 'about' && <AboutScreen />}

      {owner && view === 'cases' && (
        <CasesScreen
          currentCaseId={caseId || undefined}
          onOpenCurrent={() => {
            setView('home');
            setStep('Decision');
          }}
          onStartSession={() => {
            setView('home');
            setStep('Session');
          }}
        />
      )}

      {owner && view === 'settings' && (
        <SettingsScreen
          initial={
            plan
              ? {
                  callListening: plan.callListening,
                  processingConsent: plan.processingConsent,
                  allySharingConsent: plan.allySharingConsent,
                  allyShareFields: plan.allyShareFields,
                  bankAccounts: plan.bankAccounts,
                  thresholdMinor: plan.thresholdMinor,
                  retentionMode: plan.retentionMode,
                  exportConsent: plan.exportConsent,
                }
              : undefined
          }
          allyStatus={allyStatus}
          allyName={SAMPLE_ALLY_NAME}
          allyIsSample={allyIsSample}
          saving={savingSetup}
          saved={settingsSaved}
          onSave={({ allyPairingCode, ...values }: SettingsValues) =>
            run(async () => {
              const wasFirstRun = !configured;
              setSavingSetup(true);
              setSettingsSaved(false);
              try {
                const saved = await api.command<Plan>('PUT', 'plan', {
                  ...values,
                  bankId: 'demo-bank',
                  completeSetup: true,
                });
                setPlan(saved);
                setPlanSavedFlag(true);
                setSettingsSaved(true);
                if (allyPairingCode) {
                  const invitation = await api.command<{ allyUid: string }>('POST', 'ally-invitations', { pairingCode: allyPairingCode });
                  setAllyUid(invitation.allyUid);
                  setAllyStatus('invited');
                  setAllyIsSample(false);
                }
                if (wasFirstRun) {
                  setStep('Plan');
                  setView('home');
                }
              } finally {
                setSavingSetup(false);
              }
            })
          }
        />
      )}

      {role && view === 'home' && (
        <>
          {owner && !caseId && planLoadFailed && !planLoaded && (
            <Callout kind="error" role="alert">
              <p>We couldn&apos;t load your settings, so nothing was changed.</p>
              <Button variant="secondary" onClick={() => setPlanReloadKey((k) => k + 1)}>
                Retry
              </Button>
            </Callout>
          )}

          {owner && !needsSetup && (caseId || step !== 'Plan') && <StepRail steps={railSteps} current={step} onSelect={setStep} />}

          {owner && needsSetup && (
            <HomeScreen
              firstRun
              allyStatus={allyStatus}
              onStartSession={() => setView('settings')}
              onOpenSettings={() => setView('settings')}
            />
          )}

          {owner && !needsSetup && configured && plan && step === 'Plan' && !incomingCall && (
            <HomeScreen
              plan={plan}
              allyStatus={allyStatus}
              allyIsSample={allyIsSample}
              onStartSession={() => setStep('Session')}
              onOpenSettings={() => setView('settings')}
              onIncomingCall={() => setIncomingCall(true)}
            />
          )}

          {owner && !needsSetup && configured && step === 'Plan' && incomingCall && (
            <IncomingCallScreen
              onScreen={(number) => api.command<ScreeningVerdict>('POST', 'screening/check', { number })}
              onAnswer={(number) => {
                setScreenedNumber(number);
                setIncomingCall(false);
                setStep('Session');
              }}
              onDecline={() => setIncomingCall(false)}
            />
          )}

          {role === 'ally' && step === 'Plan' && (
            <PlanScreen
              role="ally"
              allyStatus={allyStatus}
              pairingCode={pairingCode}
              onRequestPairingCode={() =>
                run(async () => {
                  const issued = await api.command<{ code: string }>('POST', 'ally-pairing-code');
                  setPairingCode(issued.code);
                })
              }
              onAcceptInvitation={() =>
                run(async () => {
                  if (!allyInvitationId) return; // nothing to accept until an invitation has arrived
                  await api.command('POST', `ally-invitations/${allyInvitationId}/accept`);
                  setAllyStatus('ready');
                })
              }
              onSavePlan={() => run(async () => setStep('Ally'))}
            />
          )}

        {owner && step === 'Session' && (
          <section aria-label="Controlled session">
            {!caseId ? (
              <Button
                onClick={() =>
                  run(async () => {
                    const created = await api.command<CaseView>('POST', 'cases');
                    setCaseId(created.id);
                    setCaptureEnded(false);
                    window.history.pushState({}, '', `/cases/${created.id}`);
                    await refreshCase(created.id);
                  })
                }
              >
                Start controlled session
              </Button>
            ) : (
              <p>Case {caseId}</p>
            )}
            {caseId && (
              <>
                {/* The "Live session" transcript shows while native is capturing, or once any
                    call has been added. On the web before a call is added it stays hidden so the
                    step isn't two competing panels at once. */}
                {(captureActive || segments.length > 0) && (
                  <SessionScreen
                    status="processing"
                    segments={segments}
                    captureActive={captureActive}
                    captureOnDevice={captureOnDevice}
                    onStopProcessing={() =>
                      run(async () => {
                        await api.command('POST', `cases/${caseId}/processing/revoke`);
                        setCaptureEnded(true); // native stops the mic and drops the recording label
                      })
                    }
                  />
                )}

                {/* The call input is shown only when there's nothing yet, or when the owner
                    explicitly chooses to add/replace the call - never alongside the transcript
                    by default. Native capture owns intake, so the paste/upload input is hidden then. */}
                {!captureActive && (segments.length === 0 || editingCall) ? (
                  <SessionInput
                    busy={transcriptBusy}
                    disabled={!caseId}
                    captureActive={captureActive}
                    onSubmitPaste={(text) =>
                      run(async () => {
                        await submitPastedTranscript(text);
                        setEditingCall(false);
                      })
                    }
                    onSubmitAudio={(audioFile) =>
                      run(async () => {
                        await submitAudioRecording(audioFile);
                        setEditingCall(false);
                      })
                    }
                  />
                ) : (
                  segments.length > 0 &&
                  !captureActive && (
                    <div>
                      <Button variant="secondary" onClick={() => setEditingCall(true)}>
                        Add or edit the call
                      </Button>
                    </div>
                  )
                )}

                {/* Only offer the step forward once there's actually a call to decide on. */}
                {segments.length > 0 && (
                  <div>
                    <Button onClick={() => setStep('Decision')}>Go to the decision</Button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {owner && caseId && step === 'Decision' && (
          <>
            <DecisionMap
              facts={facts}
              webEvidence={webEvidence}
              onConfirm={(field) =>
                run(async () => {
                  await api.command('POST', `cases/${caseId}/facts/${field}/confirm`, { expectedVersion: version });
                  await refreshCase(caseId);
                })
              }
              onCorrect={(field, value) =>
                run(async () => {
                  await api.command('POST', `cases/${caseId}/facts/${field}/correct`, { value, expectedVersion: version });
                  await refreshCase(caseId);
                })
              }
            />
            {/* DSN-026: untrusted public-web check of the claimed identity. Supporting evidence only; never the official route. */}
            <form
              aria-label="Check public listings"
              className="flex flex-wrap items-end gap-space-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!claimedIdentity || !webCheckNumber) return;
                run(async () => {
                  await api.command('POST', `cases/${caseId}/web-verification`, {
                    claimedIdentity,
                    callerNumber: webCheckNumber,
                  });
                  await loadWebEvidence(caseId);
                });
              }}
            >
              <label>
                Number the caller is using
                <input inputMode="tel" value={webCheckNumber} onChange={(e) => setWebCheckNumber(e.target.value)} />
              </label>
              <Button type="submit" variant="secondary" disabled={!claimedIdentity || !webCheckNumber}>
                Check public listings
              </Button>
            </form>
            <DeviceSignalList signals={deviceSignals} />
            <ConfirmFraudPanel
              initialNumber={screenedNumber}
              onConfirm={async (callerNumber) => {
                const res = await api.command<{ maskedNumber: string }>('POST', `cases/${caseId}/fraud-confirmation`, {
                  callerNumber,
                  basis: 'user-confirmed',
                });
                return res.maskedNumber;
              }}
            />
            <form
              aria-label="Draft a transfer"
              className="flex flex-wrap items-end gap-space-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const beneficiaryId = (draftPayee === '__new__' ? newPayeeId : draftPayee).trim();
                  if (!beneficiaryId) return;
                  await api.command(
                    'POST',
                    `cases/${caseId}/payment/draft`,
                    withKey({ beneficiaryId, amountMinor: Math.round(Number(draftAmount) * 100), expectedVersion: version }),
                  );
                  await refreshCase(caseId);
                });
              }}
            >
              <label>
                Beneficiary
                <select value={draftPayee} onChange={(e) => setDraftPayee(e.target.value)}>
                  {(plan?.bankAccounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label} · ending {account.last4}
                    </option>
                  ))}
                  <option value="__new__">New payee…</option>
                </select>
              </label>
              {draftPayee === '__new__' && (
                <label>
                  New payee account
                  <input
                    value={newPayeeId}
                    onChange={(e) => setNewPayeeId(e.target.value)}
                    placeholder="account the caller gave you"
                  />
                </label>
              )}
              <label>
                Amount
                <input inputMode="numeric" value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} />
              </label>
              <Button type="submit" variant="secondary">Save transfer draft</Button>
            </form>
            <PaymentPanel
              draft={caseView?.paymentDraft}
              paymentState={caseView?.paymentState ?? 'draft'}
              segmentIds={caseView?.segmentIds}
              onSubmit={() =>
                run(async () => {
                  const draftId = caseView?.paymentDraft?.id;
                  if (!draftId) return;
                  await api.command('POST', `cases/${caseId}/payment/submit`, withKey({ draftId, expectedVersion: version }));
                  await refreshCase(caseId);
                })
              }
              onRecheck={async () => {
                await api.command('POST', `cases/${caseId}/payment/recheck`, {});
                await refreshCase(caseId);
              }}
              onAlreadyPaid={() =>
                run(async () => {
                  setRecovery(await api.command<RecoveryState>('POST', `cases/${caseId}/recovery/enter`, withKey({})));
                  await refreshCase(caseId); // keep caseView.phase current so phase-gated UI (e.g. the 1930 handoff) is accurate
                  window.history.pushState({}, '', `/cases/${caseId}/recover`);
                  setStep('Recovery');
                })
              }
            />
            <ActionConsole
              caseState={{
                phase: caseView?.phase ?? 'Observe',
                paymentState: caseView?.paymentState,
                reasons: caseView?.reasons,
              }}
              onPause={() => run(() => act('pause'))}
              onCancel={() => run(() => act('cancel'))}
              onVerify={() => setStep('Verify')}
              onContinue={() => run(() => act('continue'))}
              onAskAlly={() => setStep('Ally')}
            />
          </>
        )}

        {owner && caseId && step === 'Verify' && (
          <>
            {!verifyGate.allowed && <Callout kind="info">{verifyGate.reason}</Callout>}
            {!registry && (
              <div><Button onClick={() => run(async () => setRegistry(await api.get<VerifyPanelRegistry>('registry/demo-bank')))}>
                Load verification registry
              </Button></div>
            )}
            {registry && (
              <VerifyPanel
                registry={registry}
                result={verifyResult}
                disabled={!verifyGate.allowed}
                webEvidence={webEvidence}
                onVerify={() =>
                  run(async () => {
                    // Client-side gate: Observe has no Verify transition, so never issue the call.
                    if (!verifyGate.allowed) {
                      setError(verifyGate.reason ?? 'Verification is not available yet.');
                      return;
                    }
                    setVerifyResult(await api.command<VerifyPanelResult>('POST', `cases/${caseId}/verify`, {}));
                    await refreshCase(caseId);
                  })
                }
                onCancel={() => run(() => act('cancel'))}
              />
            )}
          </>
        )}

        {owner && caseId && step === 'Ally' && (
          <>
            <AllyEvidenceSelector
              segments={segments}
              selectedIds={selectedEvidenceIds}
              onToggle={toggleEvidence}
              onPreview={() =>
                run(async () => {
                  // Guard the server cap BEFORE promoting anything: the preview endpoint
                  // rejects >MAX_ALLY_EVIDENCE ids, and promoting first would persist
                  // evidence for a request we know will 400. The button is already
                  // disabled over the cap; this makes the side-effect-free path explicit.
                  if (selectedEvidenceIds.length > MAX_ALLY_EVIDENCE) {
                    setError(`Choose at most ${MAX_ALLY_EVIDENCE} excerpts to share before previewing.`);
                    return;
                  }
                  // Promote each chosen segment into the case's `evidence` subcollection
                  // (idempotent per segment) so the preview can resolve the selected ids,
                  // then preview with exactly those ids.
                  for (const id of selectedEvidenceIds) {
                    await api.command('POST', `cases/${caseId}/evidence/${id}/promote`, {});
                  }
                  const result = await api.command<{ packetContent: AllyPacketContent; packetHash: string; caseVersion: number }>(
                    'POST',
                    `cases/${caseId}/ally-share-preview`,
                    { selectedEvidenceIds },
                  );
                  // The preview endpoint returns `packetContent` (ally.ts previewAllyPacket);
                  // map it to the `packet` the dialog renders.
                  setPreview({
                    packet: result.packetContent,
                    packetHash: result.packetHash,
                    caseVersion: result.caseVersion,
                    selectedEvidenceIds,
                  });
                })
              }
            />
            <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="What your ally would see">
              {preview && (
                <AllySharePreview
                  allyName="your Safety Ally"
                  packet={preview.packet}
                  onNotNow={() => setPreview(null)}
                  onShare={() =>
                    run(async () => {
                      // The ally's uid comes from the invitation response; the owner UI never types it.
                      await api.command('POST', `cases/${caseId}/ally-grant`, {
                        allyUid: allyUid ?? '',
                        selectedEvidenceIds: preview.selectedEvidenceIds,
                        expectedCaseVersion: preview.caseVersion,
                        expectedPacketHash: preview.packetHash,
                      });
                      setAllyShared(true); // DSN-027: a grant now exists, so the WhatsApp summary is meaningful.
                    })
                  }
                  // DSN-027: only offered after a grant exists; builds the minimum-packet summary server-side.
                  onPrepareWhatsApp={
                    allyShared
                      ? () =>
                          run(async () =>
                            setWhatsappSummary(
                              await api.get<AllyWhatsAppSummary>(`cases/${caseId}/ally-whatsapp-summary?allyUid=${allyUid ?? ''}`),
                            ),
                          )
                      : undefined
                  }
                  whatsappSummary={whatsappSummary}
                />
              )}
            </Dialog>
          </>
        )}

        {role === 'ally' && step === 'Ally' && (
          <>
            <label>
              Case ID
              <input value={caseId} onChange={(e) => setCaseId(e.target.value)} />
            </label>
            <div><Button onClick={() => run(async () => setAllyPacket(await api.get<AllyPacket>(`ally/cases/${caseId}`)))}>
              Open shared case
            </Button></div>
            {allyPacket && (
              <AllyScreen
                packet={allyPacket}
                accessState={allyAccess}
                onContactRequest={() => respond({ kind: 'contact-request' })}
                onPauseRecommendation={() => respond({ kind: 'pause-recommendation' })}
                onCheckedSource={(source) => respond({ kind: 'checked-source', source })}
                // DSN-027: advisory script only; a revoked grant denies here and flips the view to revoked.
                onContactCaller={() =>
                  run(async () => {
                    try {
                      setCallerContact(await api.command<AllyCallerContact>('POST', `ally/cases/${caseId}/contact-caller`, withKey({})));
                    } catch (e) {
                      if (e instanceof ApiError && e.status === 403) setAllyAccess('revoked');
                      throw e;
                    }
                  })
                }
                callerContact={callerContact}
              />
            )}
          </>
        )}

        {owner && caseId && step === 'Recovery' && (
          <>
            {!recovery && (
              <div><Button
                onClick={() =>
                  run(async () => {
                    setRecovery(await api.command<RecoveryState>('POST', `cases/${caseId}/recovery/enter`, withKey({})));
                    await refreshCase(caseId); // keep caseView.phase current for phase-gated UI
                  })
                }
              >
                I already paid
              </Button></div>
            )}
            {recovery && (
              <RecoveryScreen
                state={recovery}
                onMatch={(fingerprint) =>
                  run(async () =>
                    setRecovery(
                      await api.command<RecoveryState>(
                        'POST',
                        `cases/${caseId}/recovery/paid-details`,
                        withKey({ kind: 'match-prefill', expectedPrefillFingerprint: fingerprint }),
                      ),
                    ),
                  )
                }
                onEdit={(details) =>
                  run(async () =>
                    setRecovery(
                      await api.command<RecoveryState>(
                        'POST',
                        `cases/${caseId}/recovery/paid-details`,
                        withKey({ kind: 'edit-paid-details', ...details }),
                      ),
                    ),
                  )
                }
                onAcknowledge={(action) =>
                  run(async () =>
                    setRecovery(
                      await api.command<RecoveryState>('POST', `cases/${caseId}/recovery/acknowledgement`, withKey({ action })),
                    ),
                  )
                }
              />
            )}
          </>
        )}

        {owner && caseId && step === 'Evidence' && (
          <EvidenceScreen
            timeline={facts.map((f) => ({ kind: 'confirmed-fact' as const, label: f.field, value: f.value }))}
            exportAllowed
            retentionMode="facts-24h"
            onExport={() =>
              run(async () => {
                const { blob, filename } = await api.download('POST', `cases/${caseId}/export`);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.click();
                URL.revokeObjectURL(link.href);
              })
            }
            // DSN-028: pre-filled report draft; the user downloads/opens the official channel themselves.
            reportDraft={reportDraft}
            handoffAllowed={!!recovery || caseView?.phase === 'Recover'}
            handedOff={reportHandedOff}
            onDownloadReportDraft={() =>
              run(async () => {
                const { blob, filename } = await api.download('GET', `cases/${caseId}/report-draft/download`);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.click();
                URL.revokeObjectURL(link.href);
              })
            }
            onOpenOfficialChannel={(callerNumber) =>
              run(async () => {
                const body: { idempotencyKey: string; callerNumber?: string } = { idempotencyKey: newIdempotencyKey() };
                if (callerNumber) body.callerNumber = callerNumber;
                // Records the handoff + authority-report list entry server-side, THEN the human opens the channel.
                await api.command<ReportHandoffResult>('POST', `cases/${caseId}/report-handoff`, body);
                setReportHandedOff(true);
                window.open(reportChannelUrl, '_blank', 'noopener');
              })
            }
          />
        )}
        </>
      )}
    </AppShell>
  );

  function navigate(next: AppView): void {
    setView(next);
    setIncomingCall(false);
    if (next !== 'settings') setSettingsSaved(false);
  }

  /** Leave the ally view back to an owner view in this same context (drops the ?role=ally hint). */
  function exitAllyView(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    setRole('owner');
    setStep('Plan');
    setView('home');
  }

  async function act(kind: 'pause' | 'cancel' | 'continue'): Promise<void> {
    await api.command('POST', `cases/${caseId}/actions/${kind}`, { expectedVersion: version, idempotencyKey: newIdempotencyKey() });
    await refreshCase(caseId);
  }

  /**
   * DSN-030: append owner-supplied transcript turns through the SAME segment
   * API as the live-capture bridge, then run one extraction pass. Orders
   * continue gap-free from whatever segments the case already has. Shared by
   * the paste and audio-upload paths.
   */
  async function appendTurnsAndExtract(id: string, turns: { speaker: string; text: string }[], idPrefix: string): Promise<void> {
    if (!turns.length) return;
    const stamp = Date.now().toString(36);
    for (const [i, turn] of turns.entries()) {
      // Order off the highest order already accepted (matching the live
      // bridge's max+1 rule, not list length), computed fresh each iteration.
      const order = segmentsRef.current.reduce((max, s) => Math.max(max, s.order), 0) + 1;
      const segment: SessionSegmentView = { id: `${idPrefix}-${stamp}-${i}`, order, speaker: turn.speaker || 'caller', text: turn.text };
      await api.command('POST', `cases/${id}/segments`, segment);
      // Record each segment only after the server accepts it, so a mid-loop
      // failure never leaves the local base behind the server's
      // lastSegmentOrder (which would ORDER_CONFLICT the owner's retry).
      segmentsRef.current = [...segmentsRef.current, segment];
      setSegments(segmentsRef.current);
    }
    await refreshCase(id);
    const latest = await api.get<CaseView>(`cases/${id}`);
    await api.command('POST', `cases/${id}/facts/extract`, { expectedVersion: latest.version });
    await refreshCase(id);
  }

  /** Pasted call text: one turn per non-empty line, with an optional "Name:" speaker prefix (default caller). */
  async function submitPastedTranscript(text: string): Promise<void> {
    const id = caseIdRef.current;
    if (!id) return;
    const turns = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const m = /^([A-Za-z][\w ]{0,20}?)\s*:\s*(.+)$/.exec(line);
        return m ? { speaker: m[1]!.trim().toLowerCase(), text: m[2]!.trim() } : { speaker: 'caller', text: line };
      });
    setTranscriptBusy(true);
    try {
      await appendTurnsAndExtract(id, turns, 'paste');
    } finally {
      setTranscriptBusy(false);
    }
  }

  /** Uploaded recording: transcribed server-side into turns (audio is never stored), then the same append + extract path. */
  async function submitAudioRecording(audioFile: File): Promise<void> {
    const id = caseIdRef.current;
    if (!id) return;
    setTranscriptBusy(true);
    try {
      const dataBase64 = await fileToBase64(audioFile);
      const { turns } = await api.command<{ turns: { speaker: string; text: string }[] }>(
        'POST',
        `cases/${id}/transcript/audio`,
        { audio: { mimeType: audioFile.type || 'audio/webm', dataBase64 } },
      );
      await appendTurnsAndExtract(id, turns, 'audio');
    } finally {
      setTranscriptBusy(false);
    }
  }

  async function respond(body: { kind: string; source?: string }): Promise<void> {
    await run(async () => void (await api.command('POST', `ally/cases/${caseId}/response`, withKey(body))));
  }
}
