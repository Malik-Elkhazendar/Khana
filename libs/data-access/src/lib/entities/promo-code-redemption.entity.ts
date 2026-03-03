import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PromoDiscountType } from '@khana/shared-dtos';
import { Tenant } from './tenant.entity';
import { PromoCode } from './promo-code.entity';
import { Booking } from './booking.entity';
import { User } from './user.entity';

@Entity({ name: 'promo_code_redemptions' })
@Index('promo_code_redemptions_booking_unique', ['bookingId'], { unique: true })
@Index('promo_code_redemptions_promo_redeemed_at_idx', [
  'promoCodeId',
  'redeemedAt',
])
export class PromoCodeRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  promoCodeId!: string;

  @ManyToOne(() => PromoCode, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode!: PromoCode;

  @Column({ type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => Booking, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking!: Booking;

  @Column({ type: 'uuid', nullable: true })
  redeemedByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'redeemedByUserId' })
  redeemedByUser!: User | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ type: 'varchar', length: 40 })
  codeSnapshot!: string;

  @Column({
    type: 'enum',
    enum: PromoDiscountType,
  })
  discountTypeSnapshot!: PromoDiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValueSnapshot!: number;

  @CreateDateColumn()
  redeemedAt!: Date;
}
