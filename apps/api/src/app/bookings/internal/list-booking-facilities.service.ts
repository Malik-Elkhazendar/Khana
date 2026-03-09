import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Facility } from '@khana/data-access';
import { Repository } from 'typeorm';
import { requireTenantId } from './bookings-policy.helpers';
import { BOOKINGS_ACCESS_DENIED_MESSAGE } from './bookings.constants';

@Injectable()
export class ListBookingFacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>
  ) {}

  async execute(tenantId: string) {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const facilities = await this.facilityRepository.find({
      where: { tenant: { id: resolvedTenantId }, isActive: true },
      order: { name: 'ASC' },
    });

    return facilities.map((facility) => ({
      id: facility.id,
      name: facility.name,
      openTime: facility.config.openTime,
      closeTime: facility.config.closeTime,
      slotDurationMinutes: 60,
      basePrice: facility.config.pricePerHour,
      currency: 'SAR',
    }));
  }
}
