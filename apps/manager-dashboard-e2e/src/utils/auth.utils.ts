import { expect, Page } from '@playwright/test';

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

export async function register(page: Page, data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<void> {
  await page.goto('/register');
  await page.fill('#email', data.email);
  await page.fill('#name', data.name);
  if (data.phone) {
    await page.fill('#phone', data.phone);
  }
  await page.fill('#password', data.password);
  await page.fill('#confirmPassword', data.password);
  await page.check('input[type="checkbox"][formcontrolname="acceptTerms"]');
  await page.click('button[type="submit"]');
}

export async function changePassword(
  page: Page,
  currentPwd: string,
  newPwd: string
): Promise<void> {
  await page.goto('/change-password');
  await page.fill('#currentPassword', currentPwd);
  await page.fill('#newPassword', newPwd);
  await page.fill('#confirmPassword', newPwd);
  await page.click('button[type="submit"]');
}

export async function logout(page: Page): Promise<void> {
  await page.click('button.user-button');
  await page.getByRole('menuitem', { name: 'Logout' }).click();
}

export async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => sessionStorage.getItem('khana_access_token'));
}

export async function getRefreshToken(page: Page): Promise<string | null> {
  return page.evaluate(() => sessionStorage.getItem('khana_refresh_token'));
}

export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
}

export async function waitForLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function expectProtectedAccess(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
}
