import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { BottomCtaSectionComponent } from './bottom-cta.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

describe('BottomCtaSectionComponent', () => {
  let component: BottomCtaSectionComponent;
  let fixture: ComponentFixture<BottomCtaSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomCtaSectionComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomCtaSectionComponent);
    fixture.componentRef.setInput('content', LANDING_CONTENT_EN.bottomCta);
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
