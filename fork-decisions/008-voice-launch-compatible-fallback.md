# 008: Prepare a compatible voice-launch fallback

**Status:** Accepted

## Context

The Android voice launcher restores the last-used model and Pal before checking
hands-free eligibility. A restored model can be unavailable, and a restored
video Pal cannot render the normal chat input used by hands-free conversation.
Showing recovery guidance immediately leaves other valid on-device choices
unused.

This extends [006](006-android-voice-chat-launcher.md) and preserves the remote
model safeguards in [003](003-startup-selection-restoration.md) and
[007](007-last-used-model-restoration.md).

## Decision

After normal startup restoration settles, prepare a compatible fallback before
rejecting a pending voice-launch request:

- keep the loaded model engine when it is usable;
- when the active Pal requires video, choose the first stored non-video Pal in
  stable store order;
- when no model engine is ready, prefer that Pal's available default model,
  then try the remaining available local models and configured remote models
  in stable store order without retrying duplicate IDs;
- validate remote origin, credentials, protocol, catalog, and current
  connectivity before activating a remote fallback; and
- continue after an individual model load fails, logging the failure without
  exposing credentials or user content.

Only reset the active chat after a complete compatible selection is ready.
Apply an automatically selected Pal to the fresh chat without rewriting the
remembered startup Pal or explicit `No Pal` preference. A successfully loaded
fallback model becomes last-used through the normal model activation path.

Show unavailable guidance and consume the request only when no non-video Pal
can replace an incompatible active Pal or no available model can create an
engine. Generation, lifecycle, single-use request, and manual-control guards
remain unchanged.

## Affected paths

- `src/services/voiceChatSelection.ts`
- `src/services/__tests__/voiceChatSelection.test.ts`
- `src/hooks/useDeepLinking.ts`
- `src/hooks/__tests__/useDeepLinking.test.ts`
- Android voice-launch documentation

## Rejected alternatives

- Immediately rejecting a video Pal or failed model restore ignores compatible
  choices already present on the device.
- Always loading the replacement Pal's default model would discard a working
  last-used model unnecessarily.
- Persisting the fallback Pal would overwrite an explicit startup preference
  in response to launcher recovery rather than a user selection.
- Selecting an arbitrary remote model without validation could reuse changed
  credentials or contact an unintended server origin.

## Preservation checks

Run the compatible-selection service, startup restoration, deep-link launcher,
ChatInput dictation, and model-store suites. Cover keeping a loaded model,
replacing a video Pal, preferring the replacement Pal default model, continuing
after model failure, validated remote fallback, exhausted fallback, request
identity, and generation or lifecycle cancellation.

## Superseded when

A later voice-launch design provides an equivalent compatible-selection flow
while preserving remote safety, startup preferences, lifecycle cancellation,
and single-use request ownership.
