# Refactor batches — procedure, safety list, rollback

Read this before applying any change in REFACTOR mode. AUDIT and DIFF modes never need it.

## Contents

- [Rule Zero](#rule-zero)
- [What a batch is](#what-a-batch-is)
- [The batch loop](#the-batch-loop)
- [Safe without tests](#safe-without-tests)
- [Never safe without tests](#never-safe-without-tests)
- [Characterization tests](#characterization-tests)
- [Rollback](#rollback)
- [Stop conditions](#stop-conditions)

---

## Rule Zero

No behaviour-changing edits. The test suite is green before a batch and green after it, and the
two runs cover the same tests.

If you cannot prove behaviour is preserved, the change is not a refactor. Either write a
characterization test that proves it, or emit the patch unapplied and marked
`NOT APPLIED — requires approval`.

**Refactor is not rewrite.** Out of bounds unless the user explicitly asked:

- rewriting a feature
- changing a business rule, a threshold, or a default
- changing what the user sees or the order in which they see it
- switching the state-management pattern
- altering an API contract, a route name, or a serialised field name

## What a batch is

One refactoring type, applied across one scope, verified once.

| Batch type | Example |
|---|---|
| **Rename** | `getUser` → `fetchUser` across the module |
| **Extract** | one fat `build()` split into three widget classes |
| **Split** | one god class divided by responsibility |
| **Inline** | a needless indirection removed |
| **Signature** | positional parameters converted to named |

Never mix two types in one batch. A rename buried inside an extraction makes the diff unreviewable
and makes a bisect useless when something breaks later.

Keep a batch under roughly 10 files. A larger scope becomes two batches of the same type.

## The batch loop

For every batch, in this order:

1. **State the intent** — type, scope, and why it is behaviour-preserving. One sentence each.
2. **Run the suite** and record that it is green. If it is already red, stop: fixing a red suite
   is bug work, not refactoring.
3. **Apply the change** — the whole batch, nothing else.
4. **Run `flutter analyze`** (or `dart analyze`). Zero new diagnostics. Not "fewer" — zero.
5. **Run `dart format`** on the files this batch touched, and only those.
6. **Run the suite again.** Green, with the same test count as step 2.
7. **Record the batch** in the report: files changed, change type, reason safe.

A batch that fails any step is reverted, not patched forward. Then either narrow it and try
again, or report it as a finding you did not apply.

## Safe without tests

These are safe to apply at Partial evidence, because the compiler or the analyzer proves them:

- Renaming a private member inside a single file.
- Extracting a `StatelessWidget` class from a `build()` method, with no state and no closure over
  mutable local variables.
- Converting positional parameters to named parameters *within a library*, updating all call
  sites in the same batch.
- Adding `const` where the analyzer confirms it is valid.
- Adding `final` to a field never reassigned.
- Deleting a private member with no remaining references in the package.
- Replacing an imperative list build with collection-if / collection-for.
- Adding a stack-trace parameter to an existing `catch`.

## Never safe without tests

Emit these as proposed patches only, marked `NOT APPLIED — requires approval`:

- Any change to a public API of a published package.
- Splitting a class that holds mutable state.
- Changing the order of side effects — network calls, writes, analytics, navigation.
- Moving code across an `await` boundary.
- Replacing an `if`/`switch` chain with a `sealed` hierarchy, when the old default branch was
  reachable.
- Collapsing two similar blocks into one shared function.
- Anything touching `initState`, `dispose`, or `didUpdateWidget`.
- Changing a widget's key, or introducing one where there was none.

## Characterization tests

A characterization test pins current behaviour so a refactor can be proven safe. It is not a
correctness test: if the current behaviour is wrong, the test records the wrong behaviour, and
you say so in a comment.

```dart
// Characterization: pins current behaviour before extracting ProfileHeader.
// NOTE: an empty name currently renders "  " rather than a placeholder.
// This is recorded, not endorsed — see finding CC-004.
testWidgets('ProfilePage renders name and email as they are today', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: ProfilePage(user: _fixture)));

  expect(find.text('Sara Ahmed'), findsOneWidget);
  expect(find.text('sara@example.com'), findsOneWidget);
});
```

Rules:

- Cover the observable surface the batch touches, nothing wider.
- Prefer widget tests over golden files: goldens fail on font and platform differences and turn
  a safe refactor into a debugging session.
- Name the file after the code, not the refactor: `profile_page_test.dart`.
- Keep them after the refactor. They are the regression net that made it safe.

## Rollback

Each batch is independently revertable. If the project uses git, one batch is one commit, so a
single `git revert` undoes it without touching the others.

If the working tree was dirty before the pass started, say so in the report and keep every batch
in separate, clearly listed file sets so the user can unpick them by hand.

## Stop conditions

Stop the pass and report, rather than pushing on, when any of these happens:

| Trigger | What to do |
|---|---|
| The suite was red before you started | Stop. Report it. Red suite is bug work. |
| A batch needs a behaviour change to work | Revert the batch, log it as an out-of-scope finding, continue with the next batch. |
| `flutter analyze` gains a diagnostic you cannot clear inside the batch | Revert the batch. |
| No SDK on PATH | Do not apply anything. Switch to proposed patches and write the skipped-verification line. |
| The user's request turns out to be a rewrite | Stop and say so before touching files. |

Discovering a real bug mid-refactor is a success, not a failure. Report it with its `file:line`
and the reproduction you noticed — and leave it unfixed.
