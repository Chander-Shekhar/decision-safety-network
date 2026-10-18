import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceSignalList } from './DeviceSignalList';
import { announceCapturePolicy, nextLiveSegment, parseCaptureStatusMessage, parseTranscriptSegmentMessage } from './liveTranscript';
import { parseSmsSignalMessage, ingestSmsSignal, type DeviceSignal } from './deviceSignals';
import type { AllyGrantedCase, AllySharer, AllyPacket, AllyPacketContent, AllyWhatsAppSummary } from '../../../packages/contracts/src/ally';
import type { Fact } from '../../../packages/contracts/src/facts';
import type { Plan } from '../../../packages/contracts/src/plan';
import type { UserProfile } from '../../../packages/contracts/src/profile';
import { ProfileForm } from './ProfileForm';
import type { PaymentProjection } from '../../../packages/contracts/src/payment';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';
import type { WebVerificationEvidence } from '../../../packages/contracts/src/web-verification';
import type { OfficialContact } from '../../../packages/contracts/src/official-contact';
import type { ReportDraft, ReportHandoffResult } from '../../../packages/contracts/src/report';
import { AboutScreen } from './AboutScreen';
import { ActionConsole } from './ActionConsole';
import { AllyScreen } from './AllyScreen';
import { AllySharePreview } from './AllySharePreview';
import { ApiError, createApiClient, newIdempotencyKey, withKey, type GetIdToken } from './api-client';
import { AppShell, type AppView } from './AppShell';
import { CasesScreen } from './CasesScreen';
import { DecisionMap, FactCorrectionPanel } from './DecisionMap';
import { EvidenceScreen, type ReportDraftView } from './EvidenceScreen';
import { HomeScreen } from './HomeScreen';
import { ConfirmFraudPanel, IncomingCallScreen } from './ScreeningScreen';
import type { ScreeningVerdict } from '../../../packages/contracts/src/screening';
import { initialStep, journeySteps, type JourneyState, type Step } from './journey';
import { PlanScreen, type AllyStatus } from './PlanScreen';
import { RecoveryScreen } from './RecoveryScreen';
import { SettingsScreen, type SettingsValues } from './SettingsScreen';
import { SessionInput } from './SessionInput';
import { SessionScreen, type SessionSegmentView } from './SessionScreen';
import { Button, Callout, Card, StepFlowNav, StepRail } from './ui';

/** The pre-added sample Safety Ally, so the ally setup reads as ready out of the box. */

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
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [allyUid, setAllyUid] = useState<string | null>(null);
  // Ally session: the id of the invitation addressed to this ally (null until the
  // owner redeems this ally's pairing code and the discovery poll finds it).
  const [allyInvitationId, setAllyInvitationId] = useState<string | null>(null);
  // DSN-030: a transcript paste/audio submit is in flight.
  const [transcriptBusy, setTranscriptBusy] = useState(false);
  // Session step: once a call has been added, the transcript (not the input) is
  // shown; this reveals the "Add the call" input again on demand so the two are
  // never both visible by default.
  const [editingCall, setEditingCall] = useState(false);
  // No ally until the owner pairs one (or, for an ally session, until the invitation arrives).
  const [allyStatus, setAllyStatus] = useState<AllyStatus>('none');
  // The paired ally's self-entered name (owner side), joined by the owner invitations read.
  const [allyName, setAllyName] = useState<string | undefined>();
  // The signed-in user's own name + mobile (owner in Settings, ally on the pairing screen).
  const [profile, setProfile] = useState<UserProfile>({});
  const [profileSaved, setProfileSaved] = useState(false);
  const [preview, setPreview] = useState<AllyPreview | null>(null);
  const [allyPreviewPending, setAllyPreviewPending] = useState(false);
  const [allyPacket, setAllyPacket] = useState<AllyPacket | null>(null);
  // Ally session: cases auto-discovered as shared with this ally (no case id to type).
  const [allyCases, setAllyCases] = useState<AllyGrantedCase[]>([]);
  // DSN-027: owner-side WhatsApp summary (minimum packet only) + ally-side contact-caller script.
  const [allyShared, setAllyShared] = useState(false);
  const [whatsappSummary, setWhatsappSummary] = useState<AllyWhatsAppSummary | undefined>();
  const [allySharer, setAllySharer] = useState<AllySharer | undefined>();
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
  // DSN-038: the officially-sourced, callable number for the claimed organisation (Decide step). Null until resolved / when none found.
  const [officialContact, setOfficialContact] = useState<OfficialContact | null>(null);
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
  // Guards the one-shot auto-generation of the ally summary on entering the Ally step.
  const allyAutoPreviewRef = useRef(false);

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

  // Ally session: auto-discover the cases shared with this ally, so the ally never
  // types a case id. Polls while the ally screen is open; the owner's Share appears here.
  useEffect(() => {
    if (role !== 'ally') return;
    let cancelled = false;
    const sync = async () => {
      try {
        const { cases } = await api.get<{ cases: AllyGrantedCase[] }>('ally/cases');
        if (!cancelled) setAllyCases(cases ?? []);
      } catch {
        // Transient read failure: keep the current list; the next poll retries.
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
  // acceptance" forever.
  useEffect(() => {
    if (role !== 'owner') return;
    let cancelled = false;
    const sync = async () => {
      try {
        const { invitations } = await api.get<{ invitations: { id: string; allyUid: string; allyName?: string; acceptedAt?: string | null }[] }>(
          'owner/invitations',
        );
        if (cancelled) return;
        const active = invitations[0];
        if (!active) {
          setAllyStatus('none');
        } else {
          setAllyUid(active.allyUid);
          setAllyInvitationId(active.id);
          setAllyName(active.allyName);
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

  const run = useCallback(async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? `Request failed (${e.code}). Nothing was changed.` : 'Something went wrong. Nothing was changed.');
    }
  }, []);

  // Load the user's own name + mobile once signed in (either role); empty until they add them.
  useEffect(() => {
    if (!role) return;
    let live = true;
    api
      .get<UserProfile>('profile')
      .then((loaded) => {
        if (live && loaded) setProfile(loaded);
      })
      .catch(() => {
        // No profile yet (or a transient read failure): the form just starts empty.
      });
    return () => {
      live = false;
    };
  }, [role, api]);

  const saveProfile = useCallback(
    (values: UserProfile) =>
      run(async () => {
        setProfileSaved(false);
        setProfile(await api.command<UserProfile>('PUT', 'profile', values));
        setProfileSaved(true);
      }),
    [api, run],
  );

  const refreshCase = useCallback(
    async (id: string) => {
      setCaseView(await api.get<CaseView>(`cases/${id}`));
    },
    [api],
  );

  // Build the ally summary the owner reviews on the Ally step. We DON'T ask a person under
  // pressure to hand-pick transcript excerpts: the server composes a short AI summary of the
  // call from the extracted facts. The owner reviews the packet and consents by Sharing.
  const generateAllyPreview = useCallback(() => {
    if (!caseId) return;
    setAllyPreviewPending(true);
    void run(async () => {
      try {
        const result = await api.command<{ packetContent: AllyPacketContent; packetHash: string; caseVersion: number }>(
          'POST',
          `cases/${caseId}/ally-share-preview`,
          {},
        );
        setPreview({ packet: result.packetContent, packetHash: result.packetHash, caseVersion: result.caseVersion });
      } finally {
        setAllyPreviewPending(false);
      }
    });
  }, [api, caseId, run]);

  // Auto-generate the summary once when the owner lands on the Ally step with a call present.
  // The ref makes it one-shot per visit; leaving the step rearms it. "Not now" navigates away
  // without clearing `preview`, so returning shows the same summary rather than regenerating.
  useEffect(() => {
    if (!(role === 'owner' && caseId && step === 'Ally')) {
      allyAutoPreviewRef.current = false;
      return;
    }
    if (preview || allyPreviewPending || segments.length === 0 || allyAutoPreviewRef.current) return;
    allyAutoPreviewRef.current = true;
    generateAllyPreview();
  }, [role, caseId, step, preview, allyPreviewPending, segments.length, generateAllyPreview]);

  // DSN-026: fetch the case's stored untrusted web evidence. Supporting evidence only; never the official route.
  const loadWebEvidence = useCallback(
    async (id: string) => {
      const res = await api.get<{ evidence: WebVerificationEvidence[] }>(`cases/${id}/web-verification`);
      // Re-running the same check appends another identical row server-side; collapse
      // content-identical results so the UI shows each distinct finding once.
      const seen = new Set<string>();
      const unique = res.evidence.filter((e) => {
        const key = `${e.stance}|${e.institution}|${e.headline}|${e.maskedNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setWebEvidence(unique);
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
    recoveryEntered: !!recovery || caseView?.phase === 'Recover',
    hasConfirmedFacts: facts.some((f) => !!caseView?.confirmed?.[f.field]),
  };
  // The ally still needs the Plan step to accept an invitation, so keep it reachable for that role.
  const railSteps = journeySteps(journeyState).map((s) => (role === 'ally' && s.step === 'Plan' ? { step: s.step, available: true } : s));

  // Forward navigation out of Review attests the facts in bulk. There is no separate "confirm"
  // button: the user leaving the facts untouched (not opening "Not right? Correct it") *is* the
  // attestation that the extraction matches the call. It promotes the model-origin, known-value,
  // source-linked facts into the trusted `confirmed` map (so the Pause's conversation signals and
  // the report draft work) — framed as accuracy of capture, never endorsement of the caller's
  // claims; corrected facts already carry their own `user-corrected` trust. Each confirm is
  // version-gated server-side, so the expected version is bumped per hop. Any other move (Back, or
  // forward from another step) is a plain `setStep`.
  const goToStep = (target: Step) => {
    const order = railSteps.map((r) => r.step);
    const advancingFromReview = step === 'Review' && order.indexOf(target) > order.indexOf('Review');
    if (!advancingFromReview || !caseId) {
      setStep(target);
      return;
    }
    run(async () => {
      let v = version;
      const attestable = facts
        .filter((f) => f.origin === 'model' && f.value !== 'unknown' && f.sourceSegmentIds.length > 0)
        .map((f) => f.field);
      for (const field of attestable) {
        await api.command('POST', `cases/${caseId}/facts/${field}/confirm`, { expectedVersion: v });
        v += 1;
      }
      await refreshCase(caseId);
      setStep(target);
    });
  };

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

  // DSN-026: load any stored web evidence when the case opens.
  useEffect(() => {
    if (owner && caseId) void run(() => loadWebEvidence(caseId));
  }, [owner, caseId, run, loadWebEvidence]);

  // Review-step auto-verification (vision step 4): when the call came in through the
  // screening path we already have the caller's number, so check the claimed identity
  // against public listings automatically — no form, result shows under Claimed identity.
  // The transcript/upload path has no number, so there we offer an inline input instead.
  const autoWebCheckRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(owner && caseId && step === 'Review' && claimedIdentity && screenedNumber)) return;
    const key = `${caseId}:${claimedIdentity}:${screenedNumber}`;
    if (autoWebCheckRef.current === key) return;
    autoWebCheckRef.current = key;
    if (webEvidence.length > 0) return; // already checked for this case
    void run(async () => {
      await api.command('POST', `cases/${caseId}/web-verification`, { claimedIdentity, callerNumber: screenedNumber });
      await loadWebEvidence(caseId);
    });
  }, [owner, caseId, step, claimedIdentity, screenedNumber, webEvidence.length, run, loadWebEvidence]);

  // Decide-step official contact (DSN-038): resolve a callable number for the claimed
  // organisation so the owner can reach it directly. Runs once per case/identity on entry
  // to Decide; a null number simply hides the call action.
  const officialContactRef = useRef<string | null>(null);
  useEffect(() => {
    if (!(owner && caseId && step === 'Decide' && claimedIdentity)) return;
    const key = `${caseId}:${claimedIdentity}`;
    if (officialContactRef.current === key) return;
    officialContactRef.current = key;
    void run(async () => {
      setOfficialContact(await api.command<OfficialContact>('POST', `cases/${caseId}/official-contact`, { claimedIdentity }));
    });
  }, [owner, caseId, step, claimedIdentity, run]);

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
            setStep('Review');
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
          allyName={allyName}
          profile={profile}
          profileSaved={profileSaved}
          onSaveProfile={saveProfile}
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

          {owner && !needsSetup && (caseId || step !== 'Plan') && <StepRail steps={railSteps} current={step} onSelect={goToStep} />}

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
            <ProfileForm
              initial={profile}
              saved={profileSaved}
              hint="So the person you support sees your name and can message you straight on WhatsApp."
              onSave={saveProfile}
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
              onViewSharedCases={() => setStep('Ally')}
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
                    onSubmitPaste={(text, callerNumber) =>
                      run(async () => {
                        await submitPastedTranscript(text);
                        if (callerNumber) setScreenedNumber(callerNumber); // drives the Review auto-verification
                        setEditingCall(false);
                      })
                    }
                    onSubmitAudio={(audioFile, callerNumber) =>
                      run(async () => {
                        await submitAudioRecording(audioFile);
                        if (callerNumber) setScreenedNumber(callerNumber);
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
                {/* Moving on is handled by the consistent Back/Next footer (StepFlowNav),
                    so the Session step no longer carries its own step-forward button. */}
              </>
            )}
          </section>
        )}

        {owner && caseId && step === 'Review' && (
          <div className="flex flex-col gap-space-5">
            {/* Read-only map: it reframes the call into discrete, unverified claims. "View source" reveals the
                exact transcript excerpt inline (resolved from this case's live segments). */}
            <DecisionMap
              facts={facts}
              webEvidence={webEvidence}
              resolveSource={(ids) =>
                segments.filter((s) => ids.includes(s.id)).map((s) => ({ speaker: s.speaker, text: s.text }))
              }
            />
            {/* On-device signals surface themselves only once one has arrived (the list renders nothing when empty). */}
            <DeviceSignalList signals={deviceSignals} />

            {/* The single, on-demand correction path (collapsed by default). Corrections apply in one batch;
                each is version-gated server-side, so run them sequentially and bump the expected version per hop. */}
            <FactCorrectionPanel
              facts={facts}
              onApply={(corrections) =>
                run(async () => {
                  let v = version;
                  for (const { field, value } of corrections) {
                    await api.command('POST', `cases/${caseId}/facts/${field}/correct`, { value, expectedVersion: v });
                    v += 1;
                  }
                  await refreshCase(caseId);
                })
              }
            />

            {/* Caller verification is automatic: the number is captured at intake (Session step, with the
                transcript/recording) or from screening, so the public-listings check runs on entry (see the
                auto-verification effect) and its result shows under Claimed identity in the map above. No
                number input lives on this step. */}

            {/* No separate "continue" button here: moving forward is the single Next action in the footer
                (StepFlowNav). Advancing from Review attests the facts in bulk — see `goToStep`. Leaving the
                "Not right? Correct it" panel untouched means the facts stand as heard, which is the attestation. */}
          </div>
        )}

        {owner && caseId && step === 'Decide' && (
          <div className="flex flex-col gap-space-5">
            {/* The decision hub: ask the ally, call the real organisation, or move to recovery if already paid. */}
            <section aria-label="Decide what to do" className="flex flex-col gap-space-3">
              <h2 className="text-sm font-semibold">Decide what to do</h2>
              <ActionConsole
                allyName={allyName ?? 'your Safety Ally'}
                officialContact={officialContact}
                onAskAlly={() => setStep('Ally')}
                onAlreadyPaid={() =>
                  run(async () => {
                    setRecovery(await api.command<RecoveryState>('POST', `cases/${caseId}/recovery/enter`, withKey({})));
                    await refreshCase(caseId); // keep caseView.phase current so phase-gated recovery UI is accurate
                    window.history.pushState({}, '', `/cases/${caseId}/recover`);
                    setStep('Recovery');
                  })
                }
              />
            </section>
          </div>
        )}

        {owner && caseId && step === 'Ally' && (
          <div className="flex flex-col gap-space-5">
            {segments.length === 0 ? (
              <Card title="Ask your Safety Ally">
                <p className="text-sm text-text-muted">
                  There's nothing to summarise yet. Add the call on the Session step first, then come back to share it with your ally.
                </p>
              </Card>
            ) : preview ? (
              <>
                {/* The summary is prepared automatically — the owner reviews it and consents by Sharing. */}
                <AllySharePreview
                  allyName={allyName ?? 'your Safety Ally'}
                  packet={preview.packet}
                  onNotNow={() => setStep('Decide')}
                  onShare={() =>
                    run(async () => {
                      // The ally's uid comes from the invitation response; the owner UI never types it.
                      // Without a paired ally there is no one to share with - say so plainly.
                      if (!allyUid) {
                        setError('Pair your Safety Ally first (on the Plan step) so this case can reach them.');
                        return;
                      }
                      await api.command('POST', `cases/${caseId}/ally-grant`, {
                        allyUid,
                        expectedCaseVersion: preview.caseVersion,
                        expectedPacketHash: preview.packetHash,
                      });
                      setAllyShared(true); // a grant now exists: the ally sees the case, and the WhatsApp summary is meaningful.
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
                {allyShared && (
                  <Callout kind="info" role="status">
                    <p className="font-semibold text-text">Shared with your Safety Ally.</p>
                    <p className="mt-space-1 text-sm text-text-muted">
                      It's now in their app — they'll see it and can reach out to you. You can take a breather.
                    </p>
                  </Callout>
                )}
              </>
            ) : (
              <Card title="Ask your Safety Ally">
                <p className="text-sm text-text-muted">Preparing a short summary of this call for your ally…</p>
              </Card>
            )}
          </div>
        )}

        {role === 'ally' && step === 'Ally' && (
          <>
            {!allyPacket && (
              <Callout kind="info" role="status">
                You're connected as a Safety Ally. Cases the person you support chooses to share appear below.
              </Callout>
            )}
            {!allyPacket && (
              <Card title="Cases shared with you">
                {allyCases.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    Nothing shared yet. When someone shares a case with you, it appears here automatically.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-space-2" aria-label="Shared cases">
                    {allyCases.map((c) => (
                      <li key={c.caseId}>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            run(async () => {
                              setCaseId(c.caseId);
                              setAllyPacket(await api.get<AllyPacket>(`ally/cases/${c.caseId}`));
                              setAllySharer(await api.get<AllySharer>(`ally/cases/${c.caseId}/sharer`));
                            })
                          }
                        >
                          Open: {c.claim}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
            {allyPacket && (
              <AllyScreen
                packet={allyPacket}
                accessState={allyAccess}
                sharer={allySharer}
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
                officialContact={officialContact}
              />
            )}
            {/* Marking the caller as fraud belongs here, in the incident phase, not on the facts-review
                step: it's an after-the-fact conclusion that records the number to the private warn-list
                (founder vision step 6). Shown once the user has entered recovery. */}
            {recovery && (
              <section aria-label="Record this caller as fraud" className="flex flex-col gap-space-2">
                <p className="text-sm text-text-muted">
                  Now that you&apos;re handling this as fraud, record the caller&apos;s number so future recipients of a
                  matching call are warned before they pick up.
                </p>
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
              </section>
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

          {/* Sequential Back / Next across the journey, shown wherever the StepRail is: the rail
              is the overview, this is the one-step-at-a-time path. */}
          {owner && !needsSetup && (caseId || step !== 'Plan') && (
            <StepFlowNav steps={railSteps} current={step} onSelect={goToStep} />
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
}
