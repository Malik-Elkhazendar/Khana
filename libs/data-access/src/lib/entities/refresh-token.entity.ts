import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Refresh Token Entity
 *
 * Stores per-token refresh metadata for rotation, reuse detection,
 * and device/session management.
 */
@Entity({ name: 'refresh_tokens' })
@Index('idx_refresh_tokens_user', ['userId'])
@Index('idx_refresh_tokens_session', ['sessionId'])
@Index('idx_refresh_tokens_user_revoked', ['userId', 'revokedAt'])
@Index('idx_refresh_tokens_cleanup', ['expiresAt', 'revokedAt'], {
  where: '"revokedAt" IS NOT NULL',
})
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // jti

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string; // sid

  @Column({ type: 'varchar', length: 128 })
  tokenHash!: string; // HMAC-SHA256 hex

  @Column({ type: 'timestamp' })
  issuedAt!: Date;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedByTokenId?: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceFingerprint?: string | null;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  user!: User;
}
