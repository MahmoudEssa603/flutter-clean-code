#!/usr/bin/env node
// Checks a report against the parts of the contract that need no judgment: the header fields,
// the summary table, finding ids and their three ratings, a location on every finding, the cap,
// the sections that must exist, and a heading and a diff block for every batch. It says nothing
// about whether a finding is correct or whether something was rightly called out of scope —
// that is the reading, and it stays yours.
//
// It reads the contract, not the tool, so a report from any agent is checked the same way.
// The template translates prose, headings and table cells, so header fields, section headings
// and finding labels are accepted in English or Arabic; identifiers and code stay English.
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

// Arabic diacritics, which may sit between any two letters of a root.
const HARAKAT = '[\\u064B-\\u0652]*';

// Prose translates; these labels are the header, and the template lets them translate with it.
//
// Not checked is matched by root rather than by listing spellings. The list held five and the
// next real run, answering in Egyptian Arabic, wrote a sixth — `اللي ماتفحصش`. Negation and
// dialect vary freely around ف-ح-ص (examine) and راجع (review); the root does not.
//
// Evidence and Conventions went the same way one run later. Scenario 06 wrote
// `مستوى الأدلة` — two words the list held separately, never together — and `قواعد المشروع`,
// which it did not hold at all. Each field is now its key word with anything around it.
const around = (words) => `[^*:\\n]*(?:${words})[^*:\\n]*`;
const HEADER_FIELDS = [
  { name: 'Scope', spellings: ['Scope', 'النطاق'] },
  { name: 'Evidence', spellings: ['Evidence', around('دليل|[أا]دلة')] },
  { name: 'Conventions', spellings: ['Conventions', around('اصطلاح|[أا]عراف|قواعد|معايير')] },
  { name: 'Verification', spellings: ['Verification', 'التحقق'] },
  {
    name: 'Not checked',
    spellings: ['Not checked', `[^*:\\n]*(?:ف${HARAKAT}ح${HARAKAT}ص|راجع)[^*:\\n]*`],
  },
];

// The same rule reaches further than the header. references/report-template.md says prose,
// headings and table cells translate while identifiers, paths, commands and code do not — so an
// Arabic report writes "## الملخص" and "**الأثر:**", and this checker used to demand English for
// both and reject the only Arabic scenario in the suite outright. A check that enforces what no
// model-facing file asks for is the defect fixed in the re-run heading at 1.5.0, again.
const SECTIONS = [
  { name: 'Summary', spellings: ['Summary', 'الملخص'] },
  { name: 'Findings', spellings: ['Findings', 'الملاحظات'] },
  // "Outside" is برا, بره or برّه in Egyptian Arabic and خارج in the standard; 06 wrote برّه.
  { name: 'Out of Scope', spellings: ['Out of Scope', `(?:بر${HARAKAT}[اهة]|خارج)\\s+النطاق`] },
  { name: 'Verification', spellings: ['Verification', 'التحقق'] },
];

const FINDING_FIELDS = {
  Impact: ['Impact', 'الأثر'],
  Effort: ['Effort', 'الجهد'],
  Confidence: ['Confidence', 'الثقة'],
  Location: ['Location', 'المكان'],
};

// \b is ASCII-only, so it cannot end an Arabic word. "not followed by a letter" works in both
// scripts and still allows a qualified heading such as "## Summary — new findings only".
//
// An Arabic report may also keep a term in English and put the article in front of it, which is
// ordinary Arabic technical prose: a real run wrote `**الـ Conventions:**`. The article is
// optional everywhere, so one spelling covers both renderings.
const labelled = (spellings) => `\\*\\*(?:الـ\\s*)?(?:${spellings.join('|')}):\\*\\*`;
const headerField = (spellings) => new RegExp(labelled(spellings));

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
    if (!headerField(spellings).test(header)) {
      fail(`the header has no ${name} field`);
    }
  }
  const evidenceSpellings = HEADER_FIELDS.find((f) => f.name === 'Evidence').spellings;
  const evidence = new RegExp(`${labelled(evidenceSpellings)}\\s*\\**\\s*(\\w+)`).exec(header);
  if (evidence && !EVIDENCE.includes(evidence[1])) {
    fail(`Evidence is "${evidence[1]}", not one of ${EVIDENCE.join(' / ')}`);
  }

  // --- sections ------------------------------------------------------------
  // Headings translate, and a re-run qualifies them ("## Summary — new findings only"). Match
  // the name at the head of the line rather than demanding the line be nothing else.
  for (const { name, spellings } of SECTIONS) {
    const heading = new RegExp(`^##\\s+(?:${spellings.join('|')})(?!\\p{L})`, 'mu');
    if (!heading.test(text)) fail(`no "## ${name}" section`);
  }

  // --- the summary table ---------------------------------------------------
  // A missing row reads as an area nobody looked at, which is the failure worth catching. The
  // row names themselves translate, so count the rows rather than matching their text.
  // The heading is found by the same spellings as the section check; this used to look for
  // "Summary" alone, so an Arabic report's rows were never counted. The section runs to the next
  // heading or the end of the text — JavaScript has no \Z, which here meant a literal "Z".
  const summarySpellings = SECTIONS.find((s) => s.name === 'Summary').spellings.join('|');
  const summary = new RegExp(`^##\\s+(?:${summarySpellings})(?!\\p{L}).*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'mu')
    .exec(text);
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
    //
    // SKILL.md asks for a "Since-last-pass table" and never dictates the heading, so this
    // matches the shape rather than one spelling. Requiring the exact words "Since last pass"
    // made the exemption near-unreachable: a real run wrote "## Since the last pass — 2026-09-10"
    // and was failed for a numbering gap it was right to have.
    const isRerun = /^## +Since.*pass/im.test(text);
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

    const impact = new RegExp(`${labelled(FINDING_FIELDS.Impact)}\\s*(\\w+)`).exec(block);
    const effort = new RegExp(`${labelled(FINDING_FIELDS.Effort)}\\s*(\\w+)`).exec(block);
    // Confidence is read to the end of its line, not as the first word on it. Reading one word
    // accepted "High (the name) / Low (the intent)" as High: a real run wrote that, because the
    // name was proven and the intent was not, and no rule told it which to record. SKILL.md now
    // says one Confidence per finding, and a finding needing two is two findings or one at Low.
    const confidence = new RegExp(`${labelled(FINDING_FIELDS.Confidence)}\\s*(.*)$`, 'm').exec(block);

    if (!impact) fail(`${id} has no Impact`);
    else if (!IMPACT.includes(impact[1])) fail(`${id} Impact is "${impact[1]}"`);

    if (!effort) fail(`${id} has no Effort`);
    else if (!EFFORT.includes(effort[1])) fail(`${id} Effort is "${effort[1]}"`);

    if (!confidence) fail(`${id} has no Confidence`);
    else {
      const value = confidence[1].replace(/\*/g, '').trim().replace(/[.·]+$/, '').trim();
      if (!CONFIDENCE.includes(value)) {
        // Two shapes reach here and the advice differs. A second rating ("High (the name) / Low
        // (the intent)") is a finding that cannot decide itself and wants splitting. Provenance
        // ("Low (was High)") is one rating with history attached, and a re-run already has the
        // Since-last-pass table for that — the field itself stays a single machine-readable word.
        fail(CONFIDENCE.some((c) => value.startsWith(c))
          ? `${id} Confidence is "${value}" — the field carries one value and nothing else. ` +
            'A finding needing two ratings is two findings, or one at Low; what it used to be ' +
            'belongs in the Since-last-pass table.'
          : `${id} Confidence is "${value}"`);
      }
    }

    // "A finding without a location is an opinion" — a location, not necessarily a line. Some
    // defects have no line to point at: a misspelled filename is the file, and a missing test
    // directory is an absence. Both are located; neither has a number.
    const location = new RegExp(`${labelled(FINDING_FIELDS.Location)}(.*)`).exec(block);
    if (!location) fail(`${id} has no Location`);
    else if (!/[:#]L?\d+/.test(location[1]) && !/[\w-]+[/.]/.test(location[1])) {
      fail(`${id} Location names neither a path nor a line: ${location[1].trim()}`);
    }
  }

  checkBatches(lines, fail);

  return { label, failures, findings: ids.length };
}

// "Batch" is دفعة in Arabic, الدفعات for the section. Matched by key word, like the fields above.
const BATCH_WORD = `(?:Batch(?:es)?|(?:ال)?دف${HARAKAT}ع${HARAKAT}(?:ة|ات))`;

// references/report-template.md gives every batch its own `### Batch N — <type>` heading and a
// fenced `diff` block of its key hunks. Nothing enforced it, and four of the five runs at 1.6.0
// that proposed patches wrote the batches as one table under `## Batches` instead — so a check
// keyed on `### Batch` headings alone would have passed every one of them. A Batches section
// with no batch heading fails for that reason. The rule does not depend on Status: the template
// gives the block to applied and unapplied batches alike. AUDIT and DIFF have no Batches section
// and are untouched.
//
// Headings are read outside fenced blocks only. A real run's diff carried `# Batch 2 — Rename`
// as its first line, which is a heading to a line scanner and a comment to a reader.
function checkBatches(lines, fail) {
  const headings = [];
  const diffs = [];
  let fence = null;
  lines.forEach((line, index) => {
    const marker = /^\s*(`{3,}|~{3,})\s*(\S*)/.exec(line);
    if (marker) {
      if (fence === null) {
        fence = marker[1];
        if (marker[2] === 'diff') diffs.push(index);
      } else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2]) {
        fence = null;
      }
      return;
    }
    if (fence !== null) return;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) headings.push({ level: heading[1].length, text: heading[2].trim(), index });
  });

  const startsWithBatch = new RegExp(`^${BATCH_WORD}(?!\\p{L})`, 'u');
  const section = headings.findIndex((h) => h.level === 2 && startsWithBatch.test(h.text));
  if (section === -1) return;

  const sectionEnd = headings.slice(section + 1).find((h) => h.level <= 2)?.index ?? lines.length;
  const batches = headings.filter(
    (h) => h.level === 3 && h.index > headings[section].index && h.index < sectionEnd &&
      startsWithBatch.test(h.text),
  );
  if (batches.length === 0) {
    fail('the Batches section has no "### Batch" heading — a table of batches is not one; ' +
      'the template gives every batch its own heading and a ```diff block');
    return;
  }

  for (const batch of batches) {
    const end = headings.find((h) => h.index > batch.index && h.level <= 3)?.index ?? lines.length;
    if (!diffs.some((d) => d > batch.index && d < Math.min(end, sectionEnd))) {
      fail(`"### ${batch.text}" has no \`\`\`diff block of its key hunks`);
    }
  }
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
