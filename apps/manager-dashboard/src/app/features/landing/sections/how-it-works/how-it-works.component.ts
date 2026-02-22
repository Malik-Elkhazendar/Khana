import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
  image: string;
}

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksComponent {
  readonly steps: Step[] = [
    {
      number: 1,
      title: 'Sign Up in 2 Minutes',
      description:
        'Create your account and add your facilities, courts, or properties. No technical knowledge required.',
      icon: 'user-plus',
      image: 'assets/images/landing/how_it_works_signup.png?v=3',
    },
    {
      number: 2,
      title: 'Import Existing Bookings',
      description:
        "Easily migrate your existing bookings from WhatsApp, paper, or spreadsheets. We'll help you get started.",
      icon: 'upload',
      image: 'assets/images/landing/how_it_works_import.png?v=3',
    },
    {
      number: 3,
      title: 'Share Booking Link',
      description:
        'Get a unique booking URL that customers can use to book directly. Share it on WhatsApp, social media, or your website.',
      icon: 'share',
      image: 'assets/images/landing/how_it_works_share.png?v=3',
    },
    {
      number: 4,
      title: 'Manage Everything',
      description:
        "Track bookings, revenue, and customer data in one beautiful dashboard. You're now in control.",
      icon: 'zap',
      image: 'assets/images/landing/how_it_works_manage.png?v=3',
    },
  ];
}
