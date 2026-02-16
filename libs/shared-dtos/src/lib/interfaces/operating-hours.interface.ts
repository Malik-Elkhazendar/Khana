/**
 * Operating hours for a single day
 */
export interface DayOperatingHours {
  /** Opening time in HH:mm format (24-hour) */
  open: string;

  /** Closing time in HH:mm format (24-hour) */
  close: string;

  /** Whether the facility is closed on this day */
  isClosed: boolean;
}

/**
 * Weekly operating hours configuration
 * Note: In MENA, weekend is Thursday-Friday
 */
export interface WeeklyOperatingHours {
  /** Sunday operating hours */
  sunday: DayOperatingHours;

  /** Monday operating hours */
  monday: DayOperatingHours;

  /** Tuesday operating hours */
  tuesday: DayOperatingHours;

  /** Wednesday operating hours */
  wednesday: DayOperatingHours;

  /** Thursday operating hours (MENA weekend start) */
  thursday: DayOperatingHours;

  /** Friday operating hours (MENA weekend) */
  friday: DayOperatingHours;

  /** Saturday operating hours */
  saturday: DayOperatingHours;
}

/**
 * Simple operating hours (same every day)
 */
export interface SimpleOperatingHours {
  /** Opening time in HH:mm format */
  open: string;

  /** Closing time in HH:mm format */
  close: string;
}
