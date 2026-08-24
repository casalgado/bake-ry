#!/usr/bin/env node
//
// Guards against a break that is invisible on Windows and macOS.
//
// Those filesystems are case-insensitive, so `git mv`-ing nothing and simply
// renaming a file's capitalisation leaves git tracking the OLD name while the
// disk holds the new one. Everything keeps working locally, and `firebase
// deploy` uploads the working directory, so production keeps working too.
//
// It breaks the first time someone checks the repo out on a case-sensitive
// filesystem — Linux CI, a teammate's machine — where git writes
// `BakeryUserService.js` and `require('../services/bakeryUserService')` throws
// MODULE_NOT_FOUND at boot.
//
// Run from anywhere; checks the whole repository.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
  .split('\0')
  .filter(Boolean);

// One readdir per directory rather than one stat per file: on Windows the
// per-process overhead is what makes the naive version take minutes.
const entriesByDir = new Map();

const readDir = (dir) => {
  if (!entriesByDir.has(dir)) {
    const absolute = path.join(repoRoot, dir);
    entriesByDir.set(
      dir,
      fs.existsSync(absolute) ? new Set(fs.readdirSync(absolute)) : new Set(),
    );
  }
  return entriesByDir.get(dir);
};

const mismatches = [];

for (const file of tracked) {
  const dir = path.posix.dirname(file);
  const base = path.posix.basename(file);
  const entries = readDir(dir === '.' ? '' : dir);

  // Present with exactly this spelling: fine. Absent entirely: a deleted file,
  // not this check's problem. Present with different case: the bug.
  if (entries.has(base)) continue;

  const actual = [...entries].find(
    (entry) => entry.toLowerCase() === base.toLowerCase(),
  );

  if (actual) mismatches.push({ tracked: file, disk: `${dir}/${actual}` });
}

if (mismatches.length === 0) {
  console.log(`✓ filename case: ${tracked.length} tracked files match the filesystem`);
  process.exit(0);
}

console.error('✗ filename case mismatch between git and the filesystem:\n');
mismatches.forEach(({ tracked: t, disk }) => {
  console.error(`  git:  ${t}\n  disk: ${disk}\n`);
});
console.error(
  'Fix each with a two-step rename so git records it:\n' +
    '  git mv path/Name.js path/Name.js.tmp && git mv path/Name.js.tmp path/name.js\n\n' +
    'Left unfixed, a checkout on a case-sensitive filesystem gets the git\n' +
    'spelling and every require() of the other spelling fails at boot.',
);
process.exit(1);
