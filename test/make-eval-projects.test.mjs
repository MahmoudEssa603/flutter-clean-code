// Tests for the scenario-project generator.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENARIOS, main } from '../scripts/make-eval-projects.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function withTempDir(body) {
  const dir = mkdtempSync(join(tmpdir(), 'eval-projects-'));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('every scenario in evals/ has a project layout', () => {
  const declared = new Set(SCENARIOS.map((s) => s.id));
  const scenarios = spawnSync(
    process.execPath,
    ['-e', "const {readdirSync}=require('node:fs');console.log(readdirSync('evals').filter(f=>f.endsWith('.json')).map(f=>f.replace(/\\.json$/,'')).join('\\n'))"],
    { cwd: ROOT, encoding: 'utf8' },
  ).stdout.trim().split('\n');

  for (const id of scenarios) {
    assert.ok(declared.has(id), `evals/${id}.json has no layout in make-eval-projects.mjs`);
  }
});

test('a scenario is written with its fixtures and its scaffolding', () => {
  withTempDir((dir) => {
    const target = join(dir, 'out');
    assert.equal(main([target, '--only', '08-excluded-generated-source', '--quiet']), 0);

    const scenario = join(target, '08-excluded-generated-source');
    assert.ok(existsSync(join(scenario, 'lib/features/orders/order.dart')));
    assert.ok(existsSync(join(scenario, 'lib/features/orders/order.freezed.dart')));

    // The scenario is about a rule that is enabled and still cannot fire, so both halves of
    // that have to be in the options file or it tests nothing.
    const options = readFileSync(join(scenario, 'analysis_options.yaml'), 'utf8');
    assert.match(options, /camel_case_types: true/);
    assert.match(options, /\*\*\/\*\.freezed\.dart/);
  });
});

test('it refuses a directory holding anything it does not manage', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'something-of-yours.txt'), 'do not delete me');
    assert.equal(main([dir, '--quiet']), 1);
    assert.ok(existsSync(join(dir, 'something-of-yours.txt')));
  });
});

test('the diff scenario leaves exactly one changed file against its base', () => {
  withTempDir((dir) => {
    const target = join(dir, 'out');
    if (main([target, '--only', '06-diff-mode', '--quiet']) !== 0) return; // no git here
    const scenario = join(target, '06-diff-mode');

    const changed = spawnSync(
      'git',
      ['diff', '--name-only', 'main...HEAD', '--', '*.dart'],
      { cwd: scenario, encoding: 'utf8' },
    );
    assert.equal(changed.status, 0);
    assert.deepEqual(changed.stdout.trim().split('\n'), [
      'lib/features/orders/order_filters.dart',
    ]);
  });
});
