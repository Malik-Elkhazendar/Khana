import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MinutesToHoursPipe } from '../../shared/pipes/minutes-to-hours.pipe';
import { TodaySnapshotComponent } from './today-snapshot/today-snapshot.component';
import { AnalyticsRouteFacade } from './internal/analytics.route-facade';

/**
 * Analytics route shell. Filter orchestration and trend view-model generation
 * live in the feature-local route facade so the component stays compositional.
 */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TodaySnapshotComponent,
    MinutesToHoursPipe,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent extends AnalyticsRouteFacade {}
