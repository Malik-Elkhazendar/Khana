import { WaitlistStatus } from '@khana/shared-dtos';

export const DEFAULT_PAGE_SIZE = 20;
export const WAITLIST_STATUSES = Object.values(WaitlistStatus);

export type WaitlistSlotContext = {
  facilityId: string | null;
  startTime: string;
  endTime: string;
  source: 'booking-preview' | 'unknown';
};
