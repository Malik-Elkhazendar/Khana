import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Password Reset Token Entity
 *
 * Stores one-time password reset tokens as HMAC hashes.
 * Raw token values are never persisted.
 */
@Entity({ name: 'password_reset_tokens' })
@Index('idx_password_reset_tokens_user', ['userId'])
@Index('idx_password_reset_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('idx_password_reset_tokens_expires_at', ['expiresAt'])
@Index('idx_password_reset_tokens_used_at', ['usedAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar', length: 128 })
  tokenHash!: string; // HMAC-SHA256 hex

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
