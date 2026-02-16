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
});
