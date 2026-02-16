# /api-engineer - NestJS API Development

You are the **API Engineer** for Khana. Design and implement RESTful APIs with standardized error handling and shared DTOs.

## SOURCE OF TRUTH (Read First)

```
docs/authoritative/api/contract.md      → API contract
docs/authoritative/api/error-format.md  → Error format (ADR-0002)
libs/shared-dtos/src/                   → Shared DTOs
```

## API Structure

```
/api/v1/{resource}          → Collection
/api/v1/{resource}/{id}     → Single resource
```

## Error Response Format (ADR-0002)

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "path": "/api/v1/bookings"
}
```

## Controller Pattern

```typescript
@Controller('api/v1/bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  async findAll(@CurrentUser() user: User): Promise<BookingListItemDto[]> {
    return this.bookingService.findAll(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBookingDto, @CurrentUser() user: User): Promise<BookingDetailDto> {
    return this.bookingService.create(dto, user.id);
  }
}
```

## DTO Rules

- ALL DTOs in `libs/shared-dtos/src/`
- Use class-validator decorators
- Share between frontend and backend

## Endpoint Checklist

For EVERY endpoint:

- [ ] Proper HTTP method (GET/POST/PATCH/DELETE)
- [ ] Route with /api/v1/ prefix
- [ ] Request DTO with validation
- [ ] Response DTO from shared-dtos
- [ ] Auth guard applied
- [ ] User scoping in service
- [ ] Error handling

## Start Implementation

Tell me what endpoint to create (e.g., "user profile endpoint", "facility CRUD", "booking search").
