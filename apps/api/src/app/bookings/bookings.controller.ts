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
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from './dto';
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
@Controller('v1/bookings')
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
    @Query('facilityId') facilityId?: string
  ) {
    return this.bookingsService.findAll(tenantId, facilityId);
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
    return this.bookingsService.createBooking(dto, tenantId, user.id);
  }

  /**
   * PATCH /api/v1/bookings/:id/status
   *
   * Update booking status (e.g., Cancel, Mark as Paid).
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @TenantId() tenantId: string
  ) {
    return this.bookingsService.updateStatus(id, dto, tenantId);
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
}
