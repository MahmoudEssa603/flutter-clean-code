// Fixture: a screen in a project that is already localised, paired with localised_pubspec.yaml.
//
// Most of the copy goes through the lookup call the localisation package provides. Three strings
// do not, and each is user-facing. Because the project already localises, each one is a finding
// with its own location — not a single line handing localisation back as a project decision.
//
// Nothing here names an .arb file, an l10n.yaml or flutter_localizations, which is the point:
// deciding from those three markers alone would read this project as unlocalised.

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
