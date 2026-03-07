import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { LandingFooterSectionComponent } from './landing-footer.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

describe('LandingFooterSectionComponent', () => {
  let component: LandingFooterSectionComponent;
  let fixture: ComponentFixture<LandingFooterSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingFooterSectionComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingFooterSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.footer);
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
