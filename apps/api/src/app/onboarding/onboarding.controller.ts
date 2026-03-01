import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@khana/data-access';
import { CompleteOnboardingResponseDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompleteOnboardingDto } from './dto';
import { OnboardingService } from './onboarding.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'onboarding',
  version: '1',
})
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('complete')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  complete(
    @Body() dto: CompleteOnboardingDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<CompleteOnboardingResponseDto> {
    return this.onboardingService.complete(
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }
}
