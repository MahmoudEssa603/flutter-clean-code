// Unit tests for the snippet checker: what it pulls out of the markdown, what it fills an
// elision with, how it wraps a fragment, and where it splits one. The two tests that need the
// Dart SDK say so and skip when it is absent, rather than passing quietly without it.
//
// Node built-ins only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  READINGS,
  extractSnippets,
  fillElisions,
  modelFacingMarkdown,
  splitGroups,
} from '../scripts/check-dart-examples.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'check-dart-examples.mjs');

const hasDart = () => {
  const run = spawnSync('dart', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return !run.error && run.status === 0;
};

test('only dart blocks are extracted, with the line their fence sits on', () => {
  const markdown = [
    '# Title',
    '',
    '```dart',
    'final a = 1;',
    '```',
    '',
    '```bash',
    'node scripts/scan-dart.mjs .',
    '```',
    '',
    '```dart',
    'final b = 2;',
    '```',
  ].join('\n');

  const found = extractSnippets(markdown, 'x.md');
  assert.equal(found.length, 2, 'the bash block is not a Dart snippet');
  assert.deepEqual(
    found.map((s) => [s.line, s.source]),
    [
      [3, 'final a = 1;'],
      [11, 'final b = 2;'],
    ],
  );
});

test('an unclosed block does not swallow the rest of the file', () => {
  const found = extractSnippets(['```dart', 'final a = 1;'].join('\n'), 'x.md');
  assert.deepEqual(found, [], 'a block with no closing fence yields no snippet');
});

test('an elision becomes whatever parses where it stands', () => {
  assert.equal(fillElisions('void f() { ... }'), 'void f() {}');
  assert.equal(fillElisions('String get name => ...;'), 'String get name => _elided;');
  assert.equal(fillElisions('Padding(padding: p, child: ...)'), 'Padding(padding: p, child: _elided)');
  assert.equal(fillElisions('class A {\n  ...\n}'), 'class A {}', 'a body of nothing but an elision is empty');
  assert.equal(
    fillElisions('class A {\n  int x = 1;\n  ...\n}'),
    'class A {\n  int x = 1;\n  // ...\n}',
    'an elision standing beside real members is a comment',
  );
});

test('a spread is not an elision', () => {
  const source = 'final all = [...first, ...second];';
  assert.equal(fillElisions(source), source, 'a spread is real Dart and is left alone');
});

test('the member reading hoists directives out of the class it builds', () => {
  const wrapped = READINGS.member("import 'package:flutter/foundation.dart';\n\n@override\nint get hashCode => 1;");
  assert.match(wrapped, /^import 'package:flutter\/foundation\.dart';/);
  assert.match(wrapped, /class _Wrap \{/);
  assert.doesNotMatch(wrapped, /class _Wrap \{[\s\S]*import /, 'no directive is left inside the class');
});

test('the list reading gives each expression the comma a list needs', () => {
  const wrapped = READINGS.list("Text('a')\nText('b')");
  assert.match(wrapped, /Text\('a'\),/);
  assert.match(wrapped, /Text\('b'\),/);
});

test('a snippet splits where a blank line separates two fragments', () => {
  const parts = splitGroups('final (a, b) = pair();\n\nint parse(String raw);\n');
  assert.deepEqual(parts, ['final (a, b) = pair();', 'int parse(String raw);']);
});

test('the files checked are the ones a run reads', () => {
  const files = modelFacingMarkdown();
  assert.equal(files[0], 'SKILL.md');
  assert.ok(files.every((f) => f === 'SKILL.md' || f.startsWith('references/')));
  assert.ok(files.includes('references/dart-examples.md'));
});

test('the repository as committed has no unparsable snippet', { skip: hasDart() ? false : 'dart is not on PATH' }, () => {
  const run = spawnSync('node', [SCRIPT, '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

test('a snippet with a syntax error is reported, and the run fails', { skip: hasDart() ? false : 'dart is not on PATH' }, () => {
  // The check reads this repository's own files, so the broken snippet is put in one of them and
  // taken out again. A gate that is never seen to fail is not evidence of anything.
  const target = join(ROOT, 'references', 'monorepo-scope.md');
  const original = spawnSync('git', ['show', 'HEAD:references/monorepo-scope.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  assert.equal(original.status, 0, 'the file has to be readable from git to be restored');

  const scratch = mkdtempSync(join(tmpdir(), 'dart-examples-test-'));
  try {
    writeFileSync(join(scratch, 'saved.md'), original.stdout);
    writeFileSync(target, `${original.stdout}\n\`\`\`dart\nfinal broken = ((;\n\`\`\`\n`);

    const run = spawnSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(run.status, 1, 'an unparsable snippet fails the run');
    assert.match(run.stdout, /no reading parses it/);
    assert.match(run.stdout, /references\/monorepo-scope\.md:\d+/);
  } finally {
    writeFileSync(target, original.stdout);
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('an unknown flag is refused rather than ignored', () => {
  const run = spawnSync('node', [SCRIPT, '--verify-clean'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /unknown flag --verify-clean/);
});
