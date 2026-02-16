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
 * 5. Blocker Validation: Uses DYNAMIC DETECTION to check actual codebase state
 * 6. Phase Gate Validation: Ensure recommendations are phase-appropriate
 *
 * NOTE: Blocker validation now uses dynamic codebase scanning via blocker-detection.ts
 * instead of relying on hardcoded configuration values.
 */

import { PHASES, BlockerStatus } from './authoritative-config';
import {
  detectAllBlockers,
  type FullDetectionReport,
  type BlockerDetectionResult,
} from './blocker-detection';

export type BlockerCheckResult = {
  canShip: boolean;
  blockers: Array<{
    id: string;
    name: string;
    status: BlockerStatus;
    effort: string;
    blocksAll: boolean;
    completionPercentage?: number;
  }>;
  currentPhase: string;
  requiredPhase: string;
  reason: string;
  detectionMethod: 'DYNAMIC' | 'STATIC';
};

export type EnforcementState = {
  docLoaded: boolean;
  loadTimestamp?: number;
  loadedTags: string[];
  toolsCalled: string[];
  authoritativeReferencesInOutput: number;
  strategicDocsLoaded: boolean;
  blockerCheckPerformed: boolean;
  lastDetectionReport?: FullDetectionReport;
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
 * NOW USES DYNAMIC DETECTION by scanning actual codebase
 *
 * This is the core decision-maker logic that prevents recommendations
 * like "ship booking-calendar" when auth is not implemented.
 */
export async function validateBlockersForShippingAsync(
  featureName: string,
  projectRoot?: string
): Promise<BlockerCheckResult> {
  const root = projectRoot || process.cwd();
  const detectionReport = await detectAllBlockers(root);

  const activeBlockers = detectionReport.blockers.filter(
    (b) => b.status !== 'COMPLETED' && b.blocksAll
  );

  if (activeBlockers.length > 0) {
    const blockerList = activeBlockers
      .map((b) => `${b.id}: ${b.name} (${b.effort}) - ${b.evidence.completionPercentage}% complete`)
      .join(', ');

    return {
      canShip: false,
      blockers: activeBlockers.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status as BlockerStatus,
        effort: b.effort,
        blocksAll: b.blocksAll,
        completionPercentage: b.evidence.completionPercentage,
      })),
      currentPhase: detectionReport.summary.currentPhase,
      requiredPhase: PHASES.PHASE_1_FOUNDATION.name,
      reason:
        `CANNOT SHIP ${featureName}: Critical blockers unresolved (detected dynamically): ${blockerList}. ` +
        `Must complete ${PHASES.PHASE_1_FOUNDATION.name} (${PHASES.PHASE_1_FOUNDATION.effort}) first.`,
      detectionMethod: 'DYNAMIC',
    };
  }

  return {
    canShip: true,
    blockers: [],
    currentPhase: detectionReport.summary.currentPhase,
    requiredPhase: PHASES.PHASE_2_FEATURES.name,
    reason: `${featureName} can proceed - all critical blockers resolved (verified by codebase scan).`,
    detectionMethod: 'DYNAMIC',
  };
}

/**
 * Synchronous version for backwards compatibility
 * @deprecated Use validateBlockersForShippingAsync instead for accurate dynamic detection
 */
export function validateBlockersForShipping(
  featureName: string
): BlockerCheckResult {
  // Return a placeholder that indicates dynamic detection should be used
  return {
    canShip: false,
    blockers: [],
    currentPhase: 'Unknown (use async version)',
    requiredPhase: PHASES.PHASE_1_FOUNDATION.name,
    reason:
      `DEPRECATED: Use validateBlockersForShippingAsync() for accurate dynamic detection. ` +
      `This synchronous version cannot scan the codebase.`,
    detectionMethod: 'STATIC',
  };
}

/**
 * PHASE GATE VALIDATION: Check if a recommendation is phase-appropriate
 * NOW USES DYNAMIC DETECTION
 */
export async function validatePhaseAppropriatenessAsync(
  recommendationType: 'ship' | 'implement' | 'plan',
  featureName: string,
  projectRoot?: string
): Promise<{ appropriate: boolean; reason: string; suggestedAction: string }> {
  const blockerResult = await validateBlockersForShippingAsync(featureName, projectRoot);

  // If trying to ship but blockers exist
  if (recommendationType === 'ship' && !blockerResult.canShip) {
    return {
      appropriate: false,
      reason: blockerResult.reason,
      suggestedAction:
        `Focus on ${PHASES.PHASE_1_FOUNDATION.name} items: ${PHASES.PHASE_1_FOUNDATION.items.join(', ')}. ` +
        `Estimated effort: ${PHASES.PHASE_1_FOUNDATION.effort}. ` +
        `After Phase 1 completes, ${featureName} can be shipped.`,
    };
  }

  // Implementation is okay if it's building toward Phase 2
  if (recommendationType === 'implement') {
    return {
      appropriate: true,
      reason: blockerResult.canShip
        ? `${featureName} implementation can proceed and ship when ready.`
        : `${featureName} implementation can proceed, but shipping requires Phase 1 completion.`,
      suggestedAction: blockerResult.canShip
        ? `Implement and ship ${featureName}.`
        : `Continue ${featureName} development. Parallel-track Phase 1 foundation work.`,
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
 * Synchronous version for backwards compatibility
 * @deprecated Use validatePhaseAppropriatenessAsync instead
 */
export function validatePhaseAppropriateness(
  recommendationType: 'ship' | 'implement' | 'plan',
  featureName: string
): { appropriate: boolean; reason: string; suggestedAction: string } {
  // For sync version, be conservative and suggest using async
  if (recommendationType === 'ship') {
    return {
      appropriate: false,
      reason: 'Use validatePhaseAppropriatenessAsync() for accurate dynamic detection.',
      suggestedAction: 'Call the async version to verify blocker status from codebase scan.',
    };
  }

  return {
    appropriate: true,
    reason: `${recommendationType} for ${featureName} is generally appropriate.`,
    suggestedAction: 'Use async validation for accurate phase assessment.',
  };
}

/**
 * DECISION-MAKER VALIDATION: Validate agent output for shipping recommendations
 * NOW USES DYNAMIC DETECTION
 */
export async function validateShippingRecommendationAsync(
  output: string,
  projectRoot?: string
): Promise<{
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestedCorrection: string | null;
  detectionReport: FullDetectionReport;
}> {
  const violations: string[] = [];
  const warnings: string[] = [];
  let suggestedCorrection: string | null = null;

  // Get dynamic detection report
  const root = projectRoot || process.cwd();
  const detectionReport = await detectAllBlockers(root);
  const activeBlockers = detectionReport.blockers.filter(
    (b) => b.status !== 'COMPLETED' && b.blocksAll
  );

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

  // Check 2: Are there active blockers?
  if (hasShippingRecommendation && activeBlockers.length > 0) {
    // Check if output mentions the blockers
    const mentionsBlockers = activeBlockers.some(
      (b) => output.includes(b.id) || output.includes(b.name)
    );

    if (!mentionsBlockers) {
      const blockerList = activeBlockers
        .map((b) => `${b.id}: ${b.name} (${b.evidence.completionPercentage}% complete)`)
        .join(', ');

      violations.push(
        `CRITICAL VIOLATION: Output recommends shipping without mentioning active blockers. ` +
          `Detected blockers (via codebase scan): ${blockerList}. ` +
          `Per DECISION_FRAMEWORK.md Constraint 1: All critical blockers must be resolved before shipping.`
      );

      suggestedCorrection =
        `Correct recommendation: "Feature is [X]% complete, but CANNOT ship until blockers resolved: ${blockerList}. ` +
        `Recommended next action: Complete remaining blocker requirements."`;
    }
  }

  // Check 3: If shipping is recommended and no blockers, validate it's appropriate
  if (hasShippingRecommendation && activeBlockers.length === 0) {
    // This is valid - all blockers resolved
    warnings.push(
      `INFO: Shipping recommendation validated. All ${detectionReport.summary.totalBlockers} blockers resolved. ` +
        `Current phase: ${detectionReport.summary.currentPhase}.`
    );
  }

  // Check 4: Does output reference decision framework docs?
  const decisionFrameworkPatterns = [
    /DECISION_FRAMEWORK\.md/i,
    /BLOCKERS\.md/i,
    /ROADMAP\.md/i,
    /strategic\s+tag/i,
    /Phase\s+Gate/i,
    /Phase\s+\d/i,
  ];

  const referencesDecisionFramework = decisionFrameworkPatterns.some(
    (pattern) => pattern.test(output)
  );

  if (!referencesDecisionFramework && hasShippingRecommendation) {
    warnings.push(
      'WARNING: Shipping recommendation does not cite DECISION_FRAMEWORK.md or BLOCKERS.md. ' +
        'Agent should explicitly reference authoritative decision-making docs.'
    );
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    suggestedCorrection,
    detectionReport,
  };
}

/**
 * Synchronous version for backwards compatibility
 * @deprecated Use validateShippingRecommendationAsync instead
 */
export function validateShippingRecommendation(output: string): {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestedCorrection: string | null;
} {
  return {
    valid: false,
    violations: ['Use validateShippingRecommendationAsync() for accurate dynamic detection.'],
    warnings: [],
    suggestedCorrection: null,
  };
}

/**
 * Verify that load_authoritative was called
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

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * RESPONSE GUARD: Reject outputs that violate authoritative doc constraints
 * NOW USES DYNAMIC DETECTION for blocker validation
 */
export async function validateAgentOutputAsync(
  output: string,
  state: EnforcementState,
  projectRoot?: string
): Promise<{ valid: boolean; sanitized: string; errors: string[]; warnings: string[] }> {
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

  // VALIDATION 3: DYNAMIC BLOCKER CHECK
  const shippingCheck = await validateShippingRecommendationAsync(output, projectRoot);
  if (!shippingCheck.valid) {
    errors.push(...shippingCheck.violations);
    if (shippingCheck.suggestedCorrection) {
      errors.push(`SUGGESTED CORRECTION: ${shippingCheck.suggestedCorrection}`);
    }
  }
  warnings.push(...shippingCheck.warnings);

  // Store detection report in state for future reference
  state.lastDetectionReport = shippingCheck.detectionReport;

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

  // VALIDATION 5: Check if strategic docs were loaded for shipping recommendations
  const hasShippingContext = /ship|production|deploy/i.test(output);
  if (hasShippingContext && !checkStrategicDocsLoaded(state)) {
    warnings.push(
      'WARNING: Output discusses shipping/production but strategic docs were not loaded. ' +
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
 * Synchronous version for backwards compatibility
 * @deprecated Use validateAgentOutputAsync instead
 */
export function validateAgentOutput(
  output: string,
  state: EnforcementState
): { valid: boolean; sanitized: string; errors: string[]; warnings: string[] } {
  // For sync version, only do non-blocker validations
  const errors: string[] = [];
  const warnings: string[] = [];

  const docCheck = verifyAuthoritativeDocsCalled(state, output);
  if (!docCheck.valid) {
    errors.push(docCheck.reason!);
  }

  const adrCheck = validateADR0001Compliance(output);
  if (!adrCheck.compliant) {
    errors.push(...adrCheck.violations);
  }

  warnings.push(
    'NOTE: Use validateAgentOutputAsync() for complete validation including dynamic blocker detection.'
  );

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
 */
export function canExecuteAnalysisTool(
  state: EnforcementState,
  toolName: string
): { allowed: boolean; reason?: string } {
  const analysisTools = [
    'scan_project_state',
    'analyze_feature_completeness',
    'analyze_test_coverage',
    'analyze_dependencies',
    'analyze_business_value',
    'analyze_technical_health',
    'recommend_features_ranked',
  ];

  if (!analysisTools.includes(toolName)) {
    return { allowed: true };
  }

  if (state.docLoaded && state.toolsCalled.includes('load_authoritative')) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `ENFORCEMENT: Tool '${toolName}' requires load_authoritative to be called first.`,
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
    return '✅ ENFORCEMENT PASSED: Agent properly used authoritative docs and dynamic blocker detection';
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
 * Generate a blocker status report using DYNAMIC DETECTION
 */
export async function generateBlockerStatusReportAsync(
  projectRoot?: string
): Promise<string> {
  const root = projectRoot || process.cwd();
  const report = await detectAllBlockers(root);

  const activeBlockers = report.blockers.filter(
    (b) => b.status !== 'COMPLETED' && b.blocksAll
  );

  if (activeBlockers.length === 0) {
    return (
      `✅ BLOCKER STATUS: All critical blockers resolved (verified by codebase scan).\n` +
      `   Completed: ${report.summary.completed}/${report.summary.totalBlockers}\n` +
      `   Current Phase: ${report.summary.currentPhase}\n` +
      `   Features can ship.`
    );
  }

  const lines = [
    '🚫 BLOCKER STATUS REPORT (Dynamic Detection):',
    '',
    `Current Phase: ${report.summary.currentPhase}`,
    `Completed: ${report.summary.completed}/${report.summary.totalBlockers}`,
    '',
    'The following critical blockers MUST be resolved before ANY feature ships:',
    '',
  ];

  activeBlockers.forEach((blocker, index) => {
    lines.push(`${index + 1}. ${blocker.id}: ${blocker.name}`);
    lines.push(`   Status: ${blocker.status} (${blocker.evidence.completionPercentage}% complete)`);
    lines.push(`   Effort: ${blocker.effort}`);
    lines.push(`   Files Found: ${blocker.evidence.filesFound.length}`);
    lines.push(`   Files Missing: ${blocker.evidence.filesMissing.length}`);
    if (blocker.evidence.filesMissing.length > 0) {
      lines.push(`   Missing: ${blocker.evidence.filesMissing.slice(0, 3).join(', ')}`);
    }
    lines.push('');
  });

  lines.push('REQUIRED ACTION:');
  lines.push(
    `Complete remaining Phase 1 items before shipping any feature.`
  );

  return lines.join('\n');
}

/**
 * Synchronous version for backwards compatibility
 * @deprecated Use generateBlockerStatusReportAsync instead
 */
export function generateBlockerStatusReport(): string {
  return (
    '⚠️ Use generateBlockerStatusReportAsync() for accurate dynamic detection.\n' +
    'This synchronous version cannot scan the codebase.'
  );
}
