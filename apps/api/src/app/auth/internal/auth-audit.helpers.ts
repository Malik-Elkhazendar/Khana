import { AuditAction, AuditLog } from '@khana/data-access';
import { MoreThan, Repository } from 'typeorm';

export type AuthAuditParams = {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export async function saveAuthAuditLog(
  auditRepository: Repository<AuditLog>,
  params: AuthAuditParams
): Promise<void> {
  const auditLog = auditRepository.create({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    changes: params.changes,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await auditRepository.save(auditLog);
}

export async function countRecentSecurityIncidents(
  auditRepository: Repository<AuditLog>,
  userId: string,
  windowMinutes = 60
): Promise<number> {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  return auditRepository.count({
    where: {
      userId,
      action: AuditAction.SECURITY_INCIDENT,
      createdAt: MoreThan(cutoff),
    },
  });
}
