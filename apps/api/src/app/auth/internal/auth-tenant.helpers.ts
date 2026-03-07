import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { isUUID } from 'class-validator';
import { Tenant, User } from '@khana/data-access';
import { Repository } from 'typeorm';

const MAX_TENANT_SLUG_LENGTH = 50;
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_TENANT_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'dashboard',
  'help',
  'internal',
  'login',
  'logout',
  'manager',
  'onboarding',
  'owner',
  'register',
  'root',
  'settings',
  'signup',
  'staff',
  'support',
  'system',
  'www',
]);

export function normalizeWorkspaceName(name: string): string {
  const normalizedName = name?.trim();
  if (!normalizedName) {
    throw new BadRequestException('Workspace name is required');
  }
  return normalizedName;
}

export function normalizeEmail(email: string): string {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new BadRequestException('Email is required');
  }
  return normalizedEmail;
}

export function resolveBaseTenantSlug(
  requestedSlug: string | undefined,
  workspaceName: string
): string {
  const normalizedRequestedSlug = requestedSlug?.trim();
  if (normalizedRequestedSlug) {
    return normalizeTenantSlug(normalizedRequestedSlug);
  }

  const derivedSlug = slugify(workspaceName);
  if (derivedSlug && !RESERVED_TENANT_SLUGS.has(derivedSlug)) {
    return derivedSlug;
  }
  if (derivedSlug) {
    const derivedFallback = slugify(`${derivedSlug}-workspace`);
    if (derivedFallback && !RESERVED_TENANT_SLUGS.has(derivedFallback)) {
      return derivedFallback;
    }
  }

  return assertAllowedSlug(
    `workspace-${randomBytes(4).toString('hex').toLowerCase()}`
  );
}

export function normalizeTenantSlug(slug: string): string {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) {
    throw new BadRequestException('Workspace slug is required');
  }
  if (normalizedSlug.length > MAX_TENANT_SLUG_LENGTH) {
    throw new BadRequestException('Workspace slug is too long');
  }
  if (!TENANT_SLUG_PATTERN.test(normalizedSlug)) {
    throw new BadRequestException('Workspace slug format is invalid');
  }
  return assertAllowedSlug(normalizedSlug);
}

export async function generateAvailableTenantSlug(
  tenantRepository: Repository<Tenant>,
  baseSlug: string
): Promise<string> {
  let candidateSlug = baseSlug;
  let suffix = 2;

  while (await tenantRepository.exists({ where: { slug: candidateSlug } })) {
    candidateSlug = assertAllowedSlug(withSlugSuffix(baseSlug, suffix));
    suffix += 1;
  }

  return candidateSlug;
}

export function isUniqueViolation(
  error: unknown,
  constraintName?: string
): error is { code?: string; constraint?: string } {
  if (typeof error !== 'object' || !error) {
    return false;
  }

  const maybePgError = error as { code?: string; constraint?: string };
  if (maybePgError.code !== '23505') {
    return false;
  }

  if (!constraintName) {
    return true;
  }

  return maybePgError.constraint === constraintName;
}

export async function resolveTenantId(
  tenantRepository: Repository<Tenant>,
  tenantId?: string
): Promise<string> {
  if (!tenantId || !isUUID(tenantId)) {
    throw new BadRequestException('Tenant ID is required');
  }

  const tenantExists = await tenantRepository.exists({
    where: { id: tenantId },
  });

  if (!tenantExists) {
    throw new BadRequestException('Invalid tenant ID');
  }

  return tenantId;
}

export async function resolveTenantIdForLogin(
  userRepository: Repository<User>,
  tenantRepository: Repository<Tenant>,
  email: string,
  tenantId?: string
): Promise<string> {
  if (tenantId) {
    return resolveTenantId(tenantRepository, tenantId);
  }

  const candidates = await userRepository.find({
    where: { email },
    select: ['id', 'tenantId'],
    take: 2,
  });

  if (candidates.length === 1 && candidates[0]?.tenantId) {
    return candidates[0].tenantId;
  }

  if (candidates.length > 1) {
    throw new BadRequestException(
      'Workspace is required. Please use your workspace login link.'
    );
  }

  throw new UnauthorizedException('Invalid email or password');
}

function slugify(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TENANT_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

function assertAllowedSlug(slug: string): string {
  if (RESERVED_TENANT_SLUGS.has(slug)) {
    throw new BadRequestException('Workspace slug is reserved');
  }
  return slug;
}

function withSlugSuffix(baseSlug: string, suffix: number): string {
  const suffixToken = `-${suffix}`;
  const trimmedBase = baseSlug.slice(
    0,
    Math.max(1, MAX_TENANT_SLUG_LENGTH - suffixToken.length)
  );
  return `${trimmedBase}${suffixToken}`;
}
