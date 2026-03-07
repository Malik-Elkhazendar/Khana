import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import {
  BookingCardPresentation,
  BookingCardTypographyMetrics,
  BookingPresentationMetrics,
} from './booking-calendar.models';

export function extractCardTypographyMetrics(
  card: HTMLElement | null
): BookingCardTypographyMetrics | null {
  if (!card) return null;

  const cardStyle = getComputedStyle(card);
  const nameEl = card.querySelector<HTMLElement>(
    '.calendar__booking-name, .calendar__timeline-name'
  );
  const metaEl = card.querySelector<HTMLElement>(
    '.calendar__booking-facility, .calendar__timeline-meta'
  );

  const nameStyle = nameEl ? getComputedStyle(nameEl) : null;
  const metaStyle = metaEl ? getComputedStyle(metaEl) : null;
  const nameLineHeightPx = readLineHeightPx(nameStyle);
  const metaLineHeightPx = readLineHeightPx(metaStyle);

  if (nameLineHeightPx <= 0 || metaLineHeightPx <= 0) {
    return null;
  }

  return {
    paddingBlockPx: Math.max(
      parsePxValue(cardStyle.paddingBlockStart),
      parsePxValue(cardStyle.paddingBlockEnd)
    ),
    rowGapPx: parsePxValue(cardStyle.rowGap || cardStyle.gap),
    nameLineHeightPx,
    metaLineHeightPx,
  };
}

export function readRootCssVarPx(cssVarName: string): number {
  if (typeof document === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVarName)
    .trim();
  return parsePxValue(value);
}

export function buildBookingPresentation(
  metrics: BookingPresentationMetrics
): BookingCardPresentation {
  if (
    !metrics.typography ||
    metrics.availableBlockPx <= 0 ||
    metrics.availableInlinePx <= 0
  ) {
    return {
      density: 'standard',
      showTagChip: false,
      showTagDot: metrics.hasTags,
      showFacility: true,
    };
  }

  const compactMinBlockPx =
    metrics.typography.paddingBlockPx * 2 + metrics.typography.nameLineHeightPx;
  const standardMinBlockPx =
    compactMinBlockPx +
    metrics.typography.rowGapPx +
    metrics.typography.metaLineHeightPx;
  const standardMinInlinePx =
    metrics.typography.nameLineHeightPx * (metrics.hasTags ? 5 : 4.25);
  const expandedMinInlinePx =
    metrics.typography.nameLineHeightPx * (metrics.hasTags ? 7 : 5.5);

  const fitsStandard =
    metrics.availableBlockPx >= standardMinBlockPx &&
    metrics.availableInlinePx >= standardMinInlinePx;
  const fitsExpanded =
    !metrics.hasOverlap &&
    fitsStandard &&
    metrics.availableInlinePx >= expandedMinInlinePx;

  let density: BookingCardPresentation['density'] = 'compact';
  if (fitsExpanded) {
    density = 'expanded';
  } else if (fitsStandard) {
    density = 'standard';
  }

  return {
    density,
    showTagChip: metrics.hasTags && density === 'expanded',
    showTagDot: metrics.hasTags && density !== 'expanded',
    showFacility: density !== 'compact',
  };
}

export function getStatusClass(status: BookingStatus): string {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return 'booking--confirmed';
    case BookingStatus.PENDING:
      return 'booking--pending';
    case BookingStatus.CANCELLED:
      return 'booking--cancelled';
    case BookingStatus.COMPLETED:
      return 'booking--completed';
    case BookingStatus.NO_SHOW:
      return 'booking--no-show';
    default:
      return '';
  }
}

export function statusTone(
  status: BookingStatus
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case BookingStatus.CONFIRMED:
    case BookingStatus.COMPLETED:
      return 'success';
    case BookingStatus.PENDING:
      return 'warning';
    case BookingStatus.CANCELLED:
    case BookingStatus.NO_SHOW:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function paymentTone(
  status: PaymentStatus
): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case PaymentStatus.PAID:
      return 'success';
    case PaymentStatus.PARTIALLY_PAID:
      return 'warning';
    default:
      return 'neutral';
  }
}

export function isHoldActive(
  status: BookingStatus,
  holdUntil: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (status !== BookingStatus.PENDING || !holdUntil) {
    return false;
  }

  return new Date(holdUntil).getTime() > now;
}

function readLineHeightPx(style: CSSStyleDeclaration | null): number {
  if (!style) return 0;
  const explicit = parsePxValue(style.lineHeight);
  if (explicit > 0) return explicit;
  const fontSize = parsePxValue(style.fontSize);
  return fontSize > 0 ? fontSize * 1.2 : 0;
}

function parsePxValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
