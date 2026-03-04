import { WaitlistStatus } from '../enums/waitlist-status.enum';

export interface WaitlistListQueryDto {
  from: string;
  to: string;
  facilityId?: string;
  status?: WaitlistStatus;
  page?: number;
  pageSize?: number;
}

export interface WaitlistSummaryCountsDto {
  waiting: number;
  notified: number;
  expired: number;
  fulfilled: number;
}

export interface WaitlistEntryListItemDto {
  entryId: string;
  facilityId: string;
  facilityName: string;
  userId: string;
  userName: string;
  userEmail: string;
  desiredStartTime: string;
  desiredEndTime: string;
  status: WaitlistStatus;
  queuePosition: number | null;
  createdAt: string;
  notifiedAt: string | null;
  expiredAt: string | null;
  fulfilledByBookingId: string | null;
}

export interface WaitlistListResponseDto {
  items: WaitlistEntryListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: WaitlistSummaryCountsDto;
}

export interface NotifyNextWaitlistRequestDto {
  facilityId: string;
  desiredStartTime: string;
  desiredEndTime: string;
}

export interface NotifyNextWaitlistResponseDto {
  notified: boolean;
  entryId?: string;
  status?: WaitlistStatus.NOTIFIED;
}

export interface ExpireWaitlistEntryResponseDto {
  entryId: string;
  status: WaitlistStatus.EXPIRED;
  expiredAt: string;
}
