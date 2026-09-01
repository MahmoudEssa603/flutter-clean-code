#!/usr/bin/env node
// Validates SKILL.md against the contract in AGENTS.md.
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/validate-skill.mjs [--quiet]
// Exit code 0 = every check passed, 1 = at least one failure.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');

// Limits come from the Agent Skills spec; see AGENTS.md > Frontmatter contract.
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMPATIBILITY_MAX = 500;
const BODY_MAX_LINES = 500;
const CONTENTS_REQUIRED_ABOVE_LINES = 100;

// The portable six. Anything else fails packaging outside Claude Code with a hard error.
const ALLOWED_FRONTMATTER = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'allowed-tools',
  'metadata',
]);

// AGENTS.md > Self-containment rule: the skill names no sibling skill or external project.
const FORBIDDEN_MENTIONS = [
  'flutter-code-quality',
  'flutter-state-management-review',
  'flutter-theming-design-system',
  'flutter-performance-profile',
  'review-module',
  'tech-debt',
  'golden-reference',
];

// AGENTS.md > Vocabulary: banned synonyms, checked as whole words in prose.
const BANNED_SYNONYMS = [
  ['violation', 'finding'],
  ['changeset', 'batch'],
  ['severity', 'Impact'],
  ['metric', 'signal'],
];

// Sets, not arrays: the same link can appear twice in SKILL.md and should be
// reported once.
const failures = new Set();
const notes = new Set();

const fail = (check, detail) => failures.add(`${check}: ${detail}`);
const note = (text) => notes.add(text);

// --- frontmatter -------------------------------------------------------------
// A deliberately small parser for the shape AGENTS.md permits: scalar values,
// folded block scalars (>- / > / |), and a one-level `metadata` map. It is not a
// general YAML implementation, and it should not become one.
function parseFrontmatter(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'file does not start with ---' };

  const end = lines.indexOf('---', 1);
  if (end === -1) return { error: 'frontmatter is never closed' };

  const fields = {};
  const order = [];
  let i = 1;

  while (i < end) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i += 1;
      continue;
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!match) {
      return { error: `line ${i + 1} is not a top-level key: ${line}` };
    }

    const [, key, rawValue] = match;
    order.push(key);
    const value = rawValue.trim();

    if (value === '>-' || value === '>' || value === '|' || value === '|-') {
      const parts = [];
      i += 1;
      while (i < end && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        parts.push(lines[i].trim());
        i += 1;
      }
      const joiner = value.startsWith('|') ? '\n' : ' ';
      fields[key] = parts.join(joiner).trim();
      continue;
    }

    if (value === '') {
      const map = {};
      i += 1;
      while (i < end && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        const nested = /^\s+([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(lines[i]);
        if (nested) map[nested[1]] = nested[2].trim();
        i += 1;
      }
      fields[key] = map;
      continue;
    }

    fields[key] = value;
    i += 1;
  }

  return { fields, order, bodyStartLine: end + 1 };
}

const skillPath = join(ROOT, 'SKILL.md');
if (!existsSync(skillPath)) {
  console.error('FAIL structure: SKILL.md not found at the repository root');
  process.exit(1);
}

const skillRaw = readFileSync(skillPath, 'utf8');
const parsed = parseFrontmatter(skillRaw);

if (parsed.error) {
  console.error(`FAIL frontmatter: ${parsed.error}`);
  process.exit(1);
}

const { fields, bodyStartLine } = parsed;
const body = skillRaw.split(/\r?\n/).slice(bodyStartLine);

// --- field checks ------------------------------------------------------------
for (const key of Object.keys(fields)) {
  if (!ALLOWED_FRONTMATTER.has(key)) {
    fail(
      'frontmatter',
      `"${key}" is not one of the portable six (${[...ALLOWED_FRONTMATTER].join(', ')}); ` +
        'it would fail packaging outside Claude Code',
    );
  }
}

const name = typeof fields.name === 'string' ? fields.name : '';
if (!name) {
  fail('name', 'missing');
} else {
  if (name.length > NAME_MAX) fail('name', `${name.length} chars, max ${NAME_MAX}`);
  if (!/^[a-z0-9-]+$/.test(name)) fail('name', `"${name}" must be lowercase letters, digits, hyphens`);
  if (/anthropic|claude/i.test(name)) fail('name', `"${name}" contains a reserved word`);
  if (name !== basename(ROOT)) {
    note(`name "${name}" differs from the directory name "${basename(ROOT)}" — fine locally, but the clone target must be renamed to match`);
  }
}

const description = typeof fields.description === 'string' ? fields.description : '';
if (!description) {
  fail('description', 'missing or empty');
} else {
  if (description.length > DESCRIPTION_MAX) {
    fail('description', `${description.length} chars, max ${DESCRIPTION_MAX}`);
  }
  if (/<[a-zA-Z/]/.test(description)) fail('description', 'contains what looks like an XML tag');
  if (!/\bDo not use\b/i.test(description)) {
    fail('description', 'missing the required "Do not use for ..." negative clause');
  }
  if (/\b(I can|I will|you can use this)\b/i.test(description)) {
    fail('description', 'must be written in the third person');
  }
}

const compatibility = typeof fields.compatibility === 'string' ? fields.compatibility : '';
if (compatibility && compatibility.length > COMPATIBILITY_MAX) {
  fail('compatibility', `${compatibility.length} chars, max ${COMPATIBILITY_MAX}`);
}

const version = fields.metadata && fields.metadata.version;
if (!version) {
  fail('metadata.version', 'missing');
} else if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail('metadata.version', `"${version}" is not MAJOR.MINOR.PATCH`);
}

if (!fields.license) fail('license', 'missing');

// --- body checks -------------------------------------------------------------
if (body.length > BODY_MAX_LINES) {
  fail('body', `${body.length} lines, max ${BODY_MAX_LINES}; move detail into references/`);
}

// --- link graph --------------------------------------------------------------
const localLinks = (text) =>
  [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((m) => m[1].split('#')[0].trim())
    .filter((href) => href && !/^(https?:|mailto:)/.test(href));

const skillLinks = localLinks(skillRaw);
for (const href of skillLinks) {
  if (href.includes('\\')) fail('paths', `"${href}" uses a backslash; use forward slashes`);
  if (!existsSync(join(ROOT, href))) fail('links', `SKILL.md links to missing file "${href}"`);
}

const referencesDir = join(ROOT, 'references');
if (!existsSync(referencesDir)) {
  fail('structure', 'references/ directory is missing');
} else {
  const referenceFiles = readdirSync(referencesDir).filter((f) => f.endsWith('.md'));
  if (referenceFiles.length === 0) fail('structure', 'references/ contains no markdown files');

  for (const file of referenceFiles) {
    const rel = `references/${file}`;
    if (!skillLinks.includes(rel)) {
      fail('links', `${rel} exists but SKILL.md never links to it`);
    }

    const text = readFileSync(join(referencesDir, file), 'utf8');
    const lineCount = text.split(/\r?\n/).length;

    if (lineCount > CONTENTS_REQUIRED_ABOVE_LINES && !/^##\s+Contents\s*$/m.test(text)) {
      fail('references', `${rel} is ${lineCount} lines and has no "## Contents" section`);
    }

    for (const href of localLinks(text)) {
      if (href.startsWith('references/') || (href.endsWith('.md') && !href.includes('/'))) {
        fail('links', `${rel} links to another reference file ("${href}"); references stay one level deep`);
      }
    }
  }
}

// --- the checklist and the report must agree ---------------------------------
// A principle area with no row in the Summary table has nowhere to put its
// findings, and a row with no area reads as something nobody looked at. Both
// happened once; this gate is why they cannot happen again.
const checklistAreas = [...skillRaw.matchAll(/^#### (\d+)\.\s+(.+)$/gm)].map((m) => ({
  number: Number(m[1]),
  title: m[2].trim(),
}));

if (checklistAreas.length === 0) {
  fail('checklist', 'no "#### N. Title" principle areas found in SKILL.md');
} else {
  checklistAreas.forEach((area, index) => {
    if (area.number !== index + 1) {
      fail('checklist', `area "${area.title}" is numbered ${area.number}; expected ${index + 1}`);
    }
  });
}

/** Reads the principle names out of a Summary table, or null when there is none. */
function summaryRows(text) {
  const header = text.indexOf('| Principle | Findings');
  if (header === -1) return null;

  const rows = [];
  // Skip the header row and the |---| separator beneath it.
  for (const line of text.slice(header).split(/\r?\n/).slice(2)) {
    if (!line.trimStart().startsWith('|')) break;
    rows.push(line.split('|')[1].trim());
  }
  return rows;
}

for (const file of ['references/report-template.md', 'references/example-report.md']) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;

  const rows = summaryRows(readFileSync(path, 'utf8'));
  if (rows === null) {
    fail('checklist', `${file} has no "| Principle | Findings" summary table`);
    continue;
  }
  if (rows.length !== checklistAreas.length) {
    fail(
      'checklist',
      `${file} lists ${rows.length} principle row(s) but SKILL.md defines ` +
        `${checklistAreas.length} area(s): ${checklistAreas.map((a) => a.title).join(', ')}`,
    );
  }
}

// --- self-containment and vocabulary ----------------------------------------
const authored = ['SKILL.md', 'README.md', 'AGENTS.md', 'CONTRIBUTING.md']
  .map((f) => join(ROOT, f))
  .filter((p) => existsSync(p))
  .concat(
    existsSync(referencesDir)
      ? readdirSync(referencesDir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => join(referencesDir, f))
      : [],
  );

for (const file of authored) {
  const rel = file.slice(ROOT.length + 1).replaceAll('\\', '/');
  const text = readFileSync(file, 'utf8');

  // AGENTS.md itself defines the forbidden list, so it is allowed to name them.
  if (rel !== 'AGENTS.md') {
    for (const term of FORBIDDEN_MENTIONS) {
      if (text.includes(term)) {
        fail('self-containment', `${rel} mentions "${term}"; the skill names no external skill or project`);
      }
    }
    for (const [banned, preferred] of BANNED_SYNONYMS) {
      const hits = text.match(new RegExp(`\\b${banned}\\b`, 'gi'));
      if (hits) fail('vocabulary', `${rel} uses "${banned}" ${hits.length}x; AGENTS.md says use "${preferred}"`);
    }
  }

  if (/\]\([^)]*\\[^)]*\)/.test(text)) {
    fail('paths', `${rel} has a link containing a backslash`);
  }
}

// --- scripts -----------------------------------------------------------------
// AGENTS.md > Trust model: Node built-ins only, so there is no install step.
const scriptsDir = join(ROOT, 'scripts');
const REQUIRED_SCRIPTS = ['validate-skill.mjs', 'scan-dart.mjs'];

for (const required of REQUIRED_SCRIPTS) {
  if (!existsSync(join(scriptsDir, required))) fail('scripts', `scripts/${required} is missing`);
}

for (const file of readdirSync(scriptsDir).filter((f) => f.endsWith('.mjs'))) {
  const text = readFileSync(join(scriptsDir, file), 'utf8');
  for (const match of text.matchAll(/^import\s[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
    const specifier = match[1];
    if (!specifier.startsWith('node:') && !specifier.startsWith('.')) {
      fail('scripts', `scripts/${file} imports "${specifier}"; Node built-ins only`);
    }
  }
}

// --- tests -------------------------------------------------------------------
// The scanner is parsing logic; parsing logic without tests is a guess.
const testDir = join(ROOT, 'test');
if (!existsSync(testDir)) {
  fail('tests', 'test/ directory is missing');
} else {
  const suites = readdirSync(testDir).filter((f) => f.endsWith('.test.mjs'));
  if (suites.length < 2) {
    fail('tests', `${suites.length} test suite(s); scan-dart and validate-skill both need one`);
  }
  for (const required of ['scan-dart.test.mjs', 'validate-skill.test.mjs']) {
    if (!suites.includes(required)) fail('tests', `test/${required} is missing`);
  }
}

// --- evals -------------------------------------------------------------------
const evalsDir = join(ROOT, 'evals');
if (!existsSync(evalsDir)) {
  fail('evals', 'evals/ directory is missing; the spec asks for at least three scenarios');
} else {
  const scenarios = readdirSync(evalsDir).filter((f) => f.endsWith('.json'));
  if (scenarios.length < 3) {
    fail('evals', `${scenarios.length} scenario file(s); at least 3 are required`);
  }
  for (const file of scenarios) {
    const path = join(evalsDir, file);
    if (statSync(path).size === 0) {
      fail('evals', `evals/${file} is empty`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      fail('evals', `evals/${file} is not valid JSON: ${error.message}`);
      continue;
    }
    for (const key of ['skills', 'query', 'expected_behavior']) {
      if (!(key in data)) fail('evals', `evals/${file} is missing "${key}"`);
    }
    if (Array.isArray(data.expected_behavior) && data.expected_behavior.length === 0) {
      fail('evals', `evals/${file} has an empty expected_behavior list`);
    }
  }
}

// --- report ------------------------------------------------------------------
if (!QUIET) {
  console.log(`name              ${name}`);
  console.log(`version           ${version ?? '(none)'}`);
  console.log(`description       ${description.length}/${DESCRIPTION_MAX} chars`);
  console.log(`compatibility     ${compatibility.length}/${COMPATIBILITY_MAX} chars`);
  console.log(`body              ${body.length}/${BODY_MAX_LINES} lines`);
  console.log(`reference links   ${skillLinks.length}`);
  console.log('');
}

for (const text of notes) console.log(`NOTE  ${text}`);

if (failures.size > 0) {
  console.error('');
  for (const text of failures) console.error(`FAIL  ${text}`);
  console.error(`\n${failures.size} check(s) failed.`);
  process.exit(1);
}

console.log('All checks passed.');
