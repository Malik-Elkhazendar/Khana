/**
 * KHA-14 Plan Validator Agent
 *
 * Purpose:
 * - Validate that KHA-14 planning assumptions are grounded in real code (baseline mode)
 * - Validate that KHA-14 implementation targets exist after delivery (target mode)
 *
 * Usage:
 * - node -r @swc-node/register src/agents/validate-kha14-plan.agent.ts baseline
 * - node -r @swc-node/register src/agents/validate-kha14-plan.agent.ts target
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
    const isActiveColumn = has(
      'libs/data-access/src/lib/entities/facility.entity.ts',
      /@Column\(\{\s*type:\s*'boolean',\s*default:\s*true\s*\}\)\s*\n\s*isActive!:\s*boolean/
    );
    const configColumn = has(
      'libs/data-access/src/lib/entities/facility.entity.ts',
      /@Column\(\{\s*type:\s*'jsonb'\s*\}\)\s*\n\s*config!:\s*FacilityConfig/
    );
    checks.push({
      id: 'B1',
      pass: isActiveColumn.pass && configColumn.pass,
      message: 'Facility entity includes active flag and JSONB config.',
      evidence: `${isActiveColumn.evidence} | ${configColumn.evidence}`,
    });
  }

  {
    const endpoint = has(
      'apps/api/src/app/bookings/bookings.controller.ts',
      /@Get\('facilities'\)/
    );
    checks.push({
      id: 'B2',
      pass: endpoint.pass,
      message: 'Read-only facilities endpoint exists via bookings controller.',
      evidence: endpoint.evidence,
    });
  }

  {
    const moduleExists = fileExists(
      'apps/api/src/app/facilities/facilities.module.ts'
    );
    const controllerExists = fileExists(
      'apps/api/src/app/facilities/facilities.controller.ts'
    );
    const serviceExists = fileExists(
      'apps/api/src/app/facilities/facilities.service.ts'
    );
    checks.push({
      id: 'B3',
      pass: !moduleExists.pass && !controllerExists.pass && !serviceExists.pass,
      message:
        'Dedicated facilities API module/controller/service is not implemented yet.',
      evidence: `${moduleExists.evidence} | ${controllerExists.evidence} | ${serviceExists.evidence}`,
    });
  }

  {
    const appModuleImport = has(
      'apps/api/src/app/app.module.ts',
      /FacilitiesModule/
    );
    checks.push({
      id: 'B4',
      pass: !appModuleImport.pass,
      message: 'App module does not yet wire a FacilitiesModule.',
      evidence: appModuleImport.evidence,
    });
  }

  {
    const facilitiesPage = fileExists(
      'apps/manager-dashboard/src/app/features/facilities/facilities.component.ts'
    );
    const hasFormTag = has(
      'apps/manager-dashboard/src/app/features/facilities/facilities.component.html',
      /<form[\s>]/i
    );
    const hasSubmitHandler = has(
      'apps/manager-dashboard/src/app/features/facilities/facilities.component.ts',
      /\bonSubmit\(|\bsaveFacility\(|\bcreateFacility\(|\bupdateFacility\(/
    );
    checks.push({
      id: 'B5',
      pass: facilitiesPage.pass && !hasFormTag.pass && !hasSubmitHandler.pass,
      message:
        'Facilities UI exists but is read-only (no management form/actions).',
      evidence: `${facilitiesPage.evidence} | ${hasFormTag.evidence} | ${hasSubmitHandler.evidence}`,
    });
  }

  {
    const apiRead = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /\/v1\/bookings\/facilities/
    );
    const apiWrite = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /\bcreateFacility\(|\bupdateFacility\(|\bdeleteFacility\(|\bdeactivateFacility\(|\/v1\/facilities/
    );
    checks.push({
      id: 'B6',
      pass: apiRead.pass && !apiWrite.pass,
      message:
        'Frontend API layer supports facilities read, but no facilities CRUD methods.',
      evidence: `${apiRead.evidence} | ${apiWrite.evidence}`,
    });
  }

  {
    const route = has(
      'apps/manager-dashboard/src/app/app.routes.ts',
      /path:\s*'facilities'/
    );
    const nav = has(
      'apps/manager-dashboard/src/app/shared/navigation/dashboard-nav.ts',
      /route:\s*'\/dashboard\/facilities'/
    );
    checks.push({
      id: 'B7',
      pass: route.pass && nav.pass,
      message: 'Facilities route and dashboard navigation link already exist.',
      evidence: `${route.evidence} | ${nav.evidence}`,
    });
  }

  return checks;
};

const targetChecks = (): CheckResult[] => {
  const checks: CheckResult[] = [];

  {
    const moduleFile = fileExists(
      'apps/api/src/app/facilities/facilities.module.ts'
    );
    const controllerFile = fileExists(
      'apps/api/src/app/facilities/facilities.controller.ts'
    );
    const serviceFile = fileExists(
      'apps/api/src/app/facilities/facilities.service.ts'
    );
    checks.push({
      id: 'T1',
      pass: moduleFile.pass && controllerFile.pass && serviceFile.pass,
      message:
        'Facilities backend module/controller/service files are present.',
      evidence: `${moduleFile.evidence} | ${controllerFile.evidence} | ${serviceFile.evidence}`,
    });
  }

  {
    const appModule = has('apps/api/src/app/app.module.ts', /FacilitiesModule/);
    checks.push({
      id: 'T2',
      pass: appModule.pass,
      message: 'App module wires FacilitiesModule.',
      evidence: appModule.evidence,
    });
  }

  {
    const controllerPath = has(
      'apps/api/src/app/facilities/facilities.controller.ts',
      /@Controller\(\s*\{\s*path:\s*'facilities'/
    );
    const post = has(
      'apps/api/src/app/facilities/facilities.controller.ts',
      /@Post\(\)/
    );
    const getOne = has(
      'apps/api/src/app/facilities/facilities.controller.ts',
      /@Get\(':id'\)/
    );
    const patch = has(
      'apps/api/src/app/facilities/facilities.controller.ts',
      /@Patch\(':id'\)/
    );
    const del = has(
      'apps/api/src/app/facilities/facilities.controller.ts',
      /@Delete\(':id'\)/
    );
    checks.push({
      id: 'T3',
      pass:
        controllerPath.pass &&
        post.pass &&
        getOne.pass &&
        patch.pass &&
        del.pass,
      message: 'Facilities controller exposes required CRUD endpoints.',
      evidence: `${controllerPath.evidence} | ${post.evidence} | ${getOne.evidence} | ${patch.evidence} | ${del.evidence}`,
    });
  }

  {
    const auditUsage = has(
      'apps/api/src/app/facilities/facilities.service.ts',
      /AuditLog|logAudit|AuditAction/
    );
    checks.push({
      id: 'T4',
      pass: auditUsage.pass,
      message: 'Facilities mutations are audit-log aware.',
      evidence: auditUsage.evidence,
    });
  }

  {
    const activeFilter = has(
      'apps/api/src/app/bookings/bookings.service.ts',
      /where:\s*\{\s*tenant:\s*\{\s*id:\s*resolvedTenantId\s*\},\s*isActive:\s*true\s*\}/
    );
    checks.push({
      id: 'T5',
      pass: activeFilter.pass,
      message: 'Booking-facing facility list filters out inactive facilities.',
      evidence: activeFilter.evidence,
    });
  }

  {
    const apiCrud = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /\bcreateFacility\(|\bupdateFacility\(|\bdeleteFacility\(|\bdeactivateFacility\(|\/v1\/facilities/
    );
    checks.push({
      id: 'T6',
      pass: apiCrud.pass,
      message: 'Frontend API service includes facilities management endpoints.',
      evidence: apiCrud.evidence,
    });
  }

  {
    const formTag = has(
      'apps/manager-dashboard/src/app/features/facilities/facilities.component.html',
      /<form[\s>]/i
    );
    const submitHandler = has(
      'apps/manager-dashboard/src/app/features/facilities/facilities.component.ts',
      /\bonSubmit\(|\bsaveFacility\(|\bcreateFacility\(|\bupdateFacility\(/
    );
    checks.push({
      id: 'T7',
      pass: formTag.pass && submitHandler.pass,
      message: 'Facilities UI includes create/edit management form behavior.',
      evidence: `${formTag.evidence} | ${submitHandler.evidence}`,
    });
  }

  return checks;
};

const checks = mode === 'baseline' ? baselineChecks() : targetChecks();
const failures = checks.filter((check) => !check.pass);

console.log(`\nKHA-14 Plan Validator (${mode.toUpperCase()})`);
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
