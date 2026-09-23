# A/B baseline — what the skill adds, measured

24 runs on 2026-09-23: 4 scenarios × 2 conditions × 3 repetitions, headless, in the isolated
evaluation install (`eefe610`), CLI 2.1.278, `claude-opus-5`, effort `xhigh`, permission mode
`auto`. Every run passed `check-run.mjs`: the skill loaded from the evaluation install in the WITH
runs, no scanner outside it ran, and no WITHOUT run shows a trace of the skill. Cost: $33.70.

Each run is recorded in `<scenario>/<condition>-<n>.json`, with its blind id, its counts, its
edits and its cost. Outputs were normalised and graded by subagents that were not told which
condition produced which output.

## Contents

- [How to read the two columns](#how-to-read-the-two-columns)
- [Findings, per scenario](#findings-per-scenario)
- [Edits](#edits)
- [Cost](#cost)
- [What this does and does not show](#what-this-does-and-does-not-show)

## How to read the two columns

Every metric is given twice.

**Strict** is the frozen rubric exactly: one normalised entry matches at most one ground-truth
item, and an entry matching no item is a false positive.

**Adjusted** exists because the data showed the strict rubric measuring something other than what
it set out to. Two corrections, both recorded per item by the graders, both applied uniformly
(see the amendment in `README.md`):

- A required item stated inside an entry credited to a neighbouring item counts as **identified**.
  A report that puts nine `EdgeInsets.all(17)` sites in one finding names all nine; strictly it
  scores one and misses eight.
- A false positive counts only when the entry **asserts something untrue**. An entry that is true
  about the code but absent from the key, or that asserts no defect at all — a hand-back, an open
  question, a "considered and deliberately left" — is counted in its own column.

## Findings, per scenario

Three runs per cell, then the mean. A difference is called meaningful only when the means differ
by at least 1 **and** the two ranges do not overlap.

### 01 — audit one fat widget

| metric | WITH | mean | WITHOUT | mean | verdict |
|---|---|---|---|---|---|
| true findings (strict) | 23, 21, 22 | 22.0 | 25, 25, 30 | 26.7 | meaningful, WITHOUT higher |
| true findings (adjusted) | 27, 27, 30 | 28.0 | 29, 28, 32 | 29.7 | unchanged |
| missed required (strict) | 5, 7, 8 | 6.7 | 5, 7, 3 | 5.0 | unchanged |
| missed required (adjusted) | 1, 1, 0 | 0.7 | 1, 4, 1 | 2.0 | unchanged |
| false positives (strict) | 3, 2, 6 | 3.7 | 4, 2, 1 | 2.3 | unchanged |
| — untrue claims | 0, 0, 0 | 0.0 | 0, 0, 0 | 0.0 | |

### 07 — audit a feature, tests included

| metric | WITH | mean | WITHOUT | mean | verdict |
|---|---|---|---|---|---|
| true findings (strict) | 30, 29, 31 | 30.0 | 19, 34, 29 | 27.3 | unchanged |
| true findings (adjusted) | 36, 34, 36 | 35.3 | 25, 37, 30 | 30.7 | unchanged |
| missed required (strict) | 9, 9, 9 | 9.0 | 21, 11, 13 | 15.0 | meaningful, WITHOUT higher |
| missed required (adjusted) | 3, 4, 4 | 3.7 | 15, 8, 12 | 11.7 | meaningful, WITHOUT higher |
| false positives (strict) | 5, 5, 2 | 4.0 | 0, 4, 1 | 1.7 | unchanged |
| — untrue claims | 0, 0, 0 | 0.0 | 0, 0, 0 | 0.0 | |

The WITH cell is the tightest in the dataset: 9, 9, 9 missed strictly, 36, 34, 36 found. The
WITHOUT cell swings from 19 to 34 true findings depending on where the run chose to look; one of
its three runs reviewed the test file almost exclusively and left 15 required items on the page
untouched.

### 09 — one small file with a planted bug

| metric | WITH | mean | WITHOUT | mean | verdict |
|---|---|---|---|---|---|
| true findings (strict and adjusted) | 5, 5, 5 | 5.0 | 4, 5, 4 | 4.3 | unchanged |
| missed required | 0, 0, 0 | 0.0 | 0, 0, 0 | 0.0 | unchanged |
| false positives (strict) | 7, 7, 3 | 5.7 | 1, 1, 2 | 1.3 | meaningful, WITH higher |
| — untrue claims | 0, 0, 0 | 0.0 | 0, 0, 0 | 0.0 | |
| — correct but unkeyed | 2, 4, 2 | 2.7 | 1, 0, 1 | 0.7 | |
| — assert no defect | 5, 3, 1 | 3.0 | 0, 1, 1 | 0.7 | |

Both required items — `copyWith` dropping `nickname`, and `reload()` that never reloads — were
found by all six runs. On a 45-line file the skill adds no detection at all.

### 16 — "fix this crash and clean the code"

| metric | WITH | mean | WITHOUT | mean | verdict |
|---|---|---|---|---|---|
| true findings (strict) | 24, 20, 20 | 21.3 | 17, 14, 13 | 14.7 | meaningful, WITH higher |
| true findings (adjusted) | 28, 26, 27 | 27.0 | 20, 20, 20 | 20.0 | meaningful, WITH higher |
| missed required (strict) | 5, 9, 8 | 7.3 | 11, 14, 12 | 12.3 | meaningful, WITHOUT higher |
| missed required (adjusted) | 1, 3, 1 | 1.7 | 8, 8, 5 | 7.0 | meaningful, WITHOUT higher |
| false positives (strict) | 7, 5, 4 | 5.3 | 3, 3, 2 | 2.7 | meaningful, WITH higher |
| — untrue claims | 0, 0, 0 | 0.0 | 0, 0, 0 | 0.0 | |

## Edits

Judged from the workspace diff, never from the reply.

| | WITH (12 runs) | WITHOUT (12 runs) |
|---|---|---|
| code files changed | **0** | 3 runs, all in 16 |
| lines added / removed | 0 | 245/182, 278/185, 240/170 |
| ground-truth items marked `unsafeToEdit` touched | **0** | 12 per run |
| reports written under `docs/reviews/` | 3 (scenario 07, as the skill instructs) | 0 |

All three edits are in 16, whose query asks for a fix. The WITHOUT runs rewrote the page — adding
an error state, a `dispose`, `mounted` guards, an enum for the status — with no tests in the
project to show behaviour was preserved. The WITH runs proposed the same work as unapplied
batches and said why they were not applying it. Under the protocol this is recorded, not scored
against WITHOUT: the request invited a fix.

## Cost

| cell | output tokens | tool calls | wall seconds | $ |
|---|---|---|---|---|
| 01 WITH / WITHOUT | 28,827 / 6,943 | 13 / 2.7 | 409 / 100 | 1.63 / 0.46 |
| 07 WITH / WITHOUT | 47,515 / 11,162 | 21 / 10 | 558 / 172 | 2.65 / 0.90 |
| 09 WITH / WITHOUT | 16,306 / 1,671 | 10 / 2 | 247 / 26 | 1.19 / 0.32 |
| 16 WITH / WITHOUT | 31,934 / 37,525 | 11 / 25 | 404 / 881 | 1.60 / 2.49 |

The skill costs three to five times a bare run — except on 16, where the bare runs cost more and
took twice as long, because they carried out the rewrite.

## What this does and does not show

**Across 24 runs, not one output asserted anything untrue about the code.** Both conditions are
accurate; they differ in what they cover, what they hand back, and what they touch.

**Where the skill adds nothing measurable:** a single small file (09), and a single fat widget
(01). On 01 the bare model found slightly more, and the adjusted numbers make the two
indistinguishable.

**Where it adds most:** the mixed request (16) and the two-file scope with tests (07). Both are
cases where a bare run has to choose what to look at, and chooses narrowly — the crash, or the
test file. The skill's seven areas and its cap are what make those runs cover the rest.

**Consistency is a real difference the means hide.** WITH cells vary little run to run (07: 9, 9,
9 missed; 09: 5, 5, 5 found). WITHOUT cells swing (07: 19 to 34 found, 21 to 11 missed). A team
that wants the same review twice gets it from the skill.

**The false-positive column measures scope prose, not error.** Every strict false positive in the
WITH runs is a hand-back, a deliberate non-finding, or a note about tooling. That is the skill's
Out of Scope section doing its job, and the strict rubric counting it as noise.

**Three repetitions is a small sample.** No claim of statistical significance is made anywhere,
and no threshold was chosen after seeing these numbers.
