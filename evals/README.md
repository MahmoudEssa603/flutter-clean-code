# Evaluations

Twelve scenarios that check whether `SKILL.md` still does what it claims. They are the source of
truth for whether a change to the skill was an improvement or a regression.

There is no built-in runner. Each scenario is run by hand, and the result is recorded honestly.

## How to run one

1. Start a fresh session with this skill installed and nothing else loaded from this repository.
2. Paste the scenario's `query`, attaching the files listed in `files`.
3. Read the answer against `expected_behavior` and `must_not`, item by item.
4. Record the outcome in the table below.

Run all twelve before every tag. See the pre-publication checklist in
[AGENTS.md](../AGENTS.md).

Step 1 is not a formality. Whoever wrote the rule under test cannot grade it from the session
they wrote it in: the answer is already in their context, and so is the verdict they expect. A
result recorded from such a session says nothing, and saying nothing while looking like a pass
is worse than an empty row.

## Scenarios

| File | Checks |
|---|---|
| `01-audit-fat-widget.json` | AUDIT finds the planted findings, writes no file, answers in Arabic |
| `02-refactor-without-tests.json` | Rule Zero holds: characterization tests first, or an unapplied patch |
| `03-out-of-scope-routing.json` | Out-of-scope work is reported, not absorbed and not routed to a named tool |
| `04-negative-trigger.json` | The skill does not fire on non-Dart code |
| `05-generated-code.json` | Generated Dart is excluded, and the scanner is run first |
| `06-diff-mode.json` | DIFF is selected from the request, and only changed files are audited |
| `07-test-quality.json` | Area 7 is assessed, and duplication of shape is judged as knowledge or not |
| `08-excluded-generated-source.json` | An enabled lint that cannot fire, because the file is outside analysis, does not silence the finding |
| `09-bug-line.json` | A shape-visible defect is a finding; a run-only one is handed back |
| `10-localisation-detection.json` | Localisation is detected from the package in use, not from three markers |
| `11-unresolved-dependencies.json` | A project that will not resolve is reported, not mined for findings |
| `12-rerun-rejudges.json` | A re-run keeps the numbers and re-judges the verdicts |

## Fixtures

`fixtures/order_summary_page.dart` carries one planted finding per principle area, plus a
repeated price row, an over-extracted `_SectionGap`, and an `OrderSnapshot` whose `==`
compares a `List` by identity. The header comment lists them, and every signal
`scan-dart.mjs` emits has a case there.
`fixtures/order_summary_page_test.dart` carries one bad test per rule in `test-quality.md`.
`fixtures/not_dart_service.py` carries the language-neutral trigger words that used to cause
false activation. `fixtures/order.freezed.dart` is real generated output, and must be skipped
without being named; `fixtures/order.dart` is the hand-written source it belongs to, carrying one
variant whose redirect breaks the casing its five siblings keep.
`fixtures/customer_profile.dart` holds one defect on each side of the bug line and nothing else.
`fixtures/localised_pubspec.yaml` and `fixtures/checkout_screen.dart` are a project that
localises through a package rather than through `.arb` files, with three user-facing strings that
never reach the lookup call. `fixtures/previous_report.md` is an earlier pass over
`customer_profile.dart`, written so that two of its three findings should not survive a re-judge.

None of the four newer fixtures produce a single scanner signal. That is deliberate: they test
the judgment the scanner cannot do, and a pass that leans on the measurements will not find them.

## Results

Recorded per the rule above: only a run from a session that did not author the rule counts.

| Scenario | Last run | Result |
|---|---|---|
| `01-audit-fat-widget` | — | not run |
| `02-refactor-without-tests` | 2026-08-30 | **failed** — Rule Zero handled correctly and the patch was left unapplied, but the whole thing arrived as one batch labelled "Rename · Extract · Inline", against both the expectation and the must_not. Rule tightened; needs a re-run |
| `03-out-of-scope-routing` | — | not run |
| `04-negative-trigger` | — | not run |
| `05-generated-code` | — | not run |
| `06-diff-mode` | — | not run |
| `07-test-quality` | — | not run |
| `08-excluded-generated-source` | 2026-08-30 | passed |
| `09-bug-line` | 2026-08-30 | passed |
| `10-localisation-detection` | 2026-08-30 | passed |
| `11-unresolved-dependencies` | 2026-08-30 | passed on a re-run after the two fixes; the first run left one expectation partial |
| `12-rerun-rejudges` | 2026-08-30 | passed |

Scenarios 06 to 12 were written from defects observed while auditing unrelated Flutter projects,
and the behaviour each one describes was seen in those audits before it was written down. That is
evidence the rule matters. It is not a run of the scenario, and it does not fill a row above.

The 2026-08-30 runs were done from fresh sessions against a copy of each scenario's files laid out
as a small standalone project, and they were worth more than their five passes. They found that
`dart format --set-exit-if-changed` rewrites the files it checks — twice, an AUDIT had to undo a
reformat it had caused — and that `findTrivialWidgets` counted a constructor as a call site, so a
widget class nobody builds reported as used once while one with a single call site was filtered
out as reuse. Neither defect was reachable from the fixtures alone. A scenario earns its place by
being run somewhere the skill can actually misbehave.

Re-running 11 after those two fixes confirmed both: the pass reported the file as unformatted and
left it byte-identical, and it called `_SectionGap` dead code to delete rather than an extraction
to inline. It also closed a gap nothing else had: this is the only scenario whose project has no
localisation at all, so it is where the rule's other half gets exercised — asking all three
questions, finding no package and no lookup call, and handing localisation back in one line
instead of raising a finding per string.

Do not clean up the fixtures. Their whole value is being dirty.

## Results

Record the model and the date, and claim only what was actually run.

| Date | Model | 01 | 02 | 03 | 04 | 05 | 06 | 07 | Notes |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| — | — | — | — | — | — | — | — | — | Written, not yet run |
