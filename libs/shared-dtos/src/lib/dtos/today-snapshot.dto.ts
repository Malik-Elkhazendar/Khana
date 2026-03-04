export interface TodaySnapshotDto {
  bookingsToday: number;
  revenueToday: number;
  unpaidCount: number;
  unpaidAmount: number;
  expiringHoldsCount: number;
  waitlistToday: number;
  notifiedWaitlistCount: number;
  noShowCount: number;
}
