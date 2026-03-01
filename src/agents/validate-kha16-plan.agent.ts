/**
 * KHA-16 Plan Validator Agent
 *
 * Purpose:
 * - Validate KHA-16 planning assumptions against current code (baseline mode)
 * - Validate KHA-16 implementation targets after delivery (target mode)
 *
 * Usage:
 * - node -r @swc-node/register src/agents/validate-kha16-plan.agent.ts baseline
 * - node -r @swc-node/register src/agents/validate-kha16-plan.agent.ts target
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
  pattern: string | RegExp
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

  return {
    pass,
    evidence: pass
      ? `${relativePath}: matched ${String(pattern)}`
      : `${relativePath}: did not match ${String(pattern)}`,
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
    const bookingEntity = has(
      'libs/data-access/src/lib/entities/booking.entity.ts',
      /recurrenceRule|recurrenceGroupId|recurrenceInstanceNumber/
    );
    checks.push({
      id: 'B1',
      pass: !bookingEntity.pass,
      message:
        'Booking entity does not yet have recurring booking persistence fields.',
      evidence: bookingEntity.evidence,
    });
  }

  {
    const recurringDto = fileExists(
      'apps/api/src/app/bookings/dto/create-recurring-booking.dto.ts'
    );
    const recurringEndpoint = has(
      'apps/api/src/app/bookings/bookings.controller.ts',
      /@Post\('recurring'\)/
    );
    checks.push({
      id: 'B2',
      pass: !recurringDto.pass && !recurringEndpoint.pass,
      message: 'Recurring booking endpoint is not implemented yet.',
      evidence: `${recurringDto.evidence} | ${recurringEndpoint.evidence}`,
    });
  }

  {
    const statusScope = has(
      'apps/api/src/app/bookings/dto/update-booking-status.dto.ts',
      /cancellationScope/
    );
    checks.push({
      id: 'B3',
      pass: !statusScope.pass,
      message: 'Cancellation scope is not yet part of booking status updates.',
      evidence: statusScope.evidence,
    });
  }

  {
    const apiServiceRecurring = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /createRecurringBooking\(|\/v1\/bookings\/recurring/
    );
    checks.push({
      id: 'B4',
      pass: !apiServiceRecurring.pass,
      message: 'Frontend API service has no recurring booking endpoint yet.',
      evidence: apiServiceRecurring.evidence,
    });
  }

  {
    const previewRepeatUi = has(
      'apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.html',
      /repeatWeekly|RECURRENCE/
    );
    checks.push({
      id: 'B5',
      pass: !previewRepeatUi.pass,
      message: 'Booking preview UI has no recurrence controls yet.',
      evidence: previewRepeatUi.evidence,
    });
  }

  return checks;
};

const targetChecks = (): CheckResult[] => {
  const checks: CheckResult[] = [];

  {
    const bookingEntity = has(
      'libs/data-access/src/lib/entities/booking.entity.ts',
      /recurrenceRule[\s\S]*recurrenceGroupId[\s\S]*recurrenceInstanceNumber/
    );
    checks.push({
      id: 'T1',
      pass: bookingEntity.pass,
      message: 'Booking entity includes recurring fields.',
      evidence: bookingEntity.evidence,
    });
  }

  {
    const dtoExists = fileExists(
      'apps/api/src/app/bookings/dto/create-recurring-booking.dto.ts'
    );
    const controller = has(
      'apps/api/src/app/bookings/bookings.controller.ts',
      /@Post\('recurring'\)/
    );
    const service = has(
      'apps/api/src/app/bookings/bookings.service.ts',
      /createRecurringBookings\(/
    );
    checks.push({
      id: 'T2',
      pass: dtoExists.pass && controller.pass && service.pass,
      message: 'Recurring booking endpoint and service flow are implemented.',
      evidence: `${dtoExists.evidence} | ${controller.evidence} | ${service.evidence}`,
    });
  }

  {
    const cancelScopeDto = has(
      'apps/api/src/app/bookings/dto/update-booking-status.dto.ts',
      /cancellationScope/
    );
    const cancelScopeService = has(
      'apps/api/src/app/bookings/bookings.service.ts',
      /THIS_AND_FUTURE|cancelRecurringSeriesFromInstance/
    );
    checks.push({
      id: 'T3',
      pass: cancelScopeDto.pass && cancelScopeService.pass,
      message: 'Cancel single vs future-series behavior is implemented.',
      evidence: `${cancelScopeDto.evidence} | ${cancelScopeService.evidence}`,
    });
  }

  {
    const serviceAudit = has(
      'apps/api/src/app/bookings/bookings.service.ts',
      /AuditLog|logAudit|AuditAction/
    );
    checks.push({
      id: 'T4',
      pass: serviceAudit.pass,
      message: 'Booking recurring mutations are audit-logged.',
      evidence: serviceAudit.evidence,
    });
  }

  {
    const apiServiceRecurring = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /createRecurringBooking\(|\/v1\/bookings\/recurring/
    );
    const apiScope = has(
      'apps/manager-dashboard/src/app/shared/services/api.service.ts',
      /cancellationScope/
    );
    checks.push({
      id: 'T5',
      pass: apiServiceRecurring.pass && apiScope.pass,
      message:
        'Frontend API service supports recurring create and cancellation scope.',
      evidence: `${apiServiceRecurring.evidence} | ${apiScope.evidence}`,
    });
  }

  {
    const previewUi = has(
      'apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.html',
      /repeatWeekly|recurrenceFrequency|recurrenceEndMode|recurrenceEndDate/
    );
    const previewTs = has(
      'apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.ts',
      /repeatWeekly|recurrenceFrequency|createRecurringBooking/
    );
    checks.push({
      id: 'T6',
      pass: previewUi.pass && previewTs.pass,
      message: 'Booking preview includes recurring booking controls and flow.',
      evidence: `${previewUi.evidence} | ${previewTs.evidence}`,
    });
  }

  {
    const calendarIndicator = has(
      'apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.html',
      /RECURRING|recurrenceGroupId/
    );
    const scopeUi = has(
      'apps/manager-dashboard/src/app/features/booking-list/booking-list.component.html',
      /CANCEL_SCOPE/
    );
    checks.push({
      id: 'T7',
      pass: calendarIndicator.pass && scopeUi.pass,
      message:
        'Calendar recurring indicator and cancel-scope dialogs are present.',
      evidence: `${calendarIndicator.evidence} | ${scopeUi.evidence}`,
    });
  }

  return checks;
};

const checks = mode === 'baseline' ? baselineChecks() : targetChecks();
const failures = checks.filter((check) => !check.pass);

console.log(`\nKHA-16 Plan Validator (${mode.toUpperCase()})`);
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
