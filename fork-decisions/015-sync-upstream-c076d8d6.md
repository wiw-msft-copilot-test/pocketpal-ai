# 015: Compose pinned upstream chat and speech changes with fork ownership

**Status:** Implemented locally; exact-commit Android acceptance pending

## Revisions and integration boundary

- Source branch: `main`.
- Fork parent: `2af34e1941050c55098d0c865aab78937a6f9c48`.
- Pinned upstream parent: `c076d8d66f334a3e6288a9fce0e3a21036c3249d`.
- Actual merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`.
- Previously squash-imported content: `34f561bf8cdcf63b85ecaa58a535541bd07dd3ff`.
- Destination: `sync/upstream-c076d8d6-into-main`, on this fork's origin only.

As in decisions [011](011-sync-upstream-f0e6619.md),
[013](013-sync-upstream-f8f37d9a.md) and
[014](014-sync-upstream-34f561bf.md), preview both the actual ancestry merge
and a content-only three-way comparison using the previously imported upstream
tree. The content preview has twelve genuine conflicts and 43 shared changed
paths. Materialize that generated composition while retaining the actual
normal merge's two approved parents; resolve shared files by combined intent.
No synthetic commit becomes a parent, no source history is rewritten, and no
later upstream revision is included.

## Incoming intent and permanent fork requirements

Accept upstream's local-server POC source, structured chat import round-trips,
path validation, selectable native markdown and footer menus, system voice
catalog/streaming, Android background TTS, phrase-first chunk policy, OpenCL
integer-dot fallback, unique Whisper Metal library, paid-Pal store gates,
version 1.23.0/160 and pinned translations.

All permanent requirements and originating history in decisions 001-014
remain in force. Centralized integrations and upstream Plus voice remain
inactive in normal builds. User-owned credentials, immutable origin bindings,
opt-in Copilot, additive Responses/Chat Completions, replay, cancellation,
parameter omission, diagnostics, Scout, full-result search, local models,
startup choices, on-device conversation/cues and Android launcher remain.
Individual message deletion (`33455c0b`) and guided manual compaction
(`d10c972e`), including persisted Responses replay, remain supported.

The incoming POC does not supersede the explicit unfinished-local-server
boundary in decisions 010/013/014.

## Combined resolutions and affected paths

### Intentional override: the local listener is not shipped

`src/services/plus/catalog.ts` retains `localApiServer` as unshipped.
`shipped.ts` exposes a non-overridable availability check requiring both the
integration flag and the actual shipped catalog entry. E2E ship overrides and
purchase/source-build unlocks cannot bypass this activation boundary.

`src/store/LocalApiServerStore.ts` checks availability at the enabled setter,
direct start and awaited key/address continuations. Blocked starts log a
content-independent warning. `SettingsScreen.tsx` does not import or mount the
server card; `LocalApiServerCard.tsx` also renders nothing when unavailable.
Incoming listener/parser/store/card source and meaningful tests remain, with
test-only availability mocks for the unshipped implementation's existing
coverage and separate negative activation/UI tests.

### Independent composition: narration is not conversation ownership

`TTSStore.ts`, system engine, speech-service helpers, Android manifest and
`MainApplication.kt` accept upstream ordinary background narration while
retaining fork foreground-only hands-free conversation. Snapshot conversation
ownership when replay or streaming begins; clearing the transient conversation
setting during background cleanup cannot turn existing narration into
background-eligible speech. Preview is ordinary speech.

Retain playback revisions, completed/skipped/failed/none outcomes, audio-only
skip, voice readiness, stop-for-dictation failure propagation and turn cues.
Compose upstream stop-settlement barriers and sentence/clause chunk selection.
Read model state through the existing store boundary, avoiding a new direct
ModelStore initialization side effect in isolated TTS consumers.

Speech 2.11.4's OS stream tracks native utterance IDs and awaits all audio
completion, including early finish events. Use its one-shot/stream finalize
instead of the old dispatch-plus-speaking-poll workaround. Its OS wrapper
settles on native error as well as finish/stop, so retain a separate error
listener: a native error must reject rather than produce a successful cue.
Retain cancellation cleanup and engine initialization with upstream ducking.

Register `SpeechPlaybackPackage` alongside `SpeechRecognitionPackage` and
`VoiceChatLauncherPackage`; keep playback service/receiver unexported and
mediaPlayback-only. Optional camera and on-device recognition manifest
contracts remain. New static tests protect this combined native registration.

### Independent composition: menus, imports and replay

`AssistantTurnFooter` retains Responses refused/failed/incomplete/output-limit
labels in the upstream grouped timing/footer-menu layout. `ChatView` and
`Message` accept native assistant selection and menu buttons while retaining
individual user deletion and compaction. User-menu tests include Delete and
retain confirmation, failure, no-generation and session-switch assertions.

`importUtils.ts` accepts upstream validated assistant steps and image/thumbnail
path restrictions while retaining explicit Responses replay validation both
before import and at message conversion. Valid replay metadata remains on the
structured steps. Round-trip tests use the fork's authoritative
`step_finished.step` event rather than upstream's obsolete event property;
the fixture isolates unrelated model startup instead of leaving network
initialization running past teardown.

### Compatible upstream improvements and build composition

Accept GPU/Metal patches and platform metadata without changing fork identity,
offline behavior, payload allowlist, native exclusions or build-input gates.
Keep all nine dependency patches, including enriched markdown, TCP and ONNX.
Compose enriched-markdown native-asset restoration with the existing workflow
native exclusions, disabled-build lane and unfiltered deterministic Android
fixture/Appium scenarios. No release, deployment or translation workflow is run.

Import pinned non-English bytes without manual locale edits or network
translation synchronization. English retains all fork-only keys.

## Rejected alternatives and residual risks

- Blanket parent selection loses fork privacy/protocol/voice or compatible
  upstream improvements; old ancestry alone replays prior squash conflicts.
- Exposing the POC card or guarding only its switch leaves direct start and
  lifecycle restart able to open a listener.
- Dynamic conversation settings alone do not identify an already-playing
  narration's owner; background cleanup can clear them first.
- Treating native OS error-drain as success emits misleading conversation cues.
- Removing import replay validation or adopting an obsolete runner event loses
  persisted tool replay despite superficially successful imported text.
- Generic whitespace checks report unified-patch blank context lines; preserve
  those required patch bytes. Weblate locales retain pinned formatting.
- Android emulator acceptance does not prove live providers, real search,
  physical speech/TTS/camera hardware or iOS runtime behavior.

## Actual checks and remaining acceptance

Existing Node 24.22.1 and Yarn 1.22.22 satisfy engines; frozen dependency
restoration applies all nine patches. Focused composition: 12 suites and
550 tests pass. Root types, localization (1,655 English keys), six deterministic
Responses fixtures and their focused TypeScript pass. Disabled-build tests:
three suites and nine tests pass after avoiding direct model-store startup.
Native config excludes all six centralized packages; all 13 font families and
the native payload variant allowlist validate. Source whitespace passes.

Full shared-state Jest passes: 486 suites, 10,384 tests and 310 snapshots; the
three disabled-only suites and 11 tests are skipped in that enabled lane and
validated separately. Final root typecheck, ESLint (zero errors, 48 warnings),
affected formatting, English/decision formatting and source whitespace pass.
The E2E runner's 19 tests and two remote editor selector tests pass.

The first full run exposed the incoming Ruby-based kernel-input test's missing
interpreter and an upstream PlusScreen expectation incompatible with the retained
unshipped catalog. Restore the official Ubuntu Ruby packages into session-local
artifacts, without host installation, and retain the expected Coming soon status.
ZIP uses an existing session-local official package. The two focused suites and
final full inventory pass; no assertions or scenarios are skipped or weakened.
The disabled lane initially passed assertions but failed teardown because the
new direct model-store import initiated unrelated async device classification.
Using the existing shared store boundary eliminates that new side effect.

Exact-commit Android source-build, installation, foreground launch and all
unfiltered scenarios remain pending. Final results belong in the final handoff;
a local pass or artifact-reuse run cannot establish Android acceptance.

## Superseded when

A later reviewed sync supplies equivalent or stronger import, markdown, native
streaming and lifecycle behavior while preserving all referenced invariants.
Only a new explicit product decision may enable the local server, upstream Plus
voice or centralized integrations, or replace fork conversation ownership.
