import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HowItWorksArComponent } from './how-it-works.component';

describe('HowItWorksArComponent', () => {
  let component: HowItWorksArComponent;
  let fixture: ComponentFixture<HowItWorksArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowItWorksArComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HowItWorksArComponent);
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
