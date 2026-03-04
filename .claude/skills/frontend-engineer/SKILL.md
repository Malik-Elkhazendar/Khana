---
name: frontend-engineer
description: >
  Angular component development for Khana: standalone components with SignalStore,
  RTL (CSS Logical Properties), WCAG 2.1 AA accessibility, Desert Night design system,
  and i18n. Use when building or modifying frontend features.
# Claude Code extension:
disable-model-invocation: true
---

# Frontend Engineer — Angular Component Development

Implement Angular features for the Khana manager dashboard.

## Key References

- Architecture rules and layout archetypes: `CLAUDE.md`
- Design system (Desert Night): `docs/DESIGN_SYSTEM.md`
- Component patterns: `.claude/skills/project-guardrails/SKILL.md §5–7`
- Navigation additions: `.claude/skills/project-guardrails/SKILL.md §10`
- Feature locations: `.claude/skills/project-index/SKILL.md`

---

## Tech Stack

- **Framework:** Angular 20.x — standalone components only (no NgModules for features)
- **State:** `@ngrx/signals` (SignalStore)
- **Styling:** SCSS + CSS Logical Properties
- **Change Detection:** `OnPush` on all components
- **i18n:** `@ngx-translate/core` with keys in `public/assets/i18n/`

---

## Component Pattern

```ts
@Component({
  selector: 'app-resource',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './resource.component.html',
  styleUrl: './resource.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceComponent implements OnInit {
  private readonly store = inject(ResourceStore);
  private readonly translateService = inject(TranslateService, { optional: true });
  private readonly languageService = inject(LanguageService, { optional: true });

  // Expose store signals directly:
  readonly items = this.store.items;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  // Local UI state:
  readonly filterValue = signal('');

  // Derived state:
  readonly filteredItems = computed(() => this.items().filter((i) => i.name.includes(this.filterValue())));

  ngOnInit(): void {
    this.store.loadItems();
  }

  private t(key: string, fallback: string): string {
    this.languageService?.languageVersion(); // signal tap for reactivity
    const translated = this.translateService?.instant(key);
    return translated && translated !== key ? translated : fallback;
  }
}
```

---

## RTL Rules — Mandatory

Use CSS Logical Properties **exclusively**. Never use physical direction properties.

| Physical (BANNED)   | Logical (USE)           |
| ------------------- | ----------------------- |
| `margin-left`       | `margin-inline-start`   |
| `margin-right`      | `margin-inline-end`     |
| `padding-left`      | `padding-inline-start`  |
| `padding-right`     | `padding-inline-end`    |
| `text-align: left`  | `text-align: start`     |
| `text-align: right` | `text-align: end`       |
| `border-left`       | `border-inline-start`   |
| `left: 0`           | `inset-inline-start: 0` |

---

## Desert Night Theme

```scss
// Primary palette:
$navy: #1a1f3c;
$gold: #d4af37;
$sand: #faf8f5;

// Semantic:
$success: #2d9d8f;
$error: #c75d4a;
$warning: #c4813a;

// Use CSS custom properties defined in the design system:
color: var(--color-primary);
background: var(--color-surface);
```

---

## Accessibility Rules (WCAG 2.1 AA)

- All interactive elements: explicit `aria-label` or visible label
- Modals and dialogs: focus trap (Tab stays inside modal, Escape closes)
- Keyboard navigation: Tab, Shift+Tab, Enter, Space, Escape all work
- Minimum touch target: 48×48px
- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Decorative images: `alt=""` or `aria-hidden="true"`

---

## i18n Pattern

Translation keys follow namespace convention:

- Nav items: `DASHBOARD.NAV.ITEMS.<NAME>`
- Breadcrumbs: `DASHBOARD.BREADCRUMBS.<NAME>`
- Page titles: `META.TITLES.<NAME>`
- Feature keys: `<FEATURE_NAME>.<SECTION>.<KEY>`

```ts
// Add keys to BOTH files:
// public/assets/i18n/en.json
// public/assets/i18n/ar.json

// Sync after changes:
// npm run i18n:extract
// npm run i18n:audit
```

---

## SignalStore Pattern (for new stores)

```ts
type ResourceState = {
  items: ResourceDto[];
  loading: boolean;
  error: Error | null;
};

export const ResourceStore = signalStore(
  { providedIn: 'root' },
  withState<ResourceState>({ items: [], loading: false, error: null }),
  withMethods((store, api = inject(ApiService)) => ({
    loadItems: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getItems().pipe(
            tap((items) => patchState(store, { items, loading: false })),
            catchError((err) => {
              patchState(store, { loading: false, error: err });
              return of([]);
            })
          )
        )
      )
    ),
  }))
);
```

---

## Route Registration

In `apps/manager-dashboard/src/app/app.routes.ts`:

```ts
{
  path: 'resource',
  component: ResourceComponent,
  data: { contentArchetype: 'data' },   // 'form' | 'data' | 'immersive'
}
```

---

## Component Checklist

- [ ] `standalone: true` with explicit `imports: []`
- [ ] `changeDetection: ChangeDetectionStrategy.OnPush`
- [ ] All SCSS uses CSS Logical Properties (no `left`/`right`)
- [ ] ARIA labels on all buttons and interactive elements
- [ ] Translation keys added to `en.json` and `ar.json`
- [ ] Route registered with correct `contentArchetype`
- [ ] Navigation item added to `dashboard-nav.ts` + `ui-icon.component.html` (if nav link needed)
- [ ] Unit test created or updated

---

## Start

Tell me what component to build (e.g., "analytics today snapshot", "customer tags editor", "waitlist management page").
