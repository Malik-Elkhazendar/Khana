import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  CreateRecurringBookingDto,
  UpdateBookingStatusDto,
} from './dto';
import { CreateRecurringBookingResponseDto } from '@khana/shared-dtos';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { User } from '@khana/data-access';

/**
 * Bookings Controller
 *
 * Thin controller that handles HTTP concerns only.
 * All business logic is delegated to the service and domain layer.
 */
@UseGuards(JwtAuthGuard)
@Controller({
  path: 'bookings',
  version: '1',
})
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /api/v1/bookings?facilityId=...
   *
   * List bookings, optionally filtered by facility.
   */
  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Query('facilityId') facilityId?: string
  ) {
    return this.bookingsService.findAll(tenantId, user, facilityId);
  }

  /**
   * POST /api/v1/bookings
   *
   * Create a new booking.
   * Validates availability and persists the booking to the database.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: User,
    @TenantId() tenantId: string
  ) {
    return this.bookingsService.createBooking(
      dto,
      tenantId,
      user.id,
      user.role
    );
  }

  /**
   * POST /api/v1/bookings/recurring
   *
   * Create recurring bookings for a single time slot pattern.
   */
  @Post('recurring')
  @HttpCode(HttpStatus.CREATED)
  createRecurringBooking(
    @Body() dto: CreateRecurringBookingDto,
    @CurrentUser() user: User,
    @TenantId() tenantId: string
  ): Promise<CreateRecurringBookingResponseDto> {
    return this.bookingsService.createRecurringBookings(
      dto,
      tenantId,
      user.id,
      user.role
    );
  }

  /**
   * PATCH /api/v1/bookings/:id/status
   *
   * Update booking status (e.g., Cancel, Mark as Paid).
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBookingStatusDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ) {
    return this.bookingsService.updateStatus(id, dto, tenantId, user);
  }

  /**
   * POST /api/v1/bookings/preview
   *
   * Preview a booking without persisting it.
   * Returns price calculation, conflict status, and suggested alternatives.
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewBooking(
    @Body() dto: BookingPreviewRequestDto,
    @TenantId() tenantId: string
  ): Promise<BookingPreviewResponseDto> {
    return this.bookingsService.previewBooking(dto, tenantId);
  }

  /**
   * GET /api/v1/bookings/facilities
   *
   * Get all available facilities for booking.
   */
  @Get('facilities')
  getFacilities(@TenantId() tenantId: string) {
    return this.bookingsService.getFacilities(tenantId);
  }

  /**
   * GET /api/v1/bookings/:id
   *
   * Get a single booking by id.
   */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ) {
    return this.bookingsService.findOne(tenantId, user, id);
  }
}
