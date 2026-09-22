# Worked example — a full AUDIT report

A complete report on one screen of a travel-booking app, `itinerary_screen.dart`, written the
way a real one should read. Use it to calibrate depth and tone: what a finding says, how much
code to show, and what gets left out.

The report body below is the deliverable. Everything outside the fenced block is commentary for
whoever is authoring the skill.

## Contents

- [The report](#the-report)
- [What this example demonstrates](#what-this-example-demonstrates)

---

## The report

````markdown
# Clean Code — AUDIT — itinerary_screen

**Scope:** `lib/features/bookings/itinerary_screen.dart` (236 lines) · **Evidence:** Partial
**Conventions:** not verified — no `analysis_options.yaml` or style guide found
**Verification:** `dart analyze` clean before the read; no tests exist for this file
**Not checked:** `booking.freezed.dart` (generated) · `receipt_service.dart`, read for
CC-003 only · no test files in scope, so area 7 was not assessed

## Summary

| Principle | Findings | High | Medium | Low |
|---|---|---|---|---|
| Naming | 2 | 1 | 0 | 1 |
| Functions | 1 | 0 | 1 | 0 |
| Classes & SOLID | 2 | 0 | 2 | 0 |
| Flutter | 3 | 1 | 2 | 0 |
| Comments | 1 | 0 | 0 | 1 |
| Errors & data | 2 | 2 | 0 | 0 |
| Tests | — | — | — | — |

One screen is doing five jobs: fetching the booking, polling seat holds, pricing, formatting and
laying out. Findings are numbered by impact and then by effort, so the one that matters most is
not the first: it is CC-003. The loyalty credit is computed here and again in
`receipt_service.dart`, so the screen and the receipt will disagree the first time either is
edited. Everything else is readability; that one is a billing dispute waiting for a release.

## Findings

### CC-001 — `currentFare()` logs an analytics event every time it is read

**Principle:** Naming
**Impact:** High · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:64`

The name promises a calculation. The body also sends `fare_viewed`, and `build()` calls it three
times, so every rebuild reports three views that no one had. The dashboard counting fare views
has been counting frames.

```dart
// Before
double currentFare() {
  _analytics.log('fare_viewed', {'ref': booking.reference});
  return booking.legs.fold(0.0, (sum, leg) => sum + leg.fare * leg.seats);
}
```

```dart
// After — the read is a read; the event moves to the moment a person opens the screen
double get totalFare =>
    booking.legs.fold(0.0, (sum, leg) => sum + leg.fare * leg.seats);
```

Moving the event changes what the dashboard counts. That is the point of the fix, and it still
needs the owner of the dashboard to agree, so the move itself is listed under Deferred.

### CC-002 — A failed load prints `error` and leaves the spinner running

**Principle:** Errors & data
**Impact:** High · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:48`

No network, an expired session, a malformed response: each one prints the same word to a console
nobody reads in production, and the traveller watches a spinner that never stops.

```dart
// Before
} catch (_) {
  print('error');
}
```

```dart
// After — narrow type, stack trace kept, an honest UI state
} on BookingApiException catch (error, stackTrace) {
  _log.error('Loading booking ${widget.reference} failed', error, stackTrace);
  setState(() => _loadError = error);
}
```

`_loadError` then drives an error state instead of the spinner. That is a behaviour change, so it
is proposed here rather than applied: it needs the user's approval.

### CC-003 — The loyalty credit rule lives in two files

**Principle:** Errors & data
**Impact:** High · **Effort:** S · **Confidence:** High
**Location:** `itinerary_screen.dart:77`

The credit is written here and again in `receipt_service.dart`. The two spellings already differ
in operand order, which means nobody has noticed they are the same rule. Whichever one is edited
next, the screen and the receipt start showing different amounts.

```dart
// Before — itinerary_screen.dart:77
double credit() {
  if (traveller.isLoyaltyMember && currentFare() > 400) {
    return currentFare() * 0.05;
  }
  return 0;
}
```

```dart
// After — one home for the rule, testable on its own
class LoyaltyCreditPolicy {
  static const _threshold = 400.0;
  static const _rate = 0.05;

  double creditFor(Traveller traveller, Booking booking) =>
      traveller.isLoyaltyMember && booking.totalFare > _threshold
          ? booking.totalFare * _rate
          : 0.0;
}
```

`receipt_service.dart` calls the same policy, and the threshold moves in one place.

### CC-004 — 96-line `build()` holding four visual concepts

**Principle:** Flutter
**Impact:** High · **Effort:** M · **Confidence:** High
**Location:** `itinerary_screen.dart:131`

Trip header, legs, fare breakdown and the check-in bar are one block. Nothing is `const`, nothing
has a name in the widget inspector, and every seat-poll tick rebuilds all of it.

```dart
// After — the shape, not the whole file
Widget build(BuildContext context) {
  return Scaffold(
    appBar: ItineraryAppBar(reference: booking.reference),
    body: ListView(
      children: [
        TripHeader(booking: booking),
        for (final leg in booking.legs) LegCard(leg: leg),
        FareBreakdown(booking: booking),
      ],
    ),
    bottomNavigationBar: CheckInBar(booking: booking),
  );
}
```

Widget classes rather than `_buildX()` methods: each one takes `const`, carries a key, and shows
up by name when someone opens the inspector on a layout problem.

The scanner reports the fare lines as one repeated block, 5 lines x3 at `:171`, `:180` and
`:189`. `FareBreakdown` is where that repetition goes — the same extraction, one fewer place to
fix a label.

### CC-005 — The seat poll and the promo field outlive the screen

**Principle:** Flutter
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:31`

A `Timer.periodic` and a `TextEditingController` are created and never released. Read it as
ownership rather than as a leak: the class takes on two resources and never says when it is done
with them. The timer also keeps calling `setState` after the screen is gone.

```dart
// After
@override
void dispose() {
  _seatPoll?.cancel();
  _promoController.dispose();
  super.dispose();
}
```

### CC-006 — `legTile(leg, true)` hides its meaning at the call site

**Principle:** Functions
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:112`

`true` at the call site says nothing. The body is two layouts, a one-line summary and a full
card, sharing a name.

```dart
// After
Widget legSummary(Leg leg) => Text(leg.route, style: _summaryStyle);
Widget legDetails(Leg leg) => Column(children: [...]);
```

### CC-007 — `late Booking booking` beside a `busy` flag

**Principle:** Flutter
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:27`

`busy` and `late booking` encode one fact twice. If the seat poll fires before the first load
lands, it reads `booking` and throws `LateInitializationError`, not a null check.

```dart
// After — one field, and the type says what is true
Booking? _booking;

@override
Widget build(BuildContext context) {
  final booking = _booking;
  if (booking == null) return const ItinerarySkeleton();
  ...
}
```

### CC-008 — Check-in state is a string compared five times

**Principle:** Classes & SOLID
**Impact:** Medium · **Effort:** S · **Confidence:** High
**Location:** `itinerary_screen.dart:95`

`checkInLabel()` walks `'open'`, `'closed'`, `'done'`, `'late'` and `'na'` in an if-chain with a
silent fallback. A sixth state from the server lands in the fallback and nobody is told.

```dart
// After — the compiler lists every state, and a new one fails to build until handled
enum CheckIn { open, closed, done, late, notAvailable }

String checkInLabel(CheckIn state) => switch (state) {
      CheckIn.open => 'Check in now',
      CheckIn.closed => 'Check-in closed',
      CheckIn.done => 'Checked in',
      CheckIn.late => 'Check in at the desk',
      CheckIn.notAvailable => 'Online check-in unavailable',
    };
```

### CC-009 — The screen owns fetching, polling, pricing and formatting

**Principle:** Classes & SOLID
**Impact:** Medium · **Effort:** M · **Confidence:** High
**Location:** `itinerary_screen.dart:22`

`_ItineraryScreenState` loads the booking, polls seat holds, computes credit and formats
departure times. It changes when the API changes, when pricing changes and when the date format
changes. CC-003 takes the pricing out, and the time formatting belongs on an extension.

Splitting the rest touches how the screen gets its data, which is state-management work — see
Out of Scope.

### CC-010 — `bk`, `lg`, `tmp`: names that make the reader decode them

**Principle:** Naming
**Impact:** Low · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:41`, `:118`

Three abbreviations in one screen, each saving two keystrokes and costing every reader a lookup.
`booking`, `leg` and `seatHolds` say it outright.

### CC-011 — Commented-out code and an ownerless FIXME

**Principle:** Comments
**Impact:** Low · **Effort:** XS · **Confidence:** High
**Location:** `itinerary_screen.dart:70`, `:129`

The dead `oldFare` line is deleted — git has it. `// FIXME: later` names no owner, no ticket and
no problem; either it becomes a tracked item or it goes.

## Deferred — found, not fixed in this pass

| Finding | Why deferred |
|---|---|
| CC-001 (moving the event) | The dashboard counts change. Whoever owns that dashboard has to agree. |
| CC-002 | The fix introduces an error UI state. That is a behaviour change and needs approval. |
| CC-009 (data access half) | Cannot be split without deciding where the screen gets its data. |

## Out of Scope

| Observation | Why it is not clean-code work |
|---|---|
| The screen constructs `BookingApi()` inside `initState` | Where a widget gets its data is a state-management decision, not a readability one |
| `EdgeInsets.symmetric(horizontal: 14)` appears 7 times, and `Color(0xFF1F6F5C)` twice | The literals are a finding; choosing the spacing scale and the palette that replace them is a design-system decision |
| Seat holds are polled every 7 seconds | Whether that is too often is a product and performance question, and this pass collected no measurements |

## Verification

- [x] `dart analyze` — clean before the read; nothing was modified
- [x] No file changed — AUDIT mode
- [x] Six principle areas checked
- [ ] Tests — none exist for this file; REFACTOR would need characterization tests first
````

---

## What this example demonstrates

**Findings say what it costs, not which rule it breaks.** CC-003 does not say "this is not DRY";
it says the screen and the receipt will disagree.

**Numbering follows the rule, and the summary says which finding matters most.** Findings are
ordered by impact, then by lower effort, so the most valuable one is CC-003, not CC-001. The
summary paragraph names it and says why.

**Code is trimmed to the point.** CC-004 shows the shape of the fix, not 90 lines of extracted
widgets.

**A behaviour change is caught and stopped.** CC-002's fix adds an error state, and CC-001's
changes what a dashboard counts. Both move to Deferred instead of being applied quietly.

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
