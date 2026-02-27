import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  CreateFacilityRequestDto,
  FacilityManagementItemDto,
  UpdateFacilityRequestDto,
  UserRole,
} from '@khana/shared-dtos';
import { UiStatusBadgeComponent } from '../../shared/components';
import { AuthStore } from '../../shared/state/auth.store';
import { FacilityContextStore } from '../../shared/state';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_OPEN_TIME = '08:00';
const DEFAULT_CLOSE_TIME = '23:00';
const DEFAULT_PRICE_PER_HOUR = 100;
const DEFAULT_FACILITY_TYPE = 'PADEL_COURT';
const DEFAULT_CURRENCY = 'SAR';

const FACILITY_TYPE_OPTIONS = [
  'PADEL',
  'FOOTBALL',
  'CHALET',
  'RESORT',
  'CAMP',
  'PADEL_COURT',
  'FOOTBALL_FIELD',
  'BASKETBALL_COURT',
  'TENNIS_COURT',
  'RESORT_UNIT',
  'OTHER',
] as const;

const operatingHoursValidator: ValidatorFn = (
  control
): ValidationErrors | null => {
  const openTime = `${control.get('openTime')?.value ?? ''}`;
  const closeTime = `${control.get('closeTime')?.value ?? ''}`;

  if (!HH_MM_24H_REGEX.test(openTime) || !HH_MM_24H_REGEX.test(closeTime)) {
    return null;
  }

  return toMinutes(openTime) < toMinutes(closeTime)
    ? null
    : { invalidOperatingHours: true };
};

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

function sortFacilitiesByName(
  facilities: FacilityManagementItemDto[]
): FacilityManagementItemDto[] {
  return [...facilities].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

@Component({
  selector: 'app-facilities',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    UiStatusBadgeComponent,
  ],
  templateUrl: './facilities.component.html',
  styleUrl: './facilities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilitiesComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly formBuilder = inject(FormBuilder);

  readonly facilities = signal<FacilityManagementItemDto[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly togglingFacilityId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly selectedFacilityId = signal<string | null>(null);
  readonly facilityTypes = FACILITY_TYPE_OPTIONS;

  readonly userRole = computed(() => this.authStore.user()?.role ?? null);
  readonly canManage = computed(() => {
    const role = this.userRole();
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });

  readonly isEditing = computed(() => this.selectedFacilityId() !== null);

  readonly facilityForm = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      type: [
        DEFAULT_FACILITY_TYPE,
        [Validators.required, Validators.maxLength(80)],
      ],
      pricePerHour: [
        DEFAULT_PRICE_PER_HOUR,
        [Validators.required, Validators.min(0.01)],
      ],
      openTime: [
        DEFAULT_OPEN_TIME,
        [Validators.required, Validators.pattern(HH_MM_24H_REGEX)],
      ],
      closeTime: [
        DEFAULT_CLOSE_TIME,
        [Validators.required, Validators.pattern(HH_MM_24H_REGEX)],
      ],
    },
    {
      validators: [operatingHoursValidator],
    }
  );

  constructor() {
    this.loadFacilities();
  }

  loadFacilities(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getManagedFacilities(true)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (facilities) => {
          const sorted = sortFacilitiesByName(facilities);
          this.facilities.set(sorted);

          const selectedId = this.selectedFacilityId();
          if (!selectedId) {
            return;
          }

          const selectedFacility = sorted.find(
            (facility) => facility.id === selectedId
          );

          if (selectedFacility) {
            this.patchForm(selectedFacility);
            return;
          }

          this.cancelEdit();
        },
        error: (err) => {
          this.error.set(
            this.resolveErrorMessage(err, 'Unable to load facilities.')
          );
        },
      });
  }

  retry(): void {
    this.loadFacilities();
  }

  startCreate(): void {
    this.selectedFacilityId.set(null);
    this.actionError.set(null);
    this.facilityForm.reset({
      name: '',
      type: DEFAULT_FACILITY_TYPE,
      pricePerHour: DEFAULT_PRICE_PER_HOUR,
      openTime: DEFAULT_OPEN_TIME,
      closeTime: DEFAULT_CLOSE_TIME,
    });
    this.facilityForm.markAsPristine();
    this.facilityForm.markAsUntouched();
  }

  startEdit(facility: FacilityManagementItemDto): void {
    this.selectedFacilityId.set(facility.id);
    this.actionError.set(null);
    this.patchForm(facility);
  }

  cancelEdit(): void {
    this.startCreate();
  }

  submit(): void {
    if (!this.canManage() || this.saving()) {
      return;
    }

    this.facilityForm.markAllAsTouched();
    if (this.facilityForm.invalid) {
      return;
    }

    const formValue = this.facilityForm.getRawValue();
    const payload: CreateFacilityRequestDto = {
      name: formValue.name.trim(),
      type: formValue.type.trim().toUpperCase(),
      config: {
        pricePerHour: Number(formValue.pricePerHour),
        openTime: formValue.openTime,
        closeTime: formValue.closeTime,
      },
    };

    const selectedId = this.selectedFacilityId();
    const request$ = selectedId
      ? this.api.updateFacility(selectedId, payload as UpdateFacilityRequestDto)
      : this.api.createFacility(payload);

    this.saving.set(true);
    this.actionError.set(null);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (facility) => {
        this.upsertFacility(facility);
        this.facilityContext.refreshFacilities();

        if (selectedId) {
          this.startEdit(facility);
          return;
        }

        this.startCreate();
      },
      error: (err) => {
        this.actionError.set(
          this.resolveErrorMessage(err, 'Unable to save facility.')
        );
      },
    });
  }

  toggleFacilityStatus(facility: FacilityManagementItemDto): void {
    if (!this.canManage() || this.togglingFacilityId()) {
      return;
    }

    const request$ = facility.isActive
      ? this.api.deactivateFacility(facility.id)
      : this.api.updateFacility(facility.id, { isActive: true });

    this.togglingFacilityId.set(facility.id);
    this.actionError.set(null);

    request$.pipe(finalize(() => this.togglingFacilityId.set(null))).subscribe({
      next: (updatedFacility) => {
        this.upsertFacility(updatedFacility);
        this.facilityContext.refreshFacilities();

        if (this.selectedFacilityId() === updatedFacility.id) {
          this.patchForm(updatedFacility);
        }
      },
      error: (err) => {
        this.actionError.set(
          this.resolveErrorMessage(err, 'Unable to update facility status.')
        );
      },
    });
  }

  isTogglePending(facilityId: string): boolean {
    return this.togglingFacilityId() === facilityId;
  }

  trackByFacilityId(_: number, item: FacilityManagementItemDto): string {
    return item.id;
  }

  formatPrice(amount: number): string {
    return this.localeFormat.formatCurrency(amount, DEFAULT_CURRENCY);
  }

  formatType(type: string): string {
    return type
      .split('_')
      .map((segment) =>
        segment.length > 0
          ? segment[0].toUpperCase() + segment.slice(1).toLowerCase()
          : segment
      )
      .join(' ');
  }

  formatDate(value: string): string {
    return this.localeFormat.formatDate(value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private patchForm(facility: FacilityManagementItemDto): void {
    this.facilityForm.patchValue({
      name: facility.name,
      type: facility.type,
      pricePerHour: Number(facility.config.pricePerHour),
      openTime: facility.config.openTime,
      closeTime: facility.config.closeTime,
    });
    this.facilityForm.markAsPristine();
    this.facilityForm.markAsUntouched();
  }

  private upsertFacility(facility: FacilityManagementItemDto): void {
    const current = this.facilities();
    const existingIndex = current.findIndex((item) => item.id === facility.id);

    if (existingIndex === -1) {
      this.facilities.set(sortFacilitiesByName([...current, facility]));
      return;
    }

    const next = [...current];
    next[existingIndex] = facility;
    this.facilities.set(sortFacilitiesByName(next));
  }

  private resolveErrorMessage(err: unknown, fallbackMessage: string): string {
    if (err instanceof HttpErrorResponse) {
      if (typeof err.error?.message === 'string') {
        return err.error.message;
      }

      if (Array.isArray(err.error?.message)) {
        return err.error.message.join(', ');
      }

      if (typeof err.message === 'string' && err.message.trim()) {
        return err.message;
      }
    }

    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }

    return fallbackMessage;
  }
}
