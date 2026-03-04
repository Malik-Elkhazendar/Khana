import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoalsTracking1772840000000 implements MigrationInterface {
  name = 'AddGoalsTracking1772840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "monthlyRevenueTarget" numeric(10,2),
      ADD COLUMN "monthlyOccupancyTarget" numeric(5,2),
      ADD COLUMN "goalsNudgeShownAt" TIMESTAMP,
      ADD COLUMN "goalsNudgeDismissedAt" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_monthly_revenue_target_chk"
      CHECK ("monthlyRevenueTarget" IS NULL OR "monthlyRevenueTarget" >= 0.01)
    `);

    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_monthly_occupancy_target_chk"
      CHECK (
        "monthlyOccupancyTarget" IS NULL
        OR ("monthlyOccupancyTarget" >= 0.01 AND "monthlyOccupancyTarget" <= 100)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "goal_milestones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "metric" character varying(20) NOT NULL,
        "periodMonth" date NOT NULL,
        "target" numeric(10,2) NOT NULL,
        "actualAtReach" numeric(10,2) NOT NULL,
        "reachedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_goal_milestones_id" PRIMARY KEY ("id"),
        CONSTRAINT "goal_milestones_metric_chk" CHECK (
          "metric" IN ('REVENUE', 'OCCUPANCY')
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "goal_milestones_tenant_metric_period_unique"
      ON "goal_milestones" ("tenantId", "metric", "periodMonth")
    `);

    await queryRunner.query(`
      CREATE INDEX "goal_milestones_tenant_reached_idx"
      ON "goal_milestones" ("tenantId", "reachedAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "goal_milestones"
      ADD CONSTRAINT "FK_goal_milestones_tenant"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goal_milestones"
      DROP CONSTRAINT "FK_goal_milestones_tenant"
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."goal_milestones_tenant_reached_idx"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."goal_milestones_tenant_metric_period_unique"`
    );
    await queryRunner.query(`DROP TABLE "goal_milestones"`);

    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "tenants_monthly_occupancy_target_chk"`
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "tenants_monthly_revenue_target_chk"`
    );
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN "goalsNudgeDismissedAt",
      DROP COLUMN "goalsNudgeShownAt",
      DROP COLUMN "monthlyOccupancyTarget",
      DROP COLUMN "monthlyRevenueTarget"
    `);
  }
}
