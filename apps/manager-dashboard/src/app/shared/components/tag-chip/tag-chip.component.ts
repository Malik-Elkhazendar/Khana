import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

const TAG_PALETTE_CLASSES = [
  'tag-chip--palette-a',
  'tag-chip--palette-b',
  'tag-chip--palette-c',
  'tag-chip--palette-d',
] as const;

@Component({
  selector: 'app-tag-chip',
  standalone: true,
  template: `<span [class]="chipClass()">{{ tag() }}</span>`,
  styleUrl: './tag-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagChipComponent {
  readonly tag = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');

  readonly colorClass = computed(() => resolveTagColorClass(this.tag()));

  readonly chipClass = computed(
    () => `tag-chip tag-chip--${this.size()} ${this.colorClass()}`
  );
}

export function resolveTagColorClass(tag: string): string {
  const normalized = tag.trim().toLowerCase();

  if (normalized === 'vip') return 'tag-chip--vip';
  if (normalized === 'corporate') return 'tag-chip--corporate';
  if (normalized === 'regular') return 'tag-chip--regular';

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;
  }

  return TAG_PALETTE_CLASSES[Math.abs(hash) % TAG_PALETTE_CLASSES.length];
}
