# Evidence-led onboarding research

## Scope and confidence

This review treats onboarding as the system that moves a person from first contact to a first meaningful, repeatable success—not as a fixed carousel of welcome screens. It covers product UX, account creation, permissions, connected-device pairing, recovery, accessibility, and measurement. Sources are primary standards, public-sector design systems, platform guidance, regulator findings, infrastructure documentation, and first-party product case studies. Vendor case studies are useful operational evidence, but their numerical or causal claims should be validated in the product's own research.

## Executive synthesis

The best onboarding is **short, contextual, outcome-led, resumable, honest, and recoverable**. It reveals complexity when it becomes relevant, asks only for information required now, explains permissions immediately before the need, and lets the person learn by completing a real task. The UI makes state and progress unambiguous, preserves user control, and provides an escape hatch and a way back.

The worst onboarding optimizes completion of the onboarding UI rather than achievement of user value. Typical failures are forced generic tours, premature registration, bulk permission requests, decorative progress, fake urgency, hidden costs, preselected consent, unrecoverable errors, blank post-tour screens, ambiguous device states, and celebrating “setup complete” before the system has verified the outcome.

For a connected-farm product, activation is not “account created” or “device code entered.” A credible first value event is: **the farmer pairs an authenticated field unit, sees a fresh reading that the server can attribute to it, and understands whether the farm is safe**. A stronger commissioning event adds a safe test command with a device acknowledgement.

## What strong onboarding does

### 1. Starts with the user's outcome and minimizes time to value

Google’s current Android onboarding guidance says to separate what must happen before use from what can happen in context; collect only critical information; show value before account or permission demands; and question whether a walkthrough is needed at all. Contextual learning reduces up-front friction and permits learning while doing ([Android Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)).

GOV.UK defines completion from a real transaction’s start to its confirmed end, includes partial and failed attempts in the denominator, and requires the service to tell the user when the transaction is complete ([Measuring completion rate](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate)). This is a useful corrective to vanity metrics such as “tour viewed.”

Amplitude distinguishes activation (an action completed) from value (the desired benefit experienced), and its own onboarding case study found a major drop between signup and first data sent. It reduced blank-page uncertainty with relevant templates and made setup more prescriptive for different industries and maturity levels ([Time to value](https://amplitude.com/blog/time-to-value-drives-user-retention), [Amplitude’s first-party onboarding case study](https://amplitude.com/blog/get-customers-to-value-faster)). Treat this as a documented implementation example, not a universal causal proof.

**Implication:** define the “first useful outcome” before drawing screens. Remove or postpone any step that does not protect safety, enable that outcome, or satisfy a real constraint.

### 2. Uses progressive disclosure and contextual education

An up-front tour forces novice explanations before the user has context and annoys experienced users. Android recommends contextual onboarding, subtle cues, and in-context tooltips over full walkthroughs, with a persistent skip/login path if a walkthrough exists ([Android Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)).

Intercom’s first-party product-tour guidance argues for action-driven prompts delivered according to the user’s identity, location, and behavior, and for empty states that explain context and offer the next meaningful action ([Product Tours](https://www.intercom.com/blog/announcing-product-tours-for-onboarding/), [First-use onboarding](https://www.intercom.com/blog/product-tours-first-use-onboarding/)). Because Intercom sells this capability, use the pattern but independently validate its effect.

**Implication:** teach a control when the person is about to use it. Keep advanced calibration, automation, team roles, and alerts available after first value. Never hide safety-critical context behind progressive disclosure.

### 3. Makes setup structure, progress, and consequences obvious

Google recommends logical steps, familiar progress indicators, checkpoints, and saved/resumable progress. It specifically warns that decorative illustrations must not double as an ambiguous progress indicator ([Android Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)).

GOV.UK’s pattern library treats start, question, error recovery, check-answers, confirmation, task-list, service-unavailable, and suitability pages as distinct user tasks rather than one generic wizard ([GOV.UK patterns](https://design-system.service.gov.uk/patterns/)). Its suitability guidance also says not to ask questions that users must answer again ([Check a service is suitable](https://design-system.service.gov.uk/patterns/check-a-service-is-suitable/)).

**Implication:** show “Step 2 of 4” plus the step name and remaining work. Before irreversible or safety-relevant actions, show a review. After completion, show evidence, not confetti alone: device name, farm, connection, last reading, and next action.

### 4. Requests permissions at the moment of need

Apple’s HealthKit guidance says to request private data only when needed, tie the request to the current context, explain the benefit succinctly, and avoid duplicating standard system permission UI ([Apple HealthKit HIG](https://developer.apple.com/design/human-interface-guidelines/healthkit)). Android likewise recommends permission priming at the point of need and rejects permissions that cannot be plainly explained ([Android Authentication & Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)).

**Implication:** do not ask for notifications, location, camera, Bluetooth, or local-network access on first launch as a bundle. Explain the immediate purpose (“Scan the unit’s QR code”) and offer a manual alternative where feasible. A refusal must have a usable recovery route through settings or another method.

### 5. Treats device pairing as a security ceremony and a diagnostic flow

Azure’s Device Provisioning Service separates registration (establishing identity) from provisioning (applying configuration), verifies a device’s pre-enrolled credentials, then assigns configuration. It supports X.509 and TPM attestation and emphasizes diagnostic logging ([Azure DPS overview](https://learn.microsoft.com/en-us/azure/iot-dps/about-iot-dps)). AWS fleet provisioning similarly exchanges constrained provisioning credentials for a unique permanent device certificate and recommends monitoring/revoking a compromised claim credential ([AWS fleet provisioning](https://docs.aws.amazon.com/iot/latest/developerguide/provision-wo-cert.html)). Azure recommends X.509 for device authentication ([X.509 attestation](https://learn.microsoft.com/en-us/azure/iot-dps/concepts-x509-attestation)).

**Implication:** pairing should be modeled as explicit states, not a spinner:

1. Identify user and selected farm.
2. Claim the physical unit using a short-lived, single-use QR/code or authenticated installer flow.
3. Verify the unit’s cryptographic identity.
4. Provision tenant/farm configuration with least privilege.
5. Verify internet/cloud connection.
6. Wait for a fresh, device-attributed telemetry event.
7. Optionally run a safe commissioning test and await acknowledgement.
8. Confirm ownership and record an audit event.

Support `waiting`, `verifying`, `provisioning`, `online-no-telemetry`, `receiving`, `test-pending`, `ready`, `expired-code`, `already-claimed`, `wrong-network`, `offline`, and `revoked` states. Every failure should say what happened, what is safe, and what to do next. Never embed a user password in firmware; a human identity and device identity have different credentials and authorization models.

### 6. Builds trust through truthful state and reversible choices

The FTC identifies hiding or delaying material information, interface interference, preselection, disguised content, difficult cancellation, and privacy manipulation as dark patterns. In a 2024 international review, nearly 76% of examined subscription sites/apps showed at least one potential dark pattern ([FTC/ICPEN/GPEN review](https://www.ftc.gov/news-events/news/press-releases/2024/07/ftc-icpen-gpen-announce-results-review-use-dark-patterns-affecting-subscription-services-privacy)). The FTC’s detailed report also calls out prechecked boxes, hard-to-read disclosures, buried terms/fees, confusing cancellation, and tricking users into data sharing ([Bringing Dark Patterns to Light](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf)).

**Implication:** equal visual dignity for accept/decline where consequences are comparable; no fake countdowns; no hidden defaults; disclose data collection and recurring costs before commitment; make unpairing, deletion, and notification changes findable. Never say “connected” based on a browser-to-server connection when the device is stale. Distinguish `command queued`, `delivered`, `accepted`, `applied`, and `failed`.

### 7. Designs accessibility into the flow model

WCAG 2.2 requires meaningful sequence, logical focus order, visible/unobscured focus, labels/instructions, error identification and suggestions, accessible authentication, minimum target sizing, and programmatically available status messages ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)). Focus order must preserve meaning and operation, and context must not change merely because a control receives focus ([Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus)).

**Implication:** onboarding works with keyboard, screen reader, zoom/reflow, high contrast, reduced motion, and autofill. Status never relies on color, motion, or an illustration. Do not impose memory/puzzle-based authentication where an accessible alternative can be provided. Announce asynchronous pairing and validation updates without stealing focus.

## Style and aesthetics

Visual polish should reduce uncertainty, establish hierarchy, and reinforce system state:

- Use one dominant task per screen, a clear heading, concise explanatory sentence, and a visually stable primary action.
- Let brand illustration establish warmth, but keep controls conventional and readable. Illustration must not obscure progress, permissions, errors, or safety status.
- Prefer real product previews or representative data over generic benefit slides.
- Use restrained motion to explain cause/effect or show an active connection. Respect reduced motion and never use perpetual animation as the only “working” signal.
- Maintain consistent layout, navigation, terminology, and control identity; WCAG notes that consistent repeated navigation helps people predict where to find things ([Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)).
- Empty states answer: what this area is, why it is empty, the safest next action, and where to get help.
- On constrained screens, cap readable line lengths and form widths; do not stretch every field or button edge to edge merely because space exists.

## System design blueprint

Model onboarding as a resumable server-side state machine rather than browser-local screens:

```text
invited/anonymous
  → account_verified
  → farm_profiled
  → device_claim_started
  → device_identity_verified
  → device_provisioned
  → telemetry_verified
  → commissioning_verified
  → activated
```

Each transition has: actor, prerequisites, idempotency key, timestamp, result, safe retry, expiry, and audit metadata. Store step completion server-side so another device or support agent can resume. Separate:

- **User account:** authentication, roles, recovery, consent.
- **Farm tenant:** ownership, timezone, notification contacts, operating policies.
- **Device registry:** immutable device identity, credential status, firmware/capability metadata, claim ownership.
- **Provisioning:** temporary claim, permanent credentials, tenant-scoped policy.
- **Commissioning:** connectivity and sensor/actuator verification.
- **Education:** dismissible contextual hints, independent of operational readiness.

Provide rate limiting, expiring one-time claims, tenant isolation, credential rotation/revocation, replay protection, audit logs, offline-safe behavior, and human support escalation. Setup must tolerate refreshes, duplicated requests, intermittent connectivity, and a device arriving online after the user leaves.

## Measurement and experimentation

Instrument transitions and outcomes, not private field contents. Recommended events:

```text
onboarding_started
step_viewed {step, entry_path}
step_completed {step, duration_ms, attempts}
step_failed {step, error_class, recoverable}
setup_saved
setup_resumed
permission_requested {permission, context}
permission_result {permission, result}
device_claim_started
device_identity_verified
first_fresh_telemetry_received
commissioning_test_result
onboarding_activated
help_requested {step}
```

Measure:

- completion rate, including partial and failed starts;
- median/P90 time to first fresh telemetry and first understood value;
- step conversion and retry/error rate;
- save/resume success;
- pairing success by firmware/network/error class;
- permission acceptance **and** downstream task success (not acceptance alone);
- support contacts and recovery success;
- activation-to-7/30-day retention;
- accessibility/usability outcomes from research, not telemetry alone.

Exclude staff, bots, demos, and automated tests as GOV.UK recommends ([Measuring completion rate](https://www.gov.uk/service-manual/measuring-success/measuring-completion-rate)). Combine analytics with interviews and observed usability testing; GOV.UK explicitly recommends performance metrics together with user research ([Define success](https://www.gov.uk/service-manual/service-standard/point-10-define-success-publish-performance-data)).

Experiments must protect trust and safety:

- Predeclare hypothesis, primary success metric, guardrails, population, and stopping rule.
- Randomize at a stable user/tenant level; avoid a user seeing conflicting flows.
- Do not experiment on required legal disclosure, security, emergency actions, or deceptive consent asymmetry.
- Use activation quality, errors, support load, retention, and harm guardrails—not clicks alone.
- Minimize captured personal data and publish a tracking dictionary/retention policy internally.

## Failure modes (“worst onboarding”)

| Failure | Why it fails | Better rule |
|---|---|---|
| Mandatory generic slide carousel | Delays value; lacks task context | Preview real value; teach contextually; allow skip |
| Account wall before any credible need | Demands commitment before trust | Allow preview/demo where safe; ask when persistence/ownership is needed |
| Asking every profile question up front | Increases effort and collects stale data | Ask minimum required now; progressively profile |
| Bulk permissions at launch | Purpose is unclear and refusals become likely | Prime and request at the moment of need |
| Decorative progress metaphor only | Users cannot estimate remaining work | Use explicit step count/name and saved checkpoint |
| Empty dashboard after “success” | Completion yields no orientation or proof | Seed relevant examples or lead directly to first real outcome |
| Spinner during pairing | Hides state, timeout, and remedy | Expose pairing stages, elapsed state, safe retry, diagnostics |
| “Connected” from stale/default data | Misrepresents operational safety | Show data freshness, device heartbeat, and server/browser states separately |
| “Command sent” when merely queued | Conflates intent with physical execution | Show queued → delivered → acknowledged → applied/failed |
| Errors that erase prior input | Punishes recovery | Preserve valid data, focus/announce error summary, explain fix |
| No skip, save, back, or later path | Traps users and causes abandonment | Support safe escape, checkpoint, resume, and help |
| Preselected consent / asymmetric decline | Manipulates consent | Neutral choices, no default opt-in, plain consequences |
| Success confetti without evidence | Emotion substitutes for verification | Celebrate only after a verified result; show evidence and next action |
| One happy-path flow for all roles | Installer, owner, and worker needs differ | Branch by job, capability, and progress; keep authorization explicit |
| Optimizing tour completion | Improves a proxy while value may fall | Optimize time to verified value and downstream retention |

## Evidence-to-rule table for a reusable skill

| Evidence | Skill rule |
|---|---|
| Android: separate upfront essentials from contextual learning | Classify every step as required-before-value, contextual, optional, or removable |
| Android: collect only critical information | Default to minimum viable fields and justify each required input |
| Android/Apple: permission priming at time of need | Never batch permissions; explain immediate benefit, then invoke native request |
| Android: skip/resume and familiar progress | Long flows must expose progress, back, save/exit, and resume |
| GOV.UK: completion spans real start/end and includes failures | Define the user transaction and verified completion before designing screens |
| GOV.UK: confirmation is explicit | End with evidence of completion and an actionable next step |
| Intercom: behavior/segment-based tours and useful empty states | Trigger education from context and behavior; never show a tour to everyone by default |
| Amplitude case study: blank demos and unclear setup caused friction | Use relevant templates/examples and prescriptive next actions without faking live data |
| WCAG: order, labels, errors, status, targets, accessible auth | Treat WCAG 2.2 AA as a flow constraint and test each state, not only static screens |
| FTC: sneaking and interface interference undermine choice | Reject hidden terms, preselection, asymmetric controls, obstruction, and fake urgency |
| Azure/AWS: device identity precedes provisioning | Separate human auth, claim authorization, device attestation, provisioning, and commissioning |
| Azure/AWS: unique credentials and revocation | Use short-lived claims and per-device permanent credentials with rotation/revocation |
| Connected system semantics | Never collapse browser, cloud, gateway, device, sensor, and actuator state into one “online” flag |
| GOV.UK + product analytics | Measure full-funnel completion, verified value, errors/recovery, retention, and qualitative evidence |
| Ethical experimentation | Experiment on clarity/friction, not safety, consent deception, or required disclosure |

## Practical review checklist

Before shipping any onboarding:

1. Can the team name the first meaningful user outcome in one sentence?
2. Does every mandatory step directly enable or safely protect that outcome?
3. Can a person preview value before high-friction commitment where feasible?
4. Are role, farm, user, and device identities distinct?
5. Does every permission request occur in context with a manual/recovery path?
6. Does pairing verify device identity, ownership, connectivity, fresh telemetry, and (when safe) command acknowledgement?
7. Can setup survive refresh, timeout, duplicate submission, offline periods, and another-device resume?
8. Are progress, system status, failure, and completion expressed in plain text—not color or motion alone?
9. Is keyboard/screen-reader/reflow/reduced-motion behavior verified for every state?
10. Are decline, skip, back, save, delete, unpair, and help paths proportionate and findable?
11. Does the final screen prove the outcome and show the next useful action?
12. Are analytics minimal, documented, privacy-aware, and focused on real outcomes?
13. Are experiments guarded against safety, trust, accessibility, and support regressions?
14. Has the flow been observed with representative users, including novices and assisted users?

