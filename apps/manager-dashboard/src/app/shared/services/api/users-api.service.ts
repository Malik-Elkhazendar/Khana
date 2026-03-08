import { Injectable, inject } from '@angular/core';
import {
  InviteUserRequestDto,
  InviteUserResponseDto,
  UpdateUserRoleRequestDto,
  UpdateUserStatusRequestDto,
  UserDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly api = inject(ApiRequestService);

  listUsers(): Observable<UserDto[]> {
    return this.api.get('/v1/users', 'load users');
  }

  updateUserRole(
    id: string,
    request: UpdateUserRoleRequestDto
  ): Observable<UserDto> {
    return this.api.patch(`/v1/users/${id}/role`, request, 'update user role');
  }

  updateUserStatus(
    id: string,
    request: UpdateUserStatusRequestDto
  ): Observable<UserDto> {
    return this.api.patch(
      `/v1/users/${id}/status`,
      request,
      'update user status'
    );
  }

  inviteUser(request: InviteUserRequestDto): Observable<InviteUserResponseDto> {
    return this.api.post('/v1/users/invite', request, 'invite user');
  }
}
