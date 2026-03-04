import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TagChipComponent, resolveTagColorClass } from './tag-chip.component';

describe('TagChipComponent', () => {
  let fixture: ComponentFixture<TagChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagChipComponent);
  });

  it('renders tag value with default md size', () => {
    fixture.componentRef.setInput('tag', 'VIP');
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector(
      '.tag-chip'
    ) as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.textContent?.trim()).toBe('VIP');
    expect(chip.classList.contains('tag-chip--md')).toBe(true);
  });

  it('applies known semantic color class for vip', () => {
    expect(resolveTagColorClass('VIP')).toBe('tag-chip--vip');
  });

  it('applies known semantic color class for corporate', () => {
    expect(resolveTagColorClass(' corporate ')).toBe('tag-chip--corporate');
  });

  it('returns deterministic palette class for unknown tags', () => {
    const first = resolveTagColorClass('Loyal');
    const second = resolveTagColorClass('Loyal');

    expect(first).toBe(second);
    expect(first.startsWith('tag-chip--palette-')).toBe(true);
  });
});
