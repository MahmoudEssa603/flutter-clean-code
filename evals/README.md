# Evaluations

Sixteen scenarios that check whether `SKILL.md` still does what it claims. They are the source of
truth for whether a change to the skill was an improvement or a regression.

There is no built-in runner. Each scenario is run by hand, and the result is recorded honestly.

## How to run one

Build the projects once, somewhere outside this repository:

```bash
node scripts/make-eval-projects.mjs <target-dir>          # all sixteen
node scripts/make-eval-projects.mjs <target-dir> --only 06-diff-mode
```

Attaching the files named in `files` is not enough, which is why this exists. The analyzer rule
needs an `analysis_options.yaml` with a rule enabled and an exclude list that hides the file it
would fire on. DIFF needs a repository with a base branch and one changed file sitting beside an
untouched one that carries far more defects. The unresolved-dependency scenario needs a dependency
that genuinely cannot be fetched. The re-run scenario needs an older report already in
`docs/reviews/`. None of that is a file you can attach.

The generator deletes what it rebuilds, and refuses any directory holding an entry it does not
manage. Then:

1. Start a fresh session **in the scenario's directory**, with this skill installed and nothing
   else loaded from this repository.
2. Paste the scenario's `query`.
3. Read the answer against `expected_behavior` and `must_not`, item by item.
4. Record the outcome in the table below.

Some scenarios leave their project dirty — `04` ends with the fixture rewritten, and any pass
that reaches `flutter analyze` leaves `.dart_tool` and a lockfile. Rebuild before running one
again rather than tidying by hand.

Run the ones a change touches, and all sixteen before a tag. See the pre-publication checklist in
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
`fixtures/cart_screen.dart` is a Provider-backed screen carrying ordinary clean-code defects — a
query that writes, three repeated amount rows, a repeated padding literal — so a request to move
it to another state-management library has real in-scope work sitting inside it.

Scenarios 13 to 16 are mixed intent: real Dart, a real clean-code job, and a second job belonging
to another domain. Three of them point at the same file on purpose — the code does not change,
only what the request asks on top of it, so what is measured is the routing and nothing else.
Both failure directions are named in each, because refusing the whole request is as wrong as
quietly absorbing the half that is not yours.

None of the four newer fixtures produce a single scanner signal. That is deliberate: they test
the judgment the scanner cannot do, and a pass that leans on the measurements will not find them.

Adding `order.dart` paid for itself the first time it ran. With the union and the screen in scope
together, a pass found what neither file shows alone: the union is referenced by nothing, the
screen matches on strings instead, and the two vocabularies disagree — the screen tests for a
status that is not a variant, so four of the six render as "Unknown". A fixture that is only a
file cannot produce a finding that lives between two.

## Results

`evals/results/` is the source of truth — one JSON record per scenario, carrying the verdict,
the date, the skill version, who generated the output and who graded it. The table below is
rendered from those records and must not be edited by hand.

Verdicts are `PASS`, `PARTIAL`, `FAIL` or `NOT_RUN`. A scenario whose expectations were only
partly met is `PARTIAL`, never `PASS` — that combination is what the prose version of this
table used to hide, and `scripts/check-evals.mjs` now refuses it.

`NOT_RUN` is a decision, not an omission: a scenario untouched by a change set is recorded as
`NOT_RUN` with a reason rather than left blank, because a blank row reads like a pass.

<!-- generated: eval-summary -->

**11 PASS** · **1 PARTIAL** · **1 FAIL** · **3 NOT_RUN** across 16 scenarios.

> **11 of these verdicts were graded against 1.3.1, not 1.4.0.**
> Run `node scripts/check-evals.mjs` to see whether anything the model reads has changed
> since. A verdict is a claim about one skill surface; once that moves it is unverified,
> not wrong — and unverified looks identical to verified in a table.

Generated from `evals/results/` by `scripts/generate-eval-summary.mjs`. Edit the records,
not this table.

| Scenario | Last run | Graded against | Verdict | Expectations | Note |
|---|---|---|---|---|---|
| `01-audit-fat-widget` | 2026-08-30 | `1.3.1` | **PASS** | 8/8 expectations | All eight expectations and all four must_nots. Answered inline with no file written, and the analyzer note dropped four classes an unenabled lint would own. |
| `02-refactor-without-tests` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Third run. Eight batches, one refactoring type each, shipped as ordered files v1-v8 beside the untouched original; the two behaviour-affecting batches sit last and say plainly that behaviour is not preserved. Nothing applied, proven by MD5. |
| `03-out-of-scope-routing` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Both things the request asked for went to Out of Scope with their own reason, the repeated colour literal stayed a finding, and no palette or state design was invented. |
| `04-negative-trigger` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Four trigger words in the query and the skill never loaded. The agent said why ("Python, not Dart") and refactored the file itself, in Python conventions. |
| `05-generated-code` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Generated file excluded and named once, the badly cased variant reported against the source, and the report written to docs/reviews/ as Step 6 asks. |
| `06-diff-mode` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | DIFF chosen without the mode being named, scope taken from main...HEAD, and the untouched neighbour kept to one Out of Scope line. The must_not was sharpened afterwards to say that line is allowed. |
| `07-test-quality` | 2026-09-07 | `1.4.0` | **PARTIAL** | 3/6 expectations | Re-run of the query that loaded nothing earlier the same day. The skill activated on the word audit and the whole contract came back: AUDIT and evidence stated, scanner run and cited, all seven principle rows with Tests carrying 8, CC-001..020 each with Impact, Effort, Confidence and a location, a Not checked line, Out of Scope, Deferred, and the report written to docs/reviews/. Three expectations met outright, none failed, three partial. The scanner's repeated 6-line block is cited as x3 in lib and x2 in test, and CC-016 decides the test one out loud — duplicated setup is a finding, duplicated assertions would not be — but the x3 in lib, the three price rows the scenario names, is never dispositioned either way, which leaves both the knowledge-duplication decision and the say-which-were-not-findings expectation half-answered. Five of the six area-7 findings are present; the unexplained pumpAndSettle is not among them, appearing only inside CC-014's code block and as an Out of Scope timing claim. references/test-quality.md is never cited by name, so expectation 1 is graded on behaviour: the setup-versus-assertions distinction is the reference's own. Two things the previous run got wrong are right here — the 152 unresolved-dependency diagnostics are named and explicitly not mined, and dart format ran check-only with --output=none leaving both files untouched. |
| `08-excluded-generated-source` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Generated file skipped and named, the badly cased variant reported against the hand-written source, with the reason the enabled lint cannot fire on it. |
| `09-bug-line` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | copyWith dropping a field reported as High; the run-only defect handed back in one Out of Scope line, with the two separated explicitly. |
| `10-localisation-detection` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Recognised the project as localised from the package and its assets, grepped the lookup call, and reported each hardcoded string with its own location. |
| `11-unresolved-dependencies` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Re-run after the format and scanner fixes confirmed both: the file was reported unformatted and left byte-identical, and the trivial widget was called dead code to delete rather than an extraction to inline. The first run left one expectation partial. |
| `12-rerun-rejudges` | 2026-08-30 | `1.3.1` | **PASS** | not enumerated | Ids carried, one verdict moved to Out of Scope keeping its number, and a conclusion the earlier pass reached by a weaker method was redone with the changed count stated. |
| `13-architecture-and-clean-code` | 2026-09-07 | `1.4.0` | **FAIL** | 1/4 expectations | First run of this scenario, and the failure it was written to catch. The skill carried out the entire Clean Architecture migration: core/, domain/, data/ and presentation/ layers, six types authored from nothing, a composition root, 34 new tests, an analysis_options.yaml, and a switch to ChangeNotifier with AnimatedBuilder. must_not 2 — carry out an architecture migration as though it were an ordinary clean-code refactor — is squarely broken. Three of four expectations fail with it: the redesign was never handed back under Out of Scope, the report says it answered both halves rather than which one, and CC-006 reports the State class's responsibilities only to say they were moved to domain and presentation, which is the layer move the scenario says not to propose. Expectation 1 is met in full, twenty findings across every area. must_not 1 and 3 held: it did not decline, and it did not hide the architecture work, announcing it under its own heading. Rule Zero went with it. The reply states plainly that behaviour is not preserved and asks for confirmation after the fact, where the skill requires the patch emitted unapplied and marked NOT APPLIED. A failed load now renders an error view, a failed profile reload a SnackBar, and a dead render branch is gone. No characterization tests were written first, correctly explained: the original file did not compile, so there was no behaviour to pin. The cause is a contradiction inside SKILL.md, not a lapse. What it does not own puts layer boundaries, dependency direction and module structure flatly outside the skill, while Step 4 forbids rewriting the feature and switching the state-management pattern only unless explicitly asked. The request asked explicitly, so the second rule licensed what the first forbids, and the agent followed the one that gave permission. |
| `14-performance-and-clean-code` | 2026-09-07 | `1.3.2` | **NOT_RUN** | not enumerated | Written 2026-09-07 and not yet run. Recorded rather than left blank, because a missing row reads like a pass. |
| `15-state-migration-and-clean-code` | 2026-09-07 | `1.3.2` | **NOT_RUN** | not enumerated | Written 2026-09-07 and not yet run. Recorded rather than left blank, because a missing row reads like a pass. |
| `16-runtime-bug-and-clean-code` | 2026-09-07 | `1.3.2` | **NOT_RUN** | not enumerated | Written 2026-09-07 and not yet run. Recorded rather than left blank, because a missing row reads like a pass. |

<!-- /generated: eval-summary -->

Scenarios 06 to 12 were written from defects observed while auditing unrelated Flutter projects,
and the behaviour each one describes was seen in those audits before it was written down. That is
evidence the rule matters. It is not a run of the scenario, and it does not fill a row above.

The 2026-08-30 runs were done from fresh sessions against a copy of each scenario's files laid out
as a small standalone project, and they were worth more than their verdicts. They found that
`dart format --set-exit-if-changed` rewrites the files it checks — twice, an AUDIT had to undo a
reformat it had caused — and that `findTrivialWidgets` counted a constructor as a call site, so a
widget class nobody builds reported as used once while one with a single call site was filtered
out as reuse. Neither defect was reachable from the fixtures alone. A scenario earns its place by
being run somewhere the skill can actually misbehave.

One open question the runs disagree on, left open deliberately. When a project will not resolve,
the analyzer reports nothing to anyone — so does its ownership of a class of finding still hold?
Scenario 11 said no and reported an unused private class itself; 01 and 03 said yes and gave the
same kind of thing to the analyzer. Each reasoned it out in the report, all three are defensible,
and the items were Low either way. Two to one is still not a rule. Watch it.
