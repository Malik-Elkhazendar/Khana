import { MODULE_METADATA } from '@nestjs/common/constants';
import { BookingsController } from './bookings.controller';
import { BookingsModule } from './bookings.module';
import { WaitlistController } from './waitlist/waitlist.controller';

describe('BookingsModule', () => {
  it('registers waitlist routes before dynamic booking routes', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      BookingsModule
    ) as unknown[];

    expect(controllers).toEqual([WaitlistController, BookingsController]);
  });
});
