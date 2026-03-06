import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Facility } from './facility.entity';

@Entity({ name: 'tenants' })
@Index('tenants_slug_unique', ['slug'], { unique: true })
@Check('tenants_slug_lowercase_chk', `"slug" = lower("slug")`)
@Check('tenants_slug_format_chk', `"slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`)
@Check(
  'tenants_slug_reserved_chk',
  `"slug" NOT IN ('admin','api','app','auth','billing','dashboard','help','internal','login','logout','manager','onboarding','owner','register','root','settings','signup','staff','support','system','www')`
)
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'varchar', length: 50 })
  slug!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  businessType?: 'SPORTS' | 'RENTAL' | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contactPhone?: string | null;

  @Column({ type: 'varchar', length: 100, default: 'Asia/Riyadh' })
  timezone!: string;

  @Column({ type: 'boolean', default: false })
  onboardingCompleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  onboardingCompletedAt?: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthlyRevenueTarget?: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  monthlyOccupancyTarget?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  goalsNudgeShownAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  goalsNudgeDismissedAt?: Date | null;

  @OneToMany(() => Facility, (facility) => facility.tenant)
  facilities!: Facility[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
