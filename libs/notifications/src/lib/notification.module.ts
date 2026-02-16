import { Global, Module, Logger } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './services/email.service';

const logger = new Logger('NotificationModule');

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const mailHost = configService.get<string>('MAIL_HOST') || 'localhost';
        const mailPort = parseInt(
          configService.get<string>('MAIL_PORT') || '1025',
          10
        );
        const mailUser = configService.get<string>('MAIL_USER');
        const mailPassword = configService.get<string>('MAIL_PASSWORD');

        logger.log(
          `Email config: host=${mailHost}, port=${mailPort}, user=${
            mailUser ? 'set' : 'NOT SET'
          }`
        );

        return {
          transport: {
            host: mailHost,
            port: mailPort,
            secure: mailPort === 465, // SMTPS only on 465; 2525/587 use STARTTLS
            auth: {
              user: mailUser,
              pass: mailPassword,
            },
          },
          defaults: {
            from:
              configService.get<string>('MAIL_FROM') ||
              'Khana <noreply@khana.app>',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationModule {}
