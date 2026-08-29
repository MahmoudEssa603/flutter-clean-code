# Contributing

The governance rules live in [AGENTS.md](AGENTS.md) — vocabulary, conventions, the frontmatter
contract, the self-containment rule, and the release policy. Read that first. This file covers
how to get a change merged.

## What counts as a change to this skill

Four invariants. A pull request that breaks one of them will not merge, however good the idea is.

1. **The skill stays self-contained.** No sibling skill, plugin, marketplace, internal document,
   or specific project layout is named anywhere. Out-of-scope work is reported as an observation
   and the routing decision is left to the user.
2. **The skill judges, the analyzer enforces.** Anything a lint rule can catch deterministically
   belongs to `dart analyze`, not here. If a proposed finding could be a lint, it is a lint.
3. **Rule Zero is not negotiable.** No path through the skill may apply a behaviour-changing edit,
   and no path may claim a verification command passed without having run it.
4. **The frontmatter stays at the portable six.** Adding a seventh field breaks packaging outside
   Claude Code and is a major-version decision.

## Before you open a pull request

```bash
node --test
node scripts/validate-skill.mjs
node scripts/scan-dart.mjs evals/fixtures
```

`node --test` runs the unit suite over the scanner's parsing and the integration suite over the
validator's gates. Each gate is proven by breaking the repository on purpose in a temp copy and
asserting the run fails — see [test/README.md](test/README.md).

`validate-skill.mjs` checks the frontmatter fields and limits, the body line count, that every
`references/` file is linked from `SKILL.md` and links to no other reference file, that long
reference files carry a Contents list, that no forbidden name appears, that no banned synonym
appears, that `scripts/` imports nothing outside Node built-ins, and that the evals and test
suites are present and well formed.

`scan-dart.mjs` against the fixtures is the scanner's smoke test: it must find the planted signals
in `order_summary_page.dart` and skip `order.freezed.dart` without being told to.

Node built-ins only — there is nothing to install.

Then run the scenarios in [evals/](evals/) by hand against your change and record the outcome in
the pull request. See [evals/README.md](evals/README.md).

## Changing the checklist

The Step 2 checklist is the skill's core, so a new item carries more weight than a new paragraph
anywhere else. A new checklist item needs all four of these:

- **A cost.** What does a reader or a maintainer lose when this goes unfixed? "It is not clean"
  is not a cost.
- **A before/after pair** in `references/dart-examples.md`, in valid Dart 3.
- **A not-a-finding case.** When does this pattern look like a smell and is fine? If you cannot
  produce one, the rule is probably too broad and will generate noise.
- **Proof it is not already a lint.** Search `analysis_options.yaml` documentation first. If Dart
  has a rule for it, the item belongs in the analyzer note, not the checklist.

Removing a checklist item needs one thing: a case where it produced a wrong or noisy finding.

## Changing examples

Every snippet in `references/dart-examples.md` must be valid Dart 3 that the analyzer accepts,
apart from deliberate `...` elisions. Show the smallest code that carries the point. A 60-line
before block teaches less than a 12-line one.

Keep the before and after in separate fenced blocks, both labelled, so a reader skimming the file
can tell them apart without reading the code.

## Changing the scanner

`scan-dart.mjs` measures; it never decides. Four rules hold it there:

- It never prints the word finding, and its exit code is always 0. It is a measuring tool, not a
  gate.
- Every threshold carries a comment naming the rule in `SKILL.md` it serves. A number nobody can
  justify is a number nobody should trust.
- A new signal needs four things in the same pull request: a unit test proving it fires, a unit
  test proving it stays quiet, a case in `evals/fixtures/order_summary_page.dart`, and a line
  in that fixture's header comment.
- Side effects stay behind the `main()` guard so every function remains importable and
  testable.

It blanks comments and string literals and counts braces — it is a heuristic, not a Dart parser.
When that is not enough for a new signal, report less rather than guessing.

## Changing the eval fixtures

Do not clean up `evals/fixtures/`. Those files are deliberately unclean and every planted problem
is listed in the header comment of `order_summary_page.dart`. If you add a planted finding, add it
to that header comment and to the scenario that checks for it, in the same pull request.

## Review

One maintainer reads the whole diff, including every word of the frontmatter, because the
`description` is what decides whether the skill fires at all.

Two pull requests changing the same checklist area: the one that ships the before/after pair and
the not-a-finding case merges first. Ties break on eval evidence, then on which opened first.

## Releases

Annotated tags, `vMAJOR.MINOR.PATCH`, matching `metadata.version` in `SKILL.md`. The bump rules
and the pre-publication checklist are in [AGENTS.md](AGENTS.md).

## Claims

State only what was demonstrated. "Evals run on Opus, 5/5 passed" is a claim someone can check.
"Evals written, not yet run" is a fine state to ship. An unverified claim is not.
