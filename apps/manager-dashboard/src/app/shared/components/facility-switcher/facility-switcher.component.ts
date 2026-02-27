import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FacilityContextStore } from '../../state/facility-context.store';

let nextFacilitySwitcherId = 0;

@Component({
  selector: 'app-facility-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './facility-switcher.component.html',
  styleUrl: './facility-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilitySwitcherComponent {
  @Input() variant: 'default' | 'header-compact' = 'default';
  @Input() controlId?: string;

  readonly facilityContext = inject(FacilityContextStore);
  readonly facilities = this.facilityContext.facilities;
  readonly loading = this.facilityContext.loading;
  readonly error = this.facilityContext.error;
  readonly selectedFacilityId = this.facilityContext.selectedFacilityId;
  private readonly generatedControlId = `dashboard-facility-switcher-${++nextFacilitySwitcherId}`;

  get isHeaderCompact(): boolean {
    return this.variant === 'header-compact';
  }

  get showLabel(): boolean {
    return !this.isHeaderCompact;
  }

  get showStateText(): boolean {
    return !this.isHeaderCompact;
  }

  get resolvedControlId(): string {
    const configuredId = this.controlId?.trim();
    return configuredId ? configuredId : this.generatedControlId;
  }

  onFacilityChange(value: string): void {
    this.facilityContext.selectFacility(value || null);
  }

  retryLoad(): void {
    this.facilityContext.refreshFacilities();
  }

  trackByFacilityId(_: number, item: { id: string }): string {
    return item.id;
  }
}
