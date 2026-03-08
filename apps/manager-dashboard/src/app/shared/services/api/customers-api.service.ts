import { Injectable, inject } from '@angular/core';
import { CustomerSummaryDto } from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly api = inject(ApiRequestService);

  lookupCustomerByPhone(phone: string): Observable<CustomerSummaryDto | null> {
    return this.api.get('/v1/customers/lookup', 'lookup customer by phone', {
      params: { phone },
    });
  }

  updateCustomerTags(
    customerId: string,
    tags: string[]
  ): Observable<CustomerSummaryDto> {
    return this.api.patch(
      `/v1/customers/${customerId}/tags`,
      { tags },
      'update customer tags'
    );
  }

  getTenantTags(): Observable<string[]> {
    return this.api.get('/v1/customers/tags', 'load customer tags');
  }
}
