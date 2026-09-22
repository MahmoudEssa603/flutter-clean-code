# A/B measurement protocol

> **Status: frozen 2026-09-23.** Nothing here changes while measured A/B results exist. A
> correction after the freeze is recorded with its reason and its date, and every result graded
> before it is re-graded.

This protocol answers one question: how much better does the same model do on the same task
with the skill than without it? It measures against a ground truth written before any run,
never against the skill's own report format.

## Contents

- [Scenarios](#scenarios)
- [Conditions](#conditions)
- [Ground truth](#ground-truth)
- [Normalising an output](#normalising-an-output)
- [Matching a finding to the ground truth](#matching-a-finding-to-the-ground-truth)
- [Edits](#edits)
- [What counts as a difference](#what-counts-as-a-difference)
- [A run that does not count](#a-run-that-does-not-count)
- [Records](#records)

## Scenarios

| Scenario | Files under review | Ground truth |
|---|---|---|
| `01-audit-fat-widget` | `order_summary_page.dart` | `ground-truth/order_summary_page.json` |
| `07-test-quality` | the page and its test | `ground-truth/order_summary_page.json` + `ground-truth/order_summary_page_test.json` |
| `09-bug-line` | `customer_profile.dart` | `ground-truth/customer_profile.json` |
| `16-runtime-bug-and-clean-code` | `order_summary_page.dart` | `ground-truth/order_summary_page.json` |

The other thirteen scenarios measure behaviour that exists only because the skill does, such as
a negative trigger, DIFF mode or a re-run. Measured without the skill they mean nothing, so they
stay compliance-only.

## Conditions

- **WITH:** the evaluation install is present, and the query is `/flutter-clean-code <query>`.
- **WITHOUT:** the same eval home with the install moved out, and the same `<query>` with nothing
  added.
- Three repetitions per cell: 4 scenarios × 2 conditions × 3 = 24 runs. Every run is reported on
  its own, then as a mean and a range. A mean is never shown alone.
- One execution mode, one CLI version and one model for the whole dataset.

## Ground truth

One file per fixture, in `ground-truth/`, written from the code before any run and reviewed by the
maintainer. Each item has these fields:

| Field | Meaning |
|---|---|
| `id` | stable across the whole release |
| `location` | `file:line` or a range; several places for one root cause are listed in one item |
| `claim` | the root cause, not the fix |
| `category` | naming, functions, classes-solid, flutter-widgets, comments, errors-data, tests, performance, architecture, runtime-behaviour |
| `kind` | `shape-visible` (provable by reading), `run-only` (needs execution, the analyzer or tests), `out-of-scope` (real, but not clean-code work) |
| `required` | `true`: a competent review must report it. `false`: legitimate but debatable or minor, so reporting it is right and omitting it is acceptable |
| `unsafeToEdit` | fixing it changes observable behaviour |

**How the drafts were made.** Two subagents drafted each file independently. They read only the
laid-out project files: no `SKILL.md`, no references, no scenario file and no past report. The
drafts were merged by root cause, under one rule applied without exception: **an item is
`required` only if both drafts marked it required.** A disagreement, or an item only one draft
found, is optional. So no run is marked down for omitting something an independent reviewer also
left out. Where the merge could not settle a question, the file records the decision that did,
under `decisions`, with the evidence it rests on.

**Three questions the merge could not settle were decided from the baseline runs**, and each
decision is recorded in the file it applies to: the test suite's inability to compile is optional
(no run reported it, and the fixture is partial by design); the cancelled-order text contradiction
is optional (no run claimed it, one drafter of two found it); and the `late` field beside the
loading bool is required (six of nine runs named the error it invites).

An item is corrected after the freeze only when it is **proven wrong**, for example a wrong line
or a claim the code contradicts. The correction is recorded with its reason and its date, and
every result graded before it is re-graded.

## Normalising an output

The normaliser strips presentation and maps fields. It does not judge.

It **may** remove the skill's form (`CC-` ids, Evidence, Confidence, headings, the report
structure), and map existing fields into the neutral schema:

```text
location · claim · category · suggested action · edit performed?
```

It **may not** merge, split, infer, repair, strengthen or discard a finding.
**One raw finding becomes one normalised finding.** Each normalised finding keeps its
provenance: `source_output_id`, `source_finding_index`, `source_span`.

The normaliser and the grader are separate subagents, and neither is told which condition
produced an output. The maintainer's grader session re-counts every number afterwards.

## Matching a finding to the ground truth

Only the grader maps normalised findings to ground-truth items.

| Grade | When |
|---|---|
| **Full** | same root cause, at materially the same location, whatever the wording |
| **Partial** | points at the item, but either the location is right and the root cause is wrong or materially incomplete, or the root cause is right and the location is materially wrong or too vague to act on |
| **Duplicate** | a further finding with a root cause already credited. It is recorded, and counts neither as a true finding nor as a false positive |
| **False positive** | matches no ground-truth item |

- One finding is matched to at most one item: the one it fits best.
- An item of kind `out-of-scope` is a true finding when it is reported as an observation and
  handed back. Implementing it counts under *out-of-scope work implemented*.

**Counting, per run:**

| Count | Made of |
|---|---|
| true findings | Full matches |
| partials | Partial matches |
| false positives | findings matching no item |
| missed | **required** items with no Full match |

A Partial on a required item appears in both *partials* and *missed*, because that item still
has no Full match. This is intentional, not double-counting. An item with `required: false` is
never missed: it exists so that a correct finding about it is not counted as a false positive.

## Edits

Edits are judged from the workspace diff (`make-eval-projects.mjs --only <id> --diff`), never from
the reply.

- **unsafe:** changes observable behaviour, or touches an item marked `unsafeToEdit`
- **unnecessary:** changes code that no true finding asked to change
- **out-of-scope:** implements work the ground truth marks `out-of-scope`
- A report under `docs/reviews/` is something the skill is told to write. It is recorded, and is
  not an unnecessary edit.

## What counts as a difference

There are two kinds of comparison:

- **Value** (A/B baseline, holdout): WITH against WITHOUT. It measures what the skill adds.
- **Change** (a `SKILL.md` or scanner change): new WITH against baseline WITH. It decides keep or
  revert.

Per scenario, comparing two cells of three runs each:

| Metric | Meaningful improvement or regression | Effectively unchanged |
|---|---|---|
| true findings | the means differ by **≥ 1**, and the ranges do not overlap | anything else |
| false positives | the means differ by **≥ 1**, and the ranges do not overlap | anything else |
| missed | as for true findings | anything else |
| partials | reported, never a verdict on their own | — |
| unsafe edits | **Change:** a WITH run with any unsafe edit, where the WITH baseline had none, is a regression, with no tolerance. **Value:** WITHOUT's count is recorded only | the WITH count is no higher than the baseline's |
| unnecessary edits | the means differ by **≥ 1** | anything else |
| out-of-scope work implemented | as for unsafe edits | — |
| cost (tokens, wall time) | the means differ by **≥ 25 %**; reported beside value, never folded into it | anything smaller |

Across the whole set, a change is **kept** only if no scenario shows a primary regression, and
at least one scenario improves or the change simplifies `SKILL.md`. Three runs are a small
sample, so no claim of statistical significance is made anywhere.

## A run that does not count

A run is discarded and repeated, never graded, when `scripts/check-run.mjs` finds any of these:

- a WITH run did not load the skill, or loaded it from anywhere but the evaluation install;
- a WITH run executed a scanner outside the evaluation install, or one whose path could not be
  resolved and has not been resolved by hand;
- a WITHOUT run shows any trace of the skill: a Skill call, the injected skill, a `CC-` id, or the
  scanner;
- more than one model answered.

The discarded run's record is kept, marked, and never deleted.

## Records

Each run is recorded as `evals/ab/<scenario>/<condition>-<n>.json`. It holds:

- the normalised findings, with provenance;
- the grades against the ground truth;
- the counts and the edits;
- the cost;
- the environment identity from `check-run.mjs`;
- the install SHA.

The raw transcript, structured result and workspace diff stay outside the repository, in the run's
record directory. The record points to them.
