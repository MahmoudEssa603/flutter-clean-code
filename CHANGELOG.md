# Changelog

Every entry is a tag. `metadata.version` in `SKILL.md`, the newest heading here, and the git tag
always name the same release — `scripts/validate-skill.mjs` refuses a mismatch.

A release is cut when it is worth installing, not only when `SKILL.md` changes: whoever pinned
the last one is holding whatever it shipped until the next. See the bump table in
[AGENTS.md](AGENTS.md).

## [1.7.0]

### Fixed
- `scripts/check-evals.mjs` said nothing about the surface moving under the version it declares,
  for the whole of every development cycle. The check compares the tree against tag
  `v<version>`, and between two releases that tag does not exist yet, so the comparison returned
  "cannot tell" and the caller — which only knew how to name scenarios — printed nothing. Silence
  there reads as a clean bill of health on exactly the days the surface is being changed. The
  message is a function now, `surfaceNote`, with all three of its answers tested: moved, unmoved,
  and cannot tell. It replaces `verdictsOnMovedSurface`, which could return only the first two.

- `scripts/check-report.mjs` now scores the batches, half of 1.6.0's known gap on diff hunks.
  `references/report-template.md` gives every batch its own `### Batch N — <type>` heading and a
  fenced `diff` block, and nothing checked either. A Batches section with no batch heading now
  fails, because that is the shape the failing runs wrote: `02`, `13`, `15` and `16` put every
  batch in one table, so a check that only looked inside `### Batch` sections would have passed
  all four. Every batch heading needs a `diff` block before the next heading, whatever its Status.
  Headings are read outside fenced blocks, because `16`'s diff opened with `# Batch 2 — Rename`.
  Arabic headings are matched by key word. Rebuilt from their transcripts, the four reports each
  fail with this one message, and `03` and `17`, which followed the template, still pass. No
  verdict moves: a run is never re-graded against a checker changed after it. The other half, the
  rule living only in the template, waits for the 1.7.0 measurements to show whether it is still
  missed.

- The maintenance scripts ignored flags they did not know, and ran their default instead.
  `make-eval-projects.mjs <dir> --only <id> --verify-clean`, one letter from a flag in the 1.7.0
  plan, rebuilt the project it was asked to check, deleting the run's edits before they were
  graded, and exited 0. `make-baseline.mjs --json` rewrote the stored baseline. All six now exit
  1 on an unknown flag before doing anything, and a test sweeps them. `scan-dart.mjs` is left as
  it is: it is the one script a run executes, so changing it moves the surface every verdict
  describes.

### Changed
- **The skeleton names every heading (D7).** D6's enumeration listed the title, the header lines,
  `## Summary`, the finding sections and the batches — and left out `## Findings`,
  `## Out of Scope` and `## Verification`. On the release-candidate sweep three runs wrote no
  `## Findings` and no `## Verification` heading, none of which had done that before. The
  enumeration is the format: what it leaves out, the report leaves out. It now names the four
  headings in order, with the batches in their place among them. Same lesson as D6, one level
  down, and the reason the sweep exists.

- **Step 6 states the report's skeleton, not only its title and its batches (D6).** The full
  sweep of the seventeen scenarios measured D5: passing the contract went from four of sixteen to
  eleven, and five went the other way. Four of those five never opened
  `references/report-template.md`, so the only thing carrying the format was `SKILL.md`'s own
  words — and D5 had replaced "its Impact, its Effort, its Confidence" with "its three ratings"
  and dropped "in the header" from the `Not checked` line. Working from memory, `09` then put all
  three ratings in the finding's heading and left out the header lines and the Summary table
  entirely, where the same scenario had passed cleanly before. Step 6 now names the skeleton in
  order — title, the five header fields, the Summary table, each finding as its own `### CC-nnn`
  section with four labelled fields carrying one value each, then the batches — and says that
  ratings folded into a heading is a different report. Five paragraphs in Steps 5 and 6 were
  compressed to pay for it; the body is still 500 lines and no rule was dropped. Re-run, the five
  that regressed all pass, and the two controls that were already passing still do. The evidence
  is `03` and `09`: both passed **without opening the template at all**, which is the path D5 had
  broken. The other three read it this time where they had not before, so their improvement is
  confounded and is recorded rather than counted. Measured in `evals/report-contract.md`.

- **One repeated literal is one signal now (E2).** `scan-dart.mjs` printed a line per occurrence,
  so `EdgeInsets.all(17)` filled nine of the fixture's twenty-three signals and the padding in
  `build()` outranked the missing `dispose()`. Over the compliance baseline and the 24 A/B runs,
  `literal` was 242 of the 430 signal lines printed and the report cited 31% of them, where every
  structural signal ran between 94% and 100%; on the holdout's real files it was 30 of 51. The cost
  showed up as arithmetic: of the nineteen runs that stated how many times the value appears, six
  got it wrong, while listing the right nine lines underneath. Repeats now collapse into one
  signal that states the count and every line — `EdgeInsets.all(17) x9 — lines 122, 137, …` — and
  a value seen once prints exactly as before. The fixture falls from 32 signals to 20 with nothing
  lost, and the baseline is re-recorded in this change. Whether reports get the count right after
  it is the re-run, not a claim made here.

- **`SKILL.md` states the report contract's two most-broken rules, instead of leaving them to
  the template (D5).** The isolated re-baseline measured where reports actually fail: six of the
  eight runs that proposed batches wrote them as a table with no `### Batch` heading and no
  fenced `diff` block, and two wrote a title like `REFACTOR (proposed)`. Both rules existed only
  in `references/report-template.md`, which a run reads once at the start. Step 6 now carries
  them: the title line and its exact form, and a heading plus a `diff` block per batch, with the
  reason — nobody approves a hunk they cannot see. The body stays at 500 lines: four paragraphs
  in the same step were compressed to pay for it, and no rule was dropped to make room. Re-run,
  the six batch-proposing scenarios go from twenty-three contract problems to none, and both
  malformed titles come back in the required form. Over all seventeen, passing went from four of
  sixteen to eleven — and the five that went the other way are what D6 above answers. Measured in
  `evals/report-contract.md`; the rule is kept.
- **The skill no longer carries the answers to its own evals.** `references/example-report.md`
  was a full eleven-finding audit of `evals/fixtures/order_summary_page.dart` — the file three
  scenarios review — with that fixture's line numbers, and it named the path on its first line.
  `dart-examples.md` and `test-quality.md` were built from the fixtures the same way, and
  `SKILL.md` used the page's own misnamed `getUser()` as its example of a misleading name. A run
  on those scenarios could read its answers instead of finding them, so the 1.6.0 verdicts on
  `01`, `07` and `16` may overstate what the skill does on code it has not seen. Every example
  now lives in a travel-booking domain, with different names, values and defects; what each one
  teaches is unchanged, and the worked report is a new audit, ordered by impact and then effort
  as `SKILL.md` requires. A scan of every identifier, string and colour in the Dart fixtures
  against `SKILL.md` and `references/` finds only SDK names and the general `copyWith` rule.
  `AGENTS.md` carries the rule that stops it coming back.
- `scripts/check-evals.mjs` counts `scripts/scan-dart.mjs` as model-facing, beside `SKILL.md`
  and `references/`. `SKILL.md` tells every run to execute the scanner and cite its numbers, so a
  change to its signals changes what a run reports while no Markdown file moves. Without this, a
  scanner change would leave every verdict marked current. The other scripts stay outside: no run
  is told to use them, and a measured run cannot see them.

### Added
- `scripts/check-fixture-reuse.mjs` checks that no example is built from an eval fixture. That
  rule was written into `AGENTS.md` the day the examples were moved out of the fixtures, and it
  asked for a scan nothing performed. It compares only what is distinctive — a name of two or
  more words, a string of two or more words, a colour, a number nobody picks twice — so a fixture
  calling `build` or declaring `total` shares a word with the language, not with an example, and
  an SDK name like `copyWith` is exempt by name. The tree as it stands shares nothing. Run
  against the commit before the examples were moved, it reports 46 reuses of 15 tokens, among
  them the method name `SKILL.md` used for its own misleading-name example, `_SectionGap`,
  `OrderStatus`, the fixture's brand colour and its odd `17` padding. CI runs it on both
  platforms.

- `scripts/check-dart-examples.mjs` asks the Dart SDK whether every snippet in `SKILL.md` and
  `references/` parses. The checklist has asked for valid Dart 3 since the first release and
  nothing enforced it, which mattered the moment every example was rewritten to get the eval
  fixtures out of them. A snippet is a fragment, not a file, so each is parsed as a file, as class
  members, as statements, as a clause without its `try` and as a list of expressions, whole and
  then part by part, with `...` elisions filled in; it passes under any one reading and a typo
  parses under none. Run over the 84 snippets as they stand, all 84 parse. Syntax is all it
  answers — resolving the names would mean shipping a project to resolve them against. Without
  `dart` on PATH it says nothing was checked and does not report a pass. `AGENTS.md`,
  `CONTRIBUTING.md` and `test/README.md` also stopped pointing at a fixture header comment that
  was deliberately deleted: the planted defects are listed in `evals/README.md`, because a fixture
  that announces it is one measures nothing.

- `scripts/check-run.mjs` also refuses a run that said nothing after its last tool call. An
  interactive calibration run restarted itself mid-way and produced no report, and every other
  check passed it: the skill had loaded from the right install and no forbidden scanner ran. A
  run that never answered is not a run. Five existing tests had transcripts ending on a tool
  call, which is not a shape a finished run has; they now end with an answer.
- `scripts/check-run.mjs` checks a measured run from its transcript. A WITH run must have
  loaded the skill from the evaluation install, and every scanner it executed must be that
  install's. `SKILL.md`'s fallback searches `~/.claude/skills` first, which in the 1.7.0 layout
  holds the stable release, so a run could measure the wrong scanner and look normal doing it.
  Paths are resolved, not pattern-matched: `~`, shell variables and relative paths, because at
  1.6.0 two runs wrote the `~` path literally and two went through a variable. A path it cannot
  resolve holds the run for a person. A WITHOUT run must show no Skill call, no injected skill,
  no `CC-` id and no scanner. It also records the model, version, entrypoint, timestamps, tool
  calls and usage, counting each API message once although the transcript repeats it per content
  block. Run over the seventeen 1.6.0 transcripts, it resolved every path, including both
  variables, and found that `06` ran the scanner from the repository path rather than the
  install. At 1.6.0 that was the same file through the junction; in an isolated install it would
  not be.
- `make-eval-projects.mjs --only <id> --diff` prints what a run changed in its project, as a
  unified diff against a fresh layout of the same scenario, leaving out the build output
  `--verify` already ignores. A scenario with a repository also gets its `git status
  --porcelain`. `--verify` could only say that a project drifted. Whether an edit was unsafe,
  unnecessary or out of scope is decided from the workspace, not from the run's account of
  itself, and that needs the edit. No pristine copy is kept on disk, because a copy beside the
  project is one more thing a run could find.

## [1.6.0] — 2026-09-18

### Fixed
- `scripts/check-report.mjs` could not read an Arabic report. It demanded English section
  headings and English finding labels while `references/report-template.md` says prose, headings
  and table cells translate — so the suite's one Arabic scenario failed the contract checker with
  83 problems, and had since the checker existed. The same defect as the re-run heading at 1.5.0:
  a check enforcing what no model-facing file asks for. Sections, the four finding labels and an
  Arabic article in front of an English term (`**الـ Conventions:**`, which a real run wrote) are
  all accepted now, with a test covering a fully Arabic report end to end.
- `scripts/check-report.mjs` still rejected the next Arabic report, and silently passed a part of
  every Arabic one. The Not checked field was matched against five listed spellings, and `03`,
  answered in Egyptian Arabic, wrote a sixth — `**اللي ماتفحصش:**` — so a present field was
  reported missing. It is matched by root now (ف-ح-ص or راجع, diacritics allowed), which covers
  negation and dialect without a list to outgrow. The Summary row count looked for `## Summary`
  alone, so a dropped principle row in an Arabic report was never caught; it uses the section's
  spellings now. Its end-of-text anchor was `\Z`, which JavaScript reads as a literal `Z`.
- `scripts/check-report.mjs` ran out of spellings a third time. `06`, also in Egyptian Arabic,
  wrote `**مستوى الأدلة:**`, `**قواعد المشروع:**` and `## برّه النطاق` — two words the Evidence
  list held separately but never together, a Conventions label it did not hold at all, and the
  dialect's `برّه` for "outside". All three fields were present and failed as missing. Evidence,
  Conventions and Out of Scope are matched by their key word now, as Not checked already was, and
  a test carries the three labels exactly as that run wrote them.
- `make-eval-projects.mjs --verify` exempted `docs/reviews/`, so a report left behind by the last
  run counted as nothing. It is not nothing: `SKILL.md` sends every pass to that directory for the
  newest previous report before it writes one, so the leftover is read by the next run and turns
  an ordinary scenario into a re-run. Four of the seventeen laid-out projects were carrying one —
  `05`, `07`, `13`, and worst `12`, which seeds a deliberately weak report as its input and had
  the previous run's corrected report sitting beside it, newer. A re-run of `12` would have
  re-judged the last run's answer instead of the seeded one and looked entirely plausible doing
  it. `--verify` called all four clean. The exemption now covers build output only, the seeded
  report is tracked in the manifest, and the projects have been rebuilt.
- The bug-line paragraph said a shape-visible defect is "why the finding is High" where both
  scales have a High, one paragraph away from the Confidence rule that two runs then collapsed.
  It says High-impact now, as `:284` already did; the package-or-app rule is spelled the same way.
- Confidence collapses to High on one shape, and the scale now names it. `SKILL.md:376` said
  High when the code proves it and Low when the judgment turns on intent you cannot see, which
  three runs read as a licence to rate the easiest half of their own claim. `09` and `12` each
  wrote that the body cannot say which of a name and its body is wrong, and rated the finding
  High anyway; `14` rated one finding `High (the name) / Low (the intent)`, inventing a second
  value because nothing said which to record. The scale now covers the case directly: when the
  body proves something is wrong but not which side of it is, the claim being made is which
  side, and it stays Low however plain the defect. Where the rule already worked — a judgment
  waiting on a file outside scope — it is unchanged, and `01`, `05` and `15` were right there.
- `scripts/check-report.mjs` reads Confidence to the end of its line instead of taking the first
  word, so `High (the name) / Low (the intent)` is rejected rather than recorded as High. The
  checker had endorsed the contradiction it existed to catch. `SKILL.md`'s exit criteria now say
  one Impact, one Effort and one Confidence per finding, so the check enforces a stated rule
  rather than one only the script knew — the same defect this repository fixed in the re-run
  heading at 1.5.0.
- `scripts/check-evals.mjs` asks git whether the surface moved, not only whether the version
  string did. A verdict names a version, and a version moves at a release, so any edit to
  `SKILL.md` between two releases left seventeen verdicts describing a file no longer in the
  tree with nothing able to report it: the staleness check returned before it ever reached the
  question. It now runs whether or not the number moved, and says which verdicts are unverified.
  Printed, never fatal — re-running is the maintainer's call, hiding the need is not.

### Changed
- Scenario 01's third expectation said a 120-line `build()`; it is 118 lines, :111 to :228.
- Scenario 03's fifth expectation asked for a six-area audit; `SKILL.md` has seven areas and
  checks all seven every run.
- Scenario 13 declared `mode: AUDIT` while its query says "Refactor this Flutter app". The run
  chose REFACTOR route 2 — patches proposed, not applied — which is what Rule Zero asks for on a
  project with no tests, and the grading note had to explain the mismatch rather than read it.
  `02` sets the precedent for a refactor query. The field now says REFACTOR, and `evals/README.md`
  documents what `mode` means, which it never did: it is what the query was written to produce,
  and nothing scores it unless an expectation says so.
- `evals/README.md` documented the `docs/reviews/` exemption as settled fact, so the wrong
  rule was written down in two places rather than one.
- `references/monorepo-scope.md` spelled the package-or-app severity as bare `High` where
  `SKILL.md` now says `High-impact`. Same rule, same sentence, two files.
- Scenario 14 carries a fourth `must_not`: one finding rated at two confidences. That is where
  the split rating was found, and nothing there measured it. It is not scored against the
  recorded run, which predates the rule — the re-run is where it counts.
- Scenario 11's second expectation describes what its fixture actually does. It asked for a wall
  of `undefined_class` cascading from unresolved packages to be recognised and not mined; this
  project never produces one, because `pub get` fails on the git dependency and `analyze` aborts
  before emitting anything. The wall belongs to the scenarios whose pubspec merely declares no
  dependencies — `02`, `07`, `13`, `14`. The requirement behind it, that nothing from a broken
  resolution becomes a finding, is unchanged and was already met, so the PASS stands.
- Scenarios 09 and 12 stop demanding a handback `SKILL.md` never asks for. Both required
  `reload()` — a method whose name promises a refetch while its body returns without one — to be
  handed back under Out of Scope. Read together, the skill says the opposite three times: the bug
  line at `:79-85` hands back only a defect reachable solely by running the code, and this guard
  is in plain sight; `:236` makes a name its body contradicts a finding outright, in the same
  shape as the `getUser()` that writes to cache; and the uncertainty that is left — whether it is
  a broken refetch or a misnamed cache — is intent you cannot see, which `:376` puts at
  Confidence: Low as a question and `:172` refuses to let you drop. So both scenarios now expect
  the finding reported at Low confidence, and 09 additionally expects the two ratings to differ,
  which is the line it exists to watch. The runs were right to report it and wrong to rate it
  High, and both verdicts stand: `09` FAIL at 2/4, `12` PARTIAL at 4/5. No model-facing file
  changed, so no scenario was re-run. Scenario `09-bug-line` keeps its id: its first two
  expectations are still the bug line's own clause, that a defect visible in the shape of the
  code is the skill's to report. The far side of that line is measured by
  `16-runtime-bug-and-clean-code`, whose fixture carries a crash no reading can diagnose.
- Scenario 09's second `must_not` forbade presenting the run-only defect with an Impact, Effort
  and Confidence — a prohibition resting on the same premise, and recorded broken on the strength
  of it. It now forbids the claim this fixture genuinely cannot support: what `reload()` costs a
  caller, when no caller is in scope. The run asserts nothing of the kind, so 09's `must_not`
  tally moves from one broken to all held while its verdict does not move.
- `evals/README.md` described the `customer_profile.dart` fixture as holding one defect on each
  side of the bug line, and the seeded previous report as carrying one finding that belongs in
  Out of Scope. Both descriptions followed the expectations rather than the rules.
- All seventeen scenarios were run by hand against this surface and recorded in
  `evals/results/`: fifteen PASS, two PARTIAL (`01`, `16`) and no FAIL, each with what fell
  short written down. `09` moved from FAIL to PASS and `12` and `02` from PARTIAL to PASS; `01`
  moved from FAIL to PARTIAL; `16` moved from PASS to PARTIAL, reporting the `late` field without
  naming the `LateInitializationError` it invites. No verdict in the table was graded against an
  older surface.

### Known gaps
- A REFACTOR report is meant to carry each proposed batch's key diff hunks, and four of the five
  runs that proposed patches did not: the batches lived only as patch files in a temporary
  scratch directory, or were never written out one by one. Where the files survived, every patch
  applied and its tests passed. The rule is stated only in the report template and nothing
  scores it; both are for the next release.

## [1.5.0] — 2026-09-12

### Fixed
- Activation and conduct are measured separately. Every scenario used to test both: a run that
  never loaded the skill still produced a reply, and that reply was then graded against rules it
  had never seen — three times, and each time the description was retuned as though a rule had
  failed. Fifteen scenarios now name the skill with `/flutter-clean-code` and measure what it
  decides; `04-negative-trigger` and the new `17-activation-on-a-mixed-request` do not, and
  measure whether the description reaches it at all. A miss there costs one row instead of
  fifteen, and is read as a rate across runs rather than a verdict on a single one. Scenarios
  declare which they are in an `invocation` field, and `check-evals.mjs` prints the split.
  Activation is a semantic match against the description; no wording makes it certain, and the
  README now says so where a reader decides whether to name the skill.
- The description told the host not to load the skill for the very requests the mixed-intent
  scenarios were written to test. Its negative clause excluded "fixing bugs or crashes" and
  "changing architecture layers or state-management patterns" outright, and three of those four
  scenarios name exactly that — 13 architecture, 15 a Provider-to-Riverpod migration, 16 a crash.
  Scenario 15 came back with the migration finished: provider swapped for flutter_riverpod in
  pubspec.yaml, six files added, and no artefact of the skill in the reply. The clause now
  excludes non-Dart code and lint rules, and says a request that also asks for one of those is in
  scope for its clean-code half with the rest handed back — which is what the Out of Scope
  machinery, the Step 0 triage and those four scenarios have all along assumed.
- Scenario manifests live beside the projects, in `.eval-manifests/`, not inside them. A file
  named for the scenario sitting in the project under review tells the session it is being
  evaluated, and the run of 14 cited that file's own hash as its proof that it had changed
  nothing. An agent that knows it is being watched is not the agent the scenario meant to measure.
- `scripts/make-eval-projects.mjs --verify` reports which laid-out scenarios a run has already
  rewritten, against a manifest the generator now writes. Scenario 13 was answered once by
  restructuring the fixture into four layers; the next run read those layers and reported,
  accurately and uselessly, that the work was already done. Nothing in that reply looked wrong,
  and nothing but the generator could have known. A report in `docs/reviews/`, `.dart_tool`,
  `build/` and a lockfile are what a clean pass leaves and do not count as drift.
- The generator empties a scenario directory instead of deleting it. On Windows a directory
  cannot be removed while any process holds it as a working directory, and a terminal parked in
  the folder after a run is the normal case — rebuilding failed with EPERM until it was.
- Work the skill does not own is now triaged at Step 0, before a mode is chosen, and the workflow
  checklist says so where the agent copies it. Three rules had disagreed: "What it does not own"
  put layer boundaries and module structure flatly outside the skill, Step 4 forbade rewriting a
  feature "unless explicitly asked", and the Clean Architecture paragraph said layer changes were
  out of scope "unless the change is local and behaviour-preserving". A request to restructure
  asks explicitly, so two of the three licensed what the first forbids. Scenario 13 carried out
  the whole migration twice — the first time announcing it, the second reporting the scaffold it
  had just built as having been there all along. Moving the rule was the fix: it had sat in Step 4,
  which is REFACTOR-only and read after mode, scope, measurement and prioritisation are settled,
  while the decision it governs is made at Step 0, which had no triage of the request at all.
- `scripts/check-report.mjs` exempts a re-run from the numbering checks, because a re-run keeps
  the ids it inherited and a gap there is the rule working. It recognised a re-run only by the
  literal heading `## Since last pass`, a wording no model-facing file states — `SKILL.md` asks
  for a Since-last-pass table and leaves the heading to the report. A real re-run wrote
  `## Since the last pass`, retired a withdrawn finding's number exactly as the rule asks, and
  was failed for the gap. It now matches the shape of the heading, and its test uses the wording
  a run actually produced rather than the one the regex wanted.

### Changed
- Scenario 09's third expectation gives the reason its handback actually rests on. It said that
  reaching `reload()`'s early return means following the flow at runtime; the guard is in plain
  sight, and a pass can run code. What puts it out of reach is that nothing in scope decides
  whether it is a defect. Scenario 12's third expectation now names the finding that moves into
  Out of Scope, which it had left to be inferred. Neither target moved.
- The install instructions pin to the current release instead of 1.3.1.
- `test/README.md` listed two of the six test suites, so four suites and sixty of the
  ninety-eight tests went undocumented. It also asked for three things when adding a scanner
  signal where `CONTRIBUTING.md` asked for four — the same requirements, counted two ways, in
  a repository that treats a rule stated twice with different content as a defect.
- All seventeen scenarios were run by hand against this surface and recorded in
  `evals/results/`: thirteen PASS, two PARTIAL (`02`, `12`) and two FAIL (`01`, `09`), each
  with what fell short written down. No verdict in the table was graded against an older
  surface.

## [1.4.0] — 2026-09-07

### Added
- `references/monorepo-scope.md`, and a Step 1 trigger that reaches it. A repository holding
  several packages gets a rung above module, one scanner run per package, and a report path
  carrying the package name so two modules called `auth` do not overwrite each other.
- The per-package analyzer rule. The Dart analyzer uses the **nearest** `analysis_options.yaml`
  and does not merge the ones it passed walking up, so a package with its own file is governed by
  that file alone even under a stricter root. Reading the root file for such a package drops
  findings the analyzer never reports. Its `exclude:` globs resolve against the directory that
  declares them, which is the same mistake in the other direction.
- `evals/results/` as the one source of eval verdicts, with `PASS` / `PARTIAL` / `FAIL` /
  `NOT_RUN` semantics that `scripts/check-evals.mjs` enforces — migrating the old prose table
  under them turned one recorded pass into the PARTIAL it always was.
- `scripts/generate-eval-summary.mjs` renders the results table, checked in CI against the
  records so the two cannot drift.
- `scripts/make-baseline.mjs` records what the deterministic tooling reports, so a later change
  can be compared against it rather than argued about.
- Four mixed-intent scenarios: a real clean-code job wrapped in a request for architecture,
  performance, a state-management migration, or a crash fix. Both failure directions are named,
  because refusing the whole request is as wrong as absorbing the half that is not yours.
- `scripts/check-evals.mjs` reports which verdicts were graded against an older version, and asks
  git whether any model-facing file actually changed since — so a stale PASS says so instead of
  reading like a fresh one. It compares content rather than filenames, because every release moves
  the version line and a warning that fires every time is a warning nobody reads.

### Fixed
- Step 4 forbade rewriting a feature and switching the state-management pattern "unless explicitly
  asked", while "What it does not own" put layer boundaries, dependency direction and module
  structure flatly outside the skill. A request to restructure to Clean Architecture asks
  explicitly, so the second rule licensed what the first forbids — and scenario 13 came back with
  the migration carried out: four new layers, six authored types, a composition root, a state
  library swapped in, and Rule Zero abandoned with behaviour changes applied rather than proposed.
  Asking now unlocks nothing this skill does not own; the pass runs inside the design as it stands.
- The description's "Use when" clause named neither **audit** nor **refactor** — the two verbs
  in the skill's own first sentence, and one of them a mode name. Activation was effectively keyed
  on the literal phrase "clean code": every eval query carrying it fired, and the two that did not
  fired sometimes and not others. Scenario 07 came back as a competent generic code review with no
  mode, no CC- ids, no summary table and no scanner run, because the skill never loaded. Found by
  running the evals, not by reading the file.
- `scripts/check-evals.mjs` now reports any scenario query sharing no word with that clause. It
  found the `refactor` gap immediately after the `audit` one was closed. It reports and never
  fails: two scenarios deliberately pair a trigger with an exclusion, and tuning the description
  until every query lights up would be fitting it to its own tests.
- Six scanner detectors read the raw source while every structural one read the sanitized copy,
  so a Dart string quoting an example reported as the thing it quoted. A file whose whole content
  was a documentation string produced four signals that did not exist.
- `publish_to: none` was read as proof of an application, which silently dropped public-API
  findings across every internal package. Classification now reads platform folders and barrel
  exports, and unsure is a third answer raised as a Low-confidence question.
- The deterministic baseline recorded the validator's directory-name NOTE, so any clone into a
  folder not called `flutter-clean-code` — every fork, every rename — failed with "the tooling
  reports something different" printed above two identical signal counts. The baseline records
  what the validator decided, not where the repository sits.
- `allowed-tools` named only `~/.claude/skills/` while the README documented four install paths.
  Anyone who installed under `~/.agents/skills/` or `~/.gemini/config/skills/` had the scanner
  refused by permissions, which the skill would then report as "scanner did not run". It landed in
  the tree before 1.3.2 was tagged but was never written down; it ships here.
- Three places promised every batch reverts on its own, contradicting the stack rule added in
  1.2.0 three paragraphs below one of them.
- Step 3 stated the 20-finding cap twice, and only the second copy carried the "state the
  remaining count" clause, so the rule was complete only if you read both.

### Removed
- The machine-readable JSON paragraph in Step 6, which repeated `references/report-template.md`
  in full and was a second copy to keep in sync.

### Changed
- `AGENTS.md` records the body cap as ≤ 500 lines, which is what the validator has always
  enforced and what it prints.

## [1.3.2] — 2026-09-01

`SKILL.md` byte-identical to 1.3.1. Released for the documentation, because 1.3.1 shipped install
instructions that named `<repo-url>`, never said a clone does not update itself, and pointed at a
setup guide that had drifted.

### Changed
- README draws a pass as a diagram, gathers every command into one table, and says what to hand
  over instead of repeating the trigger phrases the frontmatter already carries.
- `AGENTS.md` says what "installed shape" means, so deleting a stale guide is a patch and renaming
  `references/` is major, and says a release may be cut when `SKILL.md` has not changed.

### Removed
- The Arabic setup guide. All eight of its sections were in the README, in English, and current;
  it had drifted to seven scenarios where there were twelve.

## [1.3.1] — 2026-08-31

### Fixed
- The scanner path told the agent to resolve the skill folder "from this file's own path", which
  assumes the host says where that is. Antigravity does not, so the measuring step was skipped in
  silence — twice. Step 2 now gives a way to find the scanner without knowing where you are.
- A getter shadowing `Enum.name` was handed back as needing a run to confirm. The bug line gained
  the test it was missing: the defect being visible is what decides it, not having watched it bite.

### Added
- The report states whether it measured or estimated. Added to the template first, then enforced
  by `check-report.mjs`.

## [1.3.0] — 2026-08-31

### Added
- `scripts/check-report.mjs` — checks a finished report against the parts of the contract that
  need no judgment: header fields, the seven principle rows, id continuity, three valid
  judgements and a location on every finding, the cap. It prints what it does not measure.

### Fixed
- Written against the real reports on hand, which corrected it three times: not every defect has
  a line, headings carry qualifiers on a re-run, and a re-run keeps the ids it inherited.

## [1.2.1] — 2026-08-31

### Fixed
- Scanner path resolution and the bug-line test, found by the first run outside Claude Code.

## [1.2.0] — 2026-08-31

### Removed
- The Cursor adapter added in 1.1.0. Cursor, Codex and Antigravity read the Agent Skills standard
  natively, so one folder under `~/.agents/skills/` is discovered by all of them. Packaging the
  skill as a Cursor rule was a downgrade: a rule loads as one blob, losing the on-demand reads
  the skill is written around.

## [1.1.0] — 2026-08-30

### Added
- A Cursor adapter, built on incomplete research. Removed in 1.2.0.

## [1.0.0] — 2026-08-30

Initial release. Three modes — AUDIT, DIFF, REFACTOR — over seven principle areas, with the
measurement scanner, the frontmatter contract validator, and twelve evaluation scenarios laid out
as runnable projects.

Calibrated against two unrelated Flutter codebases. Nine of the twelve scenarios changed a rule on
the run that first exercised them, among them the line between a defect visible in the shape of
the code and one only a run reveals, how localisation is actually detected, what an enabled lint
means when the analyzer cannot see the file, and that batches over the same lines are a stack
rather than a set.
