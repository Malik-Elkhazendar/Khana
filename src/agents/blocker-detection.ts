/**
 * Dynamic Blocker Detection System
 *
 * This module provides dynamic detection of blocker status by scanning
 * the actual codebase rather than relying on hardcoded configuration.
 *
 * The agent uses these detection functions to determine the real state
 * of the project and update status accordingly.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Detection criteria for each blocker
 * Defines WHAT files/patterns to look for, not the status itself
 */
export const BLOCKER_DETECTION_CRITERIA = {
  AUTH_SYSTEM: {
    id: 'BLOCKER-1',
    name: 'Authentication System',
    effort: '20-30h',
    blocksAll: true,
    requiredFiles: [
      'apps/api/src/app/auth/auth.controller.ts',
      'apps/api/src/app/auth/auth.service.ts',
      'apps/api/src/app/auth/strategies/jwt.strategy.ts',
      'apps/api/src/app/auth/guards/jwt-auth.guard.ts',
    ],
    requiredPatterns: [
      { file: 'apps/api/src/app/auth/auth.service.ts', pattern: /login|authenticate/i },
      { file: 'apps/api/src/app/auth/auth.service.ts', pattern: /register|signup/i },
      { file: 'apps/api/src/app/auth/auth.controller.ts', pattern: /@Post.*login/i },
    ],
    minFileCount: 4,
    description: 'JWT authentication with login, register, refresh, logout endpoints',
  },

  USER_DATABASE: {
    id: 'BLOCKER-2',
    name: 'User Database Schema',
    effort: '8-10h',
    blocksAll: true,
    requiredFiles: [
      'libs/data-access/src/lib/entities/user.entity.ts',
    ],
    requiredPatterns: [
      { file: 'libs/data-access/src/lib/entities/user.entity.ts', pattern: /@Entity|@PrimaryGeneratedColumn/i },
      { file: 'libs/data-access/src/lib/entities/user.entity.ts', pattern: /passwordHash|password/i },
      { file: 'libs/data-access/src/lib/entities/user.entity.ts', pattern: /role|UserRole/i },
    ],
    minFileCount: 1,
    description: 'User entity with TypeORM decorators, roles, and password storage',
  },

  PERMISSIONS: {
    id: 'BLOCKER-3',
    name: 'Permission System',
    effort: '6-8h',
    blocksAll: true,
    requiredFiles: [
      'apps/api/src/app/auth/guards/roles.guard.ts',
    ],
    requiredPatterns: [
      { file: 'apps/api/src/app/auth/guards/roles.guard.ts', pattern: /RolesGuard|CanActivate/i },
      { file: 'apps/api/src/app/auth/decorators/roles.decorator.ts', pattern: /@Roles|SetMetadata/i },
    ],
    optionalFiles: [
      'apps/api/src/app/auth/decorators/roles.decorator.ts',
      'apps/api/src/app/auth/guards/optional-auth.guard.ts',
    ],
    minFileCount: 1,
    description: 'Role-based access control with guards and decorators',
  },

  AUDIT_LOGGING: {
    id: 'BLOCKER-4',
    name: 'Audit Logging',
    effort: '4-6h',
    blocksAll: false, // This one doesn't block all features
    requiredFiles: [
      'libs/data-access/src/lib/entities/audit-log.entity.ts',
    ],
    requiredPatterns: [
      { file: 'libs/data-access/src/lib/entities/audit-log.entity.ts', pattern: /@Entity|AuditLog/i },
    ],
    minFileCount: 1,
    description: 'Audit log entity for tracking mutations',
  },

  ENVIRONMENT_CONFIG: {
    id: 'BLOCKER-5',
    name: 'Environment Configuration',
    effort: '2-3h',
    blocksAll: false,
    requiredFiles: [
      'apps/manager-dashboard/src/environments/environment.ts',
      'apps/manager-dashboard/src/environments/environment.prod.ts',
    ],
    requiredPatterns: [
      { file: 'apps/manager-dashboard/src/environments/environment.ts', pattern: /apiUrl|API_URL/i },
    ],
    minFileCount: 2,
    description: 'Environment-based API URL configuration',
  },
};

export type BlockerStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface BlockerDetectionResult {
  id: string;
  name: string;
  status: BlockerStatus;
  effort: string;
  blocksAll: boolean;
  detectedAt: string;
  evidence: {
    filesFound: string[];
    filesMissing: string[];
    patternsMatched: string[];
    patternsMissing: string[];
    completionPercentage: number;
  };
}

export interface FullDetectionReport {
  timestamp: string;
  projectRoot: string;
  blockers: BlockerDetectionResult[];
  summary: {
    totalBlockers: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    criticalBlockersResolved: boolean;
    canShipFeatures: boolean;
    currentPhase: string;
  };
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file contains a pattern
 */
async function fileContainsPattern(filePath: string, pattern: RegExp): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return pattern.test(content);
  } catch {
    return false;
  }
}

/**
 * Detect the status of a single blocker by scanning the codebase
 */
export async function detectBlockerStatus(
  blockerKey: keyof typeof BLOCKER_DETECTION_CRITERIA,
  projectRoot: string
): Promise<BlockerDetectionResult> {
  const criteria = BLOCKER_DETECTION_CRITERIA[blockerKey];
  const filesFound: string[] = [];
  const filesMissing: string[] = [];
  const patternsMatched: string[] = [];
  const patternsMissing: string[] = [];

  // Check required files
  for (const file of criteria.requiredFiles) {
    const fullPath = path.join(projectRoot, file);
    if (await fileExists(fullPath)) {
      filesFound.push(file);
    } else {
      filesMissing.push(file);
    }
  }

  // Check optional files if defined
  if ('optionalFiles' in criteria && criteria.optionalFiles) {
    for (const file of criteria.optionalFiles) {
      const fullPath = path.join(projectRoot, file);
      if (await fileExists(fullPath)) {
        filesFound.push(file);
      }
      // Don't add to missing - they're optional
    }
  }

  // Check required patterns
  for (const { file, pattern } of criteria.requiredPatterns) {
    const fullPath = path.join(projectRoot, file);
    if (await fileContainsPattern(fullPath, pattern)) {
      patternsMatched.push(`${file}: ${pattern.toString()}`);
    } else {
      patternsMissing.push(`${file}: ${pattern.toString()}`);
    }
  }

  // Calculate completion percentage
  const totalChecks = criteria.requiredFiles.length + criteria.requiredPatterns.length;
  const passedChecks = filesFound.filter(f => criteria.requiredFiles.includes(f)).length + patternsMatched.length;
  const completionPercentage = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  // Determine status
  let status: BlockerStatus;
  if (completionPercentage >= 80 && filesMissing.length === 0) {
    status = 'COMPLETED';
  } else if (completionPercentage > 0 || filesFound.length > 0) {
    status = 'IN_PROGRESS';
  } else {
    status = 'NOT_STARTED';
  }

  return {
    id: criteria.id,
    name: criteria.name,
    status,
    effort: criteria.effort,
    blocksAll: criteria.blocksAll,
    detectedAt: new Date().toISOString(),
    evidence: {
      filesFound,
      filesMissing,
      patternsMatched,
      patternsMissing,
      completionPercentage,
    },
  };
}

/**
 * Detect all blocker statuses by scanning the codebase
 */
export async function detectAllBlockers(projectRoot: string): Promise<FullDetectionReport> {
  const blockers: BlockerDetectionResult[] = [];

  for (const key of Object.keys(BLOCKER_DETECTION_CRITERIA) as Array<keyof typeof BLOCKER_DETECTION_CRITERIA>) {
    const result = await detectBlockerStatus(key, projectRoot);
    blockers.push(result);
  }

  // Calculate summary
  const completed = blockers.filter(b => b.status === 'COMPLETED').length;
  const inProgress = blockers.filter(b => b.status === 'IN_PROGRESS').length;
  const notStarted = blockers.filter(b => b.status === 'NOT_STARTED').length;

  // Check if critical blockers (blocksAll = true) are resolved
  const criticalBlockers = blockers.filter(b => b.blocksAll);
  const criticalBlockersResolved = criticalBlockers.every(b => b.status === 'COMPLETED');

  // Determine current phase
  let currentPhase: string;
  if (!criticalBlockersResolved) {
    currentPhase = 'Phase 0 (Pre-Foundation)';
  } else if (completed >= 4) {
    currentPhase = 'Phase 2: Features (Ready)';
  } else {
    currentPhase = 'Phase 1: Foundation (In Progress)';
  }

  return {
    timestamp: new Date().toISOString(),
    projectRoot,
    blockers,
    summary: {
      totalBlockers: blockers.length,
      completed,
      inProgress,
      notStarted,
      criticalBlockersResolved,
      canShipFeatures: criticalBlockersResolved,
      currentPhase,
    },
  };
}

/**
 * Generate a markdown report from detection results
 */
export function generateBlockerMarkdownReport(report: FullDetectionReport): string {
  const lines: string[] = [
    '# Blocker Matrix & Dependency Tracking',
    '',
    '**Status**: ACTIVE',
    `**Last Updated**: ${new Date().toISOString().split('T')[0]}`,
    `**Auto-Generated**: This file is dynamically generated from codebase scanning`,
    '**Purpose**: Track what blocks what and identify critical path',
    '',
    '---',
    '',
    `## Current Status: ${report.summary.currentPhase}`,
    '',
    `- **Critical Blockers Resolved**: ${report.summary.criticalBlockersResolved ? 'YES' : 'NO'}`,
    `- **Can Ship Features**: ${report.summary.canShipFeatures ? 'YES' : 'NO'}`,
    `- **Completed**: ${report.summary.completed}/${report.summary.totalBlockers}`,
    `- **In Progress**: ${report.summary.inProgress}/${report.summary.totalBlockers}`,
    `- **Not Started**: ${report.summary.notStarted}/${report.summary.totalBlockers}`,
    '',
    '---',
    '',
  ];

  // Group blockers by status
  const completed = report.blockers.filter(b => b.status === 'COMPLETED');
  const inProgress = report.blockers.filter(b => b.status === 'IN_PROGRESS');
  const notStarted = report.blockers.filter(b => b.status === 'NOT_STARTED');

  if (completed.length > 0) {
    lines.push('## RESOLVED BLOCKERS');
    lines.push('');
    for (const blocker of completed) {
      lines.push(`### ${blocker.id}: ${blocker.name}`);
      lines.push('');
      lines.push(`**Status**: COMPLETED`);
      lines.push(`**Effort**: ${blocker.effort} (completed)`);
      lines.push(`**Blocks All**: ${blocker.blocksAll ? 'YES (was)' : 'No'}`);
      lines.push(`**Completion**: ${blocker.evidence.completionPercentage}%`);
      lines.push('');
      lines.push('**Evidence Found**:');
      for (const file of blocker.evidence.filesFound) {
        lines.push(`- [x] \`${file}\``);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (inProgress.length > 0) {
    lines.push('## IN PROGRESS BLOCKERS');
    lines.push('');
    for (const blocker of inProgress) {
      lines.push(`### ${blocker.id}: ${blocker.name}`);
      lines.push('');
      lines.push(`**Status**: IN PROGRESS`);
      lines.push(`**Effort**: ${blocker.effort}`);
      lines.push(`**Blocks All**: ${blocker.blocksAll ? 'YES' : 'No'}`);
      lines.push(`**Completion**: ${blocker.evidence.completionPercentage}%`);
      lines.push('');
      lines.push('**Files Found**:');
      for (const file of blocker.evidence.filesFound) {
        lines.push(`- [x] \`${file}\``);
      }
      lines.push('');
      lines.push('**Files Missing**:');
      for (const file of blocker.evidence.filesMissing) {
        lines.push(`- [ ] \`${file}\``);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (notStarted.length > 0) {
    lines.push('## NOT STARTED BLOCKERS');
    lines.push('');
    for (const blocker of notStarted) {
      lines.push(`### ${blocker.id}: ${blocker.name}`);
      lines.push('');
      lines.push(`**Status**: NOT STARTED`);
      lines.push(`**Priority**: ${blocker.blocksAll ? 'CRITICAL' : 'HIGH'}`);
      lines.push(`**Effort**: ${blocker.effort}`);
      lines.push(`**Blocks All**: ${blocker.blocksAll ? 'YES' : 'No'}`);
      lines.push('');
      lines.push('**Required Files**:');
      for (const file of blocker.evidence.filesMissing) {
        lines.push(`- [ ] \`${file}\``);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Add dependency graph
  lines.push('## DEPENDENCY GRAPH');
  lines.push('');
  lines.push('```');
  lines.push('Authentication System (BLOCKER-1)');
  lines.push('├─ User Database (BLOCKER-2)');
  lines.push('│  ├─ booking-calendar');
  lines.push('│  ├─ booking-preview');
  lines.push('│  └─ booking-list');
  lines.push('│');
  lines.push('├─ Permission System (BLOCKER-3)');
  lines.push('│  ├─ Admin features');
  lines.push('│  └─ Manager features');
  lines.push('│');
  lines.push('└─ Audit Logging (BLOCKER-4)');
  lines.push('   └─ Compliance reporting');
  lines.push('');
  lines.push('Environment Config (BLOCKER-5)');
  lines.push('└─ Production deployment');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * Update the BLOCKERS.md file with current detection results
 */
export async function updateBlockersMdFile(projectRoot: string): Promise<{ success: boolean; message: string }> {
  try {
    const report = await detectAllBlockers(projectRoot);
    const markdown = generateBlockerMarkdownReport(report);
    const blockersPath = path.join(projectRoot, 'docs/authoritative/BLOCKERS.md');

    await fs.writeFile(blockersPath, markdown, 'utf-8');

    return {
      success: true,
      message: `Updated BLOCKERS.md with ${report.summary.completed} completed, ${report.summary.inProgress} in progress, ${report.summary.notStarted} not started blockers.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update BLOCKERS.md: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
