# 013: Compose pinned upstream voice readiness with fork build boundaries

**Status:** Implemented locally; exact-commit Android acceptance pending

## Revisions

- Source branch: `main`.
- Original fork parent: `33818e78de83e8c51f61631a680cd31988429da3`.
- Pinned upstream parent: `f8f37d9a4676763eaaf509276b21631b9e95ba8f`.
- Actual merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`.
- Previously squash-integrated content: `f0e6619ff02c5510caffbaed80c8b0fb6020de91`.
- Destination: `sync/upstream-f8f37d9a-into-main`, on this fork's origin only.

The prior squash revision is a content-only three-way comparison base for
repeated conflicts. The resulting tree composes both parents' intent, but the
commit is a normal two-parent merge using the actual original fork and pinned
upstream parents. No ancestry is fabricated or later upstream revision included.

## Upstream intent and fork requirement

Upstream `905cf282` adds missing neural voice-file detection/downloads, local
Supertonic styles, deferred runtime reload and cancellation during readiness.
`18de72ad` makes Plus purchase gating specific to official store builds.
`4580390d`, `b63bd8a0` and `dce12836` improve iOS Metal and upgrade llama.rn to
rc.9; `6f8f03af` introduces generated platform icons. Accept these compatible
improvements and pinned translations/release metadata.

Preserve all invariants and originating history in decisions 001-012,
particularly [010](010-preserve-fork-voice-disable-plus-voice.md),
[011](011-sync-upstream-f0e6619.md), and
[012](012-reset-key-on-setup-url-change.md). The operator reaffirmed keeping
fork hands-free conversation active and upstream hands-free voice inactive,
keeping the unfinished local API server default-off, and composing TTS
readiness with narration outcomes, audio-only skip, cues and silence barriers.
This record extends 011; it does not supersede those product/privacy policies.

## Chosen resolution and affected paths

### Intentional fork override with compatible upstream gating

- `babel.config.js`, `env.d.ts`, `jest/setup.ts`, `src/services/plus/gate.ts`
  and their tests retain both build flags. `__ENABLE_PALSHUB__` remains the
  outer entitlement boundary even when `__PLUS_STORE_GATE__` is false.
  Integration-enabled builds retain upstream source/store semantics and bundle
  marker checks; normal builds cannot unlock Plus through the source default.
- `src/services/plus/shipped.ts`, `VoiceModeStore`, `useVoiceMode`, Settings,
  paywall and purchase startup retain the fork's independent disabled-build
  guards. E2E/persisted overrides cannot expose features or activate voice.
  Regression coverage exercises both store-gate values with voice and server
  ship overrides.
- `src/services/plus/catalog.ts` retains `localApiServer` as `shipped: false`.
  Repository activation-path searches found only catalog, display and test
  references, not an implemented local API server entry point. Do not add a
  redundant flag to a placeholder. Any future real activation needs an explicit
  default-off guard and a separately approved product decision.
- `android/app/build.gradle` tracks both upstream bundle flags and the fork
  integration flag as Hermes task inputs, preventing stale enabled bundles
  when build policy changes. Static tests protect all four environment inputs.

### Independent TTS and error composition

- `src/store/TTSStore.ts` ensures voice files after the preceding stop and
  before replay, preview or streaming acquisition. Replay retains revision
  ownership and returns `skipped` if stopped while readiness is pending.
  Preview uses upstream state identity so an old preview cannot clear a newer
  preview of the same voice.
- `src/services/tts/{voiceFiles,voiceFileDownload,runtime}.ts` and neural
  engines retain upstream atomic `.part` downloads, best-effort retry, local
  Supertonic manifest migration, missing-file readiness and deferred reload.
  Download failure remains logged and the selected voice/model retained;
  engine synthesis reports playback failure rather than a fabricated success.
- Existing fork automatic conversation narration, completed/skipped/failed/
  none outcomes, audio-only skip, system-TTS drain, cues, stream ownership and
  microphone silence barriers remain intact. New tests cover replay
  stop/skip/background during readiness and failed missing-voice synthesis.
  Upstream readiness/runtime/engine/UI tests coexist with fork tests.
- `src/hooks/useChatSession.ts` adopts shared `llamaRnErrors` patterns for
  native tool parsing, context exhaustion and the changed draft-context error.
  Fork allowlisted diagnostics, Responses codes, rollback and atomic replay
  persistence remain unchanged.

### Compatible native and documentation improvements

- `package.json`, `yarn.lock`, `patches/llama.rn+0.13.0-rc.9.patch`,
  `ios/Podfile.lock`, the iOS project/AppIntents wrapper and metallib script
  compose rc.9, source-build Metal optimization/kernel updates and native
  ownership/abort protections. The payload manifest requires the new v85 DSP
  library without weakening symbol or patch-marker checks.
- Platform icons and their deterministic generator/tests are retained.
  Existing Android identity, voice launcher/speech packages, optional camera
  declarations and disabled native initialization are unchanged.
- `README.md` and `CONTRIBUTING.md` describe the new engine architecture while
  distinguishing this fork from store-distributed upstream. They do not claim
  Plus, PalsHub, purchases, centralized submissions or the unfinished server
  are available in normal builds; fork conversation is separate from Whisper
  one-shot dictation and upstream Plus voice.

## Rejected alternatives and regression risks

- Blanket conflict-side selection loses fork privacy/protocol/voice or
  upstream readiness/native improvements.
- Adopting upstream's unconditional source-build unlock bypasses the fork's
  outer integration boundary. Merely disabling purchases does not disable
  voice controllers or paywalls.
- Replacing narration outcomes with an undefined cancellation return can
  emit misleading turn cues or restart the microphone before silence.
- Immediate runtime release after a style download can hang active streaming
  finalization; retain deferred invalidation.
- Rewriting generated icon JSON or unified-diff context whitespace solely for
  formatting would break deterministic generation or patch application.
- This Linux/WSL host has no configured Android SDK or attached device.
  Local native Gradle validation fails before app compilation; iOS cannot run
  here. Unit/static checks are not native runtime acceptance.

## Actual local validation and remaining acceptance

Passed with Node 24.22.1 and Yarn 1.22.22:

- Frozen-lockfile dependency installation and all seven patch-package patches,
  including llama.rn rc.9; OpenCL headers installed by repository postinstall.
- Focused combined selection: 55 suites and 1,448 tests.
- Full Jest: 457 passing suites, 9,143 passing tests and 310 snapshots;
  three disabled-only suites and 11 tests skipped in the enabled lane.
- Separate disabled-build lane: three suites and nine tests, including both
  store-gate settings.
- Root TypeScript and full ESLint: zero errors, 46 warnings.
- Localization validation: 1,573 English keys; 109 missing keys in each
  registered non-English locale retain English fallback. No translation
  synchronization performed.
- Font registration: all 13 families available across platforms.
- Deterministic Responses fixture: six tests; focused fixture TypeScript.
- React Native config: all six centralized native packages absent on both
  platforms.
- Final cache/payload/icon follow-up: three suites and 231 tests, including
  four new Android bundle-input contracts added after the full Jest run.

The first focused run failed 68 archive checks solely because `zip` was absent.
After sudo was unavailable, the official Ubuntu package was downloaded and
extracted into session artifacts; the same 55-suite selection passed. No
assertions were weakened. An initial test typing error was corrected and root
type checking rerun successfully.

The affected formatting check identified CONTRIBUTING and payload JSON
formatting, subsequently normalized. Generated `AppIcon.appiconset/Contents.json` remains
byte-for-byte generator output, protected by generator tests. Generic
`git diff --check` reports the upstream patch's required blank context line;
source/config whitespace checks exclude unified patch files. Final formatting
checks and commit details are recorded in the implementation handoff.

Attempted `./gradlew :app:testProdDebugUnitTest`: blocked at configuration by
missing SDK location, with Gradle deprecation, missing `.env` and debug-signing
fallback warnings. `adb devices -l` lists no devices; Docker's WSL integration
is unavailable. Do not infer a device pass from Jest.

The implementation phase does not dispatch remote E2E. A separate fresh phase
must dispatch a full `.github/workflows/e2e-tests.yml` source build on the final
pushed SHA with no artifact reuse, and require successful build, native
exclusions/payload checks, install/foreground launch and unfiltered fixture/
Appium smoke. Until then the sync is not accepted. That workflow still does not
prove live providers/search, physical speech/TTS/camera or iOS runtime behavior.
No upstream PR, protected-branch push, release or deployment is authorized.

## Superseded when

A later approved sync provides equivalent readiness, cancellation, native and
build-cache contracts while preserving decisions 001-012. Only a new explicit
product decision may enable upstream voice, centralized integrations or the
unfinished local server in normal fork builds.
