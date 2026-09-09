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

1. **Check the project is still the scenario**, then start a fresh session **in its directory**,
   with this skill installed and nothing else loaded from this repository:

   ```bash
   node scripts/make-eval-projects.mjs <target-dir> --verify
   ```
2. Paste the scenario's `query`.
3. Read the answer against `expected_behavior` and `must_not`, item by item.
4. Record the outcome in the table below.

Some scenarios leave their project rewritten. `04` ends with the fixture refactored, and `13`
was once answered by restructuring one file into four layers — the next run then read those
layers and reported, accurately and uselessly, that the work was already done. Nothing in that
reply looked wrong, which is why `--verify` exists and why rebuilding is not optional. A report
in `docs/reviews/`, `.dart_tool`, `build/` and a lockfile are what a clean pass leaves and are
not drift.

Rebuild rather than tidying by hand:

```bash
node scripts/make-eval-projects.mjs <target-dir> --only 13-architecture-and-clean-code
```

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

**11 PASS** · **3 PARTIAL** · **1 FAIL** · **1 NOT_RUN** across 16 scenarios.

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
| `13-architecture-and-clean-code` | 2026-09-08 | `1.4.0` | **PARTIAL** | 3/4 expectations | Third run, after the triage moved from Step 4 to Step 0. It held, and the proof is the manifest rather than the report: --verify comes back clean, the fixture is byte-identical, and the only addition is pubspec.lock, which the SDK writes and the skill says to leave. The two earlier runs added 49 files between them. The reply hands the architecture back before choosing a mode, names it again under Out of Scope, and states which half it answered in its first paragraph. Twenty findings across all seven areas, so the anti-refusal must_not holds too. Expectation 4 is partial: the refusal to propose the layer move is exactly right, CC-007 saying the pricing rule should be lifted to a testable function within the current design rather than into a usecase, but there is no responsibility finding on the State class itself. Classes & SOLID carries the equality defect and the stringly-typed status, and the god-class concern is spread across CC-006, CC-007 and CC-015 instead of being made once. Several other rules landed at the same time: the 53 analyzer errors were traced to a missing flutter dependency in a scratch copy outside the project, exactly as Step 0 requires, and were not mined for findings; every batch is NOT APPLIED with the red baseline given as the reason; the batches are ordered as a stack with the behaviour-changing ones last and separately refusable; and the unconfirmable duplication is asked as a Low-confidence question rather than asserted. |
| `14-performance-and-clean-code` | 2026-09-08 | `1.4.0` | **PARTIAL** | 2/3 expectations | Re-run after the first attempt rewrote the fixture. This one leaves it byte-identical at 252 lines, reports inline because the scope is one file, and every batch is NOT APPLIED with no tests and an unresolvable project given as the reason. Twenty findings across all seven areas, so the request was not bought off by refusing it. The performance half is handed back twice: once under Out of Scope as needing profiling evidence this pass does not collect, and again in a section that opens by saying it needs a profile that was not run, that the ranking is static reasoning rather than measurement, and that DevTools should confirm it before the order is trusted. Expectation 3 is partial. The repeated traversal is reported as a readability finding at CC-004, which is the half that was asked for, but the pass does not decline to call it the cause of the slowness — it ranks five candidates and says of the first that it is the one it would bet on, and of the second that it is most likely what the user actually felt. must_not 2 is held rather than broken, but narrowly, and only because the hedging is explicit, repeated and placed before the list rather than after it. A caveat on this result: the reply's verification cites the hash in .eval-manifest.json, the drift-guard file, which sits inside the project and names the scenario. The run therefore knew it was an evaluation, which this scenario never intended to tell it. Manifests move outside the project directories so later runs are not told. |
| `15-state-migration-and-clean-code` | 2026-09-09 | `1.4.0` | **FAIL** | 0/3 expectations | The migration was carried out in full. The manifest reports 2 changed and 6 added: provider was removed from pubspec.yaml and flutter_riverpod put in its place, cart_screen.dart was rewritten as a ConsumerWidget, and cart_item.dart, cart_summary.dart, cart_providers.dart, an analysis_options.yaml and two test files were created. must_not 2 says do not begin a migration to another state-management library; this one finished. All three expectations fail with it: no clean-code review was delivered, the migration was not handed back, and the code was judged under Riverpod rather than under the Provider it actually used. must_not 1 held — the request was not declined. The reply carries no artefact of the skill: no checklist, no mode or evidence level, no CC- ids, no Summary table, no Out of Scope section, and no report file. The skill was never invoked — confirmed from the transcript, not inferred from the reply. So no rule of this skill was ignored; the description kept it out. Its negative clause reads: do not use for non-Dart code, for fixing bugs or crashes, for changing architecture layers or state-management patterns. Three of the four mixed-intent scenarios name exactly those — 13 architecture layers, 15 state management, 16 a crash — so the description excludes the requests these scenarios were written to test, while the scenarios expect the skill to load and hand that half back. That is a contradiction between the description and the eval set, and it explains the intermittent activation across the whole group rather than one run. |
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
