import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, share, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const holdTimerTick$ = interval(1000).pipe(startWith(0), share());

type HoldTimerState = 'active' | 'expired' | 'none';

type HoldTimerView = {
  state: HoldTimerState;
  label: string;
};

@Component({
  selector: 'app-hold-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hold-timer.component.html',
  styleUrl: './hold-timer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoldTimerComponent implements OnInit {
  @Input() prefix = 'Expires in';
  @Input() expiredLabel = 'Expired';
  @Input() emptyLabel = 'Unavailable';

  private readonly destroyRef = inject(DestroyRef);
  private readonly holdUntilValue = signal<string | null>(null);
  readonly now = signal(Date.now());

  readonly view = computed<HoldTimerView>(() => {
    const holdUntil = this.holdUntilValue();
    if (!holdUntil) {
      return { state: 'none', label: this.emptyLabel };
    }

    const holdUntilMs = new Date(holdUntil).getTime();
    if (Number.isNaN(holdUntilMs)) {
      return { state: 'none', label: this.emptyLabel };
    }

    const remainingMs = holdUntilMs - this.now();
    if (remainingMs <= 0) {
      return { state: 'expired', label: this.expiredLabel };
    }

    return { state: 'active', label: this.formatDuration(remainingMs) };
  });

  @Input() set holdUntil(value: string | null | undefined) {
    this.holdUntilValue.set(value ?? null);
  }

  ngOnInit(): void {
    holdTimerTick$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
}
