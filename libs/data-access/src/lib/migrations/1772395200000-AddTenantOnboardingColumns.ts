import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantOnboardingColumns1772395200000
  implements MigrationInterface
{
  name = 'AddTenantOnboardingColumns1772395200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "businessType" character varying(20)`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "contactEmail" character varying(255)`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "contactPhone" character varying(40)`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "onboardingCompleted" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "onboardingCompletedAt" TIMESTAMP`
    );

    await queryRunner.query(`
      UPDATE "tenants" AS t
      SET "onboardingCompleted" = true,
          "onboardingCompletedAt" = now()
      WHERE EXISTS (
        SELECT 1 FROM "facilities" AS f
        WHERE f."tenantId" = t."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "onboardingCompletedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN "onboardingCompleted"`
    );
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "contactPhone"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "contactEmail"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "businessType"`);
  }
}
