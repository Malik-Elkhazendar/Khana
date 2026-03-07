import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Booking } from '@khana/data-access';
import { Repository } from 'typeorm';

const BOOKING_REFERENCE_PREFIX = 'KHN';
const BOOKING_REFERENCE_RANDOM_LENGTH = 6;
const BOOKING_REFERENCE_ATTEMPTS = 5;

export async function generateUniqueBookingReference(
  bookingRepository: Repository<Booking>
): Promise<string> {
  for (let attempt = 0; attempt < BOOKING_REFERENCE_ATTEMPTS; attempt += 1) {
    const candidate = buildBookingReference();
    const alreadyExists = await bookingRepository.exists({
      where: { bookingReference: candidate },
    });

    if (!alreadyExists) {
      return candidate;
    }
  }

  throw new ConflictException(
    'Unable to create booking reference. Please retry.'
  );
}

export function buildSlotKey(
  facilityId: string,
  startTime: Date,
  endTime: Date
): string {
  return `${facilityId}|${startTime.toISOString()}|${endTime.toISOString()}`;
}

function buildBookingReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(3)
    .toString('hex')
    .toUpperCase()
    .slice(0, BOOKING_REFERENCE_RANDOM_LENGTH);
  return `${BOOKING_REFERENCE_PREFIX}-${timestamp}-${randomSuffix}`;
}
