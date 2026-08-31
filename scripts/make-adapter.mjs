#!/usr/bin/env node
// Packages this skill for an agent tool that is not Claude Code, from the one source. SKILL.md
// and references/ are never rewritten: the adapter changes the wrapper, not the instructions.
//
// What does not travel is not the frontmatter — it is that a tool either loads a rule file on
// every turn or decides from a description, and that some tools cap what a rule file may weigh.
// Each adapter states what its target does and does not give you, in the file it writes, so
// nobody has to take this on trust.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/make-adapter.mjs <tool> <target-project-dir> [--quiet]
// Exit code 0 = written, 1 = refused.

import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readSkill() {
  const raw = readFileSync(join(ROOT, 'SKILL.md'), 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') throw new Error('SKILL.md does not start with frontmatter');
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error('SKILL.md frontmatter is never closed');

  // A folded block scalar: `description: >-` then indented continuation lines.
  const head = lines.slice(1, end);
  const start = head.findIndex((l) => l.startsWith('description:'));
  if (start === -1) throw new Error('SKILL.md has no description');
  const rest = [];
  for (let i = start + 1; i < head.length; i += 1) {
    if (!/^\s/.test(head[i])) break;
    rest.push(head[i].trim());
  }
  const description = rest.join(' ').replace(/\s+/g, ' ').trim();

  return { description, body: lines.slice(end + 1).join('\n').replace(/^\n+/, '') };
}

// Cursor reads .cursor/rules/*.mdc. `alwaysApply: false` with a description and no globs is the
// mode the docs call Apply Intelligently — the agent reads the description and decides, which is
// the nearest thing any other tool has to how this skill is reached in Claude Code.
const ADAPTERS = {
  cursor: {
    label: 'Cursor',
    build({ description, body }) {
      const home = '.cursor/rules/flutter-clean-code';
      const rule = [
        '---',
        `description: ${description}`,
        'globs:',
        'alwaysApply: false',
        '---',
        '',
        body
          // The reference files ship beside the rule, so point at where they land.
          .replace(/\[references\/([\w-]+\.md)\]\(references\/\1\)/g, `[$1](@${home}/references/$1)`)
          // <skill-dir> was a placeholder for wherever Claude Code installed this. Here the
          // adapter knows the answer, so it writes it.
          .replace(/<skill-dir>\/scripts\//g, `${home}/scripts/`)
          .replace(
            /`<skill-dir>` is the directory this file was loaded from, typically\n`~\/\.claude\/skills\/flutter-clean-code`\./,
            `The scanner ships beside this rule at \`${home}/scripts/\`.`,
          )
          // One more mention, in the fallback paragraph. The path is concrete here, so the
          // placeholder would only puzzle a reader.
          .replace(/a wrong `<skill-dir>`/g, 'a wrong path'),
        '',
        '---',
        '',
        'Generated from SKILL.md by `scripts/make-adapter.mjs` — edit the source, not this file.',
        'Reached by description rather than on every turn (`alwaysApply: false`, no globs). The',
        'reference files are not inlined; they sit beside this rule and are read where a step asks',
        'for one. `allowed-tools` has no equivalent in Cursor: in Claude Code it pre-approves the',
        'scanner and the three verification commands, and here they run under whatever approval',
        'mode you have set. The commands themselves are unchanged.',
        '',
      ].join('\n');

      return {
        files: { '.cursor/rules/flutter-clean-code.mdc': rule },
        copy: {
          'references': `${home}/references`,
          'scripts/scan-dart.mjs': `${home}/scripts/scan-dart.mjs`,
        },
        // Cursor's own guidance is to keep a rule under 500 lines and split beyond that.
        advise: (written) => {
          const lines = written.split('\n').length;
          return lines > 500
            ? [`the rule is ${lines} lines; Cursor's guidance is to keep one under 500 and split beyond that`]
            : [];
        },
      };
    },
  },
};

function main(argv) {
  const quiet = argv.includes('--quiet');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const [tool, targetArg] = positional;

  if (!tool || !targetArg) {
    console.error('usage: node scripts/make-adapter.mjs <tool> <target-project-dir> [--quiet]');
    console.error(`tools: ${Object.keys(ADAPTERS).join(', ')}`);
    return 1;
  }
  const adapter = ADAPTERS[tool];
  if (!adapter) {
    console.error(`no adapter for "${tool}". Available: ${Object.keys(ADAPTERS).join(', ')}`);
    return 1;
  }

  const target = resolve(targetArg);
  const built = adapter.build(readSkill());

  for (const [relative, contents] of Object.entries(built.files)) {
    const path = join(target, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  for (const [from, to] of Object.entries(built.copy)) {
    const path = join(target, to);
    mkdirSync(dirname(path), { recursive: true });
    cpSync(join(ROOT, from), path, { recursive: true });
  }

  if (!quiet) {
    const [entry] = Object.keys(built.files);
    console.log(`${adapter.label} adapter written to ${target}`);
    console.log(`  ${entry}`);
    for (const to of Object.values(built.copy)) console.log(`  ${to}`);
    for (const warning of built.advise?.(Object.values(built.files)[0]) ?? []) {
      console.log(`\nnote: ${warning}`);
    }
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

export { ADAPTERS, readSkill, main };
