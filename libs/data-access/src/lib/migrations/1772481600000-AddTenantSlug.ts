import { MigrationInterface, QueryRunner } from 'typeorm';

const MAX_SLUG_LENGTH = 50;

function slugify(value: string): string {
  const normalized = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

function withSuffix(baseSlug: string, suffix: number): string {
  const suffixToken = `-${suffix}`;
  const trimmedBase = baseSlug.slice(
    0,
    Math.max(1, MAX_SLUG_LENGTH - suffixToken.length)
  );
  return `${trimmedBase}${suffixToken}`;
}

export class AddTenantSlug1772481600000 implements MigrationInterface {
  name = 'AddTenantSlug1772481600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD "slug" character varying(50)`
    );

    const rows: Array<{ id: string; name: string }> = await queryRunner.query(
      `SELECT "id", "name" FROM "tenants" ORDER BY "createdAt" ASC, "id" ASC`
    );

    const usedSlugs = new Set<string>();

    for (const row of rows) {
      const fallback = `workspace-${String(row.id).slice(0, 8).toLowerCase()}`;
      const baseSlug = slugify(row.name) || fallback;

      let candidate = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(candidate)) {
        candidate = withSuffix(baseSlug, suffix);
        suffix += 1;
      }

      usedSlugs.add(candidate);
      await queryRunner.query(
        `UPDATE "tenants" SET "slug" = $1 WHERE "id" = $2`,
        [candidate, row.id]
      );
    }

    await queryRunner.query(
      `ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "tenants_slug_unique" ON "tenants" ("slug")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."tenants_slug_unique"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "slug"`);
  }
}
