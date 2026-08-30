// Fixture: the hand-written source that produces order.freezed.dart.
//
// Five of the six variants redirect to an UpperCamelCase class. One redirects to
// `_orderCancelled`, so the generated class breaks the casing its siblings keep. The rule that
// would normally report a class name like that is a lint on the generated file — and a project
// whose analyzer excludes generated output can never fire it. The defect is real, nobody will
// ever be told about it, and the place to fix it is here.

import 'package:freezed_annotation/freezed_annotation.dart';

part 'order.freezed.dart';

@freezed
class OrderStatus with _$OrderStatus {
  const factory OrderStatus.draft() = _Draft;
  const factory OrderStatus.submitted() = _Submitted;
  const factory OrderStatus.paid(String receiptId) = _Paid;
  const factory OrderStatus.shipped(String trackingId) = _Shipped;
  const factory OrderStatus.cancelled(String reason) = _orderCancelled;
  const factory OrderStatus.refunded(String reason) = _Refunded;
}
