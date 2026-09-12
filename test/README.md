# Tests

Six suites at two levels, both on Node built-ins only. There is nothing to install.

```bash
node --test                      # everything
node --test test/scan-dart.test.mjs
```

| File | Level | Covers |
|---|---|---|
| `scan-dart.test.mjs` | unit | The scanner's parsing: comment and string blanking, brace matching, parameter counting, generated-file detection, duplication merging |
| `check-report.test.mjs` | unit | The report contract: the three judgements on every finding, the 20-finding cap, what counts as a location, the sections that must exist, and the re-run exemption from the numbering checks |
| `check-evals.test.mjs` | unit | The eval registry: no PASS sitting over a recorded partial or failure, no scenario without a record, and a verdict short of PASS that says what fell short |
| `validate-skill.test.mjs` | integration | Every gate in `validate-skill.mjs`, by copying the repository, breaking one thing, and asserting the exit code is 1 |
| `make-eval-projects.test.mjs` | integration | The generator: every scenario has a layout, it refuses a directory holding anything it does not manage, and `--verify` tells a run's edits from what a legitimate pass leaves behind |
| `make-baseline.test.mjs` | integration | That a checkout in a differently named folder still matches the baseline — and that the directory-name NOTE really does fire there, so the first test means something |

## Why the validator is tested by breaking things

A validator that only ever prints `All checks passed` is worse than no validator:
it reads as evidence while proving nothing. Each test copies the repository to a
temp directory, introduces exactly one fault, and asserts the run fails with the
right message. The copy is removed whether the test passes or not.

The first test asserts the opposite — that the repository as committed passes —
so a gate that fires on everything is caught too.

## Adding a signal to the scanner

A new signal needs four things in the same pull request, the same four
[CONTRIBUTING.md](../CONTRIBUTING.md) asks for:

1. A unit test here that proves it fires.
2. A unit test here that proves it stays quiet.
3. A case in `evals/fixtures/order_summary_page.dart` that triggers it.
4. A line in that fixture's header comment saying what was planted.

## Known limitations, tested on purpose

`findFunctions` does not measure arrow bodies (`int double(int a) => a * 2;`) —
there are no braces to match. There is a test asserting that, so the limitation
stays visible instead of being rediscovered as a bug.
