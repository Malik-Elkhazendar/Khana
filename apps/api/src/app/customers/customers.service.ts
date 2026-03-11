import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, Customer } from '@khana/data-access';
import { BookingStatus, CustomerSummaryDto } from '@khana/shared-dtos';
import { isValidSaudiPhone, normalizeSaudiPhone } from '@khana/shared-utils';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../logging';

const TAG_MAX_COUNT = 10;
const TAG_MAX_LENGTH = 30;
const INVALID_PHONE_MESSAGE = 'Invalid Saudi phone number format.';
const CUSTOMER_NOT_FOUND_MESSAGE = 'Customer not found';
const CUSTOMER_METRIC_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

/**
 * Owns tenant-scoped customer normalization, tag updates, and lightweight
 * customer metrics used by booking and waitlist flows.
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly appLogger: AppLoggerService
  ) {}

  async lookupByPhone(
    tenantId: string,
    phone: string
  ): Promise<Customer | null> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return null;
    }

    return this.customerRepository.findOne({
      where: {
        tenantId,
        phone: normalizedPhone,
      },
    });
  }

  async upsert(
    tenantId: string,
    name: string,
    phone: string
  ): Promise<Customer> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      throw new BadRequestException(INVALID_PHONE_MESSAGE);
    }

    const normalizedName = this.normalizeName(name);

    // Upsert by normalized phone so booking flows can write through without a
    // read-before-write race on first contact.
    await this.customerRepository
      .createQueryBuilder()
      .insert()
      .into(Customer)
      .values({
        tenantId,
        name: normalizedName,
        phone: normalizedPhone,
        isActive: true,
      })
      .onConflict(
        `("tenantId", "phone") DO UPDATE SET
        "name" = CASE
          WHEN COALESCE(NULLIF(BTRIM("customers"."name"), ''), 'Unknown Customer') = 'Unknown Customer'
            AND EXCLUDED."name" <> 'Unknown Customer'
          THEN EXCLUDED."name"
          ELSE "customers"."name"
        END,
        "updatedAt" = now()`
      )
      .execute();

    const saved = await this.customerRepository.findOne({
      where: {
        tenantId,
        phone: normalizedPhone,
      },
    });

    if (!saved) {
      throw new NotFoundException(CUSTOMER_NOT_FOUND_MESSAGE);
    }

    return saved;
  }

  async updateTags(
    tenantId: string,
    customerId: string,
    tags: string[]
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: {
        id: customerId,
        tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException(CUSTOMER_NOT_FOUND_MESSAGE);
    }

    customer.tags = this.normalizeTags(tags);
    const saved = await this.customerRepository.save(customer);

    this.appLogger.info(
      LOG_EVENTS.CUSTOMER_TAGS_UPDATED,
      'Customer tags updated',
      {
        customerId: saved.id,
        tenantId,
        tagsCount: saved.tags.length,
      }
    );

    return saved;
  }

  async getTenantTags(tenantId: string): Promise<string[]> {
    // Tags live in JSON arrays, so use raw SQL to flatten and dedupe them
    // inside the tenant boundary before returning them to the dashboard.
    const rows = await this.customerRepository.query(
      `
      SELECT DISTINCT tag_values.tag AS tag
      FROM "customers" AS customer
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(customer."tags") = 'array' THEN customer."tags"
          ELSE '[]'::jsonb
        END
      ) AS tag_values(tag)
      WHERE customer."tenantId" = $1
      ORDER BY tag_values.tag ASC
      `,
      [tenantId]
    );

    const unique = new Map<string, string>();
    for (const row of rows as Array<{ tag: string | null }>) {
      const value = row.tag?.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, value);
      }
    }

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }

  async toSummaryDto(customer: Customer): Promise<CustomerSummaryDto> {
    const metrics = await this.getCustomerMetrics(
      customer.tenantId,
      customer.phone
    );

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      totalBookings: metrics.totalBookings,
      totalSpend: metrics.totalSpend,
      lastBookingDate: metrics.lastBookingDate,
      tags: customer.tags ?? [],
    };
  }

  private normalizePhone(phone: string): string | null {
    const compact = phone?.replace(/\s+/g, '').trim() ?? '';
    if (!compact) {
      return null;
    }

    if (!isValidSaudiPhone(compact)) {
      return null;
    }

    return normalizeSaudiPhone(compact);
  }

  private async getCustomerMetrics(
    tenantId: string,
    normalizedPhone: string
  ): Promise<{
    totalBookings: number;
    totalSpend: number;
    lastBookingDate?: Date;
  }> {
    const phoneVariants = this.buildPhoneLookupVariants(normalizedPhone);

    const result = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('COUNT(booking.id)', 'totalBookings')
      .addSelect('COALESCE(SUM(booking.totalAmount), 0)', 'totalSpend')
      .addSelect('MAX(booking.startTime)', 'lastBookingDate')
      .innerJoin('booking.facility', 'facility')
      .where('facility.tenantId = :tenantId', { tenantId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: CUSTOMER_METRIC_BOOKING_STATUSES,
      })
      .andWhere('booking.customerPhone IN (:...phoneVariants)', {
        phoneVariants,
      })
      .getRawOne<{
        totalBookings: string | null;
        totalSpend: string | null;
        lastBookingDate: string | Date | null;
      }>();

    return {
      totalBookings: Number(result?.totalBookings ?? 0),
      totalSpend: Number(result?.totalSpend ?? 0),
      lastBookingDate: result?.lastBookingDate
        ? new Date(result.lastBookingDate)
        : undefined,
    };
  }

  private buildPhoneLookupVariants(normalizedPhone: string): string[] {
    const compact = normalizedPhone.trim();
    if (!compact) {
      return [];
    }

    const digits = compact.replace(/^\+/, '');
    const local = digits.startsWith('966') ? digits.slice(3) : digits;

    const variants = [
      compact,
      `+${digits}`,
      digits,
      `00${digits}`,
      local,
      local ? `0${local}` : '',
    ];

    return Array.from(
      new Set(
        variants
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );
  }

  private normalizeName(name: string): string {
    const normalized = name?.trim();
    if (normalized) {
      return normalized;
    }

    return 'Unknown Customer';
  }

  private normalizeTags(tags: string[]): string[] {
    const deduped = new Map<string, string>();

    for (const rawTag of tags ?? []) {
      const trimmed = rawTag?.trim().replace(/\s+/g, ' ');
      if (!trimmed) continue;
      const limited = trimmed.slice(0, TAG_MAX_LENGTH);
      const key = limited.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, limited);
      }
      if (deduped.size >= TAG_MAX_COUNT) {
        break;
      }
    }

    return Array.from(deduped.values());
  }
}
