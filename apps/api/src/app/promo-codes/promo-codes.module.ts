import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Facility, PromoCode } from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PromoCode, Facility, AuditLog]),
  ],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
