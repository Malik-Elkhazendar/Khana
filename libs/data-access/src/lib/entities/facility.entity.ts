import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export type FacilityConfig = {
  pricePerHour: number;
  openTime: string;
  closeTime: string;
};

@Entity({ name: 'facilities' })
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'PADEL' })
  type!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => Tenant, (tenant) => tenant.facilities, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  tenant!: Tenant;

  @Column({ type: 'jsonb' })
  config!: FacilityConfig;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
