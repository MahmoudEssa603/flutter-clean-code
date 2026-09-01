# AGENTS.md — governance for this repository

Rules for anyone, human or agent, editing this repository. `SKILL.md` is the single source of
truth for behaviour; this file governs how that truth is written and shipped.

## Contents

- [Vocabulary](#vocabulary)
- [Conventions](#conventions)
- [Frontmatter contract](#frontmatter-contract)
- [Self-containment rule](#self-containment-rule)
- [Scripts](#scripts)
- [Tests](#tests)
- [Model calibration](#model-calibration)
- [Pre-publication checklist](#pre-publication-checklist)
- [Releases](#releases)
- [Trust model](#trust-model)

---

## Vocabulary

One word per concept, used verbatim in `SKILL.md`, the reference files, the README, and every
report the skill emits. The skill enforces this rule on other people's code; it holds itself to
it first.

| Use | Never | Meaning |
|---|---|---|
| **finding** | issue, problem, violation, warning | One reported clean-code observation, numbered `CC-NNN` |
| **batch** | commit, changeset, step | One refactoring type applied and verified once |
| **mode** | task, command, action | AUDIT, DIFF, or REFACTOR |
| **scope** | target, selection | The files under review |
| **module** | package, area, layer | One feature directory under `lib/` |
| **the analyzer** | linter, static analysis, lints | `dart analyze` / `flutter analyze` and its rules |
| **conventions file** | style guide, golden reference, standards doc | `analysis_options.yaml`, `CONTRIBUTING.md`, or the project's stated style guide |
| **characterization test** | snapshot test, safety test, pin test | A test that records current behaviour before a refactor |
| **evidence level** | confidence level, tier | Full, Partial, or None |
| **signal** | metric, warning, hit | A measurement from `scan-dart.mjs`; a signal is not yet a finding |
| **Impact / Effort / Confidence** | severity, priority, size, certainty | The three finding dimensions |
| **behaviour-preserving** | non-breaking, safe, harmless | Observable behaviour is unchanged |
| **report** | output, summary, audit doc | The markdown the skill emits |

`Confidence` measures how sure the finding is. `Impact` measures what it costs. They are not
interchangeable, and no report may collapse them into a single "priority".

Spelling: British English in prose (`behaviour`, `prioritise`, `colour`). Dart API names keep
their own spelling (`Color`, `initState`).

## Conventions

**Repository shape.** `SKILL.md` sits at the repository root, so the repository directory *is*
the skill directory and a clone lands in `.claude/skills/<name>/` ready to run. Do not move it.
Adding a second skill means restructuring to `skills/<name>/` and adding a package manifest —
that is a major-version decision, not a drive-by change.

**Reference files.** Everything under `references/`, one level deep from `SKILL.md`, linked
directly from `SKILL.md`. Never link a reference file from another reference file: an agent
previewing a nested chain reads partial files and acts on half the rule.

**Reference files over 100 lines open with a Contents list.** A partial read must still reveal
the full scope of what the file covers.

**File names state their content.** `dart-examples.md`, not `examples.md`; `refactor-batches.md`,
not `advanced.md`.

**Paths use forward slashes everywhere,** including in prose and examples. This repository is
authored on Windows and consumed on Linux and macOS.

**No time-sensitive statements.** No "as of 2026", no "the new API", no version-dated advice in
the skill body. Behaviour that changed belongs under an `Old patterns` heading or nowhere.

**Examples are runnable Dart.** Every snippet in `references/dart-examples.md` must be valid
Dart 3 that a reader could paste into a file and have the analyzer accept, apart from the
deliberate `...` elisions. No pseudo-code.

**Prose lines wrap at 100 columns.** Tables and code blocks are exempt.

**Generated Dart is never audited.** `.g.dart`, `.freezed.dart`, `.mocks.dart`, `.gr.dart`,
`.config.dart`, `.gen.dart`, `.pb*.dart`, and any file carrying a `GENERATED CODE` banner are
excluded in `SKILL.md` and skipped by `scan-dart.mjs`. Adding a generator to the ecosystem means
adding its suffix in both places, in the same pull request.

## Scripts

`scripts/` holds two tools. Both run on Node 18+ with no install step.

| Script | Role |
|---|---|
| `validate-skill.mjs` | Enforces this file's contract. Run it before every commit; CI runs it too. |
| `scan-dart.mjs` | Measures Dart files for the skill to cite. Signals only, never findings. |

Both keep their side effects behind a `main()` guard, so every function they hold can be
imported and tested. A script that runs work at import time cannot be tested, and an
untestable script does not belong here.

Rules for anything added here:

- **Node built-ins only.** `validate-skill.mjs` fails the build on a bare import specifier.
- **Solve, do not defer.** A script handles its own error cases — a missing directory, an
  unreadable file — instead of failing and leaving the agent to work it out.
- **No voodoo constants.** Every threshold carries a comment saying which rule in `SKILL.md` it
  serves. A number nobody can justify is a number nobody should trust.
- **`scan-dart.mjs` measures, it does not judge.** It must never print the word finding, and its
  exit code is always 0. The moment it starts deciding what is wrong, the skill stops thinking.
- **It is a heuristic, not a parser.** It blanks comments and string literals and counts braces.
  Where that is not enough, the honest move is to report less, not to guess.

## Tests

`node --test` runs everything. Two levels, both on Node built-ins:

| Suite | Level | Covers |
|---|---|---|
| `test/scan-dart.test.mjs` | unit | Comment and string blanking, brace matching, parameter counting, generated-file detection, duplication merging |
| `test/validate-skill.test.mjs` | integration | Every gate, by copying the repository, breaking one thing, and asserting exit code 1 |

**Every gate is proven to fail.** A validator that only prints `All checks passed` reads as
evidence while proving nothing, so each gate has a test that breaks the repository on purpose
and asserts the run fails with the right message. One test asserts the opposite — that the
repository as committed passes — so a gate firing on everything is caught too.

**A new scanner signal needs four things, in one pull request:** a unit test proving it fires,
a unit test proving it stays quiet, a case in `evals/fixtures/order_summary_page.dart`, and a
line in that fixture's header comment.

**Known limitations are tested, not remembered.** `findFunctions` cannot measure an arrow
body, and a test asserts that. A limitation with a test stays visible; a limitation in someone
's memory gets rediscovered as a bug.

## Model calibration

The skill runs on models of different strengths, so the same words have to work for all of them.

- **The rule goes in `SKILL.md`; the illustration goes in `references/`.** A weaker model needs
  the example, and loads it because the step points there. A stronger one skips it.
- **Say the decision, not the reasoning behind it.** "Extract widget classes, not `_buildX()`
  methods" plus one clause of why. Three paragraphs of justification help no model.
- **State every stop condition as an imperative.** "Stop and report it" beats "it would be
  preferable not to continue". Softer phrasing is where weaker models drift.
- **Never leave a fallback implicit.** Missing SDK, missing Node, missing tests, missing
  conventions file — each has a written branch, because a model that has to invent one will.
- **Record what was tested.** `evals/README.md` carries the model and the date. A pass on one
  model is not a pass on the others, and the table says which.

## Frontmatter contract

`SKILL.md` frontmatter uses **only** these six fields:

`name` · `description` · `license` · `compatibility` · `allowed-tools` · `metadata`

These six are the portable set. Any other field — `paths`, `argument-hint`, `model`, `context`,
`disable-model-invocation` — works in Claude Code but makes the skill fail to package or upload
elsewhere with a hard `Unexpected key(s) in SKILL.md frontmatter` error. Portability is a
deliberate choice for this repository; adding a seventh field is a breaking change and needs a
major-version bump.

Hard limits, enforced by `node scripts/validate-skill.mjs`:

| Field | Rule |
|---|---|
| `name` | ≤ 64 chars, lowercase letters, digits and hyphens only, must equal the repository directory name |
| `description` | non-empty, ≤ 1024 characters, third person, no XML tags |
| `compatibility` | ≤ 500 characters |
| `metadata.version` | `MAJOR.MINOR.PATCH`, matching the newest git tag |
| body | < 500 lines |

The `description` must contain, in this order: what the skill does, when to use it including its
Arabic trigger phrases, and an explicit `Do not use for` clause. The negative clause is not
optional — without it the skill fires on Python and TypeScript code, because `SOLID`, `DRY`,
`god class` and `rename` are language-neutral terms.

## Self-containment rule

**The skill names no other skill, no companion tool, and no external project.** Not in
`SKILL.md`, not in a reference file, not in the README.

The skill is installed by people whose toolchains we cannot see. A reference to a skill they do
not have is a dead end at exactly the moment they need direction. So out-of-scope work is
reported as an observation with a one-line reason, and the routing decision is left to the user.

What is allowed: naming real, universal Dart tooling — `dart analyze`, `dart format`,
`flutter test`, `analysis_options.yaml`. Those ship with the SDK.

What is not allowed: naming a sibling skill, a plugin, a marketplace, an internal team document,
or a specific project's file layout.

## Pre-publication checklist

Run before every tag. Everything here must pass locally, not just in CI.

```
- [ ] node --test                                         — unit and integration suites
- [ ] node scripts/validate-skill.mjs                     — frontmatter, limits, links, paths
- [ ] node scripts/scan-dart.mjs evals/fixtures           — runs clean, skips the generated fixture
- [ ] every references/ file is linked from SKILL.md and from nowhere else
- [ ] no sibling-skill, tool, or project name anywhere (see Self-containment rule)
- [ ] vocabulary table respected; no banned synonym introduced
- [ ] every Dart snippet is valid Dart 3
- [ ] the evals in evals/ were run by hand against the current SKILL.md
- [ ] eval results recorded honestly: "ran, passed" or "not run"
- [ ] metadata.version bumped and matching the tag about to be created
- [ ] README install commands copy-pasted and verified from a clean directory
```

**Verification lines claim only what was demonstrated.** "Evals run on Opus, passed" is a claim
that someone ran them. "Evals written, not yet run" is an acceptable state to ship. An
unverified claim is not.

## Releases

Annotated git tags, `vMAJOR.MINOR.PATCH`:

```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

| Bump | When |
|---|---|
| **major** | A frontmatter field is added or removed; a mode is removed or renamed; the installed shape changes — `SKILL.md`, `references/` or `scripts/` moving, being renamed, or going away |
| **minor** | A new mode, a new principle area, a new reference file, a new checklist item, a new script or signal |
| **patch** | Wording, examples, typos, a clarified rule that changes no behaviour, and documentation that does not touch `SKILL.md` |

**"Installed shape" means what a consumer depends on**, not every file in the repository.
Deleting a stale guide nobody imports is a patch; renaming `references/` is major. The question
that settles it: after this change, does a clone still behave the same way?

**A release is cut when it is worth installing, not only when `SKILL.md` changes.** Corrected
install instructions are a reason to tag even though the skill file is byte-identical, because
whoever pinned the last release is stuck with the wrong ones until you do. When `SKILL.md` is
unchanged, bump `metadata.version` anyway so it and the tag still agree, and say in the tag
message that the skill itself did not change.

`metadata.version` in `SKILL.md` and the git tag always agree. A release with no tag is not a
release.

## Trust model

- **No network.** The skill fetches nothing at runtime and points at no remote URL as a
  dependency.
- **No credentials, no telemetry, no analytics.** Nothing in this repository reads a secret or
  reports usage anywhere.
- **No third-party packages.** `scripts/` uses Node built-ins only, so a contributor with Node
  installed can run everything with no install step.
- **The skill reads by default and writes only in REFACTOR mode.** AUDIT and DIFF must not
  modify a single file, including the report — those two modes answer in the conversation or
  write only under `docs/reviews/`.
- **`allowed-tools` pre-approves reads and the three verification commands, and nothing else.**
  Edits stay behind the host's normal permission prompt, deliberately: a refactor that rewrites
  files should be something the user saw and allowed.
