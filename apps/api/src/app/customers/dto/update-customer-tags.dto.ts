import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateCustomerTagsDto {
  @ApiProperty({
    description:
      'Tenant-scoped customer tags to persist on the customer profile.',
    type: [String],
    maxItems: 10,
    example: ['VIP', 'Corporate'],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags!: string[];
}
