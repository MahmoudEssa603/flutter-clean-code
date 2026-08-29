#!/usr/bin/env node
// Collects deterministic size, shape and duplication signals from Dart files,
// so an audit cites measurements instead of impressions.
//
// These are SIGNALS, NOT FINDINGS. A 60-line build() that is one flat list of
// settings rows is fine; a 30-line one that mixes four concepts is not. The
// scanner cannot tell those apart — it only says where to look.
//
// Node built-ins only: no install step, no network, no dependencies.
// Every exported function is pure and covered by test/scan-dart.test.mjs.
//
// Usage:
//   node scripts/scan-dart.mjs <path> [--json] [--top N] [--include-generated]
//
// Exit code is 0 whether or not signals were found. This is a measuring tool,
// not a gate.

import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// --- thresholds --------------------------------------------------------------
// Each one matches a rule in SKILL.md > Step 2. They are reporting thresholds
// for where to look, not limits anyone must obey; a project convention wins.

// SKILL.md flags a build() over roughly 40 lines as worth splitting.
export const BUILD_LINES = 40;

// A function past this length rarely holds one level of abstraction.
export const FUNCTION_LINES = 30;

// SKILL.md sets roughly two levels of nesting as the ceiling; 3 is the first
// depth worth reporting.
export const NESTING_DEPTH = 3;

// SKILL.md allows at most 3 positional parameters.
export const POSITIONAL_PARAMS = 3;

// A Dart file past this length usually holds more than one concept.
export const FILE_LINES = 400;

// A widget class this short, with no state and no reuse, is over-extraction
// rather than a named concept — SKILL.md > Flutter, the counterweight rule.
export const TRIVIAL_WIDGET_LINES = 5;

// Six repeated lines is long enough that copy-paste is the likely explanation
// and short enough to catch a duplicated widget subtree.
export const DUPLICATE_WINDOW = 6;

// A repeated block of near-identical punctuation says nothing. Require some
// real content before calling a window duplication.
const DUPLICATE_MIN_DISTINCT_LINES = 3;
const DUPLICATE_MIN_CHARS = 80;

export const GENERATED_SUFFIXES = [
  '.g.dart',
  '.freezed.dart',
  '.mocks.dart',
  '.config.dart',
  '.gr.dart',
  '.gen.dart',
  '.pb.dart',
  '.pbenum.dart',
  '.pbjson.dart',
  '.pbserver.dart',
];

const GENERATED_HEADER = /GENERATED CODE|DO NOT MODIFY BY HAND|dart format width|AUTO GENERATED/i;

const SKIP_DIRS = new Set([
  '.git',
  '.dart_tool',
  '.idea',
  'build',
  'ios',
  'android',
  'macos',
  'windows',
  'linux',
  'node_modules',
]);

// Disposables that must have a matching dispose() — SKILL.md > lifecycle symmetry.
const DISPOSABLE = /\b(TextEditingController|ScrollController|AnimationController|PageController|TabController|FocusNode|StreamController|StreamSubscription)\b|\.listen\s*\(/;

// --- source cleaning ---------------------------------------------------------
// Blank out comments and string literals while preserving length and newlines,
// so every offset still maps to its original line and brace counting is safe.
export function blankNonCode(source) {
  const out = source.split('');
  const len = source.length;
  let i = 0;

  const blankTo = (end) => {
    for (let k = i; k < end && k < len; k += 1) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  while (i < len) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      let end = source.indexOf('\n', i);
      if (end === -1) end = len;
      blankTo(end);
      i = end;
      continue;
    }

    if (two === '/*') {
      let end = source.indexOf('*/', i + 2);
      end = end === -1 ? len : end + 2;
      blankTo(end);
      i = end;
      continue;
    }

    const char = source[i];
    if (char === '"' || char === "'") {
      const triple = source.slice(i, i + 3);
      const isTriple = triple === '"""' || triple === "'''";
      const quote = isTriple ? triple : char;
      let j = i + quote.length;
      while (j < len) {
        if (source[j] === '\\' && !isTriple) {
          j += 2;
          continue;
        }
        if (source.slice(j, j + quote.length) === quote) {
          j += quote.length;
          break;
        }
        j += 1;
      }
      blankTo(j);
      i = j;
      continue;
    }

    i += 1;
  }

  return out.join('');
}

export const lineOf = (source, index) => {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
};

// --- structure extraction ----------------------------------------------------
function matchBraces(code) {
  const pairs = new Map();
  const stack = [];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === '{') stack.push(i);
    else if (code[i] === '}' && stack.length > 0) pairs.set(stack.pop(), i);
  }
  return pairs;
}

function matchParens(code) {
  const close = new Map();
  const stack = [];
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] === '(') stack.push(i);
    else if (code[i] === ')' && stack.length > 0) close.set(i, stack.pop());
  }
  return close;
}

// Counts parameters declared positionally, i.e. outside the {named} and
// [optional] groups.
export function countPositional(paramText) {
  let depth = 0;
  let positional = '';
  for (const char of paramText) {
    if (char === '{' || char === '[' || char === '<' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === '>' || char === ')') depth -= 1;
    else if (depth === 0) positional += char;
    if (depth < 0) depth = 0;
  }
  return positional.split(',').map((p) => p.trim()).filter(Boolean).length;
}

function maxNesting(code, start, end) {
  let depth = 0;
  let max = 0;
  for (let i = start; i <= end && i < code.length; i += 1) {
    if (code[i] === '{') {
      depth += 1;
      if (depth > max) max = depth;
    } else if (code[i] === '}') {
      depth -= 1;
    }
  }
  // The function's own body brace is depth 1, so it does not count as nesting.
  return Math.max(0, max - 1);
}

export function findFunctions(source, code = blankNonCode(source)) {
  const braces = matchBraces(code);
  const close = matchParens(code);
  const functions = [];

  for (const [open, end] of braces) {
    // Walk back over whitespace and the async/sync modifiers to the ')'.
    let k = open - 1;
    while (k >= 0 && /\s/.test(code[k])) k -= 1;
    for (const word of ['async*', 'sync*', 'async']) {
      if (code.slice(k - word.length + 1, k + 1) === word) {
        k -= word.length;
        while (k >= 0 && /\s/.test(code[k])) k -= 1;
        break;
      }
    }
    if (code[k] !== ')') continue;

    const paramOpen = close.get(k);
    if (paramOpen === undefined) continue;

    // The identifier immediately before '(' is the function or constructor name.
    let n = paramOpen - 1;
    while (n >= 0 && /\s/.test(code[n])) n -= 1;
    const nameEnd = n + 1;
    while (n >= 0 && /[\w$]/.test(code[n])) n -= 1;
    const name = code.slice(n + 1, nameEnd);
    if (!name || /^(if|for|while|switch|catch|return)$/.test(name)) continue;

    const startLine = lineOf(source, open);
    const endLine = lineOf(source, end);
    const params = code.slice(paramOpen + 1, k);

    functions.push({
      name,
      line: startLine,
      length: endLine - startLine + 1,
      nesting: maxNesting(code, open, end),
      positional: countPositional(params),
      // SKILL.md > Functions: a bool parameter that switches behaviour should be
      // two named functions. Properties named isX/hasX/canX configure rather
      // than branch, so they are excluded.
      boolParams: (params.match(/\bbool\s+(?!is[A-Z]|has[A-Z]|can[A-Z])[\w$]+/g) ?? []).length,
    });
  }

  return functions.sort((a, b) => a.line - b.line);
}

export function findStateClasses(source, code = blankNonCode(source)) {
  const braces = matchBraces(code);
  const results = [];
  const re = /class\s+([\w$]+)[^{;]*\bextends\s+(?:State|ConsumerState)\s*</g;
  let match;

  while ((match = re.exec(code)) !== null) {
    const open = code.indexOf('{', match.index);
    if (open === -1) continue;
    const end = braces.get(open);
    if (end === undefined) continue;

    const body = code.slice(open, end);
    if (!DISPOSABLE.test(body)) continue;
    if (/\bvoid\s+dispose\s*\(/.test(body)) continue;

    results.push({
      name: match[1],
      line: lineOf(source, match.index),
      evidence: (source.slice(open, end).match(DISPOSABLE) ?? ['a disposable'])[0].trim(),
    });
  }

  return results;
}

// SKILL.md > Flutter: extraction has a floor as well as a ceiling. A stateless
// widget class of a few lines, used once, is a name where none was needed.
export function findTrivialWidgets(source, code = blankNonCode(source)) {
  const braces = matchBraces(code);
  const results = [];
  const re = /class\s+([\w$]+)\s+extends\s+StatelessWidget\s*\{/g;
  let match;

  while ((match = re.exec(code)) !== null) {
    const open = code.indexOf('{', match.index);
    const end = braces.get(open);
    if (end === undefined) continue;

    const name = match[1];
    const build = findFunctions(source, code).find(
      (f) => f.name === 'build' && f.line >= lineOf(source, open) && f.line <= lineOf(source, end),
    );
    if (!build || build.length > TRIVIAL_WIDGET_LINES) continue;

    // Used once means: the class name appears once as a declaration and once as
    // a call site. More than that is genuine reuse and not over-extraction.
    const uses = (code.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
    if (uses > 2) continue;

    results.push({ name, line: lineOf(source, match.index), buildLines: build.length });
  }

  return results;
}

export function isGenerated(path, source) {
  if (GENERATED_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  return GENERATED_HEADER.test(source.split(/\r?\n/).slice(0, 20).join('\n'));
}

function lineMatches(source, regex) {
  const hits = [];
  source.split(/\r?\n/).forEach((text, index) => {
    if (regex.test(text)) hits.push({ line: index + 1, text: text.trim().slice(0, 90) });
  });
  return hits;
}

// --- duplication -------------------------------------------------------------
// Comments and string literals are already blanked, so two subtrees that differ
// only in their labels still match. That is deliberate: a copy-pasted widget
// with different text is the same duplication.
export function normaliseLines(code) {
  const out = [];
  code.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length > 0) out.push({ line: index + 1, text });
  });
  return out;
}

function windowIsSubstantial(texts) {
  if (new Set(texts).size < DUPLICATE_MIN_DISTINCT_LINES) return false;
  if (texts.join('').length < DUPLICATE_MIN_CHARS) return false;
  return texts.some((t) => /[A-Za-z]{3}/.test(t));
}

/**
 * Finds blocks of `windowSize` or more consecutive normalised lines that appear
 * in more than one place. Takes [{ path, lines: normaliseLines(...) }].
 */
export function findDuplication(files, windowSize = DUPLICATE_WINDOW) {
  const windows = new Map();

  files.forEach((file, fileIndex) => {
    for (let i = 0; i + windowSize <= file.lines.length; i += 1) {
      const texts = file.lines.slice(i, i + windowSize).map((l) => l.text);
      if (!windowIsSubstantial(texts)) continue;
      const key = texts.join('\n');
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key).push({ fileIndex, index: i, line: file.lines[i].line });
    }
  });

  // Pass one: grow every candidate to its full length, without claiming lines yet.
  const candidates = [];
  for (const [, occurrences] of windows) {
    if (occurrences.length < 2) continue;

    // Extend while every occurrence keeps matching, so a 20-line copy is one
    // block rather than fifteen overlapping windows.
    let length = windowSize;
    for (;;) {
      const next = occurrences.map((o) => files[o.fileIndex].lines[o.index + length]?.text);
      if (next.some((t) => t === undefined) || new Set(next).size !== 1) break;
      length += 1;
    }

    candidates.push({ length, occurrences });
  }

  // Pass two: biggest first, and a block is dropped when any of its occurrences
  // overlaps ground an earlier block already claimed. Without this, the same
  // copy-paste is reported once per starting offset.
  candidates.sort(
    (a, b) =>
      b.length * b.occurrences.length - a.length * a.occurrences.length ||
      a.occurrences[0].index - b.occurrences[0].index,
  );

  const covered = files.map(() => new Set());
  const blocks = [];

  for (const candidate of candidates) {
    const overlaps = candidate.occurrences.some((o) => {
      for (let k = 0; k < candidate.length; k += 1) {
        if (covered[o.fileIndex].has(o.index + k)) return true;
      }
      return false;
    });
    if (overlaps) continue;

    for (const o of candidate.occurrences) {
      for (let k = 0; k < candidate.length; k += 1) covered[o.fileIndex].add(o.index + k);
    }

    blocks.push({
      lines: candidate.length,
      occurrences: candidate.occurrences.map((o) => ({ path: files[o.fileIndex].path, line: o.line })),
    });
  }

  return blocks;
}

// --- per-file scan -----------------------------------------------------------
export function scanFile(path, source = readFileSync(path, 'utf8'), { includeGenerated = false } = {}) {
  const generated = isGenerated(path, source);
  if (generated && !includeGenerated) return { path, generated: true, skipped: true };

  const code = blankNonCode(source);
  const functions = findFunctions(source, code);
  const build = functions.find((f) => f.name === 'build') ?? null;

  return {
    path,
    generated,
    skipped: false,
    lines: source.split(/\r?\n/).length,
    normalised: normaliseLines(code),
    build: build && build.length > BUILD_LINES ? build : null,
    builderMethods: functions
      .filter((f) => /^_build[\w$]*$/.test(f.name))
      .map((f) => ({ name: f.name, line: f.line, length: f.length })),
    longFunctions: functions
      .filter((f) => f.length > FUNCTION_LINES && f.name !== 'build')
      .map((f) => ({ name: f.name, line: f.line, length: f.length })),
    deepNesting: functions
      .filter((f) => f.nesting >= NESTING_DEPTH)
      .map((f) => ({ name: f.name, line: f.line, nesting: f.nesting })),
    manyPositional: functions
      .filter((f) => f.positional > POSITIONAL_PARAMS)
      .map((f) => ({ name: f.name, line: f.line, positional: f.positional })),
    boolFlagParams: functions
      .filter((f) => f.boolParams > 0 && f.name !== 'build')
      .map((f) => ({ name: f.name, line: f.line, count: f.boolParams })),
    missingDispose: findStateClasses(source, code),
    trivialWidgets: findTrivialWidgets(source, code),
    // A literal number or ARGB colour sitting inside a layout constructor.
    magicLiterals: lineMatches(
      source,
      /(EdgeInsets\.\w+\(\s*\d|Duration\(\s*\w+:\s*\d|Color\(0x|SizedBox\((width|height):\s*\d{2,})/,
    ),
    lateFields: lineMatches(source, /^\s*late\s+(?!final\b)/),
    bareCatch: lineMatches(source, /\bcatch\s*\(\s*[\w$]+\s*\)/),
    // A collection field compared with == compares by identity, so two equal
    // lists are never equal — SKILL.md > Classes, the listEquals rule.
    collectionEquality: lineMatches(source, /other\.\w+\s*==\s*\w+.*\b(items|list|values|entries|tags|ids)\b/i),
    ownerlessTodo: lineMatches(source, /\/\/\s*TODO(?!\s*\()/i),
    commentedOutCode: lineMatches(source, /^\s*\/\/\s*[\w$]+.*[;{)]\s*$/),
  };
}

export function signalCount(file) {
  return (
    (file.build ? 1 : 0) +
    (file.lines > FILE_LINES ? 1 : 0) +
    file.longFunctions.length +
    file.deepNesting.length +
    file.manyPositional.length +
    file.boolFlagParams.length +
    file.missingDispose.length +
    file.trivialWidgets.length +
    file.builderMethods.length +
    file.magicLiterals.length +
    file.lateFields.length +
    file.bareCatch.length +
    file.collectionEquality.length +
    file.ownerlessTodo.length +
    file.commentedOutCode.length
  );
}

// --- walk --------------------------------------------------------------------
export function collect(path, found = []) {
  let info;
  try {
    info = statSync(path);
  } catch {
    return found; // A path that vanished mid-walk is not worth failing over.
  }

  if (info.isFile()) {
    if (path.endsWith('.dart')) found.push(path);
    return found;
  }

  for (const entry of readdirSync(path)) {
    if (SKIP_DIRS.has(entry)) continue;
    collect(join(path, entry), found);
  }
  return found;
}

// --- main --------------------------------------------------------------------
function main(argv) {
  const asJson = argv.includes('--json');
  const includeGenerated = argv.includes('--include-generated');
  const topIndex = argv.indexOf('--top');
  const top = topIndex === -1 ? 15 : Number.parseInt(argv[topIndex + 1], 10) || 15;
  // The value after --top is a count, not the path being scanned.
  const topValue = topIndex === -1 ? null : argv[topIndex + 1];
  const target = resolve(argv.find((a) => !a.startsWith('--') && a !== topValue) ?? '.');

  const scanned = collect(target).map((p) => {
    try {
      return scanFile(p, undefined, { includeGenerated });
    } catch (error) {
      return { path: p, skipped: true, unreadable: error.message };
    }
  });

  const active = scanned.filter((f) => !f.skipped);
  const skipped = scanned.filter((f) => f.skipped);
  const rel = (p) => relative(target, p).replaceAll('\\', '/') || basename(p);

  const duplication = findDuplication(
    active.map((f) => ({ path: rel(f.path), lines: f.normalised })),
  );

  const ranked = active
    .map((f) => ({ ...f, signals: signalCount(f) }))
    .filter((f) => f.signals > 0)
    .sort((a, b) => b.signals - a.signals);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          target: target.replaceAll('\\', '/'),
          thresholds: {
            buildLines: BUILD_LINES,
            functionLines: FUNCTION_LINES,
            nestingDepth: NESTING_DEPTH,
            positionalParams: POSITIONAL_PARAMS,
            fileLines: FILE_LINES,
            trivialWidgetLines: TRIVIAL_WIDGET_LINES,
            duplicateWindow: DUPLICATE_WINDOW,
          },
          filesScanned: active.length,
          totalSignals: ranked.reduce((sum, f) => sum + f.signals, 0),
          signalsPerFile: active.length === 0
            ? 0
            : Number((ranked.reduce((sum, f) => sum + f.signals, 0) / active.length).toFixed(2)),
          generatedSkipped: skipped.map((f) => rel(f.path)),
          duplication,
          files: ranked.slice(0, top).map(({ normalised, ...f }) => ({ ...f, path: rel(f.path) })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`Scanned ${active.length} Dart file(s) under ${rel(target) || '.'}`);
  if (skipped.length > 0) {
    const names = skipped.slice(0, 5).map((f) => rel(f.path)).join(', ');
    console.log(`Skipped ${skipped.length} generated file(s): ${names}${skipped.length > 5 ? ', ...' : ''}`);
  }
  if (active.length > 0) {
    const total = ranked.reduce((sum, f) => sum + f.signals, 0);
    console.log(`${total} signal(s), ${(total / active.length).toFixed(1)} per file`);
  }
  console.log('');

  if (ranked.length === 0 && duplication.length === 0) {
    console.log('No signals above the reporting thresholds.');
    return 0;
  }

  for (const file of ranked.slice(0, top)) {
    console.log(`${rel(file.path)}  (${file.lines} lines, ${file.signals} signal${file.signals === 1 ? '' : 's'})`);

    if (file.lines > FILE_LINES) console.log(`  file        ${file.lines} lines, over ${FILE_LINES}`);
    if (file.build) console.log(`  build()     line ${file.build.line}, ${file.build.length} lines, over ${BUILD_LINES}`);

    for (const f of file.longFunctions) console.log(`  long fn     ${f.name}() line ${f.line}, ${f.length} lines`);
    for (const f of file.deepNesting) console.log(`  nesting     ${f.name}() line ${f.line}, depth ${f.nesting}`);
    for (const f of file.manyPositional) console.log(`  params      ${f.name}() line ${f.line}, ${f.positional} positional`);
    for (const f of file.boolFlagParams) console.log(`  bool flag   ${f.name}() line ${f.line}, ${f.count} bool parameter${f.count === 1 ? '' : 's'} — consider two functions`);
    for (const f of file.builderMethods) console.log(`  _build      ${f.name}() line ${f.line}, ${f.length} lines — consider a widget class`);
    for (const w of file.trivialWidgets) console.log(`  tiny widget ${w.name} line ${w.line}, ${w.buildLines}-line build(), used once — possible over-extraction`);
    for (const c of file.missingDispose) console.log(`  dispose     ${c.name} line ${c.line} creates ${c.evidence} with no dispose()`);
    for (const m of file.lateFields) console.log(`  late        line ${m.line}: ${m.text}`);
    for (const m of file.bareCatch) console.log(`  catch       line ${m.line}: ${m.text}`);
    for (const m of file.collectionEquality) console.log(`  == on list  line ${m.line}: ${m.text}`);
    for (const m of file.magicLiterals) console.log(`  literal     line ${m.line}: ${m.text}`);
    for (const m of file.ownerlessTodo) console.log(`  todo        line ${m.line}: ${m.text}`);
    for (const m of file.commentedOutCode) console.log(`  dead code   line ${m.line}: ${m.text}`);

    console.log('');
  }

  if (ranked.length > top) {
    console.log(`${ranked.length - top} more file(s) with signals, not listed. Raise --top to see them.`);
    console.log('');
  }

  if (duplication.length > 0) {
    console.log(`Repeated blocks (${DUPLICATE_WINDOW}+ lines, comments and string literals ignored):`);
    for (const block of duplication.slice(0, top)) {
      const where = block.occurrences.map((o) => `${o.path}:${o.line}`).join('  ');
      console.log(`  ${block.lines} lines x${block.occurrences.length}   ${where}`);
    }
    console.log('');
    console.log('A repeated block is duplication of shape. Whether it is duplication of');
    console.log('knowledge — the same rule written twice — is the judgment the report makes.');
    console.log('');
  }

  console.log('Signals are where to look, not what to report. Judge each one against the code.');
  return 0;
}

// Node resolves a module specifier to its real path, so `import.meta.url` never carries the
// symlink or junction it was reached through — but `process.argv[1]` carries it verbatim. An
// installed skill is usually reached through such a link, and comparing the two raw would make
// this file import cleanly and then run nothing at all: exit 0, no output, no measurements.
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
