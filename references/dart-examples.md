# Dart / Flutter before-and-after examples

Concrete pairs for every principle in the Step 2 checklist. Use them as the shape of a fix, not
as a template to paste — the project's own conventions always win.

## Contents

- [1. Naming](#1-naming)
  - [1.4 Extension names](#14-extension-names)
  - [1.5 Transliterated identifiers](#15-transliterated-identifiers)
- [2. Functions](#2-functions)
- [3. Classes and SOLID](#3-classes-and-solid)
  - [3.5 A field missing from copyWith](#35-a-field-missing-from-copywith)
  - [3.6 == on a collection field](#36--on-a-collection-field)
  - [3.7 enum, sealed, or record](#37-enum-sealed-or-record)
- [4. Flutter-specific cleanliness](#4-flutter-specific-cleanliness)
  - [4.2 Extraction has a floor](#42-extraction-has-a-floor-as-well-as-a-ceiling)
  - [4.4 Hardcoded user-facing strings](#44-hardcoded-user-facing-strings)
- [5. Comments and dead weight](#5-comments-and-dead-weight)
- [6. Error handling and data](#6-error-handling-and-data)
- [7. Not a finding](#7-not-a-finding)

---

## 1. Naming

### 1.1 A name that lies

The name promises a read; the body performs a write. Every caller now has a side effect it
cannot see.

```dart
// Before
Future<Traveller> getTraveller(String id) async {
  final traveller = await _api.fetchTraveller(id);
  await _cache.write(id, traveller);   // hidden write
  _analytics.log('traveller_opened');  // hidden write
  return traveller;
}
```

```dart
// After — the read is a read; the writes are named and owned by the caller
Future<Traveller> fetchTraveller(String id) => _api.fetchTraveller(id);

Future<Traveller> loadAndCacheTraveller(String id) async {
  final traveller = await fetchTraveller(id);
  await _cache.write(id, traveller);
  return traveller;
}
```

The analytics call moved out entirely: logging that a traveller opened a screen is the screen's
concern, not the repository's.

### 1.2 Type noise and mental mapping

```dart
// Before
final userList = <User>[];
final strName = user.name;
final b = booking.totalFare > 0;
void doIt(Booking o) { ... }
```

```dart
// After
final users = <User>[];
final name = user.name;
final hasBalance = booking.totalFare > 0;
void submitBooking(Booking booking) { ... }
```

### 1.3 One word per concept

Three verbs for one operation force the reader to check whether they differ.

```dart
// Before
Future<Traveller> fetchTraveller(String id);
Future<Passport>  getPassport(String id);
Future<Settings>  loadSettings(String id);
```

```dart
// After — pick one verb for "go get it from the source" and keep it
Future<Traveller> fetchTraveller(String id);
Future<Passport>  fetchPassport(String id);
Future<Settings>  fetchSettings(String id);
```

### 1.4 Extension names

An extension is named for whom it serves, not for what it wraps.

```dart
// Before — the name says nothing a reader can use
extension StringExtension on String { ... }
extension BookingExtension on Booking { ... }
```

```dart
// After
extension BookingFares on Booking {
  double get totalFare => legs.fold(0.0, (sum, leg) => sum + leg.fare);
}

extension PhoneFormatting on String {
  String get asLocalPhoneNumber => ...;
}
```

An extension on a core type that encodes one feature's rule belongs inside that feature. Once
`extension StringExtension on String` holds booking formatting, receipt parsing and traveller
initials, every screen that imports it gets all three.

### 1.5 Transliterated identifiers

No lint catches these, and they cost every reader a second pass: the word is neither the
English term nor the Arabic one.

```dart
// Before
Future<User> getMostakhdem(String id);
void saveBayanat(Map<String, dynamic> data);
bool get isMafool => status == 'active';
final hagozat = <Booking>[];
```

```dart
// After
Future<User> fetchUser(String id);
void saveTravellerDetails(Map<String, dynamic> data);
bool get isActive => status == BookingStatus.active;
final bookings = <Booking>[];
```

The exemption is for domain terms with no English equivalent, not for convenience. These stay:

```dart
double zakatDue(Wallet wallet);      // a specific obligation, not "tax"
DateTime get hijriDate => ...;       // a calendar, not "date"
String get iqamaNumber => ...;       // a specific document, not "id"
```

Translating those loses meaning; translating `mostakhdem` to `user` loses nothing.

---

## 2. Functions

### 2.1 The boolean flag parameter

`submit(booking, true)` is unreadable at the call site, and the body is two functions wearing one
coat.

```dart
// Before
Future<void> submit(Booking booking, bool isDraft) async {
  if (isDraft) {
    await _repo.saveDraft(booking);
    return;
  }
  await _validator.validate(booking);
  await _repo.submit(booking);
  await _notifier.confirm(booking);
}
```

```dart
// After
Future<void> saveDraft(Booking booking) => _repo.saveDraft(booking);

Future<void> submitBooking(Booking booking) async {
  await _validator.validate(booking);
  await _repo.submit(booking);
  await _notifier.confirm(booking);
}
```

### 2.2 The nesting pyramid

```dart
// Before
String summarize(Booking? booking) {
  if (booking != null) {
    if (booking.legs.isNotEmpty) {
      if (booking.isConfirmed) {
        return 'Confirmed: ${booking.legs.length} legs';
      } else {
        return 'Awaiting confirmation';
      }
    } else {
      return 'No legs booked';
    }
  } else {
    return 'No booking';
  }
}
```

```dart
// After — guard clauses, one level of nesting
String summarize(Booking? booking) {
  if (booking == null) return 'No booking';
  if (booking.legs.isEmpty) return 'No legs booked';
  if (!booking.isConfirmed) return 'Awaiting confirmation';
  return 'Confirmed: ${booking.legs.length} legs';
}
```

### 2.3 Too many positional parameters

```dart
// Before
Widget priceRow(String label, double amount, bool bold, bool showCurrency, int decimals) { ... }
priceRow('Fare', 312.4, true, true, 2);   // what is true, true?
```

```dart
// After — named parameters with defaults; the call site reads as a sentence
Widget priceRow({
  required String label,
  required double amount,
  bool isEmphasised = false,
  bool showCurrency = true,
  int decimals = 2,
}) { ... }

priceRow(label: 'Fare', amount: 312.4, isEmphasised: true);
```

When the same five parameters travel together to three or more functions, they are a concept:
give them a `PriceRowStyle` value class instead.

### 2.4 Imperative building where Dart has syntax for it

```dart
// Before
final children = <Widget>[];
children.add(const Header());
if (traveller.isLoyaltyMember) {
  children.add(const LoyaltyBadge());
}
for (final leg in legs) {
  children.add(LegTile(leg: leg));
}
```

```dart
// After
final children = <Widget>[
  const Header(),
  if (traveller.isLoyaltyMember) const LoyaltyBadge(),
  for (final leg in legs) LegTile(leg: leg),
];
```

---

## 3. Classes and SOLID

### 3.1 OCP — the growing type switch becomes a sealed hierarchy

Every new payment method edits this function. The compiler never warns when one is forgotten.

```dart
// Before
String label(Payment p) {
  if (p.type == 'card') return 'Card ****${p.last4}';
  if (p.type == 'cash') return 'Cash';
  if (p.type == 'wallet') return 'Wallet ${p.walletName}';
  return 'Other';          // the silent hole
}
```

```dart
// After — the compiler enforces exhaustiveness; no default branch to hide a gap
sealed class Payment {
  const Payment();
}

final class CardPayment extends Payment {
  const CardPayment(this.last4);
  final String last4;
}

final class CashPayment extends Payment {
  const CashPayment();
}

final class WalletPayment extends Payment {
  const WalletPayment(this.walletName);
  final String walletName;
}

String label(Payment payment) => switch (payment) {
      CardPayment(:final last4) => 'Card ****$last4',
      CashPayment() => 'Cash',
      WalletPayment(:final walletName) => 'Wallet $walletName',
    };
```

Adding a fourth payment type now fails to compile until every `switch` handles it.

### 3.2 SRP — one class, three reasons to change

```dart
// Before
class UserRepository {
  Future<User> fetch(String id) { ... }          // data access
  String formatJoinDate(User u) { ... }          // presentation
  Future<void> uploadAvatar(File f) { ... }      // file I/O
  bool isEligibleForUpgrade(User u) { ... }      // business rule
}
```

```dart
// After
class UserRepository {
  Future<User> fetch(String id) { ... }
}

extension UserPresentation on User {
  String get joinDateLabel => ...;
}

class AvatarUploader {
  Future<void> upload(File file) { ... }
}

class UpgradePolicy {
  bool isEligible(User user) { ... }
}
```

`UpgradePolicy` is the important one: a business rule with its own name is a rule you can test
and find, instead of a method buried in a data class.

### 3.3 LSP — the override that breaks the contract

```dart
// Before
class ReadOnlyItinerary extends Itinerary {
  @override
  void add(Leg leg) => throw UnimplementedError();   // callers of Itinerary now crash
}
```

```dart
// After — split the interface so the type cannot promise what it will not do
abstract interface class ReadableItinerary {
  List<Leg> get legs;
}

abstract interface class WritableItinerary implements ReadableItinerary {
  void add(Leg leg);
}
```

### 3.4 Over-abstraction is a finding too

```dart
// Before — one implementation, one caller, three files
abstract class IGreetingService { String greet(String name); }
class GreetingServiceImpl implements IGreetingService {
  @override String greet(String name) => 'Hello, $name';
}
```

```dart
// After
String greeting(String name) => 'Hello, $name';
```

Report this the same way you report a god class. An interface with exactly one implementation
and no test double is cost with no benefit.

### 3.5 A field missing from copyWith

Hand-written `copyWith`, `==` and `hashCode` drift the moment a field is added, and the bug is
silent: no crash, no analyzer diagnostic, just a value that quietly fails to change.

```dart
// Before — `note` was added later and never reached copyWith or ==
class Booking {
  const Booking({required this.reference, required this.legs, required this.note});

  final String reference;
  final List<Leg> legs;
  final String note;

  Booking copyWith({String? reference, List<Leg>? legs}) =>
      Booking(reference: reference ?? this.reference, legs: legs ?? this.legs, note: note);

  @override
  bool operator ==(Object other) =>
      other is Booking && other.reference == reference && other.legs == legs;

  @override
  int get hashCode => Object.hash(reference, legs);
}
```

`booking.copyWith(note: 'window seat')` does not compile — that part is caught. But two bookings
differing only by `note` compare equal, so a state notifier holding `Booking` will not emit, and
the screen never updates.

```dart
// After — every field appears in all three, and copyWith accepts every field
Booking copyWith({String? reference, List<Leg>? legs, String? note}) => Booking(
      reference: reference ?? this.reference,
      legs: legs ?? this.legs,
      note: note ?? this.note,
    );

@override
bool operator ==(Object other) =>
    other is Booking &&
    other.reference == reference &&
    other.legs == legs &&
    other.note == note;

@override
int get hashCode => Object.hash(reference, legs, note);
```

When counting fields against these three methods, count them one by one. This is the single most
common High-impact finding in a hand-written value class, and it is invisible on a skim.

If the project already generates value classes, a hand-written one is itself the finding.

### 3.6 `==` on a collection field

A `List` field compared with `==` compares by identity. Two lists holding the same legs are
not equal, so a state notifier holding this class never emits, and the screen silently stops
updating. Nothing crashes and no analyzer rule fires.

```dart
// Before
@override
bool operator ==(Object other) =>
    other is Itinerary && other.legs == legs;   // identity, not contents

@override
int get hashCode => Object.hash(legs);         // hashes the reference
```

```dart
// After
import 'package:flutter/foundation.dart';

@override
bool operator ==(Object other) =>
    other is Itinerary && listEquals(other.legs, legs);

@override
int get hashCode => Object.hashAll(legs);
```

`mapEquals` and `setEquals` are the equivalents for the other collections. For a nested
structure, the honest answer is usually that the class should be generated rather than
hand-written.

### 3.7 `enum`, `sealed`, or record

`sealed` is the right answer only when the variants carry different data. When they carry
none, it is ceremony.

```dart
// Over-built — three classes to express three constants
sealed class BookingStatus {}
final class Held extends BookingStatus {}
final class Confirmed extends BookingStatus {}
final class Voided extends BookingStatus {}
```

```dart
// Right-sized — a Dart 3 enum carries fields and methods when it needs to
enum BookingStatus {
  held(isFinal: false),
  confirmed(isFinal: true),
  voided(isFinal: true);

  const BookingStatus({required this.isFinal});
  final bool isFinal;
}
```

Reach for `sealed` when the variants stop being interchangeable: `Confirmed(ticketNumber)` and
`Voided(reason, refundedAt)` hold different data, and that is what an `enum` cannot do.

Records are the third option, and the boundary is visibility:

```dart
// Fine — a local pair, read three lines later
final (baseFare, taxes) = _fareParts(booking);

// A finding — the signature tells a caller nothing
(String, int, bool) parseHeader(String raw);

// Better — either name the fields, or name the type
({String title, int size, bool isValid}) parseHeader(String raw);
```

---

## 4. Flutter-specific cleanliness

### 4.1 The fat `build()` becomes named widget classes

```dart
// Before — 90 lines, four visual concepts, no const anywhere
class TravellerPage extends StatelessWidget {
  const TravellerPage({super.key, required this.traveller});
  final Traveller traveller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Row(children: [
            CircleAvatar(backgroundImage: NetworkImage(traveller.photoUrl)),
            const SizedBox(width: 12),
            Column(children: [
              Text(traveller.name, style: const TextStyle(fontSize: 22)),
              Text(traveller.email),
            ]),
          ]),
          const Divider(),
          // ... 60 more lines of trips, loyalty points and a footer
        ],
      ),
    );
  }
}
```

```dart
// After — each concept is a class with a name, a const constructor, and a DevTools identity
class TravellerPage extends StatelessWidget {
  const TravellerPage({super.key, required this.traveller});
  final Traveller traveller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          TravellerHeader(traveller: traveller),
          const Divider(),
          TravellerTrips(traveller: traveller),
          TravellerActions(traveller: traveller),
        ],
      ),
    );
  }
}

class TravellerHeader extends StatelessWidget {
  const TravellerHeader({super.key, required this.traveller});
  final Traveller traveller;

  @override
  Widget build(BuildContext context) { ... }
}
```

**Why classes and not `_buildHeader()` methods:** a widget class can be `const`, takes a `Key`,
shows up by name in the widget inspector, and rebuilds independently. A private method returning
a `Widget` gets none of that and still rebuilds with the whole parent.

A private builder is fine for a two-line local branch:

```dart
Widget _emptyState() => const Center(child: Text('No trips yet'));
```

### 4.2 Extraction has a floor as well as a ceiling

The rule pushing a fat `build()` apart pushes both ways. A widget class of a few lines, used
once, holding no state, is a name where none was needed — and now the reader opens a second
file to learn it was a `SizedBox`.

```dart
// Over-extracted — six lines and a file jump to say "gap"
class _BlockSpacer extends StatelessWidget {
  const _BlockSpacer();

  @override
  Widget build(BuildContext context) => const SizedBox(height: 20);
}
```

```dart
// Inline it
const SizedBox(height: 20)
```

Extraction earns its cost when the extracted thing has a concept worth naming, is reused,
holds state, or is large enough that leaving it inline hides the parent's shape. `_BlockSpacer`
meets none of those; `TravellerHeader` meets three.

### 4.3 Magic numbers inline

```dart
// Before
Padding(padding: const EdgeInsets.all(13), child: ...)
AnimatedOpacity(duration: const Duration(milliseconds: 340), ...)
Container(color: const Color(0xFF1F6F5C), ...)
```

```dart
// After — named, and sourced from the theme where the project has one
Padding(padding: const EdgeInsets.all(AppSpacing.md), child: ...)
AnimatedOpacity(duration: AppDurations.fade, ...)
Container(color: Theme.of(context).colorScheme.primary, ...)
```

If the project has no spacing scale, report that as an out-of-scope design-system item and name
the constants locally. Do not invent a scale.

### 4.4 Hardcoded user-facing strings

```dart
// Before
Text('Trip summary')
Text('No trips yet')
```

```dart
// After — only when the project already has localisation
Text(context.l10n.tripSummaryTitle)
Text(context.l10n.tripEmptyState)
```

**Check first.** If there is no `l10n.yaml`, no `.arb` files and no `flutter_localizations` in
`pubspec.yaml`, adopting localisation is a project decision, not a readability fix. Report it
once as out of scope, not once per string.

### 4.5 Lifecycle symmetry

```dart
// Before
class _SearchState extends State<Search> {
  final controller = TextEditingController();
  late StreamSubscription<Result> sub;

  @override
  void initState() {
    super.initState();
    sub = repo.results.listen(_onResult);
  }
  // no dispose — the controller and the subscription outlive the widget
}
```

```dart
// After
class _SearchState extends State<Search> {
  final _controller = TextEditingController();
  StreamSubscription<Result>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = repo.results.listen(_onResult);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _controller.dispose();
    super.dispose();
  }
}
```

Note the second change: `late StreamSubscription` became `StreamSubscription?`. `late` was
hiding the fact that the field genuinely has no value before `initState`.

### 4.6 `late` and `!` as type-system lies

```dart
// Before
late User currentUser;              // crashes with LateInitializationError if read early
Widget build(BuildContext c) => Text(itinerary!.title);   // crashes if itinerary is null
```

```dart
// After — the type states the truth and the widget handles the honest case
User? currentUser;

Widget build(BuildContext context) {
  final itinerary = this.itinerary;
  if (itinerary == null) return const ItinerarySkeleton();
  return Text(itinerary.title);
}
```

`late final` set exactly once in `initState` and never read before it is a legitimate use.
`late` used to avoid writing `?` is not.

---

## 5. Comments and dead weight

```dart
// Before
// Loop over the legs
for (final leg in legs) {
  // Add the fare to the total
  total += leg.fare;
}

// final oldFare = legs.fold(0, (a, b) => a + b.fare);
// TODO: clean up
```

```dart
// After — the "what" comments are gone; the "why" comment earns its place
for (final leg in legs) {
  total += leg.fare;
}

// Server rounds half-up while Dart rounds half-even; matching the server avoids
// a 1-cent mismatch on the receipt. See issue #482.
final rounded = (total * 100).roundToDouble() / 100;
```

The commented-out line is deleted — git remembers it. The ownerless `TODO` is either turned into
a tracked item with an owner or removed.

---

## 6. Error handling and data

### 6.1 Catch-and-ignore, and the lost stack trace

```dart
// Before
try {
  await _repo.save(booking);
} catch (e) {
  // nothing to do
}
```

```dart
// After — narrow type, stack trace kept, failure visible to the caller
try {
  await _repo.save(booking);
} on NetworkException catch (e, stackTrace) {
  _log.error('Saving booking ${booking.reference} failed', e, stackTrace);
  rethrow;
}
```

If the caller genuinely cannot act on the failure, say so in a `why` comment. Silence with no
explanation is the finding.

### 6.2 Error codes where the project uses exceptions

```dart
// Before
Future<int> saveBooking(Booking b) async {   // 0 = ok, 1 = network, 2 = validation
  ...
}
```

```dart
// After — pick whichever the project already uses, and use only that one
Future<void> saveBooking(Booking booking) async { ... }   // throws on failure

// or, in a Result-based codebase:
Future<Result<Booking, SaveFailure>> saveBooking(Booking booking) async { ... }
```

### 6.3 Async honesty

```dart
// Before
Future<void> refresh() async {          // async, never awaits
  _repo.sync();                         // fire-and-forget; errors vanish
}
```

```dart
// After
Future<void> refresh() => _repo.sync();
```

### 6.4 DRY on knowledge

The same rule, written twice, will drift.

```dart
// Before — fare_page.dart
final credit = traveller.isLoyaltyMember && booking.totalFare > 400 ? booking.totalFare * 0.05 : 0.0;

// Before — receipt_service.dart
final credit = booking.totalFare > 400 && traveller.isLoyaltyMember ? booking.totalFare * 0.05 : 0.0;
```

```dart
// After — one home for the rule, one place to change it, one place to test it
class LoyaltyCreditPolicy {
  static const _threshold = 400.0;
  static const _rate = 0.05;

  double creditFor(Traveller traveller, Booking booking) =>
      traveller.isLoyaltyMember && booking.totalFare > _threshold
          ? booking.totalFare * _rate
          : 0.0;
}
```

---

## 7. Not a finding

Cases that look like smells and are not. Say so out loud in the report when you decide to leave
them, so the reader knows you looked.

```dart
// Similar shape, different rules — do NOT merge these
double baggageCredit(Booking b) => b.totalFare > 400 ? b.totalFare * 0.05 : 0;
double loyaltyCredit(Booking b) => b.totalFare > 400 ? b.totalFare * 0.05 : 0;
```

Baggage and loyalty are separate business decisions that happen to agree today. Merging them
means the next change to one silently changes the other.

Also not findings:

- A long `build()` that is one flat list of unrelated fields, such as a settings page, where
  splitting adds names without adding meaning.
- A `Manager` or `Helper` name that the project's conventions file explicitly sanctions.
- `removeWhere`, `ValueNotifier.value`, and similar standard APIs that mutate and return —
  command/query separation does not override the SDK's own idiom.
- Test doubles with `UnimplementedError` on methods a given test never calls.
