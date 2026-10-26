# 012: Reset draft credentials whenever the add-server URL changes

**Status:** Accepted; implemented

## Context and originating history

Upstream commit `62d004d9b256574fc80a4580f5a74ff2f00267a6` adds QR scanning
to the add-server sheet. Its scan handler replaces the URL without clearing
the entered API key. Automatic discovery subsequently reads the old key and
sends it to the scanned destination before the user saves anything.

The fork imported that handler in merge `027a3ee7`, pinned to upstream
`f0e6619ff02c5510caffbaed80c8b0fb6020de91`; the reviewed branch before this
fix ends at `e53e03627357468053efa5aead316af4eb5d9f71`.
Fork `origin/main` at `670c8d08` lacks QR scanning, but already permits the
same credential carryover through manual add-server URL edits.

This deliberately differs from upstream to preserve the credential-destination
boundary in decisions 001 and 003. It extends the sync resolutions in
[011](011-sync-upstream-f0e6619.md).

## Chosen resolution and affected paths

- `src/components/RemoteModelSheet/RemoteModelSheet.tsx`: typed and scanned
  URL changes share a handler that cancels queued discovery, invalidates old
  results, synchronously clears the credential ref and visible draft key,
  then updates the URL. This applies to all URL edits, including same-origin
  paths and trailing slashes; users explicitly approved that convenience cost.
- Delayed known-server key reads and discovery results must still belong to
  the selected chip before updating the draft. Deselecting, dismissing or
  changing the URL cannot resurrect a saved key through a late callback.
- Selecting a known server may still populate its own URL/key together.
  Clearing the add-sheet draft does not modify Keychain or any saved server.
  Subsequent model creation cannot save the cleared key under the new URL.
- `src/components/RemoteModelSheet/__tests__/RemoteModelSheet.test.tsx`:
  regression coverage proves these request, draft, persistence and lifecycle
  boundaries. The existing-server edit panel and storage format do not change.

## Rejected alternatives and limitations

- Origin-bound credential state would preserve same-origin edits but introduces
  additional state and save-time policy. The user preferred unconditional draft
  reset as the simpler complete fix.
- Clearing only React state leaves the imperative credential ref available
  until effects run. Both representations must clear before a probe can start.
- Fixing only scanning leaves manual URL changes with equivalent carryover.
- Resetting saved credentials would unnecessarily delete user-owned keys;
  this change clears only the add-sheet draft.
- In-flight requests already sent to the original destination cannot be
  recalled. Their results are invalidated; the reset prevents subsequent
  discovery from sending the prior key to the changed destination.

## Validation

Six new regression cases failed before the fix. After implementation, the
combined add-server and existing-server edit suites pass: 110 tests.
Coverage includes typed/scanned cross-origin and same-origin changes,
immediate blur callbacks, cleared-key persistence, fresh credential re-entry,
and delayed saved-key reads after returning to manual entry.

Root type checking, affected-file ESLint, Prettier and `git diff --check`
pass. Android runtime verification is reported with the implementing commit's
final result; do not infer a device pass from Jest.

## Superseded when

A later reviewed implementation provides equivalent or stronger destination
binding for both manual and scanned URLs, including asynchronous callbacks
and persistence. An upstream merge alone must not restore key carryover.
