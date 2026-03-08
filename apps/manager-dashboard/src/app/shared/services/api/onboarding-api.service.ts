import { Injectable, inject } from '@angular/core';
import {
  CompleteOnboardingRequestDto,
  CompleteOnboardingResponseDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly api = inject(ApiRequestService);

  completeOnboarding(
    request: CompleteOnboardingRequestDto
  ): Observable<CompleteOnboardingResponseDto> {
    return this.api.post(
      '/v1/onboarding/complete',
      request,
      'complete onboarding'
    );
  }
}
