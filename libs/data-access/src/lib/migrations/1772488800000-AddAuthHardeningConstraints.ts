import { MigrationInterface, QueryRunner } from 'typeorm';

const RESERVED_TENANT_SLUGS = [
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'dashboard',
  'help',
  'internal',
  'login',
  'logout',
  'manager',
  'onboarding',
  'owner',
  'register',
  'root',
  'settings',
  'signup',
  'staff',
  'support',
  'system',
  'www',
];

export class AddAuthHardeningConstraints1772488800000
  implements MigrationInterface
{
  name = 'AddAuthHardeningConstraints1772488800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates: Array<{ tenantId: string; email: string }> =
      await queryRunner.query(`
        SELECT "tenantId", lower("email") AS "email"
        FROM "users"
        GROUP BY "tenantId", lower("email")
        HAVING COUNT(*) > 1
        LIMIT 1
      `);

    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      throw new Error(
        `Cannot enforce lowercase email constraint: duplicate emails exist for tenant ${duplicate.tenantId} and email ${duplicate.email}`
      );
    }

    await queryRunner.query(
      `UPDATE "users" SET "email" = lower(trim("email"))`
    );

    const reservedTenants: Array<{ id: string; slug: string }> =
      await queryRunner.query(`
        SELECT "id", "slug"
        FROM "tenants"
        WHERE "slug" IN (${RESERVED_TENANT_SLUGS.map(
          (slug) => `'${slug}'`
        ).join(', ')})
        ORDER BY "createdAt" ASC, "id" ASC
      `);

    for (const tenant of reservedTenants) {
      let candidateSlug = `${tenant.slug}-workspace`;
      let suffix = 2;

      // Ensure reserved-slug remapping remains unique.
      while (
        await queryRunner
          .query(
            `SELECT 1 FROM "tenants" WHERE "slug" = $1 AND "id" != $2 LIMIT 1`,
            [candidateSlug, tenant.id]
          )
          .then((rows) => rows.length > 0)
      ) {
        candidateSlug = `${tenant.slug}-workspace-${suffix}`;
        suffix += 1;
      }

      await queryRunner.query(
        `UPDATE "tenants" SET "slug" = $1 WHERE "id" = $2`,
        [candidateSlug, tenant.id]
      );
    }

    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"))`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_lowercase_chk" CHECK ("slug" = lower("slug"))`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_reserved_chk" CHECK ("slug" NOT IN (${RESERVED_TENANT_SLUGS.map(
        (slug) => `'${slug}'`
      ).join(', ')}))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "tenants_slug_reserved_chk"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "tenants_slug_format_chk"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "tenants_slug_lowercase_chk"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "users_email_lowercase_chk"`
    );
  }
}
