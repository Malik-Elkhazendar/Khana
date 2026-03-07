import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HowItWorksSectionComponent } from './how-it-works.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

describe('HowItWorksSectionComponent', () => {
  let component: HowItWorksSectionComponent;
  let fixture: ComponentFixture<HowItWorksSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowItWorksSectionComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HowItWorksSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.howItWorks);
    fixture.componentRef.setInput('locale', 'en');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render without errors', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled).toBeTruthy();
  });
});
