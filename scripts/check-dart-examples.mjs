#!/usr/bin/env node
// Asks the Dart SDK whether every ```dart snippet in the model-facing markdown parses.
//
// A snippet in these files is a fragment, not a file: a class member quoted on its own, a few
// statements from inside a method, a widget tree, a catch clause without its try. So each one is
// tried under every reading a fragment can have, and it passes if the SDK parses it under one of
// them. A snippet that parses under none is a typo, and that is what this reports.
//
// It checks syntax, not meaning. A snippet naming a class that does not exist is fine here: these
// are illustrations, and resolving them would mean shipping a project to resolve them against.
//
// Node built-ins only. The one outside tool is `dart`, which ships with the Flutter SDK this
// skill is about. Without it the run says so and checks nothing — it never reports a pass.
//
// Usage: node scripts/check-dart-examples.mjs [--quiet]
// Exit code 0 = every snippet parsed, or the SDK is absent and it said so. 1 = a snippet did not.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every ```dart block in a markdown file, with the line its fence sits on. */
export function extractSnippets(markdown, path = '') {
  const lines = markdown.split('\n');
  const found = [];
  let open = null;
  let body = [];
  lines.forEach((line, index) => {
    if (open === null) {
      if (/^\s*```dart\s*$/.test(line)) {
        open = index + 1;
        body = [];
      }
      return;
    }
    if (/^\s*```\s*$/.test(line)) {
      found.push({ path, line: open, source: body.join('\n') });
      open = null;
      return;
    }
    body.push(line);
  });
  return found;
}

// `...` stands for code left out, and what fills it depends on where it sits. A body holding
// nothing but an elision becomes an empty body, which parses as a class body, a function body and
// a block alike. An elision standing where an expression belongs becomes an identifier. An
// elision alone on its line becomes a comment, because a class body and a statement list accept
// nothing else in common.
const ELIDED_LINE = '\u0000elided-line\u0000';

export function fillElisions(source) {
  return source
    .replace(/\{\s*\.\.\.\s*\}/g, '{}')
    .replace(/=>\s*\.\.\./g, '=> _elided')
    .replace(/\(\s*\.\.\.\s*\)/g, '(_elided)')
    // Set aside before the rule below, which would otherwise rewrite the comment this makes:
    // a `...` sitting before a closing brace matches wherever it is, comment included.
    .replace(/^(\s*)\.\.\.,?\s*$/gm, `$1${ELIDED_LINE}`)
    .replace(/(^|[^.])\.\.\.(?=\s*[;,)\]}])/g, '$1_elided')
    .replaceAll(ELIDED_LINE, '// ...');
}

const DIRECTIVE = /^\s*(import|export|part)\b[^\n]*$/gm;

/** The shapes a documentation fragment can have. A snippet passes under any one of them. */
export const READINGS = {
  // A whole file: directives, then declarations.
  file: (body) => `${body}\n`,
  // Members quoted out of a class, with any directives hoisted back out of it.
  member: (body) => {
    const directives = body.match(DIRECTIVE) ?? [];
    return `${directives.join('\n')}\nclass _Wrap {\n${body.replace(DIRECTIVE, '')}\n}\n`;
  },
  // Statements quoted out of a method.
  body: (body) => `void _wrap() async {\n${body}\n}\n`,
  // A catch or finally clause quoted without the try it belongs to.
  clause: (body) => `void _wrap() async {\n  try {\n${body}\n}\n`,
  // A run of expressions, the way a widget tree is quoted.
  list: (body) => {
    const commas = body
      .split('\n')
      .map((line) =>
        /[)\]'"\w]$/.test(line.trimEnd()) && !/^\s*(\/\/|@)/.test(line) ? `${line},` : line,
      )
      .join('\n');
    return `final _wrap = <Object?>[\n${commas}\n];\n`;
  },
};

/**
 * A snippet, split where a blank line separates one fragment from the next.
 *
 * A single snippet can hold a statement and an abstract declaration side by side — "here is the
 * fine version, here is the one to report" — which no single reading can parse. Each part still
 * has to parse on its own, so nothing is waved through.
 */
export function splitGroups(source) {
  return source
    .split(/\n\s*\n/)
    .map((group) => group.trim())
    .filter(Boolean);
}

/** Every file whose snippets are checked: what a run reads, and nothing else. */
export function modelFacingMarkdown(root = ROOT) {
  return [
    'SKILL.md',
    ...readdirSync(join(root, 'references'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => `references/${f}`),
  ];
}

const dartVersion = () => {
  const run = spawnSync('dart', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (run.error || run.status !== 0) return null;
  return `${run.stdout}${run.stderr}`.trim().split('\n')[0];
};

/**
 * The names of the written files the SDK could not parse.
 *
 * `dart format` parses before it formats and names the file it gave up on, so one pass over a
 * directory answers for every file in it. Formatting nothing, it writes nothing back.
 */
function unparsable(dir) {
  const run = spawnSync('dart', ['format', '--output=none', dir], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const text = `${run.stdout}${run.stderr}`;
  const failed = new Set();
  for (const line of text.split('\n')) {
    const hit = /^line \d+, column \d+ of .*[/\\]([^/\\]+\.dart):/.exec(line.trim());
    if (hit) failed.add(hit[1]);
  }
  return failed;
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const unknown = argv.filter((a) => a.startsWith('--') && a !== '--quiet');
  if (unknown.length > 0) {
    console.error(`check-dart-examples.mjs: unknown flag ${unknown.join(', ')}`);
    console.error('Usage: node scripts/check-dart-examples.mjs [--quiet]');
    return 1;
  }

  const version = dartVersion();
  if (version === null) {
    console.log('dart is not on PATH, so no snippet was checked. This is not a pass.');
    console.log('Install the Dart or Flutter SDK and run it again before tagging a release.');
    return 0;
  }

  const snippets = [];
  for (const path of modelFacingMarkdown()) {
    snippets.push(...extractSnippets(readFileSync(join(ROOT, path), 'utf8'), path));
  }

  const dir = mkdtempSync(join(tmpdir(), 'dart-snippets-'));
  try {
    // Every snippet, under every reading, as one file each: the SDK is started once for all of
    // them rather than once per file, which turns minutes into a second.
    const written = [];
    snippets.forEach((snippet, index) => {
      const groups = [fillElisions(snippet.source), ...splitGroups(fillElisions(snippet.source))];
      groups.forEach((group, part) => {
        for (const [reading, wrap] of Object.entries(READINGS)) {
          const name = `s${index}_p${part}_${reading}.dart`;
          writeFileSync(join(dir, name), wrap(group));
          written.push({ name, index, part, reading });
        }
      });
    });

    const failed = unparsable(dir);
    const parsedPart = new Set();
    for (const file of written) {
      if (!failed.has(file.name)) parsedPart.add(`${file.index}_${file.part}`);
    }

    const problems = [];
    snippets.forEach((snippet, index) => {
      if (parsedPart.has(`${index}_0`)) return; // the whole snippet parsed under some reading
      const parts = splitGroups(fillElisions(snippet.source));
      const unparsed = parts
        .map((_, part) => part + 1)
        .filter((part) => !parsedPart.has(`${index}_${part}`));
      if (unparsed.length === 0 && parts.length > 0) return; // every part parsed on its own
      problems.push({ snippet, parts: unparsed });
    });

    if (!quiet || problems.length > 0) {
      console.log(`${snippets.length} Dart snippet(s) in ${modelFacingMarkdown().length} file(s), ${version}`);
    }
    for (const problem of problems) {
      console.log(`✗ ${problem.snippet.path}:${problem.snippet.line} — no reading parses it`);
      const preview = problem.snippet.source.split('\n').slice(0, 3);
      for (const line of preview) console.log(`    ${line}`);
    }
    if (problems.length > 0) {
      console.log('');
      console.log('A snippet is tried as a file, as class members, as statements, as a clause and');
      console.log('as a list of expressions, whole and then part by part. One that parses as none');
      console.log('of those has a syntax error in it.');
      return 1;
    }
    if (!quiet) console.log('Every snippet parses.');
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
