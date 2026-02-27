import { UserRole } from '@khana/shared-dtos';

export type DashboardNavIcon =
  | 'bookings'
  | 'calendar'
  | 'new'
  | 'facilities'
  | 'team'
  | 'settings';

export type DashboardNavItem = {
  labelKey: string;
  route: string;
  icon: DashboardNavIcon;
  exact: boolean;
  roles?: UserRole[];
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
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.FACILITIES',
    route: '/dashboard/facilities',
    icon: 'facilities',
    exact: true,
  },
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.TEAM',
    route: '/dashboard/team',
    icon: 'team',
    exact: true,
    roles: [UserRole.OWNER, UserRole.MANAGER],
  },
  {
    labelKey: 'DASHBOARD.NAV.ITEMS.SETTINGS',
    route: '/dashboard/settings',
    icon: 'settings',
    exact: true,
    roles: [UserRole.OWNER, UserRole.MANAGER],
  },
];

export function getDashboardNavItemsForRole(
  role: UserRole | null | undefined
): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }
    if (!role) {
      return false;
    }
    return item.roles.includes(role);
  });
}
