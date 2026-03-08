---
name: design-system
description: >
  Khana "Desert Night" design system: spacing scale, breakpoints, content archetypes,
  RTL (CSS Logical Properties), accessibility (WCAG 2.1 AA), color tokens, container
  queries, and the validation matrix. Load automatically when writing SCSS, HTML
  templates, or any layout/styling work.
---

# Khana Design System — Desert Night

**Authoritative spec:** `docs/DESIGN_SYSTEM.md` (always read it before layout changes)

This skill is a quick-reference. For the full governance rules, token list, and
validation matrix, open `docs/DESIGN_SYSTEM.md`.

---

## Color Palette

```scss
// Primary
$navy: #1a1f3c; // --color-primary — backgrounds, sidebar, headers
$gold: #d4af37; // --color-accent  — CTAs, highlights, active states
$sand: #faf8f5; // --color-surface — page backgrounds, cards

// Semantic
$success: #2d9d8f;
$error: #c75d4a;
$warning: #c4813a;

// Always use CSS custom properties, not raw hex values:
color: var(--color-primary);
background-color: var(--color-surface);
border-color: var(--color-accent);
```

---

## Spacing Scale (8px base rhythm)

```scss
--space-1: 0.25rem; //  4px — icon gaps, tight groupings
--space-2: 0.5rem; //  8px — compact grouping baseline
--space-3: 0.75rem; // 12px
--space-4: 1rem; // 16px — standard internal padding
--space-5: 1.25rem; // 20px
--space-6: 1.5rem; // 24px — section rhythm
--space-8: 2rem; // 32px — card/section separation
--space-10: 2.5rem; // 40px
--space-12: 3rem; // 48px — minimum touch target height
--space-16: 4rem; // 64px — hero/marketing rhythm
```

**Usage tiers:**

- Related controls (compact grouping): `--space-2` to `--space-4`
- Section rhythm on dashboard pages: `--space-4` to `--space-6`
- Hero/marketing: `--space-8`+

**Rule:** Never use raw `px` or `rem` values for spacing — always use `--space-*` tokens.

---

## Breakpoints

```scss
// Mobile-first — these are the canonical breakpoints:
// Mobile:        < 48rem  (< 768px)
// Tablet:       >= 48rem  (768px–1023px)
// Desktop:      >= 64rem  (>= 1024px)
// Wide desktop:  1280px, 1440px, 1920px

@media (min-width: 48rem) {
  /* tablet+ */
}
@media (min-width: 64rem) {
  /* desktop+ */
}
@media (min-width: 80rem) {
  /* wide desktop */
}
```

**Zoom-proxy breakpoints** (must also pass without layout break):

- `320px` — high zoom / narrow reflow proxy
- `2400px` — zoom-out / ultra-wide proxy

---

## Content Width Archetypes

Set via route `data.contentArchetype` — the shell applies the token automatically.
**Never** set your own `max-width` at the page level.

| Archetype     | Token                     | rem value | Use for                                 |
| ------------- | ------------------------- | --------- | --------------------------------------- |
| `'form'`      | `--content-max-form`      | 80rem     | forms, onboarding                       |
| `'data'`      | `--content-max-data`      | 88rem     | tables, calendar, lists, settings, /new |
| `'immersive'` | `--content-max-immersive` | 100%      | full-width workflows                    |

**Exceptions (document in comments):**

- `/dashboard/new` → `data` (not `form`) — preserves structural consistency at wide viewports
- `/dashboard/settings` → `data` (not `form`) — same reason

---

## Component Responsiveness: Container Queries

The shell is viewport-driven. Components inside cards/panels are **container-driven**.

```scss
// Declare container on the panel wrapping a complex component:
.booking-filters {
  container-type: inline-size;
}

// Use @container inside the component:
@container (min-width: 40rem) {
  .filter-row {
    flex-direction: row;
  }
}
```

**Rules:**

- Dense controls and tabular content → must declare `container-type: inline-size`
- Use `@container` over viewport `@media` for internal layout shifts
- No rigid `min-inline-size` on form inputs — use `clamp()` or `min()`
- Table overflow allowed only inside `.table-wrapper` — never at page level
- Charts and widgets must size to parent, no fixed pixel widths

---

## RTL — CSS Logical Properties (Mandatory)

All SCSS must use logical properties. Physical direction properties are **banned**.

| Physical (NEVER use)            | Logical (always use)                      |
| ------------------------------- | ----------------------------------------- |
| `margin-left`                   | `margin-inline-start`                     |
| `margin-right`                  | `margin-inline-end`                       |
| `padding-left`                  | `padding-inline-start`                    |
| `padding-right`                 | `padding-inline-end`                      |
| `border-left`                   | `border-inline-start`                     |
| `text-align: left`              | `text-align: start`                       |
| `text-align: right`             | `text-align: end`                         |
| `left: 0`                       | `inset-inline-start: 0`                   |
| `right: 0`                      | `inset-inline-end: 0`                     |
| `top:` / `bottom:`              | `inset-block-start:` / `inset-block-end:` |
| `width` (for reading direction) | `inline-size`                             |
| `height`                        | `block-size`                              |

RTL behavior must be validated at all dashboard breakpoints after every layout change.

---

## Accessibility (WCAG 2.1 AA)

- Color contrast: **4.5:1** for normal text, **3:1** for large text (≥ 18pt or 14pt bold)
- Focus ring: visible on all interactive elements — do not remove `outline`
- Touch targets: minimum **48×48px** (`--space-12`)
- Modals: focus trap (Tab stays inside, Escape closes)
- Keyboard nav: Tab, Shift+Tab, Enter, Space, Escape all work for all interactions
- Decorative images: `alt=""` or `aria-hidden="true"`
- Interactive elements without visible text: explicit `aria-label` required
- Form inputs: associated `<label>` or `aria-labelledby` required

---

## Compact Action Group Rules

At narrow viewports (320px, 390px):

- Multi-action groups must **stack vertically** (never crammed side by side)
- Stacked actions use **full-width controls** for consistent tap targets
- Mixed cramped wraps (one narrow button beside another) are not allowed

Calendar compact exception:

- Header navigation uses a two-row pattern at narrow widths
- Row 1: previous + next buttons
- Row 2: "today" button spans full width

---

## Shell Alignment Rules

- Breadcrumbs and page body use the **same** content max-width token — no misalignment
- First page header/card aligns with breadcrumb content start
- Sidebar + header must not duplicate primary navigation at desktop sizes

---

## Validation Checklist

Every layout-affecting change must be verified at:

- [ ] 320px (zoom/reflow proxy)
- [ ] 390px
- [ ] 768px
- [ ] 1024px
- [ ] 1280px
- [ ] 1440px
- [ ] 1920px
- [ ] 2400px (zoom-out/wide proxy)

Checks at each breakpoint:

- Horizontal overflow? (must be none)
- Navbar/sidebar/content alignment correct?
- Breadcrumb/page body alignment correct?
- Visual density and readability acceptable?
- RTL parity (both LTR and RTL render correctly)?
- Action groups stack correctly at 320/390px?

---

## Governance

Design token or layout changes require:

1. Reference to the relevant section of `docs/DESIGN_SYSTEM.md`
2. Before/after screenshots at **390px and 1440px+**
3. Explicit note on mobile regression risk

If implementation conflicts with the spec → update the spec first (or in the same PR), then implement.

---

## Full Reference

For the complete token catalog, density mode tokens, and extended governance rules:
→ `docs/DESIGN_SYSTEM.md`
