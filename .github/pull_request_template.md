## What changes

<!-- One or two sentences. What does the skill do differently after this PR? -->

## Type

- [ ] patch — wording, examples, typos; no behaviour change
- [ ] minor — a new mode, principle area, reference file, or checklist item
- [ ] major — a frontmatter field added or removed, or the repository shape changed

## Checklist

- [ ] `node --test` passes locally
- [ ] `node scripts/validate-skill.mjs` passes locally
- [ ] No sibling skill, plugin, tool, or external project is named anywhere
- [ ] The vocabulary table in AGENTS.md is respected; no banned synonym introduced
- [ ] Every new Dart snippet is valid Dart 3
- [ ] A new scanner signal ships with a unit test, a fixture case, and a header-comment line
- [ ] Reference files stay one level deep from SKILL.md
- [ ] `metadata.version` bumped unless this is a docs-only change

## Evaluations

Claim only what was actually run.

- [ ] Ran the scenarios in `evals/` against this change
- [ ] Not run — reason:

Model(s) used:

Results:
