import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingPreviewRequestDto, BookingPreviewResponseDto } from './dto';

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
   * POST /api/v1/bookings/preview
   *
   * Preview a booking without persisting it.
   * Returns price calculation, conflict status, and suggested alternatives.
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  previewBooking(@Body() dto: BookingPreviewRequestDto): BookingPreviewResponseDto {
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
