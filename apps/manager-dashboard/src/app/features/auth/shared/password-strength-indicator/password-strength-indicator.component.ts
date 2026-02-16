import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { PasswordStrengthResult } from '../../register/services/password-strength.service';

const DEFAULT_STRENGTH: PasswordStrengthResult = {
  score: 0,
  strength: 'Weak',
  feedback: [],
  requirements: {
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
  },
};

@Component({
  selector: 'khana-password-strength-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './password-strength-indicator.component.html',
  styleUrl: './password-strength-indicator.component.scss',
})
export class PasswordStrengthIndicatorComponent {
  readonly visible = input(false);
  readonly result = input<PasswordStrengthResult>(DEFAULT_STRENGTH);
  readonly percent = input(0);
  readonly message = input('');
}
