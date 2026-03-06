import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { UpdateTenantSettingsRequestDto } from '@khana/shared-dtos';
import { IsIanaTimeZone } from './is-iana-time-zone.decorator';

export class UpdateSettingsDto implements UpdateTenantSettingsRequestDto {
  @ValidateIf((_obj, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @IsOptional()
  @IsIanaTimeZone({
    message: 'timezone must be a valid IANA timezone identifier',
  })
  timezone?: string;
}
