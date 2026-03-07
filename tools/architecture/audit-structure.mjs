#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const workspaceRoot = process.cwd();
const findings = {
  errors: [],
  warnings: [],
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function walkDirs(root, callback) {
  if (!existsSync(root)) {
    return;
  }

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);

    if (!stats.isDirectory()) {
      continue;
    }

    callback(entryPath);
    walkDirs(entryPath, callback);
  }
}

function findProjectFiles(root) {
  const files = [];

  if (!existsSync(root)) {
    return files;
  }

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    if (!statSync(entryPath).isDirectory()) {
      continue;
    }

    const candidate = join(entryPath, 'project.json');
    if (existsSync(candidate)) {
      files.push(candidate);
    }
  }

  return files;
}

function auditProjectTags() {
  for (const root of ['apps', 'libs']) {
    for (const projectPath of findProjectFiles(join(workspaceRoot, root))) {
      const project = readJson(projectPath);
      if (!Array.isArray(project.tags) || project.tags.length === 0) {
        findings.errors.push(
          `Missing project tags: ${relative(workspaceRoot, projectPath)}`
        );
      }
    }
  }
}

function auditBoundaryRules() {
  const eslintPath = join(workspaceRoot, 'eslint.config.mjs');
  const content = readFileSync(eslintPath, 'utf8');

  if (content.includes("sourceTag: '*'")) {
    findings.errors.push(
      'Wildcard-only Nx boundary constraint found in eslint.config.mjs'
    );
  }
}

function auditEmptyAppDirs() {
  const roots = [
    join(workspaceRoot, 'apps/manager-dashboard/src/app'),
    join(workspaceRoot, 'apps/api/src/app'),
  ];

  for (const root of roots) {
    walkDirs(root, (dirPath) => {
      const entries = readdirSync(dirPath);
      if (entries.length === 0) {
        findings.warnings.push(
          `Empty source directory: ${relative(workspaceRoot, dirPath)}`
        );
      }
    });
  }
}

function auditSharedUtilsPurity() {
  const sharedUtilsPath = join(workspaceRoot, 'libs/shared-utils/src/lib');
  const forbiddenFiles = [
    join(sharedUtilsPath, 'env-files.ts'),
    join(sharedUtilsPath, 'filters/http-exception.filter.ts'),
  ];

  for (const filePath of forbiddenFiles) {
    if (existsSync(filePath)) {
      findings.errors.push(
        `Impure shared-utils export remains: ${relative(workspaceRoot, filePath)}`
      );
    }
  }

  const packageJson = readJson(
    join(workspaceRoot, 'libs/shared-utils/package.json')
  );
  const dependencyNames = Object.keys(packageJson.dependencies ?? {});
  const forbiddenDeps = dependencyNames.filter(
    (name) => name === '@nestjs/common' || name === '@nestjs/core'
  );

  if (forbiddenDeps.length > 0) {
    findings.errors.push(
      `shared-utils has Nest dependencies: ${forbiddenDeps.join(', ')}`
    );
  }
}

function auditRepositoryMap() {
  const repositoryMapPath = join(
    workspaceRoot,
    'docs/current/repository-map.md'
  );
  const content = readFileSync(repositoryMapPath, 'utf8');

  if (!content.includes('repo-architecture.md')) {
    findings.warnings.push(
      'repository-map.md does not reference docs/current/repo-architecture.md'
    );
  }
}

auditProjectTags();
auditBoundaryRules();
auditEmptyAppDirs();
auditSharedUtilsPurity();
auditRepositoryMap();

if (findings.errors.length === 0 && findings.warnings.length === 0) {
  console.log('STRUCTURE AUDIT OK');
  process.exit(0);
}

if (findings.errors.length > 0) {
  console.log('STRUCTURE AUDIT ERRORS');
  for (const error of findings.errors) {
    console.log(`- ${error}`);
  }
}

if (findings.warnings.length > 0) {
  console.log('STRUCTURE AUDIT WARNINGS');
  for (const warning of findings.warnings) {
    console.log(`- ${warning}`);
  }
}

process.exit(findings.errors.length > 0 ? 1 : 0);
