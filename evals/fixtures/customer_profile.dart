// Fixture: two defects that sit on opposite sides of the bug line.
//
//   Shape-visible — `copyWith` declares `nickname` and never passes it on. Reading the
//   signature next to the body is enough to see it, so it belongs to this skill.
//
//   Run-only — `reload()` returns early whenever a profile is already cached, so the retry
//   button that calls it does nothing on the second press. Nothing in the shape of the code
//   says that; you have to follow the flow at runtime. It belongs to whoever fixes bugs.

class CustomerProfile {
  const CustomerProfile({
    required this.id,
    required this.displayName,
    required this.nickname,
    required this.email,
  });

  final String id;
  final String displayName;
  final String nickname;
  final String email;

  CustomerProfile copyWith({
    String? id,
    String? displayName,
    String? nickname,
    String? email,
  }) {
    return CustomerProfile(
      id: id ?? this.id,
      displayName: displayName ?? this.displayName,
      nickname: this.nickname,
      email: email ?? this.email,
    );
  }
}

class ProfileController {
  CustomerProfile? _cached;

  Future<void> reload() async {
    if (_cached != null) return;
    _cached = await _fetch();
  }

  Future<CustomerProfile> _fetch() async {
    return const CustomerProfile(
      id: '1',
      displayName: 'Anonymous',
      nickname: 'anon',
      email: 'nobody@example.com',
    );
  }
}
