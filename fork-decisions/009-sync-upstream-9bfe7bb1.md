# 009: Merge upstream `9bfe7bb1` while preserving fork boundaries

**Status:** Accepted locally; remote acceptance pending

## Revisions

- Merge base: `4ebab32771df7d9e2554cd88a376bbda7d833da1`
- Fork tip: `e376351a6ff85cbf7e17d08d4077de3f15f6000e`
- Upstream tip: `9bfe7bb1d47f37e686e128c8c24337006a190f1f`

The incoming range adds per-server request profiles, native in-app purchases
and Apple authentication, resumable Android downloads, search cancellation and
Firecrawl, E2E reliability changes, and release metadata.

## Fork requirements and history

All permanent invariants in
[001](001-sync-upstream-6cf3944.md#permanent-fork-invariants) remain in force,
along with decisions [002](002-hands-free-turn-cues.md),
[003](003-startup-selection-restoration.md),
[004](004-content-safe-protocol-errors.md),
[006](006-android-voice-chat-launcher.md),
[007](007-last-used-model-restoration.md), and
[008](008-voice-launch-compatible-fallback.md).

In particular, centralized authentication, marketplace, and checkout behavior
must remain disabled in normal fork builds. GitHub Copilot and the Chat
Completions/Responses transports must remain additive and must retain immutable
origin, credential, protocol, parameter-omission, replay, and diagnostic
boundaries. Full-result search and hands-free launch behavior must remain
intact.

## Affected paths

- `react-native.config.js`, `App.tsx`, Settings, authentication, purchase
  store, disabled-build tests, and Android E2E workflow
- remote API profiles, HTTP helpers, completion engines, model/server stores,
  model sheets, completion settings, and focused tests
- agent runner, search providers, search budgeting, Firecrawl, and talent tests
- Android manifest, activity, download services, resources, and native tests
- E2E helpers, pages, fixtures, and feature specifications

## Resolution

Accept upstream's server-profile architecture and make GitHub Copilot a
first-class profile. Keep Copilot's unversioned endpoints and required client
headers, the fork's HTTPS/origin validation, Responses routing and replay
binding, generation-parameter modes, and immutable live-session snapshot.
List-derived capability parsing now composes normalized protocol catalog
metadata with server-specific row parsing.

Compose upstream search cancellation and Firecrawl with the fork's result
count, full-result budgeting, mode-separated cache, allowlist, and sequential
tool guards. An aborted batch does not invoke another tool handler, while
remaining searches receive deterministic cancellation outcomes when the active
search was cancelled.

Accept resumable Android downloads and E2E reliability changes while retaining
the voice-chat launcher alias, speech query, audio permission, launch intent
normalization, and camera-optional manifest behavior.

Retain upstream purchase and Apple-authentication code for integration-enabled
builds, but keep it absent from normal fork runtime and native autolinking.
Firebase, Firebase App Check, Google Sign-In, Apple authentication, native IAP,
and its Nitro dependency are excluded together when centralized integrations
are disabled. Purchase startup and Settings UI remain behind the existing
compile-time PalsHub gate.

Explicit Pal activation continues to update remembered startup model and Pal
choices while using upstream's shared activation helper.

## Rejected alternatives and risks

- Taking the upstream remote stack wholesale would remove Responses routing,
  credential-origin checks, and fork parameter semantics.
- Keeping the prior remote stack unchanged would discard server-specific
  sampler names and reasoning payloads, leaving accepted controls ineffective.
- Autolinking IAP or Apple authentication merely because their source remains
  installed would violate the normal-build centralized-integration policy.
- Taking either native conflict side would remove resumable downloads or the
  fork's voice-launch behavior.
- Letting abort handling invoke a second queued tool would regress the fork's
  between-call lifecycle guard; dropping all remaining outcomes would regress
  deterministic upstream search cancellation.

The normal disabled build does not exercise real purchases or Apple Sign-In.
Those integration-enabled paths retain upstream unit coverage but require
provider-backed acceptance if the fork later enables them.

## Preservation checks and validation status

Passed locally:

- merge-focused Jest coverage: 18 suites and 1,060 tests;
- full Jest inventory: 349 passing suites, 6,169 passing tests, 7 skipped
  tests, and 310 passing snapshots;
- root TypeScript type checking;
- ESLint with no errors (48 existing warnings);
- disabled-build and native-autolinking contract tests;
- localization validation;
- disabled React Native autolinking inspection;
- deterministic Responses fixtures and their focused type check; and
- `git diff --check`.

The Android unit-test task could not start locally because this host has no
Android SDK configuration. The required remote Android workflow builds the
native changes from source and remains the acceptance gate.

The exact Android E2E run is recorded in the final handoff. Remote acceptance
requires a fresh successful `.github/workflows/e2e-tests.yml` run whose
`headSha` is the final pushed commit.

## Superseded when

A later approved sync provides equivalent server-profile, purchase-gating,
search-cancellation, download, and E2E behavior while preserving all referenced
fork invariants with equal or stronger regression coverage.
