# Khana AI Agents

## Staff Engineer Agent

A production-grade AI agent that acts as a Principal Software Architect, ensuring code quality, preventing duplication, and enforcing architectural consistency.

### What It Does

- Analyzes your codebase to understand existing features
- Detects duplicate components to prevent redundant work
- Validates architectural compliance (docs/authoritative/engineering/architecture.md)
- Inspects patterns (SignalStore, Angular signals)
- Generates implementation prompts aligned with authoritative docs

### Why It Matters

Instead of asking "Should I create a new booking-form component?", the agent:

1. Reads the codebase and finds BookingPreviewComponent already exists
2. Validates it fits your needs
3. Recommends reusing it instead
4. Generates a prompt that enforces design system guidance and RTL/accessibility support

### Usage

#### Example 1: Build the Interactive Calendar Action Panel

```typescript
import { analyzeAndGeneratePrompt } from './src/agents/staff-engineer.agent';

const prompt = await analyzeAndGeneratePrompt(`
I need to build an interactive calendar action panel that allows:
- Confirming bookings
- Marking payments as paid
- Canceling bookings

It should integrate with BookingStore, follow the design system (docs/DESIGN_SYSTEM.md), and support RTL.
`);

console.log(prompt);
// Output: Detailed implementation prompt with all rules and reuse recommendations
```

#### Example 2: Add a New Feature Without Duplication

```typescript
const prompt = await analyzeAndGeneratePrompt(`
Add facility availability filter to the booking calendar view.
`);

// Agent will:
// 1. Find BookingStore.setFacilityFilter() already exists
// 2. Recommend enhancing the calendar UI instead of creating new store
// 3. Generate prompt for the UI enhancement
```

### What the Prompt Includes

Every generated prompt contains:

**Business Context**

- Why the feature matters

**Architecture Rules**

- Reuse existing components
- Follow docs/authoritative/engineering/architecture.md boundaries
- Angular standalone components with signals/computed state
- Data state and API calls live in BookingStore; UI state in components

**Design System Rules**

- Follow docs/authoritative/design/design-system.md (pointer to docs/DESIGN_SYSTEM.md)
- Use CSS logical properties for RTL
- Target WCAG 2.1 AA focus/keyboard navigation; add skip links when relevant

**Code Patterns**

- Angular signals: `signal<T>()`, `computed()`
- BookingStore pattern in apps/manager-dashboard/src/app/state/bookings/booking.store.ts
- Template-driven forms with `ngModel` for filters/inputs

**Testing**

- Jest is the unit test runner for manager-dashboard

**Validation Rules**

- npm run lint
- npm run test
- npm run build
- npm run check (lint + test + build)
- npx tsc --noEmit

**Before/After Checklist**

- Review authoritative docs before implementing
- Run quality gates after implementation

### How to Use This Prompt

1. **Copy the generated prompt**
2. **Use it as your implementation guide**
3. **Run quality gates after changes**

Example:

```bash
# Implement the feature (guided by the prompt)

# Validation
npm run check
npx tsc --noEmit
```

### Agent Tools

The agent has 6 specialized tools:

| Tool                             | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `load_authoritative`             | Load authoritative docs from docs/authoritative                 |
| `analyze_codebase`               | Scan features, stores, services                                 |
| `validate_architecture`          | Check docs/authoritative/engineering/architecture.md compliance |
| `detect_duplication`             | Find existing components to reuse                               |
| `inspect_patterns`               | Show Angular, store, service patterns                           |
| `generate_implementation_prompt` | Create detailed implementation instructions                     |

### Key Features

- Prevents duplication by scanning the codebase
- Enforces architecture boundaries and BookingStore usage
- Aligns prompts with authoritative design/RTL/accessibility guidance
- Uses gpt-5-nano (cost-efficient)

### Next Steps

1. **Run the agent** for your feature
2. **Copy the generated prompt**
3. **Implement changes using the prompt**
4. **Run quality gates before committing**

---

**Built with:** OpenAI Agents SDK + gpt-5-nano
**Pattern:** Multi-tool agent with codebase analysis
**Philosophy:** Staff Engineer > Rubber Duck
