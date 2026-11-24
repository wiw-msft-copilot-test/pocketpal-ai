# 017: Do not impose an application output limit on manual compaction

**Status:** Implemented and validated locally

## Intent and upstream relationship

Manual compaction is a fork feature introduced by `d10c972e`. Its fixed
2,048-token output budget can truncate a valid summary of a long conversation
even when the selected model has ample input context. Remove that application
ceiling rather than replacing it with another fixed or context-relative cap.

The pinned upstream revision `aae21cf3` does not contain
`src/services/compactChat.ts`, so this is not a current upstream conflict.
It follows upstream's unlimited remote-token omission from `07f3728f`,
preserved in decision [014](014-sync-upstream-34f561bf.md). Future syncs must
preserve the uncapped compaction intent if upstream introduces its own
compaction implementation.

## Resolution and affected paths

- `src/services/compactChat.ts` uses the existing `n_predict: -1` unlimited
  contract. Local llama.rn receives the sentinel; the existing Chat
  Completions and Responses encoders omit the remote output-limit parameter.
  Model/server defaults, provider output limits and actual context limits
  still apply. Compaction does not inherit a chat's separate generation cap.
- Input-fit checks no longer reserve an arbitrary summary budget. The input
  must still leave room in the known context. The replacement must remain
  smaller than the original and fit the known context.
- Preserve tool-free inference, remote temperature omission, cancellation,
  session/model/fingerprint checks, and atomic replacement. Incomplete,
  invalid or non-reducing output must never replace history.
- `src/services/__tests__/compactChat.test.ts` protects remote wire omission,
  unknown context sizes, summaries beyond the former ceiling, and the exact
  input-fit boundary alongside existing lifecycle protections.

## Rejected alternatives and risks

- Raising 2,048 to another constant or using a context fraction leaves an
  application ceiling and can exceed a provider's supported output setting.
- Sending a large positive limit to a remote provider overrides its defaults;
  leaving the parameter absent uses the existing supported unlimited policy.
- A provider can still truncate output at its own limit. The separately
  observed Copilot incomplete-snapshot identity handling and generic failure
  wording are not changed by this focused fix.
- Uncapped generation may use more time and tokens. Cancellation and
  fail-without-mutation protections remain necessary.
- Remote context counts remain conservative character estimates, not exact
  provider tokenization. This change does not add chunked summarization.

## Validation

Node 22.21.0 and Yarn 1.22.22: all 207 tests pass across the compaction,
completion-engine, Responses request and Chat Completions suites. Root
TypeScript passes. Full ESLint passes with zero errors and 48 existing
warnings; changed source and test files also pass targeted ESLint.

On Docker Android 15, the previously failing long conversation compacts with
default guidance using `gpt-6.1-sol`: the provider completes a 3,629-token
summary, beyond the former ceiling. A single validated summary is saved and
survives a cold restart. This local diagnostic APK rebundles the changed
JavaScript with the supplied APK's unchanged native entries; it is not evidence
of a fresh native build.

Fresh exact-commit source-build/Android smoke acceptance and Docker validation
of that artifact are tracked separately in the pull request.

## Superseded when

A reviewed replacement can summarize long histories without silently
reintroducing an application output ceiling, while retaining model/provider
limits and the same cancellation, validation and history-integrity guarantees.
An intentional new product cap requires an explicit product decision.
