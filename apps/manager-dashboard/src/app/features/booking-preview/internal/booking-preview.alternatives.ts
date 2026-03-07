import { AlternativeSlotDto } from '@khana/shared-dtos';
import {
  ALTERNATIVES_ROW_HEIGHT_PX,
  ALTERNATIVES_WINDOW_SIZE,
  AlternativesWindow,
} from './booking-preview.models';

export function buildAlternativesWindow(
  alternatives: AlternativeSlotDto[],
  shouldVirtualize: boolean,
  scrollTop: number
): AlternativesWindow {
  if (!shouldVirtualize) {
    return {
      items: alternatives,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 0,
    };
  }

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ALTERNATIVES_ROW_HEIGHT_PX) - 2
  );
  const endIndex = Math.min(
    alternatives.length,
    startIndex + ALTERNATIVES_WINDOW_SIZE
  );
  const paddingTop = startIndex * ALTERNATIVES_ROW_HEIGHT_PX;
  const paddingBottom =
    (alternatives.length - endIndex) * ALTERNATIVES_ROW_HEIGHT_PX;

  return {
    items: alternatives.slice(startIndex, endIndex),
    paddingTop,
    paddingBottom,
    totalHeight: alternatives.length * ALTERNATIVES_ROW_HEIGHT_PX,
  };
}
