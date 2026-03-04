import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateCustomerTagsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags!: string[];
}
