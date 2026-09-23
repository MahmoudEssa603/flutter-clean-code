# Evaluations

Seventeen scenarios that check whether `SKILL.md` still does what it claims. They are the source of
truth for whether a change to the skill was an improvement or a regression.

There is no built-in runner. Each scenario is run by hand, and the result is recorded honestly.

## How to run one

Build the projects once, somewhere outside this repository:

```bash
node scripts/make-eval-projects.mjs <target-dir>          # all seventeen
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

   **Name the skill unless the scenario says not to.** Each scenario declares `invocation`.
   `explicit` means paste the query with `/flutter-clean-code` — that scenario measures what the
   skill decides, and the run must not also be a coin toss on whether it loaded. `implicit` means
   paste the query alone: those scenarios measure activation, and are the only ones where a miss
   is the result rather than a wasted run.

   **`mode` is the mode the request should lead the run to select**, recorded so a grader knows
   what the query was written to produce. Nothing scores it unless an expectation says so — only
   `01` and `06` do. On a project with no tests, Rule Zero's route 2, patches proposed and not
   applied, is what a `REFACTOR` query yields, and several `AUDIT` scenarios have been graded
   PASS on a reply that went that far because their queries asked for cleanup too. Read the field
   as what the scenario expects to see, not as a ceiling.
2. Paste the scenario's `query`.
3. Read the answer against `expected_behavior` and `must_not`, item by item.
4. Record the outcome in the table below.

Some scenarios leave their project rewritten. `04` ends with the fixture refactored, and `13`
was once answered by restructuring one file into four layers — the next run then read those
layers and reported, accurately and uselessly, that the work was already done. Nothing in that
reply looked wrong, which is why `--verify` exists and why rebuilding is not optional. `.dart_tool`,
`build/` and a lockfile are what a clean pass leaves and are not drift.

A report in `docs/reviews/` is drift, and used to be exempt here. It is the next run's input:
`SKILL.md` sends every pass to that directory for the newest previous report before it writes
one, so a report left behind turns an ordinary scenario into a re-run. `05`, `07` and `13` were
each carrying one, and `12` — which seeds a weak report on purpose — had the previous run's
corrected report beside it with a newer date, so a re-run would have re-judged that instead. The
report a scenario seeds is in its manifest and stays clean; anything the run adds does not.

Rebuild rather than tidying by hand:

```bash
node scripts/make-eval-projects.mjs <target-dir> --only 13-architecture-and-clean-code
```

Run the ones a change touches, and all seventeen before a tag. See the pre-publication checklist in
[AGENTS.md](../AGENTS.md).

Step 1 is not a formality. Whoever wrote the rule under test cannot grade it from the session
they wrote it in: the answer is already in their context, and so is the verdict they expect. A
result recorded from such a session says nothing, and saying nothing while looking like a pass
is worse than an empty row.

## Two things are being measured, and they are not measured together

Activation is a semantic match between the request and the `description`. No wording makes it
certain, and it is not a rule this repository can fix — it is a property of the host's matcher.

Every scenario used to test it by accident. A run that never loaded the skill still produced a
reply, and that reply was then graded against rules it had never seen. It happened three times
before the pattern was visible, and each time the description was retuned as though a rule had
failed. Fifteen tests were being made unreliable by one variable that belonged in one test.

So: fifteen scenarios name the skill and measure conduct. Two do not and measure activation —
`04-negative-trigger`, which must not fire, and `17-activation-on-a-mixed-request`, which should.
A miss on those two is one row. Read them as a rate across runs, and change the description only
when a pattern shows, never after a single miss.

The same split is the answer for anyone using the skill for real: name it when it matters.

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
| `09-bug-line.json` | A defect the body proves is a finding at High; one that turns on absent intent is a Low-confidence question |
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
| Flutter | a 118-line `build()`; `EdgeInsets.all(17)` nine times and `0xFF3B5998` twice; a controller and a subscription with no `dispose`; `late Order` over a real absence |
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

`fixtures/customer_profile.dart` holds one defect the body settles and one it only raises, and
nothing else: a `copyWith` that declares `nickname` and never passes it, which the code proves
outright; and a `reload()` that returns early on a cached value, where the name contradicting the
body is plain but which of the two is wrong turns on a caller the file does not contain. Both are
findings — the second at Low confidence, as a question. Neither is on the far side of the bug
line, which is drawn at what a run alone reveals; `16-runtime-bug-and-clean-code` tests that side,
with a crash no reading can diagnose.

`fixtures/localised_pubspec.yaml` and `fixtures/checkout_screen.dart` are a project that
localises through a package rather than through `.arb` files. The dependency is invented on
purpose: naming a real one invites matching on the name instead of asking the three questions.
Three user-facing strings never reach the lookup call.

`fixtures/previous_report.md` is an earlier pass over `customer_profile.dart`, written so that
two of its three findings should not survive a re-judge — one is costed at High as a runtime
failure no caller in scope can confirm, and one was reached by a method the file cannot support.
Its line references track the fixture; if you edit one, fix the other.
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

Two measurements sit beside the verdicts and answer questions a verdict cannot.
[report-contract.md](report-contract.md) measures whether stating a rule in `SKILL.md` makes
reports follow it. [ab/RESULTS.md](ab/RESULTS.md) and [ab/HOLDOUT.md](ab/HOLDOUT.md) measure what
the skill adds over the same model without it, on these fixtures and on code it has never seen.

<!-- generated: eval-summary -->

**16 PASS** · **1 PARTIAL** across 17 scenarios.

Generated from `evals/results/` by `scripts/generate-eval-summary.mjs`. Edit the records,
not this table.

| Scenario | Last run | Graded against | Verdict | Expectations | Note |
|---|---|---|---|---|---|
| `01-audit-fat-widget` | 2026-09-23 | `1.7.0` | **PASS** | 8/8 expectations | Run of the release candidate, which carries D5, D6, D7 and the grouped literal signal. Eight of eight and all four must_nots. Expectation 3 is CC-015: the 118-line build() as a Flutter finding, named widget classes rather than _buildX() methods, and all three reasons — const, keys and a name in DevTools. Expectation 4 is CC-003, which names the write to _cachedTotal behind a query name; CC-004 reports getUser() beside it. Expectation 5 is CC-013, and the choice of replacement values goes to a design system. Expectation 6 is CC-008 at Low confidence, because invoice_service.dart is named on the Not checked line and was never read. Expectation 7 holds by check-report.mjs at 19 findings. Expectations 1, 2 and 8 hold from the header, the empty workspace diff and the Arabic prose with English identifiers. must_not 2 holds: dart format's drift is named under Verification and under analyzer coverage, and no finding rests on it. The two claims worth re-counting are both right, and both are the scanner's new shape: 14 signals in this file, and EdgeInsets.all(17) nine times — the count six of nineteen earlier runs got wrong while listing the right nine lines. |
| `02-refactor-without-tests` | 2026-09-23 | `1.7.0` | **PASS** | 5/5 expectations | Five of the five that apply, and all four must_nots. Expectation 3 is not counted: the run took the other allowed path, so no characterization test was written. The path is named in as many words — 'None of the eight is applied' above the batches, and every batch carries 'NOT APPLIED — requires approval'. Eight batches, one refactoring type each, and the three that change behaviour say so in their headings rather than claiming a Reason safe; the five behaviour-preserving ones each carry one. Verification is honest where it could not run: flutter analyze returned 107 diagnostics cascading from unresolved imports, and the report says outright that the count measures broken resolution and is not mined for findings, while dart format's drift is reported with the file confirmed untouched at 6470 bytes. The workspace diff is empty, so must_not 1 holds from the disk. must_not 3 holds: the discount stays 0.1 in the extracted version. Recorded, not scored: batch 4 extracts discount() to a new class as discountFor(order), which is a name change inside an extraction batch — the run states the reading it used, that naming an extracted member is part of the extraction, and keeps the file's rename pass in batch 2 on its own. The report passes check-report.mjs at 20 findings. |
| `03-out-of-scope-routing` | 2026-09-23 | `1.7.0` | **PASS** | 5/5 expectations | Five of five and all three must_nots, answered in Arabic with identifiers, paths and the ratings in English. The Out of Scope table hands back seven observations, each with one line of reason: the rebuild question needs profiling this pass does not collect, the palette and tokens are a design-system decision, the ownership of order and loading is state-management work, and the hardcoded strings wait on a project that has no localisation at all. The literals themselves stay findings, which is the split expectation 3 asks for — CC-011 for the nine EdgeInsets.all(17) and CC-012 for the two colours — and the count is right. All seven principle areas carry a row and 19 findings, so the audit is delivered whole rather than refused for the parts it does not own. must_not 1 holds: what is named as a destination is profiling, a design system, state management and localisation, never a skill, plugin or tool. The workspace diff is empty and the report passes check-report.mjs. |
| `04-negative-trigger` | 2026-09-23 | `1.7.0` | **PASS** | 3/3 expectations | Three of the three that apply, both must_nots held. The load indicator is absent, which is what this scenario measures: check-run.mjs reports no Skill call, no slash command and no injected base directory, and the reply says so in its first line — the skill is Dart-only, so it was not used and this was a plain refactor. Expectation 4 is not counted, because the skill was never invoked by name. The fixture came back rewritten, as expectation 3 anticipates, and the project was rebuilt afterwards. must_not 2 holds visibly: the refactor is Python throughout — snake_case methods, def, self — and the god class is split into a service, a pricing rule and a notifier. |
| `05-generated-code` | 2026-09-23 | `1.7.0` | **PASS** | 4/4 expectations | Four of four and all three must_nots. order.freezed.dart is named once, on the Not checked line, and no finding carries a location inside it — checked across the report rather than sampled. Expectation 3 is met in the sharpest form the scenario allows: the offending declaration is emitted into the generated file, which carries ignore_for_file: type=lint, so the analyzer would never report it; the finding is written against the hand-written @freezed input that produced it, with build_runner named as the way to regenerate. The scanner ran first and its numbers are cited and correct — 2 files, 1 generated file skipped, 14 signals, 7.0 per file — which reproduces exactly under the release candidate's grouped literal signal. The cap is stated and honoured at 19 of 20, none of them from the generated file. The report was written to docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md, which is what a multi-file scope asks for, and it is kept beside the run record. |
| `06-diff-mode` | 2026-09-23 | `1.7.0` | **PASS** | 6/6 expectations | Six of six and all three must_nots. DIFF mode is chosen without the word being used, and the file list comes from git diff --name-only main...HEAD, which is the command expectation 2 names. Every one of the nine findings is located in order_filters.dart, the one changed file. order_summary_page.dart appears exactly twice: on the Not checked line, saying it was read for context and is unchanged on this branch, and as one Out of Scope line naming its known defects as outside this diff — which is the distinction must_not 2 draws in as many words, not a finding. The report is in Arabic with identifiers, paths and ratings in English, and it passes check-report.mjs. The workspace diff holds nothing, so must_not 3 holds from the disk. |
| `07-test-quality` | 2026-09-23 | `1.7.0` | **PASS** | 6/6 expectations | Six of six and all four must_nots. references/test-quality.md was read, the Tests row carries seven findings, and the test file is audited rather than waved through as 'only a test'. Expectation 3 is met twice over: the verify(analytics.log(any)).called(1) that asserts a method ran and nothing about what it carried, and the MockOrder standing in for a value three other tests in the same file construct directly. Expectation 5 and 6 are answered on the Not checked line, which says what happened to every candidate rather than leaving them unaccounted: the three duplicated money rows folded into CC-017, render's positional bool into CC-009, pumpAndSettle into CC-013, the unawaited getUser into CC-005, and seven issues dropped to the analyzer rule. The scanner's repeated 6-line block in the test file is cited at its lines. Verification is honest: 152 analyzer errors cascading from unresolved packages, not mined, and flutter test could not run because pubspec.yaml declares no dependencies. The report was written to docs/reviews/ and passes check-report.mjs at 20 findings. |
| `08-excluded-generated-source` | 2026-09-23 | `1.7.0` | **PASS** | 3/3 expectations | Three of three and all three must_nots. The generated file is named once on the Not checked line, and the report says plainly what it did with it: opened to establish where the declarations live and how they are named, never audited. The reasoning expectation 3 asks for is spelled out — camel_case_types is enabled, the miscased type is emitted into order.freezed.dart, and analyzer: exclude: removes that file from analysis, so nothing in the project will ever report it and it stays a finding here. The finding is written against the hand-written source that produces the name, not against the generated output, which is must_not 2. The report was written to docs/reviews/ and passes check-report.mjs at 4 findings. |
| `09-bug-line` | 2026-09-23 | `1.7.0` | **PASS** | 4/4 expectations | Four of four and all four must_nots. CC-001 reports copyWith discarding its nickname at High impact and High confidence, and states the cost the way expectation 2 asks — a caller renaming a nickname gets a profile that looks updated and is not, with the screen showing stale text and the next reader blaming the data layer. CC-002 reports reload() at High impact and Low confidence, which is the line expectation 4 draws: the body proves the first and only raises the second. The run went further than the scenario asks and demonstrated both in a scratch directory outside the project, including that the analyzer stays silent with avoid_unused_constructor_parameters and unnecessary_async switched on, because no lint rule inspects an ignored method parameter. The workspace diff is empty, so nothing was applied and no scratch file was left behind. The report passes check-report.mjs at 6 findings. |
| `10-localisation-detection` | 2026-09-23 | `1.7.0` | **PASS** | 3/3 expectations | Three of three and all three must_nots. The project is recognised as localised from the package and its assets, and the decision is made after grepping the lookup call across lib/ — `grep -rn "tr(" lib/` is in the transcript, which is expectation 2 exactly. Each hardcoded string is a finding with its own location, not a deferred project decision, and the report says why in one line: the file is not missing localisation, it is applying it inconsistently, which is worse, because nothing signals that the three literals were an oversight rather than a choice. The illustration it gives — a French reader seeing "Paiement", then "3 articles", then "Shipping is calculated at the next step" — is the cost stated rather than the rule restated. Nothing was modified and the report passes check-report.mjs at 5 findings. |
| `11-unresolved-dependencies` | 2026-09-23 | `1.7.0` | **PASS** | 4/4 expectations | Four of four and all four must_nots. The Verification section names the failure precisely — flutter analyze could not run because resolution failed at `git clone --mirror https://example.invalid/internal/ui_kit.git`, exit 128, host not resolved — and states that no diagnostics were produced and none were mined for findings. That is expectations 1, 2 and 3 in three lines, and must_nots 1, 2 and 3 with them. The audit continues on static reading plus the scanner, whose numbers are cited as measured rather than estimated: 1 file, 14 signals, and a 6-line block repeated three times at lines 186, 196 and 206. dart format is reported as pre-existing drift with the file confirmed untouched by md5. Nineteen findings, so must_not 4 holds — the audit was not abandoned. The report passes check-report.mjs and the workspace diff is empty. |
| `12-rerun-rejudges` | 2026-09-23 | `1.7.0` | **PARTIAL** | 4/5 expectations | Four of five, one partial, and all four must_nots. The re-run machinery is done well: the previous report is opened, a Since last pass table judges every finding again, CC-003 is withdrawn out loud rather than dropped, and new work numbers on past the highest existing id. Expectation 3 is the partial, and only its second half. The run withdraws the previous pass's costing exactly as asked, and says why in as many words — the retry button it described does not exist, there is no caller of reload() anywhere in the repository, and a consequence reachable only by pressing a button falls outside this pass. But it then keeps CC-002 at Confidence High, where the expectation calls for a Low-confidence question. Its argument is stated, not careless: 'the body proves the name wrong regardless of who calls it'. SKILL.md answers that case directly — Confidence is Low 'when the body proves something is wrong but not which side of it is, where your claim is which side and stays Low however plain the defect is' — and a method named reload() guarded by a cache is that shape: the name may be wrong, or the guard may be. Naming it as the name is a claim about which side. This is a rule misapplied, not a wrong scenario: scenario 09's run in the same sweep reported the same method at Low confidence as a question, from the same surface, so the rule reads clearly enough to be followed and was not here. |
| `13-architecture-and-clean-code` | 2026-09-23 | `1.7.0` | **PASS** | 4/4 expectations | Four of four and all three must_nots. The Out of Scope table quotes the architecture request back and gives one line for why it is a different job — layer boundaries, dependency direction, entities, usecases, repositories — and a second line for the dependency inversion on OrderApi, UserApi and UserCache. Expectation 3 is answered outright rather than by implication: 'I did not build it and did not lay groundwork for it — Batch 5 splits the god class where it stands, and is deliberately not a usecase or a repository.' That sentence is also must_not 2 and must_not 3 held at once. The clean-code half is delivered in full at 20 findings, with the State class's data access, pricing and layout reported as a responsibility finding inside the current design. Nothing on disk changed and the report passes check-report.mjs. |
| `14-performance-and-clean-code` | 2026-09-23 | `1.7.0` | **PASS** | 3/3 expectations | Three of three and all four must_nots. The performance half is set aside in three Out of Scope lines, each naming what evidence would be needed: no frame timings, rebuild counts or memory trace were collected; the eager Column build is a layout decision that needs a profile; the uncached NetworkImage is the same. Expectation 3's optional half is taken and taken correctly — getTotal's write is reported as a query that lies about being one, with build() calling it six times per frame stated as the reach of the side effect rather than as the cause of the slowness. must_not 4 holds: no finding carries two Confidence values, checked across the report. Twenty findings, nothing changed on disk, and the report passes check-report.mjs. |
| `15-state-migration-and-clean-code` | 2026-09-23 | `1.7.0` | **PASS** | 3/3 expectations | Three of three and all three must_nots. Replacing Provider with Riverpod is handed back in one line — a different domain, and not this pass's to do even on request — and the file is judged under the pattern it uses today rather than the one it was asked to move to. Ten findings on the code as it stands, so must_not 1 holds, and no finding depends on the target library, which is must_not 3. Nothing changed on disk and the report passes check-report.mjs. |
| `16-runtime-bug-and-clean-code` | 2026-09-23 | `1.7.0` | **PASS** | 4/4 expectations | Four of four and all three must_nots. The line is drawn where expectation 4 asks and stated twice: diagnosing the crash needs a run and a stack trace this pass does not collect, CC-001 is the one candidate visible in the shape of the code, and confirming it is the reader's step — 'if you paste the crash's stack trace, I'll tell you whether CC-001 explains it'. The stuck spinner is handed back beside it for the same reason, a run-revealed flow bug rather than a shape defect, which is the distinction held rather than merely claimed. Seventeen findings, so the clean-code half is delivered whole, and the shape-visible defects are reported with the silent failure each causes, which is must_not 3. Nothing changed on disk. Recorded, not scored, because no expectation rests on it: the report fails check-report.mjs with four problems, all of them locations — three findings name a list of line numbers without the file they are in, and one reads 'repository root'. The template asks for a file:line on every finding. |
| `17-activation-on-a-mixed-request` | 2026-09-23 | `1.7.0` | **PASS** | 2/2 expectations | The skill loaded without being named: check-run.mjs records the load indicator on a run whose condition is implicit, which is the one thing this scenario measures. Expectations 1 and 2 are counted; 3 and 4 are how the result is to be read, not behaviour to grade, and both must_nots are about the grading rather than the run. The reply is not graded here — 15 owns that, with the skill named — but it is recorded that the run produced a conforming report at 10 findings that passes check-report.mjs, and changed nothing on disk. |

<!-- /generated: eval-summary -->

Thirteen verdicts above are recorded against 1.5.0 although they ran before that number existed.
Each graded session started after `d10c975`, the last commit to change anything the model reads,
so what those sessions read is what 1.5.0 ships — the version line aside, which no scenario has
ever depended on. The start times come from the run transcripts, compared against that commit.
`07`, `11`, `13` and `14` were graded earlier, against surfaces that have since moved, and stay on
the versions they were graded against until they are run again.

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

An open question the runs used to disagree on, now answered by the run that dissented. When a
project will not resolve, does the analyzer still own a class of finding? Scenario 11 said no at
1.3.1 and reported an unused private class itself; 01, 02, 03 and 05 said yes and gave the same
kind of thing to the analyzer. At 1.5.0, 11 changed its answer and routed six such items to the
analyzer — with the condition stated out loud, which is what had been missing: the project's git
dependency is unresolvable, so the analyzer reports nothing today, the droppings assume that URL
gets fixed, and until it is, those six go unreported by anyone. Route them, and say so when
nobody is currently reading them.

Half of it is now settled, and against the premise the question started from. That premise was
that an unresolvable project reports nothing to anyone. Running `flutter analyze` inside 05's
project, which declares no dependencies at all, returns 117 diagnostics — and `unused_field` on
`_cachedTotal` and `unused_element` on `_SectionGap` are both among them, because they are
warnings rather than lints and need no `analysis_options.yaml` to fire. So the analyzer does
report these, even here. What is left is a judgment, not a fact: whether a warning buried in a
cascade of 117 gets read. Still watch it, but stop arguing it on emission.

Keep a neighbouring case out of it. A lint that exists in Dart but is not enabled is not part of
this question: SKILL.md's analyzer rule decides that one — drop the finding, and say once that
enabling the rule would cover the class. The two have been confused here before, and a report
that restates that rule wrongly is a slip in the report, not a second vote.
