# Does stating a rule in `SKILL.md` make reports follow it?

Parts of the report contract lived only in `references/report-template.md`, which a run may or may
not open. The isolated re-baseline showed them being broken, so at 1.7.0 they were stated in Step 6
of `SKILL.md` itself — first the title and the batches (D5), then the whole skeleton (D6). This is
the measurement of what each changed.

Every number here comes from `check-report.mjs` run over the report the record holds, not over what
a run said about itself. Every run is one run: single cells, no repetitions, so a difference of one
or two problems is noise and only the large moves are read.

## D5 — the title and the batches

Six scenarios, every one whose baseline run proposed batches, re-run once each. All valid, none
changed a file, $11.02.

| Scenario | Before | After |
|---|---|---|
| `02-refactor-without-tests` | 5 problems | passes |
| `03-out-of-scope-routing` | 3 problems | passes |
| `13-architecture-and-clean-code` | 6 problems | passes |
| `14-performance-and-clean-code` | 4 problems | passes |
| `16-runtime-bug-and-clean-code` | 3 problems | passes |
| `17-activation-on-a-mixed-request` | 2 problems | passes |

Twenty of the twenty-three problems were a batch with no `diff` block, two were a title carrying a
qualifier — `REFACTOR (proposed)`, `REFACTOR (patches unapplied)` — and one was a `Location`
reading "see table". `03` contributes nothing to the batch half: it audited this time, which is
what its scenario declares, so it passed without proposing a batch at all.

## The full sweep, and what it found instead

All seventeen scenarios on the same surface, one run each, all valid, $25.75. Passing the contract
went from **4 of 16 to 11 of 16** — `04` is left out of both, because it never names the skill and
so writes no report. But five scenarios went the other way, and the reason is not in the table.

**A run may or may not open the template, and that is a property of the run, not of the scenario:**
the set that opens it changes between phases. Split both phases by it:

| | runs that opened the template | runs that did not |
|---|---|---|
| Phase B | 23 problems over 10 runs | 6 problems over 6 runs |
| after D5 | **3 problems over 8 runs** | **49 problems over 8 runs** |

D5 did what it was meant to for a run reading the template, and the opposite for a run working from
memory. When the template is not opened, the only thing carrying the format is `SKILL.md` — and D5
had rewritten exactly those words: "its Impact, its Effort, its Confidence" became "its three
ratings", and the `Not checked` line lost "in the header".

`09` then wrote every finding as `### CC-001 — … — High / XS / High confidence`, with no labelled
fields, no header lines and no Summary table: 29 problems, where the same scenario passed cleanly at
Phase B. `03` and `17` lost their header fields the same way. `06` and `12` wrote `Confidence:
Low — reported as a question`, a field carrying a value and an argument.

## D6 — the whole skeleton, and the result

Step 6 now names the skeleton in order: the title, the five header fields, the Summary table, each
finding as its own `### CC-nnn` section with `Impact`, `Effort`, `Confidence` and `Location` as
labelled fields carrying one value each, then the batches. It says outright that ratings folded into
a heading, or a header line left out, is a different report.

The five that regressed, re-run with two controls that had passed. All valid, $10.71.

| Scenario | after D5 | after D6 | opened the template? |
|---|---|---|---|
| `03-out-of-scope-routing` | 7 problems | **passes** | **no** |
| `09-bug-line` | 29 problems | **passes** | **no** |
| `06-diff-mode` | 3 problems | passes | yes |
| `12-rerun-rejudges` | 5 problems | passes | yes |
| `17-activation-on-a-mixed-request` | 8 problems | passes | yes |
| `02-refactor-without-tests` (control) | passes | passes | yes |
| `14-performance-and-clean-code` (control) | passes | passes | yes |

**`03` and `09` are the evidence.** Both passed without opening the template at all — the exact path
D5 had broken, now conforming from `SKILL.md`'s words alone. The other three read the template this
time where they had not before, so their improvement is confounded and is not counted as evidence;
they are recorded because a change that fixed two and broke three would matter.

## Decision

**Both kept.** The rules stay in `SKILL.md`. What made the difference is not that a rule was moved
but that it was written out in full: "its three ratings" and "its Impact, its Effort, its
Confidence" are the same rule to a reader who has the template open, and not the same rule at all to
one who does not.

Run records: `D:/eval-records/d5-check/`, `D:/eval-records/final-1.7.0/`, `D:/eval-records/d6-check/`.
