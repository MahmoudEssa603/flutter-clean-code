// Tests for the tool adapters.
// Run: node --test test/
// Node built-ins only (node:test, node:assert) — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADAPTERS, readSkill, main } from '../scripts/make-adapter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function withCursorRule(body) {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-'));
  try {
    assert.equal(main(['cursor', dir, '--quiet']), 0);
    return body(dir, readFileSync(join(dir, '.cursor/rules/flutter-clean-code.mdc'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the description is lifted whole from SKILL.md', () => {
  const { description } = readSkill();
  assert.ok(description.length > 200, 'a folded block scalar was read as one line, not just its first');
  assert.match(description, /Do not use for non-Dart code/);
  assert.doesNotMatch(description, /\n/);
});

test('the Cursor rule carries the three fields Cursor documents, and no others', () => {
  withCursorRule((_dir, rule) => {
    const frontmatter = rule.split('---')[1];
    const keys = frontmatter
      .split('\n')
      .filter((l) => /^[a-zA-Z]/.test(l))
      .map((l) => l.split(':')[0]);
    assert.deepEqual(keys, ['description', 'globs', 'alwaysApply']);

    // alwaysApply false with a description and no globs is the mode where the agent reads the
    // description and decides — the nearest thing to how the skill is reached in Claude Code.
    assert.match(frontmatter, /alwaysApply: false/);
    assert.match(frontmatter, /^globs:\s*$/m);
  });
});

test('no placeholder from the Claude Code packaging survives', () => {
  withCursorRule((_dir, rule) => {
    assert.doesNotMatch(rule, /<skill-dir>/, 'the adapter knows where the scanner landed; say so');
    assert.doesNotMatch(rule, /~\/\.claude\/skills/);
  });
});

test('every reference link points at the copy that ships beside the rule', () => {
  withCursorRule((dir, rule) => {
    const links = [...rule.matchAll(/\]\(@([^)]+)\)/g)].map((m) => m[1]);
    assert.ok(links.length >= 5, `expected the five reference files, found ${links.length}`);
    for (const link of new Set(links)) {
      assert.ok(link.startsWith('.cursor/rules/flutter-clean-code/references/'), link);
      readFileSync(join(dir, link), 'utf8'); // throws if the adapter did not copy it
    }
  });
});

test('the scanner ships unmodified so the measurements are the same ones', () => {
  withCursorRule((dir) => {
    const shipped = readFileSync(
      join(dir, '.cursor/rules/flutter-clean-code/scripts/scan-dart.mjs'),
      'utf8',
    );
    assert.equal(shipped, readFileSync(join(ROOT, 'scripts/scan-dart.mjs'), 'utf8'));
  });
});

test('an unknown tool is refused rather than guessed at', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-'));
  try {
    assert.equal(main(['windsurf', dir, '--quiet']), 1);
    assert.ok(!('windsurf' in ADAPTERS));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
