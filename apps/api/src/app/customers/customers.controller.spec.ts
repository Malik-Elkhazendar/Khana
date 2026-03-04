import { Test } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;

  const customersService = {
    lookupByPhone: jest.fn(),
    updateTags: jest.fn(),
    getTenantTags: jest.fn(),
    toSummaryDto: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: customersService }],
    }).compile();

    controller = moduleRef.get(CustomersController);
  });

  it('lookupByPhone returns null when no phone query is provided', async () => {
    const result = await controller.lookupByPhone('tenant-1', {} as never);

    expect(result).toBeNull();
    expect(customersService.lookupByPhone).not.toHaveBeenCalled();
  });

  it('lookupByPhone maps customer entity to summary dto', async () => {
    const customer = { id: 'customer-1' };
    const summary = { id: 'customer-1', name: 'Layla', phone: '+966551234567' };

    customersService.lookupByPhone.mockResolvedValueOnce(customer);
    customersService.toSummaryDto.mockReturnValueOnce(summary);

    const result = await controller.lookupByPhone(
      'tenant-1',
      {} as never,
      '0551234567'
    );

    expect(customersService.lookupByPhone).toHaveBeenCalledWith(
      'tenant-1',
      '0551234567'
    );
    expect(customersService.toSummaryDto).toHaveBeenCalledWith(customer);
    expect(result).toEqual(summary);
  });

  it('lookupByPhone returns null when customer is not found', async () => {
    customersService.lookupByPhone.mockResolvedValueOnce(null);

    const result = await controller.lookupByPhone(
      'tenant-1',
      {} as never,
      '0551234567'
    );

    expect(customersService.lookupByPhone).toHaveBeenCalledWith(
      'tenant-1',
      '0551234567'
    );
    expect(result).toBeNull();
  });

  it('updateCustomerTags persists tags and returns summary', async () => {
    const customer = { id: 'customer-1', tags: ['VIP'] };
    const summary = {
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      tags: ['VIP'],
    };

    customersService.updateTags.mockResolvedValueOnce(customer);
    customersService.toSummaryDto.mockReturnValueOnce(summary);

    const result = await controller.updateCustomerTags(
      'tenant-1',
      {} as never,
      'customer-1',
      { tags: ['VIP'] }
    );

    expect(customersService.updateTags).toHaveBeenCalledWith(
      'tenant-1',
      'customer-1',
      ['VIP']
    );
    expect(result).toEqual(summary);
  });

  it('getTenantTags delegates to service', async () => {
    customersService.getTenantTags.mockResolvedValueOnce(['VIP', 'Corporate']);

    const result = await controller.getTenantTags('tenant-1', {} as never);

    expect(customersService.getTenantTags).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual(['VIP', 'Corporate']);
  });
});
