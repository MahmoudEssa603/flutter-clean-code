#!/usr/bin/env node
// Writes the results table in evals/README.md from evals/results/.
//
// The table used to be maintained by hand next to the records it was supposed to reflect, and
// the two drifted apart — one said every scenario passed while a row inside it described two
// expectations that had not. There is one source now; this renders it.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/generate-eval-summary.mjs [--check] [--quiet]
//   (no flag)  rewrite the block in evals/README.md
//   --check    exit 1 if the committed block is not what the records produce
// Exit code 0 = written, or already in step.

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { read } from './check-evals.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(ROOT, 'evals', 'README.md');
const START = '<!-- generated: eval-summary -->';
const END = '<!-- /generated: eval-summary -->';

export function renderSummary({ scenarios, results }) {
  const byScenario = new Map(results.map((r) => [r.scenario, r]));
  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;

  const tally = ['PASS', 'PARTIAL', 'FAIL', 'NOT_RUN']
    .filter((v) => counts[v])
    .map((v) => `**${counts[v]} ${v}**`)
    .join(' · ');

  const rows = scenarios.map((id) => {
    const r = byScenario.get(id);
    if (!r) return `| \`${id}\` | — | NOT_RECORDED | no result record |`;
    const e = r.expectations ?? {};
    const detail = e.recorded
      ? `${e.total - (e.partial ?? 0) - (e.fail ?? 0)}/${e.total} expectations`
      : 'not enumerated';
    return `| \`${id}\` | ${r.date} | **${r.verdict}** | ${detail} | ${r.note ?? ''} |`;
  });

  return [
    START,
    '',
    `${tally} across ${scenarios.length} scenarios.`,
    '',
    'Generated from `evals/results/` by `scripts/generate-eval-summary.mjs`. Edit the records,',
    'not this table.',
    '',
    '| Scenario | Last run | Verdict | Expectations | Note |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    END,
  ].join('\n');
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const check = argv.includes('--check');

  const registry = read();
  const rendered = renderSummary(registry);
  const readme = readFileSync(README, 'utf8');

  const from = readme.indexOf(START);
  const to = readme.indexOf(END);
  if (from === -1 || to === -1) {
    console.error(`evals/README.md has no ${START} … ${END} block to fill.`);
    return 1;
  }

  const current = readme.slice(from, to + END.length);

  if (check) {
    if (current === rendered) {
      if (!quiet) console.log('evals/README.md is in step with evals/results/');
      return 0;
    }
    console.error('evals/README.md does not match evals/results/.');
    console.error('Run: node scripts/generate-eval-summary.mjs');
    return 1;
  }

  writeFileSync(README, readme.slice(0, from) + rendered + readme.slice(to + END.length));
  if (!quiet) console.log('evals/README.md regenerated from evals/results/');
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

export { main };
