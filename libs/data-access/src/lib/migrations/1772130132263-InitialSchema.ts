import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1772130132263 implements MigrationInterface {
  name = 'InitialSchema1772130132263';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "facilities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "type" text NOT NULL DEFAULT 'PADEL', "isActive" boolean NOT NULL DEFAULT true, "config" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid NOT NULL, CONSTRAINT "PK_2e6c685b2e1195e6d6394a22bc7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "sessionId" uuid NOT NULL, "tokenHash" character varying(128) NOT NULL, "issuedAt" TIMESTAMP NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "replacedByTokenId" uuid, "ipAddress" character varying(45), "userAgent" text, "deviceFingerprint" character varying(255), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_cleanup" ON "refresh_tokens" ("expiresAt", "revokedAt") WHERE "revokedAt" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_revoked" ON "refresh_tokens" ("userId", "revokedAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_session" ON "refresh_tokens" ("sessionId") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(128) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "ipAddress" character varying(45), "userAgent" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_used_at" ON "password_reset_tokens" ("usedAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expiresAt") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" ("tokenHash") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" ("userId") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('OWNER', 'MANAGER', 'STAFF', 'VIEWER')`
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "email" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "phone" character varying(20), "passwordHash" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'STAFF', "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP, "deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_tenant_unique" ON "users" ("email", "tenantId") `
    );
    await queryRunner.query(
      `CREATE INDEX "users_is_active_idx" ON "users" ("isActive") `
    );
    await queryRunner.query(
      `CREATE INDEX "users_email_idx" ON "users" ("email") `
    );
    await queryRunner.query(
      `CREATE INDEX "users_tenant_idx" ON "users" ("tenantId") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_paymentstatus_enum" AS ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')`
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingReference" text, "createdByUserId" uuid, "startTime" TIMESTAMP WITH TIME ZONE NOT NULL, "endTime" TIMESTAMP WITH TIME ZONE NOT NULL, "customerName" text NOT NULL, "customerPhone" text NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'CONFIRMED', "paymentStatus" "public"."bookings_paymentstatus_enum" NOT NULL DEFAULT 'PENDING', "totalAmount" numeric(10,2) NOT NULL DEFAULT '0', "currency" text NOT NULL DEFAULT 'SAR', "priceBreakdown" jsonb, "holdUntil" TIMESTAMP WITH TIME ZONE, "cancellationReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "facilityId" uuid NOT NULL, CONSTRAINT "UQ_efae15c3deed139b3a0ce03f69c" UNIQUE ("bookingReference"), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "bookings_created_by_user_id_idx" ON "bookings" ("createdByUserId") `
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SECURITY_INCIDENT')`
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "userId" uuid, "action" "public"."audit_logs_action_enum" NOT NULL, "entityType" character varying(100) NOT NULL, "entityId" uuid NOT NULL, "changes" jsonb, "ipAddress" character varying, "userAgent" character varying, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_tenant_user_date_idx" ON "audit_logs" ("tenantId", "userId", "createdAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action") `
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("createdAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_user_idx" ON "audit_logs" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" ("tenantId") `
    );
    await queryRunner.query(
      `ALTER TABLE "facilities" ADD CONSTRAINT "FK_9eda14f150cbfe9ffac80c2a36e" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_c58f7e88c286e5e3478960a998b" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_26ac8c3a8ad4bf675fab70e46ff" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_200a877cc1d50fa78a2b65e95b1" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_889633a4291bcb0bf4680fff234" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_cfa83f61e4d27a87fcae1e025ab"`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_889633a4291bcb0bf4680fff234"`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_200a877cc1d50fa78a2b65e95b1"`
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_26ac8c3a8ad4bf675fab70e46ff"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_c58f7e88c286e5e3478960a998b"`
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2"`
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`
    );
    await queryRunner.query(
      `ALTER TABLE "facilities" DROP CONSTRAINT "FK_9eda14f150cbfe9ffac80c2a36e"`
    );
    await queryRunner.query(`DROP INDEX "public"."audit_logs_tenant_idx"`);
    await queryRunner.query(`DROP INDEX "public"."audit_logs_user_idx"`);
    await queryRunner.query(`DROP INDEX "public"."audit_logs_created_at_idx"`);
    await queryRunner.query(`DROP INDEX "public"."audit_logs_action_idx"`);
    await queryRunner.query(
      `DROP INDEX "public"."audit_logs_tenant_user_date_idx"`
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."bookings_created_by_user_id_idx"`
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."users_tenant_idx"`);
    await queryRunner.query(`DROP INDEX "public"."users_email_idx"`);
    await queryRunner.query(`DROP INDEX "public"."users_is_active_idx"`);
    await queryRunner.query(`DROP INDEX "public"."users_email_tenant_unique"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_user"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_token_hash"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_expires_at"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_password_reset_tokens_used_at"`
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_session"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_refresh_tokens_user_revoked"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_cleanup"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TABLE "facilities"`);
  }
}
