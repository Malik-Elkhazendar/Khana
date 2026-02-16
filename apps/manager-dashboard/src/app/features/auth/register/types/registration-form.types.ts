export interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone?: string;
  acceptTerms: boolean;
}
