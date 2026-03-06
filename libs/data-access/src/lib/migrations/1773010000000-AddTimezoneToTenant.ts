import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimezoneToTenant1773010000000 implements MigrationInterface {
  name = 'AddTimezoneToTenant1773010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "timezone" character varying(100) NOT NULL DEFAULT 'Asia/Riyadh'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN "timezone"
    `);
  }
}
