import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BookingStatus,
  PaymentStatus,
  PriceBreakdown,
} from '@khana/shared-dtos';
import { Facility } from './facility.entity';
import { User } from './user.entity';

@Entity({ name: 'bookings' })
@Index('bookings_created_by_user_id_idx', ['createdByUserId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, nullable: true })
  bookingReference?: string;

  @ManyToOne(() => Facility, { nullable: false, onDelete: 'CASCADE' })
  facility!: Facility;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: User | null;

  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @Column({ type: 'timestamptz' })
  endTime!: Date;

  @Column({ type: 'text' })
  customerName!: string;

  @Column({ type: 'text' })
  customerPhone!: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status!: BookingStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ type: 'text', default: 'SAR' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  priceBreakdown?: PriceBreakdown;

  @Column({ type: 'timestamptz', nullable: true })
  holdUntil?: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
