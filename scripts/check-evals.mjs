#!/usr/bin/env node
// Validates the eval result registry in evals/results/.
//
// It exists because the results used to live in prose, where a row could say "passed" three
// words before saying two of its six expectations were only partly met. A verdict that
// contradicts its own evidence is worse than no verdict: it reads as a green light.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/check-evals.mjs [--quiet]
// Exit code 0 = the registry holds together, 1 = it does not.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS_DIR = join(ROOT, 'evals');
const RESULTS_DIR = join(ROOT, 'evals', 'results');

export const VERDICTS = ['PASS', 'PARTIAL', 'FAIL', 'NOT_RUN'];
const REQUIRED = ['scenario', 'verdict', 'date', 'skillVersion', 'generatedBy', 'gradedBy'];

// What the model actually reads. A change anywhere in here can change what a scenario produces;
// a change anywhere else — a script, the README, this file — cannot.
export const MODEL_FACING = ['SKILL.md', 'references/'];

export function checkRegistry({ scenarios, results }) {
  const failures = [];
  const fail = (m) => failures.push(m);

  const byScenario = new Map();
  for (const record of results) {
    if (byScenario.has(record.scenario)) fail(`${record.scenario} has more than one result record`);
    byScenario.set(record.scenario, record);
  }

  // A scenario with no record at all is worse than one recorded NOT_RUN: the second is a
  // decision, the first is an oversight that reads identically to a pass.
  for (const id of scenarios) {
    if (!byScenario.has(id)) fail(`${id} has no result record — record it as NOT_RUN if it was not run`);
  }
  for (const id of byScenario.keys()) {
    if (!scenarios.includes(id)) fail(`a result records "${id}", which is not a scenario`);
  }

  for (const record of results) {
    const id = record.scenario ?? '(unnamed)';

    for (const field of REQUIRED) {
      if (!record[field]) fail(`${id} is missing "${field}"`);
    }
    if (record.verdict && !VERDICTS.includes(record.verdict)) {
      fail(`${id} verdict is "${record.verdict}", not one of ${VERDICTS.join(' / ')}`);
    }
    if (record.date && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      fail(`${id} date is "${record.date}", not YYYY-MM-DD`);
    }

    const e = record.expectations ?? {};
    const m = record.mustNot ?? {};
    const partial = e.recorded ? (e.partial ?? 0) : 0;
    const failed = (e.recorded ? (e.fail ?? 0) : 0) + (m.fail ?? 0);

    // The rule the prose could not enforce.
    if (record.verdict === 'PASS' && partial > 0) {
      fail(`${id} is PASS with ${partial} expectation(s) recorded partial — that is PARTIAL`);
    }
    if (record.verdict === 'PASS' && failed > 0) {
      fail(`${id} is PASS with ${failed} recorded failure(s) — that is FAIL`);
    }
    if (record.verdict === 'PARTIAL' && failed > 0) {
      fail(`${id} is PARTIAL with ${failed} recorded failure(s) — that is FAIL`);
    }

    // A verdict short of PASS has to say what fell short, whether or not the expectations were
    // enumerated. Otherwise the registry records a grade with no grounds.
    if ((record.verdict === 'PARTIAL' || record.verdict === 'FAIL') && !record.note) {
      fail(`${id} is ${record.verdict} with no note saying what fell short`);
    }

    // Generation and grading in the same session is the one thing the procedure forbids: the
    // expected answer is already in context. Only checkable when both ids were recorded.
    if (record.generationSession && record.gradingSession &&
        record.generationSession === record.gradingSession) {
      fail(`${id} was graded in the session that produced it`);
    }

    if (record.outputFile && !existsSync(join(RESULTS_DIR, record.outputFile))) {
      fail(`${id} points at a saved output that is not there: ${record.outputFile}`);
    }
  }

  return failures;
}

/**
 * Which recorded verdicts were graded against a version other than the one in the tree.
 *
 * A verdict is a claim about a specific skill surface. Once that surface moves the claim is not
 * wrong, it is unverified — and unverified reads exactly like verified in a table. NOT_RUN makes
 * no claim, so it cannot go stale; it is only ever out of date about which version was skipped.
 */
export function findStale({ results, currentVersion }) {
  return results
    .filter((r) => r.verdict !== 'NOT_RUN' && r.skillVersion && r.skillVersion !== currentVersion)
    .map((r) => ({ scenario: r.scenario, verdict: r.verdict, gradedAgainst: r.skillVersion }));
}

// Every release moves the version line, and no scenario has ever depended on it. Comparing raw
// bytes would therefore mark all twelve verdicts stale on any release at all, which is a warning
// that fires every time and so gets read as noise. Line endings are normalised for the same
// reason: git stores LF, a Windows checkout may hold CRLF, and neither changes what the model reads.
const normalise = (path, text) =>
  (path === 'SKILL.md' ? text.replace(/^ {2}version: \d+\.\d+\.\d+$/m, '  version: -') : text)
    .replace(/\r\n/g, '\n');

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/**
 * Whether any model-facing file differs in content between tag `v<version>` and the working tree.
 *
 * Returns the changed paths, or null when the question cannot be answered here — no git, no such
 * tag, a shallow clone. Null is reported as "cannot tell", never as "nothing changed": a check
 * that goes quiet when it fails is the thing this repository keeps removing.
 */
export function surfaceChangedSince(version, { cwd = ROOT } = {}) {
  const ref = `v${version}`;
  const listed = git(['ls-tree', '-r', '--name-only', ref, '--', ...MODEL_FACING], cwd);
  if (listed.error || listed.status !== 0) return null;

  const thenFiles = listed.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const nowFiles = ['SKILL.md', ...readdirSync(join(cwd, 'references'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `references/${f}`)];

  const changed = [];
  for (const path of [...new Set([...thenFiles, ...nowFiles])].sort()) {
    let before = null;
    if (thenFiles.includes(path)) {
      const shown = git(['show', `${ref}:${path}`], cwd);
      if (shown.error || shown.status !== 0) return null;
      before = normalise(path, shown.stdout);
    }
    const after = nowFiles.includes(path)
      ? normalise(path, readFileSync(join(cwd, path), 'utf8'))
      : null;
    if (before !== after) changed.push(path);
  }
  return changed;
}

const STOPWORDS = new Set([
  'when', 'user', 'asks', 'that', 'them', 'this', 'with', 'from', 'they', 'only', 'also',
  'their', 'than', 'then', 'into', 'over', 'such', 'against', 'whether', 'files', 'changed',
  'branch', 'pull', 'request', 'including', 'arabic', 'phrasings', 'readability', 'rule', 'names',
]);

/**
 * Scenario queries that share no word with the description's "Use when" clause.
 *
 * The description is the whole of activation: a host matches the request against it and nothing
 * else. So a scenario whose query has no word in common with it is testing a request the skill
 * may simply never see, and the run that follows measures the matcher, not the rules. This is
 * reported, never failed — 14 and 16 deliberately pair a trigger with an exclusion, and tuning
 * the description until every query lights up would be fitting it to its own tests.
 */
export function queriesWithoutTrigger({ description, scenarios }) {
  const clause = description.slice(
    description.toLowerCase().indexOf('use when'),
    description.toLowerCase().indexOf('do not use for'),
  );
  const triggers = new Set(
    (clause.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []).filter((w) => !STOPWORDS.has(w)),
  );

  return scenarios
    .filter((s) => (s.skills ?? []).length > 0)
    .filter((s) => {
      const words = (s.query.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []);
      return !words.some((w) => triggers.has(w));
    })
    .map((s) => s.id);
}

export function skillDescription() {
  const raw = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  const block = /description: >-\n((?: {2}.*\n)+)/.exec(raw)?.[1] ?? '';
  return block.trim().split('\n').map((l) => l.trim()).join(' ');
}

export function currentSkillVersion() {
  const match = readFileSync(join(ROOT, 'SKILL.md'), 'utf8').match(/^ {2}version: (\d+\.\d+\.\d+)$/m);
  return match?.[1] ?? null;
}

function read() {
  const scenarios = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();

  const results = existsSync(RESULTS_DIR)
    ? readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(RESULTS_DIR, f), 'utf8')))
    : [];

  return { scenarios, results };
}

// Printed, never fatal. Whether stale verdicts are worth 16 fresh sessions is the maintainer's
// call; hiding that they are stale is not.
function reportStale(results, currentVersion) {
  if (!currentVersion) return;
  const stale = findStale({ results, currentVersion });
  if (stale.length === 0) return;

  const versions = [...new Set(stale.map((s) => s.gradedAgainst))].sort();
  console.log('');
  console.log(`  ${stale.length} verdict(s) graded against ${versions.join(', ')}; the tree is ${currentVersion}.`);

  for (const version of versions) {
    const changed = surfaceChangedSince(version);
    if (changed === null) {
      console.log(`  v${version}: cannot tell what changed since — no such tag here, or no git.`);
    } else if (changed.length === 0) {
      console.log(`  v${version}: no model-facing file changed since. Those verdicts still hold.`);
    } else {
      const list = changed.length > 3 ? `${changed.slice(0, 3).join(', ')} +${changed.length - 3} more` : changed.join(', ');
      console.log(`  v${version}: ${list} changed since. Re-run those scenarios, or say why not.`);
    }
  }
}

/**
 * Scenarios that measure the rules, and the ones that measure whether the rules are reached.
 *
 * Every scenario used to do both. A scenario is run by pasting its query and reading the answer,
 * so a run that never loaded the skill produced a reply graded against rules it had never seen —
 * three times, and each time the description was retuned as though a rule had failed. Activation
 * is a semantic match against the description and no wording makes it certain, so it is measured
 * on its own rows. Everywhere else the skill is named, and the result is about conduct.
 */
function reportInvocationSplit() {
  const scenarios = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SCENARIOS_DIR, f), 'utf8')));

  const implicit = scenarios.filter((s) => s.invocation === 'implicit').map((s) => s.id);
  console.log('');
  console.log(`  ${scenarios.length - implicit.length} scenarios name the skill and measure conduct.`);
  console.log(`  ${implicit.length} do not, and measure activation: ${implicit.join(', ')}`);
  console.log('  A miss on those is one row, not a verdict on the other rules.');
}

function reportUntriggerable() {
  const scenarios = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(SCENARIOS_DIR, f), 'utf8')));

  const bare = queriesWithoutTrigger({ description: skillDescription(), scenarios });
  if (bare.length === 0) return;

  console.log('');
  console.log(`  ${bare.length} scenario quer(ies) share no word with the description's "Use when" clause:`);
  console.log(`    ${bare.join(', ')}`);
  console.log('  The description is the whole of activation, so a run of these may measure whether');
  console.log('  the skill loaded rather than what it decided. Check the load indicator first.');
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const { scenarios, results } = read();
  const failures = checkRegistry({ scenarios, results });

  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error(`\n${failures.length} problem(s) in evals/results/.`);
    return 1;
  }

  if (!quiet) {
    const tally = VERDICTS.map((v) => [v, results.filter((r) => r.verdict === v).length])
      .filter(([, n]) => n > 0)
      .map(([v, n]) => `${n} ${v}`)
      .join(' · ');
    console.log(`evals/results/: ${results.length} of ${scenarios.length} scenarios — ${tally}`);
    reportStale(results, currentSkillVersion());
    reportUntriggerable();
    reportInvocationSplit();
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

export { main, read };
