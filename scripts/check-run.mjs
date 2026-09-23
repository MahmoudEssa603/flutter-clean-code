#!/usr/bin/env node
// Checks that one measured run happened in the environment it was meant to, from its transcript,
// and records who ran it and what it cost. It says nothing about the answer. Grading is separate.
//
// A WITH run has to have loaded the skill from the evaluation install, and every scanner it
// executed has to be that install's. SKILL.md tells a run that cannot find its own folder to
// search ~/.claude/skills first, and in the 1.7.0 layout that path holds the stable release. A run
// that fell back there would measure the wrong scanner and look entirely normal doing it. At 1.6.0,
// 02 and 09 wrote the ~ path literally and 07 and 13 went through a shell variable, so paths are
// resolved, not pattern-matched. A WITHOUT run must show no trace of the skill at all.
//
// Transcript fields are internal to the host and not a stable format, so anything this cannot
// read is reported as unknown, never guessed. A run with an unresolved scanner path is not valid
// until someone resolves it by hand.
//
// Node built-ins only: no install step, no network, no dependencies.
// Usage: node scripts/check-run.mjs <transcript.jsonl> [<more.jsonl> ...]
//          --condition with|implicit|without [--install <dir>] [--home <dir>] [--json] [--quiet]
//   with       the query named the skill, so it must have loaded, from the install
//   implicit   the query did not name it (04, 17): loading is the outcome being measured, not a
//              condition of validity, but if it loaded it must be the install, and so its scanner
//   without    the skill was not installed, and no trace of it may appear
//   --install  the evaluation install (required for with and implicit)
//   --home     what ~ expands to in the run (default: this user's home directory)
//   --json     print the record as JSON, for the run's result file
// Exit code 0 = the run is valid for its condition, 1 = it is not, or it cannot be told.

import { readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const SKILL = 'flutter-clean-code';

// Windows, Git Bash and PowerShell all spell one path differently: C:\x, c:/x, /c/x. Everything
// is compared in one spelling, lower-cased, because Windows paths are case-insensitive.
export function normalisePath(path) {
  let p = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  const bash = /^\/([a-zA-Z])(\/|$)/.exec(p);
  if (bash) p = `${bash[1]}:/${p.slice(3)}`;
  return p.replace(/\/$/, '').toLowerCase();
}

function joinPath(base, rel) {
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(rel)) return rel;
  const parts = normalisePath(base).split('/');
  for (const seg of rel.replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, '$2');

// Variable assignments in the shells a run uses: VAR=x, export VAR=x, $VAR = 'x', $env:VAR = 'x'.
function assignments(command) {
  const found = [];
  const re = /(?:^|[\s;&|(])(?:export\s+)?(\$(?:env:)?)?([A-Za-z_][A-Za-z0-9_]*)\s*(=)\s*("[^"]*"|'[^']*'|[^\s;&|)]+)/g;
  for (const m of command.matchAll(re)) {
    // A bare NAME=value is bash only when there is no space around the sign.
    if (!m[1] && /\s=|=\s/.test(m[0].slice(m[0].indexOf(m[2])))) continue;
    found.push([m[2], unquote(m[4])]);
  }
  return found;
}

/**
 * Resolves one scanner path as the run's shell would have seen it.
 *
 * Returns an absolute, normalised path, or null when it cannot be done mechanically. Null is a
 * result, not a failure: the run is then held for a person to resolve.
 */
export function resolveScannerPath(raw, { cwd, home, vars }) {
  let p = unquote(raw);
  let unresolved = false;
  p = p.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$env:([A-Za-z_][A-Za-z0-9_]*)|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, a, b, c) => {
    const name = a ?? b ?? c;
    if (name === 'HOME' || name === 'USERPROFILE') return home;
    if (!vars.has(name)) {
      unresolved = true;
      return '';
    }
    return vars.get(name);
  });
  if (unresolved || p.includes('$') || p.includes('%')) return null;
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) p = home + p.slice(1);
  if (!cwd && !/^([a-zA-Z]:[\\/]|[\\/])/.test(p)) return null;
  return normalisePath(joinPath(cwd ?? '', p));
}

// Only an executed scanner counts, so the path has to follow `node`. Listing or reading the file
// is not running it.
const SCANNER_CALL = /\bnode(?:\.exe)?["']?\s+(?:--?[\w-]+\s+)*("[^"]*scan-dart\.mjs"|'[^']*scan-dart\.mjs'|[^\s;&|'"]*scan-dart\.mjs)/g;

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
}

export function readTranscript(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Everything the record needs from a run's transcript lines, and whether the run is valid.
 */
// What the host says in a run's own voice when the account has no quota left. Matched on the
// shape rather than the wording, which differs between the session limit and the weekly one.
const RAN_OUT_OF_QUOTA = /\byou'?ve hit your (?:session|weekly|usage) limit\b|\busage limit reached\b|\brate.?limit(?:ed)? exceeded\b/i;

export function checkRun(entries, { condition, install = null, home = homedir() }) {
  const problems = [];
  const held = [];
  const firstWith = (key) => entries.find((e) => e[key] !== undefined)?.[key] ?? null;

  const assistants = entries.filter((e) => e.type === 'assistant' && e.message);
  // `<synthetic>` marks a message the host wrote itself, such as an interruption notice. It is
  // not a model, and 02 at 1.6.0 carried one.
  const models = [...new Set(assistants.map((e) => e.message.model).filter((m) => m && m !== '<synthetic>'))];
  const stamps = entries.map((e) => e.timestamp).filter(Boolean).sort();

  // One API message is written as several lines, one per content block, each repeating the usage.
  // Summing lines would count it several times, so the last line of each message id is taken.
  const usageById = new Map();
  for (const e of assistants) if (e.message.usage) usageById.set(e.message.id ?? e.uuid, e.message.usage);
  const usage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, thinking: 0 };
  for (const u of usageById.values()) {
    usage.input += u.input_tokens ?? 0;
    usage.cacheCreation += u.cache_creation_input_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    usage.thinking += u.output_tokens_details?.thinking_tokens ?? 0;
  }

  const toolUses = [];
  // A run has to end by answering. An interactive session that was interrupted, or a headless one
  // that died, stops after its last tool call with nothing said: at 1.6.0 no check would have
  // caught that, and one calibration run was recorded valid having produced no report at all.
  let lastToolIndex = -1;
  let answerChars = 0;
  let answer = '';
  assistants.forEach((e, index) => {
    for (const c of Array.isArray(e.message.content) ? e.message.content : []) {
      if (c.type === 'tool_use') {
        toolUses.push({ entry: e, name: c.name, input: c.input ?? {} });
        lastToolIndex = index;
      }
      if (c.type === 'text' && index > lastToolIndex) {
        answerChars += c.text.length;
        answer += c.text;
      }
    }
  });

  // --- did the skill load, and from where ------------------------------------------------
  const userTexts = entries.filter((e) => e.type === 'user').map((e) => textOf(e.message?.content));
  const skillCalls = toolUses.filter((t) => t.name === 'Skill' && String(t.input.skill ?? '').includes(SKILL));
  const slashInvoked = userTexts.some((t) => t.includes(`<command-name>/${SKILL}</command-name>`));
  const baseDirs = [...new Set(
    userTexts.flatMap((t) => [...t.matchAll(/Base directory for this skill:\s*(\S+)/g)].map((m) => m[1]))
      .filter((d) => normalisePath(d).endsWith(`/${SKILL}`)),
  )];
  const loaded = skillCalls.length > 0 || slashInvoked || baseDirs.length > 0;

  // --- every scanner the run executed ---------------------------------------------------
  const vars = new Map();
  const scanners = [];
  for (const t of toolUses) {
    const command = typeof t.input.command === 'string' ? t.input.command : null;
    if (!command) continue;
    // Assignments before the call in the same command count, so read them in order.
    let cwd = t.entry.cwd ?? null;
    for (const segment of command.split(/&&|;|\n|\|\|/)) {
      for (const [name, value] of assignments(segment)) {
        vars.set(name, value.startsWith('~') ? home + value.slice(1) : value);
      }
      const cd = /^\s*(?:cd|Set-Location|sl|pushd)\s+(?:-Path\s+)?("[^"]*"|'[^']*'|\S+)\s*$/i.exec(segment);
      if (cd) {
        const target = resolveScannerPath(cd[1], { cwd, home, vars });
        cwd = target;
      }
      for (const m of segment.matchAll(SCANNER_CALL)) {
        const resolved = resolveScannerPath(m[1], { cwd, home, vars });
        scanners.push({ raw: unquote(m[1]), resolved });
      }
    }
  }

  const references = [...new Set(
    toolUses
      .filter((t) => t.name === 'Read' && /[\\/]references[\\/][^\\/]+\.md$/.test(String(t.input.file_path ?? '')))
      .map((t) => String(t.input.file_path).split(/[\\/]/).pop()),
  )].sort();

  // --- the verdict --------------------------------------------------------------------------
  if (models.length > 1) problems.push(`more than one model answered: ${models.join(', ')}`);
  if (answerChars === 0) {
    problems.push('the run said nothing after its last tool call: it was interrupted or it died');
  }
  // The other way a run stops without happening: the account ran out of quota and the host said so
  // in the run's own voice. Every other check passes such a run — the skill loaded, no forbidden
  // scanner ran — and fifteen of them in one sweep would read as fifteen measurements.
  if (RAN_OUT_OF_QUOTA.test(answer)) {
    problems.push(`the run stopped on a usage limit, so nothing was measured: ${answer.trim().slice(0, 80)}`);
  }
  if (condition === 'with' || condition === 'implicit') {
    const target = normalisePath(install);
    if (!loaded && condition === 'with') problems.push('the skill never loaded: no Skill call, no slash command, no base directory');
    for (const dir of baseDirs) {
      if (normalisePath(dir) !== target) problems.push(`the host loaded the skill from ${dir}, not the evaluation install`);
    }
    for (const s of scanners) {
      if (s.resolved === null) held.push(`scanner path "${s.raw}" cannot be resolved mechanically; resolve it by hand`);
      else if (s.resolved !== `${target}/scripts/scan-dart.mjs`) {
        problems.push(`a scanner outside the evaluation install ran: ${s.raw} → ${s.resolved}`);
      }
    }
  } else {
    if (loaded) problems.push('the skill loaded in a WITHOUT run');
    const said = assistants.map((e) => textOf(e.message.content)).join('\n');
    if (/\bCC-\d{3}\b/.test(said)) problems.push('a CC- finding id appears in a WITHOUT run');
    if (/Flutter Clean Code/i.test(said)) problems.push('"Flutter Clean Code" appears in a WITHOUT run');
    if (scanners.length > 0) problems.push('the skill\'s scanner ran in a WITHOUT run');
  }

  return {
    condition,
    valid: problems.length === 0 && held.length === 0,
    problems,
    held,
    identity: {
      sessionId: firstWith('sessionId'),
      models,
      version: firstWith('version'),
      entrypoint: firstWith('entrypoint'),
      // Effort changes the answer and its cost as much as the model does. Every graded 1.6.0 run
      // was at xhigh; a run at another level is not comparable with them.
      effort: [...new Set(entries.map((e) => e.effort).filter(Boolean))],
      cwd: firstWith('cwd'),
      started: stamps[0] ?? null,
      ended: stamps.at(-1) ?? null,
    },
    skill: { loaded, skillCalls: skillCalls.length, slashInvoked, baseDirs },
    answerChars,
    scanners,
    references,
    cost: {
      ...usage,
      apiMessages: usageById.size,
      toolCalls: toolUses.length,
      wallSeconds: stamps.length > 1 ? Math.round((Date.parse(stamps.at(-1)) - Date.parse(stamps[0])) / 1000) : null,
    },
  };
}

const FLAGS = ['--condition', '--install', '--home', '--json', '--quiet'];
const VALUED = ['--condition', '--install', '--home'];

function main(argv) {
  // A flag this script does not know is refused before anything runs, as in every maintenance
  // script here: an ignored flag runs the default, and a default verdict is a wrong one.
  const unknownFlags = argv.filter((a) => a.startsWith('--') && !FLAGS.includes(a));
  if (unknownFlags.length > 0) {
    console.error(`unknown flag ${unknownFlags.join(', ')}; this script takes ${FLAGS.join(' ')}`);
    return 1;
  }
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const valueIndexes = new Set(VALUED.filter((f) => argv.includes(f)).map((f) => argv.indexOf(f) + 1));
  const paths = argv.filter((a, i) => !a.startsWith('--') && !valueIndexes.has(i));

  const condition = value('--condition');
  const install = value('--install');
  if (paths.length === 0 || !['with', 'implicit', 'without'].includes(condition)) {
    console.error('usage: node scripts/check-run.mjs <transcript.jsonl> [...] --condition with|implicit|without [--install <dir>] [--home <dir>] [--json] [--quiet]');
    return 1;
  }
  if (condition !== 'without' && !install) {
    console.error(`--condition ${condition} needs --install <dir>: the evaluation install the run must use`);
    return 1;
  }

  let entries = [];
  for (const path of paths) {
    try {
      entries = entries.concat(readTranscript(readFileSync(path, 'utf8')));
    } catch (error) {
      console.error(`${path}: cannot read — ${error.message}`);
      return 1;
    }
  }

  const record = checkRun(entries, { condition, install, home: value('--home') ?? homedir() });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(record, null, 2));
  } else if (!argv.includes('--quiet') || !record.valid) {
    console.log(`${record.valid ? '✓ valid' : '✗ not valid'} — ${condition.toUpperCase()} run, ${record.identity.models.join(', ') || 'model unknown'}, version ${record.identity.version ?? 'unknown'}`);
    for (const p of record.problems) console.log(`    ${p}`);
    for (const h of record.held) console.log(`    held: ${h}`);
    for (const s of record.scanners) console.log(`    scanner: ${s.raw} → ${s.resolved ?? 'unresolved'}`);
  }
  return record.valid ? 0 : 1;
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
