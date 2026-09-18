// Tests for the report contract checker.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkReport } from '../scripts/check-report.mjs';

const HEADER = [
  '# Clean Code — AUDIT — orders',
  '',
  '**Scope:** `lib/features/orders/` · **Evidence:** Partial',
  '**Conventions:** not verified',
  '**Verification:** no SDK on PATH',
  '**Not checked:** nothing',
  '',
  '## Summary',
  '',
  '| Principle | Findings | High | Medium | Low |',
  '|---|---|---|---|---|',
  ...['Naming', 'Functions', 'Classes & SOLID', 'Flutter', 'Comments', 'Errors & data', 'Tests'].map(
    (p) => `| ${p} | 0 | 0 | 0 | 0 |`,
  ),
  '',
  '## Findings',
  '',
].join('\n');

// A report states the scanner's outcome, so the fixture of a valid one states it too.
const TAIL = [
  '',
  '## Out of Scope',
  '',
  '| Observation | Why |',
  '|---|---|',
  '',
  '## Verification',
  '',
  '- [x] scanner run — 12 signals',
  '',
].join('\n');

const finding = (n, { impact = 'High', effort = 'XS', confidence = 'High', location = '`a/b.dart:12`' } = {}) =>
  [
    `### CC-${String(n).padStart(3, '0')} — a title`,
    '',
    '**Principle:** Naming',
    `**Impact:** ${impact} · **Effort:** ${effort} · **Confidence:** ${confidence}`,
    `**Location:** ${location}`,
    '',
  ].join('\n');

const report = (findings, extra = '') => HEADER + findings.join('\n') + extra + TAIL;

test('a report that holds the contract passes', () => {
  const { failures } = checkReport(report([finding(1), finding(2)]));
  assert.deepEqual(failures, []);
});

test('a finding missing one of the three judgements fails', () => {
  const stripped = finding(1).replace('· **Effort:** XS ', '');
  const { failures } = checkReport(report([stripped]));
  assert.equal(failures.length, 1);
  assert.match(failures[0], /CC-001 has no Effort/);
});

test('Confidence is High or Low, and Medium is neither', () => {
  // The scale has two values on purpose: a Low-confidence finding is reported as a question.
  const { failures } = checkReport(report([finding(1, { confidence: 'Medium' })]));
  assert.match(failures.join('\n'), /CC-001 Confidence is "Medium"/);
});

test('a finding rated two confidences at once fails', () => {
  // A real run wrote "High (the name) / Low (the intent)" on a field whose name was proven and
  // whose intent was not. Reading the first word alone recorded that as High, so the report
  // carried a contradiction the checker had endorsed. One value per finding, per SKILL.md.
  const { failures } = checkReport(
    report([finding(1, { confidence: 'High (the name) / Low (the intent)' })]),
  );
  assert.match(failures.join('\n'), /CC-001 Confidence is "High \(the name\) \/ Low \(the intent\)"/);
  assert.match(failures.join('\n'), /two findings, or one at Low/);
});

test('a re-run annotating Confidence with its old value fails too', () => {
  // A real re-run wrote "Low *(was High)*", which is one rating with its history attached rather
  // than a finding that cannot decide itself. It is still rejected: the field stays one
  // machine-readable word — the report template's JSON form carries it — and SKILL.md already
  // gives a re-run the Since-last-pass table to say what moved. That report used both.
  const { failures } = checkReport(report([finding(1, { confidence: 'Low *(was High)*' })]));
  assert.match(failures.join('\n'), /CC-001 Confidence is "Low \(was High\)"/);
  assert.match(failures.join('\n'), /Since-last-pass table/);
});

test('Confidence still passes when the value is bolded or trailed by punctuation', () => {
  // Tightening the read must not start failing reports that were always right.
  for (const confidence of ['**Low**', 'Low.', 'Low ']) {
    const { failures } = checkReport(report([finding(1, { confidence })]));
    assert.deepEqual(failures, [], `rejected a valid Confidence: ${confidence}`);
  }
});

test('more findings than the cap fails', () => {
  const many = Array.from({ length: 21 }, (_, i) => finding(i + 1));
  assert.match(checkReport(report(many)).failures.join('\n'), /21 findings listed, over the cap of 20/);
});

test('a location may name a path with no line, because some defects have none', () => {
  // A misspelled filename is the file; a missing test directory is an absence. Both are located.
  for (const location of ['`lib/a/pin_code_filed.dart`', '`test/` — no `orders` directory']) {
    assert.deepEqual(checkReport(report([finding(1, { location })])).failures, [], location);
  }
});

test('a location naming neither a path nor a line fails', () => {
  const { failures } = checkReport(report([finding(1, { location: 'somewhere in the widget' })]));
  assert.match(failures.join('\n'), /names neither a path nor a line/);
});

test('a re-run keeps the ids it inherited, so it may start past CC-001', () => {
  const rerun = HEADER.replace('## Summary', '## Since last pass\n\nnothing fixed\n\n## Summary');
  const { failures } = checkReport(rerun + [finding(21), finding(22)].join('\n') + TAIL);
  assert.deepEqual(failures, []);
});

// The exemption used to require the exact words "Since last pass". SKILL.md only asks for a
// Since-last-pass table and never dictates the heading, so a real run wrote "Since the last
// pass" and was failed for a numbering gap it was right to have.
test('the re-run exemption matches the heading a run actually writes', () => {
  const heading = '## Since the last pass — 2026-09-10';
  const rerun = HEADER.replace('## Summary', heading + '\n\nnothing fixed\n\n## Summary');
  const { failures } = checkReport(rerun + [finding(21), finding(22)].join('\n') + TAIL);
  assert.deepEqual(failures, []);
});

test('a first pass that does not start at CC-001 fails', () => {
  assert.match(checkReport(report([finding(21)])).failures.join('\n'), /start at CC-021, not CC-001/);
});

test('a dropped principle row is caught, because it reads as an area nobody looked at', () => {
  const short = report([finding(1)]).replace('| Tests | 0 | 0 | 0 | 0 |\n', '');
  assert.match(checkReport(short).failures.join('\n'), /6 principle rows, not 7/);
});

test('an Arabic header is read, because the template lets those labels translate', () => {
  const arabic = report([finding(1)])
    .replace('**Scope:**', '**النطاق:**')
    .replace('**Evidence:**', '**الدليل:**')
    .replace('**Conventions:**', '**الاصطلاحات:**')
    .replace('**Verification:**', '**التحقق:**')
    .replace('**Not checked:**', '**لم يُفحَص:**');
  assert.deepEqual(checkReport(arabic).failures, []);
});

test('a fully Arabic report holds the contract, headings and finding labels included', () => {
  // references/report-template.md says prose, headings and table cells translate. The checker
  // used to translate the header fields only, so it rejected the suite's one Arabic scenario
  // with 83 problems — every section and every finding label. It was enforcing English that no
  // model-facing file asks for. `الـ Conventions` is the other half: a real run kept the term in
  // English and put the Arabic article in front of it, which is ordinary technical prose.
  const arabic = report([finding(1), finding(2)])
    .replace('**Scope:**', '**النطاق:**')
    .replace('**Evidence:**', '**الأدلة:**')
    .replace('**Conventions:**', '**الـ Conventions:**')
    .replace('**Not checked:**', '**ما اتراجعش:**')
    .replace('## Summary', '## الملخص')
    .replace('## Findings', '## الملاحظات')
    .replace('## Out of Scope', '## برا النطاق')
    .replaceAll('**Impact:**', '**الأثر:**')
    .replaceAll('**Effort:**', '**الجهد:**')
    .replaceAll('**Confidence:**', '**الثقة:**')
    .replaceAll('**Location:**', '**المكان:**')
    .replace('**Verification:**', '**التحقق:**')
    .replace('## Verification', '## التحقق');
  assert.deepEqual(checkReport(arabic).failures, []);
});

test('the Not checked label is read by its root, because a list of spellings ran out', () => {
  // The checker held five spellings and scenario 03, answered in Egyptian Arabic, wrote a sixth:
  // `**اللي ماتفحصش:**`. The field was there and said what it should; only the dialect was new.
  for (const label of ['اللي ماتفحصش', 'ما اتفحصش', 'لم يُفحَص', 'ما اتراجعش']) {
    const arabic = report([finding(1)]).replace('**Not checked:**', `**${label}:**`);
    assert.deepEqual(checkReport(arabic).failures, [], label);
  }
  const missing = report([finding(1)]).replace('**Not checked:** nothing\n', '');
  assert.match(checkReport(missing).failures.join('\n'), /the header has no Not checked field/);
});

test('Evidence, Conventions and Out of Scope are read by their key word, as 06 wrote them', () => {
  // Scenario 06 answered in Egyptian Arabic and the checker failed it three times over on labels
  // it did not list: `مستوى الأدلة`, `قواعد المشروع` and `## برّه النطاق`. The fields were there.
  const labels = [
    ['**Evidence:**', ['**مستوى الأدلة:**', '**الأدلة:**', '**الدليل:**', '**مستوى الدليل:**']],
    ['**Conventions:**', ['**قواعد المشروع:**', '**الاصطلاحات:**', '**الأعراف:**', '**الـ Conventions:**']],
    ['## Out of Scope', ['## برّه النطاق', '## بره النطاق', '## برا النطاق', '## خارج النطاق']],
  ];
  for (const [english, arabic] of labels) {
    for (const label of arabic) {
      const translated = report([finding(1)]).replace(english, label);
      assert.deepEqual(checkReport(translated).failures, [], label);
    }
  }
  const noEvidence = report([finding(1)]).replace(' · **Evidence:** Partial', '');
  assert.match(checkReport(noEvidence).failures.join('\n'), /the header has no Evidence field/);
  const noConventions = report([finding(1)]).replace('**Conventions:** not verified\n', '');
  assert.match(checkReport(noConventions).failures.join('\n'), /the header has no Conventions field/);
  const wrongValue = report([finding(1)]).replace('**Evidence:** Partial', '**مستوى الأدلة:** Some');
  assert.match(checkReport(wrongValue).failures.join('\n'), /Evidence is "Some"/);
});

test('an Arabic Summary still has its rows counted', () => {
  // The heading was accepted in Arabic, but the row count looked for "## Summary" alone, so a
  // dropped principle row in an Arabic report was never caught — silently, with a pass.
  const short = report([finding(1)])
    .replace('## Summary', '## الملخص')
    .replace('| Tests | 0 | 0 | 0 | 0 |\n', '');
  assert.match(checkReport(short).failures.join('\n'), /6 principle rows, not 7/);
});

test('a report silent about the scanner fails', () => {
  // Two real passes skipped the measuring step and said nothing, so a reader could not tell
  // whether the numbers were measured or eyeballed. Running it is optional; saying is not.
  const silent = report([finding(1)]).replace('- [x] scanner run — 12 signals', '');
  assert.match(checkReport(silent).failures.join('\n'), /never says whether the scanner ran/);

  for (const said of ['node scripts/scan-dart.mjs lib/', 'measurements are estimates', 'القياسات تقديرية']) {
    const withNote = silent.replace('## Verification', `## Verification\n\n${said}\n`);
    assert.deepEqual(checkReport(withNote).failures, [], said);
  }
});
