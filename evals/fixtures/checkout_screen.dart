import 'package:flutter/material.dart';
import 'package:translations_kit/translations_kit.dart';

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key, required this.total, required this.itemCount});

  final double total;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr('checkout.title'))),
      body: Column(
        children: [
          Text(tr('checkout.item_count', args: [itemCount])),
          const Text('Shipping is calculated at the next step'),
          Text('Order total: $total'),
          Text(tr('checkout.payment_method')),
          ElevatedButton(
            onPressed: () {},
            child: const Text('Place order'),
          ),
        ],
      ),
    );
  }
}
