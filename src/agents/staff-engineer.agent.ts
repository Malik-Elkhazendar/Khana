import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Staff Engineer Agent for Khana Project
 *
 * Analyzes codebase and generates implementation prompts that:
 * ✅ Prevent duplicate features
 * ✅ Enforce architectural consistency
 * ✅ Follow established patterns (SignalStore, Angular signals, NestJS)
 * ✅ Maintain design system compliance (Desert Night theme, RTL)
 * ✅ Detect existing components to reuse
 */

// ============ TOOLS ============

/**
 * Tool 1: Code Analyzer - Scans project structure
 */
const codeAnalyzer = tool({
  name: 'analyze_codebase',
  description:
    'Scan apps/manager-dashboard and libs to identify existing components, stores, and patterns',
  parameters: z.object({
    focus: z
      .enum(['components', 'stores', 'services', 'patterns'])
      .describe('What to analyze'),
  }),
  execute: async ({ focus }) => {
    const basePath = 'C:\\Users\\malek\\Desktop\\khana';
    const findings: Record<string, string[]> = {
      components: [],
      stores: [],
      services: [],
    };

    try {
      // Scan for components
      const componentDir = join(
        basePath,
        'apps/manager-dashboard/src/app/features'
      );
      const components = readdirSync(componentDir).filter((f) =>
        statSync(join(componentDir, f)).isDirectory()
      );
      findings.components = components;

      // Scan for stores
      const stateDir = join(
        basePath,
        'apps/manager-dashboard/src/app/state/bookings'
      );
      if (statSync(stateDir).isDirectory()) {
        const storeFiles = readdirSync(stateDir).filter((f) =>
          f.endsWith('.ts')
        );
        findings.stores = storeFiles;
      }

      return JSON.stringify({
        status: 'success',
        findings,
        analysis: `
Found Components:
${findings.components.map((c) => `- ${c}`).join('\n')}

Found Stores:
${findings.stores.map((s) => `- ${s}`).join('\n')}

Key Pattern: Uses @ngrx/signals (SignalStore) for state management.
        `,
      });
    } catch (error) {
      return JSON.stringify({ status: 'error', message: String(error) });
    }
  },
});

/**
 * Tool 2: Architecture Validator - Checks ARCHITECTURE.md compliance
 */
const architectureValidator = tool({
  name: 'validate_architecture',
  description:
    'Verify that a proposed feature follows ARCHITECTURE.md guidelines',
  parameters: z.object({
    featureName: z.string().describe('Name of the feature to validate'),
    proposedLocation: z
      .enum([
        'apps/manager-dashboard/src/app/features',
        'apps/manager-dashboard/src/app/state',
        'apps/api/src/app',
        'libs/booking-engine',
        'libs/shared-dtos',
      ])
      .describe('Where the feature would be placed'),
  }),
  execute: async ({ featureName, proposedLocation }) => {
    const architectureRules: Record<string, string> = {
      'apps/manager-dashboard/src/app/features':
        '✅ For Angular feature components (smart components)',
      'apps/manager-dashboard/src/app/state':
        '✅ For SignalStore state management',
      'apps/api/src/app': '✅ For NestJS controllers & services',
      'libs/booking-engine':
        '✅ For pure domain logic (no framework dependencies)',
      'libs/shared-dtos': '✅ For shared types, interfaces, enums',
    };

    const isValid = Object.keys(architectureRules).includes(proposedLocation);

    return JSON.stringify({
      isValid,
      featureName,
      proposedLocation,
      rule: architectureRules[proposedLocation] || '❌ Invalid location',
      analysis: isValid
        ? `✅ "${featureName}" correctly targets ${proposedLocation}`
        : `❌ "${featureName}" should NOT be in ${proposedLocation}. See ARCHITECTURE.md.`,
    });
  },
});

/**
 * Tool 3: Duplication Detector - Finds existing components to reuse
 */
const duplicationDetector = tool({
  name: 'detect_duplication',
  description:
    'Search for existing components that could be reused instead of creating new ones',
  parameters: z.object({
    searchTerm: z.string().describe('Component name or feature to search for'),
    scanPath: z
      .string()
      .default('apps/manager-dashboard/src/app')
      .describe('Path to scan'),
  }),
  execute: async ({ searchTerm }) => {
    const findings = {
      existing: {
        'booking-calendar': {
          path: 'apps/manager-dashboard/src/app/features/booking-calendar',
          purpose:
            'Weekly calendar view with hourly slots (O(1) booking lookups)',
          features: [
            'Week navigation',
            'Booking grid display',
            'Action panel with confirm/cancel',
            'Accessibility (focus trapping, keyboard nav)',
            'Toast notifications',
          ],
          reusable: true,
        },
        'booking-preview': {
          path: 'apps/manager-dashboard/src/app/features/booking-preview',
          purpose: 'Booking preview and creation form',
          features: [
            'Facility selection',
            'Date/time picker',
            'Preview availability',
            'Create booking flow',
          ],
          reusable: true,
        },
        BookingStore: {
          path: 'apps/manager-dashboard/src/app/state/bookings/booking.store.ts',
          purpose: 'SignalStore for booking state',
          features: [
            'Optimistic updates',
            'Error rollback',
            'Status management',
            'Facility filtering',
          ],
          reusable: true,
        },
      },
      recommendation: `
If searching for "${searchTerm}":
- 🔍 Check if "booking-calendar" or "booking-preview" can be extended
- 📦 Extend BookingStore instead of creating new stores
- ♻️ Reuse existing components before creating duplicates
      `,
    };

    return JSON.stringify(findings);
  },
});

/**
 * Tool 4: Pattern Inspector - Analyzes code patterns in the project
 */
const patternInspector = tool({
  name: 'inspect_patterns',
  description:
    'Review established patterns for Angular components, stores, and services',
  parameters: z.object({
    pattern: z
      .enum(['component', 'store', 'service'])
      .describe('Type of pattern to inspect'),
  }),
  execute: async ({ pattern }) => {
    const patterns: Record<string, string> = {
      component: `
✅ ANGULAR COMPONENT PATTERN:
- Use standalone: true
- Inject services with inject()
- Use signals for state: signal<Type>()
- Use computed for derived state: computed(() => ...)
- Implement ChangeDetectionStrategy.OnPush
- Event handling via methods (no console.log in prod)
- No hardcoded strings (use constants)
- Proper typing on all inputs/outputs
- Accessibility: semantic HTML, ARIA labels, keyboard nav
      `,
      store: `
✅ SIGNALSTORE PATTERN:
- Use signalStore() from @ngrx/signals
- withState() for initial state
- withMethods() for actions
- Use patchState() for updates
- Implement optimistic updates with rollback
- rxMethod() for async operations
- Use tap/switchMap/catchError from RxJS
- Error handling with proper rollback
- No direct HTTP calls (use injected ApiService)
      `,
      service: `
✅ NESTJS SERVICE PATTERN:
- @Injectable() decorator
- Inject repositories via constructor
- No business logic in controllers
- Use TypeORM repository pattern
- Proper error handling
- Return DTOs (not entities)
- Validate inputs (use class-validator)
      `,
    };

    return JSON.stringify({
      pattern,
      guide: patterns[pattern] || 'Unknown pattern',
      projectExample: 'See src/agents/staff-engineer.agent.ts for examples',
    });
  },
});

/**
 * Tool 5: Prompt Generator - Creates implementation instructions
 */
const promptGenerator = tool({
  name: 'generate_implementation_prompt',
  description:
    'Create a detailed implementation prompt with all rules and requirements',
  parameters: z.object({
    featureName: z.string().describe('Name of the feature'),
    businessContext: z.string().describe('Why this feature is needed'),
    technicalScope: z.string().describe('What code changes are required'),
    componentsToReuse: z
      .array(z.string())
      .describe('Existing components/stores to reuse'),
    rules: z
      .array(z.string())
      .optional()
      .describe('Additional rules to enforce'),
  }),
  execute: async ({
    featureName,
    businessContext,
    technicalScope,
    componentsToReuse,
    rules,
  }) => {
    const prompt = `
## Task: ${featureName}

### Business Context
${businessContext}

### Technical Scope
${technicalScope}

### Architecture Rules (MUST FOLLOW)
✅ Reuse existing components: ${componentsToReuse.join(', ')}
✅ Use @ngrx/signals for state (never RxJS subjects)
✅ Use standalone: true components
✅ Implement ChangeDetectionStrategy.OnPush
✅ No hardcoded values - extract to constants
✅ No console.log in production code
✅ All functions must have explicit TypeScript types
✅ Follow Nx workspace boundaries (import from @khana/*)
✅ Implement error handling with user feedback
✅ Add loading/error states for async operations

### Design System Rules
✅ Desert Night theme only (no custom colors)
✅ Use CSS Logical Properties for RTL support (inset-start, inset-end, etc.)
✅ Use TailwindCSS classes exclusively (no custom SCSS)
✅ Follow spacing scale (space-1, space-2, etc.)
✅ Implement accessibility: semantic HTML, ARIA labels, keyboard nav

### Validation Rules
✅ ESLint must pass: npm run lint
✅ Prettier must pass: npm run format
✅ TypeScript must compile: npx tsc --noEmit
✅ Tests must pass: npm run test (80%+ coverage for components)
✅ No module boundary violations

### Code Patterns
✅ Angular Signals: signal<T>(), computed(() => ...)
✅ SignalStore: withState(), withMethods()
✅ Service injection: private readonly X = inject(ServiceClass)
✅ Event handlers: private/public methodName(): ReturnType { }
✅ Store state access: this.store.signalName() (call as function)

### Testing Requirements
✅ Unit tests for all user interactions
✅ Component render tests
✅ Edge case coverage
✅ Integration with BookingStore

${
  rules ? `### Additional Rules\n${rules.map((r) => `✅ ${r}`).join('\n')}` : ''
}

### Before Implementing
1. Run \`npm run lint:fix && npm run format\`
2. Verify no module boundary violations
3. Check existing components in features/ directory
4. Review BookingStore patterns in state/bookings/
5. Ensure compliance with ARCHITECTURE.md

### After Implementing
1. \`npm run lint\` - Must pass
2. \`npm run format:check\` - Must pass
3. \`npm run test\` - 80%+ coverage
4. \`git add . && git commit\` - Pre-commit hooks validate
    `;

    return prompt;
  },
});

// ============ AGENT CONFIG ============

export const staffEngineerAgent = new Agent({
  name: 'Staff Engineer',
  model: 'gpt-5-nano',
  instructions: `You are a Principal Software Architect and Staff Engineer for the Khana project.

CRITICAL RULES:
1. **The Law of Context**: Always audit the codebase first before recommending features
2. **The Law of Consistency**: Follow existing patterns (SignalStore, signals, NestJS)
3. **The Law of DRY**: Never suggest duplicating a feature - find what exists first
4. **The Law of Architecture**: Enforce separation of concerns and Nx boundaries

YOUR WORKFLOW:
1. 🔎 Use analyze_codebase to understand current structure
2. 🔍 Use detect_duplication to find existing components
3. ✅ Use validate_architecture to ensure compliance
4. 📚 Use inspect_patterns to understand established patterns
5. 📝 Use generate_implementation_prompt to create final instructions

WHEN ANALYZING THE "INTERACTIVE CALENDAR":
- The calendar ALREADY EXISTS (booking-calendar.component.ts)
- Focus on ENHANCEMENTS (action panel, confirmation flows)
- Prevent suggesting duplicate "calendar" components
- Reuse BookingStore for state management
- Leverage existing accessibility patterns

YOUR OUTPUT:
A detailed implementation prompt that includes:
- ✅ What to reuse (existing components/stores)
- ✅ What patterns to follow (Angular, NestJS, SignalStore)
- ✅ What rules to enforce (no hardcoding, RTL, Desert Night theme)
- ✅ Testing requirements (80%+ coverage)
- ✅ Validation steps (lint, format, types)

TONE: Authoritative, solution-driven. You do not ask "what should I do?"; you analyze and direct.`,
  tools: [
    codeAnalyzer,
    architectureValidator,
    duplicationDetector,
    patternInspector,
    promptGenerator,
  ],
});

// ============ EXAMPLE USAGE ============

export async function analyzeAndGeneratePrompt(
  userRequest: string
): Promise<string> {
  const result = await run(staffEngineerAgent, userRequest, {
    maxTurns: 10,
  });
  return result.finalOutput;
}

/**
 * Example invocation:
 *
 * const prompt = await analyzeAndGeneratePrompt(
 *   "I want to build the interactive calendar action panel for confirming bookings, marking payments, and canceling. It should use BookingStore and follow our design system."
 * );
 *
 * console.log(prompt);
 */
