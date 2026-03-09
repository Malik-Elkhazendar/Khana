import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog, Facility, PromoCode, User } from '@khana/data-access';
import { PromoCodeItemDto, PromoCodeListResponseDto } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../logging';
import {
  CreatePromoCodeDto,
  ListPromoCodesQueryDto,
  UpdatePromoCodeDto,
} from './dto';
import {
  createPromoCodeWorkflow,
  updatePromoCodeWorkflow,
} from './internal/promo-codes.mutation';
import { listPromoCodesWorkflow } from './internal/promo-codes.query';
import { PromoCodeDependencies } from './internal/promo-codes.internal';

@Injectable()
export class PromoCodesService {
  private readonly deps: PromoCodeDependencies;

  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService
  ) {
    this.deps = {
      promoCodeRepository,
      facilityRepository,
      auditLogRepository,
      appLogger,
    };
  }

  async createPromoCode(
    dto: CreatePromoCodeDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeItemDto> {
    return createPromoCodeWorkflow(this.deps, dto, tenantId, actor);
  }

  async listPromoCodes(
    query: ListPromoCodesQueryDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeListResponseDto> {
    return listPromoCodesWorkflow(this.deps, query, tenantId, actor);
  }

  async updatePromoCode(
    id: string,
    dto: UpdatePromoCodeDto,
    tenantId: string,
    actor: User
  ): Promise<PromoCodeItemDto> {
    return updatePromoCodeWorkflow(this.deps, id, dto, tenantId, actor);
  }
}
