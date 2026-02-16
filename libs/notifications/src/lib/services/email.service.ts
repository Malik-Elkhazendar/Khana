import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  SecurityAlertData,
  PasswordChangedData,
  BookingConfirmationData,
  PaymentReceiptData,
  CancellationData,
  RefundData,
  NewBookingAlertData,
} from '../interfaces/email.interface';
import { securityAlertTemplate } from '../templates/security-alert.template';
import { passwordChangedTemplate } from '../templates/password-changed.template';
import { bookingConfirmationTemplate } from '../templates/booking-confirmation.template';
import { paymentReceiptTemplate } from '../templates/payment-receipt.template';
import { cancellationTemplate } from '../templates/cancellation.template';
import { refundTemplate } from '../templates/refund.template';
import { newBookingAlertTemplate } from '../templates/new-booking-alert.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send a security alert email (e.g., token reuse detected).
   */
  async sendSecurityAlert(data: SecurityAlertData): Promise<void> {
    const html = securityAlertTemplate(data);
    await this.send(data.recipientEmail, data.subject, html, 'security_alert');
  }

  /**
   * Send a security alert and rethrow on failure.
   * Used by diagnostics/test endpoints to report real delivery result.
   */
  async sendSecurityAlertStrict(data: SecurityAlertData): Promise<void> {
    const html = securityAlertTemplate(data);
    await this.send(
      data.recipientEmail,
      data.subject,
      html,
      'security_alert',
      true
    );
  }

  /**
   * Send password changed confirmation email.
   */
  async sendPasswordChangedNotification(
    data: PasswordChangedData
  ): Promise<void> {
    const html = passwordChangedTemplate(data);
    await this.send(
      data.recipientEmail,
      'Your Password Has Been Changed',
      html,
      'password_changed'
    );
  }

  /**
   * Send booking confirmation email to customer.
   */
  async sendBookingConfirmation(data: BookingConfirmationData): Promise<void> {
    const html = bookingConfirmationTemplate(data);
    await this.send(
      data.recipientEmail,
      `Booking Confirmed - ${data.bookingReference}`,
      html,
      'booking_confirmation'
    );
  }

  /**
   * Send payment receipt email.
   */
  async sendPaymentReceipt(data: PaymentReceiptData): Promise<void> {
    const html = paymentReceiptTemplate(data);
    await this.send(
      data.recipientEmail,
      `Payment Receipt - ${data.bookingReference}`,
      html,
      'payment_receipt'
    );
  }

  /**
   * Send cancellation notification email.
   */
  async sendCancellationNotification(data: CancellationData): Promise<void> {
    const html = cancellationTemplate(data);
    await this.send(
      data.recipientEmail,
      `Booking Cancelled - ${data.bookingReference}`,
      html,
      'cancellation'
    );
  }

  /**
   * Send refund processed notification email.
   */
  async sendRefundNotification(data: RefundData): Promise<void> {
    const html = refundTemplate(data);
    await this.send(
      data.recipientEmail,
      `Refund Processed - ${data.bookingReference}`,
      html,
      'refund'
    );
  }

  /**
   * Send new booking alert to facility manager.
   */
  async sendNewBookingAlert(data: NewBookingAlertData): Promise<void> {
    const html = newBookingAlertTemplate(data);
    await this.send(
      data.managerEmail,
      `New Booking - ${data.bookingReference}`,
      html,
      'new_booking_alert'
    );
  }

  /**
   * Core send method with error handling.
   * Email failures are logged but never block business operations.
   */
  private async send(
    to: string,
    subject: string,
    html: string,
    emailType: string,
    throwOnError = false
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({ to, subject, html });
      this.logger.log(`email.sent type=${emailType} to=${to}`);
    } catch (error) {
      this.logger.error(
        `email.failed type=${emailType} to=${to} error=${
          (error as Error).message
        }`
      );
      if (throwOnError) {
        throw error;
      }
    }
  }
}
