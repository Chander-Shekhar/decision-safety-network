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
import { ActionConsole } from './ActionConsole';
import { AllyScreen } from './AllyScreen';
import { AllySharePreview } from './AllySharePreview';
import { ApiError, createApiClient, newIdempotencyKey, withKey, type GetIdToken } from './api-client';
import { DecisionMap } from './DecisionMap';
import { EvidenceScreen, type ReportDraftView } from './EvidenceScreen';
import { HomeScreen } from './HomeScreen';
import { ConfirmFraudPanel, IncomingCallScreen } from './ScreeningScreen';
import type { ScreeningVerdict } from '../../../packages/contracts/src/screening';
import { canVerify, initialStep, journeySteps, STEPS, type JourneyState, type Step } from './journey';
import { PaymentPanel } from './PaymentPanel';
import { PlanScreen, type AllyStatus } from './PlanScreen';
import { RecoveryScreen } from './RecoveryScreen';
import { SetupScreen, type SetupValues } from './SetupScreen';
import { SessionScreen, type SessionSegmentView } from './SessionScreen';
import { Button, Callout, Dialog, StepRail } from './ui';
import { VerifyPanel, type VerifyPanelRegistry, type VerifyPanelResult } from './VerifyPanel';

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

export function App({ auth }: { auth: AuthProvider }): React.JSX.Element {
  const api = useMemo(() => createApiClient(auth.getIdToken), [auth]);
  const [role, setRole] = useState<'owner' | 'ally' | null>(null);
  const [step, setStep] = useState<Step>('Plan');
  const [caseId, setCaseId] = useState<string>(() => /cases\/([^/]+)/.exec(window.location.pathname)?.[1] ?? '');
  const [caseView, setCaseView] = useState<CaseView | null>(null);
  const [segments, setSegments] = useState<SessionSegmentView[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [allyUid, setAllyUid] = useState<string | null>(null);
  const [draftPayee, setDraftPayee] = useState('safe-new');
  const [draftAmount, setDraftAmount] = useState('');
  const [allyStatus, setAllyStatus] = useState<AllyStatus>('none');
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
  const [editingPlan, setEditingPlan] = useState(false);
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
    <div className="min-h-screen bg-surface text-text">
      <header role="banner" className="border-b border-border bg-surface-raised px-space-4 py-space-3">
        <h1 className="text-xl font-semibold tracking-tight">Decision Safety Network</h1>
        <p role="note" className="text-sm text-text-muted">
          Prototype &mdash; Demo Bank and the transfer are simulated; all data is synthetic.
        </p>
        {!role && (
          <p className="mt-space-3 flex flex-wrap gap-space-2">
            <Button onClick={() => run(async () => { await auth.signInSynthetic('owner'); setRole('owner'); })}>
              Create synthetic user
            </Button>
            <Button variant="secondary" onClick={() => run(async () => { await auth.signInSynthetic('ally'); setRole('ally'); })}>
              Create synthetic ally
            </Button>
          </p>
        )}
        {error && (
          <Callout kind="error" role="alert">
            {error}
          </Callout>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-space-4 p-space-4 md:flex-row">
        {role && !needsSetup && (
          <aside className="md:w-56">
            <StepRail steps={railSteps} current={step} onSelect={setStep} />
          </aside>
        )}

      <main className="flex min-w-0 flex-1 flex-col gap-space-5">
        {owner && !caseId && planLoadFailed && !planLoaded && (
          <Callout kind="error" role="alert">
            <p>We couldn&apos;t load your Safety Plan, so nothing was changed.</p>
            <Button variant="secondary" onClick={() => setPlanReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </Callout>
        )}

        {needsSetup && (
          <SetupScreen
            initial={plan ?? undefined}
            saving={savingSetup}
            onComplete={({ allyPairingCode, ...setup }: SetupValues) =>
              run(async () => {
                setSavingSetup(true);
                try {
                  const saved = await api.command<Plan>('PUT', 'plan', {
                    thresholdMinor: plan?.thresholdMinor ?? 500_000,
                    bankId: 'demo-bank',
                    retentionMode: plan?.retentionMode ?? 'facts-24h',
                    exportConsent: plan?.exportConsent ?? false,
                    ...setup,
                    completeSetup: true,
                  });
                  setPlan(saved);
                  setPlanSavedFlag(true);
                  setStep('Plan');
                  if (allyPairingCode) {
                    const invitation = await api.command<{ allyUid: string }>('POST', 'ally-invitations', { pairingCode: allyPairingCode });
                    setAllyUid(invitation.allyUid);
                    setAllyStatus('invited');
                  }
                } finally {
                  setSavingSetup(false);
                }
              })
            }
          />
        )}

        {owner && !needsSetup && configured && plan && step === 'Plan' && !editingPlan && !incomingCall && (
          <HomeScreen
            plan={plan}
            allyStatus={allyStatus}
            onStartSession={() => setStep('Session')}
            onEditPlan={() => setEditingPlan(true)}
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

        {role && !needsSetup && step === 'Plan' && !(owner && configured && plan && !editingPlan) && (
          <PlanScreen
            role={role}
            allyStatus={allyStatus}
            pairingCode={pairingCode}
            onRequestPairingCode={() =>
              run(async () => {
                const issued = await api.command<{ code: string }>('POST', 'ally-pairing-code');
                setPairingCode(issued.code);
              })
            }
            onAcceptInvitation={() => run(async () => setAllyStatus('ready'))}
            onSavePlan={({ allyPairingCode, ...savedPlan }) =>
              run(async () => {
                setPlan(await api.command<Plan>('PUT', 'plan', savedPlan));
                setPlanSavedFlag(true);
                setEditingPlan(false);
                if (allyPairingCode) {
                  const invitation = await api.command<{ allyUid: string }>('POST', 'ally-invitations', { pairingCode: allyPairingCode });
                  setAllyUid(invitation.allyUid);
                  setAllyStatus('invited');
                }
              })
            }
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
            <div><Button variant="secondary" onClick={() => run(playScenario)}>
              Play attack scenario
            </Button></div>
            <form
              aria-label="Draft a transfer"
              className="flex flex-wrap items-end gap-space-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.command(
                    'POST',
                    `cases/${caseId}/payment/draft`,
                    withKey({ beneficiaryId: draftPayee, amountMinor: Math.round(Number(draftAmount) * 100), expectedVersion: version }),
                  );
                  await refreshCase(caseId);
                });
              }}
            >
              <label>
                Beneficiary
                <select value={draftPayee} onChange={(e) => setDraftPayee(e.target.value)}>
                  <option value="safe-new">safe-new (new payee)</option>
                  <option value="safe-known">safe-known</option>
                </select>
              </label>
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
                Load Demo Bank registry
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
            <div><Button
              onClick={() =>
                run(async () => {
                  const selectedEvidenceIds = segments.map((s) => s.id);
                  const result = await api.command<{ packet: AllyPacketContent; packetHash: string; caseVersion: number }>(
                    'POST',
                    `cases/${caseId}/ally-share-preview`,
                    { selectedEvidenceIds },
                  );
                  setPreview({ ...result, selectedEvidenceIds });
                })
              }
            >
              Preview what my ally would see
            </Button></div>
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
      </main>
      </div>
    </div>
  );

  async function act(kind: 'pause' | 'cancel' | 'continue'): Promise<void> {
    await api.command('POST', `cases/${caseId}/actions/${kind}`, { expectedVersion: version, idempotencyKey: newIdempotencyKey() });
    await refreshCase(caseId);
  }

  /** Controlled, synthetic transcript (never a live call): appended through the API, then one extraction pass. */
  async function playScenario(): Promise<void> {
    const lines = [
      'This is the Demo Bank fraud team. Your account is compromised.',
      'To protect it, move 50,000 to the safe-new account right now.',
    ];
    const played: SessionSegmentView[] = lines.map((text, i) => ({ id: `seg-${i + 1}`, order: i + 1, speaker: 'caller', text }));
    for (const segment of played) {
      await api.command('POST', `cases/${caseId}/segments`, segment);
    }
    setSegments(played);
    await refreshCase(caseId);
    await api.command('POST', `cases/${caseId}/facts/extract`, { expectedVersion: (await api.get<CaseView>(`cases/${caseId}`)).version });
    await refreshCase(caseId);
  }

  async function respond(body: { kind: string; source?: string }): Promise<void> {
    await run(async () => void (await api.command('POST', `ally/cases/${caseId}/response`, withKey(body))));
  }
}
