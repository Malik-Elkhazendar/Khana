import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { RefreshToken } from './refresh-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';

/**
 * User Entity
 *
 * Represents staff/admin users (not customers).
 * Scoped to tenant for multi-tenancy.
 * Password hashed with bcrypt.
 *
 * Security:
 * - password field has `select: false` to prevent accidental exposure
 * - Unique constraint: (email + tenantId) - allows same email across tenants
 */
@Entity({ name: 'users' })
@Index('users_tenant_idx', ['tenantId'])
@Index('users_email_idx', ['email'])
@Index('users_is_active_idx', ['isActive'])
@Index('users_email_tenant_unique', ['email', 'tenantId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Foreign key to tenant (multi-tenancy)
  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  // Bcrypt hashed password (never expose - select: false)
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  // Role-based access control (imported from shared-dtos)
  @Column({
    type: 'enum',
    enum: ['OWNER', 'MANAGER', 'STAFF', 'VIEWER'],
    default: 'STAFF',
  })
  role!: string;

  // User status
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Last login tracking (optional, for analytics)
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  // Soft delete for GDPR compliance
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Audit timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Refresh tokens (session management)
  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];

  // Password reset tokens
  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens?: PasswordResetToken[];
}
