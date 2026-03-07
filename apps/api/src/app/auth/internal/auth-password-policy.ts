import { BadRequestException } from '@nestjs/common';

export function validatePasswordStrength(password: string): void {
  if (!password || password.length < 8) {
    throw new BadRequestException(
      'Password must be at least 8 characters long'
    );
  }

  const hasNumber = /\d/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);

  if (!hasNumber || !hasUpperCase || !hasLowerCase) {
    throw new BadRequestException(
      'Password must contain uppercase, lowercase, and numbers'
    );
  }
}
