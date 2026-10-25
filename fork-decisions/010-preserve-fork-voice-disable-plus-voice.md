# 010: Preserve fork conversation and disable upstream Plus voice

**Status:** Accepted policy; upstream integration and validation pending

## Revisions and context

- Merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`
- Fork tip: `670c8d08a911201a58e915511ad1d724ca9c43d8`
- Pinned upstream tip: `f0e6619ff02c5510caffbaed80c8b0fb6020de91`

During preparation for this upstream sync, the user explicitly chose:

> Preserve existing fork voice; keep upstream Plus voice inactive in normal
> builds.

The user also explicitly requested that this choice be recorded in
`fork-decisions/`. This record establishes the integration requirement; it does
not claim that the merge or its acceptance checks have completed.

## Upstream intent

Upstream introduces Whisper-based on-device input, a separate hands-free voice
mode, and PocketPal Plus entitlement and purchase surfaces. Relevant originating
commits include `149aa3f7` (on-device input), `91fc9fcd` (Plus),
`bf59697d` (hands-free voice), and `4a76784b` (shared Whisper model).

## Fork requirement and originating history

The fork already provides hands-free conversation, distinct audio turn cues,
and an Android voice-chat launcher. Preserve the latest approved behavior in
[001](001-sync-upstream-6cf3944.md),
[002](002-hands-free-turn-cues.md),
[006](006-android-voice-chat-launcher.md),
[007](007-last-used-model-restoration.md), and
[008](008-voice-launch-compatible-fallback.md).

This includes the conversation implementation originating in `1dac28e`, cues
from `488a3a7` and `9ec6a3a`, the launcher from `68619e1`, and subsequent launch
readiness and compatible-selection changes through fork tip `670c8d08`.
Startup selection and remote credential safeguards in
[003](003-startup-selection-restoration.md) remain mandatory.

Centralized integrations, authentication, marketplace, and purchases remain
disabled in normal fork builds under
[009](009-sync-upstream-9bfe7bb1.md). User-owned model, remote-server, and
search-provider credentials remain supported.

## Affected surfaces

- `src/hooks/useVoiceConversation.ts`, `useSpeechRecognition.ts`,
  `useDeepLinking.ts`, and `useChatSession.ts`
- `src/services/conversationCues.ts`, `voiceChatLauncher.ts`,
  `voiceChatSelection.ts`, and `startupSelection.ts`
- ChatInput, ChatView, TTS, startup/model stores, and their adjacent tests
- Android speech recognition, voice launcher, activity registration, and
  manifest contracts
- Incoming `src/store/VoiceModeStore.ts`, `src/hooks/useVoiceMode.ts`,
  VoiceModeButton, VoiceModeView, voice settings, and related entry points
- Incoming `src/services/plus/`, Plus UI, purchase startup, root store
  initialization, and `App.tsx`
- Native dependency configuration, payload checks, disabled-build tests, and
  `.github/workflows/e2e-tests.yml`

## Chosen resolution

Keep the fork's own voice implementation as the normal-build conversation
path. Do not replace it with upstream's Plus voice stack or introduce a second
user-facing hands-free mode in normal fork builds.

Keep the upstream Plus voice feature inactive in normal fork builds, including
its start controls, settings entry points, paywall routes, and automatic
activation. Do not merely leave it visible but locked behind an unavailable
purchase. Its addition must not initialize centralized purchases or interfere
with the fork microphone, TTS, cues, launch handling, or conversation lifecycle.
Retained upstream source or dependencies do not authorize enabling the feature.

Preserve explicitly on-device recognition without cloud fallback, automatic
transcript sending, TTS drain coordination, audio turn cues, cancellation and
foreground guards, fresh-chat launcher behavior, single-use request identity,
compatible selection, and remembered startup preferences. Existing fork voice
must not acquire a Plus entitlement requirement.

Accept compatible upstream improvements without changing these requirements.
This decision does not prohibit independently useful on-device input or native
fixes, but they must not silently substitute the fork conversation path.

## Rejected alternatives and regression risks

- Replacing fork conversation with upstream voice would risk losing approved
  cue, launcher, lifecycle, and startup-selection contracts.
- Exposing both voice modes would introduce competing microphone/TTS owners
  and an unapproved second hands-free UX.
- Showing a locked Plus voice control would still expose the disabled feature
  and direct users toward a purchase flow unavailable in normal fork builds.
- Treating a disabled purchase store as sufficient would leave independent
  device/user support gates and voice entry points able to offer Plus voice.
- Discarding all incoming speech changes would unnecessarily reject compatible
  on-device and native improvements.

## Preservation checks and actual validation status

This is an accepted policy record only. No implementation changes or
policy-specific validation have been completed at the time of recording.

The integration must retain and run focused conversation, recognition, cue,
TTS, startup-selection, compatible-selection, deep-link, ChatInput, and Android
native-contract coverage. Add focused disabled-build coverage proving that
Plus voice controls and activation remain unavailable in normal fork builds,
without disabling existing fork conversation or initializing purchases.

Also run the sync's required type, lint, localization, transport fixture,
native-autolinking, and payload checks. Final sync acceptance requires a fresh
successful Android E2E source build for the exact final pushed commit.
Emulator acceptance does not establish physical-device speech, audio routing,
or TTS turn-taking.

## Superseded when

Only a later explicit product decision may enable upstream Plus voice in normal
fork builds or replace the fork conversation path. A replacement must preserve
the approved on-device, cue, lifecycle, launcher, and selection contracts with
corresponding regression and physical-device acceptance coverage. An upstream
merge or dependency upgrade alone does not supersede this decision.
