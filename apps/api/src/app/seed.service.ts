import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility, Tenant } from '@khana/data-access';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const tenantCount = await this.tenantRepository.count();

      if (tenantCount > 0) {
        this.logger.log('✅ Database already seeded');
        return;
      }

      const tenant = this.tenantRepository.create({ name: 'Elite Padel' });
      const savedTenant = await this.tenantRepository.save(tenant);

      const facility = this.facilityRepository.create({
        name: 'Center Court',
        type: 'PADEL',
        tenant: savedTenant,
        config: { pricePerHour: 150, openTime: '08:00', closeTime: '23:00' },
      });

      await this.facilityRepository.save(facility);

      this.logger.log('✨ Seeding Complete!');
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(error.message, error.stack);
      } else {
        this.logger.error('Unknown seeding error', String(error));
      }
    }
  }
}
