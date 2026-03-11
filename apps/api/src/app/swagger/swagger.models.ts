import { ApiProperty } from '@nestjs/swagger';

export class SwaggerErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Validation failed' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: '2026-03-11T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/bookings' })
  path!: string;
}
