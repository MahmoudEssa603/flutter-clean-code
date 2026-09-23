# Holdout baseline — the skill on code it has never seen

30 runs on 2026-09-23: 5 files × 2 conditions × 3 repetitions, headless, in the isolated
evaluation install (`eefe610`), CLI 2.1.278, `claude-opus-5`, effort `xhigh`, permission mode
`auto`. All 30 valid under `check-run.mjs`, and every run left its sources byte-identical, which
matters here because the holdout is never rebuilt between runs. Cost: $35.12.

**This is the pre-change measurement.** It is taken before any 1.7.0 edit to `SKILL.md` and is
re-run afterwards, so a change can be shown to generalise rather than to fit the fixtures. It is
measured, never tuned against: a failure here motivates nothing on its own — it has to reproduce
on a development fixture first.

## The files

Real code from open-source projects, pinned by commit, kept outside this repository and used
under their licences. Nothing third-party is committed; `D:\eval-holdout\.holdout-manifest.json`
records where each came from, so the set rebuilds byte for byte.

| Case | What it is | Source | Licence |
|---|---|---|---|
| H1 | an animated onboarding screen, 383 lines | `gskinnerTeam/flutter-wonderous-app` `lib/ui/screens/intro/intro_screen.dart` | MIT |
| H2 | an application page wired to a state layer, 263 lines | `localsend/localsend` `app/lib/pages/send_page.dart` | Apache-2.0 |
| H3 | a game-engine base class, no widgets, 419 lines | `flame-engine/flame` `packages/flame/lib/src/game/flame_game.dart` | MIT |
| H4 | a plugin's public API facade, 281 lines | `Baseflow/flutter-geolocator` `geolocator/lib/geolocator.dart` | MIT |
| H5 | a real test suite, 384 lines | `flame-engine/flame` `packages/flame/test/effects/opacity_effect_test.dart` | MIT |

Ground truth was drafted twice per file by reviewers who saw only the file and its pubspec, then
merged under the A/B rule: an item is required only where both drafts agreed. Required counts are
low — 2 or 3 per file — because this is code that shipped.

## Findings

Three runs per cell, then the mean. A difference counts as meaningful only when the means differ
by at least 1 **and** the ranges do not overlap.

| Case | true findings WITH | WITHOUT | verdict | required missed WITH / WITHOUT |
|---|---|---|---|---|
| H1 animated screen | 15, 17, 17 → **16.3** | 13, 12, 12 → 12.3 | meaningful, WITH higher | 0.0 / 1.0 |
| H2 application page | 12, 11, 11 → **11.3** | 8, 9, 10 → 9.0 | meaningful, WITH higher | 0.0 / 0.0 |
| H3 engine class | 5, 6, 10 → 7.0 | 6, 9, 5 → 6.7 | unchanged | 0.3 / 0.3 |
| H4 plugin facade | 6, 6, 6 → 6.0 | 7, 5, 6 → 6.0 | unchanged | 1.0 / 1.0 |
| H5 test suite | 6, 7, 6 → 6.3 | 6, 6, 8 → 6.7 | unchanged | 1.0 / 1.0 |

The strict and adjusted columns are identical on every case: no output lost a required item to
the one-entry-one-item rule here, because the keys are small enough that nothing needed grouping.

## What the numbers say

**The skill helps where the file is broad, and not where it is narrow.** H1 and H2 are screens
with many kinds of problem at once — lifecycle, naming, duplication, layout, state. Both show a
real gap. H3, H4 and H5 are specialised: an engine base class, an API facade, a test suite. On
those, the two conditions are indistinguishable.

That matches the A/B set, where the gap appeared on the mixed request and the two-file scope and
vanished on a 45-line model file.

**Accuracy is not the difference.** Across all 30 runs and roughly 250 findings the key does not
contain, exactly **two assert something untrue about the code**: one run measured a line at 137
characters where it is 127, and one called three differently-scoped names "three phrasings for
one concept". Everything else is either true and simply absent from the key, or not a claim at
all.

**The Out of Scope section is most of the gap in the false-positive column.** WITH runs file
3.7 to 8.3 entries per run that assert no defect — hand-backs, deliberate non-findings, notes
about the project's tooling. WITHOUT runs file almost none. Under the strict rubric those count
as false positives, which is why that column reads against the skill while the untrue-claim
column stays at zero.

**Both conditions miss the same hard defects.** In H5 every one of the six runs missed the
required item — a test named "infinite fade out" that steps by exactly the effect's own duration,
so the repetition it is named for is never observed, and one run asserted the opposite. In H4 no
run caught both required items: five read `openAppSettings`' doc comment for its dartdoc syntax
and none noticed its summary describes the location settings page. These are the cases where a
reviewer has to reason about what the code *does*, not how it is shaped, and neither condition
does it.

## One correction to the ground truth

`H1-14` claimed a fully transparent finish button stays in the semantics tree. Flutter drops
children from semantics at alpha 0, so the semantics half of that claim is wrong; the item is
kept for the pointer-target half and marked optional. A grader found it, one output had said the
opposite and was right. Recorded in the key with its date and reason, and no grade depended on
it.

## Cost

| | WITH | WITHOUT |
|---|---|---|
| answer length | 15k–26k chars | 4k–7k chars |
| per run | $1.15–$2.23 | $0.52–$1.08 |
| total | $23.49 | $11.63 |
