import { Injectable } from '@angular/core';

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3;
  strength: 'Weak' | 'Fair' | 'Good' | 'Strong';
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class PasswordStrengthService {
  calculateStrength(password: string): PasswordStrengthResult {
    const value = password ?? '';
    const requirements = {
      minLength: value.length >= 8,
      hasUpperCase: /[A-Z]/.test(value),
      hasLowerCase: /[a-z]/.test(value),
      hasNumber: /[0-9]/.test(value),
    };

    const metCount = Object.values(requirements).filter(Boolean).length;
    const { score, strength } = this.mapScore(metCount);
    const feedback = this.buildFeedback(requirements);

    return {
      score,
      strength,
      feedback,
      requirements,
    };
  }

  getStrengthColor(strength: PasswordStrengthResult['strength']): string {
    switch (strength) {
      case 'Strong':
        return 'var(--success)';
      case 'Good':
        return 'var(--warning)';
      case 'Fair':
        return '#f59e0b';
      default:
        return 'var(--error)';
    }
  }

  getStrengthMessage(result: PasswordStrengthResult): string {
    switch (result.strength) {
      case 'Strong':
        return 'Strong password';
      case 'Good':
        return 'Good password strength';
      case 'Fair':
        return 'Fair password strength';
      default:
        return 'Weak password';
    }
  }

  private mapScore(count: number): {
    score: 0 | 1 | 2 | 3;
    strength: PasswordStrengthResult['strength'];
  } {
    if (count >= 4) {
      return { score: 3, strength: 'Strong' };
    }
    if (count === 3) {
      return { score: 2, strength: 'Good' };
    }
    if (count === 2) {
      return { score: 1, strength: 'Fair' };
    }
    return { score: 0, strength: 'Weak' };
  }

  private buildFeedback(requirements: PasswordStrengthResult['requirements']):
    string[] {
    const feedback: string[] = [];

    if (!requirements.minLength) {
      feedback.push('At least 8 characters');
    }
    if (!requirements.hasUpperCase) {
      feedback.push('Include an uppercase letter');
    }
    if (!requirements.hasLowerCase) {
      feedback.push('Include a lowercase letter');
    }
    if (!requirements.hasNumber) {
      feedback.push('Include a number');
    }

    return feedback;
  }
}
