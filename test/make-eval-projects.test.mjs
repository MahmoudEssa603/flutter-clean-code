// Tests for the scenario-project generator.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENARIOS, main, projectDrift } from '../scripts/make-eval-projects.mjs';

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

// --- drift ---------------------------------------------------------------------
// Scenario 13 was answered once by restructuring the fixture into four layers. The next run
// read those layers and reported, correctly and uselessly, that the work was already done —
// and nothing about that reply looked wrong. A run over a project a previous run rewrote is
// not a run of the scenario, and only the generator can tell.

test('a project a run has edited is reported as drifted', () => {
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '13-architecture-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 0, 'fresh must be clean');

    const scenario = join(target, only);
    writeFileSync(join(scenario, 'lib/features/orders/order_summary_page.dart'), 'class Rewritten {}\n');
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 1);

    const drift = projectDrift(scenario);
    assert.deepEqual(drift.changed, ['lib/features/orders/order_summary_page.dart']);
    assert.deepEqual(drift.added, []);
  });
});

test('a file a run adds counts as drift too', () => {
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '13-architecture-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);

    const scenario = join(target, only);
    mkdirSync(join(scenario, 'lib/domain'), { recursive: true });
    writeFileSync(join(scenario, 'lib/domain/order.dart'), 'class Order {}\n');

    assert.deepEqual(projectDrift(scenario).added, ['lib/domain/order.dart']);
  });
});

test('build output a pass leaves behind is not drift', () => {
  // .dart_tool, build/ and a lockfile are the SDK doing its job. If those counted, the check
  // would fire after every clean run and be ignored within a day.
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '13-architecture-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);

    const scenario = join(target, only);
    mkdirSync(join(scenario, '.dart_tool'), { recursive: true });
    mkdirSync(join(scenario, 'build'), { recursive: true });
    writeFileSync(join(scenario, '.dart_tool/version'), '3.5.0\n');
    writeFileSync(join(scenario, 'build/x'), 'artefact\n');
    writeFileSync(join(scenario, 'pubspec.lock'), 'locked\n');

    const drift = projectDrift(scenario);
    assert.deepEqual(drift.changed, []);
    assert.deepEqual(drift.added, []);
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 0);
  });
});

test('a report the last run wrote is drift, because the next run reads it', () => {
  // This one was exempt as "the scenario succeeding", which it is — and it is also the input to
  // the next run, because SKILL.md sends every pass to docs/reviews for the newest previous
  // report before it writes one. Left in place it makes an ordinary scenario behave as a re-run.
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '13-architecture-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);

    const scenario = join(target, only);
    mkdirSync(join(scenario, 'docs/reviews'), { recursive: true });
    writeFileSync(join(scenario, 'docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-07.md'), '# report\n');

    assert.deepEqual(projectDrift(scenario).added, ['docs/reviews/CLEAN-CODE-AUDIT-orders-2026-09-07.md']);
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 1);
  });
});

test('the report a scenario seeds on purpose is tracked, not reported as drift', () => {
  // 12 ships an earlier pass in docs/reviews as its input. It has to survive --verify, or the
  // fix above would call every correctly built copy of that scenario dirty.
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '12-rerun-rejudges';
    assert.equal(main([target, '--only', only, '--quiet']), 0);

    const drift = projectDrift(join(target, only));
    assert.deepEqual(drift.changed, []);
    assert.deepEqual(drift.added, []);
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 0);
  });
});

test('a project built before manifests is reported, not assumed clean', () => {
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '13-architecture-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);
    rmSync(join(target, '.eval-manifests', `${only}.json`));

    assert.equal(projectDrift(join(target, only)).known, false);
    assert.equal(main([target, '--only', only, '--verify', '--quiet']), 1);
  });
});

test('no file inside a scenario project says it is an evaluation', () => {
  // A manifest named for the scenario, sitting in the project under review, tells the session it
  // is being watched — and one run cited that file's own hash as proof it had changed nothing.
  // The guard has to live beside the projects, not inside one.
  withTempDir((dir) => {
    const target = join(dir, 'out');
    const only = '14-performance-and-clean-code';
    assert.equal(main([target, '--only', only, '--quiet']), 0);

    const inside = readdirSync(join(target, only), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
    for (const name of inside) {
      assert.doesNotMatch(name, /manifest|eval/i, `${name} would tell the run it is an evaluation`);
    }
    assert.ok(existsSync(join(target, '.eval-manifests', `${only}.json`)));
  });
});
