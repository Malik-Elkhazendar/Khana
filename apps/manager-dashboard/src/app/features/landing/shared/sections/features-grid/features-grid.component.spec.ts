import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeaturesGridSectionComponent } from './features-grid.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

describe('FeaturesGridSectionComponent', () => {
  let component: FeaturesGridSectionComponent;
  let fixture: ComponentFixture<FeaturesGridSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturesGridSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturesGridSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.featuresGrid);
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
