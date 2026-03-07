import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialProofSectionComponent } from './social-proof.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';
import { LANDING_CONTENT_AR } from '../../content/landing-content.ar';

describe('SocialProofSectionComponent', () => {
  let component: SocialProofSectionComponent;
  let fixture: ComponentFixture<SocialProofSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialProofSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialProofSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.socialProof);
    fixture.componentRef.setInput('direction', 'ltr');
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

  it('should reverse track index for rtl content', () => {
    const rtlFixture = TestBed.createComponent(SocialProofSectionComponent);
    rtlFixture.componentRef.setInput('content', LANDING_CONTENT_AR.socialProof);
    rtlFixture.componentRef.setInput('direction', 'rtl');
    rtlFixture.detectChanges();

    const rtlComponent = rtlFixture.componentInstance;
    rtlComponent.currentIndex.set(1);

    expect(rtlComponent.trackIndex()).toBe(rtlComponent.maxIndex() - 1);
  });
});
