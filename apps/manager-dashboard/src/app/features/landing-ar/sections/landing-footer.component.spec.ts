import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { LandingFooterArComponent } from './landing-footer.component';

describe('LandingFooterArComponent', () => {
  let component: LandingFooterArComponent;
  let fixture: ComponentFixture<LandingFooterArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingFooterArComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingFooterArComponent);
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
