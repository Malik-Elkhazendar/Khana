import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  BookingStatus,
  ConflictType,
  PaymentStatus,
  PromoDiscountType,
  PromoValidationReason,
  RecurrenceFrequency,
} from '@khana/shared-dtos';

export class BookingFacilityListItemDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Court 1' })
  name!: string;

  @ApiProperty({ example: '08:00' })
  openTime!: string;

  @ApiProperty({ example: '23:00' })
  closeTime!: string;

  @ApiProperty({ example: 60 })
  slotDurationMinutes!: number;

  @ApiProperty({ example: 180 })
  basePrice!: number;

  @ApiProperty({ example: 'SAR' })
  currency!: string;
}

export class BookingFacilityConfigSummaryDoc {
  @ApiPropertyOptional({ example: 180 })
  pricePerHour?: number;
}

export class BookingFacilityReferenceDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Court 1' })
  name!: string;

  @ApiPropertyOptional({ type: () => BookingFacilityConfigSummaryDoc })
  config?: BookingFacilityConfigSummaryDoc;
}

export class BookingRecurrenceRuleDoc {
  @ApiProperty({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.WEEKLY,
  })
  frequency!: RecurrenceFrequency;

  @ApiProperty({ example: 1 })
  intervalWeeks!: number;

  @ApiPropertyOptional({ example: '2026-04-30' })
  endsAtDate?: string;

  @ApiPropertyOptional({ example: 8 })
  occurrences?: number;
}

export class PriceBreakdownDoc {
  @ApiProperty({ example: 180 })
  basePrice!: number;

  @ApiProperty({ example: 1 })
  timeMultiplier!: number;

  @ApiProperty({ example: 1 })
  dayMultiplier!: number;

  @ApiProperty({ example: 0 })
  durationDiscount!: number;

  @ApiProperty({ example: 180 })
  subtotal!: number;

  @ApiProperty({ example: 18 })
  discountAmount!: number;

  @ApiPropertyOptional({ example: 18 })
  promoDiscount?: number;

  @ApiPropertyOptional({ example: 'SAVE10' })
  promoCode?: string;

  @ApiPropertyOptional({ example: 0 })
  taxAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  taxPercentage?: number;

  @ApiProperty({ example: 162 })
  total!: number;

  @ApiProperty({ example: 'SAR' })
  currency!: string;
}

export class PromoValidationDoc {
  @ApiProperty({ example: 'SAVE10' })
  code!: string;

  @ApiProperty({ example: true })
  isValid!: boolean;

  @ApiPropertyOptional({ enum: PromoValidationReason })
  reason?: PromoValidationReason;

  @ApiPropertyOptional({ format: 'uuid' })
  promoCodeId?: string;

  @ApiPropertyOptional({ enum: PromoDiscountType })
  discountType?: PromoDiscountType;

  @ApiPropertyOptional({ example: 10 })
  discountValue?: number;

  @ApiPropertyOptional({ example: 18 })
  discountAmount?: number;
}

export class BookingConflictSlotDoc {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T18:00:00.000Z',
  })
  startTime!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T19:00:00.000Z',
  })
  endTime!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;

  @ApiPropertyOptional({ example: 'BKG-20260315-001' })
  bookingReference?: string;
}

export class BookingConflictDoc {
  @ApiProperty({ example: true })
  hasConflict!: boolean;

  @ApiPropertyOptional({ enum: ConflictType })
  conflictType?: ConflictType;

  @ApiProperty({
    example: 'The selected slot overlaps with an existing booking.',
  })
  message!: string;

  @ApiProperty({ type: () => BookingConflictSlotDoc, isArray: true })
  conflictingSlots!: BookingConflictSlotDoc[];
}

export class AlternativeSlotDoc {
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T19:00:00.000Z',
  })
  startTime!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T20:00:00.000Z',
  })
  endTime!: string;

  @ApiProperty({ example: 180 })
  price!: number;

  @ApiProperty({ example: 'SAR' })
  currency!: string;
}

export class BookingPreviewResponseDoc {
  @ApiProperty({ example: true })
  canBook!: boolean;

  @ApiProperty({ type: () => PriceBreakdownDoc })
  priceBreakdown!: PriceBreakdownDoc;

  @ApiPropertyOptional({ type: () => PromoValidationDoc })
  promoValidation?: PromoValidationDoc;

  @ApiPropertyOptional({ type: () => BookingConflictDoc })
  conflict?: BookingConflictDoc;

  @ApiPropertyOptional({ type: () => AlternativeSlotDoc, isArray: true })
  suggestedAlternatives?: AlternativeSlotDoc[];

  @ApiPropertyOptional({ type: String, isArray: true })
  validationErrors?: string[];
}

export class BookingListItemDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ example: 'BKG-20260315-001' })
  bookingReference?: string;

  @ApiProperty({ type: () => BookingFacilityReferenceDoc })
  facility!: BookingFacilityReferenceDoc;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T18:00:00.000Z',
  })
  startTime!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-15T19:00:00.000Z',
  })
  endTime!: string;

  @ApiProperty({ example: 'Fahad Alharbi' })
  customerName!: string;

  @ApiProperty({ example: '+966500000000' })
  customerPhone!: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  customerTags?: string[];

  @ApiPropertyOptional({
    oneOf: [{ type: 'number' }, { type: 'string' }],
    example: 180,
  })
  totalAmount?: number | string;

  @ApiPropertyOptional({ example: 'SAR' })
  currency?: string;

  @ApiPropertyOptional({ type: () => PriceBreakdownDoc })
  priceBreakdown?: PriceBreakdownDoc;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  holdUntil?: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancellationReason?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  recurrenceGroupId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  recurrenceInstanceNumber?: number | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: false,
    allOf: [{ $ref: getSchemaPath(BookingRecurrenceRuleDoc) }],
    nullable: true,
  })
  recurrenceRule?: BookingRecurrenceRuleDoc | null;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CONFIRMED })
  status!: BookingStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-01T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-03-11T08:30:00.000Z',
  })
  updatedAt!: string;
}

export class CreateRecurringBookingResponseDoc {
  @ApiProperty({ format: 'uuid' })
  recurrenceGroupId!: string;

  @ApiProperty({ example: 8 })
  createdCount!: number;

  @ApiProperty({ type: () => BookingListItemDoc, isArray: true })
  bookings!: BookingListItemDoc[];
}
