export type DashboardNavIcon = 'bookings' | 'calendar' | 'new';

export type DashboardNavItem = {
  labelKey: string;
  route: string;
  icon: DashboardNavIcon;
  exact: boolean;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.BOOKINGS',
    route: '/dashboard/bookings',
    icon: 'bookings',
    exact: true,
  },
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.CALENDAR',
    route: '/dashboard/calendar',
    icon: 'calendar',
    exact: true,
  },
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.NEW_BOOKING',
    route: '/dashboard/new',
    icon: 'new',
    exact: true,
  },
];
