import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class CartModel extends ChangeNotifier {
  final List<Item> _items = [];

  List<Item> get items => _items;

  void add(Item item) {
    _items.add(item);
    notifyListeners();
  }

  double getTotal() {
    var t = 0.0;
    for (final i in _items) {
      t += i.price * i.qty;
    }
    _cached = t;
    return t;
  }

  double _cached = 0;

  double discount(bool isMember) {
    if (isMember && getTotal() > 100) {
      return getTotal() * 0.1;
    }
    return 0;
  }
}

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, required this.isMember});

  final bool isMember;

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartModel>(context);

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(17),
            child: Text('Items: ${cart.items.length}'),
          ),
          Padding(
            padding: const EdgeInsets.all(17),
            child: Row(
              children: [
                const Text('Subtotal'),
                const Spacer(),
                Text(cart.getTotal().toStringAsFixed(2)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(17),
            child: Row(
              children: [
                const Text('Discount'),
                const Spacer(),
                Text(cart.discount(isMember).toStringAsFixed(2)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(17),
            child: Row(
              children: [
                const Text('Total'),
                const Spacer(),
                Text((cart.getTotal() - cart.discount(isMember)).toStringAsFixed(2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
