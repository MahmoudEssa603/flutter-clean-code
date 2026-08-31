#!/usr/bin/env node
// Checks a report against the parts of the contract that need no judgment: the header fields,
// the summary table, finding ids and their three ratings, a location on every finding, the cap,
// and the sections that must exist. It says nothing about whether a finding is correct or
// whether something was rightly called out of scope — that is the reading, and it stays yours.
//
// It reads the contract, not the tool, so a report from any agent is checked the same way.
// Section headings stay English in every language (the template translates prose and table
// cells); the five header fields do translate, so both spellings are accepted.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/check-report.mjs <report.md> [<report.md> ...] [--quiet]
// Exit code 0 = every report passed, 1 = at least one failed.

import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const MODES = ['AUDIT', 'DIFF', 'REFACTOR'];
const EVIDENCE = ['Full', 'Partial', 'None'];
const IMPACT = ['High', 'Medium', 'Low'];
const EFFORT = ['XS', 'S', 'M', 'L'];
const CONFIDENCE = ['High', 'Low'];
const PRINCIPLE_AREAS = 7;
const CAP = 20;

// Prose translates; these labels are the header, and the template lets them translate with it.
const HEADER_FIELDS = [
  { name: 'Scope', spellings: ['Scope', 'النطاق'] },
  { name: 'Evidence', spellings: ['Evidence', 'الدليل', 'مستوى الدليل'] },
  { name: 'Conventions', spellings: ['Conventions', 'الاصطلاحات', 'الأعراف'] },
  { name: 'Verification', spellings: ['Verification', 'التحقق'] },
  { name: 'Not checked', spellings: ['Not checked', 'لم يُفحَص', 'لم يتم فحص', 'ما لم يُفحص'] },
];

export function checkReport(text, label = 'report') {
  const failures = [];
  const fail = (message) => failures.push(message);
  const lines = text.split(/\r?\n/);

  // --- title ---------------------------------------------------------------
  const title = lines.find((l) => l.startsWith('# '));
  if (!title) {
    fail('no title line');
  } else if (!/^# Clean Code — (AUDIT|DIFF|REFACTOR) — \S/.test(title)) {
    fail(`title is not "# Clean Code — <${MODES.join('|')}> — <module>": ${title.trim()}`);
  }

  // --- header fields -------------------------------------------------------
  const header = lines.slice(0, 40).join('\n');
  for (const { name, spellings } of HEADER_FIELDS) {
    if (!spellings.some((s) => header.includes(`**${s}:**`))) {
      fail(`the header has no ${name} field`);
    }
  }
  const evidence = /\*\*(?:Evidence|الدليل|مستوى الدليل):\*\*\s*\**\s*(\w+)/.exec(header);
  if (evidence && !EVIDENCE.includes(evidence[1])) {
    fail(`Evidence is "${evidence[1]}", not one of ${EVIDENCE.join(' / ')}`);
  }

  // --- sections ------------------------------------------------------------
  // Headings translate, and a re-run qualifies them ("## Summary — new findings only"). Match
  // the name at the head of the line rather than demanding the line be nothing else.
  for (const section of ['Summary', 'Findings', 'Out of Scope', 'Verification']) {
    if (!new RegExp(`^##\\s+${section}\\b`, 'm').test(text)) fail(`no "## ${section}" section`);
  }

  // --- the summary table ---------------------------------------------------
  // A missing row reads as an area nobody looked at, which is the failure worth catching. The
  // row names themselves translate, so count the rows rather than matching their text.
  const summary = /^##\s+Summary\b.*$([\s\S]*?)(?=^##\s|\Z)/m.exec(text);
  if (summary) {
    const rows = summary[1]
      .split('\n')
      .filter((l) => l.trim().startsWith('|') && !/^\s*\|[\s:|-]+\|\s*$/.test(l));
    const dataRows = rows.slice(1).filter((l) => !/\*\*(Total|المجموع|الإجمالي)\*\*/.test(l));
    if (dataRows.length < PRINCIPLE_AREAS) {
      fail(`the summary table has ${dataRows.length} principle rows, not ${PRINCIPLE_AREAS}`);
    }
  }

  // --- the measuring step --------------------------------------------------
  // Two passes skipped the scanner and said nothing about it, which reads as a report built on
  // measurements it never took. Running it is not required — an agent that cannot find it, or has
  // no Node, is expected to read the code instead. Saying which happened is required.
  const scannerMentioned =
    /scan-dart|scanner/i.test(text) ||
    /\b(estimate|estimates|estimated|signals?)\b/i.test(text) ||
    /تقدير|إشار(ة|ات)|الماسح/.test(text);
  if (!scannerMentioned) {
    fail('the report never says whether the scanner ran; measured or estimated, it has to say which');
  }

  // --- findings ------------------------------------------------------------
  const ids = [...text.matchAll(/^###\s+(CC-\d+)/gm)].map((m) => m[1]);
  if (ids.length === 0) {
    fail('no findings are numbered "### CC-nnn"');
  } else {
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) fail(`${id} appears more than once`);
      seen.add(id);
    }
    // A re-run keeps every id it inherited, so numbering that continues from an earlier pass is
    // the rule working rather than a gap. Only a first pass has to begin at CC-001.
    const isRerun = /^##\s+Since last pass\b/m.test(text);
    const numbers = ids.map((id) => Number.parseInt(id.slice(3), 10));
    if (!isRerun) {
      if (numbers[0] !== 1) {
        fail(`findings start at CC-${String(numbers[0]).padStart(3, '0')}, not CC-001`);
      }
      for (let i = 1; i < numbers.length; i += 1) {
        if (numbers[i] !== numbers[i - 1] + 1) {
          fail(`a gap in the numbering: ${ids[i - 1]} is followed by ${ids[i]}`);
          break;
        }
      }
    }
    if (ids.length > CAP) {
      fail(`${ids.length} findings listed, over the cap of ${CAP}`);
    }
  }

  // Each finding carries three judgements and a location; a finding without one is an opinion.
  const blocks = text.split(/^###\s+(?=CC-\d+)/m).slice(1);
  for (const block of blocks) {
    const id = /^(CC-\d+)/.exec(block)?.[1] ?? 'a finding';

    const impact = /\*\*Impact:\*\*\s*(\w+)/.exec(block);
    const effort = /\*\*Effort:\*\*\s*(\w+)/.exec(block);
    const confidence = /\*\*Confidence:\*\*\s*\**\s*(\w+)/.exec(block);

    if (!impact) fail(`${id} has no Impact`);
    else if (!IMPACT.includes(impact[1])) fail(`${id} Impact is "${impact[1]}"`);

    if (!effort) fail(`${id} has no Effort`);
    else if (!EFFORT.includes(effort[1])) fail(`${id} Effort is "${effort[1]}"`);

    if (!confidence) fail(`${id} has no Confidence`);
    else if (!CONFIDENCE.includes(confidence[1])) fail(`${id} Confidence is "${confidence[1]}"`);

    // "A finding without a location is an opinion" — a location, not necessarily a line. Some
    // defects have no line to point at: a misspelled filename is the file, and a missing test
    // directory is an absence. Both are located; neither has a number.
    const location = /\*\*Location:\*\*(.*)/.exec(block);
    if (!location) fail(`${id} has no Location`);
    else if (!/[:#]L?\d+/.test(location[1]) && !/[\w-]+[/.]/.test(location[1])) {
      fail(`${id} Location names neither a path nor a line: ${location[1].trim()}`);
    }
  }

  return { label, failures, findings: ids.length };
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const paths = argv.filter((a) => !a.startsWith('--'));
  if (paths.length === 0) {
    console.error('usage: node scripts/check-report.mjs <report.md> [<report.md> ...] [--quiet]');
    return 1;
  }

  let failed = 0;
  for (const path of paths) {
    let result;
    try {
      result = checkReport(readFileSync(path, 'utf8'), basename(path));
    } catch (error) {
      console.error(`${basename(path)}: cannot read — ${error.message}`);
      failed += 1;
      continue;
    }

    if (result.failures.length === 0) {
      if (!quiet) console.log(`✓ ${result.label} — ${result.findings} findings, contract holds`);
    } else {
      failed += 1;
      console.log(`✗ ${result.label} — ${result.failures.length} problem(s)`);
      for (const failure of result.failures) console.log(`    ${failure}`);
    }
  }

  if (!quiet && paths.length > 1) {
    console.log(`\n${paths.length - failed}/${paths.length} report(s) hold the contract`);
  }
  if (!quiet) {
    console.log('\nThis checks the contract, not the reading: whether a finding is right, and');
    console.log('whether something was rightly handed back, is still yours to judge.');
  }

  return failed === 0 ? 0 : 1;
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
