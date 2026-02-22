import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
  image: string;
}

@Component({
  selector: 'app-how-it-works-ar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksArComponent {
  readonly steps: Step[] = [
    {
      number: 1,
      title: 'التسجيل في دقيقتين',
      description:
        'أنشئ حسابك وأضف منشآتك أو ملاعبك أو عقاراتك. لا حاجة لخبرة تقنية.',
      icon: 'user-plus',
      image: 'assets/images/landing/how_it_works_signup.png?v=3',
    },
    {
      number: 2,
      title: 'استيراد الحجوزات الموجودة',
      description:
        'انقل حجوزاتك الحالية بسهولة من واتساب أو الورق أو الجداول. سنساعدك على البدء.',
      icon: 'upload',
      image: 'assets/images/landing/how_it_works_import.png?v=3',
    },
    {
      number: 3,
      title: 'شارك رابط الحجز',
      description:
        'احصل على رابط حجز مخصص يمكن للعملاء استخدامه للحجز مباشرة. شاركه على واتساب أو وسائل التواصل أو موقعك.',
      icon: 'share',
      image: 'assets/images/landing/how_it_works_share.png?v=3',
    },
    {
      number: 4,
      title: 'أدر كل شيء',
      description:
        'تابع الحجوزات والإيرادات وبيانات العملاء في لوحة واحدة أنيقة. الآن أنت المتحكم.',
      icon: 'zap',
      image: 'assets/images/landing/how_it_works_manage.png?v=3',
    },
  ];
}
