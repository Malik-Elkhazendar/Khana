#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';

const workspaceRoot = process.cwd();
const candidateRoots = ['apps', 'libs'];
const routeFiles = [
  'apps/manager-dashboard/src/app/app.routes.ts',
];
const defaultOptions = {
  format: 'text',
  prefix: '',
  scope: 'all',
  failOnFindings: false,
};
const findings = [];

const thresholds = {
  routeJSDoc: 250,
  publicJSDoc: 250,
  routeIntentComments: 400,
  publicIntentComments: 400,
};

function parseArgs(argv) {
  const options = { ...defaultOptions };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = current.split('=');
    const key = rawKey.slice(2);
    const value = inlineValue ?? argv[index + 1];

    if (inlineValue == null) {
      index += 1;
    }

    if (key === 'format' && (value === 'text' || value === 'json')) {
      options.format = value;
    }

    if (key === 'prefix' && typeof value === 'string') {
      options.prefix = value.replace(/\\/g, '/');
    }

    if (key === 'scope' && ['all', 'pages', 'public'].includes(value)) {
      options.scope = value;
    }

    if (key === 'fail-on-findings') {
      options.failOnFindings =
        inlineValue == null ? true : value !== 'false' && value !== '0';
    }
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

function normalizeRelativePath(filePath) {
  return relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

function isExcluded(filePath) {
  const rel = normalizeRelativePath(filePath);
  const fileName = rel.split('/').pop() ?? '';

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
    fileName.endsWith('.spec.ts') ||
    fileName.endsWith('.test.ts') ||
    fileName.endsWith('.d.ts') ||
    rel.includes('/migrations/') ||
    rel.includes('/testing/') ||
    rel.includes('/shared/content/')
  ) {
    return true;
  }

  if (fileName === 'index.ts') {
    return true;
  }

  return false;
}

function countCommentLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*(\/\/|\/\*|\*)/.test(line)).length;
}

function countLineComments(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*\/\//.test(line)).length;
}

function hasTopLevelJSDoc(content) {
  const searchWindow = content.split(/\r?\n/).slice(0, 400).join('\n');
  return /\/\*\*[\s\S]*?\*\/\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:export\s+)?(?:abstract\s+)?(?:class|function|const)\b/m.test(
    searchWindow
  );
}

function detectKind(relPath) {
  if (relPath.endsWith('.component.ts')) {
    return 'component';
  }
  if (relPath.endsWith('.service.ts')) {
    return 'service';
  }
  if (relPath.endsWith('.store.ts')) {
    return 'store';
  }
  if (relPath.endsWith('.controller.ts')) {
    return 'controller';
  }
  if (relPath.endsWith('.workflows.ts')) {
    return 'workflow';
  }
  return 'other';
}

function resolveRouteComponentPaths() {
  const routeComponentPaths = new Set();

  for (const routeFile of routeFiles) {
    const routeFilePath = resolve(workspaceRoot, routeFile);
    if (!existsSync(routeFilePath)) {
      continue;
    }

    const content = readFileSync(routeFilePath, 'utf8');
    const importMatches = content.matchAll(/import\('([^']+\.component)'\)/g);

    for (const match of importMatches) {
      const importTarget = match[1];
      const resolvedTarget = normalize(
        resolve(dirname(routeFilePath), `${importTarget}.ts`)
      );
      routeComponentPaths.add(normalizeRelativePath(resolvedTarget));
    }
  }

  return routeComponentPaths;
}

function classifyEntrypoint(relPath, routeComponentPaths) {
  const kind = detectKind(relPath);
  const isRouteComponent = routeComponentPaths.has(relPath);
  const isInternal = relPath.includes('/internal/');
  const isPublicEntrypoint =
    isRouteComponent ||
    (!isInternal &&
      ['service', 'store', 'controller', 'workflow'].includes(kind));

  return {
    kind,
    isRouteComponent,
    isPublicEntrypoint,
    isInternal,
  };
}

function includeByScope(scope, classification) {
  if (scope === 'pages') {
    return classification.isRouteComponent;
  }

  if (scope === 'public') {
    return classification.isPublicEntrypoint;
  }

  return classification.isRouteComponent || classification.isPublicEntrypoint;
}

function addFinding(file, lineCount, kind, category, reason) {
  findings.push({
    file,
    lineCount,
    kind,
    severity: 'warn',
    category,
    reason,
  });
}

const options = parseArgs(process.argv.slice(2));
const routeComponentPaths = resolveRouteComponentPaths();

for (const root of candidateRoots) {
  walkFiles(join(workspaceRoot, root), (filePath) => {
    if (isExcluded(filePath)) {
      return;
    }

    const relPath = normalizeRelativePath(filePath);
    if (options.prefix && !relPath.includes(options.prefix)) {
      return;
    }

    const classification = classifyEntrypoint(relPath, routeComponentPaths);
    if (!includeByScope(options.scope, classification)) {
      return;
    }

    const content = readFileSync(filePath, 'utf8');
    const lineCount = content.split(/\r?\n/).length;
    const commentLines = countCommentLines(content);
    const lineCommentLines = countLineComments(content);
    const topLevelJSDoc = hasTopLevelJSDoc(content);

    if (
      classification.isRouteComponent &&
      lineCount >= thresholds.routeJSDoc &&
      !topLevelJSDoc
    ) {
      addFinding(
        relPath,
        lineCount,
        classification.kind,
        'missing-top-jsdoc',
        'large routed page has no top-level JSDoc'
      );
    }

    if (
      !classification.isRouteComponent &&
      classification.isPublicEntrypoint &&
      lineCount >= thresholds.publicJSDoc &&
      !topLevelJSDoc
    ) {
      addFinding(
        relPath,
        lineCount,
        classification.kind,
        'missing-top-jsdoc',
        'large public entrypoint has no top-level JSDoc'
      );
    }

    if (
      classification.isRouteComponent &&
      lineCount >= thresholds.routeIntentComments &&
      lineCommentLines < 2
    ) {
      addFinding(
        relPath,
        lineCount,
        classification.kind,
        'missing-structural-comments',
        'large routed page has too few implementation comments to mark major workflow sections'
      );
    }

    if (
      !classification.isRouteComponent &&
      classification.isPublicEntrypoint &&
      lineCount >= thresholds.publicIntentComments &&
      commentLines === 0
    ) {
      addFinding(
        relPath,
        lineCount,
        classification.kind,
        'commentless-entrypoint',
        'large public entrypoint has no comment lines'
      );
    }
  });
}

if (options.format === 'json') {
  console.log(
    JSON.stringify(
      {
        summary: {
          findings: findings.length,
          scope: options.scope,
          prefix: options.prefix || null,
        },
        findings,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (findings.length === 0) {
  console.log('ENTRYPOINT DOC AUDIT OK');
  process.exit(0);
}

console.log('ENTRYPOINT DOC AUDIT WARNINGS');
for (const finding of findings) {
  console.log(
    `- [${finding.category}] ${finding.file} (${finding.lineCount} lines, ${finding.kind})`
  );
  console.log(`  reason: ${finding.reason}`);
}
console.log(
  `SUMMARY: ${findings.length} warning(s), scope=${options.scope}${
    options.prefix ? `, prefix=${options.prefix}` : ''
  }`
);
process.exit(options.failOnFindings ? 1 : 0);
