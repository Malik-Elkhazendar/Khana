export const testUsers = {
  owner: {
    email: 'owner@example.com',
    password: 'OwnerPassword123',
    role: 'OWNER',
  },
  manager: {
    email: 'manager@example.com',
    password: 'ManagerPassword123',
    role: 'MANAGER',
  },
  staff: {
    email: 'staff@example.com',
    password: 'StaffPassword123',
    role: 'STAFF',
  },
  viewer: {
    email: 'viewer@example.com',
    password: 'ViewerPassword123',
    role: 'VIEWER',
  },
};

export const validCredentials = {
  email: 'test@example.com',
  password: 'Password123',
};

export const invalidCredentials = {
  email: 'wrong@example.com',
  password: 'WrongPassword',
};

export const registrationData = {
  email: 'newuser@example.com',
  password: 'NewPassword123',
  name: 'Test User',
  phone: '+966501234567',
};
