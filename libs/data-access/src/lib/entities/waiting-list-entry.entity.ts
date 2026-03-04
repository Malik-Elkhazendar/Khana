import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WaitlistStatus } from '@khana/shared-dtos';
import { User } from './user.entity';
import { Facility } from './facility.entity';

@Entity({ name: 'waiting_list_entries' })
export class WaitingListEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  facilityId!: string;

  @ManyToOne(() => Facility, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility;

  @Column({ type: 'timestamptz' })
  desiredStartTime!: Date;

  @Column({ type: 'timestamptz' })
  desiredEndTime!: Date;

  @Column({
    type: 'enum',
    enum: WaitlistStatus,
    default: WaitlistStatus.WAITING,
  })
  status!: WaitlistStatus;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiredAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  fulfilledByBookingId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
