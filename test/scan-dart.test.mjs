// Unit tests for the scanner's parsing logic.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  blankNonCode,
  countPositional,
  findDuplication,
  findFunctions,
  findStateClasses,
  findTrivialWidgets,
  isGenerated,
  normaliseLines,
  scanFile,
  signalCount,
} from '../scripts/scan-dart.mjs';

// --- blankNonCode ------------------------------------------------------------
// Everything downstream counts braces, so a brace hiding inside a string or a
// comment is the failure mode that would silently corrupt every measurement.

test('blankNonCode keeps length and line count identical', () => {
  const source = "void f() {\n  final s = 'hi';\n}\n";
  const code = blankNonCode(source);
  assert.equal(code.length, source.length);
  assert.equal(code.split('\n').length, source.length ? source.split('\n').length : 0);
});

test('blankNonCode removes a brace hidden in a string literal', () => {
  const code = blankNonCode("void f() { final s = '}'; }");
  // Two real braces remain: the ones that actually open and close the body.
  assert.equal((code.match(/[{}]/g) ?? []).length, 2);
});

test('blankNonCode removes a brace hidden in a line comment', () => {
  const code = blankNonCode('void f() {\n  // }\n}\n');
  assert.equal((code.match(/[{}]/g) ?? []).length, 2);
});

test('blankNonCode removes a brace hidden in a block comment', () => {
  const code = blankNonCode('void f() {\n  /* } } } */\n}\n');
  assert.equal((code.match(/[{}]/g) ?? []).length, 2);
});

test('blankNonCode handles an escaped quote inside a string', () => {
  const code = blankNonCode("void f() { final s = 'it\\'s }'; }");
  assert.equal((code.match(/[{}]/g) ?? []).length, 2);
});

test('blankNonCode handles a triple-quoted string spanning lines', () => {
  const source = "void f() {\n  final s = '''\n  }\n  ''';\n}\n";
  const code = blankNonCode(source);
  assert.equal((code.match(/[{}]/g) ?? []).length, 2);
  assert.equal(code.split('\n').length, source.split('\n').length);
});

// --- countPositional ---------------------------------------------------------

test('countPositional counts only parameters outside {} and []', () => {
  assert.equal(countPositional('String a, int b'), 2);
  assert.equal(countPositional('String a, {int? b, int? c}'), 1);
  assert.equal(countPositional('{required String a, required int b}'), 0);
  assert.equal(countPositional('String a, [int? b]'), 1);
  assert.equal(countPositional(''), 0);
});

test('countPositional does not split on a comma inside generics', () => {
  assert.equal(countPositional('Map<String, List<int>> m, int b'), 2);
});

// --- findFunctions -----------------------------------------------------------

test('findFunctions measures length, name and nesting', () => {
  const source = [
    'class A {',
    '  void run(int a) {',
    '    if (a > 0) {',
    '      for (var i = 0; i < a; i++) {',
    '        print(i);',
    '      }',
    '    }',
    '  }',
    '}',
  ].join('\n');

  const run = findFunctions(source).find((f) => f.name === 'run');
  assert.ok(run, 'run() was not found');
  assert.equal(run.line, 2);
  assert.equal(run.length, 7);
  assert.equal(run.nesting, 2);
  assert.equal(run.positional, 1);
});

test('findFunctions sees through async and async* modifiers', () => {
  const source = 'Future<void> load() async {\n  await x();\n}\n';
  const names = findFunctions(source).map((f) => f.name);
  assert.deepEqual(names, ['load']);
});

test('findFunctions ignores control-flow keywords that look like calls', () => {
  const source = 'void f() {\n  if (a) {\n    b();\n  }\n  while (c) {\n    d();\n  }\n}\n';
  const names = findFunctions(source).map((f) => f.name);
  assert.deepEqual(names, ['f']);
});

test('findFunctions counts a bool parameter but not an isX property', () => {
  const source = 'Widget render(Order o, bool compact) {\n  return X();\n}\n';
  const withFlag = findFunctions(source).find((f) => f.name === 'render');
  assert.equal(withFlag.boolParams, 1);

  const configured = 'Widget row(String label, {bool isEmphasised = false}) {\n  return X();\n}\n';
  assert.equal(findFunctions(configured).find((f) => f.name === 'row').boolParams, 0);
});

test('findFunctions does not measure arrow bodies — a known limitation', () => {
  // Documented rather than fixed: an expression body has no braces to match, so
  // it has no length to report. The checklist still catches these by reading.
  const source = 'int double(int a) => a * 2;\n';
  assert.deepEqual(findFunctions(source), []);
});

// --- isGenerated -------------------------------------------------------------

test('isGenerated matches by suffix', () => {
  assert.equal(isGenerated('lib/models/order.g.dart', ''), true);
  assert.equal(isGenerated('lib/models/order.freezed.dart', ''), true);
  assert.equal(isGenerated('lib/models/order.mocks.dart', ''), true);
  assert.equal(isGenerated('lib/models/order.dart', ''), false);
});

test('isGenerated matches by banner in the first lines', () => {
  const banner = '// GENERATED CODE - DO NOT MODIFY BY HAND\n\nclass X {}\n';
  assert.equal(isGenerated('lib/x.dart', banner), true);
});

test('isGenerated ignores a banner far down the file', () => {
  const late = `${'\n'.repeat(40)}// GENERATED CODE\n`;
  assert.equal(isGenerated('lib/x.dart', late), false);
});

// --- findStateClasses --------------------------------------------------------

test('findStateClasses reports a disposable with no dispose', () => {
  const source = [
    'class _AState extends State<A> {',
    '  final controller = TextEditingController();',
    '  @override',
    '  Widget build(BuildContext context) => X();',
    '}',
  ].join('\n');

  const found = findStateClasses(source);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, '_AState');
  assert.equal(found[0].line, 1);
});

test('findStateClasses stays quiet when dispose exists', () => {
  const source = [
    'class _AState extends State<A> {',
    '  final controller = TextEditingController();',
    '  @override',
    '  void dispose() {',
    '    controller.dispose();',
    '    super.dispose();',
    '  }',
    '}',
  ].join('\n');

  assert.deepEqual(findStateClasses(source), []);
});

test('findStateClasses stays quiet when nothing disposable is created', () => {
  const source = 'class _AState extends State<A> {\n  int count = 0;\n}\n';
  assert.deepEqual(findStateClasses(source), []);
});

// --- findTrivialWidgets ------------------------------------------------------

test('findTrivialWidgets reports a tiny single-use widget class', () => {
  const source = [
    'class _Gap extends StatelessWidget {',
    '  @override',
    '  Widget build(BuildContext context) {',
    '    return const SizedBox(height: 8);',
    '  }',
    '}',
    'final x = _Gap();',
  ].join('\n');

  const found = findTrivialWidgets(source);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, '_Gap');
});

test('findTrivialWidgets leaves a reused widget class alone', () => {
  const source = [
    'class _Gap extends StatelessWidget {',
    '  @override',
    '  Widget build(BuildContext context) {',
    '    return const SizedBox(height: 8);',
    '  }',
    '}',
    'final a = _Gap();',
    'final b = _Gap();',
    'final c = _Gap();',
  ].join('\n');

  assert.deepEqual(findTrivialWidgets(source), []);
});

// --- duplication -------------------------------------------------------------

const asFile = (path, source) => ({ path, lines: normaliseLines(blankNonCode(source)) });

const priceRow = (label) =>
  [
    'Padding(',
    '  padding: const EdgeInsets.all(17),',
    '  child: Row(',
    '    children: [',
    `      const Text('${label}'),`,
    '      const Spacer(),',
    '      Text(value.toStringAsFixed(2)),',
    '    ],',
    '  ),',
    '),',
  ].join('\n');

test('findDuplication finds a block repeated across two files', () => {
  const blocks = findDuplication([
    asFile('a.dart', priceRow('Subtotal')),
    asFile('b.dart', priceRow('Total')),
  ]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].occurrences.length, 2);
  assert.deepEqual(
    blocks[0].occurrences.map((o) => o.path).sort(),
    ['a.dart', 'b.dart'],
  );
});

test('findDuplication ignores differing string literals, by design', () => {
  // The labels differ; the shape does not. A copy-pasted subtree with new text
  // is still a copy-pasted subtree.
  const blocks = findDuplication([asFile('a.dart', `${priceRow('One')}\n${priceRow('Two')}`)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].occurrences.length, 2);
});

test('findDuplication reports one block, not one per starting offset', () => {
  const body = `${priceRow('One')}\n${priceRow('Two')}\n${priceRow('Three')}`;
  const blocks = findDuplication([asFile('a.dart', body)]);
  assert.equal(blocks.length, 1, 'overlapping windows were not merged');
  assert.equal(blocks[0].occurrences.length, 3);
});

test('findDuplication ignores repeated punctuation', () => {
  const closers = ['        ),', '      ],', '    ),', '  ),', '),', ');'].join('\n');
  const blocks = findDuplication([asFile('a.dart', `${closers}\n${closers}`)]);
  assert.deepEqual(blocks, []);
});

test('findDuplication says nothing about a file with no repetition', () => {
  const source = ['final a = 1;', 'final b = 2;', 'final c = 3;'].join('\n');
  assert.deepEqual(findDuplication([asFile('a.dart', source)]), []);
});

// --- scanFile ----------------------------------------------------------------

test('scanFile skips a generated file unless asked not to', () => {
  const source = '// GENERATED CODE - DO NOT MODIFY BY HAND\nclass X {}\n';
  assert.equal(scanFile('lib/x.g.dart', source).skipped, true);
  assert.equal(scanFile('lib/x.g.dart', source, { includeGenerated: true }).skipped, false);
});

test('scanFile reports a bare catch and a late field', () => {
  const source = [
    'class A {',
    '  late String name;',
    '  void run() {',
    '    try {',
    '      go();',
    '    } catch (e) {',
    '    }',
    '  }',
    '}',
  ].join('\n');

  const result = scanFile('lib/a.dart', source);
  assert.equal(result.lateFields.length, 1);
  assert.equal(result.bareCatch.length, 1);
  assert.ok(signalCount(result) >= 2);
});

test('scanFile leaves late final alone', () => {
  const result = scanFile('lib/a.dart', 'class A {\n  late final String name;\n}\n');
  assert.deepEqual(result.lateFields, []);
});

test('signalCount is zero for a clean file', () => {
  const source = [
    'class Greeter {',
    '  const Greeter(this.name);',
    '',
    '  final String name;',
    '',
    '  String greet() {',
    '    return name;',
    '  }',
    '}',
  ].join('\n');

  assert.equal(signalCount(scanFile('lib/greeter.dart', source)), 0);
});

// --- reached through a symlinked install -------------------------------------
// An installed skill is normally reached through a symlink or a Windows junction.
// `import.meta.url` is the real path; `process.argv[1]` keeps the link. Comparing
// them raw makes the CLI import and then run nothing: exit 0, no output, and a
// report that quietly loses every measurement it was supposed to cite.

test('the CLI still runs when the script is reached through a link', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = mkdtempSync(join(tmpdir(), 'scan-dart-link-'));
  const link = join(dir, 'installed-skill');

  try {
    symlinkSync(root, link, 'junction');
  } catch {
    return; // this machine will not create links; nothing to assert
  }

  try {
    const run = spawnSync(
      process.execPath,
      [join(link, 'scripts', 'scan-dart.mjs'), join(root, 'evals', 'fixtures')],
      { encoding: 'utf8' },
    );

    assert.equal(run.status, 0);
    assert.match(run.stdout, /Scanned \d+ Dart file/);
  } finally {
    // Never a recursive delete: the directory holds a link to the repository itself.
    try {
      unlinkSync(link);
    } catch {
      try {
        rmdirSync(link);
      } catch {
        /* leave it to the OS temp sweeper */
      }
    }
    try {
      rmdirSync(dir);
    } catch {
      /* as above */
    }
  }
});
