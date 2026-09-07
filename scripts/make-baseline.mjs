#!/usr/bin/env node
// Records what the deterministic tooling says right now, so a later change can be compared
// against it instead of argued about. This is not a test: nothing here asserts that the current
// numbers are correct. A baseline answers one question — what moved, and was that intended.
//
// Run it before changing scanner behaviour, and again after. Differences are the review.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/make-baseline.mjs [--check] [--quiet]
//   (no flag)  write evals/baselines/<version>/ from the current tree
//   --check    compare the current tree against the stored baseline, exit 1 on any difference
// Exit code 0 = written, or compared clean.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function skillVersion() {
  const m = /^ {2}version:\s*(\S+)$/m.exec(readFileSync(join(ROOT, 'SKILL.md'), 'utf8'));
  if (!m) throw new Error('SKILL.md declares no metadata.version');
  return m[1];
}

function commitSha() {
  const run = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return run.status === 0 ? run.stdout.trim() : null;
}

function node(args) {
  const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

// The scanner's own JSON, minus anything that moves for reasons unrelated to the code: the
// absolute path it was pointed at, and per-file `lines` arrays that carry the source itself.
function scannerBaseline() {
  const run = node(['scripts/scan-dart.mjs', 'evals/fixtures', '--json', '--top', '1000']);
  if (run.status !== 0) throw new Error(`scan-dart.mjs failed: ${run.stderr}`);
  const raw = JSON.parse(run.stdout);

  return {
    filesScanned: raw.filesScanned,
    totalSignals: raw.totalSignals,
    signalsPerFile: raw.signalsPerFile,
    generatedSkipped: raw.generatedSkipped,
    duplication: (raw.duplication ?? []).map((d) => ({
      lines: d.lines,
      occurrences: d.occurrences,
    })),
    files: (raw.files ?? []).map((f) => ({
      path: f.path,
      lines: f.lines,
      signals: f.signals,
      build: f.build,
      longFunctions: f.longFunctions,
      deepNesting: f.deepNesting,
      positionalHeavy: f.positionalHeavy,
      booleanFlags: f.booleanFlags,
      missingDispose: f.missingDispose,
      trivialWidgets: f.trivialWidgets,
      magicLiterals: f.magicLiterals,
      lateFields: f.lateFields,
      bareCatch: f.bareCatch,
      collectionEquality: f.collectionEquality,
      ownerlessTodo: f.ownerlessTodo,
      commentedOutCode: f.commentedOutCode,
    })),
  };
}

// NOTE lines are dropped. The only one the validator emits says the checkout directory is not
// named after the skill, which is true of every fork, every rename, and every clone a person
// made into a folder of their choosing. Keeping it made the baseline report "the tooling reports
// something different" above two identical signal counts, for a difference that is not in the
// tooling at all. Failures and the exit code are what this records.
function validatorBaseline() {
  const run = node(['scripts/validate-skill.mjs', '--quiet']);
  const output = run.stdout
    .split('\n')
    .filter((line) => !line.startsWith('NOTE'))
    .join('\n')
    .trim();
  return { exitCode: run.status, output };
}

function build() {
  return {
    skillVersion: skillVersion(),
    commitSha: commitSha(),
    date: new Date().toISOString().slice(0, 10),
    scanner: scannerBaseline(),
    validator: validatorBaseline(),
  };
}

// The commit and the date move on every run and say nothing about behaviour, so a comparison
// ignores them. What is compared is what the tooling reported.
const comparable = (b) => JSON.stringify({ scanner: b.scanner, validator: b.validator }, null, 2);

function baselinePath(version) {
  return join(ROOT, 'evals', 'baselines', version, 'deterministic.json');
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const check = argv.includes('--check');
  const current = build();
  const path = baselinePath(current.skillVersion);

  if (check) {
    if (!existsSync(path)) {
      console.error(`no baseline for ${current.skillVersion}. Run without --check to record one.`);
      return 1;
    }
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    if (comparable(stored) === comparable(current)) {
      if (!quiet) console.log(`baseline ${current.skillVersion}: unchanged`);
      return 0;
    }
    console.error(`baseline ${current.skillVersion}: the tooling reports something different.`);
    console.error(`  stored:  ${stored.scanner.totalSignals} signals over ${stored.scanner.filesScanned} files`);
    console.error(`  now:     ${current.scanner.totalSignals} signals over ${current.scanner.filesScanned} files`);
    console.error('');
    console.error('A difference is not a failure. Read it, decide whether it was intended, and');
    console.error('re-record the baseline as part of the same change if it was.');
    return 1;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);

  if (!quiet) {
    console.log(`recorded evals/baselines/${current.skillVersion}/deterministic.json`);
    console.log(`  skill      ${current.skillVersion}`);
    console.log(`  commit     ${current.commitSha ?? '(not a git checkout)'}`);
    console.log(`  scanner    ${current.scanner.totalSignals} signals over ${current.scanner.filesScanned} files`);
    console.log(`  validator  exit ${current.validator.exitCode}`);
  }
  return 0;
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exit(main(process.argv.slice(2)));

export { build, comparable, main };
