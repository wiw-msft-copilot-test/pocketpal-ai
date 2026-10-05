# 007: Adopt the legacy last-used model during startup restoration

**Status:** Accepted

## Context

Startup selection persistence was added after PocketPal had already persisted
`ModelStore.lastUsedModelId`. Upgraded installations can therefore have a
valid, downloaded last-used local model but no `StartupSelectionStore` model
selection. A cold **PocketPal Voice Chat** launch would consider restoration
finished without loading that model and immediately show unavailable guidance.

This extends [003](003-startup-selection-restoration.md) and
[006](006-android-voice-chat-launcher.md). Remembered Pal selection, including
explicit `No Pal`, already has the required startup semantics and is unchanged.

## Decision

When no startup model selection exists, adopt the legacy last-used model only
if it is still an available downloaded local model. Load it through the normal
model-selection path before startup restoration settles, then persist it as
the startup model selection so later launches use the existing validation
path.

An explicit startup model selection always wins. Do not use the legacy fallback
after an explicit local or remote selection fails validation, and do not infer
a Pal from chat history.

## Affected paths

- `src/services/startupSelection.ts`
- `src/services/__tests__/startupSelection.test.ts`
- Android voice-launch documentation and decision records

## Rejected alternatives

- Warning immediately when the newer startup model preference is absent ignores
  valid state retained by upgraded installations.
- Inferring a Pal from the most recent chat would turn session navigation and
  history into an implicit startup preference, contrary to decision 003.
- Treating a legacy remote model ID as sufficient would bypass server origin,
  credential, protocol, catalog, and connectivity validation.

## Preservation checks

Run the startup-selection service and Android voice-launch hook suites. Cover
legacy local-model adoption, explicit startup-model precedence, unavailable
model failure, remembered Pal restoration, and cold-launch waiting.

## Superseded when

All supported installations have migrated to startup model selections or a
later startup design provides an equally safe migration for legacy model state.
