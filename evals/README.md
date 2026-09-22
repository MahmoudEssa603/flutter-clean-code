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

<!-- generated: eval-summary -->

**17 PASS** across 17 scenarios.

Generated from `evals/results/` by `scripts/generate-eval-summary.mjs`. Edit the records,
not this table.

| Scenario | Last run | Graded against | Verdict | Expectations | Note |
|---|---|---|---|---|---|
| `01-audit-fat-widget` | 2026-09-22 | `1.7.0` | **PASS** | 8/8 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Eight of eight and all four must_nots. Expectation 3, PARTIAL at 1.6.0, is now met outright: CC-014 reports the 118-line build() as a Flutter finding, proposes named widget classes over _buildX() methods, and gives all three reasons — const, a key, and a name in DevTools. Expectation 4 is CC-001 under Naming, which names the hidden write to _cachedTotal. Expectation 5 is CC-012, which reports the padding and colour literals and sends the choice of replacement values to a design system in as many words. Expectation 6 is CC-006 under Errors & data, asked as a question at Low confidence because invoice_service.dart is not in scope. The report passes check-report.mjs at 16 findings, and the workspace diff is empty, so must_not 1 and 4 hold from the disk rather than the reply. Re-counted: scanner 23 signals, build() 111-228 = 118 lines, Color(0xFF3B5998) twice — all as claimed. One measured claim is wrong and is recorded rather than scored, because no expectation rests on it: CC-012 says EdgeInsets.all(17) appears ten times and then lists the nine correct lines; the file has nine. The same slip appeared at 1.6.0 in scenario 14. |
| `02-refactor-without-tests` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four that apply, and all four must_nots. Expectations 3 and 5 are not counted: the run took the other allowed path, so no characterization tests were written and no batch was applied, which leaves nothing to verify after a batch. The missing-tests decision is stated before anything else and the reason is concrete — the project declares no dependencies, so no test could compile. Seven batches, one refactoring type each, every one carrying a Reason safe line, and every one NOT APPLIED. must_not 3 holds: the discount rule is deferred, not rewritten. must_not 4 holds: renames are Batch 1 alone. Recorded, not scored: Batch 4 is labelled Signature and also extracts a widget class, which is two shapes of change in one batch, although not the rename-into-extraction mix the must_not names. Recorded, not scored: the report fails check-report.mjs with five problems — four batches describe their hunks in prose instead of a fenced diff block, and CC-019's location reads "see table". Also recorded: the report says getTotal() runs five times per frame; the real maximum is six, as 1.6.0 established. |
| `03-out-of-scope-routing` | 2026-09-22 | `1.7.0` | **PASS** | 5/5 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Five of five and all three must_nots. The reply opens with a section that hands back both halves it does not own before the report starts: the rebuild question for want of profiling evidence, and the choice of colour and spacing values as a design-system decision. The literals themselves are still reported, as CC-012 under Flutter, which is the split expectation 3 asks for, and CC-012's count is right this time — nine EdgeInsets.all(17) and two colours. The audit covers all seven areas with 18 findings. must_not 1 holds: what gets named as a destination is profiling, a design system and state management, never a skill, plugin or tool. Recorded, not scored: the scenario declares AUDIT and the run chose REFACTOR with batches, all NOT APPLIED, for a query that says "clean this code"; no expectation grades the mode here. Recorded, not scored: check-report.mjs fails with three batches missing a diff block. |
| `04-negative-trigger` | 2026-09-22 | `1.7.0` | **PASS** | 3/3 expectations | Three of three that apply, both must_nots held. The load indicator is absent: check-run.mjs reports no Skill call, no slash command and no injected base directory, and the reply says in its first line that the file is Python, so the skill does not apply, before doing the refactor itself. Expectation 4 is not counted — the skill was never invoked by name. The fixture came back rewritten, as expectation 3 anticipates, and the project was rebuilt afterwards. must_not 2 holds visibly: the refactor is Python throughout, snake_case methods and Protocol classes, with the god class split into a service, a pricer and a notifier. Recorded, not scored: the run verified its own refactor by running old and new side by side over eight cases, which is more than the scenario asks of it. |
| `05-generated-code` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four and all three must_nots. order.freezed.dart is named once on the Not checked line and never audited; no finding in the report carries a location inside it, which I checked rather than sampled. The scanner ran first and its numbers are cited and correct: 23 signals over 2 files, with the generated file skipped, which reproduces exactly. The cap is honoured and stated — 20 findings with four Low dropped, none of them from the generated file. The report was written to docs/reviews/, which is what a multi-file scope asks for, and it passes check-report.mjs. Recorded, not scored: a heredoc failed mid-run and the run switched to the file tool, which cost a turn and changed nothing. The report was written to docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-22.md in the run's project, and is kept with the run record under D:/eval-records/baseline-1.7.0/. |
| `06-diff-mode` | 2026-09-22 | `1.7.0` | **PASS** | 6/6 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Six of six and all three must_nots. DIFF mode is chosen without the word being used, and the file list comes from git diff --name-only main...HEAD, which is the command expectation 2 names. All ten findings are located in order_filters.dart, the one changed file; order_summary_page.dart is read for context and named on the Not checked line as outside the diff, which is exactly the distinction must_not 2 draws. The workspace diff holds nothing but .dart_tool/ and pubspec.lock, both SDK artefacts, so no edit was applied. The report is in Arabic with identifiers, paths and ratings in English, and passes check-report.mjs. Verification is real here rather than blocked: flutter analyze returned No issues found on the changed file and dart format reported it clean. |
| `07-test-quality` | 2026-09-22 | `1.7.0` | **PASS** | 6/6 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Six of six and all four must_nots. references/test-quality.md was read from the install, which expectation 1 asks for. Area 7 carries seven findings, and every item expectation 2 lists is present: the uninformative names (CC-009), the one test asserting four things (CC-010), the if that lets an empty list pass (CC-003), the Order literal in three tests (CC-015), the unexplained pumpAndSettle (CC-016's neighbour at line 59), and the find.byType assertions (CC-016). CC-017 is the MockOrder and the verify with no outcome assertion, which is expectation 3. The Tests row stays in the Summary with seven findings. Expectation 5 is met precisely: the scanner's repeated block is cited with its lines and judged as duplication of shape only, folded into the build() finding, while the test fixture's repetition is judged real duplication. Expectation 6 is met by the same passage. Recorded, not scored: check-report.mjs fails on one problem — CC-007 carries "High on the placement, Low on the duplication", which is the two-ratings shape 1.6.0's tightened Confidence rule exists to refuse. The report was written to docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-22.md in the run's project, and is kept with the run record under D:/eval-records/baseline-1.7.0/. |
| `08-excluded-generated-source` | 2026-09-22 | `1.7.0` | **PASS** | 3/3 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Three of three and all three must_nots. CC-001 reports the lowerCamelCase redirect target on order.dart:11, against the hand-written source that produced the badly cased generated class, which is expectations 2 and 3 together. The reasoning is explicit and checked rather than assumed: analyzer exclude removes **/*.freezed.dart from analysis, the generated file also carries its own ignore_for_file banner, so the enabled camel_case_types rule can never fire — and the run proved it with a probe in a scratch directory outside the project, then deleted it. The generated file is named once on the Not checked line and never audited. Recorded, not scored: check-report.mjs fails because CC-002 and CC-003, both Low-confidence questions, carry no Location at all. |
| `09-bug-line` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four and all four must_nots. CC-001 reports copyWith declaring nickname and passing this.nickname at line 23, at High impact and High confidence, with the silent cost stated: the call compiles, runs and returns the old value with no crash and no diagnostic. CC-002 reports reload() under Naming at High impact and Low confidence, put as a question with both branches costed, which is the line expectation 4 asks the report to draw — and it draws it in the ratings, not only in the prose. must_not 2 holds: the report says no caller exists in the project and frames the cost conditionally rather than asserting a broken button. must_not 4 holds: the mode is AUDIT, nothing was modified, and the one behaviour-changing fix is offered for approval instead of applied. The report passes check-report.mjs at five findings, and the workspace diff is empty. |
| `10-localisation-detection` | 2026-09-22 | `1.7.0` | **PASS** | 3/3 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Three of three and all three must_nots. The run reaches the right conclusion by the harder route: no l10n.yaml, no .arb and no flutter_localizations, but translations_kit in pubspec.yaml, two registered i18n asset files carrying real French, and tr() already used in the file. Expectation 2 is met literally — grep -rn "tr(" lib/ ran before the decision. The three English literals are reported as CC-001 with the three line numbers, not collapsed into an Out of Scope line, which is what must_not 2 forbids; the finding is one entry covering three locations rather than three entries, and the cost is stated concretely as a half-translated screen in French. must_not 3 holds: the fix routes through the project's own lookup call and adds keys to the existing asset files. The report passes check-report.mjs. |
| `11-unresolved-dependencies` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four and all four must_nots. pub get fails on an unreachable internal git dependency, and the Verification section names the command, the host and the exit code. No diagnostics existed to mine, and the report says so instead of implying the commands ran. The audit continues on static reading plus the scanner, with 19 findings, and findings that would need a resolving analyzer say so and keep their locations. must_not 1 holds because no diagnostic count is quoted as a quality measure — the run states plainly that the analyzer never saw the file. The report passes check-report.mjs. |
| `12-rerun-rejudges` | 2026-09-22 | `1.7.0` | **PASS** | 5/5 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Five of five and all four must_nots. The seeded August report is found and opened with a Since last pass table that gives a row to every inherited finding. CC-002 keeps its number and is re-judged: Confidence drops to Low, it moves from Functions to Naming, and the earlier pass's retry-button costing is withdrawn in as many words as a runtime claim about a caller that exists nowhere. CC-003 is withdrawn on evidence — the earlier "two dead files" came from a text search, a directory listing settles it at zero, and the changed count is stated rather than quietly matched. The previously misfiled "no tests" observation is promoted into the findings as CC-006. New findings start at CC-004, past the highest inherited id. All seven principle rows are present, including honest zeros. The report was written beside the seeded one under docs/reviews/ and passes check-report.mjs. The report was written to docs/reviews/CLEAN-CODE-AUDIT-profile-2026-09-22.md in the run's project, and is kept with the run record under D:/eval-records/baseline-1.7.0/. |
| `13-architecture-and-clean-code` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four and all three must_nots. The reply's first paragraph names both halves and hands the Clean Architecture work back before the report starts, so nobody can read the report as the migration being done. The clean-code half is delivered in full: 19 findings across all seven areas. Expectation 4 is met precisely by the batch that moves pricing and formatting off the State class while saying, in the batch itself, that it stays inside features/orders and creates no domain, data or usecase layer. Recorded, not scored: check-report.mjs fails with six problems — the title reads "REFACTOR (proposed)" rather than the template's three words, and five batches, four of them behaviour-change batches, describe their hunks in prose rather than a fenced diff block. |
| `14-performance-and-clean-code` | 2026-09-22 | `1.7.0` | **PASS** | 3/3 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Three of three and all four must_nots. The performance half is handed back in the first paragraph for want of profiling evidence, and the three constructs most likely to be behind it are listed under Out of Scope unfixed, so the half is set aside visibly rather than dropped. must_not 2 holds: the report names no root cause and says outright that whether the recomputation is the jank is a profiling question. Expectation 3 is met in the form the scenario allows — the repeated subtotal computation is reported as a duplication cost, and this time the count is right: six times per build, which is the number 1.6.0's run of this scenario got wrong. must_not 4 holds; every finding carries exactly one Confidence. Recorded, not scored: check-report.mjs fails on four batches with no diff block. |
| `15-state-migration-and-clean-code` | 2026-09-22 | `1.7.0` | **PASS** | 3/3 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Three of three and all three must_nots. The Riverpod migration is handed back in the first line, and the Out of Scope table repeats it as a pattern switch with different evidence. The clean-code half covers every item expectation 1 names: CC-004 for the hidden write in getTotal(), CC-006 for the three identical money rows with the scanner's measurement cited, and CC-010 for the repeated padding literal. Judgment stays inside the Provider design as it stands, and no finding exists only under Riverpod. This is the one report of the five batch-carrying runs that passes check-report.mjs outright. |
| `16-runtime-bug-and-clean-code` | 2026-09-22 | `1.7.0` | **PASS** | 4/4 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. Four of four and all three must_nots, and the scenario moves from PARTIAL at 1.6.0 to PASS. The 1.6.0 gap was that the late field was reported without naming the failure it invites; CC-009 now names LateInitializationError explicitly and says the compiler cannot warn about it. The crash diagnosis is handed back in the first paragraph, and the report keeps the two apart plainly: the setState-after-dispose paths are reported as code-visible ownership defects and called crash candidates, with "whether it is your crash, only the stack trace says". must_not 2 holds on that sentence. must_not 3 holds: the swallowed catch and the identity comparison are both reported rather than withheld for being bugs. Recorded, not scored: check-report.mjs fails with three problems — the title reads "REFACTOR (patches unapplied)" instead of the template's form, and two batches carry no diff block. |
| `17-activation-on-a-mixed-request` | 2026-09-22 | `1.7.0` | **PASS** | 2/2 expectations | First run of the isolated re-baseline: the skill was loaded from the evaluation install and no scanner outside it ran (check-run.mjs), the environment of the launching session was cleared, effort was xhigh as in every 1.6.0 run, and auto-memory was off. The 1.6.0 verdicts are not the comparison for this run — they were taken with the whole repository visible, and with reference examples written from these very fixtures. The skill activated on the description alone. The query named neither the skill nor a slash command, and check-run.mjs records a Skill call and the injected base directory pointing at the evaluation install, so expectations 1 and 2 are met and this run counts as a hit rather than a miss. Expectations 3 and 4 are instructions to the grader, not behaviour to grade, so they are not counted. The reply hands back the Riverpod migration first and then delivers a 12-finding audit with seven unapplied batches, which is the conduct scenario 15 owns and this one does not grade. Recorded, not scored: check-report.mjs fails on two problems — CC-012 carries no Effort, and Batch 7 has no diff block. |

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
