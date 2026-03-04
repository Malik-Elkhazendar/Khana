import { Injectable, Logger } from '@nestjs/common';

type WaitlistSlotAvailableWhatsAppPayload = {
  recipientPhone: string;
  recipientName: string;
  facilityName: string;
  startTime: Date;
  endTime: Date;
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendWaitlistSlotAvailable(
    payload: WaitlistSlotAvailableWhatsAppPayload
  ): Promise<void> {
    this.logger.log(
      `whatsapp.waitlist_slot_available queued for ${payload.recipientPhone} (${payload.facilityName})`
    );
  }
}
