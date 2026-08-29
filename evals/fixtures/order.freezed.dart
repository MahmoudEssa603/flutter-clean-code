// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint

part of 'order.dart';

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError('It seems like you constructed your class using `MyClass._()`.');

mixin _$Order {
  String get id => throw _privateConstructorUsedError;
  List<Item> get items => throw _privateConstructorUsedError;
  User get user => throw _privateConstructorUsedError;

  @JsonKey(ignore: true)
  $OrderCopyWith<Order> get copyWith => throw _privateConstructorUsedError;
}

abstract class $OrderCopyWith<$Res> {
  factory $OrderCopyWith(Order value, $Res Function(Order) then) = _$OrderCopyWithImpl<$Res, Order>;
  @useResult
  $Res call({String id, List<Item> items, User user});
}

class _$OrderCopyWithImpl<$Res, $Val extends Order> implements $OrderCopyWith<$Res> {
  _$OrderCopyWithImpl(this._value, this._then);

  final $Val _value;
  final $Res Function($Val) _then;

  @override
  $Res call({Object? id = null, Object? items = null, Object? user = null}) {
    return _then(_value.copyWith(
      id: null == id ? _value.id : id as String,
      items: null == items ? _value.items : items as List<Item>,
      user: null == user ? _value.user : user as User,
    ) as $Val);
  }
}
