/**
 * User roles within a tenant
 */
export enum UserRole {
  /** Full access to all tenant features */
  OWNER = 'OWNER',

  /** Can manage bookings and customers, limited settings access */
  MANAGER = 'MANAGER',

  /** Can view and create bookings only */
  STAFF = 'STAFF',

  /** Read-only access for reporting */
  VIEWER = 'VIEWER',
}
