export interface SecurityAlertData {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  message: string;
  ipAddress?: string;
  timestamp?: Date;
}

export interface PasswordChangedData {
  recipientEmail: string;
  recipientName: string;
  timestamp?: Date;
}

export interface WelcomeEmailData {
  recipientEmail: string;
  recipientName: string;
  role: string;
}

export interface BookingConfirmationData {
  recipientEmail: string;
  customerName: string;
  customerPhone: string;
  bookingReference: string;
  facilityName: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  currency: string;
}

export interface PaymentReceiptData {
  recipientEmail: string;
  customerName: string;
  bookingReference: string;
  facilityName: string;
  totalAmount: number;
  currency: string;
  paidAt: Date;
}

export interface CancellationData {
  recipientEmail: string;
  customerName: string;
  bookingReference: string;
  facilityName: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

export interface RefundData {
  recipientEmail: string;
  customerName: string;
  bookingReference: string;
  refundAmount: number;
  currency: string;
}

export interface NewBookingAlertData {
  managerEmail: string;
  managerName: string;
  customerName: string;
  customerPhone: string;
  bookingReference: string;
  facilityName: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  currency: string;
}
