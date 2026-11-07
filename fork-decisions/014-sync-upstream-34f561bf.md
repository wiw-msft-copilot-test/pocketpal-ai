# 014: Compose pinned upstream model and voice fixes with fork behavior

**Status:** Implemented locally; exact-commit Android acceptance pending

## Revisions and integration boundary

- Source branch: `main`.
- Fork parent: `d10c972e6c7bb4610b392bf8945819801d2d947a`.
- Pinned upstream parent: `34f561bf8cdcf63b85ecaa58a535541bd07dd3ff`.
- Actual merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`.
- Previously squash-integrated content: `f8f37d9a4676763eaaf509276b21631b9e95ba8f`.
- Destination: `sync/upstream-34f561bf-into-main`, on this fork's origin only.

The actual merge preview has 128 repeated textual conflicts because earlier
syncs were squash-landed. A second preview uses the last imported upstream
revision as a content-only three-way base, as described in decisions
[011](011-sync-upstream-f0e6619.md) and
[013](013-sync-upstream-f8f37d9a.md). That preview composes the already-reviewed
fork tree with the new upstream delta; its only conflict is the independent
E2E package-script additions. Retain both script sets. Review the resulting
automatic compositions as well as the conflict.

The normal two-parent merge retains the actual fork and pinned upstream
parents. The content comparison does not fabricate ancestry, rebase the fork,
or expand the upstream range.

## Upstream intent and fork requirements

Accept the compatible fixes from `7af6f6f3` (ASR memory bands and capture
ownership), `07f3728f` (unlimited remote token-limit omission), `d67f5a33`
(voice setup readiness and sheet ownership), `b5e46f9b` (native composer clear),
`99300dcd` (shadowed vision presets and projector UI), and `34f561bf`
(all-skipped E2E reporting). Import pinned translations and `184f244a`'s
version 1.22.1 metadata without invoking translation synchronization or release
automation.

All requirements and originating histories in decisions 001-013 remain in
force. In particular, retain:

- Centralized integrations and upstream Plus voice exclusion in normal builds,
  including persisted and E2E overrides; the unfinished local server stays off.
- User-owned HF/search/server credentials, immutable origin and credential
  bindings, opt-in Copilot, and additive Chat Completions/Responses transports.
- Protocol persistence, tool replay, cancellation, reconciliation, parameter
  modes, and content-safe diagnostics.
- Explicitly on-device fork hands-free conversation, cues, narration outcomes,
  startup restoration, and compatible single-use Android voice launches.
- Scout seeding, talents, custom appearance, migration and user deletion;
  full-result search, count limits, caching, persistence and cancellation.
- Local/offline model availability and native payload/build-input contracts.
- Individual message deletion from `33455c0b` and manual compaction with optional
  guidance from `d10c972e`, including persisted Responses replay.

## Chosen resolutions and affected paths

### Independent composition: model and remote request contracts

`src/store/ModelStore.ts`, its tests, and
`src/screens/ModelsScreen/ModelCard/` accept the upstream vision heal, HF search
upgrade and projector-only download when the LLM is already downloaded. Keep
record identity, custom settings, explicit Vision-off choices, user projector
picks, draft/header distinctions and existing fork startup/remote boundaries.
Expose the missing-projector offer and download progress without requiring an
expanded card. The heal does not itself fetch a projector.

`src/api/servers/index.ts` omits non-positive `n_predict` across all profiles,
including Copilot, while preserving zero-valued temperature and other valid
samplers. `src/api/__tests__/openai.test.ts` now distinguishes a valid positive
explicit Send limit from unlimited legacy `max_tokens`: -1 and 0 must not
reach either token-limit wire key, even in Send mode. This changes remote wire
encoding, not persisted settings or local llama.rn unlimited semantics.
Retain the existing Responses encoder's separate validation and -1 omission
contract rather than changing it through the Chat Completions profile helper.

### Compatible voice fixes behind the existing fork boundaries

`src/services/asr/`, `src/services/voice/memoryFit.ts`, `src/store/ASRStore.ts`,
`src/utils/memoryDisplay.ts`, `VoiceMemorySheet`, their tests and automation
helpers adopt the conservative-budget/total-RAM distinction. Tight Whisper
dictation requires explicit Try Anyway; acceptance is session-only, rechecked
against the current need, and never permits a fit above total RAM.

`src/hooks/useVoiceCapture.ts` accepts upstream instance ownership so unrelated
hook cleanup cannot cancel another capture, and stale permission, memory-check
or alert continuations cannot start capture after unmount. Fork conversation
and launcher microphone exclusion remain independent.

`src/hooks/useVoiceMode.ts` and `src/screens/ChatScreen/ChatScreen.tsx` accept
bounded setup readiness, focus/disposal checks, latest-wait ownership and
sheet-kind-specific dismissal. Keep the independent `__ENABLE_PALSHUB__`
controller guards and ChatScreen's disabled-build rendering boundary.
Compatible retained upstream source does not authorize a second normal-build
hands-free mode.

### Composer, E2E and native metadata

`src/components/ChatInput/` accepts native clear after an allowed send and edit
cancel while retaining drafts, image handling, conversation controls and
blocked-send text. Incoming regression tests coexist with fork dictation tests.

`e2e/scripts/run-e2e.ts` and its Node tests report all-skipped runs separately
from passes. Retain all fork fixture, selector, runner and focused type-check
scripts in `e2e/package.json`. The fork's mandatory unfiltered Android fixture
and Appium acceptance workflow and source-build requirement are unchanged.

`package.json`, `.version`, Android build metadata and the iOS project accept
1.22.1/159 without changing fork package identity, speech/launcher wiring,
disabled autolinking, bundle cache inputs or payload requirements.

## Rejected alternatives and residual risks

- Selecting an entire parent for shared files would lose previously composed
  fork behavior or compatible upstream fixes. Reusing the actual old merge base
  alone would replay resolved squash-history conflicts unnecessarily.
- Sending unlimited sentinels because the user selected Send would retain the
  strict-server failure. Dropping zero-valued samplers instead would incorrectly
  change unrelated controls.
- Treating every memory-budget miss as impossible would discard the approved
  explicit try-anyway improvement. Allowing it above total RAM or persisting
  acceptance would weaken its safety boundary.
- Activating retained upstream Plus voice would violate decision 010 and
  compete with the fork conversation path.
- Weakening Appium assertions, accepting all-skipped runs, or reusing an older
  APK would not establish exact-commit acceptance.
- The 15 changed non-English locale files retain their exact pinned upstream
  bytes. Prettier also rejects each corresponding fork-baseline file; they are
  Weblate-managed and are not manually reformatted in this sync. English and
  all other affected source/configuration formatting are checked.
- Memory estimates cannot prevent an OS kill after explicit Try Anyway.
  Emulator checks do not prove physical speech/TTS, camera, live providers or
  search, or iOS runtime behavior.

## Actual local validation and remaining acceptance

Validated with Node 24.22.1 and Yarn 1.22.22:

- Incoming/shared focused Jest selection: 18 suites, 1,221 passing tests.
- Follow-up request/composer/ChatScreen/payload/gate selection: five suites,
  273 passing tests after the explicit Send assertion was updated.
- Final full Jest: 462 passing suites, 9,478 passing tests and 310 snapshots;
  three disabled-only suites and 11 tests skipped in the enabled lane. The
  disabled-build configuration is validated separately below.
- Disabled-build lane: three suites, nine passing tests.
- Root TypeScript; repository ESLint: zero errors, 48 warnings. Final changed
  tests also pass focused ESLint.
- Localization: 1,595 English keys; each registered non-English locale has
  128 missing keys using the existing English fallback.
- Six deterministic Responses fixture tests and focused fixture TypeScript.
- Eleven E2E JUnit classification tests, rerun after runner formatting.
- Disabled React Native config: all six centralized native dependencies absent.
- All 13 font families registered; affected formatting and whitespace checks
  pass except the separately documented pinned locale formatting boundary.

The first full Jest attempt failed 70 tests: the obsolete unlimited Send
assertion, a later ChatScreen connection-timeout failure, and 68 archive tests
because `zip` was missing. Restore the official Ubuntu ZIP package into session
artifacts without modifying the shared host installation. The combined
follow-up and final full suite pass with that tool and without any ChatScreen
product or test edits. No assertions or acceptance scenarios were weakened.

`adb devices -l` lists no attached device. Native installation and runtime
validation have not run locally. Exact-commit Android acceptance remains
pending: a fresh phase must dispatch `.github/workflows/e2e-tests.yml` from
the final pushed task branch without `artifact_run_id`, require successful
source build, native exclusions/payload checks, install/foreground launch and
all deterministic fixture/Appium scenarios, and verify the successful run's
`headSha` equals the final branch tip.

No upstream PR, protected-branch push, release or deployment is part of this
sync. Remote acceptance evidence belongs in the final handoff; this local
record does not imply Android acceptance.

## Superseded when

A later approved upstream sync supplies equivalent or stronger model,
request-body, voice lifecycle, composer and E2E contracts while preserving
decisions 001-013. Only an explicit later product decision may enable
centralized integrations, upstream Plus voice or the unfinished local server,
or replace the fork hands-free conversation.
