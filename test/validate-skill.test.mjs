// Integration tests for the contract validator.
// Each test copies the repository to a temp directory, breaks one thing, and
// asserts the validator catches it. A validator that only ever prints "passed"
// is worse than no validator, so every gate is proven to fail on demand.
//
// Run: node --test
// Node built-ins only — no install step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Copies the repository, applies `mutate(dir)`, runs the validator there, and
 * returns { status, output }. The copy is always removed, pass or fail.
 */
function runValidatorOn(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'fcc-validate-'));
  try {
    cpSync(REPO, dir, {
      recursive: true,
      filter: (src) => !src.includes(`${REPO}\\.git`) && !src.includes(`${REPO}/.git`),
    });
    mutate?.(dir);

    const result = spawnSync(process.execPath, ['scripts/validate-skill.mjs', '--quiet'], {
      cwd: dir,
      encoding: 'utf8',
    });

    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const patch = (dir, file, replace, replacement) => {
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  assert.ok(text.includes(replace), `test setup: "${replace}" not found in ${file}`);
  writeFileSync(path, text.replace(replace, replacement), 'utf8');
};

// --- the baseline ------------------------------------------------------------

test('the repository as committed passes', () => {
  const { status, output } = runValidatorOn();
  assert.equal(status, 0, output);
});

// --- frontmatter -------------------------------------------------------------

test('a seventh frontmatter field fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'license: MIT', 'license: MIT\npaths: "**/*.dart"'),
  );
  assert.equal(status, 1);
  assert.match(output, /paths.*portable six/s);
});

test('a description with no negative clause fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'Do not use for non-Dart code', 'It is excellent for'),
  );
  assert.equal(status, 1);
  assert.match(output, /negative clause/);
});

test('a name that is not lowercase-hyphen fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', 'name: flutter-clean-code', 'name: Flutter_Clean_Code'),
  );
  assert.equal(status, 1);
  assert.match(output, /lowercase letters/);
});

test('a version that is not MAJOR.MINOR.PATCH fails', () => {
  // Match whatever version the skill currently declares. Hardcoding one made this test fail on
  // the first release that bumped it, which says nothing about the rule under test.
  const patchVersion = (dir) => {
    const path = join(dir, 'SKILL.md');
    const text = readFileSync(path, 'utf8');
    assert.match(text, /^ {2}version: \d+\.\d+\.\d+$/m, 'test setup: no version line in SKILL.md');
    writeFileSync(path, text.replace(/^ {2}version: \d+\.\d+\.\d+$/m, '  version: v1'), 'utf8');
  };

  const { status, output } = runValidatorOn(patchVersion);
  assert.equal(status, 1);
  assert.match(output, /MAJOR\.MINOR\.PATCH/);
});

// --- the link graph ----------------------------------------------------------

test('a link to a missing file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    unlinkSync(join(dir, 'references/dart-examples.md')),
  );
  assert.equal(status, 1);
  assert.match(output, /missing file/);
});

test('a reference file linking to another reference file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(
      join(dir, 'references/refactor-batches.md'),
      '\nSee [examples](references/dart-examples.md).\n',
    ),
  );
  assert.equal(status, 1);
  assert.match(output, /one level deep/);
});

test('a long reference file with no Contents section fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '## Contents', '## Overview'),
  );
  assert.equal(status, 1);
  assert.match(output, /Contents/);
});

// --- self-containment and vocabulary ----------------------------------------

test('naming an external skill fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(join(dir, 'README.md'), '\nPairs well with flutter-code-quality.\n'),
  );
  assert.equal(status, 1);
  assert.match(output, /self-containment/);
});

test('a banned synonym fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    appendFileSync(join(dir, 'references/report-template.md'), '\nEach violation has a severity.\n'),
  );
  assert.equal(status, 1);
  assert.match(output, /vocabulary/);
});

// --- the checklist and the report agree --------------------------------------

test('a principle area with no row in the summary table fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '| Tests | | | | |\n', ''),
  );
  assert.equal(status, 1);
  assert.match(output, /principle row\(s\) but SKILL\.md defines/);
});

test('a summary table with a row too many fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'references/report-template.md', '| Tests | | | | |', '| Tests | | | | |\n| Vibes | | | | |'),
  );
  assert.equal(status, 1);
  assert.match(output, /principle row\(s\) but SKILL\.md defines/);
});

test('a misnumbered principle area fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(dir, 'SKILL.md', '#### 5. Comments and dead weight', '#### 8. Comments and dead weight'),
  );
  assert.equal(status, 1);
  assert.match(output, /is numbered 8; expected 5/);
});

// --- scripts -----------------------------------------------------------------

test('a script importing a third-party package fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    patch(
      dir,
      'scripts/scan-dart.mjs',
      "import { pathToFileURL } from 'node:url';",
      "import { pathToFileURL } from 'node:url';\nimport chalk from 'chalk';",
    ),
  );
  assert.equal(status, 1);
  assert.match(output, /Node built-ins only/);
});

test('a missing required script fails', () => {
  const { status, output } = runValidatorOn((dir) => unlinkSync(join(dir, 'scripts/scan-dart.mjs')));
  assert.equal(status, 1);
  assert.match(output, /scan-dart\.mjs is missing/);
});

// --- evaluations -------------------------------------------------------------

test('fewer than three evaluation scenarios fails', () => {
  const { status, output } = runValidatorOn((dir) => {
    // Leave exactly two, whatever the current scenario count happens to be.
    const scenarios = readdirSync(join(dir, 'evals')).filter((f) => f.endsWith('.json'));
    for (const file of scenarios.slice(2)) unlinkSync(join(dir, 'evals', file));
  });
  assert.equal(status, 1);
  assert.match(output, /at least 3 are required/);
});

test('a malformed evaluation file fails', () => {
  const { status, output } = runValidatorOn((dir) =>
    writeFileSync(join(dir, 'evals/04-negative-trigger.json'), '{ not json', 'utf8'),
  );
  assert.equal(status, 1);
  assert.match(output, /not valid JSON/);
});

test('a changelog whose newest release disagrees with metadata.version fails', () => {
  // AGENTS.md requires the declared version, the newest changelog heading and the tag to name
  // the same release. Two of the three are checkable without cutting one.
  const { status, output } = runValidatorOn((dir) => {
    const path = join(dir, 'CHANGELOG.md');
    const text = readFileSync(path, 'utf8');
    writeFileSync(path, text.replace(/^## \[?\d+\.\d+\.\d+\]?/m, '## [9.9.9]'), 'utf8');
  });
  assert.equal(status, 1);
  assert.match(output, /newest release heading is 9\.9\.9/);
});

test('a missing changelog fails, because a release nobody wrote down is not one', () => {
  const { status, output } = runValidatorOn((dir) => rmSync(join(dir, 'CHANGELOG.md')));
  assert.equal(status, 1);
  assert.match(output, /CHANGELOG\.md: missing/);
});

test('every maintenance script refuses a flag it does not know, before doing anything', () => {
  // make-baseline ignored an unknown flag and rewrote the stored baseline; make-eval-projects
  // ignored `--verify-clean` and rebuilt the project it was asked to verify. A refused flag costs
  // a retyped command. An ignored one runs the default, and here the default writes.
  const scripts = [
    ['check-evals.mjs'],
    ['check-report.mjs', 'report.md'],
    ['generate-eval-summary.mjs'],
    ['make-baseline.mjs'],
    ['make-eval-projects.mjs', join(tmpdir(), 'never-built'), '--only', '01-audit-fat-widget'],
    ['validate-skill.mjs'],
  ];
  const before = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).stdout;
  for (const [script, ...args] of scripts) {
    const run = spawnSync(process.execPath, [join('scripts', script), ...args, '--verify-clean'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    assert.equal(run.status, 1, `${script} exited ${run.status}`);
    assert.match(run.stderr, /unknown flag --verify-clean/, script);
  }
  const after = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).stdout;
  assert.equal(after, before, 'a refused run wrote something');
});

test('a script the README never names fails the run', () => {
  // README.md described seven scripts while the repository held eleven, and the four added
  // during 1.7.0 were named nowhere a reader looks. Nothing compared the list to the directory.
  const result = runValidatorOn((dir) => {
    writeFileSync(join(dir, 'scripts', 'check-something-new.mjs'), 'export const x = 1;\n');
  });
  assert.equal(result.status, 1);
  assert.match(result.output, /README\.md does not name scripts\/check-something-new\.mjs/);
});

test('a scenario missing from the Scenarios table fails, even when named elsewhere', () => {
  // The table stopped at twelve while the suite grew to seventeen. Scoping the check to the
  // section matters: the results table further down names all seventeen, so an unscoped check
  // found two of the five.
  const result = runValidatorOn((dir) => {
    const readme = join(dir, 'evals', 'README.md');
    const text = readFileSync(readme, 'utf8');
    const from = text.indexOf('## Scenarios');
    const to = text.indexOf('\n## ', from + 12);
    const table = text.slice(from, to);
    writeFileSync(readme, text.replace(table, table.replace(/\n\| `17-[^\n]*\|/, '')));
  });
  assert.equal(result.status, 1);
  assert.match(result.output, /under "## Scenarios" does not name evals\/17-/);
});

test('a test suite the test README never names fails the run', () => {
  const result = runValidatorOn((dir) => {
    writeFileSync(join(dir, 'test', 'check-something-new.test.mjs'), "import test from 'node:test';\n");
  });
  assert.equal(result.status, 1);
  assert.match(result.output, /test\/README\.md does not name test\/check-something-new\.test\.mjs/);
});

test('documentation naming a script that is gone fails the run', () => {
  // The check ran one way only at first: it caught a file the docs had never been told about and
  // said nothing about a file they still name after it is deleted. A reader who types that
  // command gets "Cannot find module", which is worse than a missing line.
  const result = runValidatorOn((dir) => {
    rmSync(join(dir, 'scripts', 'check-run.mjs'));
  });
  assert.equal(result.status, 1);
  assert.match(result.output, /README\.md names check-run\.mjs, which scripts\/ does not hold/);
});

test('a test suite name is not mistaken for a script that is missing', () => {
  // The first cut of that check matched the tail of 'scan-dart.test.mjs' and reported AGENTS.md
  // as naming a script called test.mjs. The repository as committed has to pass.
  const result = runValidatorOn();
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.output, /names test\.mjs/);
});
