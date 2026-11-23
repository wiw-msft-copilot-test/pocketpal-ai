# 016: Compose pinned download, dictation and native fixes with fork behavior

**Status:** Implemented and validated locally; exact-commit Android acceptance pending

## Revisions and integration boundary

- Source branch: `main`.
- Fork parent: `038c7b051baf38bc2b23363582aa49750f354cd1`.
- Pinned upstream parent: `aae21cf30a08189be11b17a9d434a415e5efa778`.
- Actual merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`.
- Previously squash-imported content: `c076d8d66f334a3e6288a9fce0e3a21036c3249d`.
- Destination: `sync/upstream-aae21cf3-into-main`, on this fork's origin only.

As in [015](015-sync-upstream-c076d8d6.md), preview actual ancestry and a
content-only three-way comparison with the last squash-imported upstream tree.
The latter has only a README dependency-table conflict. Materialize its reviewed
composition inside a normal merge of the actual approved parents. The content
base is not a synthetic parent; no history is rewritten or upstream range
broadened.

## Incoming intent and permanent requirements

Accept the pinned upstream release-runner correction, version 1.24.0/161,
Weblate translations, llama.rn rc.11, dp4a OpenCL gating, letter-suffixed
Snapdragon Hexagon detection, room-relative Whisper dictation, model-download
integrity checks and checksum-pinned iOS ONNX Runtime archive.

Decisions 001-015 retain their product, privacy and ownership requirements.
Centralized integrations, Plus voice and the unfinished local listener remain
unavailable in normal builds, including direct, persisted and E2E overrides.
User-owned credentials and immutable destination bindings, opt-in Copilot,
additive Responses/Chat Completions, atomic replay and safe diagnostics remain.
Fork on-device conversation, cues, narration outcomes, microphone ownership,
startup and launcher behavior, Scout and full-result search remain intact.
Individual deletion (`33455c0b`), guided compaction (`d10c972e`) and the latest
Copilot temperature omission/menu icon (`038c7b05`) are not superseded.

## Combined resolutions and affected paths

### Independent composition: dictation is not hands-free conversation

`src/services/asr/{constants,speechDetector,speechSegmenter}.ts`,
`src/hooks/useVoiceCapture.ts`, `src/store/ASRStore.ts` and recorded-fixture
tests accept adaptive room-relative detection and minimum speech duration.
Remove the second fixed-floor rejection at decode, while retaining that floor
for persistent detected-language latching. Quiet speech can be transcribed
without background noise choosing the next recording's language.

The unchanged fork recognition/conversation hooks, capture-instance ownership,
launcher exclusion and disabled Plus voice gates remain authoritative.
No upstream speech change enables a second normal-build hands-free controller.

### Compatible download integrity with existing store and credential contracts

`DownloadEngine.kt` and native tests reject HTML, conflicting linked/declared
sizes and invalid GGUF magic before final rename. RNFS `DownloadManager.ts`
rejects HTML, out-of-tolerance sizes and invalid GGUF headers and reports the
localized actionable network error. `src/utils/index.ts` shares the existing
0.1% size tolerance. The mock, ModelStore error test and integrity tests compose
with existing fork startup, HF headers, download identity and remote safeguards.

### Native source and payload composition

`package.json`, `yarn.lock` and `patches/llama.rn+0.13.0-rc.11.patch` accept the
new engine while retaining shared context ownership, abort protection and
payload patch markers. Existing source-build, variant, OpenCL, Metal/kernel,
symbol and Android payload contracts remain, with incoming Hexagon tests.
Android build metadata changes only version code/name; all fork cache-input,
identity, speech/launcher and disabled integration wiring is retained.

`ios/Podfile`, `Podfile.lock` and `onnxruntime-c.podspec.json` use upstream's
SHA256-pinned 1.24.3 release archive while retaining static linkage and existing
llama/Whisper source-build header/kernel isolation. An added existing-suite
contract protects the local podspec wiring, archive digest and lock agreement.
Linux static checks do not establish iOS pod installation or runtime coverage.

### Documentation, metadata and translations

README keeps fork product/privacy wording and updates only the incoming engine
version. Import pinned non-English bytes without manual translation edits or
network synchronization; English retains every fork key. Accept release-runner
metadata but never dispatch a release or deployment.

## Rejected alternatives and residual risks

- Blanket parent selection would discard fork behavior or compatible upstream
  fixes; using only the old ancestry base repeats resolved squash conflicts.
- Retaining the fixed decode floor rejects the quiet speech the new detector
  intentionally admits. Removing the language-latch floor lets noise persist a
  detected language across recordings.
- Dropping download rejection or weakening tests can label an HTML response as
  an installed model. Changing credential or store boundaries is unnecessary.
- Native upgrades require a fresh source APK, not an older artifact. Keep all
  payload gates and deterministic fixture/Appium scenarios unfiltered.
- Unified-patch blank context lines and Weblate formatting are preserved, not
  normalized to satisfy generic formatting checks.
- Emulator acceptance cannot prove physical speech/TTS/camera, live Copilot or
  search providers, or iOS runtime behavior.

## Actual validation and acceptance

Node 24.22.1 and Yarn 1.22.22 verified. Frozen-lockfile restoration applies all
nine patches and restores OpenCL headers. No Android device is attached.

The first focused run passed ten suites and failed two native suites solely
because Ruby and ZIP were absent (53 missing-tool failures). The operator
restored official checksum-verified Ubuntu packages only under session artifacts;
the two unchanged suites then passed all 148 tests. No host installation or
assertion weakening occurred.

Full Jest passes: 489 suites, 10,483 tests and 310 snapshots. Three disabled-only
suites and 11 tests are skipped in that enabled lane; the separate disabled-build
lane passes three suites and nine tests. Root TypeScript and full ESLint pass
(zero errors, 48 warnings). Localization passes with 1,656 English keys and
125 existing English-fallback keys per registered non-English locale.

All six deterministic Responses fixture tests, their focused TypeScript, three
editor/markdown selector tests and 19 E2E runner tests pass. Disabled React Native
configuration excludes all six centralized packages. Font registration validates
all 13 families; Android variant-allowlist output validates.

Affected source/English/decision formatting passes. Pinned Weblate bytes and the
upstream ONNX podspec are preserved verbatim; Prettier rejects the podspec's
array layout, which is not normalized independently of its pinned lock checksum.
Generic `git diff --cached --check` reports ten unified-patch blank context
lines; source/configuration whitespace passes with patch files excluded.
Patch-package successfully applies those exact patch bytes.

Fresh exact-final-SHA Android source-build, native/payload checks, APK installation,
foreground launch and unfiltered fixture/Appium acceptance remain pending.
The final external result records the exact commit and run; local passes alone
do not complete this sync.

## Superseded when

A later reviewed sync supplies equivalent or stronger download, dictation and
native build contracts while preserving decisions 001-015. Only an explicit
product decision may enable centralized integrations, Plus voice or the local
listener, or replace the fork's on-device conversation ownership.
