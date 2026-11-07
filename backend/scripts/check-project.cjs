#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const sourceRoots = ['frontend', 'backend'].map((name) => path.join(repositoryRoot, name));
const files = [];

function collectJavaScript(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') collectJavaScript(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

for (const sourceRoot of sourceRoots) collectJavaScript(sourceRoot);
files.sort();

let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(`\nSyntax check failed: ${path.relative(repositoryRoot, file)}\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.stdout) process.stderr.write(result.stdout);
  }
}

if (failures) {
  process.stderr.write(`\n${failures} of ${files.length} JavaScript files failed syntax checks.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`JavaScript syntax check passed for ${files.length} files.\n`);
}
