import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Customer } from '@khana/data-access';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;

  const customerRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };

  const bookingRepository = {
    createQueryBuilder: jest.fn(),
  };

  const insertExecute = jest.fn();
  const insertOnConflict = jest.fn(() => ({ execute: insertExecute }));
  const insertValues = jest.fn(() => ({ onConflict: insertOnConflict }));
  const insertInto = jest.fn(() => ({ values: insertValues }));
  const insertBuilder = { into: insertInto };

  const metricsBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getRawOne: jest.fn(),
  };

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    metricsBuilder.select.mockReturnValue(metricsBuilder);
    metricsBuilder.addSelect.mockReturnValue(metricsBuilder);
    metricsBuilder.innerJoin.mockReturnValue(metricsBuilder);
    metricsBuilder.where.mockReturnValue(metricsBuilder);
    metricsBuilder.andWhere.mockReturnValue(metricsBuilder);

    customerRepository.createQueryBuilder.mockReturnValue({
      insert: () => insertBuilder,
    });
    bookingRepository.createQueryBuilder.mockReturnValue(
      metricsBuilder as never
    );

    service = new CustomersService(
      customerRepository as never,
      bookingRepository as never,
      appLogger as never
    );
  });

  it('lookupByPhone returns customer when found using normalized phone', async () => {
    const expected = { id: 'customer-1' } as Customer;
    customerRepository.findOne.mockResolvedValueOnce(expected);

    const result = await service.lookupByPhone('tenant-1', '055 123 4567');

    expect(customerRepository.findOne).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        phone: '+966551234567',
      },
    });
    expect(result).toBe(expected);
  });

  it('lookupByPhone returns null for invalid phone', async () => {
    const result = await service.lookupByPhone('tenant-1', '123');

    expect(result).toBeNull();
    expect(customerRepository.findOne).not.toHaveBeenCalled();
  });

  it('upsert inserts/updates by tenant and phone without overwriting tags', async () => {
    customerRepository.findOne.mockResolvedValueOnce({
      id: 'customer-1',
      tenantId: 'tenant-1',
      phone: '+966551234567',
      name: 'Layla',
      tags: ['VIP'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer);

    const result = await service.upsert('tenant-1', ' Layla ', '+966551234567');

    expect(insertExecute).toHaveBeenCalled();
    expect(result.id).toBe('customer-1');
    expect(customerRepository.findOne).toHaveBeenLastCalledWith({
      where: {
        tenantId: 'tenant-1',
        phone: '+966551234567',
      },
    });
  });

  it('upsert preserves existing non-placeholder customer names', async () => {
    customerRepository.findOne.mockResolvedValueOnce({
      id: 'customer-1',
      tenantId: 'tenant-1',
      phone: '+966551234567',
      name: 'Existing Name',
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer);

    await service.upsert('tenant-1', 'Unknown Customer', '+966551234567');

    expect(insertOnConflict).toHaveBeenCalledWith(
      expect.stringContaining(
        `COALESCE(NULLIF(BTRIM("customers"."name"), ''), 'Unknown Customer')`
      )
    );
    expect(insertOnConflict).toHaveBeenCalledWith(
      expect.stringContaining(`EXCLUDED."name" <> 'Unknown Customer'`)
    );
  });

  it('upsert throws BadRequestException for invalid phone', async () => {
    await expect(service.upsert('tenant-1', 'Layla', 'ABC')).rejects.toThrow(
      BadRequestException
    );
  });

  it('updateTags normalizes tags with trim and case-insensitive dedupe', async () => {
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      phone: '+966551234567',
      name: 'Layla',
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;

    customerRepository.findOne.mockResolvedValueOnce(customer);
    customerRepository.save.mockResolvedValueOnce({
      ...customer,
      tags: ['VIP', 'Corporate', 'regular member'],
    } as Customer);

    const result = await service.updateTags('tenant-1', 'customer-1', [
      ' VIP ',
      'vip',
      'Corporate',
      ' regular   member ',
      '',
    ]);

    expect(customerRepository.save).toHaveBeenCalledWith({
      ...customer,
      tags: ['VIP', 'Corporate', 'regular member'],
    });
    expect(result.tags).toEqual(['VIP', 'Corporate', 'regular member']);
  });

  it('updateTags throws NotFoundException for missing customer', async () => {
    customerRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.updateTags('tenant-1', 'missing-customer', ['VIP'])
    ).rejects.toThrow(NotFoundException);
  });

  it('getTenantTags returns sorted distinct values', async () => {
    customerRepository.query.mockResolvedValueOnce([
      { tag: 'VIP' },
      { tag: ' corporate ' },
      { tag: 'vip' },
      { tag: null },
    ]);

    const result = await service.getTenantTags('tenant-1');

    expect(customerRepository.query).toHaveBeenCalled();
    expect(result).toEqual(['corporate', 'VIP']);
  });

  it('toSummaryDto resolves booking metrics for customer', async () => {
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      phone: '+966551234567',
      name: 'Layla',
      tags: ['VIP'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;

    metricsBuilder.getRawOne.mockResolvedValueOnce({
      totalBookings: '3',
      totalSpend: '450',
      lastBookingDate: '2026-03-01T10:00:00.000Z',
    });

    const summary = await service.toSummaryDto(customer);

    expect(summary).toMatchObject({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 3,
      totalSpend: 450,
      tags: ['VIP'],
    });
    expect(summary.lastBookingDate).toEqual(
      new Date('2026-03-01T10:00:00.000Z')
    );
  });

  it('toSummaryDto falls back to zero metrics when bookings are absent', async () => {
    const customer = {
      id: 'customer-1',
      tenantId: 'tenant-1',
      phone: '+966551234567',
      name: 'Layla',
      tags: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;

    metricsBuilder.getRawOne.mockResolvedValueOnce({
      totalBookings: null,
      totalSpend: null,
      lastBookingDate: null,
    });

    const summary = await service.toSummaryDto(customer);

    expect(summary.totalBookings).toBe(0);
    expect(summary.totalSpend).toBe(0);
    expect(summary.lastBookingDate).toBeUndefined();
  });
});
