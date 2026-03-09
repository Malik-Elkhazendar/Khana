import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, Customer, User } from '@khana/data-access';
import { BookingListItemDto } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { toBookingListItemDto } from './bookings-mapper.helpers';
import {
  isStaff,
  requireTenantId,
  requireUserId,
  requireUserRole,
  validateBookingOwnership,
} from './bookings-policy.helpers';
import { normalizeCustomerPhone } from './bookings-promo.helpers';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
} from './bookings.constants';

@Injectable()
export class GetBookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>
  ) {}

  async execute(
    tenantId: string,
    user: User,
    bookingId: string
  ): Promise<BookingListItemDto> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorRole = requireUserRole(
      user?.role,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorUserId = requireUserId(user?.id, BOOKINGS_ACCESS_DENIED_MESSAGE);

    const booking = await validateBookingOwnership({
      bookingRepository: this.bookingRepository,
      bookingId,
      tenantId: resolvedTenantId,
      resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
    });

    if (isStaff(actorRole) && booking.createdByUserId !== actorUserId) {
      throw new ForbiddenException(BOOKINGS_ACCESS_DENIED_MESSAGE);
    }

    const normalizedPhone = normalizeCustomerPhone(booking.customerPhone);
    let customerTags: string[] = [];

    if (normalizedPhone) {
      const customer = await this.customerRepository.findOne({
        select: ['id', 'tags'],
        where: {
          tenantId: resolvedTenantId,
          phone: normalizedPhone,
        },
      });
      customerTags = customer?.tags ?? [];
    }

    return toBookingListItemDto(booking, booking.facility, customerTags);
  }
}
