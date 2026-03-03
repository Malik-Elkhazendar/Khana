import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromoCodes1772751600000 implements MigrationInterface {
  name = 'AddPromoCodes1772751600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."promo_codes_discounttype_enum"
      AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."promo_codes_facilityscope_enum"
      AS ENUM('ALL_FACILITIES', 'SINGLE_FACILITY')
    `);

    await queryRunner.query(`
      CREATE TABLE "promo_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "facilityScope" "public"."promo_codes_facilityscope_enum" NOT NULL DEFAULT 'ALL_FACILITIES',
        "facilityId" uuid,
        "code" character varying(40) NOT NULL,
        "discountType" "public"."promo_codes_discounttype_enum" NOT NULL,
        "discountValue" numeric(10,2) NOT NULL,
        "maxUses" integer,
        "currentUses" integer NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByUserId" uuid,
        "updatedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promo_codes_id" PRIMARY KEY ("id"),
        CONSTRAINT "promo_codes_scope_facility_chk" CHECK (
          (
            "facilityScope" = 'ALL_FACILITIES'
            AND "facilityId" IS NULL
          )
          OR
          (
            "facilityScope" = 'SINGLE_FACILITY'
            AND "facilityId" IS NOT NULL
          )
        ),
        CONSTRAINT "promo_codes_discount_value_chk" CHECK (
          (
            "discountType" = 'PERCENTAGE'
            AND "discountValue" > 0
            AND "discountValue" <= 100
          )
          OR
          (
            "discountType" = 'FIXED_AMOUNT'
            AND "discountValue" > 0
          )
        ),
        CONSTRAINT "promo_codes_max_uses_positive_chk" CHECK (
          "maxUses" IS NULL OR "maxUses" > 0
        ),
        CONSTRAINT "promo_codes_code_uppercase_chk" CHECK (
          "code" = upper("code")
        ),
        CONSTRAINT "promo_codes_code_format_chk" CHECK (
          "code" ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "promo_codes_tenant_code_unique"
      ON "promo_codes" ("tenantId", "code")
    `);

    await queryRunner.query(`
      CREATE INDEX "promo_codes_tenant_scope_facility_idx"
      ON "promo_codes" ("tenantId", "facilityScope", "facilityId")
    `);

    await queryRunner.query(`
      CREATE INDEX "promo_codes_tenant_active_expiry_idx"
      ON "promo_codes" ("tenantId", "isActive", "expiresAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "promo_code_redemptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "promoCodeId" uuid NOT NULL,
        "bookingId" uuid NOT NULL,
        "redeemedByUserId" uuid,
        "discountAmount" numeric(10,2) NOT NULL,
        "codeSnapshot" character varying(40) NOT NULL,
        "discountTypeSnapshot" "public"."promo_codes_discounttype_enum" NOT NULL,
        "discountValueSnapshot" numeric(10,2) NOT NULL,
        "redeemedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promo_code_redemptions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "promo_code_redemptions_booking_unique"
      ON "promo_code_redemptions" ("bookingId")
    `);

    await queryRunner.query(`
      CREATE INDEX "promo_code_redemptions_promo_redeemed_at_idx"
      ON "promo_code_redemptions" ("promoCodeId", "redeemedAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      ADD CONSTRAINT "FK_promo_codes_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      ADD CONSTRAINT "FK_promo_codes_facility"
      FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      ADD CONSTRAINT "FK_promo_codes_created_by"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      ADD CONSTRAINT "FK_promo_codes_updated_by"
      FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      ADD CONSTRAINT "FK_promo_code_redemptions_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      ADD CONSTRAINT "FK_promo_code_redemptions_promo_code"
      FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      ADD CONSTRAINT "FK_promo_code_redemptions_booking"
      FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      ADD CONSTRAINT "FK_promo_code_redemptions_user"
      FOREIGN KEY ("redeemedByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      DROP CONSTRAINT "FK_promo_code_redemptions_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      DROP CONSTRAINT "FK_promo_code_redemptions_booking"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      DROP CONSTRAINT "FK_promo_code_redemptions_promo_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_code_redemptions"
      DROP CONSTRAINT "FK_promo_code_redemptions_tenant"
    `);

    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP CONSTRAINT "FK_promo_codes_updated_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP CONSTRAINT "FK_promo_codes_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP CONSTRAINT "FK_promo_codes_facility"
    `);
    await queryRunner.query(`
      ALTER TABLE "promo_codes"
      DROP CONSTRAINT "FK_promo_codes_tenant"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."promo_code_redemptions_promo_redeemed_at_idx"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."promo_code_redemptions_booking_unique"`
    );
    await queryRunner.query(`DROP TABLE "promo_code_redemptions"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."promo_codes_tenant_active_expiry_idx"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."promo_codes_tenant_scope_facility_idx"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."promo_codes_tenant_code_unique"`
    );
    await queryRunner.query(`DROP TABLE "promo_codes"`);

    await queryRunner.query(
      `DROP TYPE "public"."promo_codes_facilityscope_enum"`
    );
    await queryRunner.query(
      `DROP TYPE "public"."promo_codes_discounttype_enum"`
    );
  }
}
