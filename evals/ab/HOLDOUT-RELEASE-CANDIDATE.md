# The holdout, re-measured against the 1.7.0 release candidate

Thirty runs on 2026-09-24: 5 files × 2 conditions × 3 repetitions, headless, in the isolated
evaluation install (`04ef2b5`), CLI 2.1.278, `claude-opus-5`, effort `xhigh`, permission mode
`auto`. All 30 valid under `check-run.mjs`, and every source file byte-identical afterwards.
Cost: $36.08.

This repeats [HOLDOUT.md](HOLDOUT.md) — the same five real files, the same frozen keys, the same
blind pipeline — against the surface about to ship. **It is measured, not tuned against:** a
holdout-only result motivates nothing on its own.

## What this round found

Three runs per cell. A difference counts only when the means differ by at least 1 **and** the
ranges do not overlap.

| Case | true findings WITH | WITHOUT | verdict | required missed (adjusted) WITH / WITHOUT |
|---|---|---|---|---|
| H1 animated screen | 18, 14, 16 → 16.0 | 14, 14, 14 → 14.0 | ranges touch — unchanged | 0.3 / 1.0 |
| H2 application page | 8, 9, 9 → 8.7 | 8, 11, 10 → 9.7 | unchanged | 0.0 / 0.0 |
| H3 engine class | 7, 9, 5 → 7.0 | 7, 8, 5 → 6.7 | unchanged | 0.3 / 0.7 |
| H4 plugin facade | 6, 6, 5 → 5.7 | 8, 6, 5 → 6.3 | unchanged | 0.7 / 1.3 |
| H5 test suite | 7, 6, 7 → 6.7 | 8, 7, 6 → 7.0 | unchanged | 1.0 / 1.0 |

**No case reaches the threshold on true findings**, where the first round found two that did.
Across all thirty runs the required items missed are 0.47 per run with the skill against 0.80
without — the skill misses fewer in three of the five cases and ties the other two — but that gap
is smaller than a single finding and is reported rather than claimed.

## Reading it against the first round

| | first round | this round |
|---|---|---|
| H1 true findings, WITH / WITHOUT | 16.3 / 12.3 | 16.0 / 14.0 |
| H2 true findings, WITH / WITHOUT | 11.3 / 9.0 | 8.7 / 9.7 |
| H3, H4, H5 | unchanged in both | unchanged in both |

**The honest reading is that absolute counts do not carry across grading rounds.** H2's WITH mean
fell from 11.3 to 8.7 while its WITHOUT mean rose from 9.0 to 9.7; nothing in the surface explains
a change that size in both directions at once, and the two rounds were graded by different blind
graders against the same frozen key. What compares within a round is the two conditions against
each other, and within this round the answer is: no meaningful difference on these five files,
with the missed-item column leaning the skill's way.

That is not a regression against the first round so much as a reminder of what the first round
already said — the gap follows the shape of the file, and it was never large on H3, H4 or H5. It
does weaken the claim the first round made for H1 and H2, and the claim is weakened here rather
than re-argued.

## Accuracy

Across 30 runs and 528 graded entries, **one** asserts something untrue: a run claimed two `Icon`
constructions could be `const` when one of the two, at `send_page.dart:233`, already is. Another
output in the same set read both lines correctly. Two near-misses were kept as true-but-unkeyed
because only a count was off and the defect itself holds — `Theme.of(context)` called six times
reported as five, and 22 package imports reported as nine.

Every claim the key does not hold was checked against the source before being classified, and
where a claim was mechanically checkable the graders ran the check: `awk` over the file for the
over-80-column lines, `dart format --set-exit-if-changed` for the formatting claims, and
`.dart_tool/package_config.json` for an SDK-version claim.

## Two gaps in the keys, recorded not fixed

The keys are frozen, so these are written down for the next round rather than patched into a
measurement already taken.

- **H3 has no item for the `componentsNotifier<T>()` cache lookup.** It matches on
  `notifier is ComponentsNotifier<T>`, and because Dart generics are covariant a narrower notifier
  registered earlier is returned for a broader request, against the doc's one-per-type promise.
  Three H3 outputs reported it, it is true of the code, and under the rules each was recorded as a
  false positive.
- **"This project has no tests" recurs in seven outputs across three cases and is true**, but only
  H2 carries a tests item and that item is about the design being reachable only through the UI.
  Those seven are recorded as false positives too.
- **H4-01 and H4-06 overlap**: H4-01 bundles the silent discard of the deprecated arguments with
  the doc that still presents them as live, and H4-06 is that doc limb on its own. The grader
  credited H4-01 only where the discard is actually stated, and says three H4 numbers would move
  under the other reading.

`H5-01` was missed by all six H5 runs again, as it was in the first round: no run says the
`'infinite fade out'` test steps by the effect's own duration and so never observes the repetition
it is named for. Two rounds, four graders, twelve runs, and nothing has ever caught it.

Records: `evals/ab/holdout-release-candidate/<case>/<condition>-<n>.json`.
