#!/usr/bin/env node
// Lays each scenario in evals/ out as a small standalone project, because that is what running
// one actually needs. Attaching the files named in `files` is not enough: the analyzer rule wants
// an analysis_options.yaml with a rule enabled and an exclude list, DIFF wants a repository with
// two branches, the unresolved-dependency scenario wants a dependency that genuinely cannot be
// fetched, and the re-run scenario wants an older report already sitting in docs/reviews.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/make-eval-projects.mjs <target-dir> [--only <id>] [--verify | --diff] [--quiet]
//   --verify  report which laid-out projects a run has already changed, and build nothing
//   --diff    print what a run changed, as a unified diff against a fresh layout, and build nothing
// Exit code 0 = every requested scenario was written, 1 = something was refused or failed.

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'evals', 'fixtures');

const APP_PUBSPEC = [
  'name: shop',
  'publish_to: "none"',
  'version: 1.0.0+1',
  '',
  'environment:',
  '  sdk: ">=3.5.0 <4.0.0"',
  '',
].join('\n');

// The host is reserved by RFC 2606 and resolves nowhere, so `pub get` fails for the reason the
// scenario is about rather than because someone's network is slow.
const UNRESOLVABLE_PUBSPEC = [
  'name: shop',
  'publish_to: "none"',
  'version: 1.0.0+1',
  '',
  'environment:',
  '  sdk: ">=3.5.0 <4.0.0"',
  '',
  'dependencies:',
  '  flutter:',
  '    sdk: flutter',
  '  internal_ui_kit:',
  '    git:',
  '      url: https://example.invalid/internal/ui_kit.git',
  '',
].join('\n');

const PROVIDER_PUBSPEC = [
  'name: shop',
  'publish_to: "none"',
  'version: 1.0.0+1',
  '',
  'environment:',
  '  sdk: ">=3.5.0 <4.0.0"',
  '',
  'dependencies:',
  '  flutter:',
  '    sdk: flutter',
  '  provider: ^6.1.0',
  '',
].join('\n');

const ANALYSIS_OPTIONS_WITH_EXCLUDE = [
  'include: package:flutter_lints/flutter.yaml',
  '',
  'analyzer:',
  '  exclude:',
  '    - "**/*.freezed.dart"',
  '    - "**/*.g.dart"',
  '',
  'linter:',
  '  rules:',
  '    camel_case_types: true',
  '    constant_identifier_names: true',
  '    non_constant_identifier_names: true',
  '',
].join('\n');

const EN_TRANSLATIONS =
  '{ "checkout": { "title": "Checkout", "item_count": "{} items", "payment_method": "Payment method" } }\n';
const FR_TRANSLATIONS =
  '{ "checkout": { "title": "Paiement", "item_count": "{} articles", "payment_method": "Moyen de paiement" } }\n';

// `copy` paths are relative to evals/fixtures; `write` contents are scaffolding, not code under
// review. A scenario that needs a repository declares `git`.
const SCENARIOS = [
  {
    id: '01-audit-fat-widget',
    copy: { 'order_summary_page.dart': 'order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '02-refactor-without-tests',
    copy: { 'order_summary_page.dart': 'order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '03-out-of-scope-routing',
    copy: { 'order_summary_page.dart': 'order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    // No pubspec and no Dart anywhere: the scenario is about the skill staying out.
    id: '04-negative-trigger',
    copy: { 'not_dart_service.py': 'not_dart_service.py' },
    write: {},
  },
  {
    id: '05-generated-code',
    copy: {
      'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart',
      'order.dart': 'lib/features/orders/order.dart',
      'order.freezed.dart': 'lib/features/orders/order.freezed.dart',
    },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '06-diff-mode',
    copy: { 'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
    git: {
      base: 'baseline: orders feature as it already was',
      branch: 'feature/order-filters',
      // Added only on the branch, so the diff against main is exactly one file — next to a file
      // carrying far more defects that a DIFF pass must leave alone.
      add: { 'order_filters.dart': 'lib/features/orders/order_filters.dart' },
      message: 'add order filters',
    },
  },
  {
    id: '07-test-quality',
    copy: {
      'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart',
      'order_summary_page_test.dart': 'test/features/orders/order_summary_page_test.dart',
    },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '08-excluded-generated-source',
    copy: {
      'order.dart': 'lib/features/orders/order.dart',
      'order.freezed.dart': 'lib/features/orders/order.freezed.dart',
    },
    write: {
      'pubspec.yaml': APP_PUBSPEC,
      'analysis_options.yaml': ANALYSIS_OPTIONS_WITH_EXCLUDE,
    },
  },
  {
    // One file at the root: the scope is a single file, and the report should stay inline.
    id: '09-bug-line',
    copy: { 'customer_profile.dart': 'customer_profile.dart' },
    write: {},
  },
  {
    id: '10-localisation-detection',
    copy: {
      'checkout_screen.dart': 'lib/features/checkout/checkout_screen.dart',
      'localised_pubspec.yaml': 'pubspec.yaml',
    },
    write: {
      'assets/i18n/en.json': EN_TRANSLATIONS,
      'assets/i18n/fr.json': FR_TRANSLATIONS,
    },
  },
  {
    id: '11-unresolved-dependencies',
    copy: { 'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart' },
    write: { 'pubspec.yaml': UNRESOLVABLE_PUBSPEC },
  },
  {
    id: '12-rerun-rejudges',
    copy: {
      'customer_profile.dart': 'lib/features/profile/customer_profile.dart',
      // Dated earlier than today on purpose: a same-day re-run overwrites instead of comparing.
      'previous_report.md': 'docs/reviews/CLEAN-CODE-AUDIT-profile-2026-08-20.md',
    },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },

  // The four below share a shape: real Dart, a real clean-code job, and a second job belonging
  // to someone else. Three of them reuse the same file deliberately — the code does not change,
  // only what the request asks on top of it, which is the whole point.
  {
    id: '13-architecture-and-clean-code',
    copy: { 'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '14-performance-and-clean-code',
    copy: { 'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },
  {
    id: '15-state-migration-and-clean-code',
    copy: { 'cart_screen.dart': 'lib/features/cart/cart_screen.dart' },
    // Provider is declared because the request names it; the scenario is about where the
    // migration belongs, not about whether the dependency resolves.
    write: { 'pubspec.yaml': PROVIDER_PUBSPEC },
  },
  {
    id: '16-runtime-bug-and-clean-code',
    copy: { 'order_summary_page.dart': 'lib/features/orders/order_summary_page.dart' },
    write: { 'pubspec.yaml': APP_PUBSPEC },
  },

  // The same project as 15, run without naming the skill. 15 measures the rules; this measures
  // whether the description reaches them at all, which is the one thing no wording makes certain.
  {
    id: '17-activation-on-a-mixed-request',
    copy: { 'cart_screen.dart': 'lib/features/cart/cart_screen.dart' },
    write: { 'pubspec.yaml': PROVIDER_PUBSPEC },
  },
];

const KNOWN_IDS = new Set(SCENARIOS.map((s) => s.id));

/**
 * Clears a scenario directory without removing the directory itself.
 *
 * On Windows a directory cannot be deleted while any process holds it as a working directory,
 * and a terminal left sitting in the scenario folder after a run is the normal case rather than
 * the exception. Its contents delete fine, so empty it and keep the inode: rebuilding a scenario
 * must not depend on where somebody's shell happens to be parked.
 */
function emptyDirectory(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function writeFile(target, relative, contents) {
  const path = join(target, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function copyFixture(target, fixture, relative) {
  const source = join(FIXTURES, fixture);
  if (!existsSync(source)) throw new Error(`fixture is missing: evals/fixtures/${fixture}`);
  const path = join(target, relative);
  mkdirSync(dirname(path), { recursive: true });
  cpSync(source, path);
}

// Manifests live beside the scenario projects, never inside one. A file named for the scenario
// sitting in the project under review tells the session it is being evaluated, and an agent that
// knows it is being watched is not the agent the scenario meant to measure. One run cited this
// file's hash as its own proof that it had changed nothing.
const MANIFEST_DIR = '.eval-manifests';

// Build output a pass leaves behind, none of which changes what the next run reads.
//
// `docs/reviews/` used to be on this list and does not belong on it: SKILL.md tells every run to
// look there for the newest previous report before writing one, so a report left by the last run
// is read by the next. It turns an ordinary scenario into a re-run — 05, 07 and 13 each carried
// one — and in 12, which seeds a weak report on purpose, it supersedes the seeded one, so the
// scenario re-judges the previous run's corrected answer instead. --verify called all four clean.
const RUN_ARTEFACTS = /^(\.dart_tool[\\/]|\.git[\\/]|build[\\/]|pubspec\.lock$|\.flutter-plugins)/;

function projectFiles(dir) {
  const out = [];
  const walk = (sub) => {
    for (const entry of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (RUN_ARTEFACTS.test(rel)) continue;
      if (entry.isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  walk('');
  return out.sort();
}

const digest = (dir, rel) => createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex').slice(0, 16);

const manifestPath = (dir) => join(dirname(dir), MANIFEST_DIR, `${basename(dir)}.json`);

function writeManifest(dir, scenarioId) {
  const files = Object.fromEntries(projectFiles(dir).map((rel) => [rel, digest(dir, rel)]));
  const path = manifestPath(dir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ scenario: scenarioId, files }, null, 2)}\n`);
}

/**
 * How a laid-out project differs from what the generator wrote.
 *
 * A scenario that has already been run is not the scenario any more: 13 was answered once by
 * restructuring the fixture into four layers, and the next run read those layers and reported,
 * correctly and uselessly, that the work was already done. Nothing about that reply looked wrong.
 */
export function projectDrift(dir) {
  const path = manifestPath(dir);
  if (!existsSync(path)) return { known: false };

  const { files } = JSON.parse(readFileSync(path, 'utf8'));
  const present = new Set(projectFiles(dir));
  const changed = Object.keys(files).filter((rel) => !present.has(rel) || digest(dir, rel) !== files[rel]);
  const added = [...present].filter((rel) => !(rel in files));
  return { known: true, changed, added };
}

/**
 * What a run changed in a laid-out project, as a unified diff against a fresh layout of it.
 *
 * --verify says a project drifted; this says how. The repository state, not a run's account of
 * itself, decides whether an edit was unsafe, unnecessary or out of scope, and a hash cannot show
 * an edit. No pristine copy is kept on disk for this, since a copy beside the project is one more
 * thing a run could find. The scenario is laid out again in a temporary directory, both sides are
 * copied without the build output --verify also ignores, and git compares the two. A scenario
 * with a repository also gets its `git status --porcelain`, which shows staged and untracked work
 * that the file diff alone would present as plain edits.
 *
 * Returns the text, empty when the run changed nothing.
 */
export function projectDiff(dir, scenarioId) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`unknown scenario "${scenarioId}"`);

  const work = mkdtempSync(join(tmpdir(), 'eval-diff-'));
  try {
    const fresh = join(work, 'layout');
    mkdirSync(fresh);
    layOut(fresh, scenario);

    for (const [from, side] of [[fresh, 'a'], [dir, 'b']]) {
      mkdirSync(join(work, side));
      for (const rel of projectFiles(from)) {
        mkdirSync(dirname(join(work, side, rel)), { recursive: true });
        cpSync(join(from, rel), join(work, side, rel));
      }
    }

    // --no-index exits 1 when the sides differ, which is the answer, not a failure. The two
    // directories are named a and b and --no-prefix is set, so the headers read a/<path> b/<path>
    // as any other git diff does, instead of carrying the directory names twice.
    const diff = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-prefix', '--', 'a', 'b'], {
      cwd: work,
      encoding: 'utf8',
    });
    if (diff.error) throw new Error(`git is not on PATH: ${diff.error.message}`);
    if (diff.status > 1) throw new Error(`git diff --no-index failed: ${diff.stderr.trim()}`);

    let text = diff.stdout;
    if (scenario.git && existsSync(join(dir, '.git'))) {
      const status = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
      if (status.stdout.trim()) text += `
# git status --porcelain
${status.stdout}`;
    }
    return text;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function git(cwd, args) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.error) throw new Error(`git is not on PATH: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${run.stderr.trim()}`);
}

function layOut(dir, scenario) {
  for (const [fixture, relative] of Object.entries(scenario.copy)) {
    copyFixture(dir, fixture, relative);
  }
  for (const [relative, contents] of Object.entries(scenario.write)) {
    writeFile(dir, relative, contents);
  }
  if (scenario.git) buildRepository(dir, scenario.git);
}

function buildRepository(target, spec) {
  git(target, ['init', '-q', '-b', 'main', '.']);
  // Local identity only: the surrounding machine may have none, and this repository is scratch.
  git(target, ['config', 'user.email', 'eval@example.invalid']);
  git(target, ['config', 'user.name', 'eval']);
  git(target, ['add', '-A']);
  git(target, ['commit', '-q', '-m', spec.base]);
  git(target, ['checkout', '-q', '-b', spec.branch]);
  for (const [fixture, relative] of Object.entries(spec.add)) copyFixture(target, fixture, relative);
  git(target, ['add', '-A']);
  git(target, ['commit', '-q', '-m', spec.message]);
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const onlyIndex = argv.indexOf('--only');
  const only = onlyIndex === -1 ? null : argv[onlyIndex + 1];
  const flagValues = new Set([only]);
  const targetArg = argv.find((a) => !a.startsWith('--') && !flagValues.has(a));

  if (!targetArg) {
    console.error('usage: node scripts/make-eval-projects.mjs <target-dir> [--only <id>] [--verify | --diff] [--quiet]');
    return 1;
  }
  if (only && !KNOWN_IDS.has(only)) {
    console.error(`unknown scenario "${only}". Known ids:\n  ${[...KNOWN_IDS].join('\n  ')}`);
    return 1;
  }

  const target = resolve(targetArg);

  // A scenario that has already been answered is not the scenario any more. Say so before the
  // next session reads a project the last one rewrote and reports, correctly, on the wrong thing.
  if (argv.includes('--verify')) {
    const dirty = [];
    const untracked = [];
    for (const id of only ? [only] : KNOWN_IDS) {
      const dir = join(target, id);
      if (!existsSync(dir)) continue;
      const drift = projectDrift(dir);
      if (!drift.known) untracked.push(id);
      else if (drift.changed.length + drift.added.length > 0) {
        dirty.push(`${id} — ${drift.changed.length} changed, ${drift.added.length} added`);
      }
    }
    for (const line of dirty) console.error(`DIRTY  ${line}`);
    for (const id of untracked) console.error(`UNKNOWN  ${id} — built before manifests; rebuild it`);
    if (dirty.length + untracked.length === 0) {
      if (!quiet) console.log('every laid-out scenario matches what the generator wrote');
      return 0;
    }
    console.error('\nRebuild before running these, or the session reads the last run\'s output.');
    return 1;
  }

  // The diff goes to stdout so it can be saved beside the run's transcript; the verdict on it is
  // for whoever grades the run.
  if (argv.includes('--diff')) {
    if (!only) {
      console.error('--diff needs --only <id>: one run, one diff');
      return 1;
    }
    const dir = join(target, only);
    if (!existsSync(dir)) {
      console.error(`${dir} does not exist; there is no run to diff`);
      return 1;
    }
    const text = projectDiff(dir, only);
    process.stdout.write(text);
    if (!quiet) console.error(text ? `${only}: the run changed the project` : `${only}: no changes`);
    return 0;
  }

  // Rebuilding means deleting, so refuse a directory holding anything this script did not put
  // there. Pointing it at a real project should cost nothing.
  if (existsSync(target)) {
    const strangers = readdirSync(target).filter(
      (entry) => !KNOWN_IDS.has(entry) && entry !== MANIFEST_DIR,
    );
    if (strangers.length > 0) {
      console.error(
        `${target} holds entries this script does not manage: ${strangers.join(', ')}.\n` +
          'Point it at a new or empty directory instead — it deletes what it rebuilds.',
      );
      return 1;
    }
  }

  const wanted = only ? SCENARIOS.filter((s) => s.id === only) : SCENARIOS;
  let repositories = 0;

  for (const scenario of wanted) {
    const dir = join(target, scenario.id);
    emptyDirectory(dir);
    mkdirSync(dir, { recursive: true });
    layOut(dir, scenario);
    if (scenario.git) repositories += 1;
    writeManifest(dir, scenario.id);
    if (!quiet) console.log(`  ${scenario.id}`);
  }

  if (!quiet) {
    console.log('');
    console.log(`${wanted.length} scenario project(s) in ${target}`);
    if (repositories > 0) console.log(`${repositories} of them is a git repository with a branch to diff`);
    console.log('');
    console.log('Run one from a fresh session with nothing else loaded from this repository:');
    console.log(`  cd ${join(target, wanted[0].id)}`);
    console.log(`  then paste the "query" from evals/${wanted[0].id}.json`);
  }

  return 0;
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exit(main(process.argv.slice(2)));

export { SCENARIOS, main };
