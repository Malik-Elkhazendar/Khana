import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import {
  SecurityAlertData,
  PasswordChangedData,
  BookingConfirmationData,
  PaymentReceiptData,
  CancellationData,
  RefundData,
  NewBookingAlertData,
} from '../interfaces/email.interface';

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: jest.Mocked<MailerService>;

  beforeEach(async () => {
    const mockMailerService = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    mailerService = module.get(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendSecurityAlert', () => {
    const data: SecurityAlertData = {
      recipientEmail: 'user@example.com',
      recipientName: 'Test User',
      subject: 'Suspicious Activity Detected',
      message: 'A token reuse was detected.',
      ipAddress: '192.168.1.1',
    };

    it('should send security alert email', async () => {
      await service.sendSecurityAlert(data);

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Suspicious Activity Detected',
          html: expect.stringContaining('Suspicious Activity Detected'),
        })
      );
    });

    it('should include IP address in template when provided', async () => {
      await service.sendSecurityAlert(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('192.168.1.1');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(service.sendSecurityAlert(data)).resolves.not.toThrow();
    });
  });

  describe('sendPasswordChangedNotification', () => {
    const data: PasswordChangedData = {
      recipientEmail: 'user@example.com',
      recipientName: 'Test User',
    };

    it('should send password changed email', async () => {
      await service.sendPasswordChangedNotification(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Your Password Has Been Changed',
          html: expect.stringContaining('Password Changed Successfully'),
        })
      );
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendPasswordChangedNotification(data)
      ).resolves.not.toThrow();
    });
  });

  describe('sendBookingConfirmation', () => {
    const data: BookingConfirmationData = {
      recipientEmail: 'customer@example.com',
      customerName: 'John Doe',
      customerPhone: '+966501234567',
      bookingReference: 'KH-000001',
      facilityName: 'Court A',
      startTime: new Date('2025-06-15T10:00:00Z'),
      endTime: new Date('2025-06-15T11:00:00Z'),
      totalAmount: 150,
      currency: 'SAR',
    };

    it('should send booking confirmation email', async () => {
      await service.sendBookingConfirmation(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Booking Confirmed - KH-000001',
          html: expect.stringContaining('KH-000001'),
        })
      );
    });

    it('should include booking details in template', async () => {
      await service.sendBookingConfirmation(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Court A');
      expect(call.html).toContain('John Doe');
      expect(call.html).toContain('SAR 150.00');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendBookingConfirmation(data)
      ).resolves.not.toThrow();
    });
  });

  describe('sendPaymentReceipt', () => {
    const data: PaymentReceiptData = {
      recipientEmail: 'customer@example.com',
      customerName: 'John Doe',
      bookingReference: 'KH-000001',
      facilityName: 'Court A',
      totalAmount: 150,
      currency: 'SAR',
      paidAt: new Date('2025-06-15T10:05:00Z'),
    };

    it('should send payment receipt email', async () => {
      await service.sendPaymentReceipt(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Payment Receipt - KH-000001',
          html: expect.stringContaining('Payment Receipt'),
        })
      );
    });

    it('should include payment amount', async () => {
      await service.sendPaymentReceipt(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('SAR 150.00');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(service.sendPaymentReceipt(data)).resolves.not.toThrow();
    });
  });

  describe('sendCancellationNotification', () => {
    const data: CancellationData = {
      recipientEmail: 'customer@example.com',
      customerName: 'John Doe',
      bookingReference: 'KH-000001',
      facilityName: 'Court A',
      startTime: new Date('2025-06-15T10:00:00Z'),
      endTime: new Date('2025-06-15T11:00:00Z'),
      reason: 'Customer requested cancellation',
    };

    it('should send cancellation email', async () => {
      await service.sendCancellationNotification(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Booking Cancelled - KH-000001',
          html: expect.stringContaining('Booking Cancelled'),
        })
      );
    });

    it('should include cancellation reason', async () => {
      await service.sendCancellationNotification(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Customer requested cancellation');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendCancellationNotification(data)
      ).resolves.not.toThrow();
    });
  });

  describe('sendRefundNotification', () => {
    const data: RefundData = {
      recipientEmail: 'customer@example.com',
      customerName: 'John Doe',
      bookingReference: 'KH-000001',
      refundAmount: 150,
      currency: 'SAR',
    };

    it('should send refund notification email', async () => {
      await service.sendRefundNotification(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Refund Processed - KH-000001',
          html: expect.stringContaining('Refund Processed'),
        })
      );
    });

    it('should include refund amount', async () => {
      await service.sendRefundNotification(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('SAR 150.00');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(service.sendRefundNotification(data)).resolves.not.toThrow();
    });
  });

  describe('sendNewBookingAlert', () => {
    const data: NewBookingAlertData = {
      managerEmail: 'manager@example.com',
      managerName: 'Manager',
      customerName: 'John Doe',
      customerPhone: '+966501234567',
      bookingReference: 'KH-000001',
      facilityName: 'Court A',
      startTime: new Date('2025-06-15T10:00:00Z'),
      endTime: new Date('2025-06-15T11:00:00Z'),
      totalAmount: 150,
      currency: 'SAR',
    };

    it('should send new booking alert to manager', async () => {
      await service.sendNewBookingAlert(data);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'manager@example.com',
          subject: 'New Booking - KH-000001',
          html: expect.stringContaining('New Booking Received'),
        })
      );
    });

    it('should include customer and booking details', async () => {
      await service.sendNewBookingAlert(data);

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.html).toContain('John Doe');
      expect(call.html).toContain('Court A');
      expect(call.html).toContain('SAR 150.00');
    });

    it('should not throw on mailer failure', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(service.sendNewBookingAlert(data)).resolves.not.toThrow();
    });
  });
});
