# Changelog

Every entry is a tag. `metadata.version` in `SKILL.md`, the newest heading here, and the git tag
always name the same release — `scripts/validate-skill.mjs` refuses a mismatch.

A release is cut when it is worth installing, not only when `SKILL.md` changes: whoever pinned
the last one is holding whatever it shipped until the next. See the bump table in
[AGENTS.md](AGENTS.md).

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
