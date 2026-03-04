import { WaitlistStatus } from '../enums/waitlist-status.enum';

export interface WaitlistDesiredTimeSlotDto {
  startTime: string;
  endTime: string;
}

export interface JoinWaitlistRequestDto {
  facilityId: string;
  desiredTimeSlot: WaitlistDesiredTimeSlotDto;
}

export interface JoinWaitlistResponseDto {
  entryId: string;
  status: WaitlistStatus;
  queuePosition: number;
  desiredTimeSlot: WaitlistDesiredTimeSlotDto;
  createdAt: string;
}

export interface WaitlistStatusQueryDto {
  facilityId: string;
  startTime: string;
  endTime: string;
}

export interface WaitlistStatusResponseDto {
  isOnWaitlist: boolean;
  entryId?: string;
  status?: WaitlistStatus;
  queuePosition?: number;
}
