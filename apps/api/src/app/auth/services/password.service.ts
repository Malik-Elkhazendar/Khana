import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Password Service
 *
 * Handles password hashing and verification using bcrypt.
 * SALT_ROUNDS = 12 is OWASP-recommended balance between security and performance.
 */
@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  /**
   * Hash a plaintext password with bcrypt
   *
   * Cost: ~150-250ms on modern hardware (intentional slowness defeats brute force)
   *
   * @param password - Plaintext password
   * @returns Promise<string> - Bcrypt hash
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify plaintext password against bcrypt hash
   *
   * @param plaintext - Plaintext password to verify
   * @param hash - Bcrypt hash to compare against
   * @returns Promise<boolean> - True if password matches, false otherwise
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
