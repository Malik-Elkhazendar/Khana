#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';

const workspaceRoot = process.cwd();
const candidateRoots = ['apps', 'libs'];
const thresholds = {
  warn: 400,
  hotspot: 600,
  critical: 1000,
};
const severityRank = {
  warn: 0,
  hotspot: 1,
  critical: 2,
};
const classBasedKinds = new Set(['component', 'service', 'controller']);

function parseArgs(argv) {
  const options = {
    format: 'text',
    minSeverity: 'warn',
    prefix: '',
    limit: Number.POSITIVE_INFINITY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--format' && argv[index + 1]) {
      options.format = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--min-severity' && argv[index + 1]) {
      options.minSeverity = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--prefix' && argv[index + 1]) {
      options.prefix = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--limit' && argv[index + 1]) {
      const parsedLimit = Number(argv[index + 1]);
      if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        options.limit = parsedLimit;
      }
      index += 1;
    }
  }

  if (!['text', 'json'].includes(options.format)) {
    options.format = 'text';
  }

  if (!Object.hasOwn(severityRank, options.minSeverity)) {
    options.minSeverity = 'warn';
  }

  return options;
}

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

function toRelativePath(filePath) {
  return relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

function isExcluded(filePath) {
  const rel = toRelativePath(filePath);
  const name = basename(filePath);

  if (extname(filePath) !== '.ts') {
    return true;
  }

  if (
    rel.includes('/dist/') ||
    rel.includes('/out-tsc/') ||
    rel.includes('/node_modules/') ||
    rel.includes('/coverage/')
  ) {
    return true;
  }

  if (
    name.endsWith('.spec.ts') ||
    name.endsWith('.test.ts') ||
    name.endsWith('.d.ts') ||
    name === 'index.ts'
  ) {
    return true;
  }

  if (
    rel.includes('/migrations/') ||
    rel.includes('/testing/') ||
    rel.includes('/test-support/') ||
    rel.includes('/shared/content/') ||
    rel.includes('/__mocks__/') ||
    rel.includes('/__fixtures__/')
  ) {
    return true;
  }

  return false;
}

function classifyKind(filePath) {
  if (filePath.endsWith('.component.ts')) {
    return 'component';
  }

  if (filePath.endsWith('.service.ts')) {
    return 'service';
  }

  if (filePath.endsWith('.store.ts')) {
    return 'store';
  }

  if (filePath.endsWith('.controller.ts')) {
    return 'controller';
  }

  if (filePath.endsWith('.workflows.ts')) {
    return 'workflows';
  }

  if (filePath.endsWith('.internal.ts')) {
    return 'internal';
  }

  return 'other';
}

function getLineCount(content) {
  return content.split(/\r?\n/).length;
}

function getSeverity(lineCount) {
  if (lineCount >= thresholds.critical) {
    return 'critical';
  }

  if (lineCount >= thresholds.hotspot) {
    return 'hotspot';
  }

  if (lineCount >= thresholds.warn) {
    return 'warn';
  }

  return null;
}

function countInternalImports(content) {
  const specifiers = new Set();
  const importPattern =
    /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (!specifier || !specifier.includes('internal/')) {
      continue;
    }

    specifiers.add(specifier);
  }

  return specifiers.size;
}

function getSiblingInternalSummary(filePath) {
  const internalDir = join(dirname(filePath), 'internal');
  const summary = {
    fileCount: 0,
    totalLineCount: 0,
  };

  if (!existsSync(internalDir) || !statSync(internalDir).isDirectory()) {
    return summary;
  }

  walkFiles(internalDir, (candidatePath) => {
    if (isExcluded(candidatePath)) {
      return;
    }

    const content = readFileSync(candidatePath, 'utf8');
    summary.fileCount += 1;
    summary.totalLineCount += getLineCount(content);
  });

  return summary;
}

function countApparentClassMethods(content) {
  if (!/\bclass\b/.test(content)) {
    return 0;
  }

  const methodPattern =
    /^\s{2}(?:public |protected |private |static |override |readonly |async |abstract )*(?:get |set )?([A-Za-z_]\w*)\s*(?:<[^>\n]+>)?\([^;\n{}]*\)\s*(?::[^{=>\n]+)?\s*\{/gm;
  let count = 0;

  for (const match of content.matchAll(methodPattern)) {
    if (match[1] === 'constructor') {
      continue;
    }

    count += 1;
  }

  return count;
}

function buildReasons(record) {
  const reasons = [
    `exceeds ${record.severity} threshold (${record.lineCount} lines)`,
  ];

  if (
    record.lineCount >= thresholds.hotspot &&
    record.importedInternalModuleCount >= 3
  ) {
    reasons.push(
      `ineffective internal extraction: imports ${record.importedInternalModuleCount} internal modules and sibling internal/ contains ${record.siblingInternalFileCount} files (${record.siblingInternalTotalLineCount} lines), but root remains ${record.lineCount} lines`
    );
  }

  if (
    record.lineCount >= thresholds.hotspot &&
    classBasedKinds.has(record.kind) &&
    record.apparentClassMethodCount >= 20
  ) {
    reasons.push(
      `ownership warning: ${record.apparentClassMethodCount} apparent class methods remain in the root ${record.kind}`
    );
  }

  return reasons;
}

function compareFindings(left, right) {
  const severityDelta =
    severityRank[right.severity] - severityRank[left.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }

  const lineDelta = right.lineCount - left.lineCount;
  if (lineDelta !== 0) {
    return lineDelta;
  }

  return left.path.localeCompare(right.path);
}

function formatText(findings, options) {
  if (findings.length === 0) {
    return 'HOTSPOT AUDIT OK';
  }

  const lines = ['HOTSPOT AUDIT'];
  const groups = ['critical', 'hotspot', 'warn'];

  for (const severity of groups) {
    const groupFindings = findings.filter(
      (finding) => finding.severity === severity
    );

    if (groupFindings.length === 0) {
      continue;
    }

    lines.push(severity.toUpperCase());

    for (const finding of groupFindings) {
      const summaryParts = [
        `kind: ${finding.kind}`,
        `lines: ${finding.lineCount}`,
        `imported internal: ${finding.importedInternalModuleCount}`,
        `sibling internal: ${finding.siblingInternalFileCount} files / ${finding.siblingInternalTotalLineCount} lines`,
      ];

      if (finding.apparentClassMethodCount > 0) {
        summaryParts.push(
          `apparent methods: ${finding.apparentClassMethodCount}`
        );
      }

      lines.push(`- ${finding.path}`);
      lines.push(`  ${summaryParts.join(' | ')}`);

      for (const reason of finding.reasons) {
        lines.push(`  reason: ${reason}`);
      }
    }
  }

  lines.push(
    `SUMMARY: ${findings.length} finding(s), min severity=${options.minSeverity}`
  );

  return lines.join('\n');
}

const options = parseArgs(process.argv.slice(2));
const records = [];

for (const root of candidateRoots) {
  walkFiles(join(workspaceRoot, root), (filePath) => {
    if (isExcluded(filePath)) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    const lineCount = getLineCount(content);
    const severity = getSeverity(lineCount);

    if (!severity) {
      return;
    }

    const siblingInternalSummary = getSiblingInternalSummary(filePath);
    const record = {
      path: toRelativePath(filePath),
      lineCount,
      severity,
      kind: classifyKind(filePath),
      siblingInternalFileCount: siblingInternalSummary.fileCount,
      siblingInternalTotalLineCount: siblingInternalSummary.totalLineCount,
      importedInternalModuleCount: countInternalImports(content),
      apparentClassMethodCount: countApparentClassMethods(content),
      reasons: [],
    };

    record.reasons = buildReasons(record);
    records.push(record);
  });
}

const minRank = severityRank[options.minSeverity];
const findings = records
  .filter((record) => severityRank[record.severity] >= minRank)
  .filter((record) => !options.prefix || record.path.includes(options.prefix))
  .sort(compareFindings)
  .slice(0, options.limit);

if (options.format === 'json') {
  console.log(
    JSON.stringify(
      {
        thresholds,
        filters: {
          minSeverity: options.minSeverity,
          prefix: options.prefix || null,
          limit:
            Number.isFinite(options.limit) && options.limit !== Number.POSITIVE_INFINITY
              ? options.limit
              : null,
        },
        findings,
      },
      null,
      2
    )
  );
  process.exit(0);
}

console.log(formatText(findings, options));
process.exit(0);
