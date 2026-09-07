// Tests for the eval registry validator and the summary generator.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  checkRegistry,
  findStale,
  queriesWithoutTrigger,
  read,
  surfaceChangedSince,
} from '../scripts/check-evals.mjs';
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
  assert.match(rendered, /\| `02-b` \| 2026-08-30 \| `1\.3\.2` \| \*\*PARTIAL\*\*/);
});

test('a scenario the generator finds no record for is shown as missing, not omitted', () => {
  const rendered = renderSummary({ scenarios: ['01-a', '99-z'], results: [record()] });
  assert.match(rendered, /`99-z`.*NOT_RECORDED/);
});

// --- staleness ---------------------------------------------------------------
// A verdict is a claim about one skill surface. These tests exist because the registry could
// carry twelve PASSes graded against a version nobody can install and read exactly like twelve
// fresh ones.

test('a verdict graded against another version is reported stale', () => {
  const stale = findStale({
    results: [record({ skillVersion: '1.3.1' }), record({ scenario: '02-b' })],
    currentVersion: '1.3.2',
  });
  assert.deepEqual(stale, [{ scenario: '01-a', verdict: 'PASS', gradedAgainst: '1.3.1' }]);
});

test('NOT_RUN never goes stale, because it claims nothing', () => {
  const stale = findStale({
    results: [record({ verdict: 'NOT_RUN', skillVersion: '1.0.0', note: 'not run' })],
    currentVersion: '9.9.9',
  });
  assert.deepEqual(stale, []);
});

test('an unknown tag reports "cannot tell", not "nothing changed"', () => {
  // Null and [] mean opposite things here, and collapsing them would turn a shallow clone into
  // a clean bill of health.
  assert.equal(surfaceChangedSince('9.9.9'), null);
});

test('a release that only moved the version line is not a reason to re-run anything', () => {
  // Built as a throwaway repo rather than asserted against this one, so it proves the rule
  // instead of restating today's history. Comparing raw bytes would call every scenario stale on
  // every release, and a warning that always fires is not a warning.
  const dir = mkdtempSync(join(tmpdir(), 'fcc-surface-'));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  };
  try {
    const skillMd = (version) => ['metadata:', `  version: ${version}`, '---', 'body', ''].join('\n');

    mkdirSync(join(dir, 'references'));
    writeFileSync(join(dir, 'SKILL.md'), skillMd('1.0.0'));
    writeFileSync(join(dir, 'references/a.md'), 'one\n');
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('add', '-A');
    git('commit', '-qm', 'v1');
    git('tag', 'v1.0.0');

    writeFileSync(join(dir, 'SKILL.md'), skillMd('1.0.1'));
    assert.deepEqual(surfaceChangedSince('1.0.0', { cwd: dir }), []);

    writeFileSync(join(dir, 'references/a.md'), 'one, changed\n');
    assert.deepEqual(surfaceChangedSince('1.0.0', { cwd: dir }), ['references/a.md']);

    writeFileSync(join(dir, 'references/b.md'), 'new file\n');
    assert.deepEqual(surfaceChangedSince('1.0.0', { cwd: dir }), [
      'references/a.md',
      'references/b.md',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the summary warns when the table describes a version nobody can install', () => {
  const rendered = renderSummary({
    scenarios: ['01-a'],
    results: [record({ skillVersion: '1.3.1' })],
    currentVersion: '1.4.0',
  });
  assert.match(rendered, /1 of these verdicts were graded against 1\.3\.1, not 1\.4\.0/);
});

test('no warning when every verdict matches the tree', () => {
  const rendered = renderSummary({
    scenarios: ['01-a'],
    results: [record()],
    currentVersion: '1.3.2',
  });
  assert.doesNotMatch(rendered, /graded against/);
});

// --- activation reach ---------------------------------------------------------
// The description is the whole of activation. A scenario whose query shares nothing with it
// measures whether the skill loaded, not what it decided — which is how 07 came back as a
// competent code review carrying none of the report contract.

test('a query sharing no word with the Use-when clause is reported', () => {
  const bare = queriesWithoutTrigger({
    description: 'Does things. Use when the user asks to audit or refactor Dart code. Do not use for Python.',
    scenarios: [
      { id: '01-covered', skills: ['s'], query: 'audit this module' },
      { id: '02-bare', skills: ['s'], query: 'make this file nicer somehow' },
    ],
  });
  assert.deepEqual(bare, ['02-bare']);
});

test('the negative-trigger scenario is exempt, because it expects no activation', () => {
  const bare = queriesWithoutTrigger({
    description: 'Use when the user asks to audit Dart code. Do not use for Python.',
    scenarios: [{ id: '04-negative', skills: [], query: 'this Python service has a god class' }],
  });
  assert.deepEqual(bare, []);
});

test('words outside the Use-when clause do not count as triggers', () => {
  // "refactors" sits in the opening capability sentence; that is not where a host looks for
  // whether to fire. Reading the whole description would have hidden exactly the gap that let
  // "refactor this file" go unmatched.
  const bare = queriesWithoutTrigger({
    description: 'Audits and refactors Dart code. Use when the user asks to tidy code. Do not use for Python.',
    scenarios: [{ id: '02-refactor', skills: ['s'], query: 'refactor this file, it is unreadable' }],
  });
  assert.deepEqual(bare, ['02-refactor']);
});
