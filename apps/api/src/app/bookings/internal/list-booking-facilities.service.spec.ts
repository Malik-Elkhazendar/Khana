import { Facility } from '@khana/data-access';
import { ListBookingFacilitiesService } from './list-booking-facilities.service';

describe('ListBookingFacilitiesService', () => {
  let service: ListBookingFacilitiesService;
  let facilityRepository: {
    find: jest.Mock;
  };

  beforeEach(() => {
    facilityRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'facility-1',
          name: 'Center Court',
          config: {
            openTime: '08:00',
            closeTime: '23:00',
            pricePerHour: 100,
          },
        } as Facility,
      ]),
    };

    service = new ListBookingFacilitiesService(facilityRepository as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests only active facilities', async () => {
    await service.execute('tenant-1');

    expect(facilityRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant: { id: 'tenant-1' }, isActive: true },
      })
    );
  });
});
