import { Injectable, inject } from '@angular/core';
import {
  ExpireWaitlistEntryResponseDto,
  JoinWaitlistRequestDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistRequestDto,
  NotifyNextWaitlistResponseDto,
  WaitlistListQueryDto,
  WaitlistListResponseDto,
  WaitlistStatusQueryDto,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { buildWaitlistListParams } from './api-params';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class WaitlistApiService {
  private readonly api = inject(ApiRequestService);

  joinBookingWaitlist(
    request: JoinWaitlistRequestDto
  ): Observable<JoinWaitlistResponseDto> {
    return this.api.post(
      '/v1/bookings/waitlist',
      request,
      'join booking waitlist'
    );
  }

  getBookingWaitlistStatus(
    query: WaitlistStatusQueryDto
  ): Observable<WaitlistStatusResponseDto> {
    return this.api.get(
      '/v1/bookings/waitlist/status',
      'load booking waitlist status',
      {
        params: {
          facilityId: query.facilityId,
          startTime: query.startTime,
          endTime: query.endTime,
        },
      }
    );
  }

  getWaitlistEntries(
    query: WaitlistListQueryDto
  ): Observable<WaitlistListResponseDto> {
    return this.api.get('/v1/bookings/waitlist', 'load waitlist entries', {
      params: buildWaitlistListParams(query),
    });
  }

  notifyNextWaitlistSlot(
    request: NotifyNextWaitlistRequestDto
  ): Observable<NotifyNextWaitlistResponseDto> {
    return this.api.post(
      '/v1/bookings/waitlist/notify-next',
      request,
      'manual waitlist notify next'
    );
  }

  expireWaitlistEntry(
    entryId: string
  ): Observable<ExpireWaitlistEntryResponseDto> {
    return this.api.patch(
      `/v1/bookings/waitlist/${entryId}/expire`,
      {},
      'manual waitlist expire entry'
    );
  }
}
