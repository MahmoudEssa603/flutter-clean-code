#!/usr/bin/env node
// Lays each scenario in evals/ out as a small standalone project, because that is what running
// one actually needs. Attaching the files named in `files` is not enough: the analyzer rule wants
// an analysis_options.yaml with a rule enabled and an exclude list, DIFF wants a repository with
// two branches, the unresolved-dependency scenario wants a dependency that genuinely cannot be
// fetched, and the re-run scenario wants an older report already sitting in docs/reviews.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/make-eval-projects.mjs <target-dir> [--only <id>] [--quiet]
// Exit code 0 = every requested scenario was written, 1 = something was refused or failed.

import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
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
];

const KNOWN_IDS = new Set(SCENARIOS.map((s) => s.id));

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

function git(cwd, args) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.error) throw new Error(`git is not on PATH: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${run.stderr.trim()}`);
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
    console.error('usage: node scripts/make-eval-projects.mjs <target-dir> [--only <id>] [--quiet]');
    return 1;
  }
  if (only && !KNOWN_IDS.has(only)) {
    console.error(`unknown scenario "${only}". Known ids:\n  ${[...KNOWN_IDS].join('\n  ')}`);
    return 1;
  }

  const target = resolve(targetArg);

  // Rebuilding means deleting, so refuse a directory holding anything this script did not put
  // there. Pointing it at a real project should cost nothing.
  if (existsSync(target)) {
    const strangers = readdirSync(target).filter((entry) => !KNOWN_IDS.has(entry));
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
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    for (const [fixture, relative] of Object.entries(scenario.copy)) {
      copyFixture(dir, fixture, relative);
    }
    for (const [relative, contents] of Object.entries(scenario.write)) {
      writeFile(dir, relative, contents);
    }
    if (scenario.git) {
      buildRepository(dir, scenario.git);
      repositories += 1;
    }
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
