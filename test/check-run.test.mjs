// Tests for the measured-run checker.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkRun, main, normalisePath, resolveScannerPath } from '../scripts/check-run.mjs';

const HOME = 'C:\\Users\\someone';
const INSTALL = 'D:\\eval-home\\skills\\flutter-clean-code';
const STABLE = 'C:\\Users\\someone\\.claude\\skills\\flutter-clean-code';
const CWD = 'd:\\eval-runs\\01-audit-fat-widget';

// A transcript is one JSON object per line; these build the few shapes the checker reads.
let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 8, 22, 12, 0, clock++)).toISOString();
const meta = { sessionId: 's1', version: '2.1.278', entrypoint: 'cli', cwd: CWD, effort: 'xhigh' };

const user = (text) => ({ ...meta, type: 'user', timestamp: stamp(), message: { role: 'user', content: [{ type: 'text', text }] } });
const said = (id, text, usage = { input_tokens: 1, output_tokens: 10 }) => ({
  ...meta, type: 'assistant', timestamp: stamp(),
  message: { id, model: 'claude-opus-5', content: [{ type: 'text', text }], usage },
});
const tool = (id, name, input) => ({
  ...meta, type: 'assistant', timestamp: stamp(),
  message: { id, model: 'claude-opus-5', content: [{ type: 'tool_use', name, input }], usage: { input_tokens: 1, output_tokens: 5 } },
});
const bash = (id, command) => tool(id, 'Bash', { command });

const loadedFrom = (dir) => [
  user('<command-name>/flutter-clean-code</command-name> audit this'),
  user(`Base directory for this skill: ${dir}\n\n# Flutter Clean Code`),
];

const withRun = (entries) => checkRun(entries, { condition: 'with', install: INSTALL, home: HOME });
const withoutRun = (entries) => checkRun(entries, { condition: 'without', home: HOME });

test('paths from Windows, Git Bash and PowerShell compare as one', () => {
  assert.equal(normalisePath('D:\\eval-home\\skills\\'), 'd:/eval-home/skills');
  assert.equal(normalisePath('/d/eval-home/skills'), 'd:/eval-home/skills');
  assert.equal(normalisePath('d:/Eval-Home//skills'), 'd:/eval-home/skills');
});

test('a WITH run that loaded the eval install and ran its scanner is valid', () => {
  const run = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'node D:/eval-home/skills/flutter-clean-code/scripts/scan-dart.mjs lib --json'),
    said('m2', 'report'),
  ]);
  assert.deepEqual([run.problems, run.held], [[], []]);
  assert.equal(run.valid, true);
  assert.equal(run.scanners[0].resolved, 'd:/eval-home/skills/flutter-clean-code/scripts/scan-dart.mjs');
});

test('the ~ fallback lands on the stable install, and the run is discarded', () => {
  // SKILL.md's fallback searches ~/.claude/skills first, and in the 1.7.0 layout that is the stable
  // release. 02 and 09 wrote the ~ path literally at 1.6.0.
  const run = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'node ~/.claude/skills/flutter-clean-code/scripts/scan-dart.mjs lib'),
  ]);
  assert.equal(run.valid, false);
  assert.match(run.problems.join('\n'), /a scanner outside the evaluation install ran/);
  assert.equal(run.scanners[0].resolved, `${normalisePath(STABLE)}/scripts/scan-dart.mjs`);
});

test('a scanner reached through a shell variable is resolved, not trusted', () => {
  // 07 and 13 at 1.6.0 set a variable first and ran "$SKILL/scripts/scan-dart.mjs".
  const good = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'SKILL="D:/eval-home/skills/flutter-clean-code"'),
    bash('m2', 'node "$SKILL/scripts/scan-dart.mjs" lib'),
    said('m3', 'report'),
  ]);
  assert.equal(good.valid, true, good.problems.join('\n'));

  const bad = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'SD=~/.claude/skills/flutter-clean-code && node $SD/scripts/scan-dart.mjs lib'),
    said('m2', 'report'),
  ]);
  assert.equal(bad.valid, false);

  const powershell = withRun([
    ...loadedFrom(INSTALL),
    tool('m1', 'PowerShell', { command: "$s = 'C:\\Users\\someone\\.claude\\skills\\flutter-clean-code'; node \"$s\\scripts\\scan-dart.mjs\" lib" }),
    said('m2', 'report'),
  ]);
  assert.equal(powershell.valid, false);
});

test('a path that cannot be resolved holds the run for a person, never passes it', () => {
  const run = withRun([...loadedFrom(INSTALL), bash('m1', 'node "$UNSET/scripts/scan-dart.mjs" lib'), said('m2', 'report')]);
  assert.equal(run.valid, false);
  assert.deepEqual(run.problems, []);
  assert.match(run.held[0], /cannot be resolved mechanically/);
});

test('a relative scanner path is resolved from the directory the command ran in', () => {
  const inside = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'cd D:/eval-home/skills/flutter-clean-code && node scripts/scan-dart.mjs D:/eval-runs/01'),
    said('m2', 'report'),
  ]);
  assert.equal(inside.valid, true, inside.problems.join('\n'));

  const fromProject = withRun([...loadedFrom(INSTALL), bash('m1', 'node scripts/scan-dart.mjs lib'), said('m2', 'report')]);
  assert.equal(fromProject.valid, false, 'scripts/ under the project is not the install');
});

test('reading or listing the scanner is not running it', () => {
  const run = withRun([
    ...loadedFrom(INSTALL),
    bash('m1', 'ls ~/.claude/skills/flutter-clean-code/scripts/scan-dart.mjs'),
    tool('m2', 'Read', { file_path: `${STABLE}\\scripts\\scan-dart.mjs` }),
    said('m3', 'report'),
  ]);
  assert.deepEqual(run.scanners, []);
  assert.equal(run.valid, true);
});

test('a WITH run that never loaded the skill, or loaded another copy, is not valid', () => {
  assert.match(withRun([user('audit this'), said('m1', 'ok')]).problems.join('\n'), /never loaded/);
  assert.match(withRun([...loadedFrom(STABLE), said('m1', 'report')]).problems.join('\n'), /not the evaluation install/);
});

test('an implicit run may leave the skill unloaded, but not load or run another copy', () => {
  // 04 and 17 leave the skill unnamed on purpose; whether it activates is what they measure.
  const implicit = (entries) => checkRun(entries, { condition: 'implicit', install: INSTALL, home: HOME });
  assert.equal(implicit([user('clean this Python up'), said('m1', 'not Dart')]).valid, true);
  assert.equal(implicit([user('x'), user(`Base directory for this skill: ${INSTALL}`), said('m1', 'report')]).valid, true);
  assert.equal(implicit([user('x'), user(`Base directory for this skill: ${STABLE}`), said('m1', 'report')]).valid, false);
  const stableScanner = 'node ~/.claude/skills/flutter-clean-code/scripts/scan-dart.mjs lib';
  assert.equal(implicit([user('x'), bash('m1', stableScanner), said('m2', 'report')]).valid, false);
});

test('a WITHOUT run shows no trace of the skill', () => {
  assert.equal(withoutRun([user('audit this'), said('m1', 'here is my review')]).valid, true);

  const loaded = withoutRun([user('audit this'), tool('m1', 'Skill', { skill: 'flutter-clean-code' })]);
  assert.match(loaded.problems.join('\n'), /the skill loaded in a WITHOUT run/);

  const ids = withoutRun([user('audit this'), said('m1', '### CC-001 — a finding')]);
  assert.match(ids.problems.join('\n'), /CC- finding id/);

  const scanner = withoutRun([user('audit this'), bash('m1', 'node ~/.claude/skills/flutter-clean-code/scripts/scan-dart.mjs lib')]);
  assert.match(scanner.problems.join('\n'), /scanner ran in a WITHOUT run/);
});

test('a run that stopped after its last tool call is not valid', () => {
  // An interactive calibration run restarted itself after four tool calls and said nothing. It
  // was recorded valid, because every other check passed: the skill had loaded from the right
  // install and no forbidden scanner ran. A run that never answered is not a run.
  const interrupted = withRun([...loadedFrom(INSTALL), bash('m1', 'ls'), bash('m2', 'cat a.dart')]);
  assert.equal(interrupted.valid, false);
  assert.match(interrupted.problems.join(' '), /said nothing after its last tool call/);
  assert.equal(interrupted.answerChars, 0);

  const answered = withRun([...loadedFrom(INSTALL), bash('m1', 'ls'), said('m2', '# Clean Code — AUDIT')]);
  assert.equal(answered.valid, true, answered.problems.join(' '));
  assert.ok(answered.answerChars > 0);
});

test('usage counts each API message once, although the transcript repeats it per block', () => {
  const usage = { input_tokens: 3, cache_read_input_tokens: 100, output_tokens: 40, output_tokens_details: { thinking_tokens: 7 } };
  const run = withoutRun([
    user('audit this'),
    said('m1', 'part one', usage),
    said('m1', 'part two', usage),
    said('m2', 'next', { input_tokens: 1, output_tokens: 2 }),
  ]);
  assert.equal(run.cost.apiMessages, 2);
  assert.equal(run.cost.input, 4);
  assert.equal(run.cost.cacheRead, 100);
  assert.equal(run.cost.output, 42);
  assert.equal(run.cost.thinking, 7);
});

test('identity comes from the transcript, and a host-written message is not a model', () => {
  const synthetic = { ...said('m9', 'interrupted'), message: { ...said('m9', 'x').message, model: '<synthetic>' } };
  const run = withoutRun([user('audit this'), said('m1', 'ok'), synthetic]);
  assert.deepEqual(run.identity.models, ['claude-opus-5']);
  assert.equal(run.identity.version, '2.1.278');
  assert.equal(run.identity.entrypoint, 'cli');
  assert.deepEqual(run.identity.effort, ['xhigh']);
});

test('the command line refuses unknown flags and a WITH check with no install', () => {
  assert.equal(main(['run.jsonl', '--condition', 'with', '--install', INSTALL, '--strict']), 1);
  assert.equal(main(['run.jsonl', '--condition', 'with']), 1);
  assert.equal(main(['run.jsonl', '--condition', 'maybe']), 1);
});

test('a run that stopped on a usage limit is not a run, however well it started', () => {
  // Fifteen runs of one sweep came back holding nothing but "You've hit your session limit ·
  // resets 6pm (Africa/Cairo)", and one of them was recorded valid: the skill had loaded from the
  // right install, no forbidden scanner had run, and it had said something, so the
  // said-nothing rule did not fire either.
  const entries = [
    user('/flutter-clean-code review this file'),
    ...loadedFrom(INSTALL),
    said('a1', "I'll start by looking at what's in the working directory."),
    bash('t1', `node ${INSTALL}\\scripts\\scan-dart.mjs lib`),
    said('a2', "You've hit your session limit · resets 6pm (Africa/Cairo)"),
  ];

  const result = withRun(entries);
  assert.equal(result.valid, false);
  assert.match(result.problems.join('\n'), /stopped on a usage limit, so nothing was measured/);
});

test('the weekly limit reads the same way, and an ordinary answer still passes', () => {
  const limited = [
    user('/flutter-clean-code review this file'),
    ...loadedFrom(INSTALL),
    said('a1', "You've hit your weekly limit, resets Sep 25, 8am"),
  ];
  assert.equal(withRun(limited).valid, false);

  const fine = [
    user('/flutter-clean-code review this file'),
    ...loadedFrom(INSTALL),
    bash('t1', `node ${INSTALL}\\scripts\\scan-dart.mjs lib`),
    said('a2', '# Clean Code — AUDIT — orders\n\nThe report, in full.'),
  ];
  assert.equal(withRun(fine).valid, true, 'a report that merely mentions limits is not a limit');
});
