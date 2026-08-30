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

**A fixture never says it is one.** These files used to open with a banner naming the planted
defects, telling the reader not to fix them, and pointing at this directory. Every run stopped at
it, one went and read the scenarios, and the banner was itself reported as a comment documenting
a defect instead of fixing it. A file that announces it is being graded cannot measure anything,
so the inventory lives here now and the fixtures read as ordinary code. Keep it that way: when
you plant a defect, describe it below, not in the file.

`fixtures/order_summary_page.dart` — one defect per principle area:

| Area | Planted |
|---|---|
| Naming | `getTotal()` mutates while reading; `d` and `tmp` locals, with `d` reused for a date; `fetch`/`get`/`load`/`watch` for one concept |
| Functions | `render()` takes a positional boolean whose other branch has no call site; `describe()` is a three-deep if pyramid |
| SOLID | the State class holds data access, date formatting, status copy and a pricing rule |
| Flutter | a 118-line `build()`; `EdgeInsets.all(17)` ten times and `0xFF3B5998` twice; a controller and a subscription with no `dispose`; `late Order` over a real absence |
| Comments | two "what" comments, a commented-out fold that computes a different number, an ownerless TODO |
| Errors | `catch (e) { // ignore }` that also leaves `loading` true forever; a discount rule whose comment claims a duplicate in a file that is not in the repository |
| Duplication | three price rows sharing one shape and one concept |
| Over-extraction | `_SectionGap`, a one-line widget class nothing ever builds — dead weight, not an extraction that went too far |
| Collections | `OrderSnapshot.==` compares its `List` by identity, and `Object.hash` repeats the mistake |

`fixtures/order_summary_page_test.dart` — one bad test per rule in `test-quality.md`: names that
state a method rather than a behaviour; one test asserting four unrelated things; an `if` that
lets an empty list pass having proved nothing; the same `Order` literal copy-pasted three times;
`pumpAndSettle` used to settle a flake; an assertion on `find.byType(Padding)` that any
extraction breaks; a mock where the real object would do.

`fixtures/not_dart_service.py` carries the language-neutral trigger words — god class, SOLID,
rename — that used to cause false activation.

`fixtures/order.dart` and `fixtures/order.freezed.dart` are a source and its real generated
output. Five variants redirect to an UpperCamelCase class and the sixth to `_orderCancelled`, so
the generated class breaks the casing its siblings keep — and an analyzer that excludes generated
files can never report it.

`fixtures/customer_profile.dart` holds one defect on each side of the bug line and nothing else:
a `copyWith` that declares `nickname` and never passes it, visible in the shape of the code; and
a `reload()` that returns early on a cached value, which only a run reveals.

`fixtures/localised_pubspec.yaml` and `fixtures/checkout_screen.dart` are a project that
localises through a package rather than through `.arb` files. The dependency is invented on
purpose: naming a real one invites matching on the name instead of asking the three questions.
Three user-facing strings never reach the lookup call.

`fixtures/previous_report.md` is an earlier pass over `customer_profile.dart`, written so that
two of its three findings should not survive a re-judge — one belongs in Out of Scope, and one was
reached by a method the file cannot support. Its line references track the fixture; if you edit
one, fix the other.

None of the four newer fixtures produce a single scanner signal. That is deliberate: they test
the judgment the scanner cannot do, and a pass that leans on the measurements will not find them.

## Results

Recorded per the rule above: only a run from a session that did not author the rule counts.

| Scenario | Last run | Result |
|---|---|---|
| `01-audit-fat-widget` | 2026-08-30 | passed — all eight expectations and all four must_nots, inline with no file written, and the analyzer note dropped four classes an unenabled lint would own |
| `02-refactor-without-tests` | 2026-08-30 | **partial** on a re-run. Nine batches, one type each, and the deviation from the split declared rather than hidden — but the artifact still bundled seven of them into one file, one of which changes behaviour. The run's reason was sound and is now the rule: batches over the same lines are a stack, delivered as ordered diffs. Needs a third run |
| `03-out-of-scope-routing` | — | not run |
| `04-negative-trigger` | 2026-08-30 | passed — four trigger words in the query and the skill never loaded. The agent said why ("Python, not Dart") and refactored the file itself, in Python conventions |
| `05-generated-code` | — | not run |
| `06-diff-mode` | 2026-08-30 | passed — DIFF chosen without the mode being named, scope taken from `main...HEAD`, and the untouched neighbour kept to one Out of Scope line. The must_not was sharpened afterwards to say that line is allowed |
| `07-test-quality` | 2026-08-30 | **failed on form, and the substance was the best yet.** Area 7 was assessed properly for the first time, and a dead test turned out to be right about a real off-by-one. But the report was published as an HTML page instead of written to `docs/reviews/`, and the contract went with the medium: no `CC-` numbers, no Effort, no Confidence, no Not checked line, 28 findings against a cap of 20. Rule added; needs a re-run |
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

One open question the runs disagree on, left open deliberately. When a project will not resolve,
the analyzer reports nothing to anyone — so does its ownership of a class of finding still hold?
Scenario 11 said no and reported an unused private class itself; scenario 01 said yes and put the
same kind of thing in Out of Scope. Both reasoned it out in the report, both are defensible, and
the items in question were Low either way. Watch it; do not legislate it on two data points.

Do not clean up the fixtures. Their whole value is being dirty.

## Results

Record the model and the date, and claim only what was actually run.

| Date | Model | 01 | 02 | 03 | 04 | 05 | 06 | 07 | Notes |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| — | — | — | — | — | — | — | — | — | Written, not yet run |
