import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'minutesToHours',
  standalone: true,
  pure: true,
})
export class MinutesToHoursPipe implements PipeTransform {
  transform(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes < 0) {
      return '0m';
    }

    if (minutes === 0) {
      return '0m';
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }
}
