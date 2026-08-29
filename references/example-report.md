# Worked example — a full AUDIT report

A complete report on `evals/fixtures/order_summary_page.dart`, written the way a real one should
read. Use it to calibrate depth and tone: what a finding says, how much code to show, and what
gets left out.

The report body below is the deliverable. Everything outside the fenced block is commentary for
whoever is authoring the skill.

## Contents

- [The report](#the-report)
- [What this example demonstrates](#what-this-example-demonstrates)

---

## The report

````markdown
# Clean Code — AUDIT — order_summary_page

**Scope:** `lib/features/orders/order_summary_page.dart` (270 lines) · **Evidence:** Partial
**Conventions:** not verified — no `analysis_options.yaml` or style guide found
**Verification:** `dart analyze` clean before the read; no tests exist for this file
**Not checked:** `order.freezed.dart` (generated) · `invoice_service.dart`, read for
CC-001 only · no test files in scope, so area 7 was not assessed

## Summary

| Principle | Findings | High | Medium | Low |
|---|---|---|---|---|
| Naming | 2 | 1 | 0 | 1 |
| Functions | 2 | 0 | 2 | 0 |
| Classes & SOLID | 1 | 0 | 1 | 0 |
| Flutter | 3 | 1 | 2 | 0 |
| Comments | 1 | 0 | 0 | 1 |
| Errors & data | 2 | 2 | 0 | 0 |
| Tests | — | — | — | — |

One file is doing six jobs: fetching, caching, formatting, pricing, laying out, and navigating.
The single most valuable change is CC-001 — the discount rule exists twice, in this file and in
`invoice_service.dart`, so the two will disagree the first time either is edited. Everything else
is readability; that one is a pricing bug waiting for a release.

## Findings

### CC-001 — Move the discount rule out of the widget

**Principle:** Errors & data
**Impact:** High · **Effort:** S · **Confidence:** High
**Location:** `order_summary_page.dart:79`

The premium-discount rule is written here and again in `invoice_service.dart`. The two spellings
already differ in operand order, which means nobody has noticed they are the same rule. Whichever
one is edited next, the invoice and the summary screen start showing different totals.

```dart
// Before — order_summary_page.dart:79
double discount() {
  if (order.user.isPremium && getTotal() > 100) {
    return getTotal() * 0.1;
  }
  return 0;
}
```

```dart
// After — one home for the rule, testable on its own
class DiscountPolicy {
  static const _premiumThreshold = 100.0;
  static const _premiumRate = 0.1;

  double discountFor(User user, Order order) =>
      user.isPremium && order.total > _premiumThreshold ? order.total * _premiumRate : 0.0;
}
```

`invoice_service.dart` calls the same policy, and the threshold moves in one place.

### CC-002 — `getTotal()` mutates while pretending to read

**Principle:** Naming
**Impact:** High · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:68`

The name promises a calculation. The body also writes `_cachedTotal`, and `build()` calls it three
times, so the field is rewritten on every frame. A reader tracking down why `_cachedTotal` changes
has no reason to look inside a getter-shaped method.

```dart
// Before
double getTotal() {
  var t = 0.0;
  for (final item in order.items) {
    t += item.price * item.quantity;
  }
  _cachedTotal = t;
  return t;
}
```

```dart
// After — a pure read; the field goes away because nothing needed it
double get total =>
    order.items.fold(0.0, (sum, item) => sum + item.price * item.quantity);
```

### CC-003 — 118-line `build()` holding five visual concepts

**Principle:** Flutter
**Impact:** High · **Effort:** M · **Confidence:** High
**Location:** `order_summary_page.dart:125`

Header, status, item list, price rows and the footer button are one block. Nothing is `const`,
nothing has a name in the widget inspector, and any state change rebuilds all of it.

```dart
// After — the shape, not the whole file
Widget build(BuildContext context) {
  return Scaffold(
    appBar: OrderAppBar(orderId: order.id),
    body: SingleChildScrollView(
      controller: _scrollController,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          OrderCustomerHeader(user: order.user),
          const Divider(),
          OrderStatusRow(order: order),
          OrderItemList(items: order.items),
          const Divider(),
          OrderPriceSummary(order: order),
          OrderFooterActions(order: order),
        ],
      ),
    ),
  );
}
```

Widget classes rather than `_buildX()` methods: each one takes `const`, carries a key, and shows
up by name when someone opens the inspector on a layout problem.

The scanner reports the last three price rows as one repeated block, 6 lines x3 at `:200`,
`:210` and `:220`. `OrderPriceSummary` is where that repetition goes — the same extraction, one
fewer place to fix a label.

### CC-004 — Failure is swallowed in `load()`

**Principle:** Errors & data
**Impact:** High · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:56`

Every failure — no network, a 500, a parse error — leaves the screen on its spinner forever with
nothing logged. The user waits, and no one can tell afterwards what went wrong.

```dart
// Before
} catch (e) {
  // ignore
}
```

```dart
// After — narrow type, stack trace kept, an honest UI state
} on OrderApiException catch (error, stackTrace) {
  _log.error('Loading order ${widget.orderId} failed', error, stackTrace);
  setState(() => _error = error);
}
```

The `_error` field then drives an error state instead of the spinner. That is a small behaviour
change, so it is proposed here rather than applied: it needs the user's approval.

### CC-005 — `_OrderSummaryPageState` never disposes what it creates

**Principle:** Flutter
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:28`

A `ScrollController` and a stream subscription are created and never released. Read as ownership
rather than as a leak: the class takes on two resources and quietly declines to say when it is
done with them.

```dart
// After
@override
void dispose() {
  _sub?.cancel();
  _scrollController.dispose();
  super.dispose();
}
```

### CC-006 — `render(order, false)` hides its meaning at the call site

**Principle:** Functions
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:111`

`false` at the call site says nothing. The body is two unrelated layouts sharing a name.

```dart
// After
Widget compactOrderLine(Order order) => Text(order.id, style: _compactStyle);
Widget fullOrderLine(Order order) => Column(children: [...]);
```

### CC-007 — `describe()` nests three levels to answer one question

**Principle:** Functions
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:95`

```dart
// After — guard clauses, one level
String describe(Order? order) {
  if (order == null) return 'No order';
  if (order.items.isEmpty) return 'Empty order';
  if (!order.isPaid) return 'Awaiting payment';
  return 'Paid: ${order.items.length} items';
}
```

### CC-008 — The page owns data access, formatting and pricing

**Principle:** Classes & SOLID
**Impact:** Medium · **Effort:** M · **Confidence:** High
**Location:** `order_summary_page.dart:28`

`_OrderSummaryPageState` fetches orders, caches users, formats dates and computes discounts. It
changes when the API changes, when the date format changes, and when pricing changes. CC-001 takes
the pricing out; `formatDate` belongs on an extension; `getUser` belongs to the repository.

Splitting the rest touches how the screen gets its data, which is state-management work — see
Out of Scope.

### CC-009 — `late Order order` is a crash waiting for a slow network

**Principle:** Flutter
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:29`

`loading` and `late order` encode one thing twice. If anything reads `order` before the first
response, it throws `LateInitializationError` rather than failing a null check.

```dart
// After — one field, and the type says what is true
Order? _order;

@override
Widget build(BuildContext context) {
  final order = _order;
  if (order == null) return const OrderSummarySkeleton();
  ...
}
```

### CC-010 — `fetchOrder` / `loadUser` / `getUser`: three verbs, one idea

**Principle:** Naming
**Impact:** Low · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:51`, `:62`

Pick one verb for "go and get it from the source" and use it everywhere in the module. `getUser`
has a second problem: it also writes to the cache. Same shape as CC-002.

### CC-011 — Commented-out code and an ownerless TODO

**Principle:** Comments
**Impact:** Low · **Effort:** XS · **Confidence:** High
**Location:** `order_summary_page.dart:73`, `:123`

The dead `oldTotal` line is deleted — git has it. `// TODO: fix this later` names no owner, no
ticket and no problem; either it becomes a tracked item or it goes.

## Deferred — found, not fixed in this pass

| Finding | Why deferred |
|---|---|
| CC-004 | The fix introduces an error UI state. That is a behaviour change and needs approval. |
| CC-008 (data access half) | Cannot be split without deciding where the screen gets its data. |

## Out of Scope

| Observation | Why it is not clean-code work |
|---|---|
| The screen calls `OrderApi()` directly from `initState` | Where a widget gets its data is a state-management decision, not a readability one |
| `EdgeInsets.all(17)` appears 9 times, and `Color(0xFF3B5998)` twice | The literals are a finding; choosing the spacing scale and the palette that replace them is a design-system decision |
| `getTotal()` runs three times per frame | Looks costly, but calling it a performance problem needs profiling evidence this pass did not collect |

## Verification

- [x] `dart analyze` — clean before the read; nothing was modified
- [x] No file changed — AUDIT mode
- [x] Six principle areas checked
- [ ] Tests — none exist for this file; REFACTOR would need characterization tests first
````

---

## What this example demonstrates

**Findings say what it costs, not which rule it breaks.** CC-001 does not say "this is not DRY";
it says the invoice and the screen will disagree.

**One High-impact finding leads.** The summary paragraph names it and says why it outranks the
118-line `build()`.

**Code is trimmed to the point.** CC-003 shows the shape of the fix, not 90 lines of extracted
widgets.

**A behaviour change is caught and stopped.** CC-004's fix adds an error state, so it moves to
Deferred instead of being applied quietly.

**The boundary is drawn twice in one place.** The inline literals are reported, and choosing the
replacement scale is sent out of scope — the same observation split at the right seam.

**Out of Scope names no tool.** Each row says what it is and why it is not this pass's work. What
to do about it is the reader's call.

**A Low finding is still worth a line.** CC-010 and CC-011 are short. They are not padded to look
like the High ones.

**An unassessed area keeps its row.** Tests shows em dashes rather than zeros, because zero
would claim the tests were read and found clean. The `Not checked:` line says why.

**The report states its own limits.** The `Not checked:` line says what was skipped and why, so
nobody mistakes eleven findings for the whole picture.
