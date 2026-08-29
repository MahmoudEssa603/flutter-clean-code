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
Future<User> getUser(String id) async {
  final user = await _api.fetchUser(id);
  await _cache.write(id, user);   // hidden write
  _analytics.log('user_opened');  // hidden write
  return user;
}
```

```dart
// After — the read is a read; the writes are named and owned by the caller
Future<User> fetchUser(String id) => _api.fetchUser(id);

Future<User> loadAndCacheUser(String id) async {
  final user = await fetchUser(id);
  await _cache.write(id, user);
  return user;
}
```

The analytics call moved out entirely: logging that a user opened a screen is the screen's
concern, not the repository's.

### 1.2 Type noise and mental mapping

```dart
// Before
final userList = <User>[];
final strName = user.name;
final b = order.total > 0;
void doIt(Order o) { ... }
```

```dart
// After
final users = <User>[];
final name = user.name;
final hasBalance = order.total > 0;
void submitOrder(Order order) { ... }
```

### 1.3 One word per concept

Three verbs for one operation force the reader to check whether they differ.

```dart
// Before
Future<User>    fetchUser(String id);
Future<Profile> getProfile(String id);
Future<Settings> loadSettings(String id);
```

```dart
// After — pick one verb for "go get it from the source" and keep it
Future<User>     fetchUser(String id);
Future<Profile>  fetchProfile(String id);
Future<Settings> fetchSettings(String id);
```

### 1.4 Extension names

An extension is named for whom it serves, not for what it wraps.

```dart
// Before — the name says nothing a reader can use
extension StringExtension on String { ... }
extension OrderExtension on Order { ... }
```

```dart
// After
extension OrderTotals on Order {
  double get subtotal => items.fold(0.0, (sum, item) => sum + item.price);
}

extension PhoneFormatting on String {
  String get asLocalPhoneNumber => ...;
}
```

An extension on a core type that encodes one feature's rule belongs inside that feature. Once
`extension StringExtension on String` holds order formatting, invoice parsing and profile
initials, every screen that imports it gets all three.

### 1.5 Transliterated identifiers

No lint catches these, and they cost every reader a second pass: the word is neither the
English term nor the Arabic one.

```dart
// Before
Future<User> getMostakhdem(String id);
void saveBayanat(Map<String, dynamic> data);
bool get isMafool => status == 'active';
final orderTaleb = <Order>[];
```

```dart
// After
Future<User> fetchUser(String id);
void saveProfile(Map<String, dynamic> data);
bool get isActive => status == OrderStatus.active;
final orders = <Order>[];
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

`submit(order, true)` is unreadable at the call site, and the body is two functions wearing one
coat.

```dart
// Before
Future<void> submit(Order order, bool isDraft) async {
  if (isDraft) {
    await _repo.saveDraft(order);
    return;
  }
  await _validator.validate(order);
  await _repo.submit(order);
  await _notifier.confirm(order);
}
```

```dart
// After
Future<void> saveDraft(Order order) => _repo.saveDraft(order);

Future<void> submitOrder(Order order) async {
  await _validator.validate(order);
  await _repo.submit(order);
  await _notifier.confirm(order);
}
```

### 2.2 The nesting pyramid

```dart
// Before
String describe(Order? order) {
  if (order != null) {
    if (order.items.isNotEmpty) {
      if (order.isPaid) {
        return 'Paid: ${order.items.length} items';
      } else {
        return 'Awaiting payment';
      }
    } else {
      return 'Empty order';
    }
  } else {
    return 'No order';
  }
}
```

```dart
// After — guard clauses, one level of nesting
String describe(Order? order) {
  if (order == null) return 'No order';
  if (order.items.isEmpty) return 'Empty order';
  if (!order.isPaid) return 'Awaiting payment';
  return 'Paid: ${order.items.length} items';
}
```

### 2.3 Too many positional parameters

```dart
// Before
Widget priceRow(String label, double amount, bool bold, bool showCurrency, int decimals) { ... }
priceRow('Total', 42.5, true, true, 2);   // what is true, true?
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

priceRow(label: 'Total', amount: 42.5, isEmphasised: true);
```

When the same five parameters travel together to three or more functions, they are a concept:
give them a `PriceRowStyle` value class instead.

### 2.4 Imperative building where Dart has syntax for it

```dart
// Before
final children = <Widget>[];
children.add(const Header());
if (user.isPremium) {
  children.add(const PremiumBadge());
}
for (final item in items) {
  children.add(ItemTile(item: item));
}
```

```dart
// After
final children = <Widget>[
  const Header(),
  if (user.isPremium) const PremiumBadge(),
  for (final item in items) ItemTile(item: item),
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
  return 'Unknown';        // the silent hole
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
  bool isEligibleForDiscount(User u) { ... }     // business rule
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

class DiscountPolicy {
  bool isEligible(User user) { ... }
}
```

`DiscountPolicy` is the important one: a business rule with its own name is a rule you can test
and find, instead of a method buried in a data class.

### 3.3 LSP — the override that breaks the contract

```dart
// Before
class ReadOnlyCart extends Cart {
  @override
  void add(Item item) => throw UnimplementedError();   // callers of Cart now crash
}
```

```dart
// After — split the interface so the type cannot promise what it will not do
abstract interface class ReadableCart {
  List<Item> get items;
}

abstract interface class WritableCart implements ReadableCart {
  void add(Item item);
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
class Order {
  const Order({required this.id, required this.items, required this.note});

  final String id;
  final List<Item> items;
  final String note;

  Order copyWith({String? id, List<Item>? items}) =>
      Order(id: id ?? this.id, items: items ?? this.items, note: note);

  @override
  bool operator ==(Object other) =>
      other is Order && other.id == id && other.items == items;

  @override
  int get hashCode => Object.hash(id, items);
}
```

`order.copyWith(note: 'gift')` does not compile — that part is caught. But two orders differing
only by `note` compare equal, so a state notifier holding `Order` will not emit, and the screen
never updates.

```dart
// After — every field appears in all three, and copyWith accepts every field
Order copyWith({String? id, List<Item>? items, String? note}) =>
    Order(id: id ?? this.id, items: items ?? this.items, note: note ?? this.note);

@override
bool operator ==(Object other) =>
    other is Order && other.id == id && other.items == items && other.note == note;

@override
int get hashCode => Object.hash(id, items, note);
```

When counting fields against these three methods, count them one by one. This is the single most
common High-impact finding in a hand-written value class, and it is invisible on a skim.

If the project already generates value classes, a hand-written one is itself the finding.

### 3.6 `==` on a collection field

A `List` field compared with `==` compares by identity. Two lists holding the same items are
not equal, so a state notifier holding this class never emits, and the screen silently stops
updating. Nothing crashes and no analyzer rule fires.

```dart
// Before
@override
bool operator ==(Object other) =>
    other is Cart && other.items == items;   // identity, not contents

@override
int get hashCode => Object.hash(items);      // hashes the reference
```

```dart
// After
import 'package:flutter/foundation.dart';

@override
bool operator ==(Object other) =>
    other is Cart && listEquals(other.items, items);

@override
int get hashCode => Object.hashAll(items);
```

`mapEquals` and `setEquals` are the equivalents for the other collections. For a nested
structure, the honest answer is usually that the class should be generated rather than
hand-written.

### 3.7 `enum`, `sealed`, or record

`sealed` is the right answer only when the variants carry different data. When they carry
none, it is ceremony.

```dart
// Over-built — three classes to express three constants
sealed class OrderStatus {}
final class Draft extends OrderStatus {}
final class Paid extends OrderStatus {}
final class Cancelled extends OrderStatus {}
```

```dart
// Right-sized — a Dart 3 enum carries fields and methods when it needs to
enum OrderStatus {
  draft(isFinal: false),
  paid(isFinal: true),
  cancelled(isFinal: true);

  const OrderStatus({required this.isFinal});
  final bool isFinal;
}
```

Reach for `sealed` when the variants stop being interchangeable: `Paid(receiptId)` and
`Cancelled(reason, refundedAt)` hold different data, and that is what an `enum` cannot do.

Records are the third option, and the boundary is visibility:

```dart
// Fine — a local pair, read three lines later
final (subtotal, discount) = _priceParts(order);

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
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key, required this.user});
  final User user;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Row(children: [
            CircleAvatar(backgroundImage: NetworkImage(user.avatarUrl)),
            const SizedBox(width: 16),
            Column(children: [
              Text(user.name, style: const TextStyle(fontSize: 20)),
              Text(user.email),
            ]),
          ]),
          const Divider(),
          // ... 60 more lines of stats, actions and a footer
        ],
      ),
    );
  }
}
```

```dart
// After — each concept is a class with a name, a const constructor, and a DevTools identity
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key, required this.user});
  final User user;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          ProfileHeader(user: user),
          const Divider(),
          ProfileStats(user: user),
          ProfileActions(user: user),
        ],
      ),
    );
  }
}

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.user});
  final User user;

  @override
  Widget build(BuildContext context) { ... }
}
```

**Why classes and not `_buildHeader()` methods:** a widget class can be `const`, takes a `Key`,
shows up by name in the widget inspector, and rebuilds independently. A private method returning
a `Widget` gets none of that and still rebuilds with the whole parent.

A private builder is fine for a two-line local branch:

```dart
Widget _emptyState() => const Center(child: Text('No items yet'));
```

### 4.2 Extraction has a floor as well as a ceiling

The rule pushing a fat `build()` apart pushes both ways. A widget class of a few lines, used
once, holding no state, is a name where none was needed — and now the reader opens a second
file to learn it was a `SizedBox`.

```dart
// Over-extracted — six lines and a file jump to say "gap"
class _SectionGap extends StatelessWidget {
  const _SectionGap();

  @override
  Widget build(BuildContext context) => const SizedBox(height: 24);
}
```

```dart
// Inline it
const SizedBox(height: 24)
```

Extraction earns its cost when the extracted thing has a concept worth naming, is reused,
holds state, or is large enough that leaving it inline hides the parent's shape. `_SectionGap`
meets none of those; `ProfileHeader` meets three.

### 4.3 Magic numbers inline

```dart
// Before
Padding(padding: const EdgeInsets.all(17), child: ...)
AnimatedOpacity(duration: const Duration(milliseconds: 340), ...)
Container(color: const Color(0xFF3B5998), ...)
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
Text('Order summary')
Text('No items yet')
```

```dart
// After — only when the project already has localisation
Text(context.l10n.orderSummaryTitle)
Text(context.l10n.orderEmptyState)
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
Widget build(BuildContext c) => Text(profile!.name);   // crashes if profile is null
```

```dart
// After — the type states the truth and the widget handles the honest case
User? currentUser;

Widget build(BuildContext context) {
  final profile = this.profile;
  if (profile == null) return const ProfileSkeleton();
  return Text(profile.name);
}
```

`late final` set exactly once in `initState` and never read before it is a legitimate use.
`late` used to avoid writing `?` is not.

---

## 5. Comments and dead weight

```dart
// Before
// Loop over the items
for (final item in items) {
  // Add the price to the total
  total += item.price;
}

// final oldTotal = items.fold(0, (a, b) => a + b.price);
// TODO: fix this later
```

```dart
// After — the "what" comments are gone; the "why" comment earns its place
for (final item in items) {
  total += item.price;
}

// Server rounds half-up while Dart rounds half-even; matching the server avoids
// a 1-cent mismatch on the invoice. See issue #482.
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
  await _repo.save(order);
} catch (e) {
  // ignore
}
```

```dart
// After — narrow type, stack trace kept, failure visible to the caller
try {
  await _repo.save(order);
} on NetworkException catch (e, stackTrace) {
  _log.error('Saving order ${order.id} failed', e, stackTrace);
  rethrow;
}
```

If the caller genuinely cannot act on the failure, say so in a `why` comment. Silence with no
explanation is the finding.

### 6.2 Error codes where the project uses exceptions

```dart
// Before
Future<int> saveOrder(Order o) async {   // 0 = ok, 1 = network, 2 = validation
  ...
}
```

```dart
// After — pick whichever the project already uses, and use only that one
Future<void> saveOrder(Order order) async { ... }   // throws on failure

// or, in a Result-based codebase:
Future<Result<Order, SaveFailure>> saveOrder(Order order) async { ... }
```

### 6.3 Async honesty

```dart
// Before
Future<void> refresh() async {          // async, never awaits
  _repo.reload();                       // fire-and-forget; errors vanish
}
```

```dart
// After
Future<void> refresh() => _repo.reload();
```

### 6.4 DRY on knowledge

The same rule, written twice, will drift.

```dart
// Before — checkout_page.dart
final discount = user.isPremium && order.total > 100 ? order.total * 0.1 : 0.0;

// Before — invoice_service.dart
final discount = order.total > 100 && user.isPremium ? order.total * 0.1 : 0.0;
```

```dart
// After — one home for the rule, one place to change it, one place to test it
class DiscountPolicy {
  static const _threshold = 100.0;
  static const _rate = 0.1;

  double discountFor(User user, Order order) =>
      user.isPremium && order.total > _threshold ? order.total * _rate : 0.0;
}
```

---

## 7. Not a finding

Cases that look like smells and are not. Say so out loud in the report when you decide to leave
them, so the reader knows you looked.

```dart
// Similar shape, different rules — do NOT merge these
double shippingDiscount(Order o) => o.total > 100 ? o.total * 0.1 : 0;
double loyaltyDiscount(Order o)  => o.total > 100 ? o.total * 0.1 : 0;
```

Shipping and loyalty are separate business decisions that happen to agree today. Merging them
means the next change to one silently changes the other.

Also not findings:

- A long `build()` that is one flat list of unrelated fields, such as a settings page, where
  splitting adds names without adding meaning.
- A `Manager` or `Helper` name that the project's conventions file explicitly sanctions.
- `removeWhere`, `ValueNotifier.value`, and similar standard APIs that mutate and return —
  command/query separation does not override the SDK's own idiom.
- Test doubles with `UnimplementedError` on methods a given test never calls.
