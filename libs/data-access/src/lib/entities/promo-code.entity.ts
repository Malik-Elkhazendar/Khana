import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromoDiscountType, PromoFacilityScope } from '@khana/shared-dtos';
import { Tenant } from './tenant.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { PromoCodeRedemption } from './promo-code-redemption.entity';

@Entity({ name: 'promo_codes' })
@Index('promo_codes_tenant_code_unique', ['tenantId', 'code'], { unique: true })
@Index('promo_codes_tenant_scope_facility_idx', [
  'tenantId',
  'facilityScope',
  'facilityId',
])
@Index('promo_codes_tenant_active_expiry_idx', [
  'tenantId',
  'isActive',
  'expiresAt',
])
@Check(
  'promo_codes_scope_facility_chk',
  `(
    ("facilityScope" = 'ALL_FACILITIES' AND "facilityId" IS NULL)
    OR
    ("facilityScope" = 'SINGLE_FACILITY' AND "facilityId" IS NOT NULL)
  )`
)
@Check(
  'promo_codes_discount_value_chk',
  `(
    ("discountType" = 'PERCENTAGE' AND "discountValue" > 0 AND "discountValue" <= 100)
    OR
    ("discountType" = 'FIXED_AMOUNT' AND "discountValue" > 0)
  )`
)
@Check(
  'promo_codes_max_uses_positive_chk',
  `("maxUses" IS NULL OR "maxUses" > 0)`
)
@Check('promo_codes_code_uppercase_chk', `"code" = upper("code")`)
@Check('promo_codes_code_format_chk', `"code" ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'`)
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({
    type: 'enum',
    enum: PromoFacilityScope,
    default: PromoFacilityScope.ALL_FACILITIES,
  })
  facilityScope!: PromoFacilityScope;

  @Column({ type: 'uuid', nullable: true })
  facilityId!: string | null;

  @ManyToOne(() => Facility, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facilityId' })
  facility!: Facility | null;

  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @Column({
    type: 'enum',
    enum: PromoDiscountType,
  })
  discountType!: PromoDiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue!: number;

  @Column({ type: 'int', nullable: true })
  maxUses!: number | null;

  @Column({ type: 'int', default: 0 })
  currentUses!: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser!: User | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedByUserId' })
  updatedByUser!: User | null;

  @OneToMany(() => PromoCodeRedemption, (redemption) => redemption.promoCode)
  redemptions?: PromoCodeRedemption[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
