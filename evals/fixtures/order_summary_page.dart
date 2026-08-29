// Eval fixture. Deliberately unclean: every problem here is planted so the evals in
// evals/*.json can check whether the skill finds it. Do not "fix" this file.
//
// Planted findings:
//   Naming        getTotal() mutates; d/tmp locals; mixed fetch/get/load verbs
//   Functions     render() takes a boolean flag; nested if pyramid
//   SOLID         OrderSummaryPage holds data access, formatting and a business rule
//   Flutter       ~120-line build(); magic 17 and 0xFF3B5998; no dispose; late abuse
//   Comments      "what" comments and a commented-out line; ownerless TODO
//   Errors        catch-and-ignore; discount rule duplicated from invoice_service
//   Duplication   three near-identical price rows in build()
//   Over-extract  _SectionGap: a one-line widget class used once
//   Collections   OrderSnapshot.== compares a List by identity

import 'dart:async';

import 'package:flutter/material.dart';

class OrderSummaryPage extends StatefulWidget {
  const OrderSummaryPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderSummaryPage> createState() => _OrderSummaryPageState();
}

class _OrderSummaryPageState extends State<OrderSummaryPage> {
  late Order order;
  final scrollController = ScrollController();
  StreamSubscription<Order>? sub;
  double _cachedTotal = 0;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    sub = OrderApi().watch(widget.orderId).listen((o) {
      setState(() {
        order = o;
        loading = false;
      });
    });
    load();
  }

  // no dispose

  Future<void> load() async {
    try {
      final d = await OrderApi().fetchOrder(widget.orderId);
      setState(() {
        order = d;
        loading = false;
      });
    } catch (e) {
      // ignore
    }
  }

  Future<User> getUser(String id) async {
    final tmp = await UserApi().loadUser(id);
    await UserCache().write(id, tmp);
    return tmp;
  }

  // Returns the total
  double getTotal() {
    var t = 0.0;
    for (final item in order.items) {
      t += item.price * item.quantity;
    }
    // final oldTotal = order.items.fold(0.0, (a, b) => a + b.price);
    _cachedTotal = t;
    return t;
  }

  // duplicated in invoice_service.dart
  double discount() {
    if (order.user.isPremium && getTotal() > 100) {
      return getTotal() * 0.1;
    }
    return 0;
  }

  String formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  String statusLabel(Order o) {
    if (o.status == 'paid') return 'Paid';
    if (o.status == 'pending') return 'Pending';
    if (o.status == 'cancelled') return 'Cancelled';
    return 'Unknown';
  }

  String describe(Order? o) {
    if (o != null) {
      if (o.items.isNotEmpty) {
        if (o.status == 'paid') {
          return 'Paid: ${o.items.length} items';
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

  Widget render(Order o, bool compact) {
    if (compact) {
      return Text(o.id, style: const TextStyle(fontSize: 12));
    }
    return Column(
      children: [
        Text(o.id),
        Text(formatDate(o.createdAt)),
      ],
    );
  }

  // TODO: fix this later
  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Build the list of rows
    final rows = <Widget>[];
    rows.add(const SizedBox(height: 8));
    for (final item in order.items) {
      rows.add(
        Padding(
          padding: const EdgeInsets.all(17),
          child: Row(
            children: [
              Text(item.name),
              const Spacer(),
              Text('${item.quantity} x ${item.price}'),
            ],
          ),
        ),
      );
    }
    if (order.user.isPremium) {
      rows.add(
        Container(
          color: const Color(0xFF3B5998),
          padding: const EdgeInsets.all(17),
          child: const Text('Premium member', style: TextStyle(color: Colors.white)),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Order ${order.id}'),
        backgroundColor: const Color(0xFF3B5998),
      ),
      body: SingleChildScrollView(
        controller: scrollController,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(17),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundImage: NetworkImage(order.user.avatarUrl),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.user.name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      Text(order.user.email),
                      Text('Joined ${formatDate(order.user.joinedAt)}'),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.all(17),
              child: Text(statusLabel(order), style: const TextStyle(fontSize: 16)),
            ),
            Padding(
              padding: const EdgeInsets.all(17),
              child: Text(describe(order)),
            ),
            ...rows,
            const Divider(),
            Padding(
              padding: const EdgeInsets.all(17),
              child: Row(
                children: [
                  const Text('Subtotal'),
                  const Spacer(),
                  Text(getTotal().toStringAsFixed(2)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(17),
              child: Row(
                children: [
                  const Text('Discount'),
                  const Spacer(),
                  Text(discount().toStringAsFixed(2)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(17),
              child: Row(
                children: [
                  const Text('Total'),
                  const Spacer(),
                  Text((getTotal() - discount()).toStringAsFixed(2)),
                ],
              ),
            ),
            render(order, false),
            Padding(
              padding: const EdgeInsets.all(17),
              child: ElevatedButton(
                onPressed: () => getUser(order.user.id),
                child: const Text('Reload profile'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Planted for the over-extraction signal: a widget class that earns nothing.
class _SectionGap extends StatelessWidget {
  const _SectionGap();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(height: 24);
  }
}

// Planted for the collection-equality signal: two snapshots holding equal items
// never compare equal, so nothing downstream rebuilds.
class OrderSnapshot {
  const OrderSnapshot(this.id, this.items);

  final String id;
  final List<Item> items;

  @override
  bool operator ==(Object other) =>
      other is OrderSnapshot && other.id == id && other.items == items;

  @override
  int get hashCode => Object.hash(id, items);
}
