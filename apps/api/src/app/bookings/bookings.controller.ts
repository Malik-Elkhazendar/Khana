import { Controller, Post, Get, Body, HttpCode, HttpStatus, Query, Patch, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingPreviewRequestDto, BookingPreviewResponseDto, CreateBookingDto, UpdateBookingStatusDto } from './dto';

/**
 * Bookings Controller
 *
 * Thin controller that handles HTTP concerns only.
 * All business logic is delegated to the service and domain layer.
 */
@Controller('v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /api/v1/bookings?facilityId=...
   *
   * List bookings, optionally filtered by facility.
   */
  @Get()
  findAll(@Query('facilityId') facilityId?: string) {
    return this.bookingsService.findAll(facilityId);
  }

  /**
   * POST /api/v1/bookings
   *
   * Create a new booking.
   * Validates availability and persists the booking to the database.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(dto);
  }

  /**
   * PATCH /api/v1/bookings/:id/status
   *
   * Update booking status (e.g., Cancel, Mark as Paid).
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto
  ) {
    return this.bookingsService.updateStatus(id, dto);
  }

  /**
   * POST /api/v1/bookings/preview
   *
   * Preview a booking without persisting it.
   * Returns price calculation, conflict status, and suggested alternatives.
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewBooking(@Body() dto: BookingPreviewRequestDto): Promise<BookingPreviewResponseDto> {
    return this.bookingsService.previewBooking(dto);
  }

  /**
   * GET /api/v1/bookings/facilities
   *
   * Get all available facilities for booking.
   */
  @Get('facilities')
  getFacilities() {
    return this.bookingsService.getFacilities();
  }
}
