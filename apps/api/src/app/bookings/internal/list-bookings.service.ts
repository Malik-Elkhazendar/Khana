import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, Customer, Facility, User } from '@khana/data-access';
import { BookingListItemDto } from '@khana/shared-dtos';
import { In, Repository } from 'typeorm';
import { toBookingListItemDto } from './bookings-mapper.helpers';
import {
  isStaff,
  requireTenantId,
  requireUserId,
  requireUserRole,
  validateFacilityOwnership,
} from './bookings-policy.helpers';
import { normalizeCustomerPhone } from './bookings-promo.helpers';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_INACTIVE_FACILITY_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
} from './bookings.constants';

@Injectable()
export class ListBookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
  ) {}

  async execute(
    tenantId: string,
    user: User,
    facilityId?: string,
  ): Promise<BookingListItemDto[]> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE,
    );
    const actorRole = requireUserRole(
      user?.role,
      BOOKINGS_ACCESS_DENIED_MESSAGE,
    );
    const actorUserId = requireUserId(user?.id, BOOKINGS_ACCESS_DENIED_MESSAGE);

    if (facilityId) {
      await validateFacilityOwnership({
        facilityRepository: this.facilityRepository,
        facilityId,
        tenantId: resolvedTenantId,
        resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
        accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
        inactiveFacilityMessage: BOOKINGS_INACTIVE_FACILITY_MESSAGE,
      });
    }

    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.facility', 'facility')
      .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
      .orderBy('booking.startTime', 'DESC');

    if (facilityId) {
      query.andWhere('facility.id = :facilityId', { facilityId });
    }

    if (isStaff(actorRole)) {
      query.andWhere('booking.createdByUserId = :actorUserId', { actorUserId });
    }

    const bookings = await query.getMany();
    const normalizedPhones = Array.from(
      new Set(
        bookings
          .map((booking) => normalizeCustomerPhone(booking.customerPhone))
          .filter((phone): phone is string => Boolean(phone)),
      ),
    );

    const customerTagMap = new Map<string, string[]>();
    if (normalizedPhones.length > 0) {
      const customers = await this.customerRepository.find({
        select: ['phone', 'tags'],
        where: {
          tenantId: resolvedTenantId,
          phone: In(normalizedPhones),
        },
      });

      for (const customer of customers) {
        customerTagMap.set(customer.phone, customer.tags ?? []);
      }
    }

    return bookings.map((booking) => {
      const normalizedPhone = normalizeCustomerPhone(booking.customerPhone);
      const customerTags =
        normalizedPhone && customerTagMap.has(normalizedPhone)
          ? (customerTagMap.get(normalizedPhone) ?? [])
          : [];

      return toBookingListItemDto(booking, booking.facility, customerTags);
    });
  }
}
