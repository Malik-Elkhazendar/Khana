import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProblemSolutionSectionComponent } from './problem-solution.component';
import { LANDING_CONTENT_EN } from '../../content/landing-content.en';

describe('ProblemSolutionSectionComponent', () => {
  let component: ProblemSolutionSectionComponent;
  let fixture: ComponentFixture<ProblemSolutionSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProblemSolutionSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProblemSolutionSectionComponent);
    fixture.componentRef.setInput(
      'content',
      LANDING_CONTENT_EN.problemSolution
    );
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
