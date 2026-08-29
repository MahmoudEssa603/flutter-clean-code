# Report template

The output format for every mode. Sections that do not apply to the mode are omitted entirely —
never left in as empty headings.

## Contents

- [Which sections each mode emits](#which-sections-each-mode-emits)
- [Template](#template)
- [Writing rules](#writing-rules)
- [Machine-readable output](#machine-readable-output)

## Which sections each mode emits

| Section | AUDIT | DIFF | REFACTOR |
|---|:--:|:--:|:--:|
| Header, Summary, Findings | ✅ | ✅ | ✅ |
| Batches, Applied | — | — | ✅ |
| Deferred, Out of Scope, Verification | ✅ | ✅ | ✅ |

Findings are numbered `CC-001` upward, ordered by Impact then by lower Effort.

---

## Template

````markdown
# Clean Code — <AUDIT | DIFF | REFACTOR> — <module>

**Scope:** <files or module path> · **Evidence:** <Full | Partial | None>
**Conventions:** <path to the conventions file, or "not verified">
**Verification:** <"flutter analyze + flutter test, green" | the skipped-verification line>
**Not checked:** <generated files skipped · modules queued · findings dropped by the cap>

## Summary

| Principle | Findings | High | Medium | Low |
|---|---|---|---|---|
| Naming | | | | |
| Functions | | | | |
| Classes & SOLID | | | | |
| Flutter | | | | |
| Comments | | | | |
| Errors & data | | | | |
| Tests | | | | |

<One paragraph: the single thing most worth fixing, and why.>

## Findings

### CC-001 — <short title in the imperative>

**Principle:** <Naming | Functions | SOLID | Flutter | Comments | Errors>
**Impact:** <High|Medium|Low> · **Effort:** <XS|S|M|L> · **Confidence:** <High|Low>
**Location:** `lib/features/orders/order_page.dart:42`

<One or two sentences: what the reader loses because of this. Not a restatement of the rule.>

```dart
// Before
```

```dart
// After
```

## Batches

### Batch 1 — <Rename | Extract | Split | Inline | Signature>

**Status:** <applied | NOT APPLIED — requires approval>
**Reason safe:** <why behaviour is preserved>
**Addresses:** CC-001, CC-004

| File | Change | Reason |
|---|---|---|

```diff
<the key hunks, not the whole file>
```

## Applied

| Batch | Type | Files | Tests before | Tests after |
|---|---|---|---|---|

## Deferred — found, not fixed in this pass

| Finding | Why deferred |
|---|---|

## Out of Scope

| Observation | Why it is not clean-code work |
|---|---|

## Verification

- [ ] `flutter analyze` — zero new diagnostics
- [ ] `dart format` applied to touched files only
- [ ] Full suite green after the final batch, same test count as before
- [ ] No behaviour change (characterization evidence named)
- [ ] No unrelated files changed
- [ ] No new lint suppression, or each one justified in writing
- [ ] Public API compatibility checked; deprecation aliases added where needed
````

---

## Writing rules

**Findings describe the cost, not the rule.** The reader knows what SRP is; they need to know
what this particular class costs them.

- Weak: "This class violates the Single Responsibility Principle."
- Strong: "`UserRepository` changes whenever the date format changes, so every date tweak
  re-runs the data-layer tests and risks the caching path."

**Every principle row stays in the table, even at zero.** A row missing from the Summary reads
as an area nobody looked at. If an area genuinely could not be assessed — no test files in
scope, for instance — put an em dash in its row and say why on the `Not checked:` line.

**Every finding has a `file:line`.** A finding without a location is an opinion.

**Low confidence is stated as a question.** "Is `syncPending` meant to include failed retries?
If not, the name is misleading; if so, the doc comment should say it."

**The cap is visible.** When more than 20 findings exist, close the Findings section with:

> 31 further Low-impact findings were not listed: Naming 18, Comments 9, Functions 4.

**Out of Scope is one line each.** Name the observation and why it is not this pass's work. Do
not propose the fix, do not estimate it, and do not name a tool or another skill — that decision
belongs to the user.

**The Not checked line is not optional.** A report that lists ten findings and says nothing
about its own limits reads as a complete picture. Name what was skipped and why: generated
files, modules queued for a later pass, findings dropped by the 20-per-module cap, areas the
missing SDK made unverifiable.

**Arabic reports keep code in English.** Prose, headings and table cells translate; identifiers,
paths, commands and code blocks do not.

---

## Machine-readable output

Only when the user asks for it — to gate a build, or to feed a dashboard. Write it beside the
markdown with the same base name and a `.json` extension. Nobody wants a JSON file they did
not ask for.

```json
{
  "module": "orders",
  "mode": "AUDIT",
  "date": "2026-08-28",
  "evidence": "Partial",
  "notChecked": ["order.freezed.dart (generated)", "31 Low findings dropped by the cap"],
  "findings": [
    {
      "id": "CC-001",
      "title": "Move the discount rule out of the widget",
      "principle": "Errors & data",
      "impact": "High",
      "effort": "S",
      "confidence": "High",
      "file": "lib/features/orders/order_summary_page.dart",
      "line": 76
    }
  ]
}
```

Ids match the markdown exactly, and a finding that is still open keeps its id across passes,
so a dashboard can track one finding over time.
