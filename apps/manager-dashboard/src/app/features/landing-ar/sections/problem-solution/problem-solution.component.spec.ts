import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProblemSolutionArComponent } from './problem-solution.component';

describe('ProblemSolutionArComponent', () => {
  let component: ProblemSolutionArComponent;
  let fixture: ComponentFixture<ProblemSolutionArComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProblemSolutionArComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProblemSolutionArComponent);
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
