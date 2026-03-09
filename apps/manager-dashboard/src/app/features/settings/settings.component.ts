import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsRouteFacade } from './internal/settings.route-facade';
import { SettingsScopeBadgeComponent } from './settings-scope-badge.component';

/**
 * Settings route shell. Feature-local state and save workflows live in the
 * route facade so the component stays focused on template composition.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SettingsScopeBadgeComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent extends SettingsRouteFacade {}
