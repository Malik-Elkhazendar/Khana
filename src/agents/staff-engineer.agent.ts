import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  authoritativeLoader,
  buildAuthoritativeContext,
  loadAuthoritativeDocs,
} from './authoritative-loader';
import {
  AUTHORITATIVE_FAILURE_MESSAGE,
  STAFF_ENGINEER_TAGS,
} from './authoritative-config';

/**
 * Staff Engineer Agent for Khana Project
 *
 * Analyzes codebase and generates implementation prompts that:
 * ✅ Prevent duplicate features
 * ✅ Enforce architectural consistency
 * ✅ Follow established patterns (SignalStore, Angular signals, NestJS)
 * ✅ Maintain design system compliance (RTL, accessibility)
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
        focus,
        findings,
        analysis: `
Requested Focus: ${focus}
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
 * Tool 2: Architecture Validator - Checks docs/authoritative/engineering/architecture.md compliance
 */
const architectureValidator = tool({
  name: 'validate_architecture',
  description:
    'Verify that a proposed feature follows docs/authoritative/engineering/architecture.md guidelines',
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
        : `❌ "${featureName}" should NOT be in ${proposedLocation}. See docs/authoritative/engineering/architecture.md.`,
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
          purpose: 'Booking calendar feature (inspect for capabilities)',
          reusable: true,
        },
        'booking-preview': {
          path: 'apps/manager-dashboard/src/app/features/booking-preview',
          purpose: 'Booking preview feature (inspect for capabilities)',
          reusable: true,
        },
        BookingStore: {
          path: 'apps/manager-dashboard/src/app/state/bookings/booking.store.ts',
          purpose: 'SignalStore for booking state (data/API state)',
          reusable: true,
        },
      },
      recommendation: `
If searching for "${searchTerm}":
- Check if "booking-calendar" or "booking-preview" can be extended
- Extend BookingStore instead of creating new stores
- Reuse existing components before creating duplicates
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
ANGULAR COMPONENT PATTERN:
- Standalone components
- Inject services with inject()
- Use signals for state and computed for derived state
- UI state lives in components; data state lives in BookingStore
- Template-driven forms with ngModel for filters/inputs when applicable
- For timers, follow takeUntilDestroyed pattern (HoldTimerComponent)
- Accessibility: focus rings and keyboard navigation; add skip links when relevant
      `,
      store: `
SIGNALSTORE PATTERN:
- Follow BookingStore pattern in apps/manager-dashboard/src/app/state/bookings/booking.store.ts
- Data state and API calls live in BookingStore
- UI state lives in components
      `,
      service: `
NESTJS SERVICE PATTERN:
- Refer to docs/authoritative/engineering/backend-nest.md (load backend tag) for service patterns
- Follow architecture boundaries in docs/authoritative/engineering/architecture.md
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
? Reuse existing components: ${componentsToReuse.join(', ')}
? Follow boundaries in docs/authoritative/engineering/architecture.md
? Use Angular standalone components with signals/computed state
? Data state and API calls live in BookingStore; UI state lives in components
? Use template-driven forms with ngModel for filters/inputs when applicable
? Timer subscriptions use takeUntilDestroyed

### Design System Rules
? Follow docs/authoritative/design/design-system.md (pointer to docs/DESIGN_SYSTEM.md)
? Use CSS logical properties for RTL support
? Target WCAG 2.1 AA focus and keyboard navigation; add skip links when relevant

### Validation Rules
? npm run lint
? npm run test
? npm run build
? npm run check (lint + test + build)
? npx tsc --noEmit

### Code Patterns
? Angular signals: signal<T>(), computed(() => ...)
? BookingStore pattern in apps/manager-dashboard/src/app/state/bookings/booking.store.ts
? UI state stays in components; data state stays in BookingStore
? Timer cleanup uses takeUntilDestroyed

### Testing Requirements
? Jest is the unit test runner for manager-dashboard

${
  rules ? `### Additional Rules\n${rules.map((r) => `✅ ${r}`).join('\n')}` : ''
}

### Before Implementing
1. Review docs/authoritative/engineering/architecture.md and docs/authoritative/decisions/ADR-0001-state-ownership.md
2. Review docs/authoritative/design/design-system.md, docs/authoritative/design/rtl.md, docs/authoritative/design/accessibility.md
3. Review docs/authoritative/engineering/frontend-angular.md and docs/authoritative/engineering/quality-gates.md

### After Implementing
1. \`npm run lint\`
2. \`npm run test\`
3. \`npm run build\`
4. \`npx tsc --noEmit\`
    `;

    return prompt;
  },
});

// ============ AGENT CONFIG ============

export const staffEngineerAgent = new Agent({
  name: 'Staff Engineer',
  model: 'gpt-5-nano',
  instructions: `You are a Principal Software Architect and Staff Engineer for the Khana project.

SOURCE OF TRUTH RULES (MANDATORY):
- The ONLY source of truth is docs/authoritative/.
- You MUST call load_authoritative(tags) before reasoning or responding.
- Always load docs/authoritative/ROOT.md and docs/authoritative/ROUTER.md.
- Use ROUTER tags to load the minimal additional files.
- If authoritative docs are not loaded, respond ONLY with: "Authoritative docs not loaded. Call load_authoritative()."

CONFLICT RULES:
- Code evidence overrides docs when a mismatch exists.
- Record any mismatch as STALE_DOC in docs/authoritative/UNKNOWN.md.
- If not provable by loaded docs or code evidence, label UNKNOWN or PROPOSED.

HARD PROHIBITIONS:
- Do not assume auth, payments, environment config, or providers unless explicitly confirmed.
- Do not invent APIs, configs, or behaviors.
- Do not use web knowledge unless a web-search tool is explicitly available and used.

CRITICAL RULES:
1. **The Law of Context**: Always audit the codebase first before recommending features
2. **The Law of Consistency**: Follow existing patterns (SignalStore, signals, NestJS)
3. **The Law of DRY**: Never suggest duplicating a feature - find what exists first
4. **The Law of Architecture**: Enforce boundaries defined in docs/authoritative/engineering/architecture.md

PROCESS:
1. Call load_authoritative(tags).
2. Reason only from loaded docs and code evidence.
3. Answer concisely, citing file paths when relevant.

YOUR WORKFLOW:
0. Use load_authoritative to load ROOT, ROUTER, and minimal tagged docs
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
- ✅ What rules to enforce (architecture, state ownership, design, RTL, accessibility)
- ✅ Testing requirements (quality gates and Jest runner)
- ✅ Validation steps (lint, format, types)

TONE: Authoritative, solution-driven. You do not ask "what should I do?"; you analyze and direct.`,
  tools: [
    authoritativeLoader,
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
  // ENFORCEMENT LEVEL 1: Entry point ensures docs are loaded
  const loaded = await loadAuthoritativeDocs(STAFF_ENGINEER_TAGS);
  if (loaded.status !== 'success') {
    return AUTHORITATIVE_FAILURE_MESSAGE;
  }

  const context = buildAuthoritativeContext(loaded);
  const enforcePrompt = `${context}

AUTHORITATIVE ENFORCEMENT REMINDER:
- You MUST explicitly call load_authoritative(tags) before any other tool.
- This is not optional - it is a HARD REQUIREMENT for this analysis.
- Agent will fail validation if load_authoritative is not called.
- After calling load_authoritative, proceed with the user request analysis.

User request:
${userRequest}`;

  const result = await run(staffEngineerAgent, enforcePrompt, {
    maxTurns: 10,
  });

  const output = result.finalOutput ?? AUTHORITATIVE_FAILURE_MESSAGE;

  // ENFORCEMENT LEVEL 2: Post-execution validation
  // Check that output actually references authoritative docs
  const hasAuthReference =
    output.includes('docs/authoritative') ||
    output.includes('ADR-0001') ||
    output.includes('ROUTER') ||
    output.includes('authoritative');

  if (!hasAuthReference) {
    console.warn(
      '\n⚠️  ENFORCEMENT WARNING: Agent output does not reference authoritative docs.\n' +
        'Output should cite docs/authoritative/ sources and ADRs.\n'
    );
  }

  // ENFORCEMENT LEVEL 3: Validate against ADR-0001
  const hasDialogViolation =
    output.includes('dialog') &&
    output.includes('component') &&
    (output.includes('should be in store') || output.includes('incorrect'));

  if (hasDialogViolation) {
    console.error(
      '\n❌ ENFORCEMENT VIOLATION: Output contradicts ADR-0001.\n' +
        'Dialog state in components is CORRECT per ADR-0001.\n' +
        'ADR-0001 states: "Components own UI state (dialogs, selection, pagination)"\n'
    );
    // Still return output but with warning
  }

  return output;
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
