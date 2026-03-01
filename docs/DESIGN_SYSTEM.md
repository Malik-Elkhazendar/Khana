# Khana Design System

This document is the canonical source of truth for dashboard layout, spacing, and responsive behavior.

## 1) Principles

- Mobile-first: small screens are baseline quality and must not regress when desktop is tuned.
- Role-driven density: operational dashboard pages favor clarity with moderate compactness on desktop.
- Tokenized geometry: widths, gutters, and spacing come from tokens, not ad-hoc per-page values.
- Logical CSS: use logical properties for RTL compatibility.

## 2) Spacing Scale

Base spacing uses an 8px rhythm with a 4px half-step:

- `--space-1`: 0.25rem (4px)
- `--space-2`: 0.5rem (8px)
- `--space-3`: 0.75rem (12px)
- `--space-4`: 1rem (16px)
- `--space-5`: 1.25rem (20px)
- `--space-6`: 1.5rem (24px)
- `--space-8`: 2rem (32px)
- `--space-10`: 2.5rem (40px)
- `--space-12`: 3rem (48px)
- `--space-16`: 4rem (64px)

Usage tiers:

- Compact grouping: `--space-2` to `--space-4`
- Standard section rhythm: `--space-4` to `--space-6`
- Hero/marketing rhythm: `--space-8`+

## 3) Breakpoints

Canonical breakpoints:

- Mobile: `< 48rem` (<768px)
- Tablet: `>= 48rem` and `< 64rem` (768px to 1023px)
- Desktop: `>= 64rem` (>=1024px)
- Wide desktop checks: 1280px, 1440px, 1920px
- Zoom-proxy checks: 320px (high zoom/reflow) and 2400px (zoom-out/ultra-wide)

Rule: component-level media queries should align with these breakpoints unless an explicit exception is documented.

## 4) Content Width Strategy (Hybrid)

The shell is fluid; inner content uses route/page archetypes.

Tokens:

- `--content-max-form: 80rem` (forms/settings/onboarding)
- `--content-max-data: 88rem` (tables/calendar/operations)
- `--content-max-analytics-wide: 96rem` (future dense analytics only)
- `--content-max-immersive: 100%` (full-width workflows)

Archetype classes:

- `.dashboard-page--form`
- `.dashboard-page--data`
- `.dashboard-page--immersive`

No page should define its own top-level max width outside this token contract.

Operational exceptions:

- `/dashboard/new` uses `data` archetype (not `form`) to preserve structural consistency with other operational dashboard pages at wide and zoomed-out desktop viewports.
- `/dashboard/settings` uses `data` archetype (not `form`) for the same reason.

## 5) Content Density Modes

Dashboard default density by breakpoint:

- Mobile: preserve comfortable rhythm.
- Desktop: reduce vertical rhythm by one token step for operational pages.

Dashboard content tokens:

- `--content-gutter-mobile`, `--content-gutter-tablet`, `--content-gutter-desktop`
- `--content-gap-mobile`, `--content-gap-desktop`
- `--content-padding-block-mobile`, `--content-padding-block-desktop`
- `--table-min-inline-tight`, `--table-min-inline-standard`, `--table-min-inline-wide`

## 6) Component Adaptation Contract

Use a two-layer responsive model:

- Shell responsiveness (header/sidebar/route container) is viewport-driven.
- Component responsiveness (filters/forms/tables/widgets inside cards) is container-driven.

Mandatory rules:

- Panels with dense controls or tabular content should declare `container-type: inline-size`.
- Internal layout shifts should prefer `@container` queries over viewport media queries.
- Avoid rigid `min-inline-size` on form inputs; use fluid width with clamp/min patterns.
- Table overflow is allowed only inside table wrappers; page-level horizontal scrolling is not allowed.
- Charts and widgets must size to parent containers and reflow without fixed pixel widths.
- Compact action group policy:
  - At compact widths (320/390 target), multi-action groups must stack vertically.
  - Stacked actions must use full-width controls for consistent tap targets and visual rhythm.
  - Mixed cramped wraps (one narrow button beside another) are not allowed.
- Calendar compact exception:
  - Header navigation uses a deterministic two-row pattern at compact widths.
  - Row 1: previous + next.
  - Row 2: today button spans full width.

## 7) Shell Alignment Rules

Navbar, sidebar, breadcrumbs, and page content must align to a shared container recipe.

Mandatory rules:

- Breadcrumbs and page body use the same content max-width token.
- First page header/card aligns with breadcrumb content start.
- Sidebar + header chrome must avoid duplicated primary navigation at desktop sizes.

## 8) Gestalt and Proximity Rules

- Related controls should be grouped by short consistent gaps (`--space-2` to `--space-4`).
- Section separation should be visually clear but not excessive (`--space-4` to `--space-6` on dashboard pages).
- Dense data surfaces prioritize scanability over decorative whitespace.

## 9) Accessibility and RTL

- Maintain WCAG 2.1 AA focus visibility and keyboard navigation.
- Use logical properties (`inline`, `block`, `start`, `end`) for bidirectional layouts.
- RTL behavior must be validated at all dashboard breakpoints.

## 10) Validation Matrix

Every layout-affecting change must be checked at minimum:

- 390px
- 320px (zoom/reflow proxy)
- 768px
- 1024px
- 1280px
- 1440px
- 1920px
- 2400px (zoom-out/wide proxy)

Checks:

- Horizontal overflow
- Navbar/sidebar/content alignment
- Breadcrumb/page alignment
- Visual density and readability
- RTL parity
- Zoom/reflow behavior equivalence (no layout break at browser zoom changes)
- Action-group compact consistency on dashboard + onboarding routes at 320 and 390

## 11) Governance and Drift Control

Design-token/layout changes must include:

- Section reference to this document
- Before/after screenshot evidence at 390px and 1440px+
- Explicit note on mobile regression risk

If implementation behavior conflicts with this spec, update the spec first (or in the same PR) before broad refactors.
