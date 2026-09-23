# The A/B set, re-measured against the 1.7.0 release candidate

Twenty-four runs on 2026-09-24: 4 scenarios × 2 conditions × 3 repetitions, headless, in the
isolated evaluation install (`04ef2b5`), CLI 2.1.278, `claude-opus-5`, effort `xhigh`, permission
mode `auto`. All 24 valid under `check-run.mjs`. Cost: $32.08.

This repeats [RESULTS.md](RESULTS.md) — the baseline taken before any 1.7.0 change to the
model-facing surface — against the surface about to ship: `SKILL.md` Step 6 rewritten three times
(D5, D6, D7) and the scanner's repeated literals grouped into one signal (E2). Same frozen
protocol, same frozen ground truth, same blind pipeline: opaque ids, a normaliser and a grader who
are never told the condition, and every number re-counted here afterwards.

**What it is for:** to show the changes cost nothing. A compliance sweep says reports follow the
contract; it cannot say whether they still find as much.

## Findings, per scenario

Three runs per cell. A difference counts as meaningful only when the means differ by at least 1
**and** the ranges do not overlap.

| Scenario | metric | WITH | WITHOUT |
|---|---|---|---|
| `01` one fat widget | true findings | 20, 22, 19 → 20.3 | 23, 28, 27 → **26.0** |
| | required missed (adjusted) | 3, 2, 1 → 2.0 | 2, 1, 2 → 1.7 |
| `07` a feature with tests | true findings | 27, 29, 30 → 28.7 | 20, 26, 36 → 27.3 |
| | required missed (strict) | 10, 12, 10 → **10.7** | 19, 16, 11 → 15.3 |
| | required missed (adjusted) | 3, 3, 4 → **3.3** | 10, 7, 7 → 8.0 |
| `09` one small file | true findings | 5, 5, 5 → 5.0 | 4, 5, 5 → 4.7 |
| | false positives | 3, 5, 6 → 4.7 | 1, 1, 1 → 1.0 |
| `16` a mixed request | true findings | 23, 23, 19 → **21.7** | 10, 13, 10 → 11.0 |
| | required missed (strict) | 6, 6, 8 → **6.7** | 14, 14, 15 → 14.3 |
| | required missed (adjusted) | 2, 2, 2 → **2.0** | 8, 7, 6 → 7.0 |

## Against the baseline

| | | baseline | candidate |
|---|---|---|---|
| `16` | true findings, WITH | 21.3 | 21.7 |
| | true findings, WITHOUT | 14.7 | 11.0 |
| | required missed adjusted, WITH | 1.7 | 2.0 |
| | required missed adjusted, WITHOUT | 7.0 | 7.0 |
| `07` | required missed adjusted, WITH | 3.7 | 3.3 |
| | required missed adjusted, WITHOUT | 11.7 | 8.0 |
| `01` | true findings, WITH | 22.0 | 20.3 |
| | true findings, WITHOUT | 26.7 | 26.0 |
| `09` | true findings, WITH | 5.0 | 5.0 |

**Every cell moved by less than the threshold, and every verdict is the one the baseline gave.**
The skill's advantage is where it was: largest on the mixed request, where it finds twice what the
same model finds without it and misses a third of what that model misses; clear on the two-file
scope with tests; absent on the 45-line file; and negative on the single fat widget, where the
model without the skill lists more that the key holds.

## Accuracy, again

**Across 24 runs and 591 graded entries, not one asserts anything untrue about the code.**
Both graders checked every unkeyed claim against the fixture before classifying it, and ran
`dart format --set-exit-if-changed` to settle the formatting ones. That is the second set of 24
runs to come back with a zero in that column.

One factual slip sits inside a finding that was credited: a run counted `EdgeInsets.all(17)` eight
times where the file has nine. It is a WITHOUT run — no scanner — which is where every miscount of
that number has come from since the scanner started stating the count itself.

## Edits

From the workspace diff, never from the reply.

| | WITH (12 runs) | WITHOUT (12 runs) |
|---|---|---|
| Dart files changed | **none** | 3 — the page rewritten in all three runs of `16`, each also editing `pubspec.yaml` |
| report files written | 3 (scenario `07`, to `docs/reviews/`) | none |

The shape the baseline found holds: asked to fix a crash and clean the code, the model without the
skill edits the file; with the skill it reports and hands the crash back.

Records: `evals/ab/release-candidate/<scenario>/<condition>-<n>.json`, one per run, carrying the
grades, the counts, the identity and the cost.
