// Unit tests for the grading dossier: what it reads out of a transcript, a diff and a
// mis-decoded capture, and where it decides a report begins. Each case is a shape a real run
// produced — the dossier is the evidence a verdict is written from, so reading it wrongly is how
// a wrong verdict gets written.
//
// Node built-ins only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fromTitle, readDiff, readTranscript, repairCp437 } from '../scripts/make-dossier.mjs';

const line = (entry) => JSON.stringify(entry);
const said = (text) => line({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const did = (name, input = {}) => line({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

test('the answer is what was said after the last tool call, not before it', () => {
  const jsonl = [
    said('Let me look at the file.'),
    did('Read', { file_path: 'lib/a.dart' }),
    said('Now the scanner.'),
    did('Bash', { command: 'node scan-dart.mjs lib' }),
    said('# Clean Code — AUDIT — orders\nThe report.'),
  ].join('\n');

  const read = readTranscript(jsonl);
  assert.equal(read.answer, '# Clean Code — AUDIT — orders\nThe report.');
  assert.deepEqual(read.tools, ['Read', 'Bash']);
  assert.deepEqual(read.commands, ['node scan-dart.mjs lib']);
});

test('narration beside a tool call is not the closing answer', () => {
  // Collected per message rather than per content block, a sentence written in the same message
  // as a tool call counted as the answer and was glued to the front of the report.
  const jsonl = [
    line({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Reading it now.' },
          { type: 'tool_use', name: 'Read', input: { file_path: 'lib/a.dart' } },
        ],
      },
    }),
    said('The report.'),
  ].join('\n');

  assert.equal(readTranscript(jsonl).answer, 'The report.');
});

test('a malformed line in a transcript is skipped, not fatal', () => {
  const jsonl = ['not json at all', said('The report.'), ''].join('\n');
  assert.equal(readTranscript(jsonl).answer, 'The report.');
});

test('a report written into the project is read back out of the diff', () => {
  const diff = [
    'diff --git a/docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md b/docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md',
    '--- /dev/null',
    '+++ b/docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md',
    '@@ -0,0 +1,2 @@',
    '+# Clean Code — AUDIT — orders',
    '+**Scope:** lib/features/orders',
    'diff --git a/pubspec.lock b/pubspec.lock',
    '--- /dev/null',
    '+++ b/pubspec.lock',
    '+# generated',
  ].join('\n');

  const changes = readDiff(diff);
  assert.equal(changes.writtenTo, 'docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md');
  assert.equal(changes.report, '# Clean Code — AUDIT — orders\n**Scope:** lib/features/orders');
  assert.deepEqual(changes.touched, ['docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-23.md', 'pubspec.lock']);
});

test('a diff that changed no report leaves the report null and still lists the files', () => {
  const diff = ['diff --git a/lib/a.dart b/lib/a.dart', '--- a/lib/a.dart', '+++ b/lib/a.dart', '+final a = 1;'].join('\n');
  const changes = readDiff(diff);
  assert.equal(changes.report, null);
  assert.deepEqual(changes.touched, ['lib/a.dart']);
});

test('a capture mis-decoded through the OEM code page maps back exactly', () => {
  // The runner captured a child's stdout through a console using cp437, so an em dash arrived as
  // three characters and was stored that way. Seven records across the phases carry it.
  assert.equal(repairCp437('# Clean Code ΓÇö AUDIT ΓÇö orders'), '# Clean Code — AUDIT — orders');
  assert.equal(repairCp437('Impact High ┬╖ Effort XS'), 'Impact High · Effort XS');
});

test('text that was never mis-decoded is left exactly as it is', () => {
  const arabic = '## الملاحظات — تسعة عناصر';
  assert.equal(repairCp437(arabic), arabic);
  assert.equal(repairCp437('# Clean Code — AUDIT — orders'), '# Clean Code — AUDIT — orders');
});

test('the report begins at its title, whatever was said before it', () => {
  const withPreamble = "Everything I need is in hand. Here's the report.\n\n# Clean Code — REFACTOR — orders\n\n**Scope:** lib";
  assert.equal(fromTitle(withPreamble), '# Clean Code — REFACTOR — orders\n\n**Scope:** lib');
});

test('an answer with no title is kept whole, because cutting it would hide the failure', () => {
  const noTitle = 'I could not review this file.';
  assert.equal(fromTitle(noTitle), noTitle);
});
