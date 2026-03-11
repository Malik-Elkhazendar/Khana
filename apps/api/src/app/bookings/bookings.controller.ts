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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import {
  BookingFacilityListItemDoc,
  BookingListItemDoc,
  BookingPreviewResponseDoc,
  CreateRecurringBookingResponseDoc,
} from './swagger/booking-doc.models';

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
@ApiTags('Bookings')
@ApiJwtAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /api/v1/bookings?facilityId=...
   *
   * List bookings, optionally filtered by facility.
   */
  @Get()
  @ApiOperation({
    summary: 'List bookings for the current tenant',
  })
  @ApiQuery({
    name: 'facilityId',
    required: false,
    description: 'Optional facility filter for the booking list.',
  })
  @ApiOkResponse({
    description: 'Bookings visible to the current user in the current tenant.',
    type: BookingListItemDoc,
    isArray: true,
  })
  @ApiStandardErrorResponses(401, 403)
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
  @ApiOperation({
    summary: 'Create a single booking',
  })
  @ApiCreatedResponse({
    description: 'Booking created successfully.',
    type: BookingListItemDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
  @ApiOperation({
    summary: 'Create a recurring booking series',
  })
  @ApiCreatedResponse({
    description: 'Recurring booking batch created successfully.',
    type: CreateRecurringBookingResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
  @ApiOperation({
    summary: 'Update booking status',
  })
  @ApiUuidParam('id', 'Booking identifier to update.')
  @ApiOkResponse({
    description: 'Booking status updated successfully.',
    type: BookingListItemDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary: 'Preview booking availability and pricing',
  })
  @ApiOkResponse({
    description:
      'Preview payload with availability, pricing, and any booking conflicts.',
    type: BookingPreviewResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
  @ApiOperation({
    summary: 'List facilities available for booking',
  })
  @ApiOkResponse({
    description: 'Active facilities available to the current tenant.',
    type: BookingFacilityListItemDoc,
    isArray: true,
  })
  @ApiStandardErrorResponses(401, 403)
  getFacilities(@TenantId() tenantId: string) {
    return this.bookingsService.getFacilities(tenantId);
  }

  /**
   * GET /api/v1/bookings/:id
   *
   * Get a single booking by id.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a booking by id',
  })
  @ApiUuidParam('id', 'Booking identifier to fetch.')
  @ApiOkResponse({
    description: 'Single booking visible to the current user.',
    type: BookingListItemDoc,
  })
  @ApiStandardErrorResponses(401, 403, 404)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ) {
    return this.bookingsService.findOne(tenantId, user, id);
  }
}
