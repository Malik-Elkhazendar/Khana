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
 * Blocker status type
 */
export type BlockerStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

/**
 * Phase status type
 */
export type PhaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'READY' | 'BLOCKED';

/**
 * Phase definition type
 */
export type PhaseDefinition = {
  name: string;
  effort: string;
  mustCompleteFirst?: boolean;
  requiresPhase1?: boolean;
  requiresPhase2?: boolean;
  items: string[];
};

/**
 * Phase definitions from ROADMAP.md
 * NOTE: Phase status is determined DYNAMICALLY by blocker detection, not hardcoded here
 */
export const PHASES: Record<string, PhaseDefinition> = {
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
};

/**
 * @deprecated Use blocker-detection.ts for dynamic detection instead
 *
 * This static config is kept for backwards compatibility but should NOT be used
 * for determining actual blocker status. The agent should use detectAllBlockers()
 * from blocker-detection.ts to get real-time status from codebase scanning.
 *
 * IMPORTANT: Do NOT manually update these statuses. The detection system
 * will automatically determine status by scanning actual files.
 */
export const CRITICAL_BLOCKERS_LEGACY = {
  AUTH_SYSTEM: {
    id: 'BLOCKER-1',
    name: 'Authentication System',
    effort: '20-30h',
    blocksAll: true,
  },
  USER_DATABASE: {
    id: 'BLOCKER-2',
    name: 'User Database Schema',
    effort: '8-10h',
    blocksAll: true,
  },
  PERMISSIONS: {
    id: 'BLOCKER-3',
    name: 'Permission System',
    effort: '6-8h',
    blocksAll: true,
  },
  AUDIT_LOGGING: {
    id: 'BLOCKER-4',
    name: 'Audit Logging',
    effort: '4-6h',
    blocksAll: false,
  },
};

// Re-export for backwards compatibility (will be removed in future)
export const CRITICAL_BLOCKERS = CRITICAL_BLOCKERS_LEGACY;
