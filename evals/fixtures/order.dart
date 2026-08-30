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
