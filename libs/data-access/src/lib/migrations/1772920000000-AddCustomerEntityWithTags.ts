import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerEntityWithTags1772920000000
  implements MigrationInterface
{
  name = 'AddCustomerEntityWithTags1772920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "name" text NOT NULL,
        "phone" character varying(30) NOT NULL,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "customers_tenant_phone_unique"
      ON "customers" ("tenantId", "phone")
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD CONSTRAINT "FK_customers_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      WITH normalized_bookings AS (
        SELECT
          f."tenantId" AS "tenantId",
          b."customerName" AS "name",
          CASE
            WHEN cleaned_phone ~ '^\\+9665\\d{8}$' THEN cleaned_phone
            WHEN cleaned_phone ~ '^009665\\d{8}$' THEN '+966' || substring(cleaned_phone FROM 6)
            WHEN cleaned_phone ~ '^9665\\d{8}$' THEN '+' || cleaned_phone
            WHEN cleaned_phone ~ '^05\\d{8}$' THEN '+966' || substring(cleaned_phone FROM 2)
            WHEN cleaned_phone ~ '^5\\d{8}$' THEN '+966' || cleaned_phone
            ELSE NULL
          END AS "normalizedPhone",
          b."updatedAt" AS "updatedAt"
        FROM (
          SELECT
            "facilityId",
            "customerName",
            "updatedAt",
            regexp_replace(trim("customerPhone"), '\\s+', '', 'g') AS cleaned_phone
          FROM "bookings"
          WHERE "customerPhone" IS NOT NULL
            AND trim("customerPhone") <> ''
        ) AS b
        INNER JOIN "facilities" f
          ON f."id" = b."facilityId"
      ),
      dedup AS (
        SELECT DISTINCT ON ("tenantId", "normalizedPhone")
          "tenantId",
          "name",
          "normalizedPhone"
        FROM normalized_bookings
        WHERE "normalizedPhone" IS NOT NULL
        ORDER BY "tenantId", "normalizedPhone", "updatedAt" DESC
      )
      INSERT INTO "customers" ("tenantId", "name", "phone", "tags", "isActive")
      SELECT
        "tenantId",
        nullif(trim("name"), '') AS "name",
        "normalizedPhone",
        '[]'::jsonb,
        true
      FROM dedup
      WHERE nullif(trim("name"), '') IS NOT NULL
      ON CONFLICT ("tenantId", "phone")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "updatedAt" = now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP CONSTRAINT "FK_customers_tenant"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."customers_tenant_phone_unique"`
    );
    await queryRunner.query(`DROP TABLE "customers"`);
  }
}
