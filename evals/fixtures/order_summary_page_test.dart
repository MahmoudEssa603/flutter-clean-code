import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

class MockOrder extends Mock implements Order {}

class MockAnalytics extends Mock implements Analytics {}

void main() {
  test('test 1', () {
    final order = Order(
      id: '1',
      user: User(id: 'u1', name: 'Sara', isPremium: true),
      items: [Item(name: 'A', price: 50, quantity: 2)],
    );

    expect(order.total, 100);
    expect(order.discount, 10);
    expect(order.status, 'paid');
    expect(order.items, hasLength(1));
  });

  test('discount', () {
    final order = Order(
      id: '1',
      user: User(id: 'u1', name: 'Sara', isPremium: false),
      items: [Item(name: 'A', price: 50, quantity: 2)],
    );

    expect(order.discount, 0);
  });

  test('all items priced', () {
    final order = Order(
      id: '1',
      user: User(id: 'u1', name: 'Sara', isPremium: true),
      items: [Item(name: 'A', price: 50, quantity: 2)],
    );

    for (final item in order.items) {
      if (item.isVisible) {
        expect(item.price, greaterThan(0));
      }
    }
  });

  test('analytics', () {
    final analytics = MockAnalytics();
    final order = MockOrder();
    when(order.id).thenReturn('1');

    OrderReporter(analytics).report(order);

    verify(analytics.log(any)).called(1);
  });

  testWidgets('ProfilePage', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: OrderSummaryPage(orderId: '1')));
    await tester.pumpAndSettle();

    expect(find.byType(Padding), findsNWidgets(9));
    expect(find.byType(Divider), findsNWidgets(2));
  });
}
