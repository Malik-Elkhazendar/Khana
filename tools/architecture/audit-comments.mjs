#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';

const workspaceRoot = process.cwd();
const findings = [];
const candidateRoots = ['apps', 'libs'];
const documentedFilenamePatterns = [
  '.component.ts',
  '.service.ts',
  '.store.ts',
  '.controller.ts',
  '.workflows.ts',
  '.internal.ts',
];

function walkFiles(root, callback) {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walkFiles(entryPath, callback);
      continue;
    }

    callback(entryPath);
  }
}

function isExcluded(filePath) {
  const rel = relative(workspaceRoot, filePath).replace(/\\/g, '/');
  const name = basename(filePath);

  if (extname(filePath) !== '.ts') {
    return true;
  }

  if (
    rel.includes('/dist/') ||
    rel.includes('/out-tsc/') ||
    rel.includes('/node_modules/')
  ) {
    return true;
  }

  if (
    name.endsWith('.spec.ts') ||
    name.endsWith('.test.ts') ||
    name.endsWith('.d.ts') ||
    rel.includes('/migrations/') ||
    rel.includes('/testing/') ||
    rel.includes('/shared/content/')
  ) {
    return true;
  }

  if (name === 'index.ts') {
    return true;
  }

  return false;
}

function countCommentLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*(\/\/|\/\*|\*)/.test(line)).length;
}

function hasTopLevelJSDoc(content) {
  const searchWindow = content.split(/\r?\n/).slice(0, 400).join('\n');
  return /\/\*\*[\s\S]*?\*\/\s*(?:@\w+\([^)]*\)\s*)*(?:@\w+\s*)*(?:export\s+)?(?:abstract\s+)?(?:class|function|const)\b/m.test(
    searchWindow
  );
}

function isDocumentedFilename(filePath) {
  return documentedFilenamePatterns.some((pattern) => filePath.endsWith(pattern));
}

for (const root of candidateRoots) {
  walkFiles(join(workspaceRoot, root), (filePath) => {
    if (isExcluded(filePath)) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    const lineCount = content.split(/\r?\n/).length;
    const commentLines = countCommentLines(content);
    const rel = relative(workspaceRoot, filePath).replace(/\\/g, '/');

    if (lineCount >= 300 && commentLines === 0) {
      findings.push(
        `[commentless-hotspot] ${rel} (${lineCount} lines) has no comment lines`
      );
    }

    if (
      lineCount >= 200 &&
      isDocumentedFilename(filePath) &&
      !hasTopLevelJSDoc(content)
    ) {
      findings.push(
        `[missing-top-jsdoc] ${rel} (${lineCount} lines) has no top-level JSDoc`
      );
    }
  });
}

if (findings.length === 0) {
  console.log('COMMENT AUDIT OK');
  process.exit(0);
}

console.log('COMMENT AUDIT WARNINGS');
for (const finding of findings) {
  console.log(`- ${finding}`);
}
console.log(`SUMMARY: ${findings.length} warning(s)`);
process.exit(0);
