import { BookingListItemDto } from '@khana/shared-dtos';
import {
  BookingCardStyle,
  BookingLayoutMap,
  BookingSegment,
  LayoutMetrics,
} from './booking-calendar.models';
import { getDayKey } from './booking-calendar.date';

export function buildBookingSegments(
  bookings: BookingListItemDto[]
): BookingSegment[] {
  const segments: BookingSegment[] = [];
  for (const booking of bookings) {
    const startMs = new Date(booking.startTime).getTime();
    const endMs = new Date(booking.endTime).getTime();
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      continue;
    }

    const startDay = new Date(startMs);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(endMs);
    endDay.setHours(0, 0, 0, 0);

    const cursor = new Date(startDay);
    while (cursor.getTime() <= endDay.getTime()) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const segmentStartMs = Math.max(startMs, dayStart.getTime());
      const segmentEndMs = Math.min(endMs, dayEnd.getTime());

      if (segmentEndMs > segmentStartMs) {
        const segmentStart = new Date(segmentStartMs);
        segments.push({
          id: `${booking.id}-${segmentStartMs}`,
          booking,
          startMs: segmentStartMs,
          endMs: segmentEndMs,
          startHour: segmentStart.getHours(),
          startMinutes: segmentStart.getMinutes(),
          durationMs: Math.max(0, segmentEndMs - segmentStartMs),
          dayKey: getDayKey(dayStart),
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return segments;
}

export function buildBookingsMap(
  segments: BookingSegment[]
): Map<string, BookingSegment[]> {
  const map = new Map<string, BookingSegment[]>();
  for (const segment of segments) {
    const key = `${segment.dayKey}-${segment.startHour}`;
    const slotSegments = map.get(key);
    if (slotSegments) {
      slotSegments.push(segment);
    } else {
      map.set(key, [segment]);
    }
  }
  return map;
}

export function buildLayoutMetrics(
  segments: BookingSegment[],
  now: () => number
): LayoutMetrics {
  const start = now();
  const layout: BookingLayoutMap = new Map();
  const bookingsByDay = new Map<string, BookingSegment[]>();

  for (const segment of segments) {
    const list = bookingsByDay.get(segment.dayKey);
    if (list) {
      list.push(segment);
    } else {
      bookingsByDay.set(segment.dayKey, [segment]);
    }
  }

  for (const dayBookings of bookingsByDay.values()) {
    const sorted = [...dayBookings].sort((a, b) => a.startMs - b.startMs);

    let cluster: BookingSegment[] = [];
    let clusterEnd = 0;

    for (const segment of sorted) {
      if (cluster.length === 0 || segment.startMs < clusterEnd) {
        cluster.push(segment);
        clusterEnd = Math.max(clusterEnd, segment.endMs);
      } else {
        assignClusterLayout(cluster, layout);
        cluster = [segment];
        clusterEnd = segment.endMs;
      }
    }

    if (cluster.length > 0) {
      assignClusterLayout(cluster, layout);
    }
  }

  return { layout, durationMs: now() - start };
}

export function getBookingsForSlot(
  bookingsMap: Map<string, BookingSegment[]>,
  day: Date,
  hour: string
): BookingSegment[] {
  const [hourNum] = hour.split(':').map(Number);
  const key = `${getDayKey(day)}-${hourNum}`;
  return bookingsMap.get(key) ?? [];
}

export function getBookingStyle(
  segment: BookingSegment,
  columnIndex: number,
  columnCount: number
): BookingCardStyle {
  const topPercent = (segment.startMinutes / 60) * 100;
  const durationHours = segment.durationMs / (1000 * 60 * 60);
  const heightCalc = `calc(${durationHours * 100}% - var(--space-1))`;
  const widthPercent = 100 / columnCount;
  const leftPercent = columnIndex * widthPercent;

  return {
    top: `${topPercent}%`,
    height: heightCalc,
    width: `${widthPercent}%`,
    left: `${leftPercent}%`,
    zIndex: '10',
  };
}

function assignClusterLayout(
  cluster: BookingSegment[],
  layout: BookingLayoutMap
): void {
  const columns: BookingSegment[][] = [];
  const columnIndexById = new Map<string, number>();

  for (const segment of cluster) {
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (!bookingsOverlap(last, segment)) {
        columns[i].push(segment);
        columnIndexById.set(segment.id, i);
        placed = true;
        break;
      }
    }

    if (!placed) {
      columns.push([segment]);
      columnIndexById.set(segment.id, columns.length - 1);
    }
  }

  const columnCount = columns.length;
  for (const segment of cluster) {
    layout.set(segment.id, {
      column: columnIndexById.get(segment.id) ?? 0,
      columns: columnCount,
    });
  }
}

function bookingsOverlap(a: BookingSegment, b: BookingSegment): boolean {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}
