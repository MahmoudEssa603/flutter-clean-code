// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint

part of 'order.dart';

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError('It seems like you constructed your class using `MyClass._()`.');

mixin _$OrderStatus {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() draft,
    required TResult Function() submitted,
    required TResult Function(String receiptId) paid,
    required TResult Function(String trackingId) shipped,
    required TResult Function(String reason) cancelled,
    required TResult Function(String reason) refunded,
  }) =>
      throw _privateConstructorUsedError;
}

class _Draft implements OrderStatus {
  const _Draft();
}

class _Submitted implements OrderStatus {
  const _Submitted();
}

class _Paid implements OrderStatus {
  const _Paid(this.receiptId);

  final String receiptId;
}

class _Shipped implements OrderStatus {
  const _Shipped(this.trackingId);

  final String trackingId;
}

class _orderCancelled implements OrderStatus {
  const _orderCancelled(this.reason);

  final String reason;
}

class _Refunded implements OrderStatus {
  const _Refunded(this.reason);

  final String reason;
}
