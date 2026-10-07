# Decision Safety Network

## Product Requirements Document — AI Builder Cup scope and long-term foundation

**Working title:** Decision Safety Network  
**Status:** Draft 0.2 — Cup scope approved; working title remains provisional  
**Date:** 28 September 2026  
**Initial market:** India  
**AI Builder Cup theme:** BFSI — Intelligent Risk, Fraud & Financial Experiences  
**Initial surface:** Native Android companion app hosting the responsive consumer experience, demonstrated through a controlled call, a consented on-device SMS signal, and a simulated payment journey; the responsive web surface remains for the Safety Ally and reviewers  
**Long-term product form:** B2B2C decision-safety layer embedded with banks, payment providers, telecom operators, device makers, and safety partners, supported by a consumer companion application

---

# Part I — AI Builder Cup build specification

This part is the build contract for the competition entry. Part II preserves the broader product thesis, evidence, market analysis, governance requirements, and post-Cup strategy.

## AI Builder Cup executive brief

### The product in one sentence

> **Decision Safety Network turns an unfolding social-engineering interaction and an imminent financial action into one living Safety Case, then helps the user complete a safer outcome through a structural pause, independent verification, trusted-human review, or immediate recovery without repeating the incident.**

### The problem

Existing products can flag suspicious calls, messages, voices, links, devices, or payments. The difficult and still-fragmented part begins after a signal appears: a person under pressure must interpret the warning, connect it to the action they are about to take, find an independent verification route, involve help without retelling everything, and act quickly if money has already moved.

The Cup entry will not compete on a more dramatic “scam detected” alert. It will demonstrate the missing orchestration between **understanding, consequence, intervention, verification, and response**.

### The Cup proposition

> **Demonstrate that live conversation context and a new-payee transfer can be joined into a single, source-grounded Safety Case that changes state at the decisive moment, executes an independent verification path, resolves the proposed action, and—if payment has already occurred—converts the same case into an urgent recovery handoff.**

This is a prototype claim, not a claim of population-level fraud-loss reduction. Behavioral superiority remains a hypothesis to test against a strong actionable-warning baseline.

### The “genius moment”

The system remains proportionate while suspicious language is only ambiguous. It intervenes when a simulated bank surface emits a new-payee transfer event and Gemini binds that consequence to the caller's unverified claim, secrecy, urgency, and requested action. The interface then **changes the structure of the decision**: pause the simulated transfer, run a provenance-bearing verification workflow, or ask a pre-authorized ally. A warning is not the end state; a recorded resolution is.

If the presenter selects **“I already paid,”** the caller, claim, payee, amount, time, and source evidence immediately become a recovery case. The user is not sent to a generic chatbot and is not asked to reconstruct the incident.

### Competition fit

| Competition requirement | Product response |
|---|---|
| **Primary theme** | BFSI — fraud and risk mitigation around a consequential financial action. Social impact is a secondary benefit, not the theme claim. |
| **Technical Merit & GenAI Implementation — 40%** | Live Gemini-based structured inference, evolving case state, grounded evidence links, cross-context reasoning, guarded action orchestration, and a deployed working flow. |
| **Problem Alignment & Impact — 25%** | India-first scam-induced authorized payment, with both prevention and first-hour response represented. |
| **Innovation & Creativity — 25%** | A closed safety loop rather than another detector: signal → action context → structural intervention → verification → resolution or recovery. |
| **UX & Solution Design — 10%** | Calm, blame-free, accessible actions designed for a pressured user; no alarmist score or mental-state label. |
| **Required platform direction** | Google AI models for the live intelligence layer; Cloud Run and/or Firebase for deployment and stateful product surfaces. |
| **Submission reality** | The functional prototype, three-minute video, and English supporting material must tell one continuous story rather than tour disconnected features. |

The official competition page lists the build/submission deadline as **18 October 2026** and the judging weights above. Scope therefore favors one polished vertical slice over breadth. ([AI Builder Cup themes and rules](https://aibuildercup.com/themes.html), [competition overview](https://aibuildercup.com/))

## Why this is more than a scam detector

Strong existing products are validation of the problem and potential building blocks, not a reason to imitate them.

| Conventional endpoint | Decision Safety Network endpoint |
|---|---|
| “This call may be a scam.” | “This unverified claim is now connected to a new beneficiary and an irreversible transfer; pause it while we complete an independent check.” |
| A probability, label, or list of suspicious phrases | A source-grounded map of the claim, requested action, consequence, observed tactics, verification gap, and uncertainty. |
| A warning the user must interpret | An action console that can pause/defer the simulated transfer, launch verification, or request human review. |
| A phone number or generic “contact your bank” instruction | A curated official route with source, method, timestamp, and recorded result. |
| A separate recovery chatbot or checklist | The same Safety Case becomes a recovery case with captured facts and evidence already organized. |
| One-channel protection | A product architecture designed to join conversation, transaction, human, and institutional context while disclosing which integrations are simulated. |

The defensible hypothesis is not “our detector sees better signals.” It is:

> **We convert uncertain risk into a completed safer outcome before money moves—and into a complete emergency case if it already did.**

## Decisions locked for the Cup

These decisions replace the former founder-approval list and are settled for this build:

1. **Cup success comes first.** The prototype proves one complete vertical slice; it does not attempt to prove the entire startup strategy.
2. **The product category is decision safety and incident response, not scam classification.**
3. **The primary theme is BFSI.** The first story is an India-first bank fraud-team impersonation that pushes a user to a new-payee “safe account” transfer.
4. **The product protects the consequential action.** Suspicious words alone do not trigger the strongest intervention.
5. **The core artifact is one continuous Safety Case.** Prevention, verification, human review, and recovery share state and provenance.
6. **The Cup build uses one attack, one payment action, one bank simulator, one consenting ally, English, and synthetic data.** Breadth is a stretch goal.
7. **The AI evaluates the decision environment, never mental competence.** It does not claim to read fear, emotion, rationality, intent, or deception.
8. **Safety-critical actions come from deterministic, versioned playbooks.** Gemini interprets unstructured context; it does not invent official procedures or autonomously choose irreversible actions.
9. **User agency remains intact.** Pause/verify is one tap; continuing is possible after an explicit consequence acknowledgment; the user can correct extracted facts.
10. **Partner actions are honest simulations.** The bank response, transfer state, 1930 acknowledgement, and report handoff are visibly labeled simulated unless a documented sandbox is available.
11. **The Safety Ally is core but narrow.** They receive minimum necessary context and can recommend a pause or contact the user; they cannot control the account or certify a caller as genuine.
12. **Reporting concerns suspected identifiers and evidence.** There is no public blacklist, criminal attribution, autonomous police complaint, or promise to catch the offender.
13. **A bank or payment provider remains the preferred first production partner** because it can alter the irreversible financial action.
14. **Google AI and Google Cloud deployment are mandatory Cup choices.** Exact model selection may be finalized during implementation without changing product scope.

## Cup scope and proof boundary

### Fixed scope

| Dimension | Cup decision |
|---|---|
| **Primary user** | India-based adult making a bank/UPI transfer under live social-engineering pressure. |
| **Incident** | Caller impersonates the fraud team of a clearly fictional **Demo Bank**, claims funds are at risk, demands secrecy, and instructs a transfer to a new “safe” beneficiary. No real bank brand is used to fabricate a response. |
| **Interaction** | Incrementally streamed controlled transcript with visible consent. Browser microphone/VoIP audio is attempted only after the transcript path is stable. |
| **Financial action** | One synthetic new-payee transfer above a precommitted threshold. |
| **Language** | English acceptance path. Hindi/Hinglish is stretch and requires its own evaluation. |
| **Human support** | One pre-authorized Safety Ally on a second lightweight surface. |
| **Institutions** | One fictional Demo Bank in a versioned mock registry and a simulated verification endpoint. Any real public helpline shown for educational context is cited but never made to return a fabricated response. |
| **Recovery routes** | Demo Bank/provider and 1930 first; a reviewable, source-dated **NCRP field-aligned preview** follows. |
| **Data** | Synthetic identities, conversation, account, transaction, and incident data for the public demo. |
| **Deployment** | Functional native Android companion app (React Native shell hosting the mobile-responsive web surface) plus the web surface for the ally and reviewers, using Gemini and Google Cloud/Firebase services. |

### What is live, controlled, simulated, and future

| Classification | Included behavior |
|---|---|
| **Live in the prototype** | Incremental transcript processing; Gemini structured extraction and updates; source-linked Decision Map; deterministic state transitions; user corrections and consent; action controls; ally response; evidence timeline and export generation. |
| **Controlled input** | The scripted call and legitimate control scenario. They are repeatable for evaluation but processed afresh on every run; model outputs are not pre-baked. |
| **Simulated integration** | Payment initiation/pause/cancel state, bank outbound-call verification response, 1930 acknowledgement, NCRP preview, and any partner case status. Every such surface carries a persistent “Simulated” badge. |
| **Future partner capability** | Real cellular call acquisition, bank-grade transaction holds, verified institution callbacks, direct 1930/NCRP/Chakshu submission, and cross-institution intelligence exchange. |

### What the prototype proves—and does not prove

The build can prove that the proposed experience is functional, coherent, technically substantive, and measurable in a controlled environment. It can show that one case moves from live understanding to an actual prototype state change, independent verification, resolution, and reusable recovery evidence.

It does **not** prove universal scam detection, production call access, real bank authority, fund restoration, population-level behavioral efficacy, criminal identity, or real-world loss prevention. Those claims require partners, security review, and field validation.

## Core MVP feature set — complete vertical slice

Every item below is required. This is intentionally more than a classifier, chat interface, warning card, or clickable design mockup.

| ID | Core capability | Acceptance outcome |
|---|---|---|
| **C1** | **Decision Safety Plan** | The user explicitly configures one context-aware policy—“protect a large new-payee transfer when someone is directing me live and their claim is still unverified”—selects the Demo Bank route, nominates one consenting ally, and chooses processing, retention, sharing, and export preferences. Conversation alone and an ordinary transfer alone do not produce the enhanced intervention. |
| **C2** | **Live controlled Safe Session** | The product incrementally processes streamed transcript segments rather than revealing a precomputed result. The UI identifies the input as controlled and shows when live processing is active, unavailable, or degraded. Audio acquisition is not required for core acceptance. |
| **C3** | **Gemini Living Safety Case** | Gemini maintains structured fields for claimed identity, central claim or threat, requested action, amount, payee, deadline, observed tactics, verification status, uncertainty, and missing information. Every displayed fact links to its supporting utterance and can be corrected by the user. |
| **C4** | **Conversation-to-payment binding** | The simulated payment surface emits beneficiary, amount, new-payee, and submit-intent events. The system joins them to the active Safety Case and records that manipulation context and financial consequence have converged. This cross-context binding is the central innovation. |
| **C5** | **Stateful intervention orchestrator** | The canonical Cup state machine advances through **Observe → Check → Pause → Verify or Recover → Resolve**, including correction rollbacks and direct recovery entry. Gemini supplies structured context; a deterministic, versioned policy selects the allowed intervention. Internal state/debug detail is presenter-only; the pressured user sees the reason and next action, not machinery. |
| **C6** | **Explainable action console** | At the decisive moment, the user sees no more than three source-supported reasons and direct actions: **Pause/Cancel**, **Verify Officially**, **Ask My Ally**, and an honest **Continue after acknowledgment** path. Selecting Pause or Cancel changes the simulated transfer state; it is not merely an alert dismissal. |
| **C7** | **Completed simulated institution-verification workflow** | The workflow launches from the versioned Demo Bank registry, never caller-supplied data. The clearly labeled simulated endpoint reports whether Demo Bank has an outbound fraud call or protected-account transfer request. Registry version, method, time, simulation status, and result are written back to the case. |
| **C8** | **Safety Ally live review** | A second authenticated browser session receives only the claim, proposed action, amount, verification gap, and selected evidence—not the full transcript by default. The ally can contact the user, recommend pause, and record the independent source checked. They cannot control funds or mark the caller verified. Real push/SMS delivery is not a core dependency. |
| **C9** | **Resolved prevention outcome** | The primary path ends with the **simulated Demo Bank response** rejecting the claim and the **simulated transfer** cancelled/deferred. The case records exactly that outcome and preserved user agency; it does not say a real payment was prevented. A separate legitimate high-pressure control scenario must remain quiet or use only proportionate verification. |
| **C10** | **Instant “I already paid” recovery** | From any relevant state, the user can select “I already paid.” The same case reuses the caller, claim, payee, amount, transaction time, and evidence; asks only harm-routing questions that remain unknown; then puts bank/provider and 1930 actions first and in parallel. |
| **C11** | **Evidence timeline and emergency handoff** | The product separates source artifacts from AI summaries, builds a correction-preserving event timeline, identifies missing fields, and produces a user-reviewable human brief plus a source-dated NCRP field-aligned preview. It records simulated acknowledgements and warns about recovery scams; it never claims form acceptance or that a real report was filed. |
| **C12** | **Consent, provenance, audit, and failure controls** | Separate consent exists for processing, retention, ally sharing, and export. If retention is declined, source links expire after the session and recovery uses only labeled, user-confirmed structured facts. If accepted, the user promotes selected excerpts into evidence before raw content expires. Corrections append superseding events; deletion removes the artifact/PII and leaves only a minimal tombstone audit fact. If AI inference fails, deterministic pause, verification, and recovery paths remain available. |

### Causal acceptance matrix

The demo must prove that cross-context fusion adds behavior beyond a normal transaction rule:

| Conversation context | Payment context | Required product behavior |
|---|---|---|
| Manipulation cues and an unverified claim; no consequential action | None | Remain in Observe/Check, offer quiet verification, and do **not** structurally pause anything. |
| No manipulation context | Above-threshold new-payee transfer | Show the simulator's ordinary confirmation/precommitment reminder; do **not** show the enhanced social-engineering intervention or claim that conversation risk exists. |
| Manipulation cues + unverified claim | Matching above-threshold new-payee transfer directed during the interaction | Enter Pause, bind the two sources, show the enhanced intervention, and require the explicit Pause/Verify/Continue decision. |
| Joined context later corrected or disproven | Transfer remains open | Roll back proportionately to Check or the ordinary transfer flow, while preserving the correction in audit history. |

### Canonical Cup state transitions

| Current state | Allowed next states | Typical cause |
|---|---|---|
| **Observe** | Check, Recover, Resolve | An unverified material claim appears; user says payment already occurred; session ends without concern. |
| **Check** | Observe, Pause, Verify, Recover, Resolve | Correction removes the cue; joined consequential action appears; user requests a check; user reports harm; benign resolution. |
| **Pause** | Check, Verify, Recover, Resolve | Correction/rollback; verification chosen; harm already occurred; transfer cancelled/deferred or user continues after acknowledgment. |
| **Verify** | Pause, Recover, Resolve | Verification is incomplete while action remains open; harm is reported; simulated result and user action resolve the case. |
| **Recover** | Resolve | First-hour handoff is completed, deferred, or deliberately exited. |
| **Resolve** | Recover or new case | Later discovery of harm reopens recovery; a new incident creates a new case. |

User correction, model failure, timeout, and override transitions must be tested. No generative output may create a transition outside this table.

### Core quality bar: “no corner cutting”

The core is complete only when all of the following are true:

- Gemini inference runs live on every demonstration; no scripted JSON substitutes for the central reasoning step.
- During the session, every displayed case fact is source-linked or clearly labeled as user-entered, simulated-partner-returned, or unknown. After an opt-out/expiry, retained structured facts are visibly marked “source not retained.”
- Safety-critical actions are selected from versioned deterministic playbooks, not generated free-form.
- The payment, verification, ally, resolution, and recovery branches create real, inspectable state transitions inside the prototype.
- Every external bank, government, or authority response is persistently labeled **Simulated**.
- The same Safety Case survives the prevention-to-recovery transition without re-entering facts.
- The legitimate control scenario is part of acceptance, not an optional polish item.
- The controlled target from decisive transcript segment to visible intervention is p95 ≤ 3 seconds; measured results are reported rather than implied.
- The pressured-state interface uses large targets, keyboard and screen-reader semantics, sufficient contrast, blame-free language, and no more than three reasons at the decisive moment.
- A model/API failure never removes manual Pause, Verify, “I already paid,” or official-contact options.
- The full primary journey works without any stretch feature.

## Stretch feature set — only after core acceptance

Stretch work begins only after all core acceptance tests pass, the deployed core journey is stable, and a complete three-minute demo cut exists. Items are attempted in this order unless implementation evidence changes the risk:

| Priority | Stretch capability | Added value |
|---|---|---|
| **S1** | **Browser microphone/VoIP audio ingestion** | Add live speech-to-text input after the incremental transcript path passes all core gates; do not destabilize the orchestration demo for an ASR flourish. |
| **S2** | **Hindi/Hinglish and code-switching** | Human-reviewed intervention copy plus measured transcription/extraction behavior for one parallel scenario; not a superficial translation toggle. |
| **S3** | **Multimodal evidence intake** | Screenshot, SMS/chat, URL, QR, or payment-request input joins the same Safety Case before or during the interaction. |
| **S4** | **Mock bank review/temporary defer contract** | A richer simulated bank adapter accepts the case, places the transfer in manual review, and returns a signed, time-bounded status. |
| **S5** | **Second incident archetype** | Remote-support/remote-access fraud, with its own containment action and legitimate control—not merely a reskinned script. |
| **S6** | **Fraud-specialist escalation** | Extend the ally pattern to a simulated bank fraud queue that accepts the minimal case and returns case ownership/status. |
| **S7** | **Private identifier intelligence graph** | Correlate phone number, UPI ID, URL, account, and related consented cases while keeping suspicion, provenance, corroboration, expiry, and appeal explicit. |
| **S8** | **Chakshu/no-loss reporting package** | Generate a reviewable suspected-communication package when no money was lost, without unattended submission or public accusation. |
| **S9** | **Personalized post-incident rehearsal** | After urgent work is complete, generate a short, source-dated exercise from the tactics encountered; education never interrupts containment. |
| **S10** | **Experiment and operations dashboard** | Display outcome, latency, correction, false-intervention, and recovery-handoff measures for the evaluation corpus. |
| **S11** | **Advanced resilience and inclusion** | Add offline recovery, audio alternatives, additional assistive-technology/device coverage, and broader localization. Basic keyboard, screen-reader, text-scaling, target-size, and contrast smoke tests remain core. |

Deepfake detection, antivirus, identity/dark-web monitoring, public blacklists, autonomous complaints, real payment blocking, crypto tracing, multiple countries, and an open scam-content feed are **not stretch goals**. They are outside the Cup product.

## End-to-end user journey and three-minute demo

The video is one continuous story, not a tour of twelve features.

| Time | Beat | What the judge should understand |
|---|---|---|
| **0:00–0:10** | **Prepared before pressure** | Show a preconfigured plan summary—not the setup walkthrough—with the context-aware transfer policy, Demo Bank route, and ally. The full configuration remains functional in the product. |
| **0:10–0:40** | **Manipulation develops** | During the controlled interaction, the Living Safety Case quietly extracts the bank claim, secrecy, urgency, and instruction. Source links and uncertainty are visible; no alarm fires merely because the language is suspicious. |
| **0:40–1:10** | **Conversation meets consequence** | The user opens the simulated payment surface and attempts a new-payee transfer. Cross-context binding moves the case to Pause and explains the three strongest observed reasons. This is the principal reveal. |
| **1:10–1:35** | **A safer action is completed** | One tap pauses the simulated transfer. “Verify Officially” uses the versioned Demo Bank route; the simulated endpoint reports no outbound fraud call or safe-account instruction and writes the provenance-bearing result into the case. |
| **1:35–1:45** | **Human support without surveillance** | A single ally response state shows the minimal packet and a recommendation to stop; no notification/setup tour displaces the core reveal. The case resolves as “simulated claim rejected; simulated transfer cancelled.” |
| **1:45–2:25** | **Recovery branch, same case** | The presenter switches to “I already paid.” Captured transaction and conversation facts instantly populate bank/1930 first-hour actions, an evidence timeline, and the NCRP field-aligned preview. Unknowns remain blank and partner acknowledgements are labeled simulated. |
| **2:25–2:40** | **Legitimate control** | A short result view shows the same system did not over-intervene in a legitimate high-pressure interaction and records the measured guardrail. |
| **2:40–3:00** | **Close** | “Not a better warning. A completed simulated safer outcome—and a ready emergency case when prevention fails.” Show the Google AI/Cloud architecture and honest simulation boundary. |

## AI design and technical architecture

### Why generative AI is necessary

The meaningful AI work is semantic and stateful:

- understand indirect, evolving, and paraphrased claims rather than match keywords;
- extract the claimed identity, threat, requested action, tactics, contradiction, and verification gap from messy language;
- update a structured case as new utterances and transaction events arrive;
- bind evidence across the conversation and payment contexts;
- generate a short, grounded explanation using only cited case facts;
- transform unstructured incident evidence into reviewable structured fields;
- degrade safely when confidence or evidence is insufficient.

GenAI is not used merely to produce educational copy or decorate a deterministic demo.

### Responsibility boundary

| Gemini responsibilities | Deterministic product responsibilities |
|---|---|
| Incremental semantic extraction and normalization | State machine and allowed transitions |
| Linking each extracted fact to source spans | Safety thresholds and intervention policy |
| Detecting observable tactics and contradictions | Curated official contacts and response playbooks |
| Summarizing the claim and verification gap | Transfer pause/cancel/defer state changes |
| Grounded explanation and evidence-field drafting | Consent, retention, sharing, and export enforcement |
| Structured recovery-field suggestions, with unknowns preserved | Bank/1930/NCRP routing and simulation labels |

Conversation content is treated as untrusted data. It cannot issue system instructions, change tools, supply an “official” contact, alter the policy, or mark itself verified.

### Prototype components

1. **User experience:** a native Android companion app hosting the responsive web/PWA surface (Safe Session, Decision Map, action console, recovery, and evidence review); the same web surface serves the Safety Ally and reviewers.
2. **Controlled interaction source:** incremental transcript emitter with explicit demo labeling; browser microphone/VoIP audio is stretch. The native companion also surfaces one consented, session-scoped on-device signal (an incoming SMS) correlated into the case — not always-on monitoring.
3. **Gemini Decision Context Agent:** returns schema-constrained Safety Case updates with source-span references and uncertainty.
4. **Safety Policy Engine:** deterministic state machine and versioned playbooks.
5. **Payment simulator:** emits transfer intent and receives pause/cancel/defer/continue commands.
6. **Verification adapter:** retrieves the versioned fictional Demo Bank route and returns a visibly simulated, unbranded partner result.
7. **Safety Ally client:** second authenticated lightweight surface with minimum necessary disclosure, revocable access, and server-enforced field filtering.
8. **Recovery orchestrator:** bank/1930 first-hour plan, harm routing, progress, and secondary-scam protection.
9. **Evidence service:** source/summary separation, timeline, provenance manifest, review preview, and export.
10. **Case store and audit:** structured case state, consent, corrections, policy/model versions, and simulated acknowledgements.

### Google platform plan

- **Gemini** through an appropriate supported Google AI interface for structured extraction, state updates, grounded explanations, and evidence transformation.
- **Cloud Run** for the orchestration/API services and policy engine.
- **Firebase Hosting** for the responsive user and ally surfaces.
- **Firestore** for synthetic case state and audit events; security rules isolate user and ally views.
- **Firebase Authentication** for the two demo roles and **Cloud Messaging** only if reliable ally notification adds value.
- **Cloud Storage** only for deliberately retained synthetic evidence, with short lifecycle rules.

Exact services may be simplified during implementation, but live Gemini reasoning, deployed stateful behavior, and honest simulation labels are non-negotiable.

## Cup acceptance criteria and evaluation

### Judge-facing scorecard

| Judging dimension | Evidence in the submission |
|---|---|
| **Technical Merit & GenAI** | Deployed functional prototype; fresh Gemini output on every run; schema-constrained evolving state; source grounding; transaction-event fusion; deterministic action policy; graceful failure; compact architecture/data-flow visual. |
| **Problem Alignment & Impact** | One realistic India-first BFSI incident completed through prevention and recovery; time/steps removed from the first-hour handoff are shown; impact claims remain bounded to controlled evidence. |
| **Innovation & Creativity** | Direct comparison between a detector's endpoint and the closed Safety Case; the cross-context payment bind and no-re-entry recovery conversion are visibly demonstrated. |
| **UX & Solution Design** | One-tap safe action, ≤3 reasons, fair override, user correction, minimum ally disclosure, accessible interaction, blame-free recovery, and persistent simulation labels. |

### Evaluation set

The minimum reproducible corpus contains **15 scripts**:

- five bank-impersonation variants, including coaching to ignore safeguards;
- four legitimate high-pressure interactions with independently verifiable purposes;
- three incomplete or ambiguous interactions that should remain in Observe/Check;
- three prompt-injection attacks that attempt to replace system instructions, supply a caller-controlled “official” contact, change the user's policy, or mark the caller verified.

Two people independently annotate expected fields, source spans, decisive events, and allowed states; disagreements are adjudicated by a third reviewer or documented consensus. Run every script five times against a pinned model, prompt, schema, policy, and low-variance generation setting. Record model identifier, configuration, application commit, timestamp, region, and failure/retry behavior. In addition, run 30 warm and 10 cold end-to-end latency trials and explicit model/API-failure and delayed-event cases.

### Measures

| Layer | Required measure |
|---|---|
| **Extraction** | Field-level precision/recall or annotated correctness for identity claim, requested action, amount/payee, tactics, verification state, and source mapping—not one vague “accuracy” score. |
| **Trajectory** | Recall of the decisive turn/event, false Pause rate in legitimate scenarios, and correctness of state transitions. |
| **Causal fusion** | Pass/fail and state trace for every row in the Causal Acceptance Matrix; payment-only and conversation-only inputs must not produce the joined-context intervention. |
| **Latency** | p50 and p95 from decisive transcript/payment event to visible intervention in the controlled environment. |
| **Trust** | Percentage of in-session case facts with a valid source; Demo Bank registry use; invented missing fields; correction propagation; persistent simulation labeling. Targets for the demo corpus are 100%, 100%, 0, 100%, and 100% respectively. Retention opt-out is measured separately and must produce “source not retained,” never false provenance. |
| **Security and authorization** | Prompt-injection success rate must be 0/15 runs. Direct API tests must prove an ally cannot fetch the full transcript, unshared evidence, another case, or revoked fields; revocation must remove access on the next request. |
| **Isolation, scale, and cost** | Run at least 10 concurrent cases, each with a paired user/ally session; require zero cross-case reads and report request/error rate, p95 latency, model calls, input/output tokens, and estimated Google AI/Cloud cost per completed case. This is a prototype test, not a production scale claim. |
| **Recovery** | Time to first bank/1930 action, facts reused without re-entry, evidence-field completeness, and user-detected summary errors. |
| **Optional formative behavior** | If time and safe participant access permit, use counterbalanced allocation against a **best-practice actionable warning**, define inclusion/exclusion criteria, and debrief participants. Compare unsafe simulated transfer completion, completed verification-workflow use, legitimate-action abandonment, comprehension, agency, and recovery time. This study is not a core build gate. |

Any formative behavioral result is directional. The team must not convert a tiny demo study into a real-world efficacy or loss-prevention claim.

### Definition of Cup-ready

The core is Cup-ready only when:

1. the deployed primary journey works end to end on a clean session;
2. the prevention and already-paid branches use the same case;
3. the causal matrix, legitimate controls, injection attacks, state transitions, and failure paths pass;
4. the simulation boundary is visible in product and video;
5. the metric sheet is reproducible;
6. privacy, ally authorization/revocation, correction, override, and one keyboard + screen-reader + 200% text-scaling smoke test pass;
7. a complete three-minute video can be recorded without manual database edits or hidden operator intervention.

## Cup trust, safety, privacy, and accessibility gates

- Obtain distinct, revocable consent for live processing, retention, ally sharing, and export.
- Default raw conversation content to ephemeral processing. If retention is declined, source links expire and retained structured facts are labeled “source not retained”; if accepted, promote only user-selected excerpts into the Evidence Vault.
- Show the user the transcript excerpt supporting each claim and allow correction or deletion. Corrections append a superseding event; deletion removes the artifact/PII and leaves only a minimal audit tombstone.
- Preserve unknown values as unknown; never invent dates, amounts, identifiers, official responses, or filing status.
- Retrieve routes only from curated, versioned records with source and last-reviewed date. The Cup's interactive endpoint is fictional Demo Bank; a cited real public helpline may be displayed only as context and never made to return a fabricated response.
- Store the NCRP field-map source and review date, leave unsupported fields blank, and label the output “field-aligned preview—not submitted or accepted.”
- Minimize the ally packet and keep the full transcript private unless the user deliberately shares it. Enforce this server-side and test direct API denial, cross-case isolation, and immediate revocation—not only hidden UI fields.
- Do not expose a scam probability, emotion label, competence assessment, guilt attribution, or public blacklist entry.
- Keep “continue” available without manipulative UX, but state the consequence plainly.
- Provide large touch targets, keyboard navigation, screen-reader semantics, sufficient contrast, text scaling, and plain language; validate one complete primary path with keyboard, a basic screen reader, and 200% text scaling.
- Make urgent recovery usable even when Gemini is unavailable.
- Treat all transcript, screenshot, and caller content as hostile input for prompt-injection purposes.

## Explicit Cup non-goals

- Always-on monitoring of cellular calls, SMS, WhatsApp, screen content, or payments.
- A claim that an ordinary Android application can capture both sides of every phone call.
- Standalone call-audio recording by the companion app; production call capture is via OEM/dialer/carrier/partner integration, and the companion's only on-device signal is a consented, session-scoped incoming-SMS read.
- Real bank blocking, freezing, cancellation, refund, restoration, or caller verification.
- Direct unattended submission to banks, 1930, NCRP, Chakshu, police, telecom operators, or other authorities.
- Publicly marking a phone number, account, or person as criminal.
- Emotion, stress, deception, cognitive-capacity, or mental-state detection.
- Deepfake detection as a verdict, identity monitoring, credit monitoring, antivirus, device cleaning, crypto tracing, or fund-recovery services.
- Autonomous legal advice, police narrative, or complaint represented as verified fact.
- Child/guardianship workflows, continuous location tracking, multiple jurisdictions, or broad household surveillance.
- A generic chatbot, open social feed, unmoderated community reporting, or broad scam-news product.

## Cup delivery risks and mitigations

| Risk | Cup consequence | Build response |
|---|---|---|
| **Looks like transcript classification plus a warning** | Innovation collapses. | Make the conversation-to-payment bind, actual simulated-transfer state change, completed simulated verification workflow, and same-case recovery the unavoidable center of the video. |
| **Too much scope for the deadline** | An impressive diagram but unreliable prototype. | Freeze the one-incident/one-bank/one-ally/one-language contract; begin stretch only after the Cup-ready definition passes. |
| **Gemini appears decorative** | Weak Technical Merit score. | Show fresh structured outputs, source spans, state evolution, failure handling, and cross-context reasoning; reserve policy execution for deterministic code. |
| **Mock integrations look deceptive** | Trust and feasibility objections. | Persistent simulation badges, a live/controlled/simulated table, and no narration implying real authority. |
| **False positives make the UX alarmist** | Judges see another warning engine. | Include ambiguity and a legitimate high-pressure control in the core test suite; report false Pause behavior. |
| **Recovery becomes a checklist** | Closed-loop value disappears. | Demonstrate captured facts, no re-entry, prioritized parallel bank/1930 actions, evidence provenance, and a generated review package. |
| **Privacy concerns dominate** | The product feels like surveillance. | Visible session consent, ephemeral default, minimal ally disclosure, correction, deletion, and no always-on acquisition claim. |
| **Demo latency or network failure** | The key reveal fails. | Pre-warm services, display honest progress/degraded state, and retain deterministic manual Pause/Verify/Recover paths. |

---

# Part II — Product foundation, evidence, and post-Cup expansion

## 1. Long-term validation and venture thesis

### Recommendation

Proceed with the idea, but narrow and reposition it.

The opportunity is **not** another scam detector, spam blocker, phone-number reputation service, emotional-state detector, or generic fraud-recovery chatbot. Those categories are already occupied. Google, Truecaller, Trend Micro, Aura, Scamnetic, banks, behavioral-biometrics vendors, and government services each provide substantial pieces of the proposed experience.

The defensible product is:

> **An India-first decision-protection and incident-response layer designed to recognize when observable manipulation is converging with an imminent, high-impact action; introduce proportionate friction; help the person independently verify or involve a trusted human; and guide rapid containment, evidence collection, and authoritative reporting if harm has already occurred.**

The product protects the **decision and its aftermath**, not merely the communication channel.

### Validation verdict

| Question | Verdict |
|---|---|
| Is the underlying problem real and economically important? | Yes. Reported fraud losses and the scale of Indian emergency-reporting systems establish material harm. |
| Is psychology a legitimate part of the problem? | Yes. Urgency, secrecy, authority, cognitive load, fear, and repeated commitment can impair careful verification. |
| Can AI reliably decide whether a person is rational or “in the right state of mind”? | No. That claim is scientifically weak, ethically unsafe, and unnecessary. |
| Is live scam classification novel? | No. Google Pixel, Hiya, Aura, NeoRakshak, Diopter, and others already analyze calls or conversations. |
| Are family alerts or trusted contacts novel? | No. Truecaller, Trend Micro, Monzo, Carefull, and EverSafe already provide variants. |
| Is generic recovery guidance novel? | No. IdentityTheft.gov, EnfoldAI, banks, and public reporting portals already provide portions of it. |
| Is there meaningful whitespace? | A credible hypothesis exists: joining conversation cues to transaction context and an actionable verification path may improve behavior and recovery handoff. It is not yet proven. |
| Is a standalone application sufficient for the full vision? | No. System-level call access and transaction controls require privileged roles or institutional partnerships. |
| Is there a credible AI Builder Cup demo? | Yes, if it completes one bank-impersonation/new-payee-transfer Safety Case through prevention and recovery, labels all controlled inputs and integrations, and avoids real-world efficacy claims. |

### The key strategic correction

The original insight should be preserved but expressed more precisely:

- **Do say:** “The system identifies observable manipulation cues, the requested action, and what remains unverified.”
- **Do not say:** “The system knows whether the user is scared, irrational, coerced, or incapable of deciding.”

The product evaluates the **decision environment**, not the person’s mental competence.

---

## 2. Why this problem deserves a product

### 2.1 The harm is large and time-sensitive

Fraud is not merely a nuisance-message problem. The US Federal Trade Commission reported $15.9 billion in reported fraud losses during 2025, including $3.5 billion attributed to imposter scams. The FBI’s 2025 Internet Crime Report recorded more than one million complaints and $20.9 billion in losses, with cyber-enabled fraud accounting for most reported losses. These are reported figures and therefore do not measure all harm. ([FTC](https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025), [FBI IC3](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf))

India’s response infrastructure demonstrates both scale and the value of speed. By 30 June 2026, the Citizen Financial Cyber Fraud Reporting and Management System had helped save more than ₹11,158 crore across more than 32.80 lakh complaints, according to the Ministry of Home Affairs. “Saved” is the government’s aggregate wording; prevented, held, liened, attributable, and actually restored funds are different states. ([Ministry of Home Affairs](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2290377&lang=2&reg=48))

The implication is direct: when a victim has transferred money or surrendered account access, a calm explanation delivered hours later is insufficient. The first useful action may be contacting the bank, payment provider, or 1930 immediately, followed by a complete official report.

### 2.2 Modern scams attack the decision process

Many attacks create a recognizable environment rather than relying on one suspicious phrase:

1. A trusted or powerful identity is claimed.
2. A threat, reward, or urgent problem is introduced.
3. Independent verification is discouraged.
4. The target is isolated or told to maintain secrecy.
5. Cognitive load is increased through continuous instructions.
6. The target is pushed toward an irreversible or difficult-to-reverse action.

Behavioral research supports active, contextual intervention. High-arousal and time-pressure conditions can reduce careful scrutiny; active warnings outperform passive indicators; and structural options such as cancel, defer, and independently verify can outperform another paragraph of warning text. Repeated generic warnings also habituate users. ([Hanoch et al., 2026](https://doi.org/10.1177/15291006261431553), [Egelman et al., 2008](https://www.cs.cmu.edu/~jasonh/publications/chi2008-active-warnings-study-final.pdf), [Payment Systems Regulator research](https://www.psr.org.uk/media/efpdiwpk/using-behavioural-economics-to-understand-and-prevent-app-fraud.pdf))

### 2.3 Detection and action are fragmented

Today, different systems may:

- flag a caller;
- classify a message or URL;
- detect unusual payment behavior;
- warn about screen sharing;
- let a trusted contact review a payment;
- accept a suspected-communication report;
- coordinate tracing and possible holds after an emergency report;
- provide a recovery checklist.

The person under pressure must still understand the warning, decide what to do, find an independent contact, explain the incident, preserve evidence, contact the right financial institution, and navigate official channels. The fragmentation is itself a failure mode.

### 2.4 The victim is often least able to coordinate the response

After an incident, victims commonly experience shock, shame, self-blame, confusion, and fear of judgment. The product should reduce cognitive load and never imply that victimization proves ignorance or low intelligence. Susceptibility is situational and can affect experienced, educated, and technically capable people.

The relevant product question is therefore:

> **Can we make the safe next action obvious and easy when observable pressure, cognitive load, or distress makes careful verification harder?**

---

## 3. Product thesis

### 3.1 Product promise

> **When pressure and a consequential action converge, Decision Safety Network helps the user pause, verify, get human support, and act safely. If harm occurs, it guides immediate containment and prepares evidence and reporting.**

### 3.2 Product category

The proposed category is **decision safety**, comprising four connected capabilities:

1. **Readiness:** establish trusted contacts, safe policies, and verified institutional routes before a crisis.
2. **Live decision protection:** identify a high-risk decision context and introduce proportionate, actionable friction.
3. **Incident response:** reduce time to containment and guide the user through the correct sequence after loss or compromise.
4. **Collective intelligence:** convert consented, evidence-backed incident signals into safer future decisions and better institutional reporting.

### 3.3 North-star outcome

> **A consequential action is independently verified, safely abandoned, or appropriately completed before irreversible harm; a pause or human review is an intermediate path to that outcome.**

When prevention fails, the recovery outcome is:

> **The user completes the first appropriate containment and reporting action as quickly as possible with a complete, well-organized evidence record.**

### 3.4 What creates differentiation

The differentiation is not any single model or feature. It is the closed-loop orchestration of:

**observable pressure + action consequence + verification gap → proportionate intervention → human or institutional verification → containment → evidence → official reporting → learned protection**

The product will be defensible only if this orchestration produces safer behavior than a best-practice contextual and actionable warning while preserving legitimate decisions.

---

## 4. Target market and first wedge

### 4.1 Geographic and regulatory scope

The first product definition is India-first. Reasons include:

- widespread real-time payments and high consumer familiarity with UPI;
- a clear, urgent financial-fraud reporting pathway through 1930 and the National Cyber Crime Reporting Portal;
- telecom reporting through Chakshu;
- strong potential partners across banks, wallets, telecom, Android, and public digital infrastructure;
- a need for multilingual and family-assisted safety experiences.

This is not a global recovery product in the first release. Reporting, liability, payment rails, and official processes vary too much by jurisdiction.

### 4.2 Initial incident type

The first incident archetype is:

> **A bank fraud-team impersonation conducted through a controlled phone/VoIP scenario, pushing an Indian adult toward a new-payee UPI or bank transfer to a supposed “safe account.”**

This story fits the BFSI theme, provides a credible independent-verification route, and naturally demonstrates claimed authority, fear, secrecy, urgency, continuous coaching, lack of verification, and a consequential action. A law-enforcement “digital arrest” variant remains useful after the core build, but is not the primary Cup acceptance path.

The product should not be branded as only a safe-account or digital-arrest solution. The incident is a demonstration scenario, not the category boundary.

### 4.3 Primary users

#### Person making the decision

One initial research cohort is India-based Android and UPI users aged roughly 45–70 who manage personal or household finances, are willing to configure a nominated helper, and receive an unexpected bank-impersonation call requesting a new-payee transfer. This is a test cohort for pressured-state and accessibility research, not the target-market boundary; the Cup primary user is any adult represented by the fixed scope in Part I.

This is a coherent research and demonstration persona, not a claim that age causes victimization. The eventual product may serve all adults. Guardrail testing should deliberately include:

- first-generation digital-payment users;
- people managing family finances;
- professionals vulnerable to authority or executive impersonation;
- users with varied language, literacy, disability, and technology comfort.

#### Safety ally

A trusted person chosen in advance who can review a decision or help execute recovery tasks. This may be a family member, friend, bank fraud specialist, or trained helpline agent. A family member must never be presumed safe merely because of the relationship.

#### Institutional partner

A bank, payment service, telecom provider, device/OEM platform, insurer, or safety organization able to supply context or execute an action such as verifying a caller, delaying a payment, ending a screen-share session, or accepting a structured report.

### 4.4 Jobs to be done

**Before an incident**  
“Help me prepare simple safety rules and trusted support so I do not have to improvise under pressure.”

**During an incident**  
“Tell me what specifically is risky, let me pause without panic, and give me a safe way to verify the claim or involve someone.”

**At the point of action**  
“Make it easier to cancel, defer, verify, or get review than to continue blindly.”

**Immediately after harm**  
“Tell me what to do first, help me reach the correct institution quickly, and organize everything they will ask for.”

**During follow-up**  
“Track what remains, warn me about secondary recovery scams, and help me provide coherent evidence without reliving the story repeatedly.”

### 4.5 Working assumptions

- The Cup environment uses synthetic data and controlled VoIP or transcript input; it has no privileged cellular-call, bank, or government access.
- The first research persona uses Android and UPI and can read English; Hindi/code-switching is evaluated separately before being claimed.
- The user remains the decision-maker and can override every standalone-app intervention.
- A participating bank or wallet is the preferred production trigger owner; this partnership is not yet secured.
- Official routes, policies, and phone numbers require versioned maintenance and may change after this draft date.
- Competitor functionality described here comes from official vendor/government materials and is not independent evidence that each feature is effective.
- Real call processing, ally disclosure, institution sharing, and reporting require separate consent and India-specific legal review.

---

## 5. Product principles

1. **Protect agency, do not replace it.** The product supports decisions; it does not declare a competent adult incapable of acting.
2. **Assess context, not character.** Explain observable facts rather than labeling the user gullible, panicked, or irrational.
3. **Action beats alarm.** Every serious warning must offer an immediate safe action.
4. **Safe actions must be easier than risky ones.** Cancel, defer, verify, or ask for help should be one tap where integrations permit.
5. **Intervene proportionately.** A vague suspicious message and a new-payee ₹2 lakh transfer during a coercive call do not deserve the same treatment.
6. **Preserve uncertainty.** “Unable to verify” is not equivalent to “confirmed scam.”
7. **Minimize pressure.** Copy should be calm, specific, nonjudgmental, and comprehensible under cognitive load.
8. **Independent verification only.** Never verify using a phone number, link, or person supplied by the suspicious party.
9. **Consent is continuous.** Monitoring, transcript retention, evidence sharing, and ally involvement are separate choices.
10. **Prevention first, recovery immediately available.** The user must never have to navigate backwards through education content after harm.
11. **No vigilante justice.** The product submits suspected identifiers and evidence to appropriate reviewers; it does not publicly pronounce a person guilty.
12. **Design for failure.** Models, reputation lists, and users will sometimes be wrong. Overrides, auditability, correction, and escalation are requirements.

---

## 6. Product lifecycle: one continuous safety case

The unit of product value is a **Safety Case**, not an alert.

A Safety Case spans five lifecycle phases. These are not a second intervention state machine. The canonical Cup states are defined in Part I; within this lifecycle, **Protect** contains Check, Pause, and Verify, while Recover and Resolve map directly.

| Lifecycle phase | User need | Product behavior |
|---|---|---|
| **Ready** | Prepare before pressure | Configure safety policy, safety allies, official contacts, and short practice scenarios. |
| **Observe** | Understand an unfolding interaction | Extract claims, requested actions, manipulation cues, verification status, and possible consequence. |
| **Protect** | Avoid an unsafe irreversible action | Introduce proportionate friction, independent verification, and human support. |
| **Recover** | Contain damage after money, data, or access was lost | Prioritize bank/provider contact, 1930, account/device containment, evidence, and reporting. |
| **Resolve and learn** | Complete follow-up and reduce repeat risk | Track tasks, preserve outcome, warn about recovery scams, and contribute consented intelligence. |

This continuity is important. A prevention alert already contains useful evidence: claimed identity, phone number, timestamps, requested payee, transfer amount, links, screenshots, and tactics. If the user later confirms loss, the case should switch modes without asking them to reconstruct everything.

---

## 7. Decision-context assessment

### 7.1 What the model evaluates

The product produces a **structured decision-context assessment**, not a single scam probability, mental-state diagnosis, or user-facing risk score.

The assessment is based on four dimensions:

#### A. Manipulation pressure

- Claimed authority or trusted institution
- Urgency or artificial deadline
- Threat of arrest, account closure, loss, shame, or public exposure
- Promise of extraordinary gain or guaranteed return
- Secrecy, isolation, or instruction not to contact family/bank/police
- Instruction to remain on the call while acting
- Repeated rebuttal of the user’s hesitation
- Instruction to bypass a warning or conceal the true payment purpose

#### B. Consequence of the requested action

- Amount and reversibility of payment
- New or unrecognized payee
- OTP, PIN, password, recovery code, or card disclosure
- Remote-access installation or screen sharing
- Account, SIM, email, or device-control change
- Identity-document disclosure
- Multiple transfers or escalating commitments

#### C. Verification gap

- Caller, account, or organization not independently verified
- Contact initiated unexpectedly
- Callback route comes from the claimant rather than an official directory
- Claimed facts conflict with known policy
- Destination account or UPI handle is unrelated to the claimed organization
- No legitimate reason for secrecy or an immediate irreversible action

#### D. Consented situational context

- A payment or account-change flow is open while the conversation continues
- Screen sharing or remote-access software is active
- The action is unusual relative to consented account context
- The user explicitly reports feeling rushed, confused, afraid, or unable to pause
- The other party urges the user to ignore a warning or safeguard

No demographic trait, accent, education level, or disability is itself a risk signal. Self-reported fear, confusion, or difficulty pausing may increase the support offered or simplify presentation, but must not increase the inferred probability that the interaction is fraudulent.

### 7.2 Output

Each assessment keeps five constructs separate:

- **Observed tactics:** the directly supported pressure or manipulation cues;
- **Action exposure:** what is being requested, its value, and how reversible it is;
- **Verification status:** unverified, user-checked, or authoritatively verified, with method, source, and timestamp;
- **Uncertainty:** missing context, conflicting evidence, and model confidence retained for evaluation rather than presented as a pseudo-precise scam percentage;
- **Intervention state:** Observe, Check, Pause, Verify, or Recover.

This separation prevents a severe action, an unverified caller, or a self-reported feeling from being silently converted into a claim that a scam is certain. The user-facing output emphasizes the action to take rather than a red “Critical” label.

Example:

> **Pause before paying**  
> The caller claims to be police, asked you to keep the call secret, and wants an immediate transfer to a new account. Their identity has not been independently verified. Pause the transfer and call the relevant agency using a number from its official website. You may also ask your safety ally to review this request.

### 7.3 Prohibited outputs

The system must not state or infer as fact that:

- the user is irrational, mentally impaired, gullible, panicked, or incompetent;
- the other person is definitely a criminal solely from model output;
- vocal stress proves coercion or deception;
- a transaction is safe because no threat was detected;
- a person should lose control of their finances based only on an AI score.

Voice-derived emotion or stress estimation is excluded from the MVP. If ever researched, it must be separately consented, low weight, non-determinative, culturally validated, and legally reviewed.

---

## 8. Intervention policy

### 8.1 Intervention ladder

For the Cup, the canonical states and allowed transitions are the table in Part I. The ladder below shows the broader product policy, including a future partner-controlled action that is not a Cup state.

| State | Trigger pattern | Intervention |
|---|---|---|
| **Observe** | No consequential request is evident | No warning; retain no transcript by default. |
| **Check** | A material claim is unverified or an early tactic is observed | Quietly explain the observed fact and offer an independent check. |
| **Pause** | A consequential action is imminent and important context remains unverified | Interrupt with the exact concern and one-tap cancel, defer, or independent verification. |
| **Verify** | The user asks for help or the consequential request remains unresolved | Offer safety-ally review or, under a partner service, a trained fraud specialist. |
| **Partner action guard** | A partner’s independently approved fraud policy is met | The institution may request step-up verification, a time-bounded hold, screen-share termination, or manual review under its own authority. |
| **Recovery switch** | User reports money, credentials, identity data, or device access already lost | Stop prevention messaging and begin prioritized containment immediately. |

The partner action guard is a long-term integration, not a standalone Cup claim. It must not be triggered solely by open-ended LLM output. The partner requires a documented rules/risk basis, maximum duration, user notice, human review where appropriate, and a practical challenge or appeal route.

### 8.2 Prompt construction

Every intervention follows:

> **Observed fact → why it matters → safest next action → support option**

Example:

> “The caller asked you to keep this secret and send money immediately. Those instructions prevent independent verification. Pause the payment and call the organization through its official app. You can also ask your safety ally to review this.”

Avoid:

- “CRITICAL! YOU ARE DEFINITELY BEING SCAMMED.”
- a dense list of every detected cue;
- a confidence percentage that the user cannot interpret;
- language that blames the user;
- fear-heavy imagery or countdown timers;
- a passive banner with no action.

The channel itself may be hostile. If screen sharing or a live call is active, the first private-safe option is to stop sharing or end/pause the call before displaying ally identity, account details, or recovery information that the other party could see or hear. Transcript text is untrusted input: attacker instructions, links, and prompt-like phrases must never override system policy, approved playbooks, tool permissions, or source restrictions.

### 8.3 Override behavior

Every standalone-app intervention is advisory and overridable by an adult user. The product must:

- restate the consequence once in plain language;
- offer independent verification and human help;
- keep the proceed option accessible and avoid deceptive or punitive friction;
- avoid repeated escalating alerts after an informed override unless new risk appears;
- log the override locally for the current case;
- never notify a family member automatically unless the user has pre-authorized a narrowly defined policy and can revoke it.

Bank or payment-provider controls may follow separate legal and contractual rules; those controls must be represented as partner decisions, not the AI app unilaterally taking control. They require defined duration, notice, review, and recourse and cannot rely only on a generative-model conclusion.

---

## 9. Full ecosystem capability model

The capabilities below describe the larger product direction. They do not expand or override the Cup build contract in Part I. During the competition, only the narrow implementations explicitly listed in the Core MVP are acceptance requirements.

### 9.1 Capability A — Decision Safety Plan

The user configures a lightweight plan before an incident:

- choose one or more safety allies;
- choose what each ally may receive: review request, risk reasons, amount/payee, or selected evidence;
- specify high-risk policies, such as “ask me to pause before a new-payee transfer above ₹25,000”;
- save independently verified contact routes for banks and important providers;
- select preferred language and accessibility settings;
- rehearse a short scenario explaining that legitimate institutions allow independent verification;
- configure a personal check phrase or family safe word where useful, while explaining that a phrase is weak corroboration, may be learned by an attacker, and never proves identity by itself.

This is a **precommitment tool**, not parental control. The user remains able to revoke access and change policies.

### 9.2 Capability B — Safe Session

Safe Session is the MVP’s honest answer to platform limitations.

The user starts a protected session, or enters through a controlled VoIP/demo call. During that session, the product may process transcript segments and user-provided context with clear consent. The session interface shows:

- claimed identity;
- central claim or threat;
- requested action;
- current verification status;
- important observed tactics;
- current intervention state, separate assessment dimensions, and next approved safe action.

The interface does not show a constantly fluctuating “scam score.” It updates only when a meaningful decision or risk state changes.

Every extracted claim, requested action, and tactic has a visible “That is not what happened” correction path. Corrections remain distinct from source evidence and are logged for evaluation.

Future embedded versions may be triggered by a bank, wallet, default dialer, OEM, telecom provider, or device state. The PRD does not assume an ordinary third-party app can invisibly transcribe all cellular calls. The near-term companion app therefore reads only a consented, session-scoped on-device signal (incoming SMS) and does not record calls.

Whether a pressured user will voluntarily start Safe Session is a go/no-go assumption, not a secondary usability detail. Measure eligible-event coverage and activation. The production hypothesis should therefore migrate toward a bank new-payee trigger plus a lawful device/OEM signal rather than rely indefinitely on self-start.

### 9.3 Capability C — Independent Verification Hub

When identity or authority is material, the user can:

- end or pause the current interaction;
- open the institution’s official application;
- call a verified number sourced independently;
- confirm whether the institution is currently contacting them, where a partner API exists;
- inspect a concise “legitimate institutions will not ask for…” policy;
- send a neutral review request to a safety ally or, in a future partner flow, a fraud specialist.

The system must never use a callback number, URL, QR code, or app supplied solely by the suspicious party.

### 9.4 Capability D — Safety Ally

The user can request help with a single tap. The ally receives the minimum information necessary:

- “A review was requested”;
- the proposed action and consequence;
- selected observable risk reasons;
- options to call the user, recommend pause, or report what source and method they checked.

The ally’s confidence does not make an identity “verified.” Verified status requires a recorded method, independent source, timestamp, and preferably authoritative or partner confirmation. The full transcript is not shared by default. The ally cannot remotely control the user’s device or finances in the MVP.

Safeguards:

- advance opt-in by both parties;
- event-level confirmation unless a narrowly scoped, revocable advance rule applies;
- a brief cancel window before disclosure where delay is safe;
- easy removal and audit history, with private removal that does not alert a potentially abusive ally;
- no silent location or transcript sharing;
- alternative escalation to a bank/fraud specialist;
- a private escape path if the ally may be abusive or compromised.

### 9.5 Capability E — Recovery Mode

Recovery Mode begins with four plain-language questions:

1. **Was money sent?**
2. **Were an OTP, password, PIN, recovery code, or card details shared?**
3. **Was remote access, screen sharing, or an unknown application enabled?**
4. **Were identity documents, SIM details, or personal records shared?**

The answers create a prioritized plan. The first screen begins:

> **You may have been targeted by fraud. You are not to blame. Acting now may limit further harm.**

For an Indian financial incident, the product prioritizes:

1. contact the bank, wallet, or payment provider through a verified route **and call 1930 as co-primary immediate actions**; a safety ally may handle one route in parallel with the user’s permission;
2. capture both acknowledgments and continue following their instructions;
3. capture transaction ID, time, amount, source account, destination account or UPI ID, and acknowledgment number;
4. complete the National Cyber Crime Reporting Portal report promptly, following the SMS/acknowledgment instructions, and attach the relevant evidence;
5. secure affected banking, email, telecom, and device accounts;
6. remove remote-access software and end active sessions;
7. warn about follow-on “fund recovery” scams;
8. notify affected contacts if the user’s identity or accounts may be used to target them.

The official Indian instructions state that a financial-fraud victim may report through 1930 or [cybercrime.gov.in](https://cybercrime.gov.in/) and should be prepared with financial and transaction details. Existing citizen instructions state that after a helpline acknowledgment, the complainant should complete portal registration within 24 hours; the product must display the current acknowledgment instructions rather than rely permanently on a hard-coded deadline. An NCRP acknowledgment is not necessarily an FIR. ([Citizen reporting instructions](https://cybercrime.gov.in/uploadmedia/instructions_citizenreportingcyberfrauds.pdf))

The product must distinguish between:

- an **unauthorized transaction**, where formal liability and dispute rules may apply; and
- a **scam-induced authorized payment**, where the user technically approved the transfer even though the approval was manipulated.

It must not promise reimbursement. RBI guidance makes prompt customer reporting important but legal liability depends on the facts and transaction type. ([RBI customer-protection guidance](https://www.rbi.org.in/commonman/English/scripts/Notification.aspx?Id=2623))

If the later complaint concerns deficient service by a regulated entity, the user should complain to that entity first and use the RBI Ombudsman/CMS route only after dissatisfaction or the applicable response period. This is a service-redress path, not a substitute for immediate bank/1930 reporting and not a fund-recovery guarantee. ([RBI Ombudsman FAQ](https://old.rbi.org.in/commonman/english/scripts/faqs.aspx?id=3407))

It must also distinguish **attempted containment, a hold or lien, eligibility for restoration, and money actually restored**. These are not interchangeable outcomes. An initiated UPI payment generally has no stop-payment facility; rapid reporting may allow institutions to trace and hold money that has not moved further, but neither a hold nor a complaint guarantees return. Fund restoration remains a bank, police, and legal process. ([NPCI UPI FAQ](https://www.npci.org.in/what-we-do/upi/faqs), [CFCFRMS 2.0 and Money Restoration Module](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2290377&lang=2&reg=48))

#### Route by harm

| What happened | First actions | Follow-up route |
|---|---|---|
| Suspicious communication, no money or access lost | End the interaction; preserve the number/message; verify independently | Chakshu for suspected fraud communication; DND/1909 for ordinary unsolicited commercial communication |
| Money sent or financial credentials compromised | Contact the bank/provider fraud channel and call 1930 immediately | Complete NCRP submission, retain acknowledgment, and follow bank/police instructions |
| Password, email, or account-recovery data shared | Secure the most foundational account first; revoke sessions; change credentials from a clean device | Notify affected provider and monitor for account takeover |
| Remote access, screen sharing, or unknown application enabled | Disconnect connectivity where safe; end the session; contact bank from another trusted device | Remove access with qualified support, review transactions, and preserve app/device evidence |
| Unknown mobile connection appears in the user’s name | Preserve the connection details | Use TAFCOP/Sanchar Saathi to review and report the connection |
| Handset is lost or stolen | Secure accounts and preserve IMEI/device details | Use CEIR and the telecom/provider process |
| Aadhaar data or identity documents were exposed | Preserve evidence and contact the relevant issuer | For Aadhaar, review authentication history and consider UID/biometric locking through UIDAI; use issuer and credit/financial monitoring routes as applicable |

Chakshu is intended for suspected communications without loss, not as the critical path after a completed financial fraud. Actual financial loss or cybercrime belongs in the bank, 1930, and NCRP workflow. Direct fund holds, lien removal, restoration, FIR registration, SIM/IMEI blocking, and government-system access are authority or institutional functions, not startup-app functions.

### 9.6 Capability F — Evidence Vault and Incident Timeline

With explicit consent, the product organizes:

- phone numbers, usernames, handles, email addresses, URLs, and UPI IDs;
- claimed names and organizations;
- timestamps and communication channels;
- payment amount, transaction ID, bank/provider, source, and destination;
- screenshots, messages, documents, receipts, and call metadata;
- selected transcript excerpts or audio where lawfully captured;
- the exact requested actions and manipulation cues;
- user actions already completed;
- acknowledgment and complaint numbers;
- a chronological incident summary.

Outputs:

- a human-readable incident brief;
- a structured, machine-readable case package for future partner APIs;
- a checklist showing missing evidence;
- an export the user can review before sharing.

The system must preserve original evidence, mark AI-generated summaries as summaries, record provenance, and never alter the source artifact. It should not manufacture certainty, fill missing facts, or draft allegations as established truth.

For production, the evidence design should add:

- a cryptographic hash when an artifact is ingested and exported;
- source application/device, acquisition method, timestamp, and time zone;
- append-only audit events for every transformation and disclosure;
- explicit labels for transcript, translation, redaction, and AI summary as derivative material;
- an export manifest containing originals, hashes, chronology, and derived files.

Preparation of evidentiary certificates or claims about legal admissibility is excluded until discovery with police, counsel, and court workflows validates the need. The product preserves provenance but does not replace forensic examination.

### 9.7 Capability G — Reporting and Threat Intelligence

The product may prepare a **suspected identifier report** only with user consent and through a supported authority or partner route. Every NCRP, Chakshu, bank, or telecom submission requires event-level user review and confirmation of each allegation. The product must not bypass OTPs, CAPTCHAs, declarations, or false-information warnings and must not submit an unattended complaint.

It must not automatically publish “this person is malicious.” Phone numbers can be spoofed, recycled, or used by an unwitting mule. Reports require:

- provenance and time;
- evidence type;
- model and user confidence kept distinct;
- recency and expiration;
- corroboration where available;
- linkage to an official or partner disposition;
- correction and appeal mechanisms;
- controls against coordinated false reporting.

A result in a public suspect-search tool remains a complaint-derived signal, not authenticated proof that an identifier or person is criminal. It may be incomplete, stale, spoofed, or reassigned. The product must present source, time, status, and limitations and provide a correction route.

In India, the strategic integration targets are Chakshu/Sanchar Saathi for suspected communications, I4C/NCRP for cybercrime reporting, participating banks/payment providers for financial containment, and institutional fraud-risk feeds where access becomes available. CFCFRMS, the Fraud Risk Indicator, the Digital Intelligence Platform, the Mobile Number Revocation List, and institutional suspect registries are partner/government systems, not public startup APIs. The MVP must not scrape CAPTCHA-protected portals or imply access.

For telecom reputation, a number remains only one signal because caller IDs can be spoofed or reassigned. The product must also respect current telecom policy: 1600xx is a verified service/transaction series for regulated BFSI/government use and must not be automatically tagged, blocked, or filtered; 140xx is promotional. Policy data requires versioning because these rules can change.

The value proposition is not “we catch the criminal.” It is:

- make the report faster and more complete;
- reduce repeated victimization from the same infrastructure;
- give authorized investigators better-linked evidence;
- contribute higher-quality signals to institutions that can act.

If an authority or participating institution validates or corroborates an identifier, that reviewed status may inform future private warnings under the partner’s policy. Model output or a single user report must never promote an identifier to “confirmed malicious.” A later institution-facing correlation view may link phone numbers, UPI IDs, URLs, accounts, devices, and cases for authorized investigators; it remains outside the consumer MVP.

### 9.8 Capability H — Education and Readiness

Education supports protection; it is not the main product.

The education experience includes:

- short, verified alerts about current scam patterns;
- interactive two-minute scenarios rather than passive articles;
- practice using “pause, disconnect, verify” actions;
- personalized boosters after a user encounters a tactic;
- family or community drills with consent;
- clear sourcing, publication date, region, and expiry on every threat alert;
- myth correction, including why smart and experienced people are also vulnerable;
- recovery-scam education after an incident.

Content sources should prioritize official authorities, financial institutions, platform safety teams, and reviewed research. Community reports may inform investigation but must not be presented as verified news.

An interactive lesson and current-pattern card are stretch features, not Core MVP acceptance gates. Education must never delay an urgent containment action, and any post-incident lesson is optional with “review later.”

---

## 10. Competitive landscape and positioning

### 10.1 Closest offerings

| Offering | What it already does | Remaining opportunity |
|---|---|---|
| **Google Pixel/Android/GPay** | On-device call-scam detection, conversation-pattern alerts, screen-share safety, payment risk, and contextual transaction warnings. | Google can converge these capabilities itself. The opportunity is not permanent fragmentation; it is to prove superior bank-neutral intervention outcomes, consent controls, and India recovery continuity worth integrating. ([Pixel](https://support.google.com/phoneapp/answer/15654065), [Android](https://blog.google/products-and-platforms/platforms/android/new-android-features-march-2025/)) |
| **Truecaller** | Reputation, call screening, transcripts, synthetic-voice scanning, ScamFeed, and Family Protection with live alerts and remote call termination. | No complete decision-to-payment-to-official-recovery case; community content is not the same as verified intelligence. ([Family Protection](https://www.truecaller.com/blog/features/family-protection-by-truecaller-share-the-safety)) |
| **Trend Micro ScamCheck** | Cross-channel scanning, intent/manipulation detection, unsafe-site protection, and Family Circle alerts. | Strong direct overlap on manipulation and family protection; less evidence of India-specific transaction friction, evidence packaging, and official case orchestration. ([Trend Micro](https://www.trendmicro.com/en/about/newsroom/local-press-releases/id/2026/2026-06-03.html)) |
| **Aura** | Call screening/monitoring, identity monitoring, restoration specialists, household protection, and insurance in supported markets. | Broad ecosystem but institutionally US-centric; no India-native reporting or payment intervention. ([Aura service terms](https://www.aura.com/legal/service-terms)) |
| **Scamnetic KnowScam** | Multichannel scan/score, counterparty verification, payment verification, and a human intervention hotline. | Close conceptual competitor; limited public evidence of continuous live call protection, bank-enforced friction, or Indian authority integration. ([Scamnetic](https://scamnetic.com/scanscore/)) |
| **NeoRakshak** | Early Indian product claiming live speaker-mode transcription, manipulation analysis, family alerts, recovery guidance, and complaint drafting. | A direct comparator, not proof of whitespace. Differentiation must be demonstrated head-to-head on legitimate-call interruption, decisive-turn latency, Hindi/code-switch accuracy, behavior change, evidence provenance, privacy, and partner acceptance. ([NeoRakshak](https://neorakshak.in/)) |
| **Sanchar Saathi/Chakshu, FRI/DIP, and I4C/NCRP/1930** | Authoritative reporting plus active prevention: telecom and complaint signals can reach participating institutions through FRI/DIP, which may warn, delay, decline, or restrict transactions; financial-fraud systems coordinate tracing and possible holds. | The remaining gap is consumer decision UX, lawful conversation context, and continuity into evidence/recovery—not connecting telecom intelligence to banks, which already occurs institutionally. ([Sanchar Saathi](https://www.sancharsaathi.gov.in/), [NCRP](https://cybercrime.gov.in/)) |
| **Bank fraud platforms such as BioCatch and Feedzai** | Behavioral and transaction signals; can prompt, delay, decline, or review payments within participating institutions. | See only part of the cross-channel interaction and generally do not provide a consumer-owned safety circle and recovery case. ([BioCatch](https://www.biocatch.com/social-engineering-scam-detection), [Feedzai](https://www.feedzai.com/solutions/scam-prevention/)) |
| **Singapore ScamShield** | Government-backed checking, filtering, reporting, shared intelligence, education, and a helpline with bank transfer pathways. | Strong ecosystem benchmark but country-specific and not a live decision-intervention layer. ([ScamShield](https://www.scamshield.gov.sg/about-scamshield/what-is-scamshield/)) |
| **IdentityTheft.gov and EnfoldAI** | Personalized recovery steps, forms, reporting guidance, and incident organization. | Prove the recovery need, but do not connect an unfolding manipulation event to pre-action friction and a continuous case. ([IdentityTheft.gov](https://www.identitytheft.gov/), [EnfoldAI](https://www.enfold.ai/)) |

### 10.2 What is already commoditized

The product must not claim any of these as its unique invention:

- phone-number reputation and spam blocking;
- URL, QR, screenshot, APK, and message classification;
- live manipulation-tactic scoring;
- deepfake or synthetic-voice detection;
- trusted-contact alerts;
- transaction delays and extra verification;
- generic recovery checklists;
- complaint-letter drafting;
- scam news, quizzes, and awareness content;
- identity monitoring and insurance.

### 10.3 Competitive claim

The credible claim is narrower:

> **The product hypothesis is that combining observable manipulation cues with transaction context and an easy independent-verification action increases safe verification/abandonment without increasing legitimate-payment failure, and that reusing captured facts shortens the bank/1930/NCRP recovery handoff.**

This is falsifiable and remains unproven until it beats a best-practice contextual/actionable warning, not merely a generic banner.

### 10.4 Potential moat

The moat will not be the language model. It could emerge from:

- deeply integrated institution actions and verified callback routes;
- a jurisdiction-specific library of action playbooks maintained with authorities and providers;
- outcome-linked evaluation data showing which interventions work for which decision contexts;
- privacy-preserving cross-channel incident continuity;
- consented safety relationships and precommitment policies;
- structured, provenance-rich evidence packages accepted by partners;
- high-quality, reviewed threat intelligence and identifier resolution;
- multilingual, culturally tested intervention design.

---

## 11. Product architecture and feasibility boundaries

### 11.1 Product form recommendation

Three forms were considered:

| Form | Strength | Limitation | Decision |
|---|---|---|---|
| Standalone consumer app | Fastest to demonstrate and directly understandable | Restricted call/audio/SMS access; weak ability to affect payments; acquisition and trust challenges | Use as the demo and companion surface, not the entire production strategy. |
| Family-safety app | Emotionally resonant and naturally supports human help | Truecaller and Trend Micro already overlap; risks surveillance and coercive guardianship | Include safety ally as a capability, not the category. |
| Embedded B2B2C layer | Can combine device, transaction, and institution signals and execute meaningful friction | Long sales cycles and integration dependency | Make this the long-term product strategy. |

The recommended shape is therefore a **hybrid**:

- a consumer companion for readiness, user-initiated Safe Sessions, evidence, recovery, education, and consent management;
- an SDK/API and policy layer for banks, wallets, telcos, default dialers, OEMs, and safety services;
- an institution console or case interface in a later phase.

### 11.2 Android and call access

An ordinary third-party Android application generally cannot capture both sides of every cellular call. Android reserves capture of voice-call uplink/downlink audio for privileged or preinstalled applications with specific permissions. A call-screening role can identify and screen calls but does not grant universal live audio capture. Google Play also restricts access to SMS and call-log permissions. ([Android audio-input rules](https://developer.android.com/media/platform/sharing-audio-input), [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService), [Google Play restricted permissions](https://support.google.com/googleplay/android-developer/answer/10208820))

Therefore:

- the Cup uses controlled VoIP or simulated audio only;
- any capture is visibly consented and legally reviewed;
- the product never promises invisible, cross-platform monitoring;
- production PSTN live scoring requires an OEM, carrier, or preinstalled privileged integration; default-dialer and CallScreeningService roles provide metadata and call actions, not general transcript access, and Accessibility must not be used as a call-recording workaround;
- iOS parity is not assumed.

Safe Session activation is a go/no-go product assumption. A protection flow that works only after a pressured user voluntarily opens another app may have negligible coverage. The Cup deliberately sidesteps acquisition to test UX. The first production trigger hypothesis is a bank-owned new-payee flow combined with a separately consented device-side signal; activation/coverage rate must be measured before advancing a pilot.

### 11.3 Phase-2 cross-channel contract

The recommended pilot architecture resolves the fact that the phone side sees interaction cues while the bank sees the payment:

| Contract element | Proposed pilot definition |
|---|---|
| **Trigger owner** | Participating bank or wallet when a new-payee transfer meets its own review policy |
| **Signal producer** | Consented device/OEM component or bank-integrated safety SDK; no assumption of ordinary-app PSTN transcript access |
| **Shared fields** | Session present, observed tactic categories, requested-action type, verification state, source/model version, timestamp, and user consent token |
| **Excluded by default** | Raw audio, full transcript, unrelated contacts, and demographic attributes |
| **Bank context** | Amount, payee novelty, destination risk, device/session signals, and customer policy |
| **Decision authority** | Bank’s documented fraud/risk policy and human review—not the language model alone |
| **Response** | Explainable pause, official-bank verification, step-up, time-bounded review, or normal completion |
| **Latency target** | Return the intervention state before payment authorization without materially degrading legitimate flows |
| **Attestation** | Signed source, timestamp, policy/model version, and replay protection |

For the Cup, both sides of this contract are simulated inside one controlled experience and labeled accordingly.

### 11.4 Partner-only capabilities

The following require integrations and must be labeled as future/partner capabilities:

- confirming whether a bank or authority is actively calling;
- detecting a payment screen and new payee across apps;
- delaying, holding, declining, or recalling a payment;
- terminating screen sharing or remote access outside the product;
- submitting structured data directly to an authority;
- checking or updating institutional fraud-risk indicators;
- coordinating a bank fraud specialist in real time.

### 11.5 AI responsibilities

AI may:

- extract entities, claims, requested actions, deadlines, and payment details;
- identify observable manipulation language and conversation changes;
- summarize the case with citations to source artifacts;
- populate the separate decision-context dimensions under an explicit schema;
- map supported facts to a versioned, deterministic, human-approved action playbook;
- translate and simplify approved guidance;
- identify missing evidence;
- map case facts into official form fields for user review;
- personalize a short educational scenario.

AI may not:

- determine criminal guilt;
- diagnose emotion, capacity, or mental health;
- fabricate an official policy or contact;
- invent missing evidence;
- silently submit a report or transfer personal data;
- provide legal certainty or guarantee recovery;
- act as the sole authority for restricting a user’s financial autonomy.

Generative output must not freely invent the safety-critical action sequence. If no approved playbook matches, the safe fallback is to pause, end screen sharing or the call where applicable, and offer an independently sourced institutional contact—not improvise.

### 11.6 Retrieval and source integrity

Institutional phone numbers, reporting steps, and policy statements must come from a curated, versioned source base. Generative output must cite the source used and expose its date. For safety-critical contact actions, the system should render data from structured records rather than rely on open-ended generation.

---

## 12. Privacy, trust, safety, and legal requirements

### 12.1 Data minimization

- Process on device wherever practical.
- Do not retain raw audio or transcript after a session by default.
- Store only the evidence the user affirmatively selects.
- Separate model-improvement consent from product-operation consent.
- Redact unrelated third-party data from shared evidence where possible.
- Provide case-level deletion and export, while explaining that deletion cannot retract evidence already shared with a bank or authority.
- Apply short default retention to unsubmitted suspected-identifier data.

During a live session, the service may keep ephemeral structured fields—claimed identity, tactics, requested action, payee, amount, and timestamps—only for the active case. When harm is reported, the user is asked whether to promote selected fields and available source artifacts into the Evidence Vault. Material not lawfully retained cannot be reconstructed later. Raw conversation content, structured case data, security logs, and legally required traffic/audit logs have separate retention schedules.

### 12.2 Consent model

Separate consent is required for:

- microphone or transcript processing;
- persistent evidence storage;
- cloud processing;
- sharing with a safety ally;
- contacting an institution;
- submitting to an authority;
- contributing de-identified or pseudonymized intelligence;
- using data for model evaluation.

Consent must be comprehensible under stress, but the product should allow advance configuration so the user does not face a dense consent form during an emergency.

India’s Digital Personal Data Protection Act requires consent to be free, specific, informed, unconditional, unambiguous, and limited to necessary data once the relevant provisions commence. As of this draft date, the principal processing duties are not yet effective; the SPDI Rules remain part of the current baseline. The product should nevertheless build toward the 2027 DPDP standard and requires dedicated Indian privacy and communications-law review before real call processing. A future offence-prevention exemption must not be treated as authority to acquire call audio or bypass telecom/platform rules. ([DPDP Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf), [DPDP Rules 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [transition overview](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2202901&lang=2&reg=48))

The principal substantive DPDP duties have a phased commencement, with relevant duties scheduled for 13 May 2027; the product should build to that standard now while counsel also accounts for transitional law and any mandatory log-retention requirement. “Delete immediately” must therefore mean delete when no longer necessary and legally permitted, not erase records that an applicable law requires the service to retain. ([DPDP commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf))

India should not be described as having a blanket one-party-consent rule for call recording. For stored or cloud-processed audio, the safe product default is an audible notice and affirmative acknowledgment from both sides, with a metadata/prompts-only fallback if acknowledgment is not available. Ephemeral on-device analysis still requires explicit primary-user consent and India-specific legal review; if notice/acknowledgment makes live semantics unavailable, the product must fall back rather than record covertly. A court decision admitting a recording in a particular dispute is not general authorization for platform-scale covert recording. ([Supreme Court judgment in Vibhor Garg v Neha](https://www.api.sci.gov.in/supremecourt/2021/31421/31421_2021_5_1501_62289_Judgement_14-Jul-2025.pdf))

### 12.3 Safety ally abuse prevention

- The user chooses the ally; the product does not nominate one automatically.
- Ally permissions are granular and revocable.
- The user can request professional/institutional help instead.
- No ally receives continuous monitoring access.
- No transcript, location, contact list, or financial history is shared by default.
- The product logs every ally access and disclosure.
- A user can privately remove an ally.

### 12.4 Reporting safeguards

- Distinguish “user-reported,” “model-flagged,” “corroborated,” and “authority-confirmed.”
- Preserve source provenance and model version.
- Do not display public accusations against a natural person.
- Account for spoofed and recycled identifiers.
- Rate-limit and monitor coordinated reports.
- Provide correction, expiry, and appeal workflows.
- Never train directly on unreviewed allegations as ground truth.

Public accusations also create material misidentification and defamation exposure under Indian law, particularly for spoofed or reassigned numbers. Warnings remain private, provisional, sourced, and correctable; external publication requires separate counsel and authority review. ([Bharatiya Nyaya Sanhita, section 356](https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf))

### 12.5 Psychological safety

- Use nonjudgmental, trauma-informed language.
- Never ask “Why did you do that?”
- Avoid celebratory gamification immediately after a distressing incident.
- Offer human support and crisis resources when the user requests them or answers a direct safety question, without inferring a crisis from emotion or presenting the AI as therapy.
- Warn that scammers may re-contact victims while pretending to recover funds.

A future trained-specialist service requires a defined provider, operating hours, response-time target, training and supervision, safeguarding script, audit, escalation criteria, and unit economics. Specialists may not diagnose, provide legal certainty, or mark an identity verified without an authoritative method. The Cup and first supervised pilot rely only on a nominated ally unless a partner explicitly staffs this service.

### 12.6 Accessibility and inclusion

- Plain-language reading level appropriate for pressured use.
- Screen-reader labels, large touch targets, strong contrast, and non-color-only risk indicators.
- Text and audio options.
- Support for hearing, vision, motor, and cognitive accessibility.
- Test across Indian English/Hindi accents, mixed-language speech, noisy settings, age groups, and different literacy levels.
- Do not use accent or language fluency as a fraud signal.

Accessibility is a release gate, not a polish item. Before pilot, test TalkBack, large text, captions, haptic/visual alternatives, focus order, plain-language notices, and the absence of color-only meaning. Review applicability of India’s RPwD requirements and IS 17802, and provide privacy notices in English or the user’s chosen supported Eighth Schedule language. Missing or noisy data, lower-cost devices, and speech-recognition errors must be included in fairness evaluation because they can proxy disability, age, income, or literacy even when demographic fields are excluded.

---

## 13. Post-Cup non-functional requirements

Part I exclusively defines Cup non-functional gates. The targets below describe later pilots and production direction; they are not production service-level commitments.

| Area | Requirement |
|---|---|
| **Intervention latency** | In the controlled demo, update within three seconds of receiving a decisive transcript segment. |
| **Explainability** | Every Pause/Verify intervention identifies no more than three strongest observable reasons and the requested action. |
| **Availability** | Post-Cup target: recovery checklist and saved official contacts remain accessible offline after installation. |
| **Graceful degradation** | If AI is unavailable, the user can manually enter “money sent,” “credentials shared,” or “remote access enabled” and receive deterministic recovery steps. |
| **Source integrity** | Every official contact and reporting instruction has a source, region, review date, and expiry/review schedule. |
| **Auditability** | Record assessment inputs, policy version, model version, intervention shown, user action, sharing, and corrections. |
| **Privacy** | Raw conversation content is ephemeral by default; evidence retention is opt-in; raw content, case fields, security logs, and legally mandated logs have separate schedules subject to DPDP/SPDI and CERT-In applicability review. |
| **Security** | Encrypt evidence in transit and at rest; use least privilege; protect export links; maintain tamper-evident case history. |
| **Localization** | Separate safety meaning from literal translation; every intervention is human-reviewed in supported languages. |
| **Reliability** | Deterministic emergency actions must not depend on a generative model producing the correct bank/authority details. |

---

## 14. Production metrics and extended evaluation

Part I is the sole source of truth for Cup acceptance. This section preserves the broader research design and production-partner metrics; any Cup reference below is context, not an additional build gate.

### 14.1 North-star outcome

For the controlled Cup study, the primary endpoint is:

> **Unsafe transfer completion in independently scripted scam scenarios, compared with a best-practice contextual and actionable warning.**

A pause, warning click, or ally contact is an intermediate behavior, not a prevented loss. In the Cup, a final outcome is a recorded simulated verification result followed by simulated cancellation/deferment or appropriate completion of the legitimate control. A production partner study could later measure independently verified outcomes. Cup claims must say “in controlled simulated scenarios,” never “prevented real scams.”

For a production partner pilot, the outcome expands to confirmed scam-induced payment attempts safely abandoned or reviewed, while preserving appropriate completion of legitimate transfers.

### 14.2 Protection funnel and coverage

Measure the entire funnel so self-selected Safe Sessions do not hide the main failure:

- eligible risky interactions or new-payee events;
- trigger coverage and Safe Session activation rate;
- usable signal availability;
- decisive-turn detection;
- intervention delivered before authorization;
- comprehension and chosen action;
- independently verified final outcome.

### 14.3 Signal-model evaluation

Use independently annotated scenarios and separate model quality from intervention quality:

- decisive-turn recall and missed-action rate;
- precision of each observed tactic and requested-action extraction;
- false Pause/Verify state rate on legitimate high-pressure calls;
- calibration and uncertainty handling;
- inter-rater reliability of the ground-truth rubric;
- latency from decisive turn to structured assessment;
- unsafe-reassurance rate when relevant cues are missed;
- ASR and extraction performance by language/code-switching, accent, age, disability, device quality, and noise;
- performance when fields are missing or contradictory.

### 14.4 Intervention experiment

The minimum credible randomized comparison is:

1. a best-practice context-specific warning with an actionable recommendation;
2. the same explanation plus one-tap pause and independently sourced verification;
3. as an exploratory arm, the same flow plus nominated-ally review.

Predefine scam and legitimate scenarios, randomization, primary endpoint, confidence intervals, sample/power assumptions, attrition handling, and order effects. Include repeated exposure, time pressure, and an attacker who explicitly urges the participant to ignore the safeguard. Measure behavior rather than only confidence or intent.

For the Cup, a small study is formative and can support usability findings or a directional simulated-behavior result, not population efficacy.

### 14.5 Behavioral and autonomy measures

- unsafe and legitimate action completion;
- independent-verification completion and result;
- time to disconnect or stop screen sharing where relevant;
- override rate and reason;
- reason comprehension;
- perceived agency, workload, trust, distress, and blame;
- warning habituation and protection disablement;
- unwanted ally disclosure, regret, coercion, or retaliation;
- transfer of learning to an unseen tactic and false suspicion of legitimate interactions.

### 14.6 Guardrails and adverse events

- legitimate-action abandonment and delay;
- unnecessary Pause/Verify interventions;
- privacy/security incidents;
- subgroup disparity in errors and intervention burden;
- harmful, shaming, or panic-inducing prompts;
- unsafe ally or human-support behavior;
- complaints, corrections, and reporting mistakes.

Every pilot needs an adverse-event review process, the ability to disable a harmful intervention or model version, and explicit go/no-go thresholds before expansion.

### 14.7 Recovery metrics

- correct routing by harm type;
- median time to bank/provider contact and 1930 initiation;
- bank and 1930 acknowledgment captured;
- evidence-package completeness and correctness;
- duplicate, false, or misrouted report rate;
- number of times the victim must re-enter the same fact;
- attempted versus confirmed containment, hold/lien, eligibility for restoration, and actual restoration kept separate;
- task burden and distress;
- additional loss after 24 hours, seven days, and 30 days;
- completion of relevant containment tasks and comprehension of recovery-scam risk.

### 14.8 Intelligence metrics

- accepted partner/authority reports, not merely reports submitted;
- evidence completeness and provenance quality;
- duplicate identifier resolution;
- correction and false-report rate;
- time from validated report to protective use;
- repeat incidents associated with a previously reported infrastructure cluster.

No production claim should be made until tested with representative users, languages, accessibility needs, realistic legitimate interactions, and independent safety review.

---

## 15. Go-to-market and ecosystem strategy

### 15.1 Buyer and beneficiary

The consumer is the beneficiary, but the likely payer/distributor is an institution exposed to fraud-operations cost, customer-support burden, regulatory pressure, reputational damage, or retention risk:

- banks and payment providers;
- telecom operators and device makers;
- insurers and identity-protection services;
- employers protecting high-risk payment roles;
- government or public-interest safety programs.

For a scam-induced payment the customer intentionally authorized under deception, the institution may not bear the principal loss. Reimbursement exposure, operational cost, reputation, and customer harm must be modeled separately. Partner discovery must identify an actual budget owner and measurable return rather than assume “prevented loss” automatically accrues to the bank.

### 15.2 Initial distribution hypothesis

The recommended first commercial hypothesis is a bank or wallet partnership:

- the partner can see the imminent action;
- contextual friction can occur before authorization;
- a verified fraud specialist can replace an unsafe family escalation;
- recovery, transaction data, and case status can be joined;
- value can be measured in safely abandoned scam attempts, legitimate-flow preservation, support efficiency, retention, and reporting speed.

A telecom/OEM partnership is the second hypothesis because it improves call context and distribution, but may still lack transaction visibility.

### 15.3 Value proposition to partners

- reduce scam-induced authorized payments;
- improve customer response to warnings;
- lower fraud-support handle time through structured evidence;
- improve report quality and speed;
- offer a trusted safety experience without building every cross-channel component;
- generate auditable explanations for interventions;
- support differentiated protection for customers and families without covert surveillance.

### 15.4 Commercial model hypotheses

- per-active-user or per-protected-account SDK fee;
- per-protected-session decision-orchestration fee;
- enterprise subscription for case and policy management;
- sponsored consumer protection as a bank/telco benefit;
- no advertising based on incident data;
- no sale of personal or allegation data.

Pricing is outside this PRD and requires partner discovery.

### 15.5 Platform build-versus-buy risk

Google can combine Pixel call semantics, Android screen-share safeguards, and GPay warnings; Truecaller controls major call distribution and family protection. Either could extend its own stack. “These capabilities are separate today” is not a durable moat.

The reason to partner with or buy this layer would have to be demonstrated through assets a platform does not cheaply gain from one more classifier:

- bank-neutral decision and recovery orchestration across multiple institutions;
- maintained India-specific response playbooks and evidence schemas;
- independently measured intervention outcomes;
- consent, ally-safety, and survivor-protection controls;
- partner-accepted evidence and reporting workflows;
- multilingual intervention research.

If those assets are not validated, the product risks becoming a feature that a distribution platform can copy.

---

## 16. Roadmap

### Phase 0 — Cup proof

Deliver the complete vertical slice and pass the Cup-ready definition in Part I. No Phase 0 scope may be inferred from the post-Cup capability model.

### Phase 1 — Supervised consumer pilot

- user-initiated Safe Sessions;
- message, screenshot, link, and document intake;
- English/Hindi reviewed interventions;
- deterministic India recovery playbooks;
- encrypted evidence vault;
- nominated-ally escalation with abuse safeguards;
- no real payment blocking.

Exit criteria include acceptable legitimate-interruption rates, comprehension, ally-safety controls, and recovery usability.

### Phase 2 — Bank/payment pilot

- new-payee, amount, device, and session signals;
- partner-confirmed caller or account verification;
- step-up, defer, or manual-review actions;
- bank-specific recovery and dispute workflow;
- outcome feedback for intervention evaluation.

### Phase 3 — Telecom/OEM and authority integrations

- lawful call-context integration;
- verified institution calls;
- direct structured reporting where supported;
- fraud-risk intelligence exchange;
- multilingual expansion;
- rigorous red-team, fairness, and model-monitoring program.

### Phase 4 — Broader decision-safety network

- investment, marketplace, romance, job, support, and business-payment scams;
- employer and small-business payment approvals;
- cross-border jurisdiction packs;
- insurer/restoration partnerships;
- privacy-preserving network intelligence.

Each new scam type must have an actionable intervention and recovery route. “We can classify it” is not sufficient for expansion.

---

## 17. Long-term product risks and mitigations

| Risk | Why it matters | Required response |
|---|---|---|
| **Novelty collapses into a feature bundle** | Most ingredients already exist. | Lead with measurable decision outcomes and continuity; do not list features as the innovation. |
| **Platform access makes the promise impossible** | Ordinary apps cannot invisibly monitor all calls/payments. | Use honest Safe Session in the MVP and pursue embedded partners. |
| **False alarms create habituation or block legitimate activity** | The product may cause harm or be disabled. | Use proportional intervention, uncertainty, legitimate scenarios, overrides, and guardrail metrics. |
| **False reassurance** | No alert may be interpreted as “safe.” | State that absence of a warning is not verification; make independent verification available manually. |
| **Pseudo-scientific emotion claims** | Creates bias, legal risk, and loss of trust. | Exclude mental-state inference; use observable decision context. |
| **Trusted ally becomes surveillance or abuse** | The helper may be coercive or compromised. | Granular consent, revocation, minimal sharing, audit, professional alternative, and private exit. |
| **Evidence contains highly sensitive data** | A breach could compound victim harm. | Minimize, encrypt, isolate, expire, and let the user review every export. |
| **Crowdsourced reports defame or misidentify people** | Numbers are spoofed/recycled; attackers can weaponize reports. | Report suspected identifiers privately with provenance, corroboration, review, expiry, and appeal. |
| **Recovery guidance becomes stale** | Wrong official steps waste the critical response window. | Maintain versioned deterministic playbooks with owners, dates, and source checks. |
| **Institutions do not provide APIs** | The ecosystem story cannot execute. | Design useful user-facing flows without APIs while treating direct actions as partner roadmap. |
| **The demo overclaims automation** | Judges may challenge feasibility. | Label simulated partner responses, show boundaries, and make the partnership strategy part of the pitch. |
| **Victim shame reduces use** | Users may hide the incident or abandon recovery. | Use blame-free language and let the user involve help without narrating the whole event again. |
| **Scammers adapt to prompts** | Attackers coach users around warnings. | Test coaching conditions, vary structural friction, and require independent verification rather than keyword warnings. |

---

## 18. Open research questions

The following remain hypotheses and should be answered through interviews and prototype testing:

- Will users voluntarily start Safe Session before or during a suspicious interaction?
- Which partner can trigger protection at the right moment without excessive surveillance?
- Which intervention changes behavior under real pressure while preserving legitimate actions?
- When is a safety ally helpful, and when does involving them increase risk or embarrassment?
- What minimum evidence most improves bank, 1930, NCRP, and telecom handling?
- Can official reporting systems accept structured handoffs, or must the user still re-enter everything?
- Which Hindi/English phrases remain calm and comprehensible during high arousal?
- What do banks regard as acceptable evidence for a scam-induced authorized payment?
- Can a partner measure successful containment and return an outcome without exposing unnecessary data?
- What false-intervention rate will users and partners tolerate?
- How should the system handle a legitimate but high-pressure action, such as a real family emergency?
- What support should be offered when the selected safety ally may be involved in the exploitation?

---

## 19. Research sources

### AI Builder Cup

- [AI Builder Cup themes, build requirements, and judging criteria](https://aibuildercup.com/themes.html)
- [AI Builder Cup competition overview and dates](https://aibuildercup.com/)

### Problem scale and official response

- [FTC: 2025 reported fraud and imposter-scam losses](https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025)
- [FBI: 2025 Internet Crime Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)
- [India Ministry of Home Affairs: CFCFRMS and suspect-registry figures](https://www.mha.gov.in/MHA1/Par2017/pdfs/par2026-pdfs/LS24032026/5124.pdf)
- [National Cyber Crime Reporting Portal](https://cybercrime.gov.in/)
- [Citizen reporting instructions for financial cyber fraud](https://cybercrime.gov.in/uploadmedia/instructions_citizenreportingcyberfrauds.pdf)
- [RBI customer-protection guidance on unauthorized electronic transactions](https://www.rbi.org.in/commonman/English/scripts/Notification.aspx?Id=2623)
- [NPCI complaint registration](https://www.npci.org.in/register-a-complaint)
- [NPCI UPI FAQ](https://www.npci.org.in/what-we-do/upi/faqs)
- [CFCFRMS 2.0 and Money Restoration Module](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2290377&lang=2&reg=48)
- [Sanchar Saathi](https://www.sancharsaathi.gov.in/)
- [Chakshu scope and routing](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2240592&lang=2&reg=48)
- [Fraud Risk Indicator and institutional actions](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2307871&lang=2&reg=48)
- [TRAI 1600xx service/transaction series and 140xx promotional series](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2283309&lang=1&reg=6)
- [RBI Ombudsman FAQ](https://old.rbi.org.in/commonman/english/scripts/faqs.aspx?id=3407)

### Behavioral evidence

- [Hanoch et al.: psychological science of scams, 2026](https://doi.org/10.1177/15291006261431553)
- [Payment Systems Regulator: behavioral economics and APP fraud](https://www.psr.org.uk/media/efpdiwpk/using-behavioural-economics-to-understand-and-prevent-app-fraud.pdf)
- [Egelman et al.: active phishing warnings](https://www.cs.cmu.edu/~jasonh/publications/chi2008-active-warnings-study-final.pdf)
- [FTC review of scam-prevention messaging research](https://consumer.ftc.gov/system/files/consumer_ftc_gov/pdf/A%20Review%20of%20Scam%20Prevention%20Messaging%20Research.pdf)
- [Kircanski et al.: emotional arousal and susceptibility](https://pmc.ncbi.nlm.nih.gov/articles/PMC6005691/)
- [Barrett et al.: limits of inferring emotion from expression](https://pmc.ncbi.nlm.nih.gov/articles/PMC6640856/)
- [FTC: pre-committed scam action plan](https://consumer.ftc.gov/consumer-alerts/2025/11/use-action-plan-avoid-scams)

### Product and ecosystem comparisons

- [Google Pixel Scam Detection](https://support.google.com/phoneapp/answer/15654065)
- [Google Messages conversational scam detection](https://blog.google/products-and-platforms/platforms/android/new-android-features-march-2025/)
- [Hiya AI Phone](https://www.hiya.com/products/apps/hiya-ai-phone)
- [Diopter](https://diopter.ai/)
- [Truecaller Family Protection](https://www.truecaller.com/blog/features/family-protection-by-truecaller-share-the-safety)
- [Trend Micro ScamCheck](https://www.trendmicro.com/in_id/forHome/products/trend-micro-scam-check.html)
- [Aura service terms and Call Assistant](https://www.aura.com/legal/service-terms)
- [Scamnetic KnowScam](https://scamnetic.com/scanscore/)
- [Singapore ScamShield](https://www.scamshield.gov.sg/about-scamshield/what-is-scamshield/)
- [NeoRakshak](https://neorakshak.in/)
- [EnfoldAI](https://www.enfold.ai/)
- [BioCatch social-engineering scam detection](https://www.biocatch.com/social-engineering-scam-detection)
- [Feedzai scam prevention](https://www.feedzai.com/solutions/scam-prevention/)
- [Monzo Trusted Contacts](https://monzo.com/help/Account%20Security/trustedcontacts)
- [Carefull](https://getcarefull.com/)
- [EverSafe](https://www.eversafe.com/how-we-do-it/)
- [IdentityTheft.gov](https://www.identitytheft.gov/)

### Platform, privacy, and policy

- [Android audio-input sharing rules](https://developer.android.com/media/platform/sharing-audio-input)
- [Android CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService)
- [Google Play SMS and Call Log permissions policy](https://support.google.com/googleplay/android-developer/answer/10208820)
- [Google Play Accessibility API policy](https://support.google.com/googleplay/android-developer/answer/16313518)
- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [DPDP commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [DPDP/SPDI transition overview](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2202901&lang=2&reg=48)
- [Supreme Court judgment in Vibhor Garg v Neha](https://www.api.sci.gov.in/supremecourt/2021/31421/31421_2021_5_1501_62289_Judgement_14-Jul-2025.pdf)
- [Bharatiya Nyaya Sanhita, 2023](https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf)
