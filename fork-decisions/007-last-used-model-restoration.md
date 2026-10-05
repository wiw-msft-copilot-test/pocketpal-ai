# 007: Restore the last-used model for voice launch

**Status:** Accepted

## Context

PocketPal must restore the last-used model before deciding whether a cold
**PocketPal Voice Chat** launch is available. That model can be local or remote.
Remote restoration must retain the origin and credential safeguards required by
[003](003-startup-selection-restoration.md), rather than trusting a model ID
alone.

Startup selection persistence was added after PocketPal had already persisted
the local-only `ModelStore.lastUsedModelId`. Upgraded installations can
therefore also have a valid downloaded local model but no newer selection
snapshot.

This extends [003](003-startup-selection-restoration.md) and
[006](006-android-voice-chat-launcher.md). Remembered Pal selection, including
explicit `No Pal`, already has the required startup semantics and is unchanged.

## Decision

Persist a last-used selection snapshot after every successful local or remote
model activation. For a remote model, include the normalized server origin,
server type, and credential revision. When no explicit startup model selection
exists, restore this last-used model through the normal startup path before
voice-launch eligibility is evaluated.

Remote restoration must still validate the saved server snapshot, supported
protocol, advertised catalog when available, and a current connection check.
After successful restoration, persist the selection through the startup store.
For installations that predate selection snapshots, continue to adopt an
available downloaded model from the legacy local-only `lastUsedModelId`.

An explicit startup model selection always wins. Do not infer a Pal from chat
history.

## Affected paths

- `src/store/ModelStore.ts`
- `src/store/StartupSelectionStore.ts`
- `src/services/startupSelection.ts`
- `src/services/__tests__/startupSelection.test.ts`
- `src/store/__tests__/ModelStore.test.ts`
- Android voice-launch documentation and decision records

## Rejected alternatives

- Restricting fallback to local models would reject a valid last-used remote
  model despite having enough saved state to validate it safely.
- Inferring a Pal from the most recent chat would turn session navigation and
  history into an implicit startup preference, contrary to decision 003.
- Treating a remote model ID alone as sufficient would bypass server origin,
  credential, protocol, catalog, and connectivity validation.

## Preservation checks

Run the model-store, startup-selection service, and Android voice-launch hook
suites. Cover last-used local and remote restoration, remote safety validation,
legacy local-model adoption, explicit startup-model precedence, unavailable
model failure, remembered Pal restoration, and cold-launch waiting.

## Superseded when

A later startup design restores the last-used local or remote model with
equivalent origin, credential, protocol, catalog, and connectivity safeguards.
