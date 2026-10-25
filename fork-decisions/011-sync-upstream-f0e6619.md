# 011: Compose pinned upstream `f0e6619` with fork runtime boundaries

**Status:** Implemented; exact-commit Android acceptance is recorded separately

## Revisions and integration boundary

- Actual Git merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`.
- Source fork tip: `670c8d08a911201a58e915511ad1d724ca9c43d8`.
- Sync branch before implementation: `57ad3322534f5abab5aba1ec1145899c854bc960`.
- Pinned upstream tip: `f0e6619ff02c5510caffbaed80c8b0fb6020de91`.
- Previously squash-integrated upstream content: `9bfe7bb1d47f37e686e128c8c24337006a190f1f`.
- Destination: `sync/upstream-f0e6619-into-main`, in this fork only.

The prior sync was squash-integrated, so its upstream tip was not a Git
ancestor. Resolve repeated textual conflicts with that revision as a
content-only three-way base, then review the remaining overlaps against both
intents. This does not fabricate ancestry: the result is a normal two-parent
merge of the pre-implementation sync tip and exactly the pinned upstream tip.
No later upstream revision is included.

## Upstream intent and fork requirements

The new upstream range introduces React Native 0.87.1, generation leases,
router model readiness and load/unload UI, concurrent tool dispatch, Whisper
dictation, Phonon speech, Plus voice, improved input layout, effort clamping,
and native Metal/dotprod fixes.

Preserve decisions 001–009, including disabled centralized integrations,
user-owned credentials, Copilot, additive Chat Completions/Responses,
immutable protocol/origin bindings, atomic replay persistence, safe diagnostics,
Scout, full search results, startup selection, and the Android voice launcher.
Decision [010](010-preserve-fork-voice-disable-plus-voice.md) explicitly keeps
the fork's hands-free conversation and disables upstream Plus voice in normal
fork builds. The originating fork history is documented in those decisions;
this merge does not supersede those requirements.

## Overlap classification and chosen resolution

### Independent composition

- `src/api/{http,openai,completionEngines}.ts`, `src/api/servers/`,
  `src/store/{ServerStore,ModelStore,RouterStore}.ts`, and remote model sheets:
  combine router readiness/list evidence with fork protocol catalogs,
  Copilot paths/headers, parameter modes, and immutable session credentials.
  Shared URL normalization retains HTTPS/local-origin restrictions and removes
  one trailing `/v1` for both completion and router endpoints. Discovery
  requests may return their own outcome, but only the newest unchanged
  configuration may commit catalog state.
- Model selection revalidates URL, server type, and credential revision after
  awaited context release. Router records and event streams snapshot the same
  boundaries, withdraw after configuration changes, and never use a newly read
  credential against a stale record's destination. Initial router reads cannot
  silently retarget a queued model load.
- `src/services/agent/AgentRunner.ts`, `src/hooks/useChatSession.ts`,
  `useStructuredOutput.ts`, and chat persistence: combine generation leases
  and concurrent tools with authoritative atomic final-step writes and
  Responses replay. Persist calls before any handler; terminal/refused results
  do not dispatch tools. Abort prevents queued handlers from starting and
  produces deterministic cancellation outcomes. Dispatch failures drain active
  siblings rather than orphaning them.
- `src/services/talents/WebSearchEngine.ts`: retain full-result/count policy and
  mode-separated caches while supporting concurrent independent searches.
  In-flight deduplication also respects abort-signal ownership.
- `src/store/TTSStore.ts`, `ChatInput`, `ChatView`, and startup/launcher hooks:
  retain fork conversation narration outcomes, cues, readiness and startup
  preferences alongside upstream speech streaming, echo suppression, input
  sizing, drafts, and Whisper. Whisper recording/transcription holds a pending
  launcher request until the microphone is free.
- Android `MainApplication.kt`, manifest/activity/packages, and iOS
  `AppDelegate.swift`, Podfile, project and native headers: retain fork
  identity, speech/launcher packages and disabled Firebase startup while
  accepting navigation-bar appearance, RN/native upgrades, Whisper, Metal
  policy, and source-build fixes. Keep native payload and patch checks.

### Intentional fork override

- `src/services/plus/{gate,shipped}.ts`, `src/store/VoiceModeStore.ts`,
  `src/hooks/useVoiceMode.ts`, Settings and `App.tsx`: normal builds expose
  neither Plus voice/settings nor a paywall, including through persisted/E2E
  overrides or direct controller entry. Purchase startup and native
  IAP/Nitro/Firebase/Google/Apple authentication remain excluded. Retain gated
  upstream source and unit coverage for integration-enabled builds; their
  existence does not authorize normal-build activation.
- Preserve the fork's explicitly on-device hands-free conversation, without
  Plus entitlement or cloud recognition fallback. Whisper is additive
  dictation, not a replacement conversation path.
- Keep Responses transport, binding/replay/parameter semantics, Scout seeding,
  custom Pal appearance, full-result search, and safe diagnostics even where
  upstream has no corresponding implementation.

### Compatible upstream improvements

Accept the RN/dependency/native patches, router verdict/state-machine tests,
Phonon/Whisper engines, effort clamping, input layout, onboarding/device-rule
improvements, concurrent execution, and platform fixes. Compose their tests
with fork coverage. Tests formerly observing incremental call/finalize writes
now observe the atomic final-step writer; they still assert persistence,
ordering, cancellation, spoken visibility, and session ownership. HTTP test
fixtures use HTTPS where they previously represented non-local cleartext hosts.

## Rejected alternatives and risks

- Blanket conflict-side selection would lose fork transport/privacy/voice or
  upstream readiness, concurrency and platform fixes.
- Faking the prior squash tip as an ancestor would obscure the actual history.
- Relying only on a disabled purchase store would leave independent voice and
  paywall entry points active.
- Keeping sequential tool dispatch would discard upstream behavior; allowing
  queued handlers after abort would regress fork lifecycle safety.
- Removing failing assertions or bypassing payload checks would conceal
  integration errors rather than prove combined behavior.
- RN/native upgrades require a fresh source build. This Linux host has no
  configured Android SDK or Xcode; native runtime acceptance is not inferred
  from TypeScript/Jest.
- Missing non-English keys retain the existing English fallback; no translation
  service was invoked. Physical speech/TTS, live providers/search, camera
  hardware, and iOS runtime behavior remain outside emulator acceptance.

## Preservation checks and acceptance evidence

Passed locally: 452 Jest suites, 8,850 tests and 310 snapshots, with 10
intentionally skipped tests (including disabled-only tests run separately).
The disabled-build lane passes all three suites and eight tests. Root type
checking passes; ESLint reports no errors and 46 warnings. Localization, font
registration, five deterministic Responses fixture tests and their type check,
and disabled native-autolinking inspection pass.

The combined inventory covers store, transport, persistence, agent, search,
voice/TTS, startup, deep-link, UI, platform and payload contracts.

Additional regressions cover server edits across model release, credential
rotation and router reads, Whisper/launcher microphone exclusion, disabled
settings/controller/paywall entry, and simultaneous native package retention.
The disabled lane runs in the Android build workflow as well.

Whitespace checks cover the composed source/configuration. Upstream byte-level
router-wire fixtures and patch files retain intentional CRLF, terminating blank
lines, and unified-diff context spaces; those are not normalized to satisfy a
generic whitespace check.

The final implementation result records actual totals, warnings, final SHA,
workflow run IDs and any blockers. Android acceptance requires a fresh full
`.github/workflows/e2e-tests.yml` source build and install/foreground-launch/
protocol smoke run for that exact final pushed SHA, with no artifact reuse.
No upstream PR, release or deployment is part of this sync.

The first exact-SHA run, `40237980084` at `027a3ee7`, built the APK and passed
native exclusions and payload checks. Smoke setup failed because the broad
URL-field test-ID prefix selector matched Paper's newly exposed label instead
of its native editor; subsequent protocol failures cascaded from the missing
server. Remote/server-details input selectors now constrain Android matches
to `android.widget.EditText`, preserving the iOS identifier strategy. Added
selector regression checks and failure accessibility-tree capture; no product
assertions or smoke scenarios were removed. Any artifact-reuse run is diagnostic
only; final acceptance still requires a fresh source build for the changed SHA.

## Superseded when

A later approved sync supplies equivalent or stronger router, lifecycle,
concurrency, protocol, speech and native behavior while preserving all linked
fork invariants. Only a later explicit product decision can supersede 010's
normal-build Plus voice prohibition.
