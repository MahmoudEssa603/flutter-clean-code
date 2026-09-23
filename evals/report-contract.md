# Does moving a rule into `SKILL.md` make reports follow it?

Two rules of the report contract lived only in `references/report-template.md`, which a run reads
once at the start: the exact form of the title, and a `### Batch N` heading plus a fenced `diff`
block for every batch. The isolated re-baseline showed both being broken, so at 1.7.0 they were
stated in Step 6 of `SKILL.md` itself. This is the measurement of what that changed.

## The measurement

Six scenarios — every one of the seventeen whose run proposed batches — re-run once each, in the
isolated evaluation install, headless, `claude-opus-5` at effort `xhigh`, permission mode `auto`.
All six valid under `check-run.mjs`, none changed a file, $11.02 for the set. The before column is
the Phase B re-baseline; both columns are `check-report.mjs` run over the report the record holds,
not over what the run said about itself.

| Scenario | Before the rule moved | After |
|---|---|---|
| `02-refactor-without-tests` | 5 problems | passes, 17 findings |
| `03-out-of-scope-routing` | 3 problems | passes, 19 findings |
| `13-architecture-and-clean-code` | 6 problems | passes, 16 findings |
| `14-performance-and-clean-code` | 4 problems | passes, 20 findings |
| `16-runtime-bug-and-clean-code` | 3 problems | passes, 17 findings |
| `17-activation-on-a-mixed-request` | 2 problems | passes, 8 findings |

Twenty-three problems to none. Twenty of the twenty-three were a batch with no `diff` block, two
were a title carrying a qualifier — `REFACTOR (proposed)`, `REFACTOR (patches unapplied)` — and
one was a `Location` reading "see table".

## What the table does not say

**`03` contributes nothing to the batch half.** Before, it chose REFACTOR and wrote six batches,
three without a `diff` block. After, it audited — which is what the scenario declares — and wrote
no batches at all, so it passes without exercising the rule. Five scenarios proposed batches after
the change, and all five gave every batch a heading and a hunk. Before, five of five had missed at
least one.

**The titles were fixed where they were broken.** `13` and `16` wrote the two malformed ones and
both now read `# Clean Code — REFACTOR — <module>`.

**Finding counts moved within the noise already measured.** Raw `CC-` counts went 20→17, 18→19,
19→16, 18→20, 20→17 and 12→8. Three repetitions of one scenario in the A/B set vary by up to four
raw findings with nothing changed at all, so none of these is a signal on one run per cell. The
one to watch is `17` at 12→8, the largest drop and the only two-file scope; it is recorded here
rather than explained away, and the final sweep runs it again.

## Decision

**Kept.** The rule stays in `SKILL.md`. Reports that could not be checked against the contract
now pass it, the two-file scenario is flagged for the final sweep, and the template keeps the
worked example the step points at.

Run records: `D:/eval-records/d5-check/<scenario>/with-1/`.
