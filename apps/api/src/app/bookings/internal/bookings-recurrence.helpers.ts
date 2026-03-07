import { BadRequestException } from '@nestjs/common';
import {
  BookingRecurrenceRuleDto,
  RecurrenceFrequency,
} from '@khana/shared-dtos';
import { CreateRecurringBookingDto } from '../dto';

const MAX_RECURRING_OCCURRENCES = 104;

export function normalizeRecurrenceRule(
  rawRule: CreateRecurringBookingDto['recurrenceRule']
): BookingRecurrenceRuleDto {
  const hasEndsAtDate = Boolean(rawRule.endsAtDate?.trim());
  const hasOccurrences = typeof rawRule.occurrences === 'number';
  if (
    (hasEndsAtDate && hasOccurrences) ||
    (!hasEndsAtDate && !hasOccurrences)
  ) {
    throw new BadRequestException(
      'Provide exactly one recurrence end condition: endsAtDate or occurrences.'
    );
  }

  if (
    (rawRule.frequency === RecurrenceFrequency.WEEKLY &&
      rawRule.intervalWeeks !== 1) ||
    (rawRule.frequency === RecurrenceFrequency.BIWEEKLY &&
      rawRule.intervalWeeks !== 2)
  ) {
    throw new BadRequestException(
      'Recurrence interval does not match selected frequency.'
    );
  }

  return {
    frequency: rawRule.frequency,
    intervalWeeks: rawRule.intervalWeeks,
    endsAtDate: rawRule.endsAtDate?.trim() || undefined,
    occurrences: rawRule.occurrences,
  };
}

export function generateRecurringOccurrences(
  startTime: Date,
  endTime: Date,
  rule: BookingRecurrenceRuleDto
): Array<{ instanceNumber: number; startTime: Date; endTime: Date }> {
  if (startTime >= endTime) {
    throw new BadRequestException('Start time must be before end time.');
  }

  const intervalDays = rule.intervalWeeks * 7;
  const occurrences: Array<{
    instanceNumber: number;
    startTime: Date;
    endTime: Date;
  }> = [];

  if (typeof rule.occurrences === 'number') {
    if (rule.occurrences > MAX_RECURRING_OCCURRENCES) {
      throw new BadRequestException(
        `Recurring bookings are capped at ${MAX_RECURRING_OCCURRENCES} instances.`
      );
    }
    for (let i = 0; i < rule.occurrences; i += 1) {
      const candidateStart = new Date(startTime);
      const candidateEnd = new Date(endTime);
      candidateStart.setDate(candidateStart.getDate() + i * intervalDays);
      candidateEnd.setDate(candidateEnd.getDate() + i * intervalDays);

      occurrences.push({
        instanceNumber: i + 1,
        startTime: candidateStart,
        endTime: candidateEnd,
      });
    }
    return occurrences;
  }

  const endsAtDateRaw = rule.endsAtDate?.trim();
  if (!endsAtDateRaw) {
    throw new BadRequestException(
      'Recurrence end date is required when occurrences are not provided.'
    );
  }

  const endsAtDate = new Date(endsAtDateRaw);
  if (Number.isNaN(endsAtDate.getTime())) {
    throw new BadRequestException('Recurrence end date is invalid.');
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(endsAtDateRaw)) {
    endsAtDate.setHours(23, 59, 59, 999);
  }
  if (endsAtDate < startTime) {
    throw new BadRequestException(
      'Recurrence end date must be on or after the first booking date.'
    );
  }

  let instanceNumber = 1;
  const candidateStart = new Date(startTime);
  const candidateEnd = new Date(endTime);
  while (candidateStart <= endsAtDate) {
    if (instanceNumber > MAX_RECURRING_OCCURRENCES) {
      throw new BadRequestException(
        `Recurring bookings are capped at ${MAX_RECURRING_OCCURRENCES} instances.`
      );
    }

    occurrences.push({
      instanceNumber,
      startTime: new Date(candidateStart),
      endTime: new Date(candidateEnd),
    });
    candidateStart.setDate(candidateStart.getDate() + intervalDays);
    candidateEnd.setDate(candidateEnd.getDate() + intervalDays);
    instanceNumber += 1;
  }

  return occurrences;
}
