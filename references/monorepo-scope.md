# Monorepo scope — one repository, several packages

Read this in Step 1 when the repository holds more than one package. In a single-package project
nothing here applies, and the scope ladder in SKILL.md is already correct.

## Contents

- [Detecting one](#detecting-one)
- [What changes](#what-changes)
- [The analyzer rule, per package](#the-analyzer-rule-per-package)
- [Package or app, per package](#package-or-app-per-package)
- [Where the report goes](#where-the-report-goes)
- [What does not change](#what-does-not-change)

---

## Detecting one

Look at the repository root before scoping. Any one of these says several packages:

| Signal at the root | What it is |
|---|---|
| `pubspec.yaml` with a `workspace:` list | A pub workspace, Dart 3.6 and later. Members carry `resolution: workspace`. |
| `pubspec.yaml` with a `melos:` key | Melos 7 and later, which keeps its configuration there rather than in its own file. |
| `melos.yaml` | Melos before 7. Its `packages:` globs name the members. |
| Several `pubspec.yaml` files under `packages/`, `apps/` or `modules/`, and no `lib/` at the root | A monorepo held together by tooling this skill cannot see, or by nothing. |

The last row is the one to be careful with. A repository can be a monorepo in fact without
declaring it anywhere, and a root with no `lib/` is the giveaway: there is no code to audit at
the path the single-package ladder would have started from.

A `workspace:` list may use globs from Dart 3.11. Expand it against the filesystem rather than
reading it as a literal path list, or a `packages/*` entry resolves to nothing and the pass
reports an empty project.

## What changes

The scope ladder gains a rung above module: **package → module → feature → file**. Everything
below the package rung works exactly as SKILL.md describes.

A whole-repository request therefore means N packages, not one large project, and the pass runs
one package at a time. Rank packages the way Step 1 ranks features — signals per file, over
every non-generated file the scanner read — and take the top three in one pass, saying which
packages are queued. Three packages of three features each is nine reports nobody will read; the
three-module budget is a budget on the whole pass, not per package.

Run the scanner against each package's `lib/` separately. Pointing it at the repository root
sweeps every package into one ranking, where a large package outranks a bad small one and the
per-package answers below cannot be given at all.

## The analyzer rule, per package

SKILL.md drops a finding an enabled lint already catches. In a monorepo, *which* lints are
enabled is a per-package question, and getting it wrong drops real findings or reports noise.

The analyzer walks up from the file being analysed and uses the **nearest**
`analysis_options.yaml` it finds — only that one. It does not merge the files it passed on the
way up. So a package with its own `analysis_options.yaml` is governed by that file alone, even
when a stricter one sits at the root, and a package without one is governed by the root's.

Two consequences, both easy to get backwards:

- **Resolve the file per package, then read its `include:` chain.** A package file that says
  `include: ../../analysis_options.yaml` does inherit the root, and local keys override what they
  include. A package file that says nothing of the kind inherits nothing.
- **`exclude:` globs are relative to the directory holding the file that declares them.** A root
  `exclude:` naming `lib/generated/**` excludes the root package's directory, not each member's.
  Check the exclusion against the file it came from before concluding a file is unanalysed.

State in the report which `analysis_options.yaml` governed each package. A reader who disagrees
with a dropped finding needs to know which file the decision was made against.

## Package or app, per package

Step 1 asks whether the project is a package or an application. In a monorepo the answer differs
between members, so ask it once per package rather than once per pass.

`publish_to: none` decides even less here than usual: workspace members routinely carry it while
being depended on by every other member in the repository. A member imported by a sibling has
real consumers whatever it publishes to, so an undocumented public member in it is High-impact.
Look at who imports it, not at what it publishes to.

## Where the report goes

Two packages can hold a module of the same name — `auth` in the app and `auth` in a shared
package are different code with the same report filename. Put the package in the path:
`docs/reviews/<package>/<module>-<date>.md`.

The Since-last-pass table then reads the previous report for that package's module, not another
package's. Finding numbers are per report as before: `CC-003` in one package's report has nothing
to do with `CC-003` in another's, and they are never renumbered to be globally unique.

## What does not change

- Rule Zero, the evidence levels, and the Out of Scope list.
- The 20-finding cap, which is per module, not per package.
- Cross-package findings are still findings — the same helper written twice in two packages is
  one DRY finding, reported in the package you are auditing, naming the other by path.
- Restructuring which package owns what is module structure, and stays Out of Scope.
