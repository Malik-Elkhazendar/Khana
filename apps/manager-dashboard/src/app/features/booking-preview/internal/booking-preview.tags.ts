import { CUSTOMER_TAG_MAX_LENGTH } from './booking-preview.models';

export function normalizeTagValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, CUSTOMER_TAG_MAX_LENGTH);
}

export function hasNormalizedTag(tags: string[], candidate: string): boolean {
  const normalizedCandidate = candidate.trim().toLowerCase();
  return tags.some((tag) => tag.trim().toLowerCase() === normalizedCandidate);
}
