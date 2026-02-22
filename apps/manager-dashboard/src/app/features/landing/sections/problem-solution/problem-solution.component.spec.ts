import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProblemSolutionComponent } from './problem-solution.component';

describe('ProblemSolutionComponent', () => {
  let component: ProblemSolutionComponent;
  let fixture: ComponentFixture<ProblemSolutionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProblemSolutionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProblemSolutionComponent);
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
