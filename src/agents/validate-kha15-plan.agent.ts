/**
 * KHA-15 Plan Validator Agent
 *
 * Purpose:
 * - Validate KHA-15 planning assumptions against current code (baseline mode)
 * - Validate KHA-15 implementation targets after delivery (target mode)
 *
 * Usage:
 * - node -r @swc-node/register src/agents/validate-kha15-plan.agent.ts baseline
 * - node -r @swc-node/register src/agents/validate-kha15-plan.agent.ts target
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

type ValidationMode = 'baseline' | 'target';

type CheckResult = {
  id: string;
  pass: boolean;
  message: string;
  evidence: string;
};

const modeArg = (process.argv[2] || 'baseline').toLowerCase();

if (modeArg !== 'baseline' && modeArg !== 'target') {
  console.error(
    `Invalid mode "${modeArg}". Use "baseline" or "target" as the first argument.`
  );
  process.exit(2);
}

const mode = modeArg as ValidationMode;
const repoRoot = process.cwd();

const read = (relativePath: string): string => {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return '';
  return readFileSync(absolutePath, 'utf8');
};

const has = (
  relativePath: string,
  pattern: string | RegExp,
  includePathInEvidence = true
): { pass: boolean; evidence: string } => {
  const source = read(relativePath);
  if (!source) {
    return {
      pass: false,
      evidence: `Missing file: ${relativePath}`,
    };
  }

  const pass =
    typeof pattern === 'string'
      ? source.includes(pattern)
      : Boolean(source.match(pattern));
  const evidencePrefix = includePathInEvidence ? `${relativePath}: ` : '';
  return {
    pass,
    evidence: pass
      ? `${evidencePrefix}matched ${String(pattern)}`
      : `${evidencePrefix}did not match ${String(pattern)}`,
  };
};

const fileExists = (
  relativePath: string
): { pass: boolean; evidence: string } => {
  const absolutePath = resolve(repoRoot, relativePath);
  const pass = existsSync(absolutePath);
  return {
    pass,
    evidence: pass
      ? `Exists: ${relativePath}`
      : `Missing expected file: ${relativePath}`,
  };
};

const baselineChecks = (): CheckResult[] => {
  const checks: CheckResult[] = [];

  {
    const roleEnum = has(
      'libs/shared-dtos/src/lib/enums/user-role.enum.ts',
      /OWNER[\s\S]*MANAGER[\s\S]*STAFF[\s\S]*VIEWER/
    );
    const authMe = has(
      'apps/api/src/app/auth/auth.controller.ts',
      /@Get\('me'\)/
    );
    checks.push({
      id: 'B1',
      pass: roleEnum.pass && authMe.pass,
      message: 'Auth baseline and user role enum are in place.',
      evidence: `${roleEnum.evidence} | ${authMe.evidence}`,
    });
  }

  {
    const moduleExists = fileExists('apps/api/src/app/users/users.module.ts');
    const controllerExists = fileExists(
      'apps/api/src/app/users/users.controller.ts'
    );
    const serviceExists = fileExists('apps/api/src/app/users/users.service.ts');
    checks.push({
      id: 'B2',
      pass: !moduleExists.pass && !controllerExists.pass && !serviceExists.pass,
      message:
        'Dedicated users management module/controller/service is not implemented yet.',
      evidence: `${moduleExists.evidence} | ${controllerExists.evidence} | ${serviceExists.evidence}`,
    });
  }

  {
    const appModuleImport = has(
      'apps/api/src/app/app.module.ts',
      /UsersModule/
    );
    checks.push({
      id: 'B3',
      pass: !appModuleImport.pass,
      message: 'App module does not yet wire a UsersModule.',
      evidence: appModuleImport.evidence,
    });
  }

  {
    const teamPage = fileExists(
      'apps/manager-dashboard/src/app/features/team/team.component.ts'
    );
    const hasFormTag = has(
      'apps/manager-dashboard/src/app/features/team/team.component.html',
      /<form[\s>]/i
    );
    const hasMutations = has(
      'apps/manager-dashboard/src/app/features/team/team.component.ts',
      /updateUserRole\(|updateUserStatus\(|inviteUser\(|listUsers\(/
    );
    checks.push({
      id: 'B4',
      pass: teamPage.pass && !hasFormTag.pass && !hasMutations.pass,
      message:
        'Team page exists but is profile-only (no list role/status/invite controls).',
      evidence: `${teamPage.evidence} | ${hasFormTag.evidence} | ${hasMutations.evidence}`,
    });
  }

  {
    const apiUsers = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /\/v1\/users|listUsers\(|updateUserRole\(|updateUserStatus\(|inviteUser\(/
    );
    checks.push({
      id: 'B5',
      pass: !apiUsers.pass,
      message:
        'Frontend API service does not yet expose user-management endpoints.',
      evidence: apiUsers.evidence,
    });
  }

  {
    const inviteMail = has(
      'libs/notifications/src/lib/services/email.service.ts',
      /invite|Invitation|team invite|sendTeamInvite/
    );
    checks.push({
      id: 'B6',
      pass: !inviteMail.pass,
      message: 'No dedicated team invitation email method exists yet.',
      evidence: inviteMail.evidence,
    });
  }

  {
    const teamRoute = has(
      'apps/manager-dashboard/src/app/app.routes.ts',
      /path:\s*'team'/
    );
    const teamNav = has(
      'apps/manager-dashboard/src/app/shared/navigation/dashboard-nav.ts',
      /route:\s*'\/dashboard\/team'/
    );
    checks.push({
      id: 'B7',
      pass: teamRoute.pass && teamNav.pass,
      message: 'Team route and navigation entry already exist.',
      evidence: `${teamRoute.evidence} | ${teamNav.evidence}`,
    });
  }

  return checks;
};

const targetChecks = (): CheckResult[] => {
  const checks: CheckResult[] = [];

  {
    const moduleFile = fileExists('apps/api/src/app/users/users.module.ts');
    const controllerFile = fileExists(
      'apps/api/src/app/users/users.controller.ts'
    );
    const serviceFile = fileExists('apps/api/src/app/users/users.service.ts');
    checks.push({
      id: 'T1',
      pass: moduleFile.pass && controllerFile.pass && serviceFile.pass,
      message: 'Users backend module/controller/service files are present.',
      evidence: `${moduleFile.evidence} | ${controllerFile.evidence} | ${serviceFile.evidence}`,
    });
  }

  {
    const appModule = has('apps/api/src/app/app.module.ts', /UsersModule/);
    checks.push({
      id: 'T2',
      pass: appModule.pass,
      message: 'App module wires UsersModule.',
      evidence: appModule.evidence,
    });
  }

  {
    const controllerPath = has(
      'apps/api/src/app/users/users.controller.ts',
      /@Controller\(\s*\{\s*path:\s*'users'/
    );
    const list = has('apps/api/src/app/users/users.controller.ts', /@Get\(\)/);
    const role = has(
      'apps/api/src/app/users/users.controller.ts',
      /@Patch\(':id\/role'\)/
    );
    const status = has(
      'apps/api/src/app/users/users.controller.ts',
      /@Patch\(':id\/status'\)/
    );
    const invite = has(
      'apps/api/src/app/users/users.controller.ts',
      /@Post\('invite'\)/
    );
    checks.push({
      id: 'T3',
      pass:
        controllerPath.pass &&
        list.pass &&
        role.pass &&
        status.pass &&
        invite.pass,
      message: 'Users controller exposes required management endpoints.',
      evidence: `${controllerPath.evidence} | ${list.evidence} | ${role.evidence} | ${status.evidence} | ${invite.evidence}`,
    });
  }

  {
    const serviceAudit = has(
      'apps/api/src/app/users/users.service.ts',
      /AuditLog|logAudit|AuditAction/
    );
    const serviceInvite = has(
      'apps/api/src/app/users/users.service.ts',
      /PasswordResetToken|sendTeamInvite|invite/
    );
    checks.push({
      id: 'T4',
      pass: serviceAudit.pass && serviceInvite.pass,
      message: 'Users service includes audit logging and invite flow logic.',
      evidence: `${serviceAudit.evidence} | ${serviceInvite.evidence}`,
    });
  }

  {
    const apiUsers = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /\/v1\/users|listUsers\(|updateUserRole\(|updateUserStatus\(|inviteUser\(/
    );
    checks.push({
      id: 'T5',
      pass: apiUsers.pass,
      message: 'Frontend API service includes users management endpoints.',
      evidence: apiUsers.evidence,
    });
  }

  {
    const teamTable = has(
      'apps/manager-dashboard/src/app/features/team/team.component.html',
      /<table|members|role|invite/i
    );
    const teamMutations = has(
      'apps/manager-dashboard/src/app/features/team/team.component.ts',
      /updateUserRole\(|updateUserStatus\(|inviteUser\(|loadUsers\(/i
    );
    checks.push({
      id: 'T6',
      pass: teamTable.pass && teamMutations.pass,
      message: 'Team page includes list management and invite behaviors.',
      evidence: `${teamTable.evidence} | ${teamMutations.evidence}`,
    });
  }

  {
    const inviteEmail = has(
      'libs/notifications/src/lib/services/email.service.ts',
      /sendTeamInvite|team invite|invitation/i
    );
    checks.push({
      id: 'T7',
      pass: inviteEmail.pass,
      message:
        'Notifications service includes team invitation email capability.',
      evidence: inviteEmail.evidence,
    });
  }

  return checks;
};

const checks = mode === 'baseline' ? baselineChecks() : targetChecks();
const failures = checks.filter((check) => !check.pass);

console.log(`\nKHA-15 Plan Validator (${mode.toUpperCase()})`);
console.log('='.repeat(60));
for (const check of checks) {
  const status = check.pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${check.id} - ${check.message}`);
  console.log(`       ${check.evidence}`);
}
console.log('-'.repeat(60));
console.log(
  `Summary: ${checks.length - failures.length}/${checks.length} checks passed`
);

if (failures.length > 0) {
  console.log(
    '\nValidation failed. Investigate failing checks before trusting the plan state.'
  );
  process.exit(1);
}

console.log('\nValidation succeeded.');
process.exit(0);
