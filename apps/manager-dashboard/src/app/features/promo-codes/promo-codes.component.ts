import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  ConfirmationDialogComponent,
  UiStatusBadgeComponent,
} from '../../shared/components';
import { PromoCodesRouteFacade } from './internal/promo-codes.route-facade';

/**
 * Promo-code management route shell.
 * Internal route layers own form state, filters, and modal actions.
 */
@Component({
  selector: 'app-promo-codes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    ConfirmationDialogComponent,
    UiStatusBadgeComponent,
  ],
  providers: [FormBuilder],
  templateUrl: './promo-codes.component.html',
  styleUrl: './promo-codes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoCodesComponent extends PromoCodesRouteFacade {}
