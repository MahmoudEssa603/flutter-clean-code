// Integration tests for the contract validator.
// Each test copies the repository to a temp directory, breaks one thing, and
// asserts the validator catches it. A validator that only ever prints "passed"
// is worse than no validator, so every gate is proven to fail on demand.
//
// Run: node --test
// Node built-ins only — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Copies the repository, applies `mutate(dir)`, runs the validator there, and
 * returns { status, output }. The copy is always removed, pass or fail.
 */
function runValidatorOn(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'fcc-validate-'));
  try {
    cpSync(REPO, dir, {
      recursive: true,
      filter: (src) => !src.includes(`${REPO}\\.git`) && !src.includes(`${REPO}/.git`),
    });
    mutate?.(dir);

    const result = spawnSync(process.execPath, ['scripts/validate-skill.mjs', '--quiet'], {
      cwd: dir,
      encoding: 'utf8',
    });

    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const patch = (dir, file, replace, replacement) => {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  assert.ok(text.includes(replace), `test setup: "${replace}" not found in ${file}`);
  writeFileSync(path, text.replace(replace, replacement), 'utf8');
};

// --- the baseline ------------------------------------------------------------

test('the repository as committed passes', () => {
  const { status, output } = runValidatorOn();
  assert.equal(status, 0, output);
});

// --- frontmatter -------------------------------------------------------------

test('a seventh frontmatter field fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'license: MIT', 'license: MIT\npaths: "**/*.dart"'),
  );
  assert.equal(status, 1);
  assert.match(output, /paths.*portable six/s);
});

test('a description with no negative clause fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'Do not use for non-Dart code', 'It is excellent for'),
  );
  assert.equal(status, 1);
  assert.match(output, /negative clause/);
});

test('a name that is not lowercase-hyphen fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'name: flutter-clean-code', 'name: Flutter_Clean_Code'),
  );
  assert.equal(status, 1);
  assert.match(output, /lowercase letters/);
});

test('a version that is not MAJOR.MINOR.PATCH fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', '  version: 1.0.0', '  version: v1'),
  );
  assert.equal(status, 1);
  assert.match(output, /MAJOR\.MINOR\.PATCH/);
});

// --- the link graph ----------------------------------------------------------

test('a link to a missing file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    unlinkSync(join(dir, 'references/dart-examples.md')),
  );
  assert.equal(status, 1);
  assert.match(output, /missing file/);
});

test('a reference file linking to another reference file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(
      join(dir, 'references/refactor-batches.md'),
      '\nSee [examples](references/dart-examples.md).\n',
    ),
  );
  assert.equal(status, 1);
  assert.match(output, /one level deep/);
});

test('a long reference file with no Contents section fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '## Contents', '## Overview'),
  );
  assert.equal(status, 1);
  assert.match(output, /Contents/);
});

// --- self-containment and vocabulary ----------------------------------------

test('naming an external skill fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(join(dir, 'README.md'), '\nPairs well with flutter-code-quality.\n'),
  );
  assert.equal(status, 1);
  assert.match(output, /self-containment/);
});

test('a banned synonym fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(join(dir, 'references/report-template.md'), '\nEach violation has a severity.\n'),
  );
  assert.equal(status, 1);
  assert.match(output, /vocabulary/);
});

// --- the checklist and the report agree --------------------------------------

test('a principle area with no row in the summary table fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '| Tests | | | | |\n', ''),
  );
  assert.equal(status, 1);
  assert.match(output, /principle row\(s\) but SKILL\.md defines/);
});

test('a summary table with a row too many fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '| Tests | | | | |', '| Tests | | | | |\n| Vibes | | | | |'),
  );
  assert.equal(status, 1);
  assert.match(output, /principle row\(s\) but SKILL\.md defines/);
});

test('a misnumbered principle area fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', '#### 5. Comments and dead weight', '#### 8. Comments and dead weight'),
  );
  assert.equal(status, 1);
  assert.match(output, /is numbered 8; expected 5/);
});

// --- scripts -----------------------------------------------------------------

test('a script importing a third-party package fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(
      dir,
      'scripts/scan-dart.mjs',
      "import { pathToFileURL } from 'node:url';",
      "import { pathToFileURL } from 'node:url';\nimport chalk from 'chalk';",
    ),
  );
  assert.equal(status, 1);
  assert.match(output, /Node built-ins only/);
});

test('a missing required script fails', () => {
  const { status, output } = runValidatorOn((dir) => unlinkSync(join(dir, 'scripts/scan-dart.mjs')));
  assert.equal(status, 1);
  assert.match(output, /scan-dart\.mjs is missing/);
});

// --- evaluations -------------------------------------------------------------

test('fewer than three evaluation scenarios fails', () => {
  const { status, output } = runValidatorOn((dir) => {
    // Leave exactly two, whatever the current scenario count happens to be.
    const scenarios = readdirSync(join(dir, 'evals')).filter((f) => f.endsWith('.json'));
    for (const file of scenarios.slice(2)) unlinkSync(join(dir, 'evals', file));
  });
  assert.equal(status, 1);
  assert.match(output, /at least 3 are required/);
});

test('a malformed evaluation file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    writeFileSync(join(dir, 'evals/04-negative-trigger.json'), '{ not json', 'utf8'),
  );
  assert.equal(status, 1);
  assert.match(output, /not valid JSON/);
});
