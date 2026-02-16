import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

/**
 * Audit Action Enum
 *
 * Defines types of actions that can be audited
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
}

/**
 * AuditLog Entity
 *
 * Immutable audit trail for compliance.
 * Records all mutations and authentication events.
 *
 * Design:
 * - Immutable: only CREATE operations, never UPDATE/DELETE
 * - JSONB for flexible change tracking
 * - Indexed by tenant, user, date, action for fast querying
 * - User can be deleted, but audit entry remains (SET NULL)
 */
@Entity({ name: 'audit_logs' })
@Index('audit_logs_tenant_idx', ['tenantId'])
@Index('audit_logs_user_idx', ['userId'])
@Index('audit_logs_created_at_idx', ['createdAt'])
@Index('audit_logs_action_idx', ['action'])
@Index('audit_logs_tenant_user_date_idx', ['tenantId', 'userId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  tenant!: Tenant;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user?: User;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string; // e.g., 'Booking', 'User', 'Facility'

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown>; // Before/after values

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;

  // NOTE: No updatedAt or deletedAt - audit logs are immutable
}
