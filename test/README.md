# Tests

Two levels, both on Node built-ins only. There is nothing to install.

```bash
node --test                      # everything
node --test test/scan-dart.test.mjs
```

| File | Level | Covers |
|---|---|---|
| `scan-dart.test.mjs` | unit | The scanner's parsing: comment and string blanking, brace matching, parameter counting, generated-file detection, duplication merging |
| `validate-skill.test.mjs` | integration | Every gate in `validate-skill.mjs`, by copying the repository, breaking one thing, and asserting the exit code is 1 |

## Why the validator is tested by breaking things

A validator that only ever prints `All checks passed` is worse than no validator:
it reads as evidence while proving nothing. Each test copies the repository to a
temp directory, introduces exactly one fault, and asserts the run fails with the
right message. The copy is removed whether the test passes or not.

The first test asserts the opposite — that the repository as committed passes —
so a gate that fires on everything is caught too.

## Adding a signal to the scanner

A new signal needs three things in the same pull request:

1. A unit test here that proves it fires, and one that proves it stays quiet.
2. A case in `evals/fixtures/order_summary_page.dart` that triggers it.
3. A line in that fixture's header comment saying what was planted.

## Known limitations, tested on purpose

`findFunctions` does not measure arrow bodies (`int double(int a) => a * 2;`) —
there are no braces to match. There is a test asserting that, so the limitation
stays visible instead of being rediscovered as a bug.
