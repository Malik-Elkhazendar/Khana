import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialProofComponent } from './social-proof.component';

describe('SocialProofComponent', () => {
  let component: SocialProofComponent;
  let fixture: ComponentFixture<SocialProofComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialProofComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialProofComponent);
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
