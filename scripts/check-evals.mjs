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

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS_DIR = join(ROOT, 'evals');
const RESULTS_DIR = join(ROOT, 'evals', 'results');

export const VERDICTS = ['PASS', 'PARTIAL', 'FAIL', 'NOT_RUN'];
const REQUIRED = ['scenario', 'verdict', 'date', 'skillVersion', 'generatedBy', 'gradedBy'];

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
