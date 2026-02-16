import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { BottomCtaComponent } from './bottom-cta.component';

describe('BottomCtaComponent', () => {
  let component: BottomCtaComponent;
  let fixture: ComponentFixture<BottomCtaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomCtaComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomCtaComponent);
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
