export const AUTHORITATIVE_FAILURE_MESSAGE =
  'Authoritative docs not loaded. Call load_authoritative().';

export const BLOCKER_CHECK_FAILURE_MESSAGE =
  'BLOCKING: Cannot proceed without checking blockers. Load strategic tag first.';

/**
 * Core engineering tags for code analysis
 */
export const STAFF_ENGINEER_TAGS = [
  'state-store',
  'design',
  'testing',
  'booking-engine',
];

/**
 * Strategic decision-making tags (MUST be loaded for any shipping recommendation)
 */
export const STRATEGIC_TAGS = ['decision-framework', 'roadmap', 'blockers'];

/**
 * Combined tags for next-feature analysis
 * Includes both engineering analysis AND strategic decision-making
 */
export const NEXT_FEATURE_TAGS = [
  ...STAFF_ENGINEER_TAGS,
  'dtos',
  'strategic', // Loads all 3 decision-making docs at once
];

/**
 * Blocker IDs that must be resolved before shipping ANY feature
 * Maps to BLOCKERS.md critical path
 */
export const CRITICAL_BLOCKERS = {
  AUTH_SYSTEM: {
    id: 'BLOCKER-1',
    name: 'Authentication System',
    status: 'NOT_STARTED',
    effort: '20-30h',
    blocksAll: true,
  },
  USER_DATABASE: {
    id: 'BLOCKER-2',
    name: 'User Database Schema',
    status: 'NOT_STARTED',
    effort: '8-10h',
    blocksAll: true,
  },
  PERMISSIONS: {
    id: 'BLOCKER-3',
    name: 'Permission System',
    status: 'NOT_STARTED',
    effort: '6-8h',
    blocksAll: true,
  },
  AUDIT_LOGGING: {
    id: 'BLOCKER-4',
    name: 'Audit Logging',
    status: 'NOT_STARTED',
    effort: '4-6h',
    blocksAll: false,
  },
} as const;

/**
 * Phase definitions from ROADMAP.md
 */
export const PHASES = {
  PHASE_1_FOUNDATION: {
    name: 'Phase 1: Foundation',
    effort: '20-30h',
    mustCompleteFirst: true,
    items: ['Auth System', 'User DB', 'Permissions', 'Audit Logging'],
  },
  PHASE_2_FEATURES: {
    name: 'Phase 2: Features',
    effort: '12-16h',
    requiresPhase1: true,
    items: ['booking-calendar', 'booking-preview', 'booking-list'],
  },
  PHASE_3_ADVANCED: {
    name: 'Phase 3: Advanced',
    effort: '16-20h',
    requiresPhase2: true,
    items: ['Payments', 'Notifications', 'Analytics'],
  },
} as const;
