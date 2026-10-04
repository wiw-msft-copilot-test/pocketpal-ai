# Repository agent guide

PocketPal is a React Native application maintained as a feature-bearing fork.
Treat upstream compatibility and preservation of intentional fork behavior as
equally important.

## Start every task

1. Inspect `git status`, the current branch, and the relevant recent commits.
   Do not overwrite unrelated work in a dirty worktree.
2. Read the implementation, adjacent tests, and any applicable record under
   `fork-decisions/` before changing behavior.
3. Identify the narrowest validation that proves the requested outcome. Prefer
   focused Jest files first, then broader checks only when the change warrants
   them.

Use Yarn 1.22 with Node.js 22 or newer. Common commands are:

```sh
yarn test <path-to-test> --runInBand --coverage=false
yarn typecheck
yarn lint
yarn l10n:validate
yarn start:reset
yarn android
yarn ios
```

Keep changes focused on one logical concern. Add or update tests when behavior
changes. Follow Conventional Commits (`feat:`, `fix:`, `docs:`, or `chore:`).

## Use compact phase handoffs

Long implementation and CI investigations can repeatedly send a large,
mostly cached transcript to the model. Split substantial work at natural phase
boundaries instead of carrying discovery, planning, implementation, and CI
history in one session.

Use a fresh session when the next phase will own edits, run several validation
cycles, wait on remote jobs, or investigate more than one failure. A subagent
is appropriate only for a bounded, usually read-only question that can return
a concise evidence-based answer, such as identifying the first failing
workflow step or checking whether a failure is reproducible. Do not give a
subagent the full transcript, ask it to duplicate the parent investigation, or
use it as the owner of a long sequence of edits and retries.

Before changing phases, prepare a compact handoff containing only:

- the objective, approved decisions, non-goals, and measurable acceptance
  criteria;
- repository invariants and the relevant implementation, test, workflow, and
  decision-record paths;
- the task branch, exact current commit, worktree state, and completed checks;
- unresolved risks or blockers and the next narrow validation step;
- run IDs and artifact or log paths only when they are relevant to the next
  phase.

Do not copy raw transcripts, full command output, or superseded investigation
notes into the handoff. Point to authoritative files and commits instead.

### Feature implementation handoff

Start implementation from the approved compact plan in a fresh session when
planning required substantial exploration. The handoff must define behavior
and acceptance criteria rather than prescribe unverified code changes.

At implementation startup:

1. Verify the branch, base, worktree, Node/Yarn versions, and any platform
   tools needed by the planned validation. Resolve environment gaps once,
   before interpreting test failures.
2. Read the named implementation and adjacent tests, then implement in
   dependency order: pure contracts and data logic, lifecycle boundaries,
   UI/navigation, and end-to-end coverage.
3. Batch related reads and edits. Validate each coherent layer with combined
   focused tests instead of rerunning tests after every small edit.
4. Run broad repository checks once after focused suites pass. Collect all
   failures from a run, classify them together, and fix task-related failures
   as one batch.
5. Record the final checks, known unrelated failures, exact commit, and
   remaining remote acceptance in the next handoff. Avoid progress-only model
   turns between commands that can proceed immediately.

## Pull request safety

Treat the upstream repository as fetch-only. Agents must **never** create,
open, or submit a pull request against upstream, including through `gh`, the
GitHub API, browser automation, or any other integration. Agents must also
never surface a one-click URL, compare link, or UI action that could open or
prefill a pull request against upstream.

Before creating or linking to any pull request, verify the repository owner,
repository name, base branch, and head branch explicitly. Pull requests for
fork work may target only this fork's `origin` repository. If the intended
target is ambiguous or differs from `origin`, stop and ask the user rather than
assuming upstream.

Fetching, inspecting, and merging from the upstream remote remain allowed.
Those operations do not authorize pushing to upstream or proposing changes
there.

## Preserve fork invariants

Before syncing upstream or resolving a conflict, read
`fork-decisions/README.md` and all relevant numbered decisions. The current
permanent invariants include:

- centralized Firebase, Google Sign-In, authentication, PalsHub marketplace,
  checkout, synchronization, feedback, and benchmark submission remain
  disabled in normal fork builds;
- user-owned Hugging Face, search-provider, and remote-server credentials
  remain supported;
- GitHub Copilot server support and the Chat Completions/Responses transports
  remain additive, including protocol selection, safe credential origins,
  persistence, tool replay, and content-safe diagnostics;
- hands-free, explicitly on-device conversation behavior must not regress to
  one-shot dictation;
- Scout and full-result search remain supported fork features.

Do not resolve a merge by taking either complete side of a conflicted file when
the file contains both upstream and fork behavior. Reconstruct the combined
intent and retain tests from both sides.

## Syncing upstream

Use a dedicated feature branch and pin the exact merge base, fork tip, and
upstream tip. Before editing conflicts:

1. Review fork-only commits and existing fork decisions.
2. Classify each conflict as an independent composition, an intentional fork
   override, or an upstream improvement that can be accepted directly.
3. Preserve product, privacy, protocol, persistence, native, and UX behavior
   explicitly; do not assume a clean merge proves compatibility.
4. Add a numbered `fork-decisions/NNN-*.md` record when the merge introduces or
   changes a durable resolution. Record affected paths, both intents, the
   chosen resolution, rejected alternatives, checks, and supersession
   conditions. Never include credentials or user data.
5. Add static contract tests for fragile native/configuration merges when a
   unit test cannot exercise the contract directly.

Validate affected suites first. For changes touching disabled integrations,
also run:

```sh
yarn test:disabled-build
```

For a substantial sync, run the relevant focused tests, `yarn typecheck`,
`yarn lint`, and any configuration or payload checks identified by the decision
record.

## Android E2E acceptance

`.github/workflows/e2e-tests.yml` is a manually dispatched Android build and
smoke test. A task that explicitly requires E2E acceptance is not complete
until a fresh run succeeds for the final pushed commit.

After pushing a non-protected task branch:

```sh
gh workflow run e2e-tests.yml --ref <branch>
gh run list --workflow e2e-tests.yml --branch <branch>
gh run watch <run-id> --exit-status
```

Confirm that the successful run's `headSha` matches the final commit. Do not
claim this workflow proves live provider compatibility, physical-device speech
or TTS behavior, real search-provider behavior, camera hardware coverage, or
iOS runtime behavior.

### Investigating Android E2E and CI failures

Move repeated CI diagnosis into a fresh session once local implementation is
stable. Hand off the exact commit, workflow filename, run IDs, failing job and
step, concise error excerpt, relevant artifact paths, checks already known to
pass, and the acceptance condition. Keep prior successful logs and unrelated
implementation discussion out of the new context.

For each failed run:

1. Verify the repository, branch, and `headSha`, then inspect the run summary
   and failed-step logs together. Download artifacts only when the logs are
   insufficient.
2. Classify the earliest actionable failure as infrastructure, build or
   packaging, app startup, test-driver or selector, fixture setup, or product
   behavior. Later failures may be cascades and should not be diagnosed first.
3. For app-startup failures, inspect the manifest/package identity and capture
   process or device logs before changing test assertions. For assertion
   failures, inspect the screenshot, accessibility tree, fixture state, and
   first failed interaction before changing product code.
4. Reproduce the narrowest failing layer locally when feasible. A previously
   built APK may be reused for diagnosis, but never as acceptance for a changed
   commit.
5. Retry an unchanged commit only for a clearly transient infrastructure
   failure, and limit blind retries. If the same failure repeats, stop
   dispatching and investigate its root cause.
6. After any code or test change, push the new commit and require a fresh full
   workflow run for that exact SHA. Fast or artifact-reuse runs are diagnostic
   only.

Use a subagent here only for a single bounded task, such as summarizing one
run's failed logs or comparing one APK manifest with expected package names.
The owning fresh session should integrate the evidence, make changes, and track
the final exact-SHA acceptance.

## Reviewing changes

For a branch or security review, establish the review boundary first:

```sh
git status --short
git diff --stat
git diff
git diff --cached
```

Include relevant untracked files and compare against the intended base when
the worktree diff is not the whole change. Trace changed inputs through storage,
network, native, and UI boundaries as applicable. Report only reproducible,
high-confidence findings with exact paths and lines; do not turn style,
speculation, or pre-existing behavior into findings. If no qualifying issue is
found, say so plainly and state the reviewed boundary.

## Maintaining GitHub Actions runs

Use `gh` for workflow-run maintenance. Resolve the workflow by filename, list
all matching runs with IDs and timestamps, and apply the requested cutoff in an
explicit timezone before deleting anything. Delete only the enumerated run IDs;
do not delete by an unverified search result.

After deletion, query the workflow again with the same cutoff and verify that
zero matching runs remain. Remember that deleting a run also deletes its logs
and artifacts, so report the exact number removed and the cutoff used.

## Localization

For user-facing text, edit only `src/locales/en.json`. Other locale files are
managed by Weblate. Use `{{placeholder}}` syntax for interpolation and run:

```sh
yarn l10n:validate
```
