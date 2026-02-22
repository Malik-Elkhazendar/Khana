import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeaturesGridArComponent } from './features-grid.component';

describe('FeaturesGridArComponent', () => {
  let component: FeaturesGridArComponent;
  let fixture: ComponentFixture<FeaturesGridArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturesGridArComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturesGridArComponent);
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
