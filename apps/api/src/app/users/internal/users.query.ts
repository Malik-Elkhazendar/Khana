import { ForbiddenException } from '@nestjs/common';
import { UserDto, UserRole } from '@khana/shared-dtos';
import {
  ACCESS_DENIED_MESSAGE,
  Actor,
  requireTenantId,
  requireUserRole,
  toUserDto,
  UsersDependencies,
} from './users.internal';

export const listUsersWorkflow = async (
  deps: UsersDependencies,
  tenantId: string,
  actor: Actor
): Promise<UserDto[]> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorRole = requireUserRole(actor.role);

  if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const users = await deps.userRepository.find({
    where: { tenantId: resolvedTenantId },
    relations: ['tenant'],
    order: { createdAt: 'ASC' },
  });

  return users.map((user) => toUserDto(user));
};
