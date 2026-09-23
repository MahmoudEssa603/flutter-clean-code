#!/usr/bin/env node
// Assembles one grading dossier per scenario from a directory of run records.
//
// Grading a run means answering the scenario's own expectations from what the run produced, and
// the evidence for that is scattered: the report is in the transcript or in the workspace diff,
// the identity is in the record, what changed is on disk, and the contract check is a separate
// command. This gathers all of it into one file per scenario so the reading is reading and not
// archaeology. It decides nothing: there is no verdict anywhere in what it writes.
//
// A record directory is <records>/<scenario>/<cell>/ holding meta.json, result.json, transcript/
// and workspace.diff — whatever the runner wrote. Runners live outside this repository, because
// they are specific to one machine; this reads what they leave behind.
//
// Node built-ins only. Usage:
//   node scripts/make-dossier.mjs <records-dir> <out-dir> [--cell with-1] [--quiet]
// Exit code 0 = dossiers written, 1 = the records could not be read.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// cp437's upper half, byte 0x80 to 0xFF in order. A runner that captures a child's stdout through
// a console using the OEM code page stores an em dash as three characters; the mapping back is
// exact, and anything that does not decode is left alone.
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const BYTE_OF = new Map([...CP437_HIGH].map((ch, i) => [ch, 0x80 + i]));

export function repairCp437(text) {
  return text.replace(/[^\x00-\x7F]{2,4}/g, (run) => {
    const bytes = [];
    for (const ch of run) {
      const byte = BYTE_OF.get(ch);
      if (byte === undefined) return run;
      bytes.push(byte);
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    return decoded.includes('�') ? run : decoded;
  });
}

/**
 * What a run said last, and what it did along the way.
 *
 * Content blocks carry their own order, so a tool call clears the narration before it: collecting
 * per message counted a sentence written beside a tool call as part of the closing answer, and
 * glued it to the front of the report.
 */
export function readTranscript(jsonl) {
  const entries = jsonl
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let answer = '';
  let longest = '';
  const tools = [];
  const commands = [];
  for (const entry of entries.filter((e) => e.type === 'assistant' && e.message)) {
    for (const c of Array.isArray(entry.message.content) ? entry.message.content : []) {
      if (c.type === 'tool_use') {
        answer = '';
        tools.push(c.name);
        if (typeof c.input?.command === 'string') {
          commands.push(c.input.command.replace(/\s+/g, ' ').slice(0, 140));
        }
      }
      if (c.type === 'text') {
        answer += c.text;
        if (c.text.length > longest.length) longest = c.text;
      }
    }
  }
  return { answer, longest, tools, commands };
}

/** Files a run added or changed, and any report it wrote, read back out of a unified diff. */
export function readDiff(diff) {
  const touched = [...new Set([...diff.matchAll(/^\+\+\+ b\/(\S+)$/gm)].map((m) => m[1]))];
  let report = null;
  let writtenTo = null;
  for (const section of diff.split(/^diff --git /m).slice(1)) {
    const rel = /^\+\+\+ b\/(docs\/reviews\/\S+\.md)$/m.exec(section)?.[1];
    if (!rel) continue;
    const body = section
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
      .join('\n');
    if (!report || body.length > report.length) {
      report = body;
      writtenTo = rel;
    }
  }
  return { touched, report, writtenTo };
}

/**
 * The report, from its title onward.
 *
 * A run may say a sentence or two before it — "Here's the report." — and that preamble is the
 * reply, not the report. Left in, it pushed the header fields past the window they are read in
 * and they were reported missing from a report that had them.
 */
export function fromTitle(text) {
  const at = text.search(/^# Clean Code — /m);
  return at === -1 ? text : text.slice(at);
}

const contractOf = (file) => {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'check-report.mjs'), file], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return { passes: true, summary: /✓[^\n]*/.exec(out)?.[0] ?? 'passes', problems: [] };
  } catch (error) {
    const out = `${error.stdout ?? ''}`;
    return {
      passes: false,
      summary: /✗[^\n]*/.exec(out)?.[0] ?? 'failed',
      problems: out.split('\n').filter((l) => l.startsWith('    ')).map((l) => l.trim()),
    };
  }
};

function dossier({ scenario, spec, meta, result, run, contract, paths }) {
  const ids = [...new Set((run.report.match(/CC-\d{3}/g) ?? []))];
  const minutes =
    meta.started && meta.ended
      ? ((new Date(meta.ended) - new Date(meta.started)) / 60000).toFixed(1)
      : '?';

  return [
    `# ${scenario}`,
    '',
    `**Query:** ${spec.query ?? '—'}`,
    `**Declared mode:** ${spec.mode ?? '—'} · **Invocation:** ${spec.invocation ?? '—'} · **Files:** ${(spec.files ?? []).join(', ') || '—'}`,
    '',
    '## The run',
    '',
    '| | |',
    '|---|---|',
    `| valid (check-run) | ${meta.valid} |`,
    `| install | ${String(meta.installSha ?? '').slice(0, 7)} · ${meta.cli ?? '?'} · ${meta.model ?? '?'} · effort ${meta.effortLevel ?? '?'} |`,
    `| cost | $${(result.total_cost_usd ?? 0).toFixed(2)} · ${minutes} min |`,
    `| tools | ${Object.entries(run.tools).map(([k, v]) => `${k}×${v}`).join(', ') || 'none'} |`,
    `| report written to | ${run.writtenTo ?? 'the conversation'} |`,
    `| files it changed | ${run.touched.length ? run.touched.join(', ') : 'none'} |`,
    `| findings | ${ids.length}${ids.length ? ` (${ids[0]}..${ids[ids.length - 1]})` : ''} |`,
    `| check-report | ${contract.summary} |`,
    ...contract.problems.map((p) => `| | ${p} |`),
    '',
    '## Commands it ran',
    '',
    ...(run.commands.length ? run.commands.map((c) => `- \`${c}\``) : ['- none']),
    '',
    '## Expectations — answered from the report, not from the reply',
    '',
    ...(spec.expected_behavior ?? []).map((e, i) => `${i + 1}. [ ] ${e}`),
    '',
    '## Must not',
    '',
    ...(spec.must_not ?? []).map((e, i) => `${i + 1}. [ ] ${e}`),
    '',
    '## Where the evidence is',
    '',
    ...paths.map((p) => `- ${p}`),
    '',
  ].join('\n');
}

function main(argv) {
  const quiet = argv.includes('--quiet');
  const cellIndex = argv.indexOf('--cell');
  const cell = cellIndex === -1 ? 'with-1' : argv[cellIndex + 1];
  // With no --cell, cellIndex is -1 and cellIndex + 1 is 0 — which would drop the first path.
  const cellValue = cellIndex === -1 ? -1 : cellIndex + 1;
  const positional = argv.filter((a, i) => !a.startsWith('--') && i !== cellValue);
  const unknown = argv.filter((a) => a.startsWith('--') && a !== '--quiet' && a !== '--cell');
  if (unknown.length > 0 || positional.length !== 2) {
    console.error(`make-dossier.mjs: ${unknown.length ? `unknown flag ${unknown.join(', ')}` : 'two paths are needed'}`);
    console.error('Usage: node scripts/make-dossier.mjs <records-dir> <out-dir> [--cell with-1] [--quiet]');
    return 1;
  }

  const [records, out] = positional;
  if (!existsSync(records)) {
    console.error(`make-dossier.mjs: no such directory: ${records}`);
    return 1;
  }
  mkdirSync(out, { recursive: true });

  const index = [];
  for (const scenario of readdirSync(records).sort()) {
    const dir = join(records, scenario, cell);
    if (scenario.startsWith('.') || !statSync(join(records, scenario)).isDirectory()) continue;
    if (!existsSync(join(dir, 'transcript'))) {
      if (!quiet) console.log(`${scenario.padEnd(34)} no transcript under ${cell}, skipped`);
      continue;
    }

    const readJson = (name) => {
      try {
        return JSON.parse(readFileSync(join(dir, name), 'utf8'));
      } catch {
        return {};
      }
    };
    const meta = readJson('meta.json');
    const result = readJson('result.json');
    const specPath = join(ROOT, 'evals', `${scenario}.json`);
    const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, 'utf8')) : {};

    const transcripts = readdirSync(join(dir, 'transcript'));
    const transcript = join(dir, 'transcript', transcripts[0]);
    const read = readTranscript(readFileSync(transcript, 'utf8'));
    const diffPath = join(dir, 'workspace.diff');
    const diff = repairCp437(existsSync(diffPath) ? readFileSync(diffPath, 'utf8') : '');
    const changes = readDiff(diff);

    // A report written into the project is the deliverable; the reply is only its announcement.
    // Newer records keep the file itself, older ones only the diff it appears in.
    const writtenDir = join(dir, 'written-report');
    let written = changes.report;
    if (existsSync(writtenDir)) {
      // A re-run scenario seeds a previous report into the directory and the run writes a new one
      // beside it. The newest is the run's; the other is its input.
      const files = readdirSync(writtenDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => ({ f, at: statSync(join(writtenDir, f)).mtimeMs }))
        .sort((a, b) => b.at - a.at);
      if (files.length > 0) written = readFileSync(join(writtenDir, files[0].f), 'utf8');
    }
    const spoken = read.answer.length > read.longest.length ? read.answer : read.longest;
    const report = fromTitle(written && written.length > spoken.length ? written : spoken);

    const reportPath = join(out, `${scenario}.report.md`);
    writeFileSync(reportPath, report);

    const skillNamed = (spec.skills ?? []).length > 0;
    const contract = skillNamed
      ? contractOf(reportPath)
      : { passes: null, summary: 'not checked — this scenario never names the skill', problems: [] };

    const counts = {};
    for (const name of read.tools) counts[name] = (counts[name] ?? 0) + 1;

    writeFileSync(
      join(out, `${scenario}.md`),
      `${dossier({
        scenario,
        spec,
        meta,
        result,
        run: { report, writtenTo: changes.writtenTo, touched: changes.touched, tools: counts, commands: read.commands },
        contract,
        paths: [
          `report: \`${reportPath}\``,
          `transcript: \`${transcript}\``,
          `workspace diff: \`${diffPath}\``,
          `record: \`${dir}\``,
        ],
      })}\n`,
    );

    index.push({ scenario, valid: meta.valid ?? null, contract: contract.summary });
    if (!quiet) {
      console.log(`${scenario.padEnd(34)} valid=${String(meta.valid).padEnd(5)} ${contract.summary.slice(0, 60)}`);
    }
  }

  writeFileSync(join(out, '_index.json'), `${JSON.stringify(index, null, 1)}\n`);
  if (!quiet) console.log(`\n${index.length} dossier(s) in ${out}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
