/**
 * Authoritative Enforcement Middleware
 *
 * Ensures that agent operations CANNOT proceed without first loading authoritative docs.
 * Implements hard constraints at the tool level to prevent bypassing documentation requirements.
 *
 * ENFORCEMENT LEVELS:
 * 1. Entry Point: Verify docs loaded before passing context to agent
 * 2. Tool Middleware: Track tool execution state, block tools until load_authoritative called
 * 3. Output Validation: Verify response actually used authoritative docs
 * 4. Response Guard: Reject responses that bypass docs or contradict ADRs
 * 5. Blocker Validation: Ensure shipping recommendations check BLOCKERS.md first
 * 6. Phase Gate Validation: Ensure recommendations are phase-appropriate
 */

import { CRITICAL_BLOCKERS, PHASES } from './authoritative-config';

export type BlockerStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED';

export type BlockerCheckResult = {
  canShip: boolean;
  blockers: Array<{
    id: string;
    name: string;
    status: BlockerStatus;
    effort: string;
    blocksAll: boolean;
  }>;
  currentPhase: string;
  requiredPhase: string;
  reason: string;
};

export type EnforcementState = {
  docLoaded: boolean;
  loadTimestamp?: number;
  loadedTags: string[];
  toolsCalled: string[];
  authoritativeReferencesInOutput: number;
  strategicDocsLoaded: boolean;
  blockerCheckPerformed: boolean;
};

/**
 * Create initial enforcement state
 */
export function createEnforcementState(): EnforcementState {
  return {
    docLoaded: false,
    loadedTags: [],
    toolsCalled: [],
    authoritativeReferencesInOutput: 0,
    strategicDocsLoaded: false,
    blockerCheckPerformed: false,
  };
}

/**
 * Check if strategic docs (decision-framework, roadmap, blockers) were loaded
 */
export function checkStrategicDocsLoaded(state: EnforcementState): boolean {
  const strategicTags = [
    'strategic',
    'decision-framework',
    'roadmap',
    'blockers',
  ];
  return strategicTags.some((tag) => state.loadedTags.includes(tag));
}

/**
 * BLOCKER VALIDATION: Check if any critical blockers prevent shipping
 *
 * This is the core decision-maker logic that prevents recommendations
 * like "ship booking-calendar" when auth is not implemented.
 */
export function validateBlockersForShipping(
  featureName: string
): BlockerCheckResult {
  const activeBlockers = Object.values(CRITICAL_BLOCKERS).filter(
    (blocker) => blocker.status === 'NOT_STARTED' && blocker.blocksAll
  );

  if (activeBlockers.length > 0) {
    const blockerList = activeBlockers
      .map((b) => `${b.id}: ${b.name} (${b.effort})`)
      .join(', ');

    return {
      canShip: false,
      blockers: activeBlockers.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status as BlockerStatus,
        effort: b.effort,
        blocksAll: b.blocksAll,
      })),
      currentPhase: 'Phase 0 (Pre-Foundation)',
      requiredPhase: PHASES.PHASE_1_FOUNDATION.name,
      reason:
        `CANNOT SHIP ${featureName}: Critical blockers unresolved: ${blockerList}. ` +
        `Must complete ${PHASES.PHASE_1_FOUNDATION.name} (${PHASES.PHASE_1_FOUNDATION.effort}) first.`,
    };
  }

  return {
    canShip: true,
    blockers: [],
    currentPhase: PHASES.PHASE_2_FEATURES.name,
    requiredPhase: PHASES.PHASE_2_FEATURES.name,
    reason: `${featureName} can proceed - all critical blockers resolved.`,
  };
}

/**
 * PHASE GATE VALIDATION: Check if a recommendation is phase-appropriate
 */
export function validatePhaseAppropriateness(
  recommendationType: 'ship' | 'implement' | 'plan',
  featureName: string
): { appropriate: boolean; reason: string; suggestedAction: string } {
  const blockerResult = validateBlockersForShipping(featureName);

  // If trying to ship but blockers exist
  if (recommendationType === 'ship' && !blockerResult.canShip) {
    return {
      appropriate: false,
      reason: blockerResult.reason,
      suggestedAction:
        `Focus on ${
          PHASES.PHASE_1_FOUNDATION.name
        } items: ${PHASES.PHASE_1_FOUNDATION.items.join(', ')}. ` +
        `Estimated effort: ${PHASES.PHASE_1_FOUNDATION.effort}. ` +
        `After Phase 1 completes, ${featureName} can be shipped.`,
    };
  }

  // Implementation is okay if it's building toward Phase 2
  if (recommendationType === 'implement') {
    return {
      appropriate: true,
      reason: `${featureName} implementation can proceed, but shipping requires Phase 1 completion.`,
      suggestedAction: `Continue ${featureName} development. Parallel-track Phase 1 foundation work.`,
    };
  }

  // Planning is always appropriate
  if (recommendationType === 'plan') {
    return {
      appropriate: true,
      reason: `Planning for ${featureName} is appropriate at any phase.`,
      suggestedAction: `Create implementation plan for ${featureName}.`,
    };
  }

  return {
    appropriate: true,
    reason: 'Action is phase-appropriate.',
    suggestedAction: 'Proceed with recommendation.',
  };
}

/**
 * DECISION-MAKER VALIDATION: Validate agent output for shipping recommendations
 *
 * This is the CRITICAL check that prevents the "ship without auth" mistake.
 */
export function validateShippingRecommendation(output: string): {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestedCorrection: string | null;
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  let suggestedCorrection: string | null = null;

  // Check 1: Does output recommend shipping?
  const shippingPatterns = [
    /ship\s+(booking-calendar|booking-preview|booking-list)/i,
    /ready\s+to\s+ship/i,
    /production[- ]ready/i,
    /deploy\s+to\s+production/i,
    /can\s+be\s+shipped/i,
    /recommend\s+shipping/i,
  ];

  const hasShippingRecommendation = shippingPatterns.some((pattern) =>
    pattern.test(output)
  );

  // Check 2: Does output mention auth blocker?
  const authBlockerPatterns = [
    /auth(entication)?\s+(system\s+)?not\s+(implemented|built|ready)/i,
    /BLOCKER[- ]?1/i,
    /no\s+auth(entication)?/i,
    /auth(entication)?\s+required\s+first/i,
    /Phase\s+1\s+(must\s+)?complete/i,
    /blocked\s+by\s+auth/i,
  ];

  const mentionsAuthBlocker = authBlockerPatterns.some((pattern) =>
    pattern.test(output)
  );

  // Check 3: Does output reference decision framework docs?
  const decisionFrameworkPatterns = [
    /DECISION_FRAMEWORK\.md/i,
    /BLOCKERS\.md/i,
    /ROADMAP\.md/i,
    /strategic\s+tag/i,
    /Phase\s+Gate/i,
    /Critical\s+Constraint/i,
  ];

  const referencesDecisionFramework = decisionFrameworkPatterns.some(
    (pattern) => pattern.test(output)
  );

  // VIOLATION: Shipping recommendation without mentioning auth blocker
  if (hasShippingRecommendation && !mentionsAuthBlocker) {
    violations.push(
      'CRITICAL VIOLATION: Output recommends shipping without mentioning auth blocker. ' +
        'Per DECISION_FRAMEWORK.md Constraint 1: "No Auth = No Production". ' +
        'Auth system (BLOCKER-1, 20-30h effort) must be implemented before ANY feature ships.'
    );
    suggestedCorrection =
      'Correct recommendation: "booking-calendar is feature-complete at 87/100 score, ' +
      'but CANNOT ship until Phase 1 Foundation completes. ' +
      'BLOCKER-1 (Auth System, 20-30h) blocks all production deployments. ' +
      'Recommended next action: Implement authentication system first."';
  }

  // WARNING: Shipping recommendation that mentions auth but doesn't reference framework
  if (
    hasShippingRecommendation &&
    mentionsAuthBlocker &&
    !referencesDecisionFramework
  ) {
    warnings.push(
      'WARNING: Output mentions auth blocker but does not cite DECISION_FRAMEWORK.md or BLOCKERS.md. ' +
        'Agent should explicitly reference authoritative decision-making docs.'
    );
  }

  // WARNING: No shipping recommendation but also no phase context
  if (!hasShippingRecommendation && !referencesDecisionFramework) {
    warnings.push(
      'WARNING: Output does not reference decision-making framework. ' +
        'For complete analysis, agent should load strategic tag and cite ROADMAP.md for phase context.'
    );
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    suggestedCorrection,
  };
}

/**
 * Verify that load_authoritative was called
 *
 * This is the POST-EXECUTION validation that ensures the agent actually
 * loaded docs (not just received them in context).
 */
export function verifyAuthoritativeDocsCalled(
  state: EnforcementState,
  output: string
): { valid: boolean; reason?: string } {
  // Check 1: Was load_authoritative tool called?
  if (!state.toolsCalled.includes('load_authoritative')) {
    return {
      valid: false,
      reason:
        'ENFORCEMENT VIOLATION: load_authoritative tool was not called. Agent must explicitly call load_authoritative(tags) before reasoning.',
    };
  }

  // Check 2: Are there references to authoritative docs in output?
  const docReferences = [
    'docs/authoritative',
    'ADR-0001',
    'ADR-0002',
    'ADR-0003',
    'ROUTER',
    'ROOT.md',
    'state ownership',
  ];

  const hasReferences = docReferences.some((ref) =>
    output.toLowerCase().includes(ref.toLowerCase())
  );

  if (!hasReferences) {
    return {
      valid: false,
      reason:
        'ENFORCEMENT VIOLATION: Output does not reference authoritative docs. Agent must cite docs/authoritative/ sources in reasoning.',
    };
  }

  return { valid: true };
}

/**
 * Validate agent response against ADR-0001 constraints
 *
 * HARD RULES from ADR-0001:
 * - Dialog state in components is CORRECT (do not flag as issue)
 * - Dialog state in Store is INCORRECT (is a violation)
 */
export function validateADR0001Compliance(output: string): {
  compliant: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // VIOLATION: Flagging dialog state in component as an issue
  if (
    output.includes('dialog') &&
    output.includes('component') &&
    (output.includes('should be in store') ||
      output.includes('should not be in component') ||
      output.includes('incorrect') ||
      output.includes('wrong'))
  ) {
    violations.push(
      'ADR-0001 VIOLATION: Response flags dialog state in component as incorrect. ' +
        'Per ADR-0001, components SHOULD own UI state (dialogs, selection, pagination). This is CORRECT architecture.'
    );
  }

  // VIOLATION: Dialog state in Store not flagged as issue
  if (
    output.includes('BookingStore') &&
    output.includes('dialog') &&
    !output.includes('should move to component') &&
    !output.includes('violates ADR-0001')
  ) {
    // This might be okay if dialog is data-driven, so don't hard-flag
    // But we should encourage review
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * RESPONSE GUARD: Reject outputs that violate authoritative doc constraints
 *
 * This is called AFTER the agent completes to ensure the output aligns
 * with authoritative rules before returning it to the user.
 *
 * INCLUDES: Blocker validation to prevent "ship without auth" mistakes.
 */
export function validateAgentOutput(
  output: string,
  state: EnforcementState
): { valid: boolean; sanitized: string; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // VALIDATION 1: Check if load_authoritative was called
  const docCheck = verifyAuthoritativeDocsCalled(state, output);
  if (!docCheck.valid) {
    errors.push(docCheck.reason!);
  }

  // VALIDATION 2: Check ADR-0001 compliance
  const adrCheck = validateADR0001Compliance(output);
  if (!adrCheck.compliant) {
    errors.push(...adrCheck.violations);
  }

  // VALIDATION 3: Check for hard prohibitions from agent instructions
  const prohibitions = [
    {
      pattern: /dialog.*state.*component.*wrong/i,
      message: 'Dialog state in component is CORRECT per ADR-0001',
    },
    {
      pattern: /assumed.*auth.*not implemented/i,
      message:
        'Auth status: not implemented (per docs/authoritative/security/auth.md)',
    },
    {
      pattern: /assumed.*payments.*working/i,
      message:
        'Payments status: FUTURE (per docs/authoritative/security/payments.md)',
    },
  ];

  for (const { pattern, message } of prohibitions) {
    if (pattern.test(output)) {
      errors.push(`HARD PROHIBITION: ${message}`);
    }
  }

  // VALIDATION 4: Ensure agent referenced authoritative context
  const hasAuthContext =
    output.includes('docs/authoritative') ||
    output.includes('ADR-0001') ||
    output.includes('ROUTER') ||
    output.includes('authoritative');

  if (!hasAuthContext) {
    warnings.push(
      'WARNING: Output does not visibly reference authoritative docs. Agent should cite sources.'
    );
  }

  // VALIDATION 5: BLOCKER CHECK - Prevent "ship without auth" mistake
  const shippingCheck = validateShippingRecommendation(output);
  if (!shippingCheck.valid) {
    errors.push(...shippingCheck.violations);
    if (shippingCheck.suggestedCorrection) {
      errors.push(`SUGGESTED CORRECTION: ${shippingCheck.suggestedCorrection}`);
    }
  }
  warnings.push(...shippingCheck.warnings);

  // VALIDATION 6: Check if strategic docs were loaded for shipping recommendations
  const hasShippingContext = /ship|production|deploy/i.test(output);
  if (hasShippingContext && !checkStrategicDocsLoaded(state)) {
    warnings.push(
      'WARNING: Output discusses shipping/production but strategic docs (DECISION_FRAMEWORK.md, BLOCKERS.md, ROADMAP.md) were not loaded. ' +
        'Add "strategic" to load_authoritative tags for shipping recommendations.'
    );
  }

  return {
    valid: errors.length === 0,
    sanitized: output,
    errors,
    warnings,
  };
}

/**
 * Track that load_authoritative tool was called
 */
export function markAuthoritativeLoaded(
  state: EnforcementState,
  tags: string[]
): void {
  state.docLoaded = true;
  state.loadTimestamp = Date.now();
  state.loadedTags = tags;
}

/**
 * Track that a tool was called
 */
export function trackToolCall(state: EnforcementState, toolName: string): void {
  if (!state.toolsCalled.includes(toolName)) {
    state.toolsCalled.push(toolName);
  }
}

/**
 * Can other tools execute given the current state?
 *
 * This enforces: load_authoritative MUST be called before other analysis tools.
 */
export function canExecuteAnalysisTool(
  state: EnforcementState,
  toolName: string
): { allowed: boolean; reason?: string } {
  // List of tools that require authoritative docs to be loaded first
  const analysisTools = [
    'scan_project_state',
    'analyze_feature_completeness',
    'analyze_test_coverage',
    'analyze_dependencies',
    'analyze_business_value',
    'analyze_technical_health',
    'recommend_features_ranked',
  ];

  // If this is not an analysis tool, allow it
  if (!analysisTools.includes(toolName)) {
    return { allowed: true };
  }

  // If docs are loaded and load_authoritative was called, allow it
  if (state.docLoaded && state.toolsCalled.includes('load_authoritative')) {
    return { allowed: true };
  }

  // Otherwise, block it
  return {
    allowed: false,
    reason: `ENFORCEMENT: Tool '${toolName}' requires load_authoritative to be called first. Call load_authoritative(tags=['state-store', 'design', 'testing', 'booking-engine', 'dtos']) before proceeding.`,
  };
}

/**
 * Generate a summary of enforcement violations and warnings
 */
export function generateEnforcementReport(
  errors: string[],
  warnings: string[] = []
): string {
  const parts: string[] = [];

  if (errors.length === 0 && warnings.length === 0) {
    return '✅ ENFORCEMENT PASSED: Agent properly used authoritative docs and decision framework';
  }

  if (errors.length > 0) {
    const header = '❌ ENFORCEMENT VIOLATIONS DETECTED:\n';
    const items = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
    parts.push(`${header}\n${items}`);
  }

  if (warnings.length > 0) {
    const header = '\n⚠️ ENFORCEMENT WARNINGS:\n';
    const items = warnings.map((w, i) => `${i + 1}. ${w}`).join('\n');
    parts.push(`${header}\n${items}`);
  }

  return parts.join('\n');
}

/**
 * Generate a blocker status report for inclusion in agent output
 */
export function generateBlockerStatusReport(): string {
  const blockers = Object.values(CRITICAL_BLOCKERS);
  const activeBlockers = blockers.filter(
    (b) => b.status === 'NOT_STARTED' && b.blocksAll
  );

  if (activeBlockers.length === 0) {
    return `✅ BLOCKER STATUS: All critical blockers resolved. Features can ship.`;
  }

  const lines = [
    '🚫 BLOCKER STATUS REPORT:',
    '',
    'The following critical blockers MUST be resolved before ANY feature ships:',
    '',
  ];

  activeBlockers.forEach((blocker, index) => {
    lines.push(`${index + 1}. ${blocker.id}: ${blocker.name}`);
    lines.push(`   Status: ${blocker.status}`);
    lines.push(`   Effort: ${blocker.effort}`);
    lines.push(`   Blocks All: ${blocker.blocksAll ? 'YES' : 'No'}`);
    lines.push('');
  });

  lines.push('REQUIRED ACTION:');
  lines.push(
    `Complete ${PHASES.PHASE_1_FOUNDATION.name} (${PHASES.PHASE_1_FOUNDATION.effort}) before shipping any feature.`
  );
  lines.push('');
  lines.push('Phase 1 Items:');
  PHASES.PHASE_1_FOUNDATION.items.forEach((item, index) => {
    lines.push(`  ${index + 1}. ${item}`);
  });

  return lines.join('\n');
}
