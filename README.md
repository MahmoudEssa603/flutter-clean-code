# flutter-clean-code

An agent skill that audits — and, when tests make it safe, refactors — Dart/Flutter code against
Clean Code principles: meaningful naming, small single-responsibility functions, SOLID, DRY,
honest comments, disciplined error handling, and Flutter widget hygiene.

It owns the part of code quality that needs **human judgment**. The part a tool can decide —
formatting, import ordering, lint rules — stays with `dart analyze` and `dart format`, and the
skill drops any finding an enabled lint already reports.

**Self-contained.** No companion skill, no plugin, no external project. Clone it and it runs.

## Install

```bash
# Claude Code — project scope
git clone <repo-url> .claude/skills/flutter-clean-code

# Claude Code — personal scope, available in every project
git clone <repo-url> ~/.claude/skills/flutter-clean-code
```

Pin to a release rather than tracking the branch:

```bash
git clone --branch v1.0.0 --depth 1 <repo-url> .claude/skills/flutter-clean-code
```

The directory must keep the name `flutter-clean-code`, with `SKILL.md` directly inside it — the
directory name is the command you type.

Any other agent that reads the [Agent Skills](https://agentskills.io) format works too: the
frontmatter uses only the six portable fields, so the skill also uploads and packages without
modification.

## Use

```
"نضف الكود ده حسب الكلين كود"
"refactor this file — it's unreadable"
"راجع الموديول ده ضد قواعد SOLID"
"الدالة دي طويلة — قسمها صح"
"review the changes on this branch for readability"
```

Or invoke it directly with `/flutter-clean-code`.

Attach the code in scope, its tests — required for REFACTOR — and the project's conventions file
if you have one. **Project conventions beat every generic preference in the skill.**

Arabic in → Arabic out. English in → English out. Code and identifiers stay English either way.

## Modes

| Mode | Result |
|---|---|
| **AUDIT** | Findings report only. No file is modified. |
| **REFACTOR** | Behaviour-preserving patches, applied in independently revertable batches. |
| **DIFF** | AUDIT restricted to the files changed against a base ref. For pull-request review. |

Seven principle areas are checked every run: Naming · Functions · Classes & SOLID ·
Flutter-specific cleanliness · Comments & dead weight · Error handling & data · Tests.

Every run starts by measuring. `scripts/scan-dart.mjs` reports `build()` and function lengths,
nesting depth, positional and boolean parameter counts, `State` classes that create a disposable
with no `dispose`, bare `catch`, `late` fields, inline layout literals, ownerless TODOs and
commented-out code — so the report cites numbers instead of impressions. Its output is where to
look, never what to report.

**Generated Dart is never audited.** `.g.dart`, `.freezed.dart`, `.mocks.dart`, `.gr.dart` and
anything carrying a `GENERATED CODE` banner are excluded, because no finding about them can be
acted on.

**Re-runs pick up where the last one stopped.** A second pass on the same module opens with a
Since-last-pass table — fixed, still open, new — and a finding that is still open keeps its
original number.

**Rule Zero:** no behaviour-changing edits, and the test suite is green before *and* after every
batch. Without tests on the touched code the skill either writes characterization tests first or
emits the patch marked `NOT APPLIED — requires approval`.

## What it does not do

Out-of-scope observations are reported with a one-line reason and handed back to you. The skill
never absorbs them into a clean-code pass, and never tells you which tool to use instead — that
decision is yours.

Out of scope: formatting and lint rules, state-management architecture, design tokens and colour
scales, runtime performance, bug fixing, and any change to layer boundaries or dependency
direction. Clean Code is readability *inside* the current design; Clean Architecture is a
different job.

## Output

- A single file in scope → answered inline.
- A feature or a module → `docs/reviews/CLEAN-CODE-<AUDIT|REFACTOR>-<module>-<YYYY-MM-DD>.md`.

Findings carry Impact, Effort, Confidence and a `file:line`, ordered by impact with quick wins
first, capped at 20 per module with the remainder counted rather than hidden.

## Requirements

The Dart or Flutter SDK on PATH, for `flutter analyze`, `dart format` and `flutter test`. Without
an SDK the skill runs report-only and says so in the report instead of claiming checks it never
ran.

Node 18+ for `scripts/scan-dart.mjs`. The skill runs without it — it reads the code directly and
says the measurements are estimates — but the scanner is what turns "this looks long" into
"118 lines, over 40".

## Trust and validation

- No network calls, no credentials, no telemetry, nothing fetched at runtime.
- No third-party packages: `scripts/` uses Node built-ins only.
- AUDIT and DIFF modify no file. Only REFACTOR writes, and edits stay behind the host's normal
  permission prompt by design.

```bash
node --test                              # unit and integration suites
node scripts/validate-skill.mjs          # the repository's own contract
node scripts/scan-dart.mjs <path>        # measure any Dart tree, --json for exact numbers
```

`validate-skill.mjs` checks the frontmatter fields and limits, the body line count, the
reference-link graph, the self-containment rule, the vocabulary table, that `scripts/` imports
nothing outside Node built-ins, and that the evaluation files are present and well formed. It
runs in CI on Linux and Windows on every push and pull request, alongside the test suites.

Every gate has a test that breaks the repository on purpose and asserts the validator fails.
A validator that only ever prints `All checks passed` proves nothing.

## Repository shape

```
flutter-clean-code/            the repository root is the skill root
├── SKILL.md                   the skill: modes, checklist, workflow
├── references/
│   ├── dart-examples.md       before/after pairs for every principle
│   ├── refactor-batches.md    batching, the safe/unsafe list, rollback
│   ├── report-template.md     the output format
│   ├── example-report.md      a full worked audit, for calibration
│   └── test-quality.md        judging test code, the larger half of most projects
├── evals/                     seven scenarios and their fixtures
├── test/                      unit and integration suites, node --test
├── scripts/
│   ├── validate-skill.mjs     the contract validator
│   └── scan-dart.mjs          the Dart measurement scanner
├── AGENTS.md                  governance: vocabulary, conventions, releases
├── CONTRIBUTING.md            how a change gets merged
└── PROJECT-SETUP.md           setup guide (Arabic)
```

Reference files are loaded only when a step calls for them, so the checklist costs nothing until
the skill needs it.

## License

MIT — see [LICENSE](LICENSE).
