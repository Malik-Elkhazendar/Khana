import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FacilityContextStore } from '../../shared/state';
import { LocaleFormatService } from '../../shared/services/locale-format.service';

@Component({
  selector: 'app-facilities',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './facilities.component.html',
  styleUrl: './facilities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilitiesComponent {
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly localeFormat = inject(LocaleFormatService);

  readonly facilities = this.facilityContext.facilities;
  readonly selectedFacilityId = this.facilityContext.selectedFacilityId;
  readonly loading = this.facilityContext.loading;
  readonly error = this.facilityContext.error;

  selectFacility(id: string): void {
    this.facilityContext.selectFacility(id);
  }

  retry(): void {
    this.facilityContext.refreshFacilities();
  }

  formatPrice(amount: number, currency: string): string {
    return this.localeFormat.formatCurrency(amount, currency);
  }

  trackByFacilityId(_: number, item: { id: string }): string {
    return item.id;
  }
}
