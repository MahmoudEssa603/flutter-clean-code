# Clean Code — AUDIT — customer_profile

**Scope:** `customer_profile.dart` · **Evidence:** Partial
**Conventions:** not verified
**Verification:** no Dart or Flutter SDK found on PATH. Findings are static-reading only.
**Not checked:** nothing beyond the single file in scope

## Findings

### CC-001 — `copyWith` declares `nickname` and never passes it

**Principle:** Classes & SOLID
**Impact:** High · **Effort:** XS · **Confidence:** High
**Location:** `customer_profile.dart:23`

The parameter is accepted and dropped. `copyWith(nickname: 'x')` returns the old nickname, and
nothing anywhere reports it.

### CC-002 — the retry path does nothing on a second press

**Principle:** Functions
**Impact:** High · **Effort:** S · **Confidence:** High
**Location:** `customer_profile.dart:33`

`reload()` returns early whenever `_cached` is not null, so a retry button wired to it succeeds
once and is inert afterwards. The user sees a button that does nothing.

### CC-003 — two dead files in the feature

**Principle:** Comments & dead weight
**Impact:** Medium · **Effort:** XS · **Confidence:** High
**Location:** `customer_profile.dart:1`

A text search for each file name across the feature returned no importer for two of them, so both
are dead and can be deleted.

## Out of Scope

| Observation | Why it is not clean-code work |
|---|---|
| No tests exist for this file | Adding a suite is its own piece of work |
