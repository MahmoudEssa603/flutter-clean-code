---
name: flutter-clean-code
description: >-
  Audits and refactors Dart/Flutter code against Clean Code principles: meaningful naming, small
  single-responsibility functions, SOLID, DRY, honest comments, disciplined error handling, and
  Flutter widget hygiene. Produces a prioritised findings report, plus behaviour-preserving
  refactoring patches when tests make them safe. Use when the user asks to clean up, tidy, split,
  rename or restructure Dart/Flutter code for readability, to judge it against clean code or
  SOLID rules, or to review only the Dart files changed on a branch or in a pull request,
  including Arabic phrasings such as "نضف الكود", "الكود مش مقروء", "قسم الدالة دي",
  "راجع الكود ضد SOLID", "راجع التغييرات دي", "ودجت كبيرة". Do not use for non-Dart code, for fixing bugs or crashes,
  for changing architecture layers or state-management patterns, or for lint and formatting rules
  that analysis_options.yaml already enforces.
license: MIT
compatibility: >-
  The Dart or Flutter SDK on PATH is required for the verification commands (flutter analyze,
  dart format, flutter test). Without an SDK the skill runs report-only and says so in the report.
  The agent must be able to read repository files, and to edit them for REFACTOR tasks.
  No network access is used.
allowed-tools: Read, Grep, Glob, Bash(node scripts/scan-dart.mjs:*), Bash(node ~/.claude/skills/flutter-clean-code/scripts/scan-dart.mjs:*), Bash(flutter analyze:*), Bash(dart analyze:*), Bash(dart format:*), Bash(flutter test:*), Bash(dart test:*)
metadata:
  version: 1.0.0
---

# Flutter Clean Code

Audit and refactor Dart/Flutter code against Clean Code principles, translated to Dart idiom.
Output: findings ordered by impact, plus behaviour-preserving refactoring patches when tests
make them safe.

This skill is self-contained. It requires no other skill, no companion tool, and no external
project. Everything it needs is in this directory.

## References

Read these when the step says so, not before.

- Concrete Dart before/after pairs for every principle: [references/dart-examples.md](references/dart-examples.md)
- Refactor batching, the safe/unsafe list, and rollback: [references/refactor-batches.md](references/refactor-batches.md)
- The report format to emit: [references/report-template.md](references/report-template.md)
- A full worked report, for the level of detail expected: [references/example-report.md](references/example-report.md)
- Judging test code, which is most of a real project: [references/test-quality.md](references/test-quality.md)

---

## What this skill owns

Readability, naming intent, function and class responsibility, SOLID judgment, Flutter widget
hygiene, and local behaviour-preserving refactoring.

## What it does not own

Report these under **Out of Scope**, one line each, and hand them back to the user. Never fix
them inside a clean-code pass, and never silently absorb them.

| Not this skill's job | Why |
|---|---|
| Anything an enabled lint rule already catches | The analyzer owns it — see the analyzer rule below |
| Formatting and import ordering | `dart format` and the analyzer are deterministic; no judgment needed |
| State-management patterns, rebuild ownership, provider/bloc/riverpod structure | Different domain, different evidence |
| Theme tokens, colour values, typography and spacing scales | Design-system decisions, not readability |
| Runtime performance: jank, rebuild storms, memory growth | Needs profiling evidence this pass does not collect |
| Bugs, crashes, wrong behaviour | Refactoring is not fixing |
| Layer boundaries, dependency direction, entities/usecases/repositories, module structure | Clean Architecture, not Clean Code |

**The analyzer rule.** Before reporting a finding, check whether the project's
`analysis_options.yaml` already enables a lint that catches it. If it does, drop the finding —
the analyzer reports it on every build and this skill would only duplicate the noise. If such a
lint exists in Dart but is not enabled, still drop the finding, and note once in the report that
enabling that rule would cover the whole class of issue.

**Clean Code is not Clean Architecture.** Clean Code is readability and maintainability *inside*
the current design. Changing layer boundaries or dependency direction is out of scope unless the
change is local and behaviour-preserving.

---

## Inputs

Required:

- The code in scope — a file, a feature, or a module.

Strongly recommended:

- Its tests. Required for REFACTOR, see Rule Zero.
- The project's conventions: `analysis_options.yaml`, `CONTRIBUTING.md`, or a style guide.
  **Project conventions beat every generic preference in this skill.**

If no conventions file exists, proceed with standard Dart conventions and record in the report
that project conventions were not verified.

---

## Workflow

Copy this checklist into your response and tick items as you go:

```
- [ ] Step 0 — mode agreed
- [ ] Step 1 — scope fixed: generated code out, previous report read
- [ ] Step 2 — scanner run, then all seven principle areas checked
- [ ] Step 3 — findings prioritised and capped
- [ ] Step 4 — refactor batches applied (REFACTOR only)
- [ ] Step 5 — verification commands run
- [ ] Step 6 — report emitted
```

### Step 0 — Mode

| Mode | Result |
|---|---|
| **AUDIT** | Findings report only. No file is modified. |
| **REFACTOR** | Findings plus applied, behaviour-preserving patches. |
| **DIFF** | AUDIT restricted to files changed against a base ref. Use for pull-request review. |

Pick DIFF when the user says "the changes", "this PR", or "what I just wrote". Get the file list
with `git diff --name-only <base>...HEAD -- '*.dart'`, audit only those files, but read enough
surrounding code to judge each finding fairly.

**If the touched code has no tests:**

- AUDIT and DIFF may proceed normally.
- REFACTOR must do one of two things, and must state which one it chose:
  1. Write characterization tests first — tests that pin the *current* observable behaviour,
     including behaviour that looks wrong. Then refactor.
  2. Produce the patch without applying it, marked `NOT APPLIED — requires approval`.

Characterization tests are an expected addition in REFACTOR mode and never count as unrelated
file changes.

### Step 1 — Scope

**Scope ladder:** file → feature → module. A whole-project request runs module by module, worst
first, reporting after each module rather than at the end.

**Worst first has a definition.** Run the scanner over `lib/` with `--json`, group the files by
feature directory, and rank the features by signals per file — not by total signals, or a large
feature always wins on size alone. Take the top three in one pass and say which ones are queued.
Auditing eleven features in one reply produces a document nobody reads.

**Package or app?** Read `pubspec.yaml` first. `publish_to: none` means an app: public API
surface, `///` doc comments and deprecation aliases do not apply, so do not report them.
Anything else is a package, and those rules are High-impact because other people depend on them.

**Never audit generated code.** It is not written by hand, so no finding about it can be acted
on. Exclude a file when its name ends in `.g.dart`, `.freezed.dart`, `.mocks.dart`, `.gr.dart`,
`.config.dart`, `.gen.dart` or `.pb*.dart`, or when its first lines carry a
`GENERATED CODE — DO NOT MODIFY BY HAND` banner. If the *generator input* is the real problem —
an unreadable `@freezed` class, a hand-written model that should be generated — report that
against the input file, never against its output.

**Re-runs.** Before writing a report, look for the newest previous report for the same module
under `docs/reviews/`. If one exists, open the report with a Since-last-pass table: which earlier
findings are now fixed, which are still open, and which are new. Never renumber a finding that is
still open — `CC-003` stays `CC-003` across passes, so a person can follow it.

### Step 2 — Measure, then judge

Run the scanner first, so the report cites measurements rather than impressions:

```bash
node <skill-dir>/scripts/scan-dart.mjs <path-to-scope>
node <skill-dir>/scripts/scan-dart.mjs <path-to-scope> --json   # to quote exact numbers
```

`<skill-dir>` is the directory this file was loaded from, typically
`~/.claude/skills/flutter-clean-code`. The working directory during a run is the project under
review, not the skill, so a path relative to it finds nothing.

It reports build() and function lengths, nesting depth, positional and boolean parameter counts,
`State` classes that create a disposable with no `dispose`, single-use widget classes small
enough to be over-extraction, bare `catch`, `late` fields, `==` on collection fields, inline
layout literals, ownerless TODOs and commented-out code — and it skips generated files for you.

It also reports **repeated blocks** of six or more lines, with comments and string literals
ignored, so a copy-pasted widget subtree matches even when its labels differ. A repeated block
is duplication of *shape*. Whether it is duplication of *knowledge* — the same rule written
twice — is the judgment you make in area 6.

**Its output is where to look, not what to report.** A 60-line `build()` that is one flat list of
settings rows is fine; a 30-line one mixing four concepts is not. Every signal still has to be
judged against the code, and a signal you decide is fine does not go in the report at all.

If Node is unavailable, skip the scanner and read the code directly. Say in the report that the
measurements are estimates. A scanner that is *not found* is a wrong `<skill-dir>`, not a missing
Node: fix the path rather than falling back, or the report loses the numbers that justify it.

Then work the checklist below. It is the judgment the scanner cannot do: intent, responsibility,
and duplication. Check all seven areas every run. Concrete Dart before/after code for each is in
[references/dart-examples.md](references/dart-examples.md) — read it when you need to show a fix.

#### 1. Naming

- Names state intent; no mental mapping (`d`, `tmp`, `data2`, `doIt`).
- Booleans read as predicates: `isLoading`, `hasError`, `canSubmit`.
- Functions are verbs, classes are nouns, no type noise (`userList` → `users`).
- One word per concept across the module — `fetch` vs `get` vs `load`, pick one and keep it.
- No misleading names. A `getUser()` that also writes to cache is a finding.
- Dart conventions: `lowerCamelCase` members, `UpperCamelCase` types, `snake_case` files, no
  `get` prefix on getters, and `Impl`/`Manager`/`Helper` suffixes are a smell to justify.
- Transliterated identifiers are a finding: `getMostakhdem`, `orderTaleb`, `saveBayanat`. They
  break one-word-per-concept, no lint catches them, and half the team reads them twice. Use the
  English term. Genuine domain terms with no English equivalent stay as they are — `zakat`,
  `iqama`, `hijri` — and that exemption is about the domain, not about convenience.
- An extension's name says who it is for, not what it wraps: `OrderTotals`, not `OrderExtension`.
  An extension on a core type (`String`, `int`, `BuildContext`) that encodes one feature's rule
  belongs to that feature, not to the whole app.

#### 2. Functions

- Small, one job, one level of abstraction per function.
- At most 3 positional parameters; beyond that use named parameters or a parameter object.
  A heuristic, not a law — a project convention overrides it.
- No boolean flag parameter that switches behaviour. Split into two named functions.
- No side effect hidden behind an innocent name.
- Early returns instead of nested `if` pyramids. Roughly two levels of nesting is the ceiling.
- Command/query separation: avoid an API that both mutates and returns meaningful domain data,
  unless it follows a standard Dart pattern (`removeWhere`, controllers, cache APIs).
- Prefer collection-if, collection-for, spreads and cascades over imperative list building.

#### 3. Classes and SOLID

- **SRP:** one reason to change. A repository that also formats dates is a finding.
- **OCP:** `switch`/`if` chains on a type that grow with every feature → a `sealed` hierarchy
  with an exhaustive `switch` expression.
- **LSP:** subclasses honour base contracts. An override that throws `UnimplementedError` is a
  finding.
- **ISP:** a fat interface whose consumers implement half of it as no-ops → split it.
- **DIP:** domain code depends on abstractions. SDK or plugin types leaking into entities and
  usecases is a finding.
- God classes, `Manager`s, and `utils` dumping grounds → split by responsibility.
- Favour composition over inheritance for widget helpers.
- **Do not force SOLID where simple procedural or widget-local code is clearer.** The simplest
  readable design that fits the current feature size wins. Over-abstraction is itself a finding.
- Dart 3 class modifiers (`sealed`, `final`, `base`, `interface`) should state the intended
  extension contract instead of leaving every class open by default.
- `sealed` earns its cost only when the variants carry different data. When they carry none, an
  `enum` says the same thing in three lines — and a Dart 3 `enum` can hold fields and methods.
- A `Record` is right for a value that lives inside one function and wrong in a public
  signature: `(String, int)` in a return type tells a reader nothing. Name the fields, or name
  the class.
- A collection field inside `==` compares by identity, so two lists with identical contents are
  never equal. The screen then fails to rebuild and nothing looks broken until someone reports
  it. Use `listEquals` / `mapEquals`, and hash with `Object.hashAll`.
- Hand-written `==`, `hashCode`, `copyWith` and `toString` on a value class: check that every
  field appears in all of them. One field missing from `==` or `copyWith` is a High-impact
  finding, because the bug it causes is silent. If the project already generates these, a
  hand-written one is the finding.
- A feature directory exposes one entry point. Files other features are not meant to import live
  under `src/`, or the feature is exported through a single barrel file — not both, and not
  neither.

#### 4. Flutter-specific cleanliness

- A `build()` over roughly 40 lines, or mixing several visual concepts, should be split into
  named widget **classes**. Widget classes get `const`, keys, and readable names in DevTools;
  private `_buildX()` methods get none of those. A private builder is acceptable only for a tiny
  local branch with no reuse, no state, and no identity worth naming.
- **The floor, not only the ceiling.** A widget class of a few lines, with no state and one call
  site, is a name where none was needed — the reader now jumps files to learn that it was a
  `SizedBox`. Inline it. Extraction earns its cost when the extracted thing has a concept worth
  naming, is reused, holds state, or is big enough to hide the parent's shape.
- Deep widget-tree nesting → extract and *name* the intermediate concept.
- Business logic inside a widget belongs in the state layer. Report it; do not redesign the
  state architecture here.
- Duplicated widget subtrees across screens → one shared widget.
- Magic numbers, colours and durations inline → named constants or theme lookups. Choosing the
  token *values* is design-system work: report it, do not invent a scale.
- Extracted widgets take `const` constructors and `final` fields wherever possible, and keys
  when they appear in a list that can reorder.
- Lifecycle symmetry: every controller, subscription, focus node or animation created in
  `initState` has a matching `dispose`. This is ownership clarity, not performance tuning.
- `late` used to dodge nullability, and `!` used to silence the type system, are findings. The
  type should tell the truth instead.
- Hardcoded user-facing strings: a finding **only when the project already has localisation set
  up** — an `l10n.yaml`, `.arb` files, or `flutter_localizations` in `pubspec.yaml`. If it has
  none, adopting localisation is a project decision, so report it once as out of scope rather
  than as a finding per string.

#### 5. Comments and dead weight

- A comment explaining *what* the code does → delete it and make the code say it.
- A comment explaining *why* — a constraint, a workaround, a link to an issue — stays.
- Commented-out code → delete. Version control remembers.
- Dead code: unused functions, parameters, and files → delete. Unused *imports* belong to the
  analyzer, unless this pass is what made them unused.
- A `TODO` with no owner and no ticket → convert it to a tracked item or delete it.
- The reverse case: a public API in a published package with no `///` doc comment is a finding.
  Say what it does and what it promises, not what type it returns. Inside an app, doc comments
  are optional and only worth asking for on a non-obvious contract.

#### 6. Error handling and data

- No error-code return values where exceptions or a `Result` type fit the project's pattern.
- No catch-and-ignore. No `catch (e)` that discards the stack trace — use `catch (e, st)`.
- Catch the narrowest type that makes sense: `on FormatException catch (e, st)`, not bare `catch`.
- Null discipline: a nullable type that is never really null is a lie. Make the type honest.
- A chain like `a?.b?.c ?? fallback` is a modelling problem wearing syntax. Ask which of those
  three can genuinely be absent; usually one can, and the rest should not be nullable at all.
- Async honesty: no `async` without an `await`, no fire-and-forget future that silently swallows
  its error, no `Future` returned and never awaited by its caller.
- **DRY on knowledge, not on lines.** The same business rule in two places is a finding. Two
  blocks that merely look alike but encode different rules are *not* a finding — say so
  explicitly when you decide to leave them.
- Tests are code. A test with branching logic, a copy-pasted setup block, or a name that does not
  state the behaviour under test is a finding like any other.

#### 7. Tests

Test code is code, and in most projects it is the larger half. Judge it by areas 1 to 6 above,
plus the rules specific to tests in
[references/test-quality.md](references/test-quality.md) — read that file whenever the scope
contains a `test/` directory.

- A test name states the behaviour under test, not the method called.
- One reason to fail per test. A test asserting four unrelated things reports only the first.
- No branching in a test. An `if` in a test means two tests, or an assertion proving nothing.
- Setup copy-pasted between tests belongs in a builder, not in the fourteenth `setUp`.
- `pumpAndSettle` used to make a flaky test pass hides a timing problem rather than fixing it.
- Assertions on `find.byType` break when the tree is refactored. Prefer keys or visible text.

If the scope contains no tests at all, that is one finding, not one per untested class.

### Step 3 — Prioritise

| Impact | Meaning |
|---|---|
| **High** | Actively causes bugs or blocks understanding — a misleading name, a god class on a hot path, a duplicated business rule |
| **Medium** | Slows every reader — long functions, deep nesting |
| **Low** | Polish — naming consistency, comment hygiene |

**Effort:** XS / S / M / L.

**Confidence:** High when the code itself proves it; Low when the judgment depends on intent you
cannot see. Report Low-confidence findings as questions, not verdicts.

> **High** — `getUser()` writes to the cache. The body proves the name is misleading.
> **Low** — two similar discount blocks. They may be one rule duplicated, or two rules that
> agree today. Ask: "are these the same rule? If yes, CC-007 applies; if no, say so in a
> comment so the next reader does not merge them."

**Budget.** At most three modules in one pass, at most 20 findings per module. Past that, say
what is queued and stop. A report nobody finishes is a report that changed nothing.

Order by Impact, then by lower Effort inside the same Impact, so quick wins come first. No
numeric score is emitted.

**Cap:** at most 20 findings per module. If more exist, report the top 20 and state the remaining
count per principle so nothing looks hidden.

### Step 4 — Refactor (REFACTOR mode only)

**Rule Zero: no behaviour-changing edits.** Tests green before *and* after every batch.

**Refactor is not rewrite.** Do not rewrite the feature, change business rules, change UI output,
switch the state-management pattern, or alter API contracts unless explicitly asked.

- One refactoring type per batch. Rename, extract, and restructure never share a batch.
- A rename touches every reference, including overrides and string-based lookups.
- A public API rename in a package ships a deprecation alias first.
- Anything needing a behaviour change, discovered mid-refactor → **stop that batch**, report it
  as an out-of-scope finding, and carry on with the rest.
- Once three batches in a row turn out to need behaviour changes, stop the whole pass and ask.
  At that point the request was not a refactor, and grinding on produces a patch that is mostly
  deferred items.

Full batching procedure, the safe/unsafe list, and rollback:
[references/refactor-batches.md](references/refactor-batches.md).

### Step 5 — Verify

Run these after every batch in REFACTOR mode, and once at the start of AUDIT so a pre-existing
failure is not attributed to the code under review.

```bash
flutter analyze                    # or: dart analyze   (pure Dart package)
dart format --set-exit-if-changed .
flutter test                       # or: dart test
```

**If neither `flutter` nor `dart` is on PATH:** do not guess, and do not claim the checks passed.
Continue report-only and write this line into the report verbatim:

> Verification skipped: no Dart or Flutter SDK found on PATH. Findings are static-reading only.

If `dart format` reports changes in files this pass never touched, leave them alone. That is
pre-existing formatting drift and it belongs to the analyzer, not to this report.

### Step 6 — Report

Emit the report in the format defined by
[references/report-template.md](references/report-template.md). For the depth and tone expected
of a finding, read [references/example-report.md](references/example-report.md) — a full worked
audit of one file.

**Say what you did not check.** Every report carries a `Not checked:` line in the header —
generated files skipped, files outside the scope ladder, modules queued for a later pass,
findings dropped by the cap. A report without its own limits reads as complete when it is not.

**Where it goes:**

- One file in scope → answer inline in the conversation; create no file.
- A feature or a module → write
  `docs/reviews/CLEAN-CODE-<AUDIT|REFACTOR>-<module>-<YYYY-MM-DD>.md`, creating `docs/reviews/`
  if needed, and say the path in your reply.
- If the user asked for an inline answer, honour that regardless of scope.

Re-running on the same module the same day overwrites that file instead of adding a second one.

**When the user asks for a machine-readable result** — to gate a build, or to feed a dashboard
— write `<same-name>.json` beside the markdown: an array of findings carrying `id`,
`principle`, `impact`, `effort`, `confidence`, `file`, `line` and `title`. Write it only on
request; nobody wants a JSON file they did not ask for.

---

## Evidence levels

State the level at the top of every report.

| Level | You have | What you may do |
|---|---|---|
| **Full** | Code + tests + project conventions | REFACTOR is safe to apply |
| **Partial** | Code only, no tests | AUDIT is safe; REFACTOR proposes a patch without applying it |
| **None** | A description of the code, no code | Blocked — see below |

**Blocked.** With no code in scope, stop and reply with three things only: the decision, the
reason, and the one action needed to unblock. Do not produce a generic checklist unless the user
then explicitly asks for one; if they do, label it as generic and untested against their code.

---

## Exit criteria

**AUDIT / DIFF**

- All seven principle areas checked.
- Every finding carries Impact, Effort, Confidence, and a `file:line` location.
- Out-of-scope items listed with a one-line reason.
- Evidence level stated.

**REFACTOR** — everything above, plus:

- Every verification command run, or the skipped-verification line written.
- Each batch independently revertable.
- No unrelated files changed. Characterization tests are not unrelated.
- No new lint suppression added without a written justification.
- UI output unchanged unless the user explicitly approved a change.

---

## Language

Arabic in → Arabic out. English in → English out. Code, identifiers, file paths and commands stay
in English either way.
