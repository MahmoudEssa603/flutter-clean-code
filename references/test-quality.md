# Judging test code

Test code is code, and in most projects it outweighs the code under test. It is also where clean
code rules get suspended on the excuse that "it's only a test" — which is how a suite becomes
something the team stops trusting and starts skipping.

Read this whenever the scope contains a `test/` directory.

## Contents

- [What is different about tests](#what-is-different-about-tests)
- [1. Names](#1-names)
- [2. One reason to fail](#2-one-reason-to-fail)
- [3. No logic in a test](#3-no-logic-in-a-test)
- [4. Setup: builders, not more setUp](#4-setup-builders-not-more-setup)
- [5. Widget tests](#5-widget-tests)
- [6. Mocks and doubles](#6-mocks-and-doubles)
- [7. Not a finding](#7-not-a-finding)

---

## What is different about tests

Three rules from the main checklist change shape here.

**DRY is weaker.** A test that shares state with another test to avoid repetition has traded a
clear failure for a coupled one. Some duplication in tests buys independence, and independence is
worth more than brevity. Duplicated *setup* is still a finding; duplicated *assertions* usually
are not.

**Abstraction is more expensive.** A helper that hides which assertion failed makes every future
failure a debugging session. If reading the helper is required to understand the failure, the
helper is the finding.

**Names matter more, not less.** A failing test's name is the entire error message a person sees
in CI output. It has to say what broke without them opening the file.

---

## 1. Names

The name states the behaviour and the condition, not the method.

```dart
// Before
test('credit', () { ... });
test('test credit 2', () { ... });
testWidgets('ItineraryScreen', (tester) async { ... });
```

```dart
// After
test('credits 5% when a loyalty member books over 400', () { ... });
test('credits nothing when a loyalty member books exactly 400', () { ... });
testWidgets('shows a skeleton while the itinerary is loading', (tester) async { ... });
```

The boundary case earns its own name. `credit 2` tells a person nothing about what regressed.

## 2. One reason to fail

An expectation that fails stops the test, so everything after it never runs. A test with four
unrelated assertions reports one problem and hides three.

```dart
// Before — one failure hides the rest
test('booking behaves', () {
  expect(booking.totalFare, 480);
  expect(booking.loyaltyCredit, 24);
  expect(booking.status, BookingStatus.confirmed);
  expect(booking.legs, hasLength(2));
});
```

```dart
// After — each behaviour reports independently
group('a confirmed loyalty booking over the threshold', () {
  test('totals the fares of every leg', () => expect(booking.totalFare, 480));
  test('earns the loyalty credit', () => expect(booking.loyaltyCredit, 24));
  test('is marked confirmed', () => expect(booking.status, BookingStatus.confirmed));
});
```

Several `expect`s about *one* behaviour are fine — asserting a widget shows both a title and a
subtitle is one behaviour. The finding is unrelated behaviours sharing a test.

## 3. No logic in a test

An `if`, a loop, or a `try` in a test means either two tests, or an assertion that can silently
pass without asserting anything.

```dart
// Before — when the list is empty, this test passes having tested nothing
test('all legs have a fare', () {
  for (final leg in booking.legs) {
    if (leg.isConfirmed) {
      expect(leg.fare, greaterThan(0));
    }
  }
});
```

```dart
// After — the intent is stated once, and an empty list fails
test('every confirmed leg has a fare', () {
  final confirmed = booking.legs.where((leg) => leg.isConfirmed).toList();
  expect(confirmed, isNotEmpty);
  expect(confirmed.every((leg) => leg.fare > 0), isTrue);
});
```

A table-driven test with a `for` over explicit cases is the exception, and only when each case
carries its own `reason:` so the failure names which row broke.

## 4. Setup: builders, not more setUp

`setUp` that builds one shape forces every test to accept that shape, so tests needing a variant
start mutating shared state.

```dart
// Before
late Booking booking;

setUp(() {
  booking = Booking(
    reference: 'BK-7',
    traveller: Traveller(id: 't9', name: 'Lina', isLoyaltyMember: true),
    legs: [Leg(route: 'AMM-IST', fare: 240, seats: 2)],
  );
});

test('a guest earns no credit', () {
  booking = Booking(                  // rebuilding the whole thing anyway
    reference: 'BK-7',
    traveller: Traveller(id: 't9', name: 'Lina', isLoyaltyMember: false),
    legs: [Leg(route: 'AMM-IST', fare: 240, seats: 2)],
  );
  ...
});
```

```dart
// After — a builder with defaults; each test states only what it cares about
Booking aBooking({bool isLoyaltyMember = true, List<Leg>? legs}) => Booking(
      reference: 'BK-7',
      traveller: Traveller(id: 't9', name: 'Lina', isLoyaltyMember: isLoyaltyMember),
      legs: legs ?? [Leg(route: 'AMM-IST', fare: 240, seats: 2)],
    );

test('a guest earns no loyalty credit', () {
  expect(LoyaltyCreditPolicy().creditFor(aBooking(isLoyaltyMember: false)), 0);
});
```

The test now reads as: this one fact differs, and here is what follows from it.

## 5. Widget tests

**`pumpAndSettle` is not a fix.** It waits for animations to finish. Reaching for it to make a
flaky test pass hides a timing problem that will come back on a slower machine.

```dart
// Before
await tester.pumpAndSettle();          // why? nobody remembers
expect(find.text('Done'), findsOneWidget);
```

```dart
// After — pump the exact frame the assertion needs
await tester.pump();                    // start the async load
await tester.pump(const Duration(milliseconds: 300));  // the fade completes
expect(find.text('Done'), findsOneWidget);
```

If the wait is genuinely for an animation of unknown length, `pumpAndSettle` is right — and a
`why` comment saying which animation makes it right.

The finding is the unexplained call, and you can see that without running anything. Whether it
hangs on a particular screen is a timing claim that does need a run — that part is out of scope,
and it is not what is being reported. Do not hand the whole thing back because the second half is
unknowable.

**`find.byType` breaks on refactoring.** It couples the test to the widget tree's shape, so
extracting a widget — exactly what this skill recommends — turns the suite red for no behavioural
reason.

```dart
// Before — breaks the moment a Card is wrapped in anything
expect(find.byType(Card), findsNWidgets(4));
```

```dart
// After — assert what the user sees, or what the test owns
expect(find.text('Total fare'), findsOneWidget);
expect(find.byKey(const Key('booking-total')), findsOneWidget);
```

`find.byType` is fine for a widget the test itself pumped, and for asserting a specific widget
class is present at all.

**Golden files.** Prefer widget assertions. Goldens fail on font rendering, platform and Flutter
version, which turns a safe refactor into an afternoon. Where a golden is genuinely the point —
a design-critical component — say so in a comment so the next person does not delete it.

## 6. Mocks and doubles

- A mock of a type the test never calls is noise. Delete it.
- Verifying that a mock was called, with no assertion on the outcome, tests the wiring rather
  than the behaviour. Prefer asserting the result.
- Mocking a value class instead of constructing one is a finding: `MockBooking()` where `aBooking()`
  would do makes the test lie about what the code receives.
- A double throwing `UnimplementedError` on methods the test never calls is fine, and stays fine.
  It documents the surface the test relies on.

## 7. Not a finding

State these out loud when you leave them, so the reader knows you looked.

- **Repeated assertions across tests.** Three tests each asserting `expect(result.status, confirmed)`
  is not duplication worth removing — merging them couples three independent failures.
- **A long test body that is one linear scenario.** An integration test walking a booking flow
  reads top to bottom and should not be split into helpers that hide the sequence.
- **Magic numbers in test data.** `Leg(fare: 240)` needs no named constant. The literal *is* the
  documentation, and naming it adds a hop.
- **No test for a private helper.** It is covered through its caller. A missing test for public
  behaviour is the finding; a missing test per method is not.
