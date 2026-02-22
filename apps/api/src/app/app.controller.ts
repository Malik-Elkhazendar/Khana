import {
  Controller,
  Get,
  Post,
  Body,
  Version,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { EmailService } from '@khana/notifications';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly emailService: EmailService
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  /**
   * TEST ENDPOINT: Send a test email to verify SMTP configuration
   * Usage: POST /api/v1/test-email (OWNER or MANAGER only)
   * Body: { email: 'your@email.com' }
   */
  @Version('1')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'MANAGER')
  @Post('test-email')
  async testEmail(@Body() body: { email?: string }) {
    const testEmail = body.email || 'test@example.com';

    try {
      await this.emailService.sendSecurityAlertStrict({
        recipientEmail: testEmail,
        recipientName: 'Test User',
        subject: 'Test Email from Khana',
        message:
          'If you see this, email is working! Check your API logs for "email.sent" message.',
        ipAddress: '127.0.0.1',
      });

      return {
        success: true,
        message: `Test email sent to ${testEmail}. Check Mailtrap inbox and API logs for "email.sent" or "email.failed"`,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
