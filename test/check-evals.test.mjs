// Tests for the eval registry validator and the summary generator.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRegistry, read } from '../scripts/check-evals.mjs';
import { renderSummary } from '../scripts/generate-eval-summary.mjs';

const record = (over = {}) => ({
  scenario: '01-a',
  verdict: 'PASS',
  date: '2026-08-30',
  skillVersion: '1.3.2',
  generatedBy: 'fresh session',
  gradedBy: 'maintainer session',
  expectations: { recorded: false },
  mustNot: { fail: 0 },
  ...over,
});

const registry = (results, scenarios = results.map((r) => r.scenario)) =>
  checkRegistry({ scenarios, results });

test('the committed registry holds together', () => {
  assert.deepEqual(checkRegistry(read()), []);
});

test('PASS over a recorded partial expectation is refused', () => {
  // This is the contradiction the prose table carried for two releases.
  const failures = registry([
    record({ expectations: { recorded: true, total: 6, partial: 2, fail: 0 } }),
  ]);
  assert.match(failures.join('\n'), /is PASS with 2 expectation\(s\) recorded partial/);
});

test('PASS over a recorded failure is refused, and so is PARTIAL', () => {
  const asPass = registry([record({ mustNot: { fail: 1 } })]);
  assert.match(asPass.join('\n'), /is PASS with 1 recorded failure/);

  const asPartial = registry([record({ verdict: 'PARTIAL', note: 'x', mustNot: { fail: 1 } })]);
  assert.match(asPartial.join('\n'), /is PARTIAL with 1 recorded failure/);
});

test('a verdict short of PASS has to say what fell short', () => {
  assert.match(registry([record({ verdict: 'PARTIAL' })]).join('\n'), /with no note saying what fell short/);
  assert.match(registry([record({ verdict: 'FAIL' })]).join('\n'), /with no note saying what fell short/);
});

test('a scenario with no record is caught, because a blank row reads like a pass', () => {
  const failures = checkRegistry({ scenarios: ['01-a', '02-b'], results: [record()] });
  assert.match(failures.join('\n'), /02-b has no result record — record it as NOT_RUN/);
});

test('NOT_RUN is an acceptable record and needs no note', () => {
  assert.deepEqual(registry([record({ verdict: 'NOT_RUN' })]), []);
});

test('grading a run in the session that produced it is refused when both ids are known', () => {
  const failures = registry([
    record({ generationSession: 'abc', gradingSession: 'abc' }),
  ]);
  assert.match(failures.join('\n'), /was graded in the session that produced it/);
});

test('an unknown verdict and a malformed date are caught', () => {
  const failures = registry([record({ verdict: 'passed', date: '30-08-2026' })]);
  assert.match(failures.join('\n'), /verdict is "passed"/);
  assert.match(failures.join('\n'), /date is "30-08-2026", not YYYY-MM-DD/);
});

test('the summary counts what the records say, not what the prose used to', () => {
  const rendered = renderSummary({
    scenarios: ['01-a', '02-b'],
    results: [record(), record({ scenario: '02-b', verdict: 'PARTIAL', note: 'two of six' })],
  });
  assert.match(rendered, /\*\*1 PASS\*\* · \*\*1 PARTIAL\*\*/);
  assert.match(rendered, /\| `02-b` \| 2026-08-30 \| \*\*PARTIAL\*\*/);
});

test('a scenario the generator finds no record for is shown as missing, not omitted', () => {
  const rendered = renderSummary({ scenarios: ['01-a', '99-z'], results: [record()] });
  assert.match(rendered, /`99-z`.*NOT_RECORDED/);
});
