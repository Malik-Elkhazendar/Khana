import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type SettingsScopeKind = 'personal' | 'tenant';

@Component({
  selector: 'app-settings-scope-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './settings-scope-badge.component.html',
  styleUrl: './settings-scope-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsScopeBadgeComponent {
  @Input({ required: true }) kind: SettingsScopeKind = 'personal';
  @Input({ required: true }) labelKey = '';
}
