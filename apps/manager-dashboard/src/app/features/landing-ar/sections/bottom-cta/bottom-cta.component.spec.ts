import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { BottomCtaArComponent } from './bottom-cta.component';

describe('BottomCtaArComponent', () => {
  let component: BottomCtaArComponent;
  let fixture: ComponentFixture<BottomCtaArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomCtaArComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomCtaArComponent);
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

  it('should route the primary CTA to register', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const primaryCta = compiled.querySelector('.btn-primary');
    expect(primaryCta?.getAttribute('href') ?? '').toContain('/register');
  });

  it('should render secondary CTAs as real mailto links, not placeholders', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const secondaryCtas = Array.from(
      compiled.querySelectorAll('.secondary-actions .btn-outline')
    );

    expect(secondaryCtas).toHaveLength(2);
    secondaryCtas.forEach((link) => {
      expect(link.getAttribute('href') ?? '').toMatch(/^mailto:/);
      expect(link.getAttribute('href')).not.toBe('#');
    });
  });
});
