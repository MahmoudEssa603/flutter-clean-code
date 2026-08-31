// Tests for the report contract checker.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkReport } from '../scripts/check-report.mjs';

const HEADER = [
  '# Clean Code — AUDIT — orders',
  '',
  '**Scope:** `lib/features/orders/` · **Evidence:** Partial',
  '**Conventions:** not verified',
  '**Verification:** no SDK on PATH',
  '**Not checked:** nothing',
  '',
  '## Summary',
  '',
  '| Principle | Findings | High | Medium | Low |',
  '|---|---|---|---|---|',
  ...['Naming', 'Functions', 'Classes & SOLID', 'Flutter', 'Comments', 'Errors & data', 'Tests'].map(
    (p) => `| ${p} | 0 | 0 | 0 | 0 |`,
  ),
  '',
  '## Findings',
  '',
].join('\n');

const TAIL = ['', '## Out of Scope', '', '| Observation | Why |', '|---|---|', '', '## Verification', ''].join('\n');

const finding = (n, { impact = 'High', effort = 'XS', confidence = 'High', location = '`a/b.dart:12`' } = {}) =>
  [
    `### CC-${String(n).padStart(3, '0')} — a title`,
    '',
    '**Principle:** Naming',
    `**Impact:** ${impact} · **Effort:** ${effort} · **Confidence:** ${confidence}`,
    `**Location:** ${location}`,
    '',
  ].join('\n');

const report = (findings, extra = '') => HEADER + findings.join('\n') + extra + TAIL;

test('a report that holds the contract passes', () => {
  const { failures } = checkReport(report([finding(1), finding(2)]));
  assert.deepEqual(failures, []);
});

test('a finding missing one of the three judgements fails', () => {
  const stripped = finding(1).replace('· **Effort:** XS ', '');
  const { failures } = checkReport(report([stripped]));
  assert.equal(failures.length, 1);
  assert.match(failures[0], /CC-001 has no Effort/);
});

test('Confidence is High or Low, and Medium is neither', () => {
  // The scale has two values on purpose: a Low-confidence finding is reported as a question.
  const { failures } = checkReport(report([finding(1, { confidence: 'Medium' })]));
  assert.match(failures.join('\n'), /CC-001 Confidence is "Medium"/);
});

test('more findings than the cap fails', () => {
  const many = Array.from({ length: 21 }, (_, i) => finding(i + 1));
  assert.match(checkReport(report(many)).failures.join('\n'), /21 findings listed, over the cap of 20/);
});

test('a location may name a path with no line, because some defects have none', () => {
  // A misspelled filename is the file; a missing test directory is an absence. Both are located.
  for (const location of ['`lib/a/pin_code_filed.dart`', '`test/` — no `orders` directory']) {
    assert.deepEqual(checkReport(report([finding(1, { location })])).failures, [], location);
  }
});

test('a location naming neither a path nor a line fails', () => {
  const { failures } = checkReport(report([finding(1, { location: 'somewhere in the widget' })]));
  assert.match(failures.join('\n'), /names neither a path nor a line/);
});

test('a re-run keeps the ids it inherited, so it may start past CC-001', () => {
  const rerun = HEADER.replace('## Summary', '## Since last pass\n\nnothing fixed\n\n## Summary');
  const { failures } = checkReport(rerun + [finding(21), finding(22)].join('\n') + TAIL);
  assert.deepEqual(failures, []);
});

test('a first pass that does not start at CC-001 fails', () => {
  assert.match(checkReport(report([finding(21)])).failures.join('\n'), /start at CC-021, not CC-001/);
});

test('a dropped principle row is caught, because it reads as an area nobody looked at', () => {
  const short = report([finding(1)]).replace('| Tests | 0 | 0 | 0 | 0 |\n', '');
  assert.match(checkReport(short).failures.join('\n'), /6 principle rows, not 7/);
});

test('an Arabic header is read, because the template lets those labels translate', () => {
  const arabic = report([finding(1)])
    .replace('**Scope:**', '**النطاق:**')
    .replace('**Evidence:**', '**الدليل:**')
    .replace('**Conventions:**', '**الاصطلاحات:**')
    .replace('**Verification:**', '**التحقق:**')
    .replace('**Not checked:**', '**لم يُفحَص:**');
  assert.deepEqual(checkReport(arabic).failures, []);
});
