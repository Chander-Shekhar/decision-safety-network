import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AllyPacket, AllyPacketContent } from '../../../packages/contracts/src/ally';
import type { Fact } from '../../../packages/contracts/src/facts';
import type { PaymentProjection } from '../../../packages/contracts/src/payment';
import type { RecoveryState } from '../../../packages/contracts/src/recovery';
import { ActionConsole } from './ActionConsole';
import { AllyScreen } from './AllyScreen';
import { AllySharePreview } from './AllySharePreview';
import { ApiError, createApiClient, newIdempotencyKey, withKey, type GetIdToken } from './api-client';
import { DecisionMap } from './DecisionMap';
import { EvidenceScreen } from './EvidenceScreen';
import { canVerify, initialStep, journeySteps, STEPS, type JourneyState, type Step } from './journey';
import { PaymentPanel } from './PaymentPanel';
import { PlanScreen, type AllyStatus } from './PlanScreen';
import { RecoveryScreen } from './RecoveryScreen';
import { SessionScreen, type SessionSegmentView } from './SessionScreen';
import { Button, Callout, Card, Dialog, StepRail } from './ui';
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
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planSavedFlag, setPlanSavedFlag] = useState(false);
  const stepInitialised = useRef(false);

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

  const version = caseView?.version ?? 0;
  const facts = Object.keys({ ...caseView?.facts, ...caseView?.confirmed }).map(
    (field) => (caseView?.confirmed?.[field] ?? caseView?.facts?.[field]) as Fact,
  );
  const owner = role === 'owner';

  const journeyState: JourneyState = {
    role,
    planSaved: planSavedFlag || !!caseView,
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

  // Deep-link / reload: load the case once the owner is signed in, so gating sees the real phase.
  useEffect(() => {
    if (owner && caseId) void run(() => refreshCase(caseId));
  }, [owner, caseId, run, refreshCase]);

  // Pick the starting step once, after the case (if any) has loaded. Pure client state; no API call.
  useEffect(() => {
    if (!role || stepInitialised.current) return;
    if (role === 'owner' && caseId && !caseView) return;
    stepInitialised.current = true;
    setStep(initialStep(journeyState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, caseId, caseView]);

  return (
    <div className="min-h-screen bg-surface text-text">
      <header role="banner" className="border-b border-border bg-surface-raised px-space-4 py-space-4">
        <h1 className="text-xl font-semibold">Decision Safety Network</h1>
        <p>
          <strong>Simulated</strong> &mdash; Demo Bank, the transfer, and local acknowledgements are simulated and
          fictional. Synthetic data only. Controlled transcript input.
        </p>
        <p>
          Pause happens <strong>before you enter an OTP</strong>. The 1930 helpline and cybercrime.gov.in are real
          official routes; this app does not file reports for you.
        </p>
        {!role && (
          <p className="flex gap-space-2">
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
        {role && (
          <aside className="md:w-56">
            <StepRail steps={railSteps} current={step} onSelect={setStep} />
          </aside>
        )}

      <main className="flex-1">
        <Card>
        {role && step === 'Plan' && (
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
            onSavePlan={({ allyPairingCode, ...plan }) =>
              run(async () => {
                await api.command('PUT', 'plan', plan);
                setPlanSavedFlag(true);
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
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const created = await api.command<CaseView>('POST', 'cases');
                    setCaseId(created.id);
                    window.history.pushState({}, '', `/cases/${created.id}`);
                    await refreshCase(created.id);
                  })
                }
              >
                Start controlled session
              </button>
            ) : (
              <p>Case {caseId}</p>
            )}
            {caseId && (
              <SessionScreen
                status="processing"
                segments={segments}
                onStopProcessing={() => run(async () => void (await api.command('POST', `cases/${caseId}/processing/revoke`)))}
              />
            )}
          </section>
        )}

        {owner && caseId && step === 'Decision' && (
          <>
            <DecisionMap
              facts={facts}
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
            <button type="button" onClick={() => run(playScenario)}>
              Play attack scenario
            </button>
            <form
              aria-label="Simulated transfer draft"
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
              <button type="submit">Save simulated transfer draft</button>
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
              <button
                type="button"
                onClick={() => run(async () => setRegistry(await api.get<VerifyPanelRegistry>('registry/demo-bank')))}
              >
                Load Demo Bank registry
              </button>
            )}
            {registry && (
              <VerifyPanel
                registry={registry}
                result={verifyResult}
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
            <button
              type="button"
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
            </button>
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
                    })
                  }
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
            <button type="button" onClick={() => run(async () => setAllyPacket(await api.get<AllyPacket>(`ally/cases/${caseId}`)))}>
              Open shared case
            </button>
            {allyPacket && (
              <AllyScreen
                packet={allyPacket}
                onContactRequest={() => respond({ kind: 'contact-request' })}
                onPauseRecommendation={() => respond({ kind: 'pause-recommendation' })}
                onCheckedSource={(source) => respond({ kind: 'checked-source', source })}
              />
            )}
          </>
        )}

        {owner && caseId && step === 'Recovery' && (
          <>
            {!recovery && (
              <button
                type="button"
                onClick={() =>
                  run(async () => setRecovery(await api.command<RecoveryState>('POST', `cases/${caseId}/recovery/enter`, withKey({}))))
                }
              >
                I already paid
              </button>
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
          />
        )}
        </Card>
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
