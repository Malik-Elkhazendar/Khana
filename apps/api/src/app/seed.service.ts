import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility, Tenant } from '@khana/data-access';
import { AppLoggerService, LOG_EVENTS } from './logging';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    private readonly appLogger: AppLoggerService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const tenantCount = await this.tenantRepository.count();

      if (tenantCount > 0) {
        this.appLogger.info(
          LOG_EVENTS.SYSTEM_SEED_SKIPPED,
          'Database already seeded'
        );
        return;
      }

      const tenant = this.tenantRepository.create({
        name: 'Elite Padel',
        slug: 'elite-padel',
      });
      const savedTenant = await this.tenantRepository.save(tenant);

      const facility = this.facilityRepository.create({
        name: 'Center Court',
        type: 'PADEL',
        tenant: savedTenant,
        config: { pricePerHour: 150, openTime: '08:00', closeTime: '23:00' },
      });

      await this.facilityRepository.save(facility);

      this.appLogger.info(LOG_EVENTS.SYSTEM_SEED_COMPLETE, 'Seeding complete', {
        tenantId: savedTenant.id,
      });
    } catch (error: unknown) {
      this.appLogger.error(
        LOG_EVENTS.SYSTEM_SEED_FAILED,
        'Seeding failed',
        undefined,
        error
      );
    }
  }
}
