import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ComparisonItem {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-problem-solution-ar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './problem-solution.component.html',
  styleUrl: './problem-solution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemSolutionArComponent {
  readonly oldWayItems: ComparisonItem[] = [
    { icon: 'cross', text: 'رسائل واتساب لا تنتهي للتحقق من التوافر' },
    { icon: 'cross', text: 'تقويمات ورقية مليئة بالشطب' },
    { icon: 'cross', text: 'اتصالات متكررة فقط للتأكيد' },
    { icon: 'cross', text: 'حجوزات مزدوجة تُحرج نشاطك' },
    {
      icon: 'cross',
      text: 'الرسائل القديمة مليئة بالارتباك ولا تعطي رؤية للإيرادات',
    },
  ];

  readonly newWayItems: ComparisonItem[] = [
    { icon: 'check', text: 'توافر فوري واضح للجميع' },
    { icon: 'check', text: 'تقويم رقمي متزامن عبر كل الأجهزة' },
    { icon: 'check', text: 'تأكيد فوري بدون انتظار' },
    { icon: 'check', text: 'كشف ذكي للتعارض يمنع التداخل' },
    { icon: 'check', text: 'تحليلات كاملة وتتبع للإيرادات' },
  ];
}
