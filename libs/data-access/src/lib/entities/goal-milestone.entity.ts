import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum GoalMetric {
  REVENUE = 'REVENUE',
  OCCUPANCY = 'OCCUPANCY',
}

@Entity({ name: 'goal_milestones' })
@Index(
  'goal_milestones_tenant_metric_period_unique',
  ['tenantId', 'metric', 'periodMonth'],
  {
    unique: true,
  }
)
@Index('goal_milestones_tenant_reached_idx', ['tenantId', 'reachedAt'])
export class GoalMilestone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 20 })
  metric!: GoalMetric;

  @Column({ type: 'date' })
  periodMonth!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  target!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  actualAtReach!: number;

  @Column({ type: 'timestamptz' })
  reachedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
