import { Injectable, inject } from '@angular/core';
import {
  CreatePromoCodeRequestDto,
  PromoCodeItemDto,
  PromoCodeListQueryDto,
  PromoCodeListResponseDto,
  UpdatePromoCodeRequestDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { buildPromoCodeListParams } from './api-params';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class PromoCodesApiService {
  private readonly api = inject(ApiRequestService);

  createPromoCode(
    request: CreatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.api.post('/v1/promo-codes', request, 'create promo code');
  }

  listPromoCodes(
    query: PromoCodeListQueryDto
  ): Observable<PromoCodeListResponseDto> {
    return this.api.get('/v1/promo-codes', 'list promo codes', {
      params: buildPromoCodeListParams(query),
    });
  }

  updatePromoCode(
    id: string,
    request: UpdatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.api.patch(
      `/v1/promo-codes/${id}`,
      request,
      'update promo code'
    );
  }
}
