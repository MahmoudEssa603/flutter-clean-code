// Tests for the deterministic baseline.
//
// The baseline exists to answer one question: did the tooling start reporting something
// different? Anything it records that depends on where the repository happens to sit answers a
// different question badly, so that is what these tests pin.
//
// Run: node --test test/
// Node built-ins only — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Copies the repository to `dirName` under a temp root and runs `args` there. */
function inCheckoutNamed(dirName, args) {
  const root = mkdtempSync(join(tmpdir(), 'fcc-baseline-'));
  const dir = join(root, dirName);
  try {
    cpSync(REPO, dir, {
      recursive: true,
      filter: (src) => !src.includes(`${REPO}\\.git`) && !src.includes(`${REPO}/.git`),
    });
    const run = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
    return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a checkout whose folder is not named after the skill still matches the baseline', () => {
  // Every fork, every rename, and every clone into a folder someone chose for themselves trips
  // the validator's directory-name NOTE. Recording that NOTE made the baseline announce "the
  // tooling reports something different" above two identical signal counts — a failure about
  // nothing, in the one check whose whole job is to be believed.
  const named = inCheckoutNamed('some-fork-of-the-skill', ['scripts/make-baseline.mjs', '--check']);
  assert.equal(named.status, 0, named.output);
  assert.match(named.output, /unchanged/);
});

test('the directory-name NOTE really does fire there, so the test above means something', () => {
  const validated = inCheckoutNamed('some-fork-of-the-skill', ['scripts/validate-skill.mjs', '--quiet']);
  assert.equal(validated.status, 0, validated.output);
  assert.match(validated.output, /NOTE.*differs from the directory name "some-fork-of-the-skill"/);
});
