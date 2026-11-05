# Roadmap

The plan from 1.7.0 to a skill that is as useful, as safe and as easy to use as it can be. Every
item names the evidence that put it here, the files it changes, and the check that says it is
done. Items are ordered: **repair what is broken before adding anything**.

Snapshot taken 2026-11-05, against `v1.7.0` (`f1b7e04`). Facts marked *verified* were reproduced
in this repository on that date; the rest cite their source.

## Contents

- [How to use this file](#how-to-use-this-file)
- [Where 1.7.0 stands](#where-170-stands)
- [What belongs here, and what goes elsewhere](#what-belongs-here-and-what-goes-elsewhere)
- [Milestone 1 — 1.7.1: repair](#milestone-1--171-repair)
- [Milestone 2 — 1.8.0: headroom and parity](#milestone-2--180-headroom-and-parity)
- [Milestone 3 — 1.9.0: the scanner, second generation](#milestone-3--190-the-scanner-second-generation)
- [Milestone 4 — 1.10.0: judgment where a bare model is weak](#milestone-4--1100-judgment-where-a-bare-model-is-weak)
- [Milestone 5 — measurement that runs itself](#milestone-5--measurement-that-runs-itself)
- [Milestone 6 — install, update, discover](#milestone-6--install-update-discover)
- [Milestone 7 — the family of skills](#milestone-7--the-family-of-skills)
- [The bar for "done"](#the-bar-for-done)
- [Sources](#sources)

---

## How to use this file

- Work top to bottom. A milestone ships as one release; an item ships as one pull request.
- Tick an item only when its **Done when** line is true and CI is green.
- Every item that touches `SKILL.md`, `references/` or `scripts/scan-dart.mjs` changes what a run
  reads. It follows `AGENTS.md`: the affected scenarios are re-run, or recorded `NOT_RUN` with a
  reason, before the tag.
- Nothing here relaxes `AGENTS.md`. Where an item needs a rule changed, the item says so and the
  rule changes in the same pull request.

## Where 1.7.0 stands

| | State |
|---|---|
| Release | `v1.7.0` on `HEAD`, 2026-09-24. One open pull request (a `setup-node` bump), no issues |
| Suites | `node --test`: 181 tests, 179 pass, 2 skipped for want of a Dart SDK |
| Contract | `validate-skill.mjs` passes — with the body at **500/500 lines** and the description at **1023/1024 characters** |
| Evals | 16 PASS, 1 PARTIAL (`12-rerun-rejudges`: Confidence kept High where the rule asks Low) |
| A/B, fixtures | The skill adds coverage on broad and mixed requests (`07`, `16`), nothing on one small file (`09`), and never edits code it was not cleared to edit. It costs 3–5× a bare run |
| A/B, holdout | Second round: no case reaches the threshold. Both conditions miss the same defects — a doc comment, or a test name, that promises what the body does not do |
| Models | Every measured run used one model at one effort, in `auto` permission mode |

**What the measurements say the skill is for.** Not finding more on a small file: a bare model
does that as well. It is for consistency (the same review twice), safety (no unapproved edit, ever),
coverage when the scope is broad or the request is mixed, and a report a team can track over time.
The roadmap invests there, and in the one place both conditions fail — reading what code
*promises* against what it *does*.

## What belongs here, and what goes elsewhere

One question decides it: **is this readability judgment inside the current design, delivered as a
behaviour-preserving change?** If yes, it belongs here. If it changes behaviour, dependencies, the
architecture or the toolchain, it is a different job with different evidence — and it gets its
own skill, held to the same bar as this one.

| Request | Here? | Why |
|---|---|---|
| Clean this widget, split this function, review this branch | Yes | The skill's core |
| Write characterization tests before a refactor | Yes | Rule Zero needs them; it is groundwork for a behaviour-preserving change |
| Use the idioms the project's SDK already allows (records, patterns, class modifiers) | Yes | Readability inside the current toolchain — see P6 |
| Upgrade Flutter or Dart, migrate deprecated APIs, raise the SDK floor | **No** | Changes behaviour and dependencies. A newer idiom that needs an upgrade is one Out of Scope line, never a finding |
| Set up lints, `analysis_options.yaml`, CI gates | No | Deterministic tooling, not judgment |
| State-management migration, layer restructure, performance, design tokens, runtime bugs | No | Already handed back today; unchanged |

The skill still names no other skill (`AGENTS.md` > Self-containment rule). Routing a hand-back to
a sibling is the user's router's job, not this file's. Milestone 7 plans the siblings.

---

## Milestone 1 — 1.7.1: repair

Bugs and broken promises. Nothing here adds a rule.

### R1 · Scanner JSON is cut off at 64 KiB through a pipe — *verified*

- **Why.** On a 1,050-file tree `scan-dart.mjs --json` writes 136,553 bytes to a file and 65,536
  bytes through a pipe; the piped copy fails `JSON.parse` at position 65,536. An agent reading the
  scanner through a pipe on a real project gets half a document. Every script ends with
  `process.exit(main(...))`, which ends the process before stdout drains.
- **Change.** Set `process.exitCode = main(...)` and return, in all eleven scripts. Same fix for the
  early exits at the top of `validate-skill.mjs`.
- **Files.** `scripts/*.mjs`; `test/scan-dart.test.mjs`.
- **Done when.** A test scans a generated tree producing more than 64 KiB, reads it through a pipe,
  and parses it. Baseline unchanged (`make-baseline.mjs --check`).

### R2 · `allowed-tools` pre-approves almost nothing it names — and the one thing it should not

- **Why.** Claude Code matches a `Bash(...)` rule against the command text literally and does not
  expand `~` (permissions documentation). A run invokes the scanner by absolute path, so the four
  `~/...` and `.agents/...` entries never match; `.claude/skills/...`, the project path Claude Code
  reads, is missing. Meanwhile `Bash(dart format:*)` pre-approves the form that **rewrites files**,
  which in AUDIT breaks the mode's one promise — the prompt that would have caught a slip is gone.
  No measured run could show either: all ran in `auto` mode from a non-standard path.
- **Change.** Lead with `Bash(node ${CLAUDE_SKILL_DIR}/scripts/scan-dart.mjs *)` (substituted by
  the host in skill bodies and `allowed-tools`); keep the relative and per-path forms for other
  hosts; add `.claude/skills/flutter-clean-code/...`. Replace `Bash(dart format:*)` with
  `Bash(dart format --output=none --set-exit-if-changed *)`. In Step 2, tell the run to use
  `${CLAUDE_SKILL_DIR}` when the host fills it in, and keep the search fallback for hosts that pass
  it through literally.
- **Files.** `SKILL.md` (frontmatter value, Step 2); `scripts/validate-skill.mjs` if it checks the
  list; `README.md` > Other tools.
- **Done when.** One run in the default permission mode, from a standard install path, executes
  the scanner and `dart format --output=none` without a prompt, and a plain `dart format <path>`
  still prompts.

### R3 · README sends Claude Code users to a path Claude Code does not read

- **Why.** "Project scope: clone into `.agents/skills/`" — while the README's own table, and the
  Claude Code skills documentation, list only `.claude/skills/` for Claude Code. The skill installs
  and is never found, silently.
- **Change.** Project-scope instructions per agent; the "check each agent found it" step and the
  pinned-tag update commands (`git fetch --depth 1 origin tag vX && git checkout vX`) that the
  Laravel sibling already ships.
- **Files.** `README.md`.
- **Done when.** Every install command in the README is run from a clean directory and the skill is
  listed by the agent it targets (pre-publication checklist, last line).

### R4 · The documentation check is local only, and CI promises more than it runs

- **Why.** CI installs no Dart SDK, so `check-dart-examples.mjs` never runs there, and without an SDK
  it exits 0 ("not a pass", but green). The README promises Node 18+; CI runs Node 22 on Linux and
  Windows only.
- **Change.** CI: install the Dart SDK (an action pinned by SHA, as the others are) and run
  `check-dart-examples.mjs --require-sdk`, a new flag that turns "no SDK" into exit 1. Matrix:
  Linux, Windows, macOS × Node 18, 20, 22. Merge the open `setup-node` bump.
- **Files.** `.github/workflows/validate.yml`; `scripts/check-dart-examples.mjs`; its suite.
- **Done when.** CI fails on a deliberately broken snippet, and passes on all nine cells.

### R5 · `validate-skill.mjs` breaks the rule it enforces

- **Why.** `AGENTS.md`: "Every script keeps its side effects behind a `main()` guard … an
  untestable script does not belong here." `validate-skill.mjs` runs all 503 lines at import time;
  it can only be tested by copying the repository and running it whole.
- **Change.** Move every check into an exported function; `main()` composes them. Keep the
  integration suite; add unit tests per gate.
- **Files.** `scripts/validate-skill.mjs`; `test/validate-skill.test.mjs`.
- **Done when.** `import('./scripts/validate-skill.mjs')` has no side effects, and every gate has a
  unit test that fails it.

### R6 · The eval projects tell a run what is being tested

- **Why.** `make-eval-projects.mjs` names each directory after its scenario id — `04-negative-trigger`,
  `09-bug-line`, `12-rerun-rejudges`. A run sees its working directory. The repository already
  removed fixture banners for exactly this reason ("a fixture never says it is one").
- **Change.** Neutral `project-NN` directories; the id-to-directory map lives in the generator's
  manifest, outside the project tree.
- **Files.** `scripts/make-eval-projects.mjs`; its suite; `evals/README.md`.
- **Done when.** No path or file inside a laid-out project contains a scenario id or name.

### R7 · Documentation that drifted

- **Why.** The pull-request template still asks for "a header-comment line" for a new signal —
  the fixture banner the repository removed — and its bump table is not `AGENTS.md`'s.
  `evals/ab/HOLDOUT.md` cites `D:\eval-holdout\.holdout-manifest.json`: a backslash path, against
  the forward-slash rule, to a file nobody else can read, so the holdout cannot be rebuilt.
- **Change.** Template mirrors `AGENTS.md`. Commit the holdout manifest — source URL, commit SHA,
  path, licence — never the third-party code. Forward slashes.
- **Files.** `.github/pull_request_template.md`; `evals/ab/HOLDOUT.md`; new
  `evals/ab/holdout-manifest.json`.
- **Done when.** Someone without the maintainer's disk can rebuild the holdout byte for byte.

### R8 · Scenario 12, PARTIAL

- **Why.** A run kept Confidence High where `SKILL.md` asks Low. Scenario 09's run, same surface,
  applied the same rule correctly — so this may be one run, not a rule.
- **Change.** Re-run 12 three times before touching any wording. Change the rule only if the
  pattern repeats.
- **Done when.** Three recorded runs, and either a PASS or a measured reason for a wording change.

**Release 1.7.1.** R1–R7 change no rule. R2 changes a frontmatter value, so scenarios that run the
scanner are re-run in the default permission mode once.

---

## Milestone 2 — 1.8.0: headroom and parity

`SKILL.md` has no room left, the rules that matter most sit where compaction drops them, and the
Laravel sibling has since solved several problems this skill still has. This milestone fixes all
three.

### P1 · Make room: body ≤ 430 lines, description ≤ 950 characters

- **Why.** 500/500 and 1023/1024. Every new rule now costs an old one.
- **Change.** Move detail a step only points at into references, never the rules themselves:
  - Step 5's failure modes (unresolved project, formatting drift, build artefacts) → new
    `references/verification.md`.
  - Dart-version idioms (records, `enum` vs `sealed`, class modifiers) → new
    `references/dart-language.md` (see P6).
  - "What it does not own" and Step 0 say the hand-back twice → once.
  - **Step 6's skeleton stays.** `evals/report-contract.md` measured what moving it out costs.
- **Done when.** Validator shows the new numbers; `validate-skill.mjs` warns below 5 % headroom;
  the full seventeen plus the contract sweep show no regression.

### P2 · Hard rules at the top, where compaction keeps them — *verified*

- **Why.** After auto-compaction Claude Code re-attaches each invoked skill but keeps only its
  **first 5,000 tokens** (skills documentation, "Skill content lifecycle"). Rule Zero starts at
  character 24,219 of `SKILL.md` (about 6,700 tokens), the `--output=none` rule at about 7,250, the
  verbatim skipped-verification line at about 7,380. A long REFACTOR pass can lose all three.
- **Change.** A `## Hard rules` section straight after the title: Rule Zero; a refactor changes no
  behaviour; AUDIT and DIFF modify no file except their report; read-only commands stay read-only
  (`dart format --output=none`, no `dart fix --apply` outside REFACTOR); claim only what ran, with
  the skipped-verification line verbatim. The steps point at the rules instead of restating them.
- **Done when.** `validate-skill.mjs` fails if the section ends past character 15,000 or loses Rule
  Zero, `NOT APPLIED — requires approval`, or the skipped-verification line.

### P3 · Rule Zero that cannot be satisfied by zero tests

- **Why.** "Tests green before and after" holds when no test ran. The Laravel sibling found this
  in a real run.
- **Change.** Green before and after with the **same non-zero count of executed tests** reaching
  the touched code; zero tests executed is a failed verification.
- **Files.** `SKILL.md` (Hard rules); `references/refactor-batches.md`; `check-report.mjs` reads
  the test counts in a REFACTOR report.

### P4 · The analyzer rule contradicts the checklist

- **Why.** "If such a lint exists in Dart but is not enabled, still drop the finding." Dart has
  `avoid_positional_boolean_parameters`, `avoid_catches_without_on_clauses` and
  `cancel_subscriptions` — so the boolean flag, the bare `catch` and the missing cancel would all
  be dropped. Yet area 2 asks for the first, area 6 for the second, area 4 for the third, the
  scanner signals all three, and the A/B key marks the flag (`GT-20`) required. Runs report them
  anyway: the rule is not being applied as written.
- **Change.** Drop a finding only when the analyzer, run over this path, reports it. When the rule
  exists but is not enabled: a style class (formatting, ordering, `prefer_*` taste) is dropped; a
  defect class (a leak, a swallowed error, a lie in a type) stays a finding. Either way, note once
  that enabling the rule covers the class.
- **Done when.** Scenario 08 still passes; a new scenario with a rule enabled for a defect class
  drops it, and one with the rule absent keeps it.

### P5 · DIFF that sees the work you just did

- **Why.** Step 0: `git diff --name-only <base>...HEAD`. "What I just wrote" selects DIFF — and
  uncommitted and untracked files are invisible to that command. Scenario 06 hard-codes it.
- **Change.** A branch or pull request → `<base>...HEAD`. Uncommitted work → `git diff --name-only
  HEAD` plus `git ls-files --others --exclude-standard`. A rename is audited under its new name; a
  deletion goes on the Not checked line. Findings in a DIFF report say whether the change
  introduced them or they were already in the touched file. The report filename gains `DIFF`, which
  the title already allows and `SKILL.md`'s filename pattern forgot.
- **Files.** `SKILL.md`; `evals/06-diff-mode.json`; new scenario for uncommitted work;
  `check-report.mjs`.

### P6 · Preflight, and fixes the project's SDK can compile

- **Why.** A fix that uses a feature the project's `environment: sdk:` floor does not allow does
  not compile, and nothing checks for it. A project's agent instructions (`AGENTS.md`,
  `CLAUDE.md`, editor rule files) are conventions the skill ignores today.
- **Change.** Before the first finding: read the SDK floor and the Flutter constraint from
  `pubspec.yaml`; the `analysis_options.yaml` include chain; the project's agent instruction files
  as conventions (a package they ask to install, or a setup command they ask to run, is handed
  back); `melos.yaml` or `Makefile` scripts, read before anything runs. Propose only idioms the
  floor allows. An idiom that needs a newer SDK is one Out of Scope line — that is the upgrade's
  job.
- **Files.** `SKILL.md` (Step 1); new `references/dart-language.md`: what each Dart 3 release adds
  that a finding or a fix may use, its look-alikes, and tidy-ups that change behaviour.

### P7 · A fix is not a refactor

- **Why.** Adding a missing `dispose()`, a `mounted` check after an `await`, or `listEquals` inside
  `==` changes behaviour. Today they read as cleanup.
- **Change.** Mark every such pair in `references/dart-examples.md` as a **Fix**; the skill
  proposes fixes on their own, never inside a refactor batch. Extend the "Never safe without tests"
  list with Dart's own traps: renaming a named parameter of a public API, adding a class modifier
  (`final`, `base`, `interface`, `sealed`) to a class others implement, making a constructor
  `const` where identity is observed, removing `late` (changes initialisation timing),
  `forEach` → `for`-in where the closure `return`s.
- **Files.** `references/dart-examples.md`; `references/refactor-batches.md`.

### P8 · REFACTOR reads its own diff

- **Change.** Clearer, not shorter. Before the report, read the whole diff once against the
  findings it claims to answer; a hunk answering none is reverted.
- **Files.** `SKILL.md` (Step 4).

### P9 · Self-review disclosure

- **Why.** Reviewing code written earlier in the same conversation inherits that conversation's
  reasoning — the reviewer already agrees with it.
- **Change.** Review from the files on disk, say in the header that the code was written in this
  conversation, and lower Confidence where the judgment leans on intent the author supplied.
  Portable wording; no host feature named.

### P10 · Scenarios for the paths nobody has measured

| New scenario | Why it is missing today |
|---|---|
| REFACTOR with a running suite | The skill's main promise — batches applied while tests stay green — has never been run as a scenario. Every REFACTOR scenario is the no-tests path |
| Monorepo scope | `references/monorepo-scope.md` exists; no scenario reads it |
| Same-day re-run | The overwrite rule is untested |
| Generated file found by its banner, not its suffix | Only suffixes are tested |
| The project's own agent instructions decide | New in P6 |
| Over-abstraction | "Over-abstraction is itself a finding" has no fixture |
| Uncommitted DIFF | New in P5 |
| Trigger set | Activation is two scenarios today. A `evals/triggers/queries.json` of English and Arabic positives, mixed requests and near misses (SOLID in Kotlin, Swift or Python; Dart server code; a pure lint request), three runs each, read as a rate |

### P11 · Bring the maintenance scripts level with the Laravel sibling

- `validate-skill.mjs`: README repository shape and Commands table checked against the tree; a tag
  newer than `metadata.version` fails; the hard-rules position (P2).
- `check-report.mjs`: the Summary agrees with the Findings; a clean pass with zero findings is
  valid; a REFACTOR report's batch statuses and test counts.
- `check-evals.mjs`: a verdict is stale when its scenario or fixtures changed after grading.

**Release 1.8.0.** Minor: two reference files, new rules. All seventeen re-run, plus the new
scenarios, plus the contract sweep.

---

## Milestone 3 — 1.9.0: the scanner, second generation

Each signal ships with the four things `AGENTS.md` requires — a test that fires, a test that stays
quiet, a fixture case, a line in the Fixtures table — and re-records the baseline.

| ID | Signal | Evidence |
|---|---|---|
| S1 | **Disposal per field.** Every controller, node, notifier, timer or subscription field has its own `dispose()` / `cancel()` / `close()`. Adds `ValueNotifier`, `ChangeNotifier`, `Timer` | *Verified:* a `State` with four disposables and a `dispose()` that frees one reports **0 signals** — the check asks only whether `dispose` exists |
| S2 | **Arrow bodies measured** | *Verified:* a three-deep nested ternary in an arrow function reports nothing. A known limitation with a test |
| S3 | **Test-aware mode** for `*_test.dart`: each `test` / `testWidgets` measured on its own; counts of `pumpAndSettle`, `find.byType`, and `if` inside a test body | *Verified:* the fixture's test file reports `main()` as a 56-line function with depth 3 — noise in every test file |
| S4 | **`setState` after `await` with no `mounted` check** in the same function | `GT-02`, required in the A/B key. The analyzer's `BuildContext` rule does not cover `setState` |
| S5 | **Cognitive complexity** per function, over 15 | The Laravel scanner's signal; a long function and a hard one are different things |
| S6 | **Class size**: members and public methods, for god-class judgment | Area 3 has no number behind it |
| S7 | **A number written three or more times** in a file, any number, grouped like the literals | Magic numbers beyond the four layout constructors |
| S8 | **Duplication with identifiers set aside**, and a file's imports left out | Copy-and-rename matches; every file stops matching every other on its header |
| S9 | **Fingerprints** in `--json`: a hash of file, enclosing declaration and signal | A re-run matches `CC-NNN` to code, not to the model's memory |
| S10 | **`--compare before.json`**: improved, regressed, added, removed — plus a "split into tiny pieces" signal | REFACTOR verifies itself with numbers |
| S11 | **Analyzer overlap**: read `analysis_options.yaml` and its `include:` chain through `.dart_tool/package_config.json`; mark each signal an enabled rule already reports; say "unknown" when the chain does not resolve | Today the analyzer rule depends on the model noticing a lint package include |
| S12 | **A `fileIndex`**, unreadable files listed, symbolic links not followed | Ranking per file needs the clean files too (Step 1's denominator) |

---

## Milestone 4 — 1.10.0: judgment where a bare model is weak

### J1 · The promise against the body

- **Why.** The holdout's hardest misses, in both conditions, every run: a doc comment describing
  the wrong settings page (`H4`), and a test named for an infinite repetition that steps exactly
  one duration and never observes it (`H5-01`, missed by twelve runs and four graders). The
  skill checks *shape*; nothing asks whether a name, a doc comment or a test name is *true*.
- **Change.** A checklist line in areas 1, 5 and 7: read each public doc comment, each method name
  with a side effect, and each test name against what the body does; a promise the body does not
  keep is a High-impact finding when the body proves it, a Low-confidence question when it turns
  on intent.
- **Order.** A development fixture first, then the holdout — never tuned against the holdout.

### J2 · Knowledge duplicated across files

The same rule written in two files is the duplication readers cannot see. The fixture pair
`order.dart` + its screen already produced one (two vocabularies for one status). Make it a
checklist line with a worked example.

### J3 · Decisions that stay decided

A finding the team decided to leave returns on every re-run. A `docs/reviews/accepted.md` (AUDIT
may write there) records `CC-NNN`, a reason of a minimum length, a date and who decided. A re-run
re-judges it, as every finding, and says when a reason has gone stale.

### J4 · From report to action by number

AUDIT ends by offering REFACTOR on named findings ("CC-003, CC-007") or on one principle area.
Batch commit messages cite the numbers they answer.

### J5 · A short path for one small file

- **Why.** On `09`, a 45-line file, the skill found nothing a bare run did not, at 3–5× the cost.
- **Change.** One file under ~150 lines: no checklist copied into the reply, the scanner on that
  file only, the answer inline. Same seven areas, same contract.
- **Done when.** `09` costs at most half of today's WITH cell and loses nothing.

---

## Milestone 5 — measurement that runs itself

### M1 · Every model, not one

All scenarios on the current Opus, Sonnet and Haiku; one run in the default permission mode (it is
the only way to measure R2); one run on a non-Claude host. `evals/README.md` records model and date
per row, as `AGENTS.md` > Model calibration already requires and the data does not yet show.

### M2 · A runner, not a ritual

Decide between two, by a one-day spike:

- **`claude plugin eval`** — cases as `prompt.md` plus graders (`tool_used` for "the skill loaded",
  `regex`, `file_exists`, `llm`), a no-plugin baseline arm, `--max-cost-usd`, `--threshold`, an
  `aggregate-result.json`. Needs the skill packaged as a plugin (D1) and pointed at a `git archive`
  export, never at this repository, whose `evals/` a run must not see.
- **A committed `run-evals.mjs`** — Node built-ins, spawns headless runs over the laid-out projects,
  feeds `check-run.mjs` and `make-dossier.mjs`, which already exist.

Whichever wins generates its cases from `evals/*.json`, so the scenarios stay the source of truth.

### M3 · Routing assertions

`check-run.mjs` records which `references/` files a run opened; a scenario names the ones it
needs. `evals/report-contract.md` already proved the failure: a rule in a file the run never
opened is a rule the run never followed.

### M4 · Cost on the record

Tokens, tool calls and dollars per scenario, every round, beside the verdicts — so "the skill costs
3–5×" is a tracked number, and J5 can prove it moved.

---

## Milestone 6 — install, update, discover

### D1 · One command to install, one to update

A plugin whose `SKILL.md` sits at its root loads as a single skill, so `.claude-plugin/plugin.json`
plus a single-repository `.claude-plugin/marketplace.json` (`"source": "./"`) make this repository
installable with `/plugin marketplace add MahmoudEssa603/flutter-clean-code` — without moving
`SKILL.md`, so a plain clone keeps working. `validate-skill.mjs` checks that the plugin's version
equals `metadata.version`. To verify before release: invocation becomes namespaced, and a user
holding both a clone and the plugin has two copies.

### D2 · Trust signals

`SECURITY.md` (how to report, what the skill never does), signed release tags, and the trust model
stated where a directory listing shows it.

---

## Milestone 7 — the family of skills

The private skills pack already holds sibling Flutter skills for most of this skill's hand-backs —
written at an earlier bar: one `SKILL.md` each, no evaluations, no scripts. It also holds a
289-line copy of an early `flutter-clean-code`, which will drift from this one under the same name.

### F1 · Graduate the siblings, in this order

Each becomes its own repository on this one's bar: a self-contained `SKILL.md`, a report contract,
evaluations with an A/B baseline, a scanner only where a measurement earns it.

| Order | Sibling | Why first |
|---|---|---|
| 1 | Flutter upgrade and migration | Asked for; the clearest hand-back from P6 |
| 2 | Code quality and lints | The other half of the analyzer rule: the skill says "enabling rule X covers this"; this one enables it |
| 3 | Test generation | Rule Zero's route 1; characterization tests on demand |
| 4 | State management, performance, theming | Already handed back by every scenario that mixes them in |

### F2 · One kit, two skills

`flutter-clean-code` and `laravel-clean-code` carry near-identical maintenance scripts —
`validate-skill`, `check-evals`, `generate-eval-summary`, `make-baseline`, `check-fixture-reuse` —
and already disagree. A template repository holds them; each skill vendors a copy (the runtime
stays self-contained); a check reports drift from the template.

### F3 · Retire the stale copy

Replace the early `flutter-clean-code` in the skills pack with this release, or with an install
pointer — never two versions under one name.

---

## The bar for "done"

The skill is where this roadmap aims when all of these hold:

- [ ] Every check in `AGENTS.md`'s pre-publication list passes in CI, on three systems and three
      Node versions, with the Dart SDK present.
- [ ] Every script is importable without side effects and every gate has a test that fails it.
- [ ] The hard rules survive compaction, and the validator proves it.
- [ ] Every scenario is graded on three models, with the default permission mode measured once.
- [ ] The holdout shows a meaningful gain on at least one case where the first round showed none.
- [ ] One command installs it and one updates it, on every agent the README names.
- [ ] Cost per scenario is recorded, and the short path halves the small-file case.
- [ ] Nothing in `SKILL.md` is within 5 % of a limit.

## Sources

- Claude Code skills documentation — `${CLAUDE_SKILL_DIR}`, skill locations, skill content
  lifecycle and the 5,000-token re-attachment: https://code.claude.com/docs/en/skills.md
- Claude Code permissions — Bash rule matching: https://code.claude.com/docs/en/permissions.md
- Plugin manifest and marketplace references:
  https://code.claude.com/docs/en/plugins/manifest-reference.md,
  https://code.claude.com/docs/en/plugins/marketplace-reference.md
- Plugin evaluations: https://code.claude.com/docs/en/plugin-evals.md
- Agent Skills best practices:
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- This repository's measurements: `evals/ab/RESULTS.md`, `evals/ab/HOLDOUT.md`,
  `evals/ab/HOLDOUT-RELEASE-CANDIDATE.md`, `evals/report-contract.md`
