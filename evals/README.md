# Evaluations

Seven scenarios that check whether `SKILL.md` still does what it claims. They are the source of
truth for whether a change to the skill was an improvement or a regression.

There is no built-in runner. Each scenario is run by hand, and the result is recorded honestly.

## How to run one

1. Start a fresh session with this skill installed and nothing else loaded from this repository.
2. Paste the scenario's `query`, attaching the files listed in `files`.
3. Read the answer against `expected_behavior` and `must_not`, item by item.
4. Record the outcome in the table below.

Run all seven before every tag. See the pre-publication checklist in
[AGENTS.md](../AGENTS.md).

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

## Fixtures

`fixtures/order_summary_page.dart` carries one planted finding per principle area, plus a
repeated price row, an over-extracted `_SectionGap`, and an `OrderSnapshot` whose `==`
compares a `List` by identity. The header comment lists them, and every signal
`scan-dart.mjs` emits has a case there.
`fixtures/order_summary_page_test.dart` carries one bad test per rule in `test-quality.md`.
`fixtures/not_dart_service.py` carries the language-neutral trigger words that used to cause
false activation. `fixtures/order.freezed.dart` is real generated output, and must be skipped
without being named.

Do not clean up the fixtures. Their whole value is being dirty.

## Results

Record the model and the date, and claim only what was actually run.

| Date | Model | 01 | 02 | 03 | 04 | 05 | 06 | 07 | Notes |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| — | — | — | — | — | — | — | — | — | Written, not yet run |
