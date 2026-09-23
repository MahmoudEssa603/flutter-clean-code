// Unit tests for the fixture-reuse check: what counts as distinctive, how a string literal is
// read, and where a token is found. Plus two that run the script — one asserting the repository
// as committed is clean, one asserting a planted reuse fails it.
//
// Node built-ins only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  distinctiveTokens,
  fixtureFiles,
  isDistinctiveName,
  modelFacingFiles,
  occurrences,
  stringLiterals,
} from '../scripts/check-fixture-reuse.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'check-fixture-reuse.mjs');

/** Runs a script against a copy of the repository, with one file broken in the copy. */
function inBrokenCopy(script, mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'fcc-check-'));
  try {
    cpSync(ROOT, dir, {
      recursive: true,
      filter: (src) => !src.includes(`${ROOT}\\.git`) && !src.includes(`${ROOT}/.git`),
    });
    mutate(dir);
    return spawnSync(process.execPath, [join(dir, 'scripts', script)], { cwd: dir, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a name of two words is distinctive; a single word is not', () => {
  assert.equal(isDistinctiveName('getUser'), true);
  assert.equal(isDistinctiveName('_SectionGap'), true);
  assert.equal(isDistinctiveName('OrderStatus'), true);
  assert.equal(isDistinctiveName('build'), false, 'one word is the language, not the fixture');
  assert.equal(isDistinctiveName('total'), false);
  assert.equal(isDistinctiveName('Order'), false, 'a single-word type is too ordinary to prove anything');
});

test('a name the SDK supplies is never distinctive, however many words it has', () => {
  assert.equal(isDistinctiveName('initState'), false);
  assert.equal(isDistinctiveName('copyWith'), false, 'AGENTS.md allows the general copyWith rule');
  assert.equal(isDistinctiveName('findsNWidgets'), false);
});

test('one string literal cannot pair its closing quote with the next one opening', () => {
  const source = "final a = 'first one'; final b = 'second one';";
  assert.deepEqual(stringLiterals(source), ['first one', 'second one']);
});

test('an escaped quote does not end the string', () => {
  assert.deepEqual(stringLiterals("const s = 'it\\'s here';"), ["it\\'s here"]);
});

test('what a fixture would be recognised by is collected, and what it would not is left', () => {
  const source = [
    'class OrderSnapshot {',
    "  final label = 'Awaiting payment';",
    '  final colour = const Color(0xFF3B5998);',
    '  final padding = const EdgeInsets.all(17);',
    '  final gap = const SizedBox(height: 16);',
    '  void build() {}',
    '}',
  ].join('\n');

  const tokens = distinctiveTokens(source);
  assert.equal(tokens.get('OrderSnapshot'), 'name');
  assert.equal(tokens.get('Awaiting payment'), 'string');
  assert.equal(tokens.get('0xFF3B5998'), 'colour');
  assert.equal(tokens.get('17'), 'number', "the fixture's odd padding is the case this exists for");
  assert.equal(tokens.has('16'), false, 'a spacing step is a coincidence, not a reuse');
  assert.equal(tokens.has('build'), false);
});

test('a token is found only where it stands on its own', () => {
  const text = ['the getUser method', 'forgetUserId is another word', 'and `getUser()` again'].join('\n');
  assert.deepEqual(occurrences('getUser', text), [1, 3]);
});

test('the files compared are the fixtures and what a run reads', () => {
  assert.ok(fixtureFiles().includes('order_summary_page.dart'));
  assert.equal(modelFacingFiles()[0], 'SKILL.md');
  assert.ok(modelFacingFiles().includes('references/example-report.md'));
});

test('the repository as committed reuses nothing', () => {
  const run = spawnSync('node', [SCRIPT, '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

test('an example built from a fixture fails the run', () => {
  // The check reads a repository's own files, so the reuse goes into a copy of this one. A gate
  // never seen to fail is not evidence of anything.
  const run = inBrokenCopy('check-fixture-reuse.mjs', (dir) => {
    appendFileSync(join(dir, 'references', 'monorepo-scope.md'), '\n```dart\nfinal gap = _SectionGap();\n```\n');
  });

  assert.equal(run.status, 1, 'a fixture name in a reference file fails the run');
  assert.match(run.stdout, /_SectionGap/);
  assert.match(run.stdout, /order_summary_page\.dart/);
});

test('an unknown flag is refused rather than ignored', () => {
  const run = spawnSync('node', [SCRIPT, '--fix'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /unknown flag --fix/);
});
