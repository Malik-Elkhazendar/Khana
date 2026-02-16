import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialProofArComponent } from './social-proof.component';

describe('SocialProofArComponent', () => {
  let component: SocialProofArComponent;
  let fixture: ComponentFixture<SocialProofArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialProofArComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialProofArComponent);
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
