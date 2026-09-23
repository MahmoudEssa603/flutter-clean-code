#!/usr/bin/env node
// Checks that no example in `SKILL.md` or `references/` is built from an eval fixture.
//
// This is the rule under "No example reuses an eval fixture" in AGENTS.md, and it exists because
// the examples once were the fixtures: `references/example-report.md` was a full audit of
// `evals/fixtures/order_summary_page.dart`, the file three scenarios review, and `SKILL.md` used
// that file's own misnamed method as its example of a misleading name. A run could then read its
// answers instead of finding them, and every measurement taken that way means nothing.
//
// It compares only what is distinctive: a name of two or more words, a string of two or more
// words, a colour, a number nobody picks twice by accident. A fixture calling `build` or `test`
// shares a word with the language, not with the example.
//
// Node built-ins only. Usage: node scripts/check-fixture-reuse.mjs [--quiet]
// Exit code 0 = nothing shared, 1 = a fixture token appears in what a run reads.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Names the SDK defines. A fixture overriding or calling one invented nothing, so an example
// using the same name shares nothing with the fixture. AGENTS.md names this exemption: the only
// matches allowed are SDK names and rules stated in general terms.
const SDK_NAMES = new Set([
  'initState', 'didUpdateWidget', 'didChangeDependencies', 'dispose', 'setState', 'createState',
  'copyWith', 'hashCode', 'toString', 'toStringAsFixed', 'listEquals', 'hashAll', 'runApp',
  'testWidgets', 'pumpWidget', 'pumpAndSettle', 'findsOneWidget', 'findsNothing', 'findsNWidgets',
  'addListener', 'removeListener', 'notifyListeners', 'fromJson', 'toJson', 'debugPrint',
  'ensureInitialized', 'addPostFrameCallback',
]);

// Numbers a reader meets everywhere: a spacing step, a power of two, a round threshold. Sharing
// one is a coincidence. Every other number in a fixture is a choice, and `17` — the fixture's
// odd padding — is exactly the kind this has to catch.
const COMMONPLACE_NUMBERS = new Set([
  '10', '12', '16', '20', '24', '32', '40', '48', '50', '60', '64', '100', '128', '200', '256',
  '500', '1000', '1024',
]);

/** String literals, paired left to right so one string's closing quote cannot open the next. */
export function stringLiterals(source) {
  const found = [];
  for (const m of source.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g)) {
    found.push(m[0].slice(1, -1));
  }
  return found;
}

/** A name is distinctive when it is made of two or more words, and the SDK did not supply it. */
export function isDistinctiveName(token) {
  if (SDK_NAMES.has(token)) return false;
  return /^_?[A-Z][a-z0-9]*[A-Z]/.test(token) || /^_?[a-z][a-z0-9]*[A-Z]/.test(token);
}

const DECLARATIONS = [
  /\b(?:class|mixin|enum|extension|typedef)\s+(_?\w+)/g,
  /\b(?:final|const|var|late)\s+(?:[\w<>,?\s]+\s+)?(_?\w+)\s*[=;]/g,
  /^\s*(?:@override\s+)?(?:static\s+)?(?:[\w<>,?[\]]+\s+)?(_?\w+)\s*\([^)]*\)\s*(?:async\s*)?[{=]/gm,
  /^\s*(?:final|late|static)?\s*[\w<>,?]+\s+(_?\w+)\s*;/gm,
];

/** Everything in one fixture that would be a choice to reuse rather than a coincidence. */
export function distinctiveTokens(source) {
  const tokens = new Map();
  const add = (token, kind) => {
    if (!tokens.has(token)) tokens.set(token, kind);
  };

  for (const pattern of DECLARATIONS) {
    for (const m of source.matchAll(pattern)) {
      if (isDistinctiveName(m[1])) add(m[1], 'name');
    }
  }
  for (const literal of stringLiterals(source)) {
    const text = literal.trim();
    // Two words or more: a sentence someone wrote, not a token the language supplies.
    if (/\S\s+\S/.test(text) && text.length >= 6) add(text, 'string');
  }
  for (const m of source.matchAll(/\b(0x[0-9a-fA-F]{6,8})\b/g)) add(m[1], 'colour');
  for (const m of source.matchAll(/\b(\d{2,})\b/g)) {
    if (!COMMONPLACE_NUMBERS.has(m[1])) add(m[1], 'number');
  }
  return tokens;
}

/** The 1-based lines of a text on which a token appears as a whole token. */
export function occurrences(token, text) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needle = new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`);
  const lines = [];
  text.split('\n').forEach((line, index) => {
    if (needle.test(line)) lines.push(index + 1);
  });
  return lines;
}

export function modelFacingFiles(root = ROOT) {
  return [
    'SKILL.md',
    ...readdirSync(join(root, 'references'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => `references/${f}`),
  ];
}

export function fixtureFiles(root = ROOT) {
  return readdirSync(join(root, 'evals', 'fixtures'))
    .filter((f) => f.endsWith('.dart'))
    .sort();
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const unknown = argv.filter((a) => a.startsWith('--') && a !== '--quiet');
  if (unknown.length > 0) {
    console.error(`check-fixture-reuse.mjs: unknown flag ${unknown.join(', ')}`);
    console.error('Usage: node scripts/check-fixture-reuse.mjs [--quiet]');
    return 1;
  }

  const tokens = new Map(); // token -> { kind, fixture }
  for (const file of fixtureFiles()) {
    const source = readFileSync(join(ROOT, 'evals', 'fixtures', file), 'utf8');
    for (const [token, kind] of distinctiveTokens(source)) {
      if (!tokens.has(token)) tokens.set(token, { kind, fixture: file });
    }
  }

  const shared = [];
  for (const path of modelFacingFiles()) {
    const text = readFileSync(join(ROOT, path), 'utf8');
    for (const [token, info] of tokens) {
      for (const line of occurrences(token, text)) {
        shared.push({ token, ...info, path, line });
      }
    }
  }

  if (!quiet || shared.length > 0) {
    console.log(
      `${tokens.size} distinctive token(s) across ${fixtureFiles().length} fixture(s), against ${modelFacingFiles().length} file(s) a run reads`,
    );
  }
  for (const hit of shared) {
    console.log(`✗ ${hit.path}:${hit.line} uses ${hit.kind} ${JSON.stringify(hit.token)} from ${hit.fixture}`);
  }
  if (shared.length > 0) {
    console.log('');
    console.log('An example built from a fixture hands a run its answers. Rewrite it in a domain');
    console.log('no scenario uses, or add the name to SDK_NAMES if the SDK is where it comes from.');
    return 1;
  }
  if (!quiet) console.log('No example reuses a fixture.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
