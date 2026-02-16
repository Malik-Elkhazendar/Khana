import { Agent, run, tool, webSearchTool } from '@openai/agents';
import { z } from 'zod';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, sep } from 'path';
import { execSync } from 'child_process';
import {
  authoritativeLoader,
  buildAuthoritativeContext,
  loadAuthoritativeDocs,
} from './authoritative-loader';
import {
  AUTHORITATIVE_FAILURE_MESSAGE,
  NEXT_FEATURE_TAGS,
  PHASES,
} from './authoritative-config';
import {
  validatePhaseAppropriateness,
} from './authoritative-enforcement';
import {
  detectAllBlockers,
  updateBlockersMdFile,
  type FullDetectionReport,
} from './blocker-detection';

type CalendarSignals = {
  holdTimer: boolean;
  confirmationDialog: boolean;
  cancellationForm: boolean;
};

type CalendarActions = {
  confirm: boolean;
  cancel: boolean;
  markPaid: boolean;
};

type ComponentFile = {
  path: string;
  htmlPath: string;
  scssPath: string;
  specPath: string;
  hasHtml: boolean;
  hasScss: boolean;
  hasSpec: boolean;
  // SCALABLE: Added content properties for pattern matching
  tsContent: string;
  htmlContent: string;
  scssContent: string;
};

type FeatureScan = {
  name: string;
  path: string;
  componentFiles: ComponentFile[];
  htmlFiles: string[];
  tsFiles: string[];
  specFiles: string[];
  mdFiles: string[];
  mainComponent?: ComponentFile;
};

type ESLintThresholds = {
  complexity?: number;
  maxLines?: number;
  maxLinesPerFunction?: number;
  maxStatements?: number;
  maxDepth?: number;
  maxParams?: number;
};

type DependencyScan = {
  unused: string[];
  missing: string[];
  totalDependencies: number;
  totalUsed: number;
};

type SecurityFinding = {
  pattern: string;
  count: number;
  locations: Array<{ path: string; line: number; excerpt: string }>;
};

/**
 * Risk domains for automatic detection of high-risk code patterns.
 * Used to flag features that need extra scrutiny (payments, timers, etc.)
 */
type RiskDomain =
  | 'payments'
  | 'cancellation'
  | 'timers'
  | 'async-flows'
  | 'authentication'
  | 'data-mutation'
  | 'external-api'
  | 'user-data';

/**
 * Dynamically discovered feature with all metadata.
 * Auto-populated by scanning the features directory.
 */
type DiscoveredFeature = {
  name: string;
  rootPath: string;
  files: string[];
  components: ComponentFile[];
  tests: string[];
  stores: string[];
  services: string[];
  riskDomains: RiskDomain[];
};

/**
 * Enhanced Evidence Pack V2 with per-feature metrics.
 * STRATEGY A: QUICK_WIN - All data is per-feature for granular analysis.
 */
type EvidencePackV2 = {
  // Per-feature evidence
  todosByFeature: Map<
    string,
    Array<{ path: string; line: number; text: string }>
  >;
  clickHandlersByFeature: Map<string, number>;
  testFilesByFeature: Map<string, string[]>;
  storeUsageByFeature: Map<string, string[]>;
  riskFlagsByFeature: Map<string, RiskDomain[]>;
  // Global signals
  recentGitChanges: Array<{
    hash: string;
    message: string;
    files: string[];
    features: string[];
  }>;
  gitDataAvailable: boolean;
  // Discovered features
  discoveredFeatures: DiscoveredFeature[];
};

type ProjectScan = {
  basePath: string;
  paths: {
    featuresDir: string;
    sharedComponentsDir: string;
    bookingCalendarDir: string;
    bookingListDir: string;
    bookingPreviewDir: string;
    bookingCalendarHtml: string;
    bookingCalendarTs: string;
    bookingListTs: string;
    bookingPreviewTs: string;
    bookingStore: string;
    designSystemDoc: string;
    designRtlDoc: string;
    designAccessibilityDoc: string;
    architectureDoc: string;
    appRoutes: string;
    holdTimerComponent: string;
    confirmationDialogComponent: string;
    cancellationFormComponent: string;
    eslintConfig: string;
    packageJson: string;
  };
  features: string[];
  sharedComponents: string[];
  calendarComponents: string[];
  componentFiles: ComponentFile[];
  structuralGaps: string[];
  testGaps: string[];
  dependencyScan: DependencyScan;
  securityFindings: SecurityFinding[];
  eslintThresholds: ESLintThresholds;
  qualitySummary: {
    complexityScore?: number;
    maxLinesScore?: number;
    overallScore?: number;
    complexityViolations: Array<{
      path: string;
      complexity: number;
      threshold: number;
    }>;
    maxLinesViolations: Array<{
      path: string;
      lines: number;
      threshold: number;
    }>;
  };
  testSignals: {
    bookingCalendar: { path: string; exists: boolean };
    bookingList: { path: string; exists: boolean };
    bookingPreview: { path: string; exists: boolean };
    holdTimer: { path: string; exists: boolean };
    confirmationDialog: { path: string; exists: boolean };
    cancellationForm: { path: string; exists: boolean };
  };
  qualitySignals: {
    bookingCalendarTsLines: number;
    bookingCalendarHtmlLines: number;
    bookingCalendarTodos: number;
    bookingCalendarConsoleLogs: number;
  };
  docs: {
    designSystem: boolean;
    designRtl: boolean;
    designAccessibility: boolean;
    architecture: boolean;
  };
  routing: {
    appRoutesPath: string;
    appRoutesExists: boolean;
    appRoutesText: string;
  };
  calendar: {
    htmlExists: boolean;
    tsExists: boolean;
    selectors: CalendarSignals;
    imports: CalendarSignals;
    actions: CalendarActions;
    hasHoldUntil: boolean;
    hasDialogState: boolean;
  };
  components: CalendarSignals;
  store: {
    exists: boolean;
    usesSignals: boolean;
    hasCancellationReason: boolean;
    hasDialogState: boolean;
  };
  architectureMentionsDialogState: boolean;
  featureScans: FeatureScan[];
  featureIndex: Record<string, FeatureScan>;
  // SCALABLE: Dynamic feature discovery properties
  discoveredFeatures: DiscoveredFeature[];
  featurePaths: Record<
    string,
    { dir: string; mainTs: string; mainHtml: string }
  >;
  featureTestSignals: Record<
    string,
    { path: string; exists: boolean; testCount: number }
  >;
};

// Confidence levels for scoring transparency
type ConfidenceLevel =
  | 'MEASURED'
  | 'ESTIMATED'
  | 'HEURISTIC'
  | 'PATTERN-BASED'
  | 'UNAVAILABLE';

type ScoreDetail = {
  score: number;
  details: string[];
  confidence?: ConfidenceLevel;
  source?: string; // e.g., "File system scan", "Regex pattern matching", "Hardcoded default"
};

type FeatureCompletenessScore = {
  feature: string;
  implementation: ScoreDetail;
  testCoverage: ScoreDetail;
  accessibility: ScoreDetail;
  codeQuality: ScoreDetail;
  total: number;
  interpretation: string;
  notes: string[];
};

type TestCoverageReport = {
  feature: string;
  componentCount: number;
  specCount: number;
  ratio: number;
  score: number;
};

type DependencyAnalysis = {
  dependencies: Record<string, string[]>;
  missingDependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  blocking: string[];
  blocked: string[];
  chains: string[];
  notes: string[];
};

type BusinessValueScore = {
  feature: string;
  userValue: number;
  businessImpact: number;
  strategicImportance: number;
  customerRequests: number;
  marketDifferentiation: number;
  total: number;
  notes: string[];
  confidence?: ConfidenceLevel;
  source?: string; // e.g., "Business config files", "Derived from request/revenue data"
};

type BusinessConfig = {
  roadmap?: string;
  customerRequests?: string;
  revenueImpact?: string;
};

// Feature-level dependency types (for internal dependency mapping)
type FeatureDependency = {
  importPath: string; // e.g., '../../state/bookings/booking.store'
  resolvedName: string; // e.g., 'BookingStore'
  type:
    | 'store'
    | 'component'
    | 'service'
    | 'dto'
    | 'util'
    | 'angular'
    | 'external';
  isLocal: boolean; // same feature folder
};

// ============================================================================
// PHASE 1 COMPLETION ANALYSIS TYPES
// ============================================================================

type Phase1Feature = 'booking-calendar' | 'booking-list' | 'booking-preview';

type CompletionCheckpoint = {
  name: string;
  met: boolean;
  evidence: string;
  blockerLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
};

type FeatureCompletionAnalysis = {
  feature: Phase1Feature;
  completionPercentage: number;
  checkpoints: CompletionCheckpoint[];
  blockers: string[];
  missingElements: string[];
  qualityGates: {
    implementation: boolean;
    testing: boolean;
    accessibility: boolean;
    codeQuality: boolean;
    documentation: boolean;
  };
};

type Phase1CompletionReport = {
  overallComplete: boolean;
  averageCompletion: number;
  features: Record<Phase1Feature, FeatureCompletionAnalysis>;
  blockingIssues: string[];
  recommendedActions: string[];
};

// ============================================================================
// MARKET TIMING ANALYSIS TYPES
// ============================================================================

type MarketTimingAnalysis = {
  feature: string;
  status: 'UNKNOWN';
  notes: string[];
};

// ============================================================================

// ============================================================================
// UI/UX ARCHITECTURE ANALYSIS TYPES
// ============================================================================

type NavigationPattern = {
  currentPattern: 'horizontal-menu' | 'sidebar' | 'tabs' | 'none';
  featurePaths: string[];
  userFlowComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  navigationDepth: number;
  accessibility: {
    keyboardNavigable: boolean;
    screenReaderSupport: boolean;
    focusManagement: boolean;
  };
};

type LayoutAssessment = {
  currentLayout: {
    structure: string;
    components: string[];
    hasResponsiveDesign: boolean;
    supportsMobile: boolean;
  };
  sidebarNecessity: {
    required: boolean;
    reasoning: string[];
    alternativeApproaches: string[];
  };
  scalability: {
    canAccommodateNewFeatures: boolean;
    maxFeaturesWithoutRefactor: number;
    refactoringRequired: boolean;
  };
};

type DesignSystemReadiness = {
  rtlSupport: {
    implemented: boolean;
    logicalPropertiesUsed: boolean;
    dirAttributeDetected: boolean;
    issues: string[];
  };
  componentConsistency: {
    score: number;
    deviations: string[];
    missingComponents: string[];
  };
  accessibility: {
    wcagCompliance: 'AA' | 'UNKNOWN';
    focusStylesDetected: boolean;
    keyboardNavigationDetected: boolean;
    skipLinkDetected: boolean;
  };
};

type FutureDesignAlignment = {
  clientSideVision: {
    targetUserFlow: string;
    plannedFeatures: string[];
    designEvolution: string[];
  };
  serverSideVision: {
    apiEndpoints: string[];
    dataModels: string[];
    businessLogicAlignment: string[];
  };
  alignmentScore: number;
  gaps: string[];
  recommendations: string[];
};

type UIUXArchitectureAnalysis = {
  navigation: NavigationPattern;
  layout: LayoutAssessment;
  designSystem: DesignSystemReadiness;
  futureAlignment: FutureDesignAlignment;
  decision: {
    buildSidebarFirst: boolean;
    refactorLayoutFirst: boolean;
    proceedWithCurrentUI: boolean;
    reasoning: string[];
    estimatedEffort: {
      sidebarImplementation?: number;
      layoutRefactor?: number;
      designSystemUpdates?: number;
    };
  };
};

// ============================================================================
// DECISION MATRIX TYPES
// ============================================================================

type DecisionFactor = {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  evidence: string[];
  confidence: ConfidenceLevel;
};

type DecisionCandidate = {
  feature: string;
  totalScore: number;
  factors: {
    business: DecisionFactor;
    technical: DecisionFactor;
    market: DecisionFactor;
    dependency: DecisionFactor;
    uiux?: DecisionFactor;
  };
  whyNotOthers?: string[];
};

type DecisionMatrix = {
  candidates: DecisionCandidate[];
  winner: DecisionCandidate;
  runnerUps: DecisionCandidate[];
  decisionRationale: string[];
};

// ============================================================================
// ENHANCED IMPLEMENTATION PLAN TYPES
// ============================================================================

type TaskDependency = {
  taskId: string;
  reason: string;
};

type ImplementationTask = {
  id: string;
  category:
    | 'PREREQUISITE'
    | 'CORE'
    | 'TESTING'
    | 'DESIGN_SYSTEM'
    | 'UI_REFACTOR';
  description: string;
  filePath: string;
  lineNumber?: number;
  operation: 'CREATE' | 'MODIFY' | 'DELETE';
  estimatedHours: number;
  dependencies: TaskDependency[];
  acceptanceCriteria: string[];
};

type ImplementationPlan = {
  feature: string;
  totalEffort: {
    prerequisites: number;
    core: number;
    testing: number;
    designSystem: number;
    uiRefactor: number;
    total: number;
  };
  tasks: ImplementationTask[];
  criticalPath: string[];
  acceptanceCriteria: string[];
  successMetrics: SuccessMetric[];
  blockersAndRisks: BlockerRisk[];
};

type SuccessMetric = {
  name: string;
  target: string;
  measurement: string;
  type: 'TECHNICAL' | 'BUSINESS' | 'USER' | 'DESIGN';
};

type BlockerRisk = {
  description: string;
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  mitigation: string;
  isShared: boolean; // shared components
  isExternal: boolean; // @khana/* libs
};

type CategorizedDependencies = {
  stores: string[];
  components: string[];
  services: string[];
  dtos: string[];
  utils: string[];
  angular: string[];
  external: string[];
};

type FeatureDependencyReport = {
  feature: string;
  dependencies: FeatureDependency[];
  categorized: CategorizedDependencies;
  totalCount: number;
};

// Validation results from running actual tools (ESLint, TypeScript)
type ValidationResults = {
  eslint: {
    passed: boolean;
    errorCount: number;
    warningCount: number;
    details: string[];
  };
  typescript: {
    passed: boolean;
    errorCount: number;
    details: string[];
  };
  overall: {
    passed: boolean;
    score: number; // 0-25
    confidence: ConfidenceLevel;
  };
};

type BusinessPriorityOverrides = {
  priority?: number;
  userValue?: number;
  businessImpact?: number;
  strategicImportance?: number;
  customerRequests?: number;
  marketDifferentiation?: number;
};

type TechnicalDebtItem = {
  issue: string;
  risk: number;
  blocking: number;
  remediationHours: number;
  value: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
};

type TechnicalHealthReport = {
  integrationGaps: string[];
  structuralGaps: string[];
  architectureNotes: string[];
  testGaps: string[];
  qualityNotes: string[];
  dependencyIssues: string[];
  securityNotes: string[];
  debtItems: TechnicalDebtItem[];
};

type RecommendationEntry = {
  feature: string;
  score: number;
  completenessScore: number;
  userImpact: number;
  businessValue: number;
  strategicAlignment: number;
  technicalBlocking: number;
  effortHours?: number;
  effortConfidence: ConfidenceLevel;
  effortSource: string;
  rationale: string[];
  category: 'feature' | 'tech_debt';
  subCategory?: 'polish' | 'new'; // Feature subcategory: polish work (>60% complete) vs new features
};

type RecommendationWeights = {
  userImpact: number;
  businessValue: number;
  strategicAlignment: number;
  completeness: number;
  technicalBlocking: number;
};

const safeRead = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const listDirs = (dirPath: string): string[] => {
  try {
    return readdirSync(dirPath)
      .filter((name) => statSync(join(dirPath, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
};

const listComponents = (dirPath: string): string[] => {
  try {
    return readdirSync(dirPath)
      .filter((name) => name.endsWith('.component.ts'))
      .map((name) => name.replace('.component.ts', ''))
      .sort();
  } catch {
    return [];
  }
};

const walkFiles = (
  dirPath: string,
  extensions: string[],
  ignoredDirs: Set<string>
): string[] => {
  const results: string[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        results.push(
          ...walkFiles(join(dirPath, entry.name), extensions, ignoredDirs)
        );
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          results.push(join(dirPath, entry.name));
        }
      }
    }
  } catch {
    return results;
  }
  return results;
};

const collectComponentFiles = (rootPath: string): ComponentFile[] => {
  const componentPaths = walkFiles(rootPath, ['.component.ts'], new Set());
  return componentPaths.map((path) => {
    const htmlPath = path.replace('.component.ts', '.component.html');
    const scssPath = path.replace('.component.ts', '.component.scss');
    const specPath = path.replace('.component.ts', '.component.spec.ts');
    return {
      path,
      htmlPath,
      scssPath,
      specPath,
      hasHtml: existsSync(htmlPath),
      hasScss: existsSync(scssPath),
      hasSpec: existsSync(specPath),
      // SCALABLE: Read content for pattern matching
      tsContent: safeRead(path),
      htmlContent: safeRead(htmlPath),
      scssContent: safeRead(scssPath),
    };
  });
};

const collectFeatureScans = (
  featuresDir: string,
  ignoredDirs: Set<string>
): FeatureScan[] => {
  const featureNames = listDirs(featuresDir);
  return featureNames.map((name) => {
    const featurePath = join(featuresDir, name);
    const componentFiles = collectComponentFiles(featurePath);
    const htmlFiles = walkFiles(featurePath, ['.html'], ignoredDirs);
    const tsFiles = walkFiles(featurePath, ['.ts'], ignoredDirs).filter(
      (filePath) => !filePath.endsWith('.spec.ts')
    );
    const specFiles = walkFiles(featurePath, ['.spec.ts'], ignoredDirs);
    const mdFiles = walkFiles(featurePath, ['.md'], ignoredDirs);
    const mainComponent = componentFiles.find((component) =>
      component.path.endsWith(`${name}.component.ts`)
    );

    return {
      name,
      path: featurePath,
      componentFiles,
      htmlFiles,
      tsFiles,
      specFiles,
      mdFiles,
      mainComponent,
    };
  });
};

/**
 * Risk domain detection patterns.
 * Used to automatically flag features with high-risk code patterns.
 */
const RISK_DOMAIN_PATTERNS: Record<RiskDomain, RegExp[]> = {
  payments: [
    /payment|pay\b|invoice|billing|transaction|checkout|price|cost|amount|fee/i,
    /stripe|paypal|mada|stcpay|credit.?card|debit/i,
    /refund|charge|wallet|balance/i,
    /PaymentService|PaymentStore|PaymentStatus/i,
  ],
  cancellation: [
    /cancel|cancellation|refund|void|undo/i,
    /CancellationForm|cancellation-form|CancellationReason/i,
    /cancelBooking|cancelOrder|cancelReservation/i,
    /cancellationPolicy|cancellationFee/i,
  ],
  timers: [
    /timer|timeout|countdown|hold|expire|holdUntil|expiresAt/i,
    /setTimeout|setInterval|clearTimeout|clearInterval/i,
    /Observable\.timer|timer\(|interval\(/i,
    /HoldTimer|hold-timer|CountdownTimer/i,
    /takeUntilDestroyed|ngOnDestroy.*clear/i,
  ],
  'async-flows': [
    /subscribe\s*\(|\.pipe\s*\(/i,
    /Observable|Promise|async\s+|await\s+/i,
    /forkJoin|combineLatest|switchMap|mergeMap|concatMap/i,
    /effect\s*\(|computed\s*\(/i,
    /loading\s*=\s*signal|isLoading|loading\$/i,
    /withMethods|withComputed|signalStore/i,
  ],
  authentication: [
    /auth|login|logout|session|token|jwt|bearer/i,
    /password|credential|identity|oauth/i,
    /AuthService|AuthGuard|AuthStore/i,
  ],
  'data-mutation': [
    /update\w*\(|delete\w*\(|remove\w*\(|create\w*\(|insert|patch|put|post/i,
    /store\.update|patchState|setState|\.next\(/i,
    /save\w*\(|submit\w*\(/i,
  ],
  'external-api': [
    /HttpClient|http\./i,
    /fetch\s*\(|axios/i,
    /api\/|\/api|endpoint|baseUrl/i,
    /environment\.(api|baseUrl)/i,
  ],
  'user-data': [
    /customer|user|profile|personal|email|phone|name|address/i,
    /PII|sensitive|private|confidential/i,
    /CustomerService|UserStore/i,
  ],
};

/**
 * Detect risk domains in a feature by scanning its content.
 * Returns array of detected risk domains.
 */
const detectRiskDomains = (feature: FeatureScan): RiskDomain[] => {
  const risks: Set<RiskDomain> = new Set();

  // Collect all content from feature
  let combinedContent = '';
  for (const component of feature.componentFiles) {
    const tsContent = safeRead(component.path);
    if (tsContent) combinedContent += tsContent + '\n';
    if (component.hasHtml) {
      const htmlContent = safeRead(component.htmlPath);
      if (htmlContent) combinedContent += htmlContent + '\n';
    }
  }
  for (const htmlPath of feature.htmlFiles) {
    const htmlContent = safeRead(htmlPath);
    if (htmlContent) combinedContent += htmlContent + '\n';
  }
  for (const tsPath of feature.tsFiles) {
    const tsContent = safeRead(tsPath);
    if (tsContent) combinedContent += tsContent + '\n';
  }

  // Check each risk domain
  for (const [domain, patterns] of Object.entries(RISK_DOMAIN_PATTERNS) as [
    RiskDomain,
    RegExp[]
  ][]) {
    const hasRisk = patterns.some((pattern) => pattern.test(combinedContent));
    if (hasRisk) risks.add(domain);
  }

  return Array.from(risks);
};

/**
 * Dynamically discover all features in the features directory.
 * Returns DiscoveredFeature[] with full metadata including risk domains.
 */
const discoverFeatures = (featuresDir: string): DiscoveredFeature[] => {
  if (!existsSync(featuresDir)) return [];

  const featureNames = listDirs(featuresDir);
  return featureNames.map((name) => {
    const rootPath = join(featuresDir, name);
    const componentFiles = collectComponentFiles(rootPath);
    const allFiles = walkFiles(
      rootPath,
      ['.ts', '.html', '.scss', '.css'],
      new Set(['node_modules', 'dist'])
    );
    const tests = allFiles.filter((f) => f.endsWith('.spec.ts'));
    // Detect store IMPORTS instead of store FILES (features import from shared state)
    const stores: string[] = [];
    const tsFilesForStoreDetection = allFiles.filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')
    );
    for (const tsFile of tsFilesForStoreDetection) {
      const content = safeRead(tsFile);
      if (!content) continue;
      // Match: import { BookingStore } from '...' or import { SomeStore, OtherStore }
      const importMatches = content.match(
        /import\s*\{[^}]*\b(\w+Store)\b[^}]*\}/g
      );
      if (importMatches) {
        for (const match of importMatches) {
          // Extract all *Store names from the import
          const storeMatches = match.match(/\b(\w+Store)\b/g);
          if (storeMatches) {
            for (const storeName of storeMatches) {
              if (!stores.includes(storeName)) {
                stores.push(storeName);
              }
            }
          }
        }
      }
    }
    const services = allFiles.filter((f) => /\.service\.ts$/i.test(f));

    // Create a FeatureScan for risk detection
    const featureScan: FeatureScan = {
      name,
      path: rootPath,
      componentFiles,
      htmlFiles: allFiles.filter((f) => f.endsWith('.html')),
      tsFiles: allFiles.filter(
        (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')
      ),
      specFiles: tests,
      mdFiles: allFiles.filter((f) => f.endsWith('.md')),
    };

    const riskDomains = detectRiskDomains(featureScan);

    return {
      name,
      rootPath,
      files: allFiles,
      components: componentFiles,
      tests,
      stores,
      services,
      riskDomains,
    };
  });
};

/**
 * Collect enhanced Evidence Pack V2 with per-feature metrics.
 * STRATEGY A: QUICK_WIN - All data is per-feature for granular analysis.
 */
const collectEvidencePackV2 = (
  basePath: string,
  discoveredFeatures: DiscoveredFeature[]
): EvidencePackV2 => {
  const evidence: EvidencePackV2 = {
    todosByFeature: new Map(),
    clickHandlersByFeature: new Map(),
    testFilesByFeature: new Map(),
    storeUsageByFeature: new Map(),
    riskFlagsByFeature: new Map(),
    recentGitChanges: [],
    gitDataAvailable: false,
    discoveredFeatures,
  };

  for (const feature of discoveredFeatures) {
    // TODOs per feature
    const todos: Array<{ path: string; line: number; text: string }> = [];
    for (const file of feature.files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (/TODO|FIXME|HACK|XXX/.test(line)) {
            todos.push({
              path: file.replace(basePath + sep, '').replace(/\\/g, '/'),
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      } catch {
        /* skip unreadable files */
      }
    }
    evidence.todosByFeature.set(feature.name, todos);

    // Click handlers count per feature
    let handlerCount = 0;
    for (const file of feature.files.filter((f) => f.endsWith('.html'))) {
      try {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(/\(click\)="/g);
        handlerCount += matches ? matches.length : 0;
      } catch {
        /* skip */
      }
    }
    evidence.clickHandlersByFeature.set(feature.name, handlerCount);

    // Test files per feature
    evidence.testFilesByFeature.set(
      feature.name,
      feature.tests.map((t) =>
        t.replace(basePath + sep, '').replace(/\\/g, '/')
      )
    );

    // Store usage per feature
    evidence.storeUsageByFeature.set(
      feature.name,
      feature.stores.map((s) => basename(s).replace('.store.ts', ''))
    );

    // Risk flags per feature
    evidence.riskFlagsByFeature.set(feature.name, feature.riskDomains);
  }

  // Git changes with feature tagging
  try {
    const gitOutput = execSync(
      'git log -n 20 --name-only --format=COMMIT:%h|%s',
      {
        cwd: basePath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    ).trim();

    evidence.gitDataAvailable = true;
    let currentCommit: {
      hash: string;
      message: string;
      files: string[];
      features: string[];
    } | null = null;

    gitOutput.split('\n').forEach((line) => {
      if (line.startsWith('COMMIT:')) {
        if (currentCommit) evidence.recentGitChanges.push(currentCommit);
        const parts = line.replace('COMMIT:', '').split('|');
        currentCommit = {
          hash: parts[0],
          message: parts[1] || '',
          files: [],
          features: [],
        };
      } else if (line.trim() && currentCommit) {
        currentCommit.files.push(line.trim());
        // Tag which features were touched
        for (const feature of discoveredFeatures) {
          if (line.includes(`features/${feature.name}/`)) {
            if (!currentCommit.features.includes(feature.name)) {
              currentCommit.features.push(feature.name);
            }
          }
        }
      }
    });
    if (currentCommit) evidence.recentGitChanges.push(currentCommit);
  } catch {
    evidence.gitDataAvailable = false; // Mark UNKNOWN
  }

  return evidence;
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION BEFORE IMPROVEMENT
// Checks if improvements already exist via code search BEFORE proposing them.
// Returns evidence of presence or absence.
// ─────────────────────────────────────────────────────────────────────────────

type ImprovementType =
  | 'error-handling-transport'
  | 'error-handling-ui'
  | 'loading-state'
  | 'empty-state'
  | 'accessibility'
  | 'tests'
  | 'async-cleanup'
  | 'form-validation'
  | 'confirmation-dialogs';

type VerificationResult = {
  needed: boolean;
  evidence: string;
  existingPatterns: string[];
  missingPatterns: string[];
  searchedPatterns: Array<{
    pattern: string;
    description: string;
    found: boolean;
  }>;
  searchedFiles: string;
};

const IMPROVEMENT_PATTERNS: Record<
  ImprovementType,
  { required: RegExp[]; descriptions: string[] }
> = {
  'error-handling-transport': {
    required: [
      /(catch\s*\(|\.catch\s*\(|catchError\s*\(?\s*|catch\s*\{)/,
      /(subscribe\s*\([^)]*error|error\s*=>|\.pipe\s*\(\s*tap\s*\([^)]*error|\.catch\(|catchError)/,
    ],
    descriptions: [
      'Try-catch or catchError operator (transport layer)',
      'Error handler in subscribe, arrow function, or pipe operator',
    ],
  },
  'error-handling-ui': {
    required: [
      /(\*ngIf\s*=\s*['"][^'"]*error|error\(\)|error\s*\?\s*\?|@if\s*\(\s*error\s*\(\s*\)\s*\))/,
      /(role\s*=\s*['"]alert['"]|aria-live\s*=\s*['"]assertive['"]|role\s*=\s*['"]status['"])/,
    ],
    descriptions: [
      'Error signal/state display (*ngIf or @if with error)',
      'Error accessibility (role=alert, aria-live, or role=status)',
    ],
  },
  'loading-state': {
    required: [
      /(loading\(\)|isLoading\(\)|loading\s*=\s*signal)/,
      /(@if\s*\(loading\(\)\)|ngIf\s*=\s*['"].*loading['"])/,
      /(aria-busy\s*=|role\s*=\s*['"]status['"])/,
    ],
    descriptions: [
      'Loading signal/state',
      'Loading UI indicator',
      'Loading accessibility (aria-busy or role=status)',
    ],
  },
  'empty-state': {
    required: [
      /(\.\s*length\s*===?\s*0|isEmpty\(\)|empty-state|showEmptyState|emptyState)/,
      /(\*ngIf\s*=\s*['"][^'"]*\.length\s*===?\s*0|@if[^{]*\.length\s*===?\s*0|@if\s*\(\s*\w*[Ee]mpty\w*\(\s*\)\s*\)|@empty)/,
    ],
    descriptions: [
      'Empty check logic (length check, isEmpty, computed signal)',
      'Empty state UI display (*ngIf, @if with length check, or @if with empty signal)',
    ],
  },
  accessibility: {
    required: [
      /(aria-label|aria-labelledby|aria-describedby)/,
      /role\s*=\s*['"](button|navigation|main|region|dialog|alert)['"]/,
      /(<label\s|for\s*=\s*['"]|id\s*=\s*['"])/,
    ],
    descriptions: [
      'ARIA labels',
      'Semantic roles',
      'Form labels and associations',
    ],
  },
  tests: {
    required: [
      /(describe\s*\(|it\s*\(|test\s*\()/,
      /(expect\s*\(|toBe|toEqual|toHaveBeenCalled)/,
    ],
    descriptions: ['Test suites (describe/it/test)', 'Assertions (expect)'],
  },
  'async-cleanup': {
    required: [
      /(takeUntilDestroyed|ngOnDestroy|unsubscribe)/,
      /(DestroyRef|destroyRef)/,
    ],
    descriptions: [
      'Subscription cleanup (takeUntilDestroyed/unsubscribe)',
      'DestroyRef injection',
    ],
  },
  'form-validation': {
    required: [
      /(Validators\.|required|minLength|maxLength|pattern)/,
      /(formControl|ngModel|FormGroup|FormBuilder)/,
      /(\.\s*invalid|\.\s*valid|\.\s*errors)/,
    ],
    descriptions: [
      'Validation rules',
      'Form control binding',
      'Validation state checks',
    ],
  },
  'confirmation-dialogs': {
    required: [
      /(confirm\(|ConfirmDialog|confirmation-dialog|MatDialog)/,
      /(window\.confirm|modal|dialog)/i,
    ],
    descriptions: [
      'Confirmation dialog usage',
      'Modal/dialog for destructive actions',
    ],
  },
};

// Define which files to search for each improvement type (VERIFICATION SCOPE RULE)
const IMPROVEMENT_SCOPE: Record<
  ImprovementType,
  'html-ts' | 'spec-only' | 'ts-service-store' | 'html-ts-all'
> = {
  'error-handling-transport': 'ts-service-store', // Search in .ts, .service.ts, .store.ts
  'error-handling-ui': 'html-ts', // Search in .html and .ts
  'loading-state': 'html-ts', // Search in .html and .ts
  'empty-state': 'html-ts', // Search in .html and .ts
  accessibility: 'html-ts', // Search in .html and .ts
  tests: 'spec-only', // Search only in .spec.ts
  'async-cleanup': 'ts-service-store', // Search in .ts, .service.ts, .store.ts
  'form-validation': 'html-ts', // Search in .html and .ts
  'confirmation-dialogs': 'html-ts-all', // Search in .html, .ts (all content)
};

const verifyImprovementNeeded = (
  feature: FeatureScan,
  type: ImprovementType
): VerificationResult => {
  const patterns = IMPROVEMENT_PATTERNS[type];
  if (!patterns) {
    return {
      needed: false,
      evidence: `Unknown improvement type: ${type}`,
      existingPatterns: [],
      missingPatterns: [],
      searchedPatterns: [],
    };
  }

  // FIX #3: Skip form-validation for components that don't have form elements
  // Calendar views, lists, and other non-form components shouldn't require form validation
  if (type === 'form-validation') {
    let hasFormElements = false;
    const formElementPattern =
      /(<form[\s>]|formGroup|formControl|ngModel|\[formControl\]|\(ngSubmit\)|<input[\s>]|<select[\s>]|<textarea[\s>])/i;
    for (const comp of feature.componentFiles) {
      if (
        formElementPattern.test(comp.htmlContent) ||
        formElementPattern.test(comp.tsContent)
      ) {
        hasFormElements = true;
        break;
      }
    }
    if (!hasFormElements) {
      return {
        needed: false,
        evidence: `✅ form-validation: N/A (component has no form elements - calendar/view component)`,
        existingPatterns: ['N/A - no forms'],
        missingPatterns: [],
        searchedPatterns: [],
        searchedFiles:
          '<FEATURE_ROOT>/**/*.component.html, <FEATURE_ROOT>/**/*.component.ts',
      };
    }
  }

  // Collect content based on verification scope (VERIFICATION SCOPE RULE)
  const scope = IMPROVEMENT_SCOPE[type];
  let combinedContent = '';
  let searchedFiles = '';

  if (scope === 'html-ts') {
    // Search in .html and .ts component files
    for (const comp of feature.componentFiles) {
      combinedContent += comp.htmlContent + '\n';
      combinedContent += comp.tsContent + '\n';
    }
    searchedFiles =
      '<FEATURE_ROOT>/**/*.component.html, <FEATURE_ROOT>/**/*.component.ts';
  } else if (scope === 'spec-only') {
    // Search only in .spec.ts files
    for (const specFile of feature.specFiles) {
      const specContent = safeRead(specFile);
      if (specContent) combinedContent += specContent + '\n';
    }
    searchedFiles = '<FEATURE_ROOT>/**/*.spec.ts';
  } else if (scope === 'ts-service-store') {
    // Search in .component.ts, .service.ts, and .store.ts
    for (const comp of feature.componentFiles) {
      combinedContent += comp.tsContent + '\n';
    }
    for (const tsFile of feature.tsFiles) {
      const tsContent = safeRead(tsFile);
      if (tsContent) combinedContent += tsContent + '\n';
    }
    // FIX #1: Also search shared stores outside feature folder
    // Detect store imports and resolve their paths
    const storeImportPattern =
      /import\s*\{[^}]*\}\s*from\s*['"]([^'"]*\.store)['"]/g;
    let storeMatch;
    for (const comp of feature.componentFiles) {
      const content = comp.tsContent;
      while ((storeMatch = storeImportPattern.exec(content)) !== null) {
        const importPath = storeMatch[1];
        // Resolve relative imports to absolute paths
        if (importPath.includes('state/')) {
          // Extract state folder name from import (e.g., '../../state/bookings/booking.store')
          const stateMatch = importPath.match(/state\/([^/]+)\/([^/]+)\.store/);
          if (stateMatch) {
            const [, folder, storeName] = stateMatch;
            const sharedStorePath = join(
              'apps/manager-dashboard/src/app/state',
              folder,
              `${storeName}.store.ts`
            );
            const sharedStoreContent = safeRead(sharedStorePath);
            if (sharedStoreContent) {
              combinedContent += sharedStoreContent + '\n';
            }
          }
        }
      }
      storeImportPattern.lastIndex = 0; // Reset regex state
    }
    searchedFiles =
      '<FEATURE_ROOT>/**/*.component.ts, <FEATURE_ROOT>/**/*.service.ts, <FEATURE_ROOT>/**/*.store.ts, apps/**/state/**/*.store.ts (via imports)';
  } else if (scope === 'html-ts-all') {
    // Search in all component files
    for (const comp of feature.componentFiles) {
      combinedContent += comp.tsContent + '\n';
      combinedContent += comp.htmlContent + '\n';
      combinedContent += comp.scssContent + '\n';
    }
    searchedFiles =
      '<FEATURE_ROOT>/**/*.component.ts, <FEATURE_ROOT>/**/*.component.html';
  }

  const existingPatterns: string[] = [];
  const missingPatterns: string[] = [];
  const searchedPatterns: Array<{
    pattern: string;
    description: string;
    found: boolean;
  }> = [];

  // Check each required pattern
  patterns.required.forEach((pattern, index) => {
    const description = patterns.descriptions[index] || pattern.toString();
    const found = pattern.test(combinedContent);
    // Store the pattern as string for evidence output
    searchedPatterns.push({
      pattern: pattern.toString(),
      description,
      found,
    });
    if (found) {
      existingPatterns.push(description);
    } else {
      missingPatterns.push(description);
    }
  });

  // Determine if improvement is needed
  const needed = missingPatterns.length > 0;
  const total = patterns.required.length;
  const existing = existingPatterns.length;

  let evidence: string;
  if (!needed) {
    evidence = `✅ All ${total} ${type} patterns found in ${searchedFiles}`;
  } else if (existing === 0) {
    evidence = `❌ No ${type} patterns found in ${searchedFiles}. Missing: ${missingPatterns.join(
      ', '
    )}`;
  } else {
    evidence = `⚠️ Partial ${type} coverage (${existing}/${total}) in ${searchedFiles}. Has: ${existingPatterns.join(
      ', '
    )}. Missing: ${missingPatterns.join(', ')}`;
  }

  return {
    needed,
    evidence,
    existingPatterns,
    missingPatterns,
    searchedPatterns,
    searchedFiles,
  };
};

// Verify all improvement types for a feature and return summary
const verifyAllImprovements = (
  feature: FeatureScan
): Record<ImprovementType, VerificationResult> => {
  const results: Record<ImprovementType, VerificationResult> = {} as Record<
    ImprovementType,
    VerificationResult
  >;

  const types: ImprovementType[] = [
    'error-handling-transport',
    'error-handling-ui',
    'loading-state',
    'empty-state',
    'accessibility',
    'tests',
    'async-cleanup',
    'form-validation',
    'confirmation-dialogs',
  ];

  for (const type of types) {
    results[type] = verifyImprovementNeeded(feature, type);
  }

  return results;
};

const countLines = (text: string): number => {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
};

const countMatches = (text: string, regex: RegExp): number => {
  if (!text) return 0;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
};

const specPathFor = (filePath: string): string =>
  filePath.replace(/\.ts$/, '.spec.ts');

const parseRuleThreshold = (
  configText: string,
  ruleName: string
): number | undefined => {
  const directNumber = new RegExp(
    `${ruleName}\\s*:\\s*\\[\\s*['"]\\w+['"]\\s*,\\s*(\\d+)`,
    'm'
  );
  const objectMax = new RegExp(
    `${ruleName}\\s*:\\s*\\[\\s*['"]\\w+['"]\\s*,\\s*\\{[^}]*\\bmax\\s*:\\s*(\\d+)`,
    'm'
  );
  const directMatch = configText.match(directNumber);
  if (directMatch?.[1]) return Number(directMatch[1]);
  const objectMatch = configText.match(objectMax);
  if (objectMatch?.[1]) return Number(objectMatch[1]);
  return undefined;
};

const extractEslintThresholds = (configText: string): ESLintThresholds => ({
  complexity: parseRuleThreshold(configText, 'complexity'),
  maxLines: parseRuleThreshold(configText, 'max-lines'),
  maxLinesPerFunction: parseRuleThreshold(configText, 'max-lines-per-function'),
  maxStatements: parseRuleThreshold(configText, 'max-statements'),
  maxDepth: parseRuleThreshold(configText, 'max-depth'),
  maxParams: parseRuleThreshold(configText, 'max-params'),
});

const estimateComplexity = (text: string): number => {
  const complexityTokens = countMatches(
    text,
    /\bif\b|\bfor\b|\bwhile\b|\bcase\b|\bcatch\b|\?\s|&&|\|\|/g
  );
  const functionTokens = countMatches(text, /\bfunction\b|=>\s*\{/g);
  const divisor = Math.max(1, functionTokens);
  return Math.max(1, Math.round(complexityTokens / divisor));
};

const scanDependencies = (
  repoRoot: string,
  sourceFiles: string[]
): DependencyScan => {
  const packageText = safeRead(join(repoRoot, 'package.json'));
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  let scripts: Record<string, string> = {};

  try {
    const parsed = JSON.parse(packageText) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    dependencies = parsed.dependencies ?? {};
    devDependencies = parsed.devDependencies ?? {};
    scripts = parsed.scripts ?? {};
  } catch {
    return { unused: [], missing: [], totalDependencies: 0, totalUsed: 0 };
  }

  const depNames = new Set(Object.keys(dependencies));
  const devDepNames = new Set(Object.keys(devDependencies));
  const allDeclared = new Set([...depNames, ...devDepNames]);
  const used = new Set<string>();

  const importRegex =
    /\bfrom\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  const builtins = new Set([
    'fs',
    'path',
    'url',
    'os',
    'http',
    'https',
    'crypto',
    'stream',
    'buffer',
    'child_process',
    'util',
    'events',
    'assert',
  ]);
  const alwaysUsedPrefixes = ['@angular/', '@nestjs/', '@nx/'];
  const alwaysUsedPackages = new Set([
    'rxjs',
    'zone.js',
    'tslib',
    'reflect-metadata',
    'class-transformer',
  ]);

  for (const filePath of sourceFiles) {
    const text = safeRead(filePath);
    if (!text) continue;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(text)) !== null) {
      const raw = match[1] ?? match[2] ?? match[3];
      if (!raw) continue;
      if (raw.startsWith('.') || raw.startsWith('/')) continue;
      const pkgName = raw.startsWith('@')
        ? raw.split('/').slice(0, 2).join('/')
        : raw.split('/')[0];
      if (builtins.has(pkgName)) continue;
      if (pkgName.startsWith('@khana/')) continue;
      used.add(pkgName);
    }
  }

  const scriptText = Object.values(scripts).join(' ');
  if (scriptText) {
    for (const dep of allDeclared) {
      if (scriptText.includes(dep)) {
        used.add(dep);
      }
    }
  }

  const unused = Array.from(depNames)
    .filter((dep) => {
      if (used.has(dep)) return false;
      if (alwaysUsedPackages.has(dep)) return false;
      if (alwaysUsedPrefixes.some((prefix) => dep.startsWith(prefix)))
        return false;
      return true;
    })
    .sort();
  const missing = Array.from(used)
    .filter((pkg) => !allDeclared.has(pkg))
    .filter((pkg) => !pkg.startsWith('@khana/'))
    .sort();

  return {
    unused,
    missing,
    totalDependencies: depNames.size + devDepNames.size,
    totalUsed: used.size,
  };
};

/**
 * Scans feature-level dependencies (internal imports).
 * Unlike scanDependencies which checks npm packages, this captures:
 * - Relative imports (./*, ../*)
 * - @khana/* workspace imports
 * - Angular/framework imports
 * - Shared component imports
 */
const scanFeatureDependencies = (
  feature: FeatureScan
): FeatureDependencyReport => {
  const dependencies: FeatureDependency[] = [];
  const seen = new Set<string>();

  // Import detection regex - captures the import path and imported names
  const importRegex =
    /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

  for (const tsFile of feature.tsFiles) {
    const text = safeRead(tsFile);
    if (!text) continue;

    // Match static imports
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(text)) !== null) {
      const namedImports = match[1] ?? '';
      const defaultImport = match[2] ?? '';
      const importPath = match[3];

      if (!importPath) continue;

      // Extract individual import names
      const importNames = namedImports
        ? namedImports.split(',').map((s) =>
            s
              .trim()
              .split(/\s+as\s+/)[0]
              .trim()
          )
        : defaultImport
        ? [defaultImport]
        : [];

      for (const name of importNames) {
        if (!name) continue;
        const key = `${name}::${importPath}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const dep = classifyDependency(name, importPath);
        dependencies.push(dep);
      }
    }

    // Match dynamic imports
    while ((match = dynamicImportRegex.exec(text)) !== null) {
      const importPath = match[1];
      if (!importPath || seen.has(`dynamic::${importPath}`)) continue;
      seen.add(`dynamic::${importPath}`);

      const dep = classifyDependency('(dynamic)', importPath);
      dependencies.push(dep);
    }
  }

  // Categorize dependencies
  const categorized: CategorizedDependencies = {
    stores: [],
    components: [],
    services: [],
    dtos: [],
    utils: [],
    angular: [],
    external: [],
  };

  for (const dep of dependencies) {
    // Skip Angular core imports from categorization (they're framework)
    if (dep.type === 'angular') {
      if (!categorized.angular.includes(dep.resolvedName)) {
        categorized.angular.push(dep.resolvedName);
      }
      continue;
    }

    const name = dep.resolvedName;
    switch (dep.type) {
      case 'store':
        if (!categorized.stores.includes(name)) categorized.stores.push(name);
        break;
      case 'component':
        if (!categorized.components.includes(name))
          categorized.components.push(name);
        break;
      case 'service':
        if (!categorized.services.includes(name))
          categorized.services.push(name);
        break;
      case 'dto':
        if (!categorized.dtos.includes(name)) categorized.dtos.push(name);
        break;
      case 'util':
        if (!categorized.utils.includes(name)) categorized.utils.push(name);
        break;
      case 'external':
        if (!categorized.external.includes(name))
          categorized.external.push(name);
        break;
    }
  }

  // Filter out Angular from count (framework noise)
  const nonAngularDeps = dependencies.filter((d) => d.type !== 'angular');

  return {
    feature: feature.name,
    dependencies: nonAngularDeps,
    categorized,
    totalCount: nonAngularDeps.length,
  };
};

/**
 * Classifies an import into a dependency type based on path patterns.
 */
const classifyDependency = (
  name: string,
  importPath: string
): FeatureDependency => {
  // Determine location type
  const isLocal = importPath.startsWith('./');
  const isShared =
    importPath.includes('/shared/') || importPath.includes('shared/components');
  const isExternal = importPath.startsWith('@khana/');
  const isAngular = importPath.startsWith('@angular/');
  const isNestJS = importPath.startsWith('@nestjs/');
  const isRxjs = importPath.startsWith('rxjs');

  // Determine dependency type
  let type: FeatureDependency['type'] = 'util';

  if (isAngular || isNestJS || isRxjs) {
    type = 'angular';
  } else if (
    importPath.includes('/store') ||
    name.toLowerCase().includes('store')
  ) {
    type = 'store';
  } else if (
    name.endsWith('Component') ||
    importPath.includes('.component') ||
    importPath.includes('/components/')
  ) {
    type = 'component';
  } else if (
    name.endsWith('Service') ||
    importPath.includes('.service') ||
    importPath.includes('/services/')
  ) {
    type = 'service';
  } else if (
    name.endsWith('Dto') ||
    name.endsWith('DTO') ||
    importPath.includes('dto') ||
    importPath.includes('@khana/shared-dtos')
  ) {
    type = 'dto';
  } else if (isExternal) {
    type = 'external';
  }

  return {
    importPath,
    resolvedName: name,
    type,
    isLocal,
    isShared,
    isExternal,
  };
};

/**
 * Formats feature dependencies for display in the report.
 */
const formatFeatureDependencies = (
  reports: FeatureDependencyReport[]
): string[] => {
  const lines: string[] = [];

  for (const report of reports) {
    lines.push(`\n### ${report.feature} (${report.totalCount} dependencies)`);

    const { categorized } = report;

    if (categorized.stores.length > 0) {
      lines.push(`  Stores: ${categorized.stores.join(', ')}`);
    }
    if (categorized.components.length > 0) {
      lines.push(`  Components: ${categorized.components.join(', ')}`);
    }
    if (categorized.services.length > 0) {
      lines.push(`  Services: ${categorized.services.join(', ')}`);
    }
    if (categorized.dtos.length > 0) {
      lines.push(`  DTOs: ${categorized.dtos.join(', ')}`);
    }
    if (categorized.utils.length > 0) {
      lines.push(`  Utils: ${categorized.utils.join(', ')}`);
    }
    if (categorized.external.length > 0) {
      lines.push(`  External (@khana/*): ${categorized.external.join(', ')}`);
    }

    if (report.totalCount === 0) {
      lines.push('  (no internal dependencies detected)');
    }
  }

  return lines;
};

const scanSecurity = (sourceFiles: string[]): SecurityFinding[] => {
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'eval', regex: /\beval\s*\(/g },
    { name: 'new Function', regex: /\bnew\s+Function\b/g },
    {
      name: 'child_process',
      regex: /\bchild_process\.(exec|execSync|spawn|spawnSync)\b/g,
    },
    { name: 'innerHTML assignment', regex: /\.innerHTML\s*=/g },
    { name: 'dangerouslySetInnerHTML', regex: /\bdangerouslySetInnerHTML\b/g },
    { name: 'document.write', regex: /\bdocument\.write\b/g },
    { name: 'setTimeout string', regex: /\bsetTimeout\(\s*['"`]/g },
    { name: 'setInterval string', regex: /\bsetInterval\(\s*['"`]/g },
  ];

  const findings: SecurityFinding[] = [];
  for (const pattern of patterns) {
    let count = 0;
    const locations: Array<{ path: string; line: number; excerpt: string }> =
      [];
    for (const filePath of sourceFiles) {
      if (filePath.includes(`${sep}src${sep}agents${sep}`)) continue;
      const text = safeRead(filePath);
      if (!text) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        pattern.regex.lastIndex = 0;
        const matches = line.match(pattern.regex);
        if (matches && matches.length > 0) {
          count += matches.length;
          locations.push({
            path: filePath,
            line: i + 1,
            excerpt: line.trim().slice(0, 120),
          });
        }
      }
    }
    if (count > 0) {
      findings.push({ pattern: pattern.name, count, locations });
    }
  }
  return findings;
};

const formatSecurityFindings = (
  findings: SecurityFinding[],
  maxLocations = 5
): string[] => {
  if (findings.length === 0) {
    return ['No security patterns detected (regex scan only).'];
  }
  return findings.map((finding) => {
    const sample = finding.locations
      .slice(0, maxLocations)
      .map((loc) => `${loc.path}:${loc.line}`);
    const extra =
      finding.locations.length > maxLocations
        ? ` (+${finding.locations.length - maxLocations} more)`
        : '';
    return `${finding.pattern}: ${finding.count}${
      sample.length > 0 ? ` (locations: ${sample.join(', ')}${extra})` : ''
    }`;
  });
};

/**
 * Runs actual validators (ESLint, TypeScript) on feature files.
 * Returns validated scores instead of estimates.
 */
const runValidators = (feature: FeatureScan): ValidationResults => {
  const details: { eslint: string[]; typescript: string[] } = {
    eslint: [],
    typescript: [],
  };

  // Run ESLint on feature TypeScript files
  let eslintPassed = true;
  let eslintErrors = 0;
  let eslintWarnings = 0;

  if (feature.tsFiles.length > 0) {
    try {
      const files = feature.tsFiles.slice(0, 20).join(' '); // Limit to avoid command line length issues
      const result = execSync(
        `npx eslint ${files} --format json --no-error-on-unmatched-pattern 2>/dev/null || true`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
      );

      try {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          for (const file of parsed) {
            eslintErrors += file.errorCount ?? 0;
            eslintWarnings += file.warningCount ?? 0;
          }
        }
        eslintPassed = eslintErrors === 0;
        details.eslint.push(`Files checked: ${feature.tsFiles.length}`);
        details.eslint.push(`Errors: ${eslintErrors}`);
        details.eslint.push(`Warnings: ${eslintWarnings}`);
      } catch {
        // If JSON parse fails, assume ESLint ran but couldn't parse output
        details.eslint.push('ESLint ran but output could not be parsed');
      }
    } catch {
      // ESLint execution failed
      details.eslint.push(
        'ESLint execution failed (check if eslint is configured)'
      );
      eslintPassed = false;
    }
  } else {
    details.eslint.push('No TypeScript files to lint');
  }

  // Run TypeScript type check
  let tsPassed = true;
  let tsErrors = 0;

  try {
    // Run tsc on the feature directory
    const tsconfigPath = existsSync(join(process.cwd(), 'tsconfig.json'))
      ? 'tsconfig.json'
      : 'tsconfig.base.json';
    execSync(
      `npx tsc --noEmit --project ${tsconfigPath} 2>&1 | head -100 || true`,
      {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
        timeout: 60000,
        cwd: process.cwd(),
      }
    );
    tsPassed = true;
    details.typescript.push('TypeScript check passed');
  } catch (error) {
    // Try to count errors from output
    const errorOutput = (error as { stdout?: string }).stdout ?? '';
    const errorLines = errorOutput
      .split('\n')
      .filter((line) => line.includes('error TS'));
    tsErrors = errorLines.length;
    tsPassed = tsErrors === 0;
    details.typescript.push(`TypeScript errors: ${tsErrors}`);
    if (tsErrors > 0 && tsErrors <= 5) {
      details.typescript.push(...errorLines.slice(0, 5));
    }
  }

  // Calculate overall score
  let score = 10; // Base score

  if (eslintPassed) {
    score += 8;
  } else if (eslintErrors <= 5) {
    score += 5;
  } else if (eslintErrors <= 10) {
    score += 2;
  }

  if (eslintWarnings === 0) {
    score += 2;
  }

  if (tsPassed) {
    score += 5;
  } else if (tsErrors <= 3) {
    score += 2;
  }

  score = Math.min(25, score);

  return {
    eslint: {
      passed: eslintPassed,
      errorCount: eslintErrors,
      warningCount: eslintWarnings,
      details: details.eslint,
    },
    typescript: {
      passed: tsPassed,
      errorCount: tsErrors,
      details: details.typescript,
    },
    overall: {
      passed: eslintPassed && tsPassed,
      score,
      confidence: 'VALIDATED' as ConfidenceLevel,
    },
  };
};

/**
 * Cache for validation results to avoid re-running for the same feature.
 */
const validationCache = new Map<string, ValidationResults>();

/**
 * Gets validation results, using cache if available.
 */
const getValidationResults = (
  feature: FeatureScan,
  runValidation: boolean
): ValidationResults | null => {
  if (!runValidation) return null;

  const cached = validationCache.get(feature.name);
  if (cached) return cached;

  const results = runValidators(feature);
  validationCache.set(feature.name, results);
  return results;
};

const scanProjectState = (): ProjectScan => {
  const basePath = process.cwd();
  const featuresDir = join(basePath, 'apps/manager-dashboard/src/app/features');

  // SCALABLE: Dynamically discover all features and generate paths
  const discoveredFeatures = discoverFeatures(featuresDir);
  const featurePaths: Record<
    string,
    { dir: string; mainTs: string; mainHtml: string }
  > = {};
  for (const feature of discoveredFeatures) {
    featurePaths[feature.name] = {
      dir: feature.rootPath,
      mainTs: join(feature.rootPath, `${feature.name}.component.ts`),
      mainHtml: join(feature.rootPath, `${feature.name}.component.html`),
    };
  }

  const paths = {
    featuresDir,
    sharedComponentsDir: join(
      basePath,
      'apps/manager-dashboard/src/app/shared/components'
    ),
    // LEGACY: Keep hardcoded paths for backwards compatibility
    bookingCalendarDir:
      featurePaths['booking-calendar']?.dir ??
      join(
        basePath,
        'apps/manager-dashboard/src/app/features/booking-calendar'
      ),
    bookingListDir:
      featurePaths['booking-list']?.dir ??
      join(basePath, 'apps/manager-dashboard/src/app/features/booking-list'),
    bookingPreviewDir:
      featurePaths['booking-preview']?.dir ??
      join(basePath, 'apps/manager-dashboard/src/app/features/booking-preview'),
    // LEGACY: Use dynamic paths when available
    bookingCalendarHtml:
      featurePaths['booking-calendar']?.mainHtml ??
      join(
        basePath,
        'apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.html'
      ),
    bookingCalendarTs:
      featurePaths['booking-calendar']?.mainTs ??
      join(
        basePath,
        'apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.ts'
      ),
    bookingListTs:
      featurePaths['booking-list']?.mainTs ??
      join(
        basePath,
        'apps/manager-dashboard/src/app/features/booking-list/booking-list.component.ts'
      ),
    bookingPreviewTs:
      featurePaths['booking-preview']?.mainTs ??
      join(
        basePath,
        'apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.ts'
      ),
    bookingStore: join(
      basePath,
      'apps/manager-dashboard/src/app/state/bookings/booking.store.ts'
    ),
    designSystemDoc: join(
      basePath,
      'docs/authoritative/design/design-system.md'
    ),
    designRtlDoc: join(basePath, 'docs/authoritative/design/rtl.md'),
    designAccessibilityDoc: join(
      basePath,
      'docs/authoritative/design/accessibility.md'
    ),
    architectureDoc: join(
      basePath,
      'docs/authoritative/engineering/architecture.md'
    ),
    appRoutes: join(basePath, 'apps/manager-dashboard/src/app/app.routes.ts'),
    holdTimerComponent: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-calendar/hold-timer.component.ts'
    ),
    confirmationDialogComponent: join(
      basePath,
      'apps/manager-dashboard/src/app/shared/components/confirmation-dialog.component.ts'
    ),
    cancellationFormComponent: join(
      basePath,
      'apps/manager-dashboard/src/app/shared/components/cancellation-form.component.ts'
    ),
    eslintConfig: join(basePath, 'eslint.config.mjs'),
    packageJson: join(basePath, 'package.json'),
  };

  const features = listDirs(paths.featuresDir);
  const sharedComponents = listComponents(paths.sharedComponentsDir);
  const calendarComponents = listComponents(paths.bookingCalendarDir);

  const calendarHtmlExists = existsSync(paths.bookingCalendarHtml);
  const calendarTsExists = existsSync(paths.bookingCalendarTs);
  const calendarHtml = safeRead(paths.bookingCalendarHtml);
  const calendarTs = safeRead(paths.bookingCalendarTs);
  const storeTs = safeRead(paths.bookingStore);
  const architectureDoc = safeRead(paths.architectureDoc);
  const eslintConfig = safeRead(paths.eslintConfig);
  const appRoutesText = safeRead(paths.appRoutes) ?? '';

  const dashboardRoot = join(basePath, 'apps/manager-dashboard/src/app');
  const appsRoot = join(basePath, 'apps');
  const libsRoot = join(basePath, 'libs');
  const srcRoot = join(basePath, 'src');
  const ignoredDirs = new Set([
    '.git',
    'node_modules',
    'dist',
    'coverage',
    '.nx',
    '.angular',
  ]);
  const featureScans = collectFeatureScans(paths.featuresDir, ignoredDirs);
  const featureIndex = Object.fromEntries(
    featureScans.map((feature) => [feature.name, feature])
  );
  const sourceFiles = Array.from(
    new Set([
      ...walkFiles(appsRoot, ['.ts', '.js', '.html'], ignoredDirs),
      ...walkFiles(libsRoot, ['.ts', '.js', '.html'], ignoredDirs),
      ...walkFiles(srcRoot, ['.ts', '.js', '.html'], ignoredDirs),
    ])
  );

  const componentFiles = collectComponentFiles(dashboardRoot);
  const structuralGaps = componentFiles
    .filter((component) => !component.hasHtml || !component.hasScss)
    .map((component) => {
      const parts: string[] = [];
      if (!component.hasHtml) parts.push('missing html');
      if (!component.hasScss) parts.push('missing scss');
      return `${component.path} (${parts.join(', ')})`;
    });
  const testGaps = componentFiles
    .filter((component) => !component.hasSpec)
    .map((component) => component.specPath);

  const eslintThresholds = extractEslintThresholds(eslintConfig);
  const complexityViolations: Array<{
    path: string;
    complexity: number;
    threshold: number;
  }> = [];
  const maxLinesViolations: Array<{
    path: string;
    lines: number;
    threshold: number;
  }> = [];

  const tsFiles = sourceFiles.filter((file) => file.endsWith('.ts'));
  for (const filePath of tsFiles) {
    const text = safeRead(filePath);
    if (!text) continue;
    const lines = countLines(text);
    if (eslintThresholds.maxLines && lines > eslintThresholds.maxLines) {
      maxLinesViolations.push({
        path: filePath,
        lines,
        threshold: eslintThresholds.maxLines,
      });
    }
    if (eslintThresholds.complexity) {
      const complexity = estimateComplexity(text);
      if (complexity > eslintThresholds.complexity) {
        complexityViolations.push({
          path: filePath,
          complexity,
          threshold: eslintThresholds.complexity,
        });
      }
    }
  }

  const maxLinesScore =
    eslintThresholds.maxLines && tsFiles.length > 0
      ? Math.max(
          0,
          Math.round(100 - (maxLinesViolations.length / tsFiles.length) * 100)
        )
      : undefined;
  const complexityScore =
    eslintThresholds.complexity && tsFiles.length > 0
      ? Math.max(
          0,
          Math.round(100 - (complexityViolations.length / tsFiles.length) * 100)
        )
      : undefined;
  const scoreParts = [maxLinesScore, complexityScore].filter(
    (score): score is number => typeof score === 'number'
  );
  const overallScore =
    scoreParts.length > 0
      ? Math.round(
          scoreParts.reduce((sum, score) => sum + score, 0) / scoreParts.length
        )
      : undefined;

  const dependencyScan = scanDependencies(basePath, sourceFiles);
  const securityFindings = scanSecurity(sourceFiles);

  const selectors = {
    holdTimer: calendarHtml.includes('app-hold-timer'),
    confirmationDialog: calendarHtml.includes('app-confirmation-dialog'),
    cancellationForm: calendarHtml.includes('app-cancellation-form'),
  };

  const imports = {
    holdTimer:
      calendarTs.includes('HoldTimerComponent') ||
      calendarTs.includes('hold-timer.component'),
    confirmationDialog:
      calendarTs.includes('ConfirmationDialogComponent') ||
      calendarTs.includes('confirmation-dialog.component'),
    cancellationForm:
      calendarTs.includes('CancellationFormComponent') ||
      calendarTs.includes('cancellation-form.component'),
  };

  const actions = {
    confirm: calendarTs.includes('confirmBooking('),
    cancel: calendarTs.includes('cancelBooking('),
    markPaid: calendarTs.includes('markPaid('),
  };

  // LEGACY: Keep hardcoded testSignals for backwards compatibility
  const testSignals = {
    bookingCalendar: {
      path: specPathFor(paths.bookingCalendarTs),
      exists: existsSync(specPathFor(paths.bookingCalendarTs)),
    },
    bookingList: {
      path: specPathFor(paths.bookingListTs),
      exists: existsSync(specPathFor(paths.bookingListTs)),
    },
    bookingPreview: {
      path: specPathFor(paths.bookingPreviewTs),
      exists: existsSync(specPathFor(paths.bookingPreviewTs)),
    },
    holdTimer: {
      path: specPathFor(paths.holdTimerComponent),
      exists: existsSync(specPathFor(paths.holdTimerComponent)),
    },
    confirmationDialog: {
      path: specPathFor(paths.confirmationDialogComponent),
      exists: existsSync(specPathFor(paths.confirmationDialogComponent)),
    },
    cancellationForm: {
      path: specPathFor(paths.cancellationFormComponent),
      exists: existsSync(specPathFor(paths.cancellationFormComponent)),
    },
  };

  // SCALABLE: Dynamic test signals for all discovered features
  const featureTestSignals: Record<
    string,
    { path: string; exists: boolean; testCount: number }
  > = {};
  for (const feature of discoveredFeatures) {
    const mainTsPath = featurePaths[feature.name]?.mainTs;
    if (mainTsPath) {
      const specPath = specPathFor(mainTsPath);
      featureTestSignals[feature.name] = {
        path: specPath,
        exists: existsSync(specPath),
        testCount: feature.tests.length,
      };
    }
  }

  return {
    basePath,
    paths,
    features,
    sharedComponents,
    docs: {
      designSystem: existsSync(paths.designSystemDoc),
      designRtl: existsSync(paths.designRtlDoc),
      designAccessibility: existsSync(paths.designAccessibilityDoc),
      architecture: existsSync(paths.architectureDoc),
    },
    routing: {
      appRoutesPath: paths.appRoutes,
      appRoutesExists: existsSync(paths.appRoutes),
      appRoutesText,
    },
    calendar: {
      htmlExists: calendarHtmlExists,
      tsExists: calendarTsExists,
      selectors,
      imports,
      actions,
      hasHoldUntil: calendarTs.includes('holdUntil'),
      hasDialogState:
        calendarTs.includes('actionDialog') ||
        calendarTs.includes('dialogState'),
    },
    components: {
      holdTimer: existsSync(paths.holdTimerComponent),
      confirmationDialog: existsSync(paths.confirmationDialogComponent),
      cancellationForm: existsSync(paths.cancellationFormComponent),
    },
    store: {
      exists: existsSync(paths.bookingStore),
      usesSignals:
        storeTs.includes('@ngrx/signals') || storeTs.includes('signalStore'),
      hasCancellationReason: storeTs.includes('cancellationReason'),
      hasDialogState:
        storeTs.includes('actionDialog') || storeTs.includes('dialogState'),
    },
    calendarComponents,
    testSignals,
    // SCALABLE: Dynamic feature data
    discoveredFeatures,
    featurePaths,
    featureTestSignals,
    qualitySignals: {
      bookingCalendarTsLines: countLines(calendarTs),
      bookingCalendarHtmlLines: countLines(calendarHtml),
      bookingCalendarTodos: countMatches(calendarTs, /\b(TODO|FIXME|HACK)\b/g),
      bookingCalendarConsoleLogs: countMatches(calendarTs, /console\.log/g),
    },
    architectureMentionsDialogState:
      architectureDoc.includes('dialog state') ||
      architectureDoc.includes('dialogState'),
    componentFiles,
    structuralGaps,
    testGaps,
    dependencyScan,
    securityFindings,
    eslintThresholds,
    featureScans,
    featureIndex,
    qualitySummary: {
      complexityScore,
      maxLinesScore,
      overallScore,
      complexityViolations: complexityViolations.slice(0, 10),
      maxLinesViolations: maxLinesViolations.slice(0, 10),
    },
  };
};

const formatList = (items: string[]): string =>
  items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- (none)';

const formatRecordList = (record: Record<string, string[]>): string[] => {
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, values]) =>
        `${key}: ${values.length > 0 ? values.join(', ') : '(none)'}`
    );
};

type GapSeverity = 'critical' | 'minor';

const GAP_SEVERITY_LABELS: Record<GapSeverity, string> = {
  critical: 'CRITICAL',
  minor: 'MINOR',
};

const formatGap = (severity: GapSeverity, message: string): string =>
  `${GAP_SEVERITY_LABELS[severity]}: ${message}`;

const addGap = (
  gaps: string[],
  severity: GapSeverity,
  message: string
): void => {
  gaps.push(formatGap(severity, message));
};

const parseGapSeverity = (gap: string): GapSeverity | 'unknown' => {
  if (gap.startsWith('CRITICAL:')) return 'critical';
  if (gap.startsWith('MINOR:')) return 'minor';
  return 'unknown';
};

const countIntegrationGapsBySeverity = (
  gaps: string[]
): {
  critical: number;
  minor: number;
  unknown: number;
} => {
  return gaps.reduce(
    (acc, gap) => {
      const severity = parseGapSeverity(gap);
      acc[severity] += 1;
      return acc;
    },
    { critical: 0, minor: 0, unknown: 0 }
  );
};

const summarizeIntegrationGaps = (gaps: string[]): string => {
  if (gaps.length === 0) return '0';
  const counts = countIntegrationGapsBySeverity(gaps);
  const parts: string[] = [];
  if (counts.critical) parts.push(`critical ${counts.critical}`);
  if (counts.minor) parts.push(`minor ${counts.minor}`);
  if (counts.unknown) parts.push(`unclassified ${counts.unknown}`);
  return `${gaps.length} (${parts.join(', ')})`;
};

const matchesAny = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const collectFeatureContent = (
  feature: FeatureScan
): { ts: string; html: string; combined: string } => {
  const tsParts: string[] = [];
  const htmlParts: string[] = [];
  const seenTs = new Set<string>();
  const seenHtml = new Set<string>();

  const addTs = (path: string): void => {
    if (seenTs.has(path)) return;
    const text = safeRead(path);
    if (text) tsParts.push(text);
    seenTs.add(path);
  };

  const addHtml = (path: string): void => {
    if (seenHtml.has(path)) return;
    const text = safeRead(path);
    if (text) htmlParts.push(text);
    seenHtml.add(path);
  };

  for (const component of feature.componentFiles) {
    addTs(component.path);
    if (component.hasHtml) {
      addHtml(component.htmlPath);
    }
  }

  for (const tsPath of feature.tsFiles) {
    addTs(tsPath);
  }

  for (const htmlPath of feature.htmlFiles) {
    addHtml(htmlPath);
  }

  const ts = tsParts.join('\n');
  const html = htmlParts.join('\n');
  return { ts, html, combined: `${ts}\n${html}`.trim() };
};

const ERROR_HANDLING_PATTERNS = [
  /catchError\s*\(/i,
  /\.catch\s*\(/i,
  /\btry\b[\s\S]*?\bcatch\b/i,
  /subscribe\s*\(\s*\{[\s\S]*?\berror\s*:/i,
  /\berror\s*\(\)/i,
  /\berror\b\s*=\s*signal\s*\(/i,
];

const LOADING_STATE_PATTERNS = [
  /\bloading\b\s*=\s*signal\s*\(/i,
  /\bisLoading\b/i,
  /\bloading\$\b/i,
  /\bloading\s*\(\)/i,
  /\baria-busy\b/i,
  /\bLoading\b/i,
];

const LIST_RENDER_PATTERNS = [
  /@for\s*\(/i,
  /\*ngFor\b/i,
  /<table\b/i,
  /<ul\b/i,
  /<ol\b/i,
];

const EMPTY_STATE_PATTERNS = [
  /length\s*===\s*0/i,
  /length\s*==\s*0/i,
  /\bno\s+\w+\s+found\b/i,
  /\bempty\s+state\b/i,
];

const FORM_PATTERNS = [
  /<form\b/i,
  /\bFormGroup\b/i,
  /\bformControlName\b/i,
  /\bngForm\b/i,
];

const FORM_VALIDATION_PATTERNS = [
  /\brequired\b/i,
  /\bminlength\b/i,
  /\bmaxlength\b/i,
  /\bpattern\b/i,
  /\bValidators?\b/i,
];

const yesNo = (value: boolean): string => (value ? 'yes' : 'no');

const buildIntegrationGaps = (scan: ProjectScan): string[] => {
  const gaps: string[] = [];
  const htmlPath = scan.paths.bookingCalendarHtml;
  const tsPath = scan.paths.bookingCalendarTs;

  if (scan.calendar.selectors.holdTimer && !scan.components.holdTimer) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-hold-timer but component is missing (${scan.paths.holdTimerComponent}).`
    );
  }
  if (scan.calendar.selectors.holdTimer && !scan.calendar.imports.holdTimer) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-hold-timer but booking-calendar.component.ts does not import HoldTimerComponent (${tsPath}).`
    );
  }
  if (!scan.calendar.selectors.holdTimer && scan.components.holdTimer) {
    addGap(
      gaps,
      'minor',
      `Hold timer component exists but is not referenced in booking-calendar.component.html (${htmlPath}).`
    );
  }

  if (
    scan.calendar.selectors.confirmationDialog &&
    !scan.components.confirmationDialog
  ) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-confirmation-dialog but component is missing (${scan.paths.confirmationDialogComponent}).`
    );
  }
  if (
    scan.calendar.selectors.confirmationDialog &&
    !scan.calendar.imports.confirmationDialog
  ) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-confirmation-dialog but booking-calendar.component.ts does not import ConfirmationDialogComponent (${tsPath}).`
    );
  }
  if (
    !scan.calendar.selectors.confirmationDialog &&
    scan.components.confirmationDialog
  ) {
    addGap(
      gaps,
      'minor',
      `Confirmation dialog component exists but is not referenced in booking-calendar.component.html (${htmlPath}).`
    );
  }

  if (
    scan.calendar.selectors.cancellationForm &&
    !scan.components.cancellationForm
  ) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-cancellation-form but component is missing (${scan.paths.cancellationFormComponent}).`
    );
  }
  if (
    scan.calendar.selectors.cancellationForm &&
    !scan.calendar.imports.cancellationForm
  ) {
    addGap(
      gaps,
      'critical',
      `Calendar HTML uses app-cancellation-form but booking-calendar.component.ts does not import CancellationFormComponent (${tsPath}).`
    );
  }
  if (
    !scan.calendar.selectors.cancellationForm &&
    scan.components.cancellationForm
  ) {
    addGap(
      gaps,
      'minor',
      `Cancellation form component exists but is not referenced in booking-calendar.component.html (${htmlPath}).`
    );
  }

  if (
    scan.calendar.selectors.cancellationForm &&
    !scan.store.hasCancellationReason
  ) {
    addGap(
      gaps,
      'critical',
      `Cancellation form is present but booking.store.ts does not reference cancellationReason (${scan.paths.bookingStore}).`
    );
  }

  // SCALABLE: Iterate over ALL dynamically discovered features
  for (const feature of scan.featureScans) {
    const featureName = feature.name;

    const content = collectFeatureContent(feature);
    const combined = content.combined;

    const hasErrorHandling = matchesAny(combined, ERROR_HANDLING_PATTERNS);
    if (!hasErrorHandling) {
      addGap(
        gaps,
        'critical',
        `Missing error handling patterns in ${featureName} (catchError, try/catch, or subscribe error handler).`
      );
    }

    const hasLoadingState = matchesAny(combined, LOADING_STATE_PATTERNS);
    if (!hasLoadingState) {
      addGap(
        gaps,
        'minor',
        `Missing loading state patterns in ${featureName} (loading$, isLoading, or loading indicator).`
      );
    }

    const hasListRendering = matchesAny(content.html, LIST_RENDER_PATTERNS);
    const hasEmptyState = matchesAny(content.html, EMPTY_STATE_PATTERNS);
    if (hasListRendering && !hasEmptyState) {
      addGap(
        gaps,
        'minor',
        `Missing empty state handling in ${featureName} templates (no length === 0 check).`
      );
    }

    const hasForm = matchesAny(combined, FORM_PATTERNS);
    const hasValidation = matchesAny(combined, FORM_VALIDATION_PATTERNS);
    if (hasForm && !hasValidation) {
      addGap(
        gaps,
        'critical',
        `Missing form validation patterns in ${featureName} (required, minlength, pattern, or Validators).`
      );
    }
  }

  return gaps;
};

const buildStructuralGaps = (scan: ProjectScan): string[] => {
  return scan.structuralGaps.map((gap) => `Component structure gap: ${gap}`);
};

/**
 * Build architecture notes that VALIDATE against ADR-0001 state ownership rules.
 *
 * Per ADR-0001 (docs/authoritative/decisions/ADR-0001-state-ownership.md):
 * - Store owns: data state (bookings, loading, error, per-item action state)
 * - Components own: UI state (dialogs, selection, pagination, search, filters)
 *
 * This function validates that the codebase FOLLOWS these rules, not violates them.
 */
const buildArchitectureNotes = (scan: ProjectScan): string[] => {
  const notes: string[] = [];

  // ADR-0001 COMPLIANCE CHECK: Dialog state in components is CORRECT architecture
  if (scan.calendar.hasDialogState && !scan.store.hasDialogState) {
    // This is CORRECT per ADR-0001: "Components own UI state (dialogs, selection, ...)"
    notes.push(
      `✅ ADR-0001 COMPLIANT: Dialog/UI state correctly placed in component, not in store. ` +
        `Per ADR-0001, components own UI state (dialogs, selection, pagination).`
    );
  }

  // ADR-0001 VIOLATION CHECK: Dialog state in store would be incorrect
  if (scan.store.hasDialogState) {
    notes.push(
      `⚠️ ADR-0001 REVIEW: Dialog state detected in BookingStore (${scan.paths.bookingStore}). ` +
        `Per ADR-0001, UI state (dialogs) should be in components, not store. ` +
        `Review if this is data-driven dialog state or UI-only state.`
    );
  }

  // Store signals usage validation
  if (scan.store.exists && !scan.store.usesSignals) {
    notes.push(
      `⚠️ Store exists but does not use @ngrx/signals. ` +
        `Per docs/authoritative/engineering/frontend-angular.md, stores should use signalStore.`
    );
  }

  return notes;
};

const buildTestGaps = (scan: ProjectScan): string[] => {
  const gaps: string[] = [];

  // Missing test files
  for (const path of scan.testGaps) {
    gaps.push(`Missing test file: ${path}`);
  }

  // Low coverage features (spec exists but insufficient tests)
  const MIN_TESTS_PER_FEATURE = 10;
  const MIN_TEST_DEPTH_RATIO = 0.3; // 30% of testable elements should have tests

  for (const feature of scan.featureScans) {
    let totalTests = 0;
    let totalTestableElements = 0;

    for (const component of feature.componentFiles) {
      if (component.hasSpec) {
        const analysis = analyzeTestFile(component.specPath);
        totalTests += analysis.testCount;
      }
      totalTestableElements += estimateTestableElements(component.path);
    }

    const testDepthRatio =
      totalTestableElements > 0 ? totalTests / totalTestableElements : 0;

    if (totalTests < MIN_TESTS_PER_FEATURE && totalTests > 0) {
      gaps.push(
        `Low test coverage in ${
          feature.name
        }: ${totalTests} tests (need ${MIN_TESTS_PER_FEATURE}+, depth ${(
          testDepthRatio * 100
        ).toFixed(0)}%)`
      );
    } else if (testDepthRatio < MIN_TEST_DEPTH_RATIO && totalTests > 0) {
      gaps.push(
        `Insufficient test depth in ${feature.name}: ${(
          testDepthRatio * 100
        ).toFixed(0)}% (need ${MIN_TEST_DEPTH_RATIO * 100}%+)`
      );
    }
  }

  return gaps;
};

const buildQualityNotes = (scan: ProjectScan): string[] => {
  const notes: string[] = [];

  if (!scan.eslintThresholds.maxLines && !scan.eslintThresholds.complexity) {
    notes.push(
      'No ESLint max-lines/complexity rules detected; scoring unavailable.'
    );
    return notes;
  }

  if (typeof scan.qualitySummary.overallScore === 'number') {
    notes.push(
      `Quality score: ${scan.qualitySummary.overallScore}/100 (max-lines: ${
        scan.qualitySummary.maxLinesScore ?? 'n/a'
      }, complexity: ${scan.qualitySummary.complexityScore ?? 'n/a'}).`
    );
  }

  if (scan.qualitySummary.maxLinesViolations.length > 0) {
    for (const item of scan.qualitySummary.maxLinesViolations) {
      notes.push(
        `${item.path} is ${item.lines} lines (max-lines ${item.threshold}).`
      );
    }
  }

  if (scan.qualitySummary.complexityViolations.length > 0) {
    for (const item of scan.qualitySummary.complexityViolations) {
      notes.push(
        `${item.path} estimated complexity ${item.complexity} (complexity ${item.threshold}).`
      );
    }
  }

  return notes;
};

const buildMissingItems = (scan: ProjectScan): string[] => {
  const missing: string[] = [];

  if (!scan.components.holdTimer) {
    missing.push(
      `Missing hold timer component (${scan.paths.holdTimerComponent}).`
    );
  }
  if (!scan.components.confirmationDialog) {
    missing.push(
      `Missing confirmation dialog component (${scan.paths.confirmationDialogComponent}).`
    );
  }
  if (!scan.components.cancellationForm) {
    missing.push(
      `Missing cancellation form component (${scan.paths.cancellationFormComponent}).`
    );
  }
  if (!scan.calendar.htmlExists) {
    missing.push(
      `booking-calendar.component.html not found (${scan.paths.bookingCalendarHtml}).`
    );
  }
  if (!scan.calendar.tsExists) {
    missing.push(
      `booking-calendar.component.ts not found (${scan.paths.bookingCalendarTs}).`
    );
  }
  if (!scan.store.exists) {
    missing.push(`BookingStore not found (${scan.paths.bookingStore}).`);
  }

  return missing;
};

const clampScore = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const interpretCompletenessScore = (score: number): string => {
  if (score >= 90) return 'Production-ready, no work needed';
  if (score >= 75) return 'Minor improvements needed';
  if (score >= 60) return 'Needs polishing and testing';
  if (score >= 45) return 'Significant work required';
  return 'Major rework or incomplete';
};

const extractComponentSelectors = (html: string): string[] => {
  const selectors: string[] = [];
  const regex = /<\s*app-([a-z0-9-]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) selectors.push(match[1]);
  }
  return selectors;
};

const scoreImplementationStatus = (
  feature: FeatureScan,
  scan: ProjectScan
): ScoreDetail => {
  const details: string[] = [];
  const componentCount = feature.componentFiles.length;
  const htmlCount = feature.componentFiles.filter(
    (component) => component.hasHtml
  ).length;
  const scssCount = feature.componentFiles.filter(
    (component) => component.hasScss
  ).length;
  const htmlRatio = componentCount > 0 ? htmlCount / componentCount : 0;
  const scssRatio = componentCount > 0 ? scssCount / componentCount : 0;
  const mainComponent = feature.mainComponent;
  const hasMainHtml = mainComponent?.hasHtml ?? false;

  details.push(`Components: ${componentCount}`);
  details.push(`HTML coverage: ${htmlCount}/${componentCount || 0}`);
  details.push(`SCSS coverage: ${scssCount}/${componentCount || 0}`);
  details.push(
    `Main component: ${mainComponent ? mainComponent.path : 'not detected'}`
  );

  if (componentCount === 0) {
    return { score: 0, details: [...details, 'No component files detected.'] };
  }

  let score = 10;
  if (mainComponent && hasMainHtml) {
    score = 20;
    if (componentCount > 1 && htmlRatio >= 0.9 && scssRatio >= 0.9) {
      score = 25;
    }
  } else if (htmlRatio >= 0.5) {
    score = 15;
  }

  if (feature.mdFiles.length === 0 && score > 0) {
    score = Math.max(0, score - 5);
    details.push('No README or feature docs detected.');
  } else if (feature.mdFiles.length > 0) {
    details.push(`Docs found: ${feature.mdFiles.length} markdown file(s).`);
  }

  if (scan.routing.appRoutesExists) {
    const referencedInRoutes = scan.routing.appRoutesText.includes(
      `features/${feature.name}/`
    );
    details.push(
      referencedInRoutes
        ? 'Feature route detected.'
        : 'Feature route not detected.'
    );
    if (!referencedInRoutes) {
      score = Math.max(0, score - 5);
    }
  } else {
    details.push('Routing file not found; export checks skipped.');
  }

  const missingSelectors = new Set<string>();
  const featureComponents = new Set(
    feature.componentFiles.map((component) =>
      basename(component.path).replace('.component.ts', '')
    )
  );
  for (const htmlPath of feature.htmlFiles) {
    const html = safeRead(htmlPath);
    if (!html) continue;
    for (const selector of extractComponentSelectors(html)) {
      if (featureComponents.has(selector)) continue;
      if (scan.sharedComponents.includes(selector)) continue;
      missingSelectors.add(selector);
    }
  }

  if (missingSelectors.size > 0) {
    score = Math.max(0, score - 5);
    details.push(
      `Template references missing components: ${Array.from(
        missingSelectors
      ).join(', ')}.`
    );
  }

  return {
    score,
    details,
    confidence: 'PATTERN-BASED',
    source: 'File system scan + template analysis',
  };
};

/**
 * Analyzes test file content to count actual test cases.
 */
const analyzeTestFile = (
  specPath: string
): { testCount: number; lines: number; assertions: number } => {
  const text = safeRead(specPath);
  if (!text) return { testCount: 0, lines: 0, assertions: 0 };

  // Count test cases: it(), test(), xit(), xtest()
  const testPatterns = [
    /\bit\s*\(/g,
    /\btest\s*\(/g,
    /\bxit\s*\(/g,
    /\bxtest\s*\(/g,
  ];
  let testCount = 0;
  for (const pattern of testPatterns) {
    testCount += countMatches(text, pattern);
  }

  // Count assertions: expect(), assert*, should*
  const assertionPatterns = [
    /\bexpect\s*\(/g,
    /\bassert\w*\s*\(/g,
    /\.should\b/g,
  ];
  let assertions = 0;
  for (const pattern of assertionPatterns) {
    assertions += countMatches(text, pattern);
  }

  return {
    testCount,
    lines: countLines(text),
    assertions,
  };
};

/**
 * Estimates testable functions in a component.
 */
const estimateTestableElements = (tsPath: string): number => {
  const text = safeRead(tsPath);
  if (!text) return 0;

  // Count public methods (simple heuristic)
  const methodPatterns = [
    /^\s+(?:public\s+)?(?!constructor|ngOnInit|ngOnDestroy|ngOnChanges)\w+\s*\([^)]*\)\s*[:{]/gm,
    /^\s+on\w+\s*\([^)]*\)\s*[:{]/gm, // Event handlers (onSubmit, onClick, etc.)
    /^\s+handle\w+\s*\([^)]*\)\s*[:{]/gm, // Handle methods
    /^\s+get\s+\w+\s*\(/gm, // Getters
  ];

  let count = 0;
  for (const pattern of methodPatterns) {
    count += countMatches(text, pattern);
  }

  // Add computed signals (Angular signals pattern)
  count += countMatches(text, /\bcomputed\s*\(/g);

  return Math.max(1, count); // At least 1 testable element
};

const scoreTestCoverage = (feature: FeatureScan): ScoreDetail => {
  const details: string[] = [];
  const componentCount = feature.componentFiles.length;
  const specCount = feature.componentFiles.filter(
    (component) => component.hasSpec
  ).length;
  const specRatio = componentCount > 0 ? specCount / componentCount : 0;

  details.push(
    `Spec files: ${specCount}/${componentCount} (${Math.round(
      specRatio * 100
    )}% coverage)`
  );

  if (componentCount === 0) {
    return {
      score: 0,
      details: [...details, 'No components detected.'],
      confidence: 'PATTERN-BASED',
      source: 'Spec file detection (presence only)',
    };
  }
  if (specCount === 0) {
    return {
      score: 0,
      details: [...details, 'No test files detected.'],
      confidence: 'PATTERN-BASED',
      source: 'Spec file detection (presence only)',
    };
  }

  // Enhanced analysis: parse test file content
  let totalTests = 0;
  let totalAssertions = 0;
  let totalTestableElements = 0;
  let totalSpecLines = 0;
  let totalComponentLines = 0;

  for (const component of feature.componentFiles) {
    if (component.hasSpec) {
      const testAnalysis = analyzeTestFile(component.specPath);
      totalTests += testAnalysis.testCount;
      totalAssertions += testAnalysis.assertions;
      totalSpecLines += testAnalysis.lines;
    }
    const componentText = safeRead(component.path);
    if (componentText) {
      totalComponentLines += countLines(componentText);
      totalTestableElements += estimateTestableElements(component.path);
    }
  }

  details.push(`Test cases found: ${totalTests}`);
  details.push(`Assertions: ${totalAssertions}`);
  details.push(`Testable elements: ~${totalTestableElements}`);
  details.push(`Test LOC: ${totalSpecLines}`);
  details.push(`Component LOC: ${totalComponentLines}`);

  // Calculate test depth ratio (tests per testable element)
  const testDepthRatio =
    totalTestableElements > 0 ? totalTests / totalTestableElements : 0;

  // Calculate test-to-code ratio (rough proxy for coverage)
  const testCodeRatio =
    totalComponentLines > 0 ? totalSpecLines / totalComponentLines : 0;

  details.push(
    `Test depth: ${(testDepthRatio * 100).toFixed(0)}% (tests/testable)`
  );
  details.push(`Test-to-code ratio: ${(testCodeRatio * 100).toFixed(0)}%`);

  // Score based on test depth (more nuanced than file existence)
  let score = 5;

  // Test depth scoring (0-15 points)
  if (testDepthRatio >= 2.0) score += 15; // 2+ tests per testable element
  else if (testDepthRatio >= 1.0) score += 12; // 1+ test per testable element
  else if (testDepthRatio >= 0.5) score += 8; // 0.5+ tests per testable element
  else if (testDepthRatio >= 0.25) score += 4; // Some tests
  else score += 1; // Minimal tests

  // File coverage bonus (0-5 points)
  if (specRatio >= 0.9) score += 5;
  else if (specRatio >= 0.7) score += 3;
  else if (specRatio >= 0.5) score += 2;
  else score += 1;

  // Assertions per test bonus (0-5 points)
  const assertionsPerTest = totalTests > 0 ? totalAssertions / totalTests : 0;
  if (assertionsPerTest >= 3) score += 5;
  else if (assertionsPerTest >= 2) score += 3;
  else if (assertionsPerTest >= 1) score += 2;

  score = Math.min(25, score);

  // Add recommendation if coverage is low
  if (testDepthRatio < 0.5) {
    details.push(
      'NOTE: Test coverage is LOW. Consider adding more test cases for critical paths.'
    );
  }

  return {
    score,
    details,
    confidence: 'ESTIMATED',
    source: 'Test content analysis (it/test/expect counting)',
  };
};

const scoreAccessibility = (feature: FeatureScan): ScoreDetail => {
  const details: string[] = [];
  const totalHtml = feature.htmlFiles.length;
  if (totalHtml === 0) {
    return { score: 0, details: ['No HTML templates detected.'] };
  }

  const a11yMarkers = [
    /\baria-/i,
    /\brole=/i,
    /\btabindex=/i,
    /\bcdkTrapFocus\b/i,
    /\bcdkFocusInitial\b/i,
    /skip[- ]?link/i,
    /href=['"]#(main|content)['"]/i,
  ];
  const keyboardMarkers = [/\(keydown/gi, /\(keyup/gi, /\(keypress/gi];
  let filesWithA11y = 0;
  let filesWithKeyboard = 0;

  for (const htmlPath of feature.htmlFiles) {
    const html = safeRead(htmlPath);
    if (!html) continue;
    if (a11yMarkers.some((regex) => regex.test(html))) {
      filesWithA11y += 1;
    }
    if (keyboardMarkers.some((regex) => regex.test(html))) {
      filesWithKeyboard += 1;
    }
  }

  const ratio = totalHtml > 0 ? filesWithA11y / totalHtml : 0;
  details.push(`HTML files: ${totalHtml}`);
  details.push(`Files with a11y markers: ${filesWithA11y}`);
  details.push(`Files with keyboard handlers: ${filesWithKeyboard}`);

  let score = 0;
  if (ratio >= 0.9) score = 25;
  else if (ratio >= 0.7) score = 20;
  else if (ratio >= 0.5) score = 15;
  else if (ratio > 0) score = 10;

  // Add disclaimer that this is pattern-based, not actual a11y testing
  details.push(
    'NOTE: This is accessibility pattern detection, NOT a WCAG audit.'
  );
  details.push(
    'Verify focus rings, keyboard navigation, and skip links manually.'
  );

  return {
    score,
    details,
    confidence: 'PATTERN-BASED',
    source: 'Accessibility marker detection (aria/keyboard/skip-link)',
  };
};

const scoreCodeQuality = (
  feature: FeatureScan,
  eslintThresholds: ESLintThresholds,
  validation?: ValidationResults | null
): ScoreDetail => {
  const details: string[] = [];
  const tsFiles = feature.tsFiles;
  if (tsFiles.length === 0) {
    return { score: 0, details: ['No TypeScript files detected.'] };
  }

  // If validation results are available, use them
  if (validation) {
    details.push('=== VALIDATED RESULTS ===');
    details.push(`ESLint: ${validation.eslint.passed ? 'PASSED' : 'FAILED'}`);
    details.push(...validation.eslint.details);
    details.push(
      `TypeScript: ${validation.typescript.passed ? 'PASSED' : 'FAILED'}`
    );
    details.push(...validation.typescript.details);

    return {
      score: validation.overall.score,
      details,
      confidence: 'VALIDATED' as ConfidenceLevel,
      source: 'ESLint + TypeScript validation',
    };
  }

  // Fallback to estimation if no validation
  const complexities: number[] = [];
  let todoCount = 0;
  let maxLines = 0;

  for (const filePath of tsFiles) {
    const text = safeRead(filePath);
    if (!text) continue;
    complexities.push(estimateComplexity(text));
    todoCount += countMatches(text, /\b(TODO|FIXME|HACK)\b/g);
    maxLines = Math.max(maxLines, countLines(text));
  }

  const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;
  let score = 10;
  if (maxComplexity <= 5) score = 25;
  else if (maxComplexity <= 10) score = 20;
  else if (maxComplexity <= 15) score = 15;

  if (
    eslintThresholds.complexity &&
    maxComplexity > eslintThresholds.complexity
  ) {
    score = Math.max(0, score - 5);
    details.push(
      `Complexity exceeds ESLint threshold (${maxComplexity}/${eslintThresholds.complexity}).`
    );
  }

  if (todoCount > 3) {
    score = Math.max(0, score - 5);
    details.push(`TODO/FIXME count high (${todoCount}).`);
  }

  details.push(`Max complexity: ${maxComplexity}`);
  details.push(`Max lines: ${maxLines}`);
  details.push(`TODO/FIXME count: ${todoCount}`);

  // Add disclaimer about estimation method
  details.push(
    'NOTE: Complexity estimated via regex (not AST). Run with --validate for accurate analysis.'
  );

  return {
    score: clampScore(score, 0, 25),
    details,
    confidence: 'ESTIMATED',
    source: 'Regex-based complexity estimation + TODO counting',
  };
};

const analyzeFeatureCompleteness = (
  scan: ProjectScan
): FeatureCompletenessScore[] => {
  const shouldValidate = process.env.KHANA_VALIDATE === 'true';
  return scan.featureScans.map((feature) => {
    const implementation = scoreImplementationStatus(feature, scan);
    const testCoverage = scoreTestCoverage(feature);
    const accessibility = scoreAccessibility(feature);
    const validation = getValidationResults(feature, shouldValidate);
    const codeQuality = scoreCodeQuality(
      feature,
      scan.eslintThresholds,
      validation
    );
    const total = clampScore(
      implementation.score +
        testCoverage.score +
        accessibility.score +
        codeQuality.score,
      0,
      100
    );
    const notes: string[] = [];
    if (feature.mdFiles.length === 0) notes.push('No feature docs detected.');
    if (feature.specFiles.length === 0) notes.push('No spec files detected.');

    return {
      feature: feature.name,
      implementation,
      testCoverage,
      accessibility,
      codeQuality,
      total,
      interpretation: interpretCompletenessScore(total),
      notes,
    };
  });
};

const analyzeTestCoverage = (scan: ProjectScan): TestCoverageReport[] => {
  return scan.featureScans.map((feature) => {
    const componentCount = feature.componentFiles.length;
    const specCount = feature.componentFiles.filter(
      (component) => component.hasSpec
    ).length;
    const ratio = componentCount > 0 ? specCount / componentCount : 0;
    const score = scoreTestCoverage(feature).score;
    return {
      feature: feature.name,
      componentCount,
      specCount,
      ratio,
      score,
    };
  });
};

const extractImportsFromText = (text: string): string[] => {
  const imports: string[] = [];
  const importRegex =
    /\bfrom\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(text)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw) imports.push(raw);
  }
  return imports;
};

const analyzeDependencies = (scan: ProjectScan): DependencyAnalysis => {
  const featureNames = scan.featureScans.map((feature) => feature.name);
  const featureSet = new Set(featureNames);
  const dependencies: Record<string, Set<string>> = {};
  const missingDependencies: Record<string, Set<string>> = {};
  const dependents: Record<string, Set<string>> = {};
  const sharedUsage: Record<string, string[]> = {};
  const storeDependents = new Set<string>();

  for (const feature of scan.featureScans) {
    dependencies[feature.name] = new Set();
    missingDependencies[feature.name] = new Set();

    for (const filePath of feature.tsFiles) {
      const text = safeRead(filePath);
      if (!text) continue;
      const imports = extractImportsFromText(text);
      for (const raw of imports) {
        if (
          raw.includes('state/bookings') ||
          raw.includes('booking.store') ||
          text.includes('BookingStore')
        ) {
          storeDependents.add(feature.name);
        }
        for (const candidate of featureNames) {
          if (candidate === feature.name) continue;
          if (raw.includes(candidate)) {
            dependencies[feature.name].add(candidate);
          }
        }

        const featureMatch = raw.match(/features\/([^/'"]+)/);
        const featureMatchName = featureMatch?.[1];
        if (featureMatchName && !featureSet.has(featureMatchName)) {
          missingDependencies[feature.name].add(featureMatchName);
        }
      }
    }

    for (const htmlPath of feature.htmlFiles) {
      const html = safeRead(htmlPath);
      if (!html) continue;
      for (const sharedComponent of scan.sharedComponents) {
        const selector = `app-${sharedComponent}`;
        if (html.includes(selector)) {
          sharedUsage[sharedComponent] = sharedUsage[sharedComponent] || [];
          if (!sharedUsage[sharedComponent].includes(feature.name)) {
            sharedUsage[sharedComponent].push(feature.name);
          }
        }
      }
    }
  }

  for (const feature of featureNames) {
    dependents[feature] = new Set();
  }
  for (const [feature, deps] of Object.entries(dependencies)) {
    for (const dep of deps) {
      if (!dependents[dep]) dependents[dep] = new Set();
      dependents[dep].add(feature);
    }
  }

  const blocking = featureNames
    .filter((feature) => (dependents[feature]?.size ?? 0) > 0)
    .map(
      (feature) =>
        `${feature} (depended on by ${dependents[feature].size} feature(s))`
    );
  if (storeDependents.size > 1) {
    blocking.unshift(
      `BookingStore (used by ${storeDependents.size} feature(s))`
    );
  }

  const blocked = featureNames
    .filter((feature) => (missingDependencies[feature]?.size ?? 0) > 0)
    .map(
      (feature) =>
        `${feature} (missing: ${Array.from(missingDependencies[feature]).join(
          ', '
        )})`
    );

  const chains: string[] = [];
  for (const feature of featureNames) {
    const deps = Array.from(dependencies[feature] ?? []);
    for (const dep of deps) {
      const secondary = Array.from(dependencies[dep] ?? []);
      if (secondary.length > 0) {
        chains.push(`${feature} -> ${dep} -> ${secondary[0]}`);
      } else {
        chains.push(`${feature} -> ${dep}`);
      }
      if (chains.length >= 5) break;
    }
    if (chains.length >= 5) break;
  }

  const notes: string[] = [];
  const sharedNotes = Object.entries(sharedUsage).map(
    ([component, features]) => `${component} used by ${features.join(', ')}`
  );
  if (sharedNotes.length > 0) {
    notes.push(...sharedNotes);
  }
  if (storeDependents.size > 0) {
    notes.push(
      `BookingStore used by: ${Array.from(storeDependents).join(', ')}`
    );
  }

  const toRecord = (
    record: Record<string, Set<string>>
  ): Record<string, string[]> =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, Array.from(value)])
    );

  return {
    dependencies: toRecord(dependencies),
    missingDependencies: toRecord(missingDependencies),
    dependents: toRecord(dependents),
    blocking,
    blocked,
    chains,
    notes,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const loadJsonIfExists = (filePath: string): unknown | undefined => {
  if (!filePath || !existsSync(filePath)) return undefined;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
};

const normalizeRelativeScore = (value: number, maxValue: number): number => {
  if (!maxValue || maxValue <= 0) return 0;
  return clampScore(Math.round((value / maxValue) * 10), 0, 10);
};

const extractBusinessPriorityOverrides = (
  data: unknown
): Record<string, BusinessPriorityOverrides> => {
  const overrides: Record<string, BusinessPriorityOverrides> = {};
  if (!data) return overrides;

  const applyItem = (name: string, item: unknown) => {
    if (!name) return;
    if (typeof item === 'number') {
      overrides[name] = { priority: item };
      return;
    }
    if (!isRecord(item)) return;
    const priorityRaw = item.priority ?? item.rank ?? item.order;
    const userValueRaw = item.user_value ?? item.userValue;
    const businessValueRaw =
      item.business_value ?? item.businessImpact ?? item.business_value;
    const strategicRaw =
      item.strategic_value ?? item.strategicImportance ?? item.strategic;
    const requestsRaw =
      item.customer_requests ?? item.customerRequests ?? item.requests;
    const marketRaw =
      item.market_differentiation ?? item.marketDifferentiation ?? item.market;

    overrides[name] = {
      priority: typeof priorityRaw === 'number' ? priorityRaw : undefined,
      userValue: typeof userValueRaw === 'number' ? userValueRaw : undefined,
      businessImpact:
        typeof businessValueRaw === 'number' ? businessValueRaw : undefined,
      strategicImportance:
        typeof strategicRaw === 'number' ? strategicRaw : undefined,
      customerRequests:
        typeof requestsRaw === 'number' ? requestsRaw : undefined,
      marketDifferentiation:
        typeof marketRaw === 'number' ? marketRaw : undefined,
    };
  };

  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (typeof item === 'string') {
        applyItem(item, {});
        return;
      }
      if (!isRecord(item)) return;
      const name = item.feature ?? item.name ?? item.title;
      if (typeof name === 'string') {
        applyItem(name, item);
      }
    });
    return overrides;
  }

  if (isRecord(data)) {
    const features = data.features ?? data.items ?? data.roadmap;
    if (isRecord(features)) {
      Object.entries(features).forEach(([name, item]) => {
        applyItem(name, item);
      });
      return overrides;
    }
    if (Array.isArray(features)) {
      features.forEach((item) => {
        if (typeof item === 'string') {
          applyItem(item, {});
          return;
        }
        if (!isRecord(item)) return;
        const name = item.feature ?? item.name ?? item.title;
        if (typeof name === 'string') {
          applyItem(name, item);
        }
      });
    }
  }

  return overrides;
};

const analyzeBusinessValue = (
  scan: ProjectScan,
  config?: BusinessConfig
): BusinessValueScore[] => {
  const basePath = scan.basePath;
  const businessPriorityPath = join(basePath, 'business-priority.json');
  const roadmapPath = config?.roadmap
    ? join(basePath, config.roadmap)
    : join(basePath, 'feature-list.json');
  const requestPath = config?.customerRequests
    ? join(basePath, config.customerRequests)
    : join(basePath, 'issues.json');
  const revenuePath = config?.revenueImpact
    ? join(basePath, config.revenueImpact)
    : join(basePath, 'feature-revenue.json');

  const businessPriorityData = loadJsonIfExists(businessPriorityPath);
  const roadmapData = loadJsonIfExists(roadmapPath);
  const requestData = loadJsonIfExists(requestPath);
  const revenueData = loadJsonIfExists(revenuePath);
  const hasRealData = Boolean(
    businessPriorityData || roadmapData || requestData || revenueData
  );

  if (!hasRealData) {
    return [];
  }

  const roadmapItems: Array<{ name: string; priority: number }> = [];
  const requestItems: string[] = [];
  const revenueItems: Array<{ name: string; value: number }> = [];
  const priorityOverrides =
    extractBusinessPriorityOverrides(businessPriorityData);
  Object.entries(priorityOverrides).forEach(([name, override]) => {
    if (typeof override.priority === 'number') {
      roadmapItems.push({ name, priority: override.priority });
    }
  });

  const extractArray = (data: unknown): unknown[] => {
    if (Array.isArray(data)) return data;
    if (isRecord(data)) {
      const candidate =
        data.features ??
        data.roadmap ??
        data.items ??
        data.requests ??
        data.issues;
      return Array.isArray(candidate) ? candidate : [];
    }
    return [];
  };

  const roadmapList = extractArray(roadmapData);
  roadmapList.forEach((item, index) => {
    if (typeof item === 'string') {
      roadmapItems.push({ name: item, priority: index + 1 });
      return;
    }
    if (isRecord(item)) {
      const name = item.feature ?? item.name ?? item.title;
      const priorityRaw = item.priority ?? item.rank ?? index + 1;
      if (typeof name === 'string') {
        const priority = Number(priorityRaw);
        roadmapItems.push({
          name,
          priority: Number.isFinite(priority) ? priority : index + 1,
        });
      }
    }
  });

  const requestList = extractArray(requestData);
  requestList.forEach((item) => {
    if (typeof item === 'string') {
      requestItems.push(item);
      return;
    }
    if (isRecord(item)) {
      const name = item.feature ?? item.title ?? item.name;
      if (typeof name === 'string') requestItems.push(name);
    }
  });

  const revenueList = extractArray(revenueData);
  revenueList.forEach((item, index) => {
    if (isRecord(item)) {
      const name = item.feature ?? item.name ?? item.title;
      const valueRaw = item.revenue ?? item.value ?? item.impact;
      if (typeof name === 'string' && typeof valueRaw === 'number') {
        revenueItems.push({ name, value: valueRaw });
      }
    } else if (typeof item === 'string') {
      revenueItems.push({ name: item, value: revenueList.length - index });
    }
  });

  const roadmapMap = new Map(
    roadmapItems.map((item) => [item.name, item.priority])
  );
  const requestMap = new Map<string, number>();
  requestItems.forEach((item) => {
    requestMap.set(item, (requestMap.get(item) ?? 0) + 1);
  });
  const revenueMap = new Map(
    revenueItems.map((item) => [item.name, item.value])
  );

  const maxPriority = roadmapItems.reduce(
    (max, item) => Math.max(max, item.priority),
    0
  );
  const maxRequest = Array.from(requestMap.values()).reduce(
    (max, value) => Math.max(max, value),
    0
  );
  const maxRevenue = Array.from(revenueMap.values()).reduce(
    (max, value) => Math.max(max, value),
    0
  );

  const candidateFeatures = new Set<string>();
  Object.keys(priorityOverrides).forEach((name) => candidateFeatures.add(name));
  roadmapItems.forEach((item) => candidateFeatures.add(item.name));
  requestItems.forEach((item) => candidateFeatures.add(item));
  revenueItems.forEach((item) => candidateFeatures.add(item.name));
  const allCandidates = Array.from(candidateFeatures);

  return allCandidates.map((featureName) => {
    const notes: string[] = [];
    const overrides = priorityOverrides[featureName];

    const userValue =
      typeof overrides?.userValue === 'number'
        ? overrides.userValue
        : undefined;
    let businessImpact =
      typeof overrides?.businessImpact === 'number'
        ? overrides.businessImpact
        : undefined;
    let strategicImportance =
      typeof overrides?.strategicImportance === 'number'
        ? overrides.strategicImportance
        : undefined;
    let customerRequests =
      typeof overrides?.customerRequests === 'number'
        ? overrides.customerRequests
        : undefined;
    const marketDifferentiation =
      typeof overrides?.marketDifferentiation === 'number'
        ? overrides.marketDifferentiation
        : undefined;

    if (userValue !== undefined) {
      notes.push(`User value override detected (${userValue}).`);
    }
    if (businessImpact !== undefined) {
      notes.push(`Business impact override detected (${businessImpact}).`);
    }
    if (strategicImportance !== undefined) {
      notes.push(
        `Strategic importance override detected (${strategicImportance}).`
      );
    }
    if (customerRequests !== undefined) {
      notes.push(`Customer request override detected (${customerRequests}).`);
    }
    if (marketDifferentiation !== undefined) {
      notes.push(
        `Market differentiation override detected (${marketDifferentiation}).`
      );
    }

    const rawPriority = roadmapMap.get(featureName);
    if (rawPriority !== undefined && maxPriority > 0) {
      const strategic = clampScore(
        Math.round(10 - ((rawPriority - 1) / Math.max(1, maxPriority - 1)) * 9),
        1,
        10
      );
      if (strategicImportance === undefined) {
        strategicImportance = strategic;
        notes.push(
          `Roadmap priority detected (${rawPriority}/${maxPriority}).`
        );
      } else {
        notes.push(
          `Roadmap priority detected (${rawPriority}/${maxPriority}); strategic importance override preserved (${strategicImportance}).`
        );
      }
    }

    const requestCount = requestMap.get(featureName);
    if (requestCount !== undefined && maxRequest > 0) {
      const derivedRequests = normalizeRelativeScore(requestCount, maxRequest);
      if (customerRequests === undefined) {
        customerRequests = derivedRequests;
      }
      notes.push(`Customer request count detected (${requestCount}).`);
    }

    const revenueValue = revenueMap.get(featureName);
    if (revenueValue !== undefined && maxRevenue > 0) {
      const derivedImpact = normalizeRelativeScore(revenueValue, maxRevenue);
      if (businessImpact === undefined) {
        businessImpact = derivedImpact;
      }
      notes.push(`Revenue impact detected (${revenueValue}).`);
    }

    const missingFields: string[] = [];
    if (userValue === undefined) missingFields.push('userValue');
    if (businessImpact === undefined) missingFields.push('businessImpact');
    if (strategicImportance === undefined)
      missingFields.push('strategicImportance');
    if (customerRequests === undefined) missingFields.push('customerRequests');
    if (marketDifferentiation === undefined)
      missingFields.push('marketDifferentiation');

    if (missingFields.length > 0) {
      notes.push(`Missing business inputs: ${missingFields.join(', ')}.`);
    }

    const safeUserValue = userValue ?? 0;
    const safeBusinessImpact = businessImpact ?? 0;
    const safeStrategic = strategicImportance ?? 0;
    const safeCustomerRequests = customerRequests ?? 0;
    const safeMarketDiff = marketDifferentiation ?? 0;

    const total =
      safeUserValue +
      safeBusinessImpact +
      safeStrategic +
      safeCustomerRequests +
      safeMarketDiff;

    const confidence: ConfidenceLevel =
      missingFields.length > 0 ? 'UNAVAILABLE' : 'MEASURED';
    const source = 'Business config files';

    return {
      feature: featureName,
      userValue: safeUserValue,
      businessImpact: safeBusinessImpact,
      strategicImportance: safeStrategic,
      customerRequests: safeCustomerRequests,
      marketDifferentiation: safeMarketDiff,
      total,
      notes,
      confidence,
      source,
    };
  });
};

const analyzeTechnicalHealth = (scan: ProjectScan): TechnicalHealthReport => {
  const integrationGaps = buildIntegrationGaps(scan);
  const integrationGapSummary = summarizeIntegrationGaps(integrationGaps);
  const integrationGapCounts = countIntegrationGapsBySeverity(integrationGaps);
  const structuralGaps = buildStructuralGaps(scan);
  const architectureNotes = buildArchitectureNotes(scan);
  const testGaps = buildTestGaps(scan);
  const qualityNotes = buildQualityNotes(scan);
  const dependencyIssues: string[] = [];
  if (scan.dependencyScan.unused.length > 0) {
    const unusedSample = scan.dependencyScan.unused.slice(0, 8).join(', ');
    dependencyIssues.push(
      `Unused dependencies detected (heuristic, import scan only): ${
        scan.dependencyScan.unused.length
      }${unusedSample ? ` (sample: ${unusedSample})` : ''}.`
    );
  }
  if (scan.dependencyScan.missing.length > 0) {
    const missingSample = scan.dependencyScan.missing.slice(0, 8).join(', ');
    dependencyIssues.push(
      `Missing dependencies detected (heuristic, import scan only): ${
        scan.dependencyScan.missing.length
      }${missingSample ? ` (sample: ${missingSample})` : ''}.`
    );
  }

  const securityNotes = formatSecurityFindings(scan.securityFindings);

  const buildDebtItem = (
    issue: string,
    risk: number,
    blocking: number,
    remediationHours: number,
    value: number
  ): TechnicalDebtItem => ({
    issue,
    risk,
    blocking,
    remediationHours,
    value,
    priority:
      risk >= 8 || blocking >= 8 ? 'HIGH' : risk >= 5 ? 'MEDIUM' : 'LOW',
  });

  const debtItems: TechnicalDebtItem[] = [];
  if (integrationGaps.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Integration gaps detected (${integrationGapSummary}).`,
        integrationGapCounts.critical > 0 ? 8 : 6,
        integrationGapCounts.critical > 0 ? 8 : 5,
        Math.min(16, integrationGaps.length * 2),
        7
      )
    );
  }
  if (structuralGaps.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Structural gaps detected (${structuralGaps.length}).`,
        6,
        6,
        Math.min(12, structuralGaps.length * 2),
        6
      )
    );
  }
  if (architectureNotes.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Architecture alignment review needed (${architectureNotes.length}).`,
        5,
        3,
        4,
        5
      )
    );
  }
  if (testGaps.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Test coverage gaps detected (${testGaps.length}).`,
        5,
        3,
        Math.min(24, testGaps.length * 3),
        6
      )
    );
  }
  if (scan.securityFindings.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Security-sensitive patterns detected (${scan.securityFindings.length}).`,
        8,
        6,
        Math.min(20, scan.securityFindings.length * 4),
        7
      )
    );
  }
  if (dependencyIssues.length > 0) {
    debtItems.push(
      buildDebtItem(
        `Dependency hygiene issues detected (${dependencyIssues.length}).`,
        4,
        3,
        4,
        4
      )
    );
  }

  return {
    integrationGaps,
    structuralGaps,
    architectureNotes,
    testGaps,
    qualityNotes,
    dependencyIssues,
    securityNotes,
    debtItems,
  };
};

// =============================================================================
// AI RUBRIC SCORING FUNCTIONS (Technical Evidence-Based)
// =============================================================================

/**
 * Generate candidate features from technical evidence when business config is missing.
 * Uses completeness scores, technical health, and feature scans to identify candidates.
 */
const generateCandidatesFromTechnicalEvidence = (
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[],
  technicalHealth: TechnicalHealthReport
): string[] => {
  const candidates = new Set<string>();

  // Source 1: Features from scan
  scan.features.forEach((f) => candidates.add(f));

  // Source 2: Features with completeness scores
  completenessScores.forEach((cs) => candidates.add(cs.feature));

  // Source 3: Features from feature scans
  scan.featureScans?.forEach((fs) => candidates.add(fs.name));

  // Source 4: Features mentioned in integration gaps
  technicalHealth.integrationGaps.forEach((gap) => {
    const match = gap.match(/^(\w+[-\w]*)/);
    if (match) candidates.add(match[1]);
  });

  return Array.from(candidates).filter((f) => f && f.length > 0);
};

// AI Rubric Helper Functions (STRATEGY A: QUICK WIN)
// Pre-launch strategy: Prioritize nearly-complete features for fastest path to shippable baseline
// All dimensions reward COMPLETENESS - higher scores mean "closer to shipping"
// Each function returns a score from 1-5 with decimal precision for differentiation

const calculateUserImpactScore = (
  completeness: FeatureCompletenessScore | undefined,
  technicalHealth: TechnicalHealthReport
): number => {
  if (!completeness) return 3;

  // STRATEGY A: QUICK WIN - Reward features that can deliver user value NOW
  // Higher implementation/accessibility = can ship to users sooner = higher score
  const implementationRatio = completeness.implementation.score / 25;
  const accessibilityRatio = completeness.accessibility.score / 25;

  // Base score of 1, scale up based on completeness (max 5)
  let score = 1 + implementationRatio * 2 + accessibilityRatio * 2;

  // Penalty for integration issues (blocks shipping)
  if (technicalHealth.integrationGaps.length > 5) score -= 0.5;
  else if (technicalHealth.integrationGaps.length > 2) score -= 0.25;

  // Bonus for features with excellent accessibility (ready for all users)
  if (completeness.accessibility.score >= 23) score += 0.3;

  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
};

const calculateRiskReductionScore = (
  completeness: FeatureCompletenessScore | undefined,
  technicalHealth: TechnicalHealthReport
): number => {
  if (!completeness) return 3;

  // STRATEGY A: QUICK WIN - Reward features that are LOW RISK to ship
  // Higher test coverage/quality = safer to deploy = higher score
  const testRatio = completeness.testCoverage.score / 25;
  const qualityRatio = completeness.codeQuality.score / 25;

  // Base score of 1, scale up based on stability (max 5)
  let score = 1 + testRatio * 2 + qualityRatio * 2;

  // Penalty for security issues (risky to ship)
  if (technicalHealth.securityNotes.length > 2) score -= 0.5;
  else if (technicalHealth.securityNotes.length > 0) score -= 0.25;

  // Penalty for technical debt (maintenance risk)
  if (technicalHealth.debtItems.length > 5) score -= 0.4;
  else if (technicalHealth.debtItems.length > 2) score -= 0.2;

  // Bonus for excellent test coverage (confident shipping)
  if (completeness.testCoverage.score >= 23) score += 0.3;

  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
};

const estimateEffortRubricScore = (
  completeness: FeatureCompletenessScore | undefined
): number => {
  if (!completeness) return 3;

  // FINE-GRAINED: Use continuous scoring based on exact completeness
  // Higher completeness = less effort = higher score
  // Scale: 0-100 completeness maps to 1-5 score (linear interpolation)
  const score = 1 + (completeness.total / 100) * 4;

  return Math.round(score * 10) / 10; // Round to 1 decimal place
};

const calculateArchitecturalLeverageScore = (
  feature: string,
  scan: ProjectScan
): number => {
  let score = 2.5; // Start at mid-low

  const featureScan = scan.featureScans?.find((f) => f.name === feature);
  if (!featureScan) return score;

  // Component complexity adds leverage (more components = more integration value)
  const componentCount = featureScan.componentFiles.length;
  if (componentCount >= 5) score += 1.0;
  else if (componentCount >= 3) score += 0.6;
  else if (componentCount >= 2) score += 0.3;

  // Test presence adds leverage (testable = maintainable)
  const specCount = featureScan.specFiles.length;
  if (specCount >= 3) score += 0.8;
  else if (specCount >= 2) score += 0.5;
  else if (specCount >= 1) score += 0.3;

  // HTML files indicate UI surface area
  const htmlCount = featureScan.htmlFiles.length;
  if (htmlCount >= 3) score += 0.4;
  else if (htmlCount >= 1) score += 0.2;

  // Cross-feature dependencies increase leverage
  const sharedComponents = scan.sharedComponents.filter((sc) =>
    featureScan.componentFiles.some((cf) => cf.path.includes(sc))
  );
  if (sharedComponents.length > 0) score += 0.3;

  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
};

const estimateTimeToValueScore = (
  completeness: FeatureCompletenessScore | undefined
): number => {
  if (!completeness) return 3;

  // FINE-GRAINED: Higher completeness = faster time to value
  // Use quadratic curve - features near completion are much faster
  const completionRatio = completeness.total / 100;
  // Quadratic: emphasizes high-completion features
  const score = 1 + completionRatio * completionRatio * 4;

  return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
};

const estimateEffortHoursFromCompleteness = (
  completeness: FeatureCompletenessScore | undefined
): number => {
  if (!completeness) return 24; // Default estimate
  const remaining = 100 - completeness.total;
  return Math.max(4, Math.ceil(remaining * 0.5));
};

/**
 * Generate recommendation entry using only technical evidence.
 * Used when business config is missing.
 */
const generateTechnicalRecommendation = (
  feature: string,
  completeness: FeatureCompletenessScore | undefined,
  scan: ProjectScan,
  technicalHealth: TechnicalHealthReport
): RecommendationEntry => {
  const completenessScore = completeness?.total ?? 0;

  // AI Rubric Scoring (1-5 scale each, max 25 points)
  const userImpact = calculateUserImpactScore(completeness, technicalHealth);
  const riskReduction = calculateRiskReductionScore(
    completeness,
    technicalHealth
  );
  const effortScore = estimateEffortRubricScore(completeness);
  const architecturalLeverage = calculateArchitecturalLeverageScore(
    feature,
    scan
  );
  const timeToValue = estimateTimeToValueScore(completeness);

  const rubricTotal =
    Math.round(
      (userImpact +
        riskReduction +
        effortScore +
        architecturalLeverage +
        timeToValue) *
        10
    ) / 10;

  // Determine category based on completeness
  const category = 'feature' as const;
  const subCategory = (completenessScore < 50 ? 'new' : 'polish') as const;

  // Build rationale from technical evidence
  const rationale: string[] = [];
  rationale.push(
    `AI Rubric Score: ${rubricTotal}/25 (User Impact: ${userImpact}, Risk Reduction: ${riskReduction}, Effort: ${effortScore}, Arch Leverage: ${architecturalLeverage}, Time-to-Value: ${timeToValue})`
  );

  if (completeness) {
    if (completeness.testCoverage.score < 15) {
      rationale.push(
        `Low test coverage (${completeness.testCoverage.score}/25) - high risk reduction potential`
      );
    }
    if (completeness.accessibility.score < 15) {
      rationale.push(
        `Accessibility gaps (${completeness.accessibility.score}/25) - user impact improvement needed`
      );
    }
    if (completeness.implementation.score < 15) {
      rationale.push(
        `Implementation incomplete (${completeness.implementation.score}/25) - core functionality needed`
      );
    }
    if (completeness.codeQuality.score < 15) {
      rationale.push(
        `Code quality issues (${completeness.codeQuality.score}/25) - technical debt`
      );
    }
  }

  if (technicalHealth.debtItems.length > 0) {
    rationale.push(
      `${technicalHealth.debtItems.length} technical debt item(s) identified`
    );
  }

  return {
    feature,
    category,
    subCategory,
    score: rubricTotal * 4, // Normalize to 0-100 (max 25*4=100)
    completenessScore,
    userImpact: rubricTotal / 5,
    businessValue: null, // UNKNOWN - no business config available
    strategicAlignment: null, // UNKNOWN - no business config available
    technicalBlocking: rubricTotal / 5,
    effortHours: estimateEffortHoursFromCompleteness(completeness),
    effortConfidence: 'LOW' as ConfidenceLevel,
    effortSource: 'Technical evidence only - no business config',
    rationale,
  };
};

// =============================================================================
// END AI RUBRIC SCORING FUNCTIONS
// =============================================================================

const buildRecommendationScores = (
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[],
  businessScores: BusinessValueScore[],
  dependencyAnalysis: DependencyAnalysis,
  weights: RecommendationWeights,
  technicalHealth: TechnicalHealthReport
): RecommendationEntry[] => {
  const completenessMap = new Map(
    completenessScores.map((score) => [score.feature, score])
  );
  const businessMap = new Map(
    businessScores.map((score) => [score.feature, score])
  );

  // Get candidates from business config OR fallback to technical evidence
  let candidateFeatures = Array.from(businessMap.keys());

  // FALLBACK: Use technical evidence when no business config
  if (candidateFeatures.length === 0) {
    candidateFeatures = generateCandidatesFromTechnicalEvidence(
      scan,
      completenessScores,
      technicalHealth
    );
  }

  return candidateFeatures.flatMap((feature) => {
    const completeness = completenessMap.get(feature);
    const business = businessMap.get(feature);

    // AI RUBRIC SCORING: Generate recommendation from technical evidence when no business config
    if (!business) {
      return [
        generateTechnicalRecommendation(
          feature,
          completeness,
          scan,
          technicalHealth
        ),
      ];
    }
    const completenessScore = completeness?.total ?? 0;
    const userImpact = business.userValue;
    const businessValue = business.businessImpact;
    const strategicAlignment = business.strategicImportance;

    const dependentsCount = dependencyAnalysis.dependents[feature]?.length ?? 0;
    let technicalBlocking = 3;
    if (dependentsCount >= 3) technicalBlocking = 10;
    else if (dependentsCount === 2) technicalBlocking = 8;
    else if (dependentsCount === 1) technicalBlocking = 6;
    if (dependencyAnalysis.blocked.some((item) => item.startsWith(feature))) {
      technicalBlocking = Math.max(technicalBlocking, 7);
    }

    const score =
      completenessScore * weights.completeness +
      userImpact * 10 * weights.userImpact +
      businessValue * 10 * weights.businessValue +
      strategicAlignment * 10 * weights.strategicAlignment +
      technicalBlocking * 10 * weights.technicalBlocking;

    let effortHours: number | undefined;
    let effortConfidence: ConfidenceLevel = 'UNAVAILABLE';
    let effortSource = 'No implementation evidence; provide roadmap estimate.';
    if (completeness !== undefined) {
      // Enhanced effort estimation with complexity multipliers
      const baseHours = (100 - completenessScore) * 0.6;

      // Get feature scan for complexity analysis
      const featureScan = scan.featureIndex[feature];

      // LOC multiplier (larger codebases take longer)
      let locMultiplier = 1.0;
      if (featureScan) {
        const totalLoc = featureScan.tsFiles.reduce(
          (sum, f) => sum + countLines(safeRead(f)),
          0
        );
        if (totalLoc > 1000) locMultiplier = 1.4;
        else if (totalLoc > 500) locMultiplier = 1.2;
        else if (totalLoc > 200) locMultiplier = 1.1;
      }

      // Complexity multiplier (more components = more integration work)
      let complexityMultiplier = 1.0;
      if (featureScan) {
        const componentCount = featureScan.componentFiles.length;
        if (componentCount > 5) complexityMultiplier = 1.4;
        else if (componentCount > 3) complexityMultiplier = 1.2;
        else if (componentCount > 1) complexityMultiplier = 1.1;
      }

      // Test gap multiplier (low coverage = more testing needed)
      let testGapMultiplier = 1.0;
      if (completeness) {
        const testScore = completeness.testCoverage.score;
        if (testScore <= 10) testGapMultiplier = 1.5; // Very low coverage
        else if (testScore <= 15) testGapMultiplier = 1.3; // Low coverage
        else if (testScore <= 20) testGapMultiplier = 1.1; // Moderate coverage
      }

      // Integration multiplier (more dependents = more careful changes needed)
      let integrationMultiplier = 1.0;
      if (dependentsCount >= 3) integrationMultiplier = 1.3;
      else if (dependentsCount >= 1) integrationMultiplier = 1.1;

      // Calculate final hours with all multipliers
      const multiplierProduct =
        locMultiplier *
        complexityMultiplier *
        testGapMultiplier *
        integrationMultiplier;
      effortHours = Math.max(8, Math.round(baseHours * multiplierProduct));

      // Calculate confidence based on data availability
      const factorsUsed = [
        locMultiplier !== 1.0 ? 'LOC' : null,
        complexityMultiplier !== 1.0 ? 'complexity' : null,
        testGapMultiplier !== 1.0 ? 'test-gaps' : null,
        integrationMultiplier !== 1.0 ? 'integration' : null,
      ].filter(Boolean);

      effortConfidence = factorsUsed.length >= 2 ? 'HEURISTIC' : 'ESTIMATED';
      effortSource = `Enhanced heuristic: base=${baseHours.toFixed(
        0
      )}h × LOC(${locMultiplier.toFixed(
        1
      )}) × complexity(${complexityMultiplier.toFixed(
        1
      )}) × test-gaps(${testGapMultiplier.toFixed(
        1
      )}) × integration(${integrationMultiplier.toFixed(1)})`;
    }

    const rationale: string[] = [];
    if (completeness) {
      rationale.push(`Completeness ${completenessScore}/100.`);
    }
    if (business) {
      rationale.push(
        `User impact ${userImpact}/10, business value ${businessValue}/10, strategic ${strategicAlignment}/10.`
      );
    }
    if (technicalBlocking >= 7) {
      rationale.push('High technical blocking value.');
    }

    const category = /(quality|hardening|refactor|test|debt)/i.test(feature)
      ? 'tech_debt'
      : 'feature';

    // Separate polish work from new features
    // Features >60% complete are "polish", <60% are "new"
    const subCategory =
      category === 'feature' && completenessScore > 60 ? 'polish' : 'new';

    return {
      feature,
      score: clampScore(Math.round(score), 0, 100),
      completenessScore,
      userImpact,
      businessValue,
      strategicAlignment,
      technicalBlocking,
      effortHours,
      effortConfidence,
      effortSource,
      rationale,
      category,
      subCategory,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN-BASED RULES (SCALABLE)
// Dynamically applied based on feature characteristics - not hardcoded paths
// ─────────────────────────────────────────────────────────────────────────────

type PatternRule = {
  name: string;
  condition: (f: FeatureScan, df?: DiscoveredFeature) => boolean;
  rules: string[];
  acceptanceCriteria: string[];
};

const PATTERN_BASED_RULES: PatternRule[] = [
  {
    name: 'component',
    condition: (f) => f.componentFiles.length > 0,
    rules: [
      'Enforce UI state contract: loading → data/empty → error states',
      'Ensure idempotent user actions (prevent double-submit)',
      'Add proper async feedback for all user interactions',
    ],
    acceptanceCriteria: [
      '[ ] All async operations show loading feedback',
      '[ ] Submit buttons disabled during pending operations',
      '[ ] Empty states display when no data exists',
    ],
  },
  {
    name: 'dialogs',
    condition: (f) => {
      const combined = f.componentFiles
        .map((c) => c.htmlContent + c.tsContent)
        .join('');
      return /dialog|modal|MatDialog|ConfirmDialog/i.test(combined);
    },
    rules: [
      'Enforce accessibility: focus trapping, aria-labels, role=dialog',
      'Safe submit behavior: prevent double-submit, disable during action',
      'Handle Escape key to close dialog',
    ],
    acceptanceCriteria: [
      '[ ] Dialog traps focus when open',
      '[ ] Escape key closes dialog',
      '[ ] Submit button disabled during action',
    ],
  },
  {
    name: 'timers',
    condition: (f, df) =>
      df?.riskDomains?.includes('timers') ||
      f.componentFiles.some((c) =>
        /timer|timeout|countdown|interval/i.test(c.tsContent)
      ),
    rules: [
      'Enforce cleanup on destroy: use takeUntilDestroyed or ngOnDestroy',
      'Deterministic behavior: no race conditions between timers',
      'Clear timers before starting new ones',
    ],
    acceptanceCriteria: [
      '[ ] All subscriptions use takeUntilDestroyed or are cleaned up',
      '[ ] No memory leaks from timers on component destroy',
    ],
  },
  {
    name: 'stores',
    condition: (f, df) => {
      // Check if discovered feature has stores or if tsFiles contain store patterns
      const hasStoreFiles = (df?.stores?.length ?? 0) > 0;
      const hasStorePatterns = f.tsFiles.some((file) =>
        /\.store\.ts$/i.test(file)
      );
      return hasStoreFiles || hasStorePatterns;
    },
    rules: [
      'Single source of truth: no duplicate state management',
      'Refresh data after mutations (optimistic UI with rollback)',
      'Handle concurrent updates gracefully',
    ],
    acceptanceCriteria: [
      '[ ] Store is single source of truth for this data',
      '[ ] Data refreshed after successful mutations',
      '[ ] Optimistic updates roll back on failure',
    ],
  },
  {
    name: 'forms',
    condition: (f) =>
      f.componentFiles.some((c) =>
        /formControl|ngModel|FormGroup|FormBuilder/i.test(c.tsContent)
      ),
    rules: [
      'Add validation for all form inputs (required, patterns)',
      'Show validation errors inline and accessibly',
      'Disable submit until form is valid',
    ],
    acceptanceCriteria: [
      '[ ] All required fields have validation',
      '[ ] Error messages displayed accessibly (aria-live or aria-describedby)',
      '[ ] Submit disabled for invalid forms',
    ],
  },
  {
    name: 'payments',
    condition: (f, df) => df?.riskDomains?.includes('payments') ?? false,
    rules: [
      'If payment handling is confirmed, validate all amounts server-side',
      'If payment handling is confirmed, show clear pricing before confirmation',
      'If payment handling is confirmed, log payment operations for audit trail',
    ],
    acceptanceCriteria: [
      '[ ] If payment handling is confirmed, amounts validated server-side',
      '[ ] If payment handling is confirmed, user sees clear total before confirming',
      '[ ] If payment handling is confirmed, payment operations logged',
    ],
  },
  {
    name: 'cancellation',
    condition: (f, df) => df?.riskDomains?.includes('cancellation') ?? false,
    rules: [
      'Require confirmation for all cancellation actions',
      'Capture cancellation reason (required)',
      'Show cancellation policy before action',
    ],
    acceptanceCriteria: [
      '[ ] Confirmation dialog before cancellation',
      '[ ] Cancellation reason is required and validated',
      '[ ] Policy displayed before action',
    ],
  },
  {
    name: 'tests',
    condition: (f) => f.specFiles.length > 0,
    rules: [
      'Test loading, empty, error, and happy path states',
      'Include at least one edge case test',
      'Mock external dependencies for unit tests',
    ],
    acceptanceCriteria: [
      '[ ] Tests cover happy path',
      '[ ] Tests cover error handling',
      '[ ] Tests cover edge cases',
    ],
  },
];

const getApplicablePatternRules = (
  featureScan: FeatureScan | undefined,
  discoveredFeature: DiscoveredFeature | undefined
): PatternRule[] => {
  if (!featureScan) return [];
  return PATTERN_BASED_RULES.filter((rule) =>
    rule.condition(featureScan, discoveredFeature)
  );
};

const buildImplementationPrompt = (
  featureName: string,
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[]
): string => {
  const completenessMap = new Map(
    completenessScores.map((score) => [score.feature, score])
  );
  const feature = scan.featureIndex[featureName];
  const completeness = completenessMap.get(featureName);
  const featureScan = scan.featureScans?.find((f) => f.name === featureName);
  const exists = Boolean(feature);

  // VERIFICATION BEFORE IMPROVEMENT: Check what actually needs work
  const verificationResults = featureScan
    ? verifyAllImprovements(featureScan)
    : null;

  // Build concrete file list for this feature (convert to relative paths)
  const featureFiles: string[] = [];
  if (featureScan) {
    const toRelative = (p: string) =>
      relative(scan.basePath, p).replace(/\\/g, '/');
    // componentFiles are objects with .path property
    featureScan.componentFiles.forEach(
      (f) => f?.path && featureFiles.push(toRelative(f.path))
    );
    // specFiles and htmlFiles are already string arrays (direct paths)
    featureScan.specFiles.forEach((f) => f && featureFiles.push(toRelative(f)));
    featureScan.htmlFiles.forEach((f) => f && featureFiles.push(toRelative(f)));
  }

  const designRules: string[] = [];
  if (scan.docs.designSystem) {
    const designDocRelative = relative(
      scan.basePath,
      scan.paths.designSystemDoc
    ).replace(/\\/g, '/');
    designRules.push(
      `Follow design system pointer in \`${designDocRelative}\`.`
    );
  }
  if (scan.docs.designRtl) {
    const rtlDocRelative = relative(
      scan.basePath,
      scan.paths.designRtlDoc
    ).replace(/\\/g, '/');
    designRules.push(
      `Use CSS logical properties for RTL support (see \`${rtlDocRelative}\`).`
    );
  }
  if (scan.docs.designAccessibility) {
    const accessibilityDocRelative = relative(
      scan.basePath,
      scan.paths.designAccessibilityDoc
    ).replace(/\\/g, '/');
    designRules.push(
      `Target WCAG 2.1 AA focus/keyboard navigation; add skip links when relevant (see \`${accessibilityDocRelative}\`).`
    );
  }
  if (designRules.length === 0) {
    designRules.push('Follow existing component styling patterns in the app.');
  }

  const storeRules: string[] = [];
  if (scan.store.exists) {
    storeRules.push(
      `Extend BookingStore pattern at \`apps/**/state/**/*.store.ts\` (located via imports, not concrete paths).`
    );
  }
  if (scan.store.usesSignals) {
    storeRules.push(
      'BookingStore uses @ngrx/signals; keep consistent patterns.'
    );
  }

  // CONCRETE IMPLEMENTATION STEPS based on completeness gaps
  const steps: string[] = [];
  const acceptanceCriteria: string[] = [];

  if (!exists) {
    const featureSlug = featureName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    steps.push(`Define the full user flows for ${featureName}.`);
    steps.push(
      `Create a new feature folder under <FEATURES_ROOT>/${featureSlug}.`
    );
    steps.push('Add routes and navigation entry for the new feature.');
    steps.push(
      'Build the core UI and wire data via BookingStore or API services.'
    );
  } else if (completeness) {
    // CONCRETE STEPS based on actual gaps (threshold < 23 to catch non-excellent scores)
    if (completeness.implementation.score < 23) {
      const gap = 25 - completeness.implementation.score;
      steps.push(
        `Verify + Fix if needed: implementation (+${gap} points to excellence):`
      );
      if (completeness.implementation.score < 18) {
        steps.push(
          '  - Verify transport-level error handling (try/catch, catchError, subscribe errors) + fix if missing + add tests'
        );
        steps.push(
          '  - Verify UI-level error rendering (*ngIf/@if on error signal + visible message) + fix if missing + add tests'
        );
        steps.push(
          '  - Verify loading states for async operations + fix if missing + add tests'
        );
      }
      steps.push(
        '  - Verify empty state handling when no data exists + fix if missing + add tests'
      );
      steps.push(
        '  - Verify all user flows have proper feedback + fix if missing + add tests'
      );
      acceptanceCriteria.push(
        '[ ] Transport-level error handling at service/store boundaries (try/catch or catchError)'
      );
      acceptanceCriteria.push(
        '[ ] UI-level error messages displayed when operations fail'
      );
      acceptanceCriteria.push(
        '[ ] Loading spinners shown during async operations'
      );
      acceptanceCriteria.push('[ ] Empty states display helpful messages');
    }
    if (completeness.testCoverage.score < 23) {
      const gap = 25 - completeness.testCoverage.score;
      // specFiles are strings, not objects
      const specFile =
        featureScan?.specFiles[0] || `${featureName}.component.spec.ts`;
      steps.push(
        `Verify + Fix if needed: test signal (+${gap} points to excellence) in \`${specFile}\`:`
      );
      if (completeness.testCoverage.score < 18) {
        steps.push(
          '  - Verify tests for component initialization + add if missing'
        );
        steps.push(
          '  - Verify tests for user interactions (clicks, form submissions) + add if missing'
        );
      }
      steps.push(
        '  - Verify tests for edge cases and error scenarios + add if missing'
      );
      steps.push(
        '  - Verify test descriptions are clear and specific + update if needed'
      );
      acceptanceCriteria.push('[ ] Unit tests cover happy path');
      acceptanceCriteria.push('[ ] Unit tests cover error scenarios');
      acceptanceCriteria.push('[ ] Tests pass: npm run test');
    }
    if (completeness.codeQuality.score < 23) {
      const gap = 25 - completeness.codeQuality.score;
      steps.push(
        `Verify + Fix if needed: code quality (+${gap} points to excellence):`
      );
      if (completeness.codeQuality.score < 18) {
        steps.push(
          '  - Verify repeated logic and extract into helpers if present'
        );
        steps.push(
          '  - Verify TypeScript strict types (no `any`) + fix if found'
        );
      }
      steps.push(
        '  - Verify naming conventions for clarity + update if needed'
      );
      steps.push(
        '  - Verify JSDoc comments for public methods + add if missing'
      );
      acceptanceCriteria.push('[ ] No TypeScript `any` types');
      acceptanceCriteria.push('[ ] No duplicated code blocks');
      acceptanceCriteria.push('[ ] Lint passes: npm run lint');
    }
    if (completeness.accessibility.score < 23) {
      const gap = 25 - completeness.accessibility.score;
      // htmlFiles are strings, not objects
      const htmlFile =
        featureScan?.htmlFiles[0] || `${featureName}.component.html`;
      steps.push(
        `Verify + Fix if needed: accessibility (+${gap} points to excellence) in \`${htmlFile}\`:`
      );
      if (completeness.accessibility.score < 18) {
        steps.push(
          '  - Verify aria-labels on interactive elements + add if missing'
        );
        steps.push(
          '  - Verify keyboard navigation works (tabindex, focus management) + fix if broken'
        );
      }
      steps.push(
        '  - Verify screen reader announcements for dynamic content + add if missing'
      );
      steps.push(
        '  - Verify focus management after modal/dialog interactions + fix if needed'
      );
      acceptanceCriteria.push('[ ] All buttons have aria-labels');
      acceptanceCriteria.push('[ ] Tab navigation works through all controls');
      acceptanceCriteria.push('[ ] Color contrast meets WCAG AA');
    }

    // If all dimensions are excellent (>= 23), provide final polish steps
    if (steps.length === 0) {
      steps.push('Feature is excellent. Final polish:');
      steps.push('  - Review edge cases and error boundaries');
      steps.push('  - Optimize re-renders and change detection');
      steps.push('  - Add inline documentation for complex logic');
      acceptanceCriteria.push('[ ] No console errors during usage');
      acceptanceCriteria.push('[ ] Performance is acceptable (no jank)');
    }
  }

  // Add standard validation criteria
  acceptanceCriteria.push('[ ] npm run lint passes');
  acceptanceCriteria.push('[ ] npm run test passes');
  acceptanceCriteria.push('[ ] npx tsc --noEmit passes');

  // SCALABLE: Get pattern-based rules dynamically based on feature characteristics
  const discoveredFeature = scan.discoveredFeatures?.find(
    (df) => df.name === featureName
  );
  const applicablePatternRules = getApplicablePatternRules(
    featureScan,
    discoveredFeature
  );
  const patternRulesText =
    applicablePatternRules.length > 0
      ? applicablePatternRules
          .map(
            (rule) =>
              `**${rule.name.toUpperCase()}**:\n${rule.rules
                .map((r) => `  - ${r}`)
                .join('\n')}`
          )
          .join('\n\n')
      : '(No pattern-specific rules detected)';

  // Add pattern-based acceptance criteria
  for (const rule of applicablePatternRules) {
    for (const criterion of rule.acceptanceCriteria) {
      if (!acceptanceCriteria.includes(criterion)) {
        acceptanceCriteria.push(criterion);
      }
    }
  }

  // Get risk domains for the feature
  const riskDomains = discoveredFeature?.riskDomains ?? [];
  const riskDomainsText =
    riskDomains.length > 0 ? riskDomains.join(', ') : '(none detected)';

  // Build verification status text
  const verificationStatusText = verificationResults
    ? Object.entries(verificationResults)
        .map(([type, result]) => {
          const status = result.needed ? '❌ NEEDED' : '✅ PRESENT';
          const existingCount = result.existingPatterns.length;
          const missingCount = result.missingPatterns.length;
          return `- ${type}: ${status} (${existingCount} present, ${missingCount} missing)`;
        })
        .join('\n')
    : '- (verification not available for new features)';

  // Summarize what actually needs work based on verification
  const neededImprovements = verificationResults
    ? Object.entries(verificationResults)
        .filter(([, result]) => result.needed)
        .map(([type, result]) => ({
          type,
          missing: result.missingPatterns,
          searchedPatterns: result.searchedPatterns.filter((p) => !p.found),
          searchedFiles: result.searchedFiles,
        }))
    : [];

  const verifiedImprovementsText =
    neededImprovements.length > 0
      ? neededImprovements
          .map((imp) => {
            const missingDetails = imp.searchedPatterns
              .map(
                (p) =>
                  `  - **${p.description}**\n    - Searched for: \`${p.pattern}\`\n    - Scope: ${imp.searchedFiles}`
              )
              .join('\n');
            return `**${imp.type}** (VERIFY + FIX IF NEEDED):\n${missingDetails}`;
          })
          .join('\n\n')
      : '✅ All improvement patterns already present';

  // Define FEATURE_ROOT as relative path for use in output
  const featureRootRelative = feature?.path
    ? relative(scan.basePath, feature.path).replace(/\\/g, '/')
    : '(new feature)';

  return `
## Task: ${featureName}

### Evidence Snapshot
- Feature root: \`<FEATURE_ROOT>\` = \`${featureRootRelative}\`
- Completeness: ${completeness ? `${completeness.total}/100` : 'N/A'}
  - Implementation: ${completeness?.implementation.score || 0}/25
  - Test signal: ${completeness?.testCoverage.score || 0}/25
  - Accessibility: ${completeness?.accessibility.score || 0}/25
  - Code Quality: ${completeness?.codeQuality.score || 0}/25
- Risk domains (scan-based): ${riskDomainsText}
- Files in scope (patterns):
  - \`<FEATURE_ROOT>/**/*.component.ts\`
  - \`<FEATURE_ROOT>/**/*.component.html\`
  - \`<FEATURE_ROOT>/**/*.component.scss\`
  - \`<FEATURE_ROOT>/**/*.spec.ts\`
  - \`<FEATURE_ROOT>/**/*.service.ts\` (if present)
  - \`<FEATURE_ROOT>/**/*.store.ts\` (if present)

### Verification Status (BEFORE proposing improvements)
${verificationStatusText}

### Verified Improvements Needed
${verifiedImprovementsText}

### Design Rules
${formatList(designRules)}

### Store Rules
${formatList(storeRules)}

### Pattern-Based Rules (SCALABLE)
NOTE: Pattern-based rules are heuristic; verify against authoritative docs and code.
${patternRulesText}

### Implementation Steps
${steps
  .map((step, index) =>
    step.startsWith('  -') ? step : `${index + 1}. ${step}`
  )
  .join('\n')}

### Acceptance Criteria
NOTE: Criteria include scan-based and heuristic items; verify against authoritative docs and code.
${acceptanceCriteria.join('\n')}

### Validation Commands
\`\`\`bash
npm run lint
npm run test
npm run build
npm run check
npx tsc --noEmit
\`\`\`
`;
};

// ============================================================================
// RECOMMENDATION REPORT BUILDER
// ============================================================================

const buildRecommendationReport = (
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[],
  businessScores: BusinessValueScore[],
  dependencyAnalysis: DependencyAnalysis,
  technicalHealth: TechnicalHealthReport,
  weights: RecommendationWeights,
  evidencePack?: EvidencePackV2 | null,
  blockerCheckResult?: any,
  uiUxAnalysis?: any
): string => {
  const toRelPath = (p: string): string =>
    relative(scan.basePath, p).replace(/\\/g, '/');

  const codebaseSummaryLines = [
    `Features discovered: ${scan.features.length}`,
    `Features root: ${toRelPath(scan.paths.featuresDir)}`,
    `Shared components: ${scan.sharedComponents.join(', ') || '(none)'}`,
    `BookingStore exists: ${yesNo(scan.store.exists)} (${toRelPath(
      scan.paths.bookingStore
    )})`,
    `Design system doc: ${yesNo(scan.docs.designSystem)}${
      scan.docs.designSystem
        ? ` (\`${toRelPath(scan.paths.designSystemDoc)}\`)`
        : ''
    }`,
    `Design RTL doc: ${yesNo(scan.docs.designRtl)}${
      scan.docs.designRtl ? ` (\`${toRelPath(scan.paths.designRtlDoc)}\`)` : ''
    }`,
    `Design accessibility doc: ${yesNo(scan.docs.designAccessibility)}${
      scan.docs.designAccessibility
        ? ` (\`${toRelPath(scan.paths.designAccessibilityDoc)}\`)`
        : ''
    }`,
    `Architecture doc: ${yesNo(scan.docs.architecture)}${
      scan.docs.architecture
        ? ` (\`${toRelPath(scan.paths.architectureDoc)}\`)`
        : ''
    }`,
  ];

  const completenessLines = completenessScores
    .map((score) => {
      const formatScoreWithConfidence = (
        label: string,
        scoreDetail: ScoreDetail,
        maxPoints: number
      ): string => {
        const confidenceLabel = scoreDetail.confidence ?? 'UNAVAILABLE';
        return `${label}: ${scoreDetail.score}/${maxPoints} [${confidenceLabel}]`;
      };

      const details = [
        formatScoreWithConfidence('Implementation', score.implementation, 25),
        formatScoreWithConfidence('Test signal', score.testCoverage, 25),
        formatScoreWithConfidence(
          'Accessibility signal',
          score.accessibility,
          25
        ),
        formatScoreWithConfidence('Code quality signal', score.codeQuality, 25),
      ];
      return `- ${score.feature}: ${score.total}/100 (${
        score.interpretation
      })\n${details.map((detail) => `  - ${detail}`).join('\n')}`;
    })
    .join('\n');

  const dependenciesByFeature = formatRecordList(
    dependencyAnalysis.dependencies
  );
  const dependentsByFeature = formatRecordList(dependencyAnalysis.dependents);
  const missingDependenciesByFeature = formatRecordList(
    dependencyAnalysis.missingDependencies
  );

  const featureDependencyReports = scan.featureScans.map(
    scanFeatureDependencies
  );
  const featureDependencyLines = formatFeatureDependencies(
    featureDependencyReports
  );

  const dependencyLines = [
    '### Feature-Level Dependencies (Categorized)',
    ...featureDependencyLines,
    '',
    '### NPM Package Dependencies (import scan):',
    formatList(dependenciesByFeature),
    '',
    'Dependents (feature coupling):',
    formatList(dependentsByFeature),
    '',
    'Missing dependencies (import scan):',
    formatList(missingDependenciesByFeature),
    '',
    'Shared dependencies (feature coupling):',
    formatList(dependencyAnalysis.blocking),
    '',
    'Missing feature references (import scan):',
    formatList(dependencyAnalysis.blocked),
    '',
    'Notable cross-feature uses:',
    formatList(dependencyAnalysis.notes),
  ].join('\n');

  const scoredFeatures = new Set(businessScores.map((score) => score.feature));
  const missingBusinessFeatures = scan.features.filter(
    (feature) => !scoredFeatures.has(feature)
  );

  const businessScoresMissing = businessScores.length === 0;
  const businessLines = businessScoresMissing
    ? 'UNKNOWN: No business config files found (business-priority.json, feature-list.json, issues.json, feature-revenue.json).'
    : businessScores
        .map((score) => {
          const notes =
            score.notes.length > 0
              ? `\n  - Notes: ${score.notes.join(' ')}`
              : '';
          const confidence = score.confidence ?? 'UNAVAILABLE';
          const source = score.source ?? 'n/a';
          return `- ${score.feature}\n  - User value: ${score.userValue}/10\n  - Business impact: ${score.businessImpact}/10\n  - Strategic importance: ${score.strategicImportance}/10\n  - Customer requests: ${score.customerRequests}/10\n  - Market differentiation: ${score.marketDifferentiation}/10\n  - TOTAL: ${score.total}/50\n  - Confidence: ${confidence} (${source})${notes}`;
        })
        .join('\n');

  const businessLinesWithMissing =
    !businessScoresMissing && missingBusinessFeatures.length > 0
      ? `${businessLines}\n- Missing business data for: ${missingBusinessFeatures.join(
          ', '
        )}`
      : businessLines;

  // Add ADR-0001 validation header
  const adr0001ValidationHeader = [
    '### ADR-0001 State Ownership Validation',
    'Per ADR-0001: Store owns DATA state (bookings, loading, error). Components own UI state (dialogs, selection, pagination).',
    '',
  ];

  const technicalLines = [
    ...adr0001ValidationHeader,
    'Architecture notes (ADR-0001 validated):',
    formatList(technicalHealth.architectureNotes),
    '',
    `Integration gaps (${summarizeIntegrationGaps(
      technicalHealth.integrationGaps
    )}):`,
    formatList(technicalHealth.integrationGaps),
    '',
    'Test gaps:',
    formatList(technicalHealth.testGaps),
    '',
    'Code quality notes:',
    formatList(technicalHealth.qualityNotes),
    '',
    'Dependency hygiene signals (packages):',
    formatList(technicalHealth.dependencyIssues),
    '',
    'Security signals:',
    formatList(technicalHealth.securityNotes),
  ].join('\n');

  const recommendations = buildRecommendationScores(
    scan,
    completenessScores,
    businessScores,
    dependencyAnalysis,
    weights,
    technicalHealth
  ).sort((a, b) => b.score - a.score);

  const topRecommendation = recommendations[0];
  const securityBlockers = technicalHealth.securityNotes.filter(
    (note) => !note.startsWith('No security patterns detected')
  );
  const criticalBlockers = [
    ...technicalHealth.integrationGaps,
    ...securityBlockers,
  ];

  // DYNAMIC: Build tier2 recommendations based on blocker status
  const tier2Lines =
    blockerCheckResult && !blockerCheckResult.canShipFeatures
      ? `⚠️ BLOCKED BY PHASE 1 FOUNDATION\n\nFeature recommendations are blocked until critical dependencies are resolved:\n${blockerCheckResult.activeBlockers
          .map(
            (b) =>
              `- ${b.id}: ${b.name} (${b.effort})\n  Blocks: All production features`
          )
          .join('\n')}\n\nFocus on Phase 1 Foundation first.`
      : recommendations.length > 0
      ? recommendations
          .slice(0, 3)
          .map((rec, index) => {
            const categoryLabel = rec.subCategory
              ? `${rec.category}/${rec.subCategory}`
              : rec.category;
            const effort = rec.effortHours
              ? `${rec.effortHours}h (${rec.effortConfidence})`
              : `UNKNOWN (${rec.effortSource})`;
            return `${index + 1}. ${rec.feature} (Score: ${
              rec.score
            }/100, ${categoryLabel})\n   - Effort: ${effort}\n   - Rationale: ${rec.rationale.join(
              ' '
            )}`;
          })
          .join('\n')
      : '- (none)';

  const priorityScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  // DYNAMIC: Show technical debt only when not blocked by Phase 1
  const tier3 =
    blockerCheckResult && !blockerCheckResult.canShipFeatures
      ? [] // No technical debt work until Phase 1 is complete
      : technicalHealth.debtItems
          .slice()
          .sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority])
          .slice(0, 3)
          .map(
            (item) =>
              `${item.issue} (priority ${item.priority}, remediation ${item.remediationHours}h)`
          );

  // DYNAMIC: Build nextSteps based on blocker status
  const nextSteps =
    blockerCheckResult && !blockerCheckResult.canShipFeatures
      ? [
          // When blockers exist, recommend Phase 1 work instead of features
          `🚫 SHIPPING BLOCKED: ${blockerCheckResult.activeBlockers.length} critical blocker(s) must be resolved first.`,
          ...blockerCheckResult.requiredActions,
          `Estimated effort: ${blockerCheckResult.estimatedEffortToShip}`,
          'Refer to ROADMAP.md Phase 1 (Foundation) for implementation details.',
        ]
      : [
          // When no blockers, recommend feature work
          topRecommendation
            ? `Build: ${topRecommendation.feature} (score ${topRecommendation.score}/100).`
            : 'No top recommendation identified.',
          criticalBlockers.length > 0
            ? 'Address scan-based blockers before new feature work.'
            : 'No scan-based blockers detected; proceed with highest-value feature.',
          'Run quality gates: npm run lint, npm run test, npm run build, and npx tsc --noEmit when applicable.',
        ];

  // DYNAMIC: Build prompt based on blocker status
  const prompt =
    blockerCheckResult && !blockerCheckResult.canShipFeatures
      ? `## PHASE 1: FOUNDATION (BLOCKER RESOLUTION)

Current Status: ${blockerCheckResult.currentPhase}
Can Ship: ${blockerCheckResult.canShipFeatures ? 'YES' : 'NO'}

Active Blockers:
${blockerCheckResult.activeBlockers
  .map((b) => `- ${b.id}: ${b.name} (${b.effort})`)
  .join('\n')}

Action Items (in order):
${blockerCheckResult.requiredActions
  .map((action, i) => `${i + 1}. ${action}`)
  .join('\n')}

Before implementing any features, complete all Phase 1 Foundation items to unblock production shipping.
Refer to ROADMAP.md and BLOCKERS.md for detailed guidance.`
      : topRecommendation
      ? buildImplementationPrompt(
          topRecommendation.feature,
          scan,
          completenessScores
        )
      : 'No implementation prompt available.';

  const evidenceSection = `## Evidence Pack (STRATEGY A: QUICK_WIN)\n\nFeatures discovered: ${
    evidencePack ? evidencePack.discoveredFeatures.length : 0
  }\nGit data: ${
    evidencePack
      ? evidencePack.gitDataAvailable
        ? 'available'
        : 'UNKNOWN'
      : 'UNKNOWN'
  }\n\n`;

  // Add blocker status section if blockerCheckResult is provided
  const blockerSection = blockerCheckResult
    ? `## 🚫 BLOCKER STATUS REPORT

**Current Phase**: ${blockerCheckResult.currentPhase}
**Can Ship Features**: ${
        blockerCheckResult.canShipFeatures ? '✅ YES' : '❌ NO'
      }
**Estimated Effort to Ship**: ${blockerCheckResult.estimatedEffortToShip}

${
  blockerCheckResult.activeBlockers.length > 0
    ? `
### Active Blockers (MUST RESOLVE BEFORE SHIPPING)

${blockerCheckResult.activeBlockers
  .map(
    (b, i) => `${i + 1}. **${b.id}: ${b.name}**
   - Status: ${b.status}
   - Effort: ${b.effort}
   - Blocks All Features: ${b.blocksAll ? 'YES' : 'No'}`
  )
  .join('\n')}

### Required Actions
${blockerCheckResult.requiredActions
  .map((action, i) => `${i + 1}. ${action}`)
  .join('\n')}
`
    : '✅ All critical blockers resolved. Features can proceed to production.'
}

`
    : '';

  // Build UI/UX Architecture section
  const uiUxSection = uiUxAnalysis
    ? `
## 🎨 UI/UX ARCHITECTURE ANALYSIS

**Status**: ${
        uiUxAnalysis.gaps && uiUxAnalysis.gaps.length > 0
          ? '⚠️ GAPS FOUND'
          : '✅ COMPLETE'
      }
**Priority**: ${uiUxAnalysis.priority || 'UNKNOWN'}
**Estimated Effort**: ${uiUxAnalysis.estimatedEffort?.total || 'Unknown'}

${
  uiUxAnalysis.gaps && uiUxAnalysis.gaps.length > 0
    ? `
### Missing Components (${uiUxAnalysis.gaps.length})
${uiUxAnalysis.gaps
  .map(
    (gap: any, i: number) =>
      `${i + 1}. **${gap.gap}** [${gap.severity}]\n   - Why: ${gap.why}`
  )
  .join('\n')}

### Recommendations
${uiUxAnalysis.recommendations
  .map((rec: any, i: number) => `${i + 1}. ${rec}`)
  .join('\n')}

### Effort Breakdown
${Object.entries(uiUxAnalysis.estimatedEffort || {})
  .filter(([key]) => key !== 'total')
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}
- **TOTAL: ${uiUxAnalysis.estimatedEffort?.total || 'Unknown'}**

**Message**: ${uiUxAnalysis.message || 'No message'}
`
    : '✅ All UI/UX components are properly implemented.'
}
`
    : '';

  return `${blockerSection}${evidenceSection}${uiUxSection}## Codebase Analysis Summary\n${formatList(
    codebaseSummaryLines
  )}\n\n## Feature Completeness Report\n${
    completenessLines || '- (none)'
  }\n\n## Dependency Analysis\n${dependencyLines}\n\n## Business Value Assessment\n${
    businessLinesWithMissing || '- (none)'
  }\n\n## Technical Health Report\n${technicalLines}\n\n## Next Feature Recommendations (Prioritized)\n\n### Tier 1: CRITICAL BLOCKERS (scan-based)\n${
    criticalBlockers.length > 0 ? formatList(criticalBlockers) : '- (none)'
  }\n\n### Tier 2: HIGH-VALUE FEATURES (scan-based)\n${tier2Lines}\n\n### Tier 3: TECHNICAL DEBT (scan-based)\n${
    tier3.length > 0 ? formatList(tier3) : '- (none)'
  }\n\n## Recommended Next Steps\n${nextSteps
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n')}\n\n## Implementation Prompt\n${prompt}\n`;
};

/**
 * Tool 1: Project State Analyzer
 */
const projectStateAnalyzer = tool({
  name: 'analyze_project_state',
  description: 'Analyze what features are currently implemented in Khana',
  parameters: z.object({
    aspect: z
      .enum(['completed', 'in_progress', 'missing'])
      .describe('What aspect to analyze'),
  }),
  execute: async ({ aspect }) => {
    const scan = scanProjectState();
    const featureLines = scan.features.map(
      (feature) => `${feature} (${join(scan.paths.featuresDir, feature)})`
    );

    const completed = [
      'Completed features (directory scan):',
      formatList(featureLines),
      '',
      'Evidence:',
      formatList([
        `BookingStore exists: ${yesNo(scan.store.exists)} (${
          scan.paths.bookingStore
        })`,
        `Design system doc: ${yesNo(scan.docs.designSystem)} (${
          scan.paths.designSystemDoc
        })`,
        `Architecture doc: ${yesNo(scan.docs.architecture)} (${
          scan.paths.architectureDoc
        })`,
      ]),
      '',
      'Component inventory:',
      formatList([
        `Components scanned: ${scan.componentFiles.length}`,
        `Structural gaps: ${scan.structuralGaps.length}`,
        `Test gaps: ${scan.testGaps.length}`,
      ]),
    ].join('\n');

    const integrationGaps = buildIntegrationGaps(scan);
    const structuralGaps = buildStructuralGaps(scan);
    const testGaps = buildTestGaps(scan);
    const qualityNotes = buildQualityNotes(scan);
    const architectureNotes = buildArchitectureNotes(scan);
    const unusedSample = scan.dependencyScan.unused.slice(0, 10).join(', ');
    const missingSample = scan.dependencyScan.missing.slice(0, 10).join(', ');
    const dependencyNotes = [
      `Unused dependencies (heuristic): ${scan.dependencyScan.unused.length}${
        unusedSample ? ` (sample: ${unusedSample})` : ''
      }`,
      `Missing dependencies (heuristic): ${scan.dependencyScan.missing.length}${
        missingSample ? ` (sample: ${missingSample})` : ''
      }`,
    ];
    const securityNotes = formatSecurityFindings(scan.securityFindings);
    const inProgress = [
      'In-progress or integration gaps (scan-based):',
      formatList([...integrationGaps, ...structuralGaps]),
      '',
      'Architecture alignment notes:',
      formatList(architectureNotes),
      '',
      'Test coverage signals (scan-based):',
      formatList(testGaps),
      '',
      'Code quality signals (scan-based):',
      formatList(qualityNotes),
      '',
      'Dependency signals (scan-based):',
      formatList(dependencyNotes),
      '',
      'Security signals (scan-based):',
      formatList(securityNotes),
      '',
      'Calendar usage signals:',
      formatList([
        `booking-calendar HTML exists: ${yesNo(scan.calendar.htmlExists)}`,
        `booking-calendar TS exists: ${yesNo(scan.calendar.tsExists)}`,
        `Uses app-hold-timer: ${yesNo(scan.calendar.selectors.holdTimer)}`,
        `Uses app-confirmation-dialog: ${yesNo(
          scan.calendar.selectors.confirmationDialog
        )}`,
        `Uses app-cancellation-form: ${yesNo(
          scan.calendar.selectors.cancellationForm
        )}`,
      ]),
    ].join('\n');

    const missing = [
      'Missing or incomplete items (scan-based):',
      formatList(buildMissingItems(scan)),
    ].join('\n');

    const analysisMap: Record<string, string> = {
      completed,
      in_progress: inProgress,
      missing,
    };

    return JSON.stringify({
      aspect,
      analysis: analysisMap[aspect],
      timestamp: new Date().toISOString(),
      featureCount: scan.features.length,
    });
  },
});

const defaultRecommendationWeights: RecommendationWeights = {
  userImpact: 0.3,
  businessValue: 0.25,
  strategicAlignment: 0.2,
  completeness: 0.15,
  technicalBlocking: 0.1,
};

const normalizeWeights = (
  weights: RecommendationWeights
): RecommendationWeights => {
  const total =
    weights.userImpact +
    weights.businessValue +
    weights.strategicAlignment +
    weights.completeness +
    weights.technicalBlocking;
  if (total <= 0) return defaultRecommendationWeights;
  return {
    userImpact: weights.userImpact / total,
    businessValue: weights.businessValue / total,
    strategicAlignment: weights.strategicAlignment / total,
    completeness: weights.completeness / total,
    technicalBlocking: weights.technicalBlocking / total,
  };
};

const resolveWeights = (weightsInput?: {
  user_impact?: number;
  business_value?: number;
  strategic_alignment?: number;
  completeness?: number;
  technical_blocking?: number;
}): RecommendationWeights => {
  if (!weightsInput) return defaultRecommendationWeights;
  const merged: RecommendationWeights = {
    userImpact:
      weightsInput.user_impact ?? defaultRecommendationWeights.userImpact,
    businessValue:
      weightsInput.business_value ?? defaultRecommendationWeights.businessValue,
    strategicAlignment:
      weightsInput.strategic_alignment ??
      defaultRecommendationWeights.strategicAlignment,
    completeness:
      weightsInput.completeness ?? defaultRecommendationWeights.completeness,
    technicalBlocking:
      weightsInput.technical_blocking ??
      defaultRecommendationWeights.technicalBlocking,
  };
  return normalizeWeights(merged);
};

// ============================================================================
// FEATURE-SPECIFIC REQUIREMENTS CHECKER
// ============================================================================

/**
 * Defines and checks feature-specific requirements for Phase 1 features.
 * Each feature has required capabilities that must be implemented.
 */
type FeatureRequirementsResult = {
  required: string[];
  met: string[];
  missing: string[];
};

const PHASE1_FEATURE_REQUIREMENTS: Record<
  string,
  { required: string[]; patterns: Record<string, RegExp[]> }
> = {
  'booking-list': {
    required: [
      'list-display',
      'status-filtering',
      'action-buttons',
      'cancel-flow',
    ],
    patterns: {
      'list-display': [/@for\s*\(/i, /\*ngFor/i, /trackBy/i],
      'status-filtering': [/filter/i, /status/i, /BookingStatus/i],
      'action-buttons': [/confirm|cancel|pay/i, /button.*click|click.*button/i],
      'cancel-flow': [/cancel/i, /CancellationForm|cancellation-form/i],
    },
  },
  'booking-preview': {
    required: [
      'facility-selection',
      'slot-display',
      'booking-form',
      'error-handling',
    ],
    patterns: {
      'facility-selection': [/facility|court/i, /select/i],
      'slot-display': [/slot|time|availability/i],
      'booking-form': [/form|input|customer/i, /phone|name|email/i],
      'error-handling': [/error|catch|exception/i, /\.catch\(|catchError/i],
    },
  },
  'booking-calendar': {
    required: [
      'week-navigation',
      'day-view',
      'booking-display',
      'action-dialogs',
    ],
    patterns: {
      'week-navigation': [/prev|next|week|navigate/i, /weekDays|currentDate/i],
      'day-view': [/day|date|calendar/i, /getDay\(\)|setDate/i],
      'booking-display': [/booking|slot/i, /startTime|endTime/i],
      'action-dialogs': [
        /dialog|modal|confirm|cancel/i,
        /openConfirmDialog|openCancelDialog/i,
      ],
    },
  },
};

function checkFeatureSpecificRequirements(
  featureName: string,
  feature: FeatureScan
): FeatureRequirementsResult {
  const requirements = PHASE1_FEATURE_REQUIREMENTS[featureName];

  if (!requirements) {
    return { required: [], met: [], missing: [] };
  }

  const met: string[] = [];
  const missing: string[] = [];

  // Collect all content from component files (TS + HTML)
  let combinedContent = '';
  for (const component of feature.componentFiles) {
    const tsContent = safeRead(component.path);
    if (tsContent) {
      combinedContent += tsContent + '\n';
    }
    if (component.hasHtml) {
      const htmlContent = safeRead(component.htmlPath);
      if (htmlContent) {
        combinedContent += htmlContent + '\n';
      }
    }
  }

  // Also check standalone HTML files
  for (const htmlPath of feature.htmlFiles) {
    const htmlContent = safeRead(htmlPath);
    if (htmlContent) {
      combinedContent += htmlContent + '\n';
    }
  }

  // Check each requirement
  for (const req of requirements.required) {
    const patterns = requirements.patterns[req] || [];
    const matched = patterns.some((pattern) => pattern.test(combinedContent));

    if (matched) {
      met.push(req);
    } else {
      missing.push(req);
    }
  }

  return { required: requirements.required, met, missing };
}

// ============================================================================
// PHASE 1 COMPLETION CHECKER
// ============================================================================

/**
 * Checks if Phase 1 features (booking-calendar, booking-list, booking-preview)
 * are ≥70% complete (each) and ≥75% average before allowing progression to Phase 2.
 *
 * Quality gates checked:
 * 1. Implementation (component + template + style exist)
 * 2. Testing (unit tests with realistic coverage)
 * 3. Accessibility (WCAG compliance signals)
 * 4. Code Quality (ESLint clean, TypeScript strict)
 * 5. Documentation (README + inline comments)
 */
function checkPhase1Completion(
  scan: ProjectScan,
  completeness: FeatureCompletenessMap
): Phase1CompletionReport {
  const phase1Features: Phase1Feature[] = [
    'booking-calendar',
    'booking-list',
    'booking-preview',
  ];
  const features: Record<Phase1Feature, FeatureCompletionAnalysis> =
    {} as Record<Phase1Feature, FeatureCompletionAnalysis>;

  let totalCompletion = 0;
  const blockingIssues: string[] = [];
  const recommendedActions: string[] = [];

  for (const featureName of phase1Features) {
    const feature = scan.featureScans.find((f) => f.name === featureName);
    const completionScore = completeness.get(featureName);

    if (!feature || !completionScore) {
      blockingIssues.push(`Feature "${featureName}" not found in project scan`);
      features[featureName] = {
        feature: featureName,
        completionPercentage: 0,
        checkpoints: [],
        blockers: [`Feature not found in scan`],
        missingElements: ['entire feature'],
        qualityGates: {
          implementation: false,
          testing: false,
          accessibility: false,
          codeQuality: false,
          documentation: false,
        },
      };
      continue;
    }

    // Calculate completion percentage from existing score
    const completionPercentage = (completionScore.total / 100) * 100;
    totalCompletion += completionPercentage;

    const checkpoints: CompletionCheckpoint[] = [];
    const blockers: string[] = [];
    const missingElements: string[] = [];

    // Quality Gate 1: Implementation
    const hasComponent = feature.componentFiles.some((c) =>
      c.path.includes(`${featureName}.component.ts`)
    );
    const hasTemplate = feature.componentFiles.some(
      (c) => c.hasHtml && c.htmlPath.includes(`${featureName}.component.html`)
    );
    const hasStyle = feature.componentFiles.some(
      (c) =>
        c.hasScss ||
        c.path.includes('.component.scss') ||
        c.path.includes('.component.css')
    );
    const implementationComplete = hasComponent && hasTemplate;

    checkpoints.push({
      name: 'Implementation Files',
      met: implementationComplete,
      evidence: `Component: ${hasComponent}, Template: ${hasTemplate}, Style: ${hasStyle}`,
      blockerLevel: implementationComplete ? 'LOW' : 'CRITICAL',
    });

    if (!implementationComplete) {
      blockers.push('Missing core implementation files');
      if (!hasComponent) missingElements.push('component.ts');
      if (!hasTemplate) missingElements.push('component.html');
    }

    // Quality Gate 1.5: Feature-Specific Requirements
    const featureRequirements = checkFeatureSpecificRequirements(
      featureName,
      feature
    );
    const featuresComplete =
      featureRequirements.met.length >=
      featureRequirements.required.length * 0.7; // heuristic threshold

    checkpoints.push({
      name: 'Feature Requirements (heuristic)',
      met: featuresComplete,
      evidence: `Met: ${
        featureRequirements.met.join(', ') || 'none'
      }, Missing: ${featureRequirements.missing.join(', ') || 'none'}`,
      blockerLevel: featuresComplete ? 'LOW' : 'HIGH',
    });

    if (!featuresComplete) {
      blockers.push(
        `Heuristic requirement gaps: ${featureRequirements.missing.join(', ')}`
      );
      missingElements.push(...featureRequirements.missing);
    }

    // Quality Gate 2: Testing
    const testScore = completionScore.testCoverage.score;
    const testingComplete = testScore >= 12; // heuristic threshold

    checkpoints.push({
      name: 'Unit Tests (signal)',
      met: testingComplete,
      evidence: `Test signal score: ${testScore}/25 (${completionScore.testCoverage.details.join(
        ', '
      )})`,
      blockerLevel: testingComplete ? 'LOW' : 'HIGH',
    });

    if (!testingComplete) {
      blockers.push(
        `Test signal below heuristic threshold (score: ${testScore}/25)`
      );
      missingElements.push('comprehensive unit tests');
    }

    // Quality Gate 3: Accessibility
    const a11yScore = completionScore.accessibility.score;
    const a11yComplete = a11yScore >= 12; // heuristic threshold

    checkpoints.push({
      name: 'Accessibility',
      met: a11yComplete,
      evidence: `A11y score: ${a11yScore}/25 (${completionScore.accessibility.details.join(
        ', '
      )})`,
      blockerLevel: a11yComplete ? 'LOW' : 'MEDIUM',
    });

    if (!a11yComplete) {
      blockers.push(`Accessibility concerns (score: ${a11yScore}/25)`);
      missingElements.push('WCAG compliance improvements');
    }

    // Quality Gate 4: Code Quality
    const qualityScore = completionScore.codeQuality.score;
    const qualityComplete = qualityScore >= 18; // heuristic threshold

    checkpoints.push({
      name: 'Code Quality',
      met: qualityComplete,
      evidence: `Quality score: ${qualityScore}/25 (${completionScore.codeQuality.details.join(
        ', '
      )})`,
      blockerLevel: qualityComplete ? 'LOW' : 'MEDIUM',
    });

    if (!qualityComplete) {
      blockers.push(`Code quality issues (score: ${qualityScore}/25)`);
      missingElements.push('code quality improvements');
    }

    // Quality Gate 5: Documentation
    const hasReadme = feature.mdFiles.some((mdPath) =>
      mdPath.toLowerCase().includes('readme.md')
    );
    const hasComments = feature.componentFiles.some((c) => {
      const content = safeRead(c.path);
      return content
        ? (content.match(/\/\*\*|\s*\/\//g) || []).length > 5
        : false;
    });
    const docComplete = hasReadme || hasComments;

    checkpoints.push({
      name: 'Documentation',
      met: docComplete,
      evidence: `README: ${hasReadme}, Inline comments: ${hasComments}`,
      blockerLevel: docComplete ? 'LOW' : 'LOW',
    });

    if (!docComplete) {
      missingElements.push('documentation');
    }

    // Store feature analysis
    features[featureName] = {
      feature: featureName,
      completionPercentage,
      checkpoints,
      blockers,
      missingElements,
      qualityGates: {
        implementation: implementationComplete,
        testing: testingComplete,
        accessibility: a11yComplete,
        codeQuality: qualityComplete,
        documentation: docComplete,
      },
    };

    // Add to blocking issues if <70% complete (realistic threshold)
    if (completionPercentage < 70) {
      blockingIssues.push(
        `"${featureName}" is ${completionPercentage.toFixed(
          0
        )}% complete (requires ≥70%)`
      );
      recommendedActions.push(
        `Complete "${featureName}": ${blockers.join(', ')}`
      );
    }
  }

  const averageCompletion = totalCompletion / phase1Features.length;
  // Block if ANY feature is below 70% or average is below 75%
  const overallComplete =
    averageCompletion >= 75 && blockingIssues.length === 0;

  return {
    overallComplete,
    averageCompletion,
    features,
    blockingIssues,
    recommendedActions,
  };
}

// ============================================================================
// UI/UX ARCHITECTURE ANALYZER
// ============================================================================

/**
 * Analyzes UI/UX architecture to determine if sidebar or layout refactoring
 * is needed BEFORE building new features.
 *
 * Evaluates:
 * 1. Navigation pattern and complexity
 * 2. Layout scalability and sidebar necessity
 * 3. Design system readiness (design system pointer, RTL, accessibility)
 * 4. Future design alignment (client-side + server-side vision)
 *
 * Decision logic:
 * - Build sidebar first if >5 features and no scalable navigation
 * - Refactor layout if design system compliance <70%
 * - Proceed with current UI if navigation can accommodate new feature
 */
function analyzeUIUXArchitecture(scan: ProjectScan): UIUXArchitectureAnalysis {
  // Analyze navigation pattern
  const appComponents = scan.features.flatMap((f) => f.components);
  const hasRouting = appComponents.some(
    (c) =>
      safeRead(c.path)?.includes('RouterModule') ||
      c.path.includes('app.routes')
  );
  const hasMenu = appComponents.some(
    (c) =>
      c.path.toLowerCase().includes('menu') ||
      c.path.toLowerCase().includes('nav')
  );
  const hasSidebar = appComponents.some(
    (c) =>
      c.path.toLowerCase().includes('sidebar') ||
      c.path.toLowerCase().includes('sidenav')
  );
  const hasTabs = appComponents.some((c) =>
    c.path.toLowerCase().includes('tab')
  );

  const currentPattern: NavigationPattern['currentPattern'] = hasSidebar
    ? 'sidebar'
    : hasTabs
    ? 'tabs'
    : hasMenu
    ? 'horizontal-menu'
    : 'none';

  const featurePaths = scan.features.map((f) => `/${f.name}`);
  const navigationDepth = Math.max(
    ...featurePaths.map((p) => p.split('/').length - 1),
    1
  );
  const userFlowComplexity: NavigationPattern['userFlowComplexity'] =
    scan.features.length <= 3
      ? 'SIMPLE'
      : scan.features.length <= 7
      ? 'MODERATE'
      : 'COMPLEX';

  const navigation: NavigationPattern = {
    currentPattern,
    featurePaths,
    userFlowComplexity,
    navigationDepth,
    accessibility: {
      keyboardNavigable: hasMenu || hasSidebar, // Assume true if navigation exists
      screenReaderSupport: hasMenu || hasSidebar, // Basic assumption
      focusManagement: hasRouting, // Router typically handles focus
    },
  };

  // Analyze layout
  const appComponentPath = appComponents.find((c) =>
    c.path.includes('app.component')
  )?.path;
  const appComponentContent = appComponentPath
    ? safeRead(appComponentPath)
    : '';
  const hasResponsiveDesign = appComponentContent
    ? /(@media|mat-sidenav|responsive|flex|grid)/i.test(appComponentContent)
    : false;
  const supportsMobile = appComponentContent
    ? /(viewport|mobile|touch-target|48px)/i.test(appComponentContent)
    : false;

  const maxFeaturesWithoutRefactor =
    currentPattern === 'none'
      ? 3
      : currentPattern === 'horizontal-menu'
      ? 7
      : currentPattern === 'tabs'
      ? 5
      : 15; // sidebar can handle many features

  const sidebarRequired =
    scan.features.length > 5 && currentPattern !== 'sidebar';
  const refactoringRequired =
    scan.features.length >= maxFeaturesWithoutRefactor;

  const layout: LayoutAssessment = {
    currentLayout: {
      structure: currentPattern === 'none' ? 'basic' : currentPattern,
      components: ['app.component', ...scan.features.map((f) => f.name)],
      hasResponsiveDesign,
      supportsMobile,
    },
    sidebarNecessity: {
      required: sidebarRequired,
      reasoning: sidebarRequired
        ? [
            `Current feature count (${scan.features.length}) exceeds horizontal menu capacity`,
            'Sidebar provides better scalability for growing feature set',
            'Improves navigation clarity and discoverability',
          ]
        : [
            'Current navigation pattern can accommodate feature count',
            `Features (${scan.features.length}) within ${currentPattern} capacity (${maxFeaturesWithoutRefactor})`,
          ],
      alternativeApproaches: sidebarRequired
        ? [
            'Implement collapsible sidebar',
            'Use navigation drawer',
            'Add mega menu',
          ]
        : ['Continue with current pattern', 'Add dropdown menus if needed'],
    },
    scalability: {
      canAccommodateNewFeatures: !refactoringRequired,
      maxFeaturesWithoutRefactor,
      refactoringRequired,
    },
  };

  // Analyze design system readiness
  const styleFiles = appComponents.filter(
    (c) => c.path.endsWith('.scss') || c.path.endsWith('.css')
  );
  let logicalPropertiesCount = 0;
  let physicalPropertiesCount = 0;
  let focusStylesDetected = false;

  for (const styleFile of styleFiles) {
    const content = safeRead(styleFile.path) || '';

    if (/:focus|focus-visible/.test(content)) {
      focusStylesDetected = true;
    }

    // Check RTL support (logical vs physical properties)
    const inlineStartMatches = (
      content.match(/margin-inline-start|padding-inline-start|inset-inline/g) ||
      []
    ).length;
    const leftRightMatches = (
      content.match(
        /margin-left|margin-right|padding-left|padding-right(?!:)/g
      ) || []
    ).length;
    logicalPropertiesCount += inlineStartMatches;
    physicalPropertiesCount += leftRightMatches;
  }

  const rtlSupported = logicalPropertiesCount > physicalPropertiesCount;
  const dirAttributeDetected = appComponents.some((component) => {
    if (!component.hasHtml) return false;
    const htmlContent = safeRead(component.htmlPath) || '';
    return /dir\s*=\s*['"]rtl['"]/i.test(htmlContent);
  });

  const rtlIssues: string[] = [];
  if (!rtlSupported)
    rtlIssues.push('CSS logical properties not dominant for RTL support');
  if (!dirAttributeDetected)
    rtlIssues.push('dir="rtl" not detected in templates');
  if (physicalPropertiesCount > 10)
    rtlIssues.push(`${physicalPropertiesCount} physical property usages found`);

  const keyboardNavigationDetected = appComponents.some((component) => {
    const tsContent = safeRead(component.path) || '';
    const htmlContent = component.hasHtml
      ? safeRead(component.htmlPath) || ''
      : '';
    return /keydown|keypress|keyup|tabindex|aria-keyshortcuts/i.test(
      `${tsContent}
${htmlContent}`
    );
  });

  const skipLinkDetected = appComponents.some((component) => {
    if (!component.hasHtml) return false;
    const htmlContent = safeRead(component.htmlPath) || '';
    return /skip[- ]?link|href=['"]#(main|content)['"]/i.test(htmlContent);
  });

  const accessibilityIssues: string[] = [];
  if (!focusStylesDetected)
    accessibilityIssues.push('Focus styles not detected');
  if (!keyboardNavigationDetected)
    accessibilityIssues.push('Keyboard navigation handlers not detected');
  if (!skipLinkDetected) accessibilityIssues.push('Skip link not detected');

  const componentConsistencyScore =
    (rtlSupported ? 50 : 0) +
    (focusStylesDetected ? 20 : 0) +
    (keyboardNavigationDetected ? 20 : 0) +
    (skipLinkDetected ? 10 : 0);

  const deviations: string[] = [...rtlIssues, ...accessibilityIssues];

  const wcagCompliance: DesignSystemReadiness['accessibility']['wcagCompliance'] =
    focusStylesDetected && keyboardNavigationDetected ? 'AA' : 'UNKNOWN';

  const designSystem: DesignSystemReadiness = {
    rtlSupport: {
      implemented: rtlSupported,
      logicalPropertiesUsed: logicalPropertiesCount > 0,
      dirAttributeDetected,
      issues: rtlIssues,
    },
    componentConsistency: {
      score: componentConsistencyScore,
      deviations,
      missingComponents: sidebarRequired
        ? ['sidebar', 'navigation-drawer']
        : [],
    },
    accessibility: {
      wcagCompliance,
      focusStylesDetected,
      keyboardNavigationDetected,
      skipLinkDetected,
    },
  };

  // Future design alignment
  const futureAlignment: FutureDesignAlignment = {
    clientSideVision: {
      targetUserFlow: 'UNKNOWN (no authoritative roadmap loaded)',
      plannedFeatures: ['UNKNOWN (no authoritative roadmap loaded)'],
      designEvolution: ['UNKNOWN (no authoritative roadmap loaded)'],
    },
    serverSideVision: {
      apiEndpoints: ['UNKNOWN (no authoritative roadmap loaded)'],
      dataModels: ['UNKNOWN (no authoritative roadmap loaded)'],
      businessLogicAlignment: ['UNKNOWN (no authoritative roadmap loaded)'],
    },
    alignmentScore: (componentConsistencyScore / 100) * 100, // 0-100 scale
    gaps: [
      ...deviations,
      ...rtlIssues,
      ...(sidebarRequired ? ['Missing sidebar for scalable navigation'] : []),
    ],
    recommendations: [
      ...(sidebarRequired
        ? ['Implement sidebar before adding more features']
        : []),
      ...(componentConsistencyScore < 75
        ? ['Align UI with design system guidance and RTL/accessibility signals']
        : []),
      ...(rtlIssues.length > 0
        ? ['Resolve RTL issues using CSS logical properties']
        : []),
      ...(wcagCompliance === 'UNKNOWN'
        ? ['Review WCAG 2.1 AA focus/keyboard guidance and skip links']
        : []),
    ],
  };

  // Make decision
  const buildSidebarFirst = sidebarRequired && refactoringRequired;
  const refactorLayoutFirst = componentConsistencyScore < 70;
  const proceedWithCurrentUI = !buildSidebarFirst && !refactorLayoutFirst;

  const reasoning: string[] = [];
  const estimatedEffort: UIUXArchitectureAnalysis['decision']['estimatedEffort'] =
    {};

  if (buildSidebarFirst) {
    reasoning.push(
      `Feature count (${scan.features.length}) exceeds current navigation capacity (${maxFeaturesWithoutRefactor})`,
      'Sidebar needed for scalability before adding more features',
      'Prevents navigation refactoring after feature implementation'
    );
    estimatedEffort.sidebarImplementation = 16; // 2 days
  }

  if (refactorLayoutFirst) {
    reasoning.push(
      `Design system signal score at ${componentConsistencyScore}% (target: ≥75%)`,
      'RTL/accessibility signals need improvement before production'
    );
    estimatedEffort.designSystemUpdates = 12; // 1.5 days
  }

  if (proceedWithCurrentUI) {
    reasoning.push(
      'Current navigation can accommodate new feature',
      'Design system signal score acceptable',
      'No architectural blockers detected'
    );
  }

  const decision: UIUXArchitectureAnalysis['decision'] = {
    buildSidebarFirst,
    refactorLayoutFirst,
    proceedWithCurrentUI,
    reasoning,
    estimatedEffort,
  };

  return {
    navigation,
    layout,
    designSystem,
    futureAlignment,
    decision,
  };
}

// ============================================================================
// MARKET TIMING ANALYZER
// ============================================================================

/**
 * Market timing is UNKNOWN unless authoritative business sources are provided.
 * This avoids assumptions about regions, competitors, or timing windows.
 */
function analyzeMarketTiming(feature: string): MarketTimingAnalysis {
  return {
    feature,
    status: 'UNKNOWN',
    notes: ['UNKNOWN - no authoritative market timing sources loaded'],
  };
}

// ============================================================================
// DECISION MATRIX BUILDER
// ============================================================================

/**
 * Builds a decision matrix with weighted scoring to select ONE feature to build next.
 *
 * Weighted scoring:
 * - Business Value: 40%
 * - Technical Foundation: 25%
 * - Market Timing: UNKNOWN (not scored without authoritative sources)
 * - Dependency Blocking: 15%
 * - UI/UX Architecture: Factored into decision reasoning
 *
 * Returns:
 * - Single winner feature
 * - Runner-ups for comparison
 * - "Why not others" rationale for winner
 */
function buildDecisionMatrix(
  scan: ProjectScan,
  completeness: FeatureCompletenessMap,
  business: BusinessValueScore[],
  dependencies: DependencyMap,
  phase1Complete: boolean,
  uiuxAnalysis?: UIUXArchitectureAnalysis
): DecisionMatrix {
  const candidates: DecisionCandidate[] = [];

  // Get all potential features (excluding Phase 1 if not complete)
  const phase1Features = [
    'booking-calendar',
    'booking-list',
    'booking-preview',
  ];
  let eligibleFeatures = scan.features.map((f) => f.name);

  if (!phase1Complete) {
    // If Phase 1 not complete, only consider Phase 1 features
    eligibleFeatures = eligibleFeatures.filter((f) =>
      phase1Features.includes(f)
    );
  } else {
    // If Phase 1 complete, exclude them from new feature consideration
    eligibleFeatures = eligibleFeatures.filter(
      (f) => !phase1Features.includes(f)
    );
  }

  for (const featureName of eligibleFeatures) {
    const completionScore = completeness.get(featureName);
    const businessScore = business.find((b) => b.feature === featureName);
    const depAnalysis = dependencies.get(featureName);
    const marketTiming = analyzeMarketTiming(featureName);

    if (!completionScore || !businessScore) {
      continue; // Skip features without required data
    }

    // Factor 1: Business Value (40% weight)
    const businessValue = businessScore.total / 35; // Normalize to 0-1 scale (35 is max)
    const businessFactor: DecisionFactor = {
      name: 'Business Value',
      score: businessValue,
      weight: 0.4,
      weightedScore: businessValue * 0.4,
      evidence: [
        `User value: ${businessScore.userValue}/7`,
        `Business impact: ${businessScore.businessImpact}/7`,
        `Strategic importance: ${businessScore.strategicImportance}/7`,
        `Customer requests: ${businessScore.customerRequests}/7`,
        `Market differentiation: ${businessScore.marketDifferentiation}/7`,
      ],
      confidence: businessScore.confidence || 'ESTIMATED',
    };

    // Factor 2: Technical Foundation (25% weight)
    const technicalReadiness = completionScore.total / 100; // Already normalized 0-1
    const technicalFactor: DecisionFactor = {
      name: 'Technical Foundation',
      score: technicalReadiness,
      weight: 0.25,
      weightedScore: technicalReadiness * 0.25,
      evidence: [
        `Implementation: ${completionScore.implementation.score}/25`,
        `Test coverage: ${completionScore.testCoverage.score}/25`,
        `Code quality: ${completionScore.codeQuality.score}/25`,
        `Overall readiness: ${(technicalReadiness * 100).toFixed(0)}%`,
      ],
      confidence: 'MEASURED',
    };

    // Factor 3: Market Timing (UNKNOWN - no authoritative sources)
    const marketFactor: DecisionFactor = {
      name: 'Market Timing',
      score: 0,
      weight: 0,
      weightedScore: 0,
      evidence: marketTiming.notes,
      confidence: 'HEURISTIC',
    };

    // Factor 4: Dependency Blocking (15% weight)
    const blockedCount = depAnalysis?.blocked.length || 0;
    const blockingCount = depAnalysis?.blocking.length || 0;
    // Higher score if feature blocks others (should build it to unblock)
    // Lower score if feature is blocked (harder to build)
    const dependencyScore = Math.max(
      0,
      Math.min(1, blockingCount * 0.3 - blockedCount * 0.2 + 0.5)
    );
    const dependencyFactor: DecisionFactor = {
      name: 'Dependency Impact',
      score: dependencyScore,
      weight: 0.15,
      weightedScore: dependencyScore * 0.15,
      evidence: [
        `Blocks ${blockingCount} other feature(s)`,
        `Blocked by ${blockedCount} dependency(ies)`,
        blockedCount > 0
          ? `Dependencies: ${depAnalysis?.blocking.join(', ')}`
          : 'No blockers',
      ],
      confidence: 'PATTERN-BASED',
    };

    // Calculate total score
    const totalScore =
      businessFactor.weightedScore +
      technicalFactor.weightedScore +
      marketFactor.weightedScore +
      dependencyFactor.weightedScore;

    candidates.push({
      feature: featureName,
      totalScore,
      factors: {
        business: businessFactor,
        technical: technicalFactor,
        market: marketFactor,
        dependency: dependencyFactor,
      },
    });
  }

  // Sort candidates by total score (descending)
  candidates.sort((a, b) => b.totalScore - a.totalScore);

  if (candidates.length === 0) {
    // No eligible features found
    return {
      candidates: [],
      winner: {
        feature: 'NONE',
        totalScore: 0,
        factors: {
          business: {
            name: 'Business Value',
            score: 0,
            weight: 0.4,
            weightedScore: 0,
            evidence: [],
            confidence: 'UNAVAILABLE',
          },
          technical: {
            name: 'Technical Foundation',
            score: 0,
            weight: 0.25,
            weightedScore: 0,
            evidence: [],
            confidence: 'UNAVAILABLE',
          },
          market: {
            name: 'Market Timing',
            score: 0,
            weight: 0.2,
            weightedScore: 0,
            evidence: [],
            confidence: 'UNAVAILABLE',
          },
          dependency: {
            name: 'Dependency Impact',
            score: 0,
            weight: 0.15,
            weightedScore: 0,
            evidence: [],
            confidence: 'UNAVAILABLE',
          },
        },
        whyNotOthers: ['No eligible features found in project scan'],
      },
      runnerUps: [],
      decisionRationale: ['No eligible features available for decision'],
    };
  }

  const winner = candidates[0];
  const runnerUps = candidates.slice(1, 4); // Top 3 runner-ups

  // Generate "why not others" rationale
  const whyNotOthers: string[] = [];

  if (runnerUps.length > 0) {
    for (const runnerUp of runnerUps) {
      const scoreDiff = (
        (winner.totalScore - runnerUp.totalScore) *
        100
      ).toFixed(1);
      const reasons: string[] = [];

      // Compare each factor
      if (
        winner.factors.business.weightedScore >
        runnerUp.factors.business.weightedScore
      ) {
        const diff = (
          (winner.factors.business.score - runnerUp.factors.business.score) *
          100
        ).toFixed(0);
        reasons.push(`${diff}% higher business value`);
      }

      if (
        winner.factors.technical.weightedScore >
        runnerUp.factors.technical.weightedScore
      ) {
        const diff = (
          (winner.factors.technical.score - runnerUp.factors.technical.score) *
          100
        ).toFixed(0);
        reasons.push(`${diff}% better technical foundation`);
      }

      if (
        winner.factors.market.weightedScore >
        runnerUp.factors.market.weightedScore
      ) {
        const diff = (
          (winner.factors.market.score - runnerUp.factors.market.score) *
          100
        ).toFixed(0);
        reasons.push(`${diff}% better market timing`);
      }

      if (
        winner.factors.dependency.weightedScore >
        runnerUp.factors.dependency.weightedScore
      ) {
        reasons.push('fewer dependencies, unblocks more features');
      }

      whyNotOthers.push(
        `"${winner.feature}" scores ${scoreDiff}% higher than "${
          runnerUp.feature
        }": ${reasons.join(', ')}`
      );
    }
  }

  // Factor in UI/UX analysis if provided
  if (uiuxAnalysis) {
    if (uiuxAnalysis.decision.buildSidebarFirst) {
      whyNotOthers.push(
        'CRITICAL: Sidebar implementation required before new features for scalability'
      );
    }
    if (uiuxAnalysis.decision.refactorLayoutFirst) {
      whyNotOthers.push(
        `WARNING: Design system signal score at ${uiuxAnalysis.designSystem.componentConsistency.score}% (target: ≥75%)`
      );
    }
  }

  // Generate decision rationale
  const decisionRationale: string[] = [
    `Selected "${winner.feature}" with weighted score: ${(
      winner.totalScore * 100
    ).toFixed(1)}/100`,
    `Business Value (40%): ${(winner.factors.business.score * 100).toFixed(
      0
    )}% ? ${(winner.factors.business.weightedScore * 100).toFixed(1)} points`,
    `Technical Foundation (25%): ${(
      winner.factors.technical.score * 100
    ).toFixed(0)}% ? ${(winner.factors.technical.weightedScore * 100).toFixed(
      1
    )} points`,
    'Market Timing: UNKNOWN (no authoritative sources)',
    `Dependency Impact (15%): ${(winner.factors.dependency.score * 100).toFixed(
      0
    )}% ? ${(winner.factors.dependency.weightedScore * 100).toFixed(1)} points`,
  ];

  if (runnerUps.length > 0) {
    decisionRationale.push(
      `Runner-ups: ${runnerUps
        .map((r) => `"${r.feature}" (${(r.totalScore * 100).toFixed(1)})`)
        .join(', ')}`
    );
  }

  winner.whyNotOthers = whyNotOthers;

  return {
    candidates,
    winner,
    runnerUps,
    decisionRationale,
  };
}

// ============================================================================
// ENHANCED IMPLEMENTATION PLAN GENERATOR
// ============================================================================

/**
 * Generates detailed implementation plan with exact file paths, dependencies,
 * and critical path analysis.
 *
 * Task categories:
 * - PREREQUISITE: DTOs, API contracts, shared services
 * - CORE: Components, templates, routing, state management
 * - TESTING: Unit tests, E2E tests, documentation
 * - DESIGN_SYSTEM: design system guidance, RTL support, accessibility
 * - UI_REFACTOR: Sidebar, layout changes (if needed)
 */
function buildEnhancedImplementationPlan(
  feature: string,
  scan: ProjectScan,
  uiuxAnalysis?: UIUXArchitectureAnalysis
): ImplementationPlan {
  const tasks: ImplementationTask[] = [];
  let taskIdCounter = 1;

  const generateTaskId = () => `TASK-${taskIdCounter++}`;

  // Determine if UI refactoring is needed first
  const needsSidebar = uiuxAnalysis?.decision.buildSidebarFirst || false;
  const needsDesignSystem = uiuxAnalysis?.decision.refactorLayoutFirst || false;

  // UI Refactor tasks (if needed)
  if (needsSidebar) {
    const sidebarTaskId = generateTaskId();
    tasks.push({
      id: sidebarTaskId,
      category: 'UI_REFACTOR',
      description: 'Add sidebar navigation pattern (heuristic)',
      filePath: 'apps/manager-dashboard/src/app',
      lineNumber: 1,
      operation: 'MODIFY',
      estimatedHours: 12,
      dependencies: [],
      acceptanceCriteria: [
        'Navigation follows existing routing patterns',
        'CSS logical properties for RTL support',
        'Keyboard navigation and focus states implemented',
        'Skip links added where main content exists',
      ],
    });
  }

  if (needsDesignSystem) {
    const dsTaskId = generateTaskId();
    tasks.push({
      id: dsTaskId,
      category: 'DESIGN_SYSTEM',
      description:
        'Align components with design system guidance and RTL/accessibility rules',
      filePath: 'apps/manager-dashboard/src/styles.scss',
      lineNumber: 1,
      operation: 'MODIFY',
      estimatedHours: 12,
      dependencies: [],
      acceptanceCriteria: [
        'Design system pointer reviewed and applied where relevant',
        'Physical properties converted to logical properties for RTL support',
        'Skip link guidance reviewed where applicable',
        'WCAG 2.1 AA focus/keyboard guidance reviewed',
      ],
    });
  }

  // PREREQUISITE tasks
  const dtoTaskId = generateTaskId();
  tasks.push({
    id: dtoTaskId,
    category: 'PREREQUISITE',
    description: `Create/update DTO for ${feature} in shared library`,
    filePath: `libs/shared-dtos/src/lib/dtos/${feature}-api.dto.ts`,
    operation: scan.features.some((f) => f.name === feature)
      ? 'MODIFY'
      : 'CREATE',
    estimatedHours: 2,
    dependencies: [],
    acceptanceCriteria: [
      'DTOs and enums live in libs/shared-dtos (ADR-0003)',
      'DTOs align with API contract docs when available',
      'Frontend and backend share types consistently',
    ],
  });

  const apiTaskId = generateTaskId();
  tasks.push({
    id: apiTaskId,
    category: 'PREREQUISITE',
    description: `Update ApiService with ${feature} endpoints`,
    filePath: 'apps/manager-dashboard/src/app/shared/services/api.service.ts',
    lineNumber: 50,
    operation: 'MODIFY',
    estimatedHours: 3,
    dependencies: [{ taskId: dtoTaskId, reason: 'Requires DTO types' }],
    acceptanceCriteria: [
      'ApiService methods added for required endpoints',
      'Error handling aligns with existing ApiService usage',
      'Data state and API calls live in BookingStore',
      'Endpoint paths follow existing API contract docs when available',
    ],
  });

  // CORE tasks
  const storeTaskId = generateTaskId();
  tasks.push({
    id: storeTaskId,
    category: 'CORE',
    description: `Create SignalStore for ${feature} state management`,
    filePath: `apps/manager-dashboard/src/app/state/${feature}/${feature}.store.ts`,
    operation: 'CREATE',
    estimatedHours: 6,
    dependencies: [
      { taskId: dtoTaskId, reason: 'Uses DTO types' },
      { taskId: apiTaskId, reason: 'Calls ApiService methods' },
    ],
    acceptanceCriteria: [
      'SignalStore pattern aligns with BookingStore (booking.store.ts)',
      'Data state and API calls live in BookingStore',
      'UI state remains in components',
      'Computed selectors for derived data',
    ],
  });

  const componentTaskId = generateTaskId();
  tasks.push({
    id: componentTaskId,
    category: 'CORE',
    description: `Create ${feature} component (standalone)`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.ts`,
    operation: 'CREATE',
    estimatedHours: 8,
    dependencies: [
      { taskId: storeTaskId, reason: 'Injects SignalStore' },
      ...(needsSidebar
        ? [{ taskId: tasks[0].id, reason: 'Uses sidebar for navigation' }]
        : []),
    ],
    acceptanceCriteria: [
      'Standalone component with reactive signals',
      'UI state lives in components; data state lives in BookingStore',
      'Keyboard navigation supported for interactive elements',
      'Focus states visible (WCAG 2.1 AA target)',
      'Skip link added when main content is present',
    ],
  });

  const templateTaskId = generateTaskId();
  tasks.push({
    id: templateTaskId,
    category: 'CORE',
    description: `Create ${feature} template aligned with design system guidance`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.html`,
    operation: 'CREATE',
    estimatedHours: 4,
    dependencies: [
      { taskId: componentTaskId, reason: 'Template for component' },
    ],
    acceptanceCriteria: [
      'CSS logical properties for RTL support',
      'Respect dir="rtl" at document or component scope when applicable',
      'Keyboard navigation supported for interactive elements',
      'Skip link to main content when applicable',
    ],
  });

  const styleTaskId = generateTaskId();
  tasks.push({
    id: styleTaskId,
    category: 'CORE',
    description: `Align ${feature} styles with design system guidance`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.scss`,
    operation: 'CREATE',
    estimatedHours: 3,
    dependencies: [{ taskId: templateTaskId, reason: 'Styles for template' }],
    acceptanceCriteria: [
      'Uses design system guidance where applicable',
      'Use CSS logical properties for RTL support',
      'Focus states with visible outline (WCAG 2.1 AA target)',
    ],
  });

  const routingTaskId = generateTaskId();
  tasks.push({
    id: routingTaskId,
    category: 'CORE',
    description: `Add ${feature} route to app routing`,
    filePath: 'apps/manager-dashboard/src/app/app.routes.ts',
    lineNumber: 10,
    operation: 'MODIFY',
    estimatedHours: 1,
    dependencies: [{ taskId: componentTaskId, reason: 'Routes to component' }],
    acceptanceCriteria: [
      'Route path defined following app.routes.ts patterns',
      'Route wired to the feature component',
    ],
  });

  // TESTING tasks
  const unitTestTaskId = generateTaskId();
  tasks.push({
    id: unitTestTaskId,
    category: 'TESTING',
    description: `Create unit tests for ${feature}.component`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.spec.ts`,
    operation: 'CREATE',
    estimatedHours: 6,
    dependencies: [
      { taskId: componentTaskId, reason: 'Tests component logic' },
      { taskId: templateTaskId, reason: 'Tests template rendering' },
    ],
    acceptanceCriteria: [
      'Component instantiation test',
      'User interaction tests (click, input)',
      'Store method call verification',
      'Error state rendering tests',
      'Edge cases covered',
    ],
  });

  const storeTestTaskId = generateTaskId();
  tasks.push({
    id: storeTestTaskId,
    category: 'TESTING',
    description: `Create unit tests for ${feature}.store`,
    filePath: `apps/manager-dashboard/src/app/state/${feature}/${feature}.store.spec.ts`,
    operation: 'CREATE',
    estimatedHours: 5,
    dependencies: [{ taskId: storeTaskId, reason: 'Tests store logic' }],
    acceptanceCriteria: [
      'API success and failure scenarios',
      'Optimistic update rollback tests',
      'Concurrent operation handling',
      'State consistency validation',
    ],
  });

  const readmeTaskId = generateTaskId();
  tasks.push({
    id: readmeTaskId,
    category: 'TESTING',
    description: `Document ${feature} implementation`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/README.md`,
    operation: 'CREATE',
    estimatedHours: 2,
    dependencies: [{ taskId: componentTaskId, reason: 'Documents component' }],
    acceptanceCriteria: [
      'Feature description and user flows',
      'Component API documentation',
      'State management patterns',
      'Known limitations and future work',
    ],
  });

  // Calculate total effort
  const totalEffort = {
    prerequisites: tasks
      .filter((t) => t.category === 'PREREQUISITE')
      .reduce((sum, t) => sum + t.estimatedHours, 0),
    core: tasks
      .filter((t) => t.category === 'CORE')
      .reduce((sum, t) => sum + t.estimatedHours, 0),
    testing: tasks
      .filter((t) => t.category === 'TESTING')
      .reduce((sum, t) => sum + t.estimatedHours, 0),
    designSystem: tasks
      .filter((t) => t.category === 'DESIGN_SYSTEM')
      .reduce((sum, t) => sum + t.estimatedHours, 0),
    uiRefactor: tasks
      .filter((t) => t.category === 'UI_REFACTOR')
      .reduce((sum, t) => sum + t.estimatedHours, 0),
    total: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
  };

  // Build critical path (topological sort)
  const criticalPath = buildCriticalPath(tasks);

  // Define success metrics
  const successMetrics: SuccessMetric[] = [
    {
      name: 'Feature Completeness',
      target: '100%',
      measurement: 'All acceptance criteria met, no blockers',
      type: 'TECHNICAL',
    },
    {
      name: 'Quality Gates',
      target: 'Pass',
      measurement: 'npm run lint/test/build + npx tsc --noEmit when applicable',
      type: 'TECHNICAL',
    },
    {
      name: 'Accessibility',
      target: 'WCAG 2.1 AA focus/keyboard/skip links',
      measurement:
        'Manual verification per docs/authoritative/design/accessibility.md',
      type: 'USER',
    },
    {
      name: 'Design Consistency',
      target: 'Design system guidance applied',
      measurement: 'Review against docs/DESIGN_SYSTEM.md',
      type: 'DESIGN',
    },
  ];

  // Identify blockers and risks
  const blockersAndRisks: BlockerRisk[] = [
    {
      description:
        'RTL support relies on CSS logical properties and dir="rtl" usage',
      likelihood: 'MEDIUM',
      impact: 'MEDIUM',
      mitigation: 'Validate per docs/authoritative/design/rtl.md',
      isShared: false,
      isExternal: false,
    },
    {
      description: 'Accessibility gaps may exist (focus/keyboard/skip links)',
      likelihood: 'MEDIUM',
      impact: 'MEDIUM',
      mitigation: 'Verify per docs/authoritative/design/accessibility.md',
      isShared: false,
      isExternal: false,
    },
    {
      description: 'State ownership drift between BookingStore and components',
      likelihood: 'LOW',
      impact: 'MEDIUM',
      mitigation: 'Follow docs/authoritative/engineering/frontend-angular.md',
      isShared: false,
      isExternal: false,
    },
  ];

  return {
    feature,
    totalEffort,
    tasks,
    criticalPath,
    acceptanceCriteria: [
      'All tasks completed and acceptance criteria met',
      'Tests passing (quality gates)',
      'Lint and type check pass (quality gates)',
      'WCAG 2.1 AA focus/keyboard/skip links verified',
      'Design system guidance applied',
      'RTL support verified with CSS logical properties and dir="rtl" when applicable',
    ],
    successMetrics,
    blockersAndRisks,
  };
}

/**
 * Helper: Build critical path using topological sort
 */
function buildCriticalPath(tasks: ImplementationTask[]): string[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) return;

    // Visit dependencies first
    for (const dep of task.dependencies) {
      visit(dep.taskId);
    }

    path.push(taskId);
  }

  // Visit all tasks
  for (const task of tasks) {
    visit(task.id);
  }

  return path;
}

/**
 * Tool 2: Feature Completeness Analyzer
 */
const featureCompletenessAnalyzer = tool({
  name: 'analyze_feature_completeness',
  description:
    'Score features for implementation status, test coverage, accessibility, and code quality',
  parameters: z.object({}),
  execute: async () => {
    const scan = scanProjectState();
    const features = analyzeFeatureCompleteness(scan);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      features,
    });
  },
});

/**
 * Tool 3: Test Coverage Analyzer
 */
const testCoverageAnalyzer = tool({
  name: 'analyze_test_coverage',
  description: 'Analyze test signals for each feature',
  parameters: z.object({}),
  execute: async () => {
    const scan = scanProjectState();
    const coverage = analyzeTestCoverage(scan);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      coverage,
    });
  },
});

/**
 * Tool 4: Dependency Analyzer
 */
const dependencyAnalyzer = tool({
  name: 'analyze_dependencies',
  description: 'Map feature dependencies, blockers, and integration chains',
  parameters: z.object({}),
  execute: async () => {
    const scan = scanProjectState();
    const analysis = analyzeDependencies(scan);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      analysis,
    });
  },
});

/**
 * Tool 5: Business Value Analyzer
 */
const businessValueAnalyzer = tool({
  name: 'analyze_business_value',
  description: 'Score features for user impact, business value, and strategy',
  parameters: z.object({}).strict(),
  execute: async () => {
    const scan = scanProjectState();
    const scores = analyzeBusinessValue(scan, undefined);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      scores,
    });
  },
});

/**
 * Tool 6: Technical Health Analyzer
 */
const technicalHealthAnalyzer = tool({
  name: 'analyze_technical_health',
  description: 'Assess architecture notes, test gaps, and technical debt',
  parameters: z.object({}),
  execute: async () => {
    const scan = scanProjectState();
    const health = analyzeTechnicalHealth(scan);
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      health,
    });
  },
});

/**
 * Dynamic component detection using filesystem scan
 * Finds components anywhere under the app directory - no hardcoded paths
 */
function detectLayoutComponents(appDir: string): {
  hasLayoutShell: boolean;
  hasSidebar: boolean;
  hasHeader: boolean;
  hasLayoutStore: boolean;
  hasMobileDrawer: boolean;
  paths: Record<string, string | null>;
} {
  const ignoredDirs = new Set(['node_modules', 'dist', '.angular']);
  const allFiles = walkFiles(appDir, ['.ts'], ignoredDirs);

  // Find layout-shell component (can be anywhere)
  const layoutShellFile = allFiles.find(
    (f) => f.includes('layout-shell') && f.endsWith('.component.ts')
  );

  // Find sidebar component (can be in layouts/, shared/components/, or anywhere)
  // Exclude placeholder components
  const sidebarFile = allFiles.find(
    (f) =>
      f.includes('sidebar') &&
      f.endsWith('.component.ts') &&
      !f.toLowerCase().includes('placeholder')
  );

  // Find header component (header folder or header.component.ts)
  const headerFile = allFiles.find(
    (f) =>
      (/[/\\]header[/\\].*\.component\.ts$/.test(f) ||
        f.endsWith('header.component.ts')) &&
      !f.includes('.spec.')
  );

  // Find layout store (in any state/ or store/ folder)
  const layoutStoreFile = allFiles.find(
    (f) => f.includes('layout') && f.endsWith('.store.ts')
  );

  // Find mobile drawer component (mobile-drawer or mobile-nav-drawer)
  const mobileDrawerFile = allFiles.find(
    (f) =>
      (f.includes('mobile-drawer') || f.includes('mobile-nav-drawer')) &&
      f.endsWith('.component.ts')
  );

  return {
    hasLayoutShell: !!layoutShellFile,
    hasSidebar: !!sidebarFile,
    hasHeader: !!headerFile,
    hasLayoutStore: !!layoutStoreFile,
    hasMobileDrawer: !!mobileDrawerFile,
    paths: {
      layoutShell: layoutShellFile || null,
      sidebar: sidebarFile || null,
      header: headerFile || null,
      layoutStore: layoutStoreFile || null,
      mobileDrawer: mobileDrawerFile || null,
    },
  };
}

/**
 * Tool 7: UI/UX Architecture Analyzer
 * Detects missing layout components and foundational UI patterns
 */
const uiUxArchitectureAnalyzer = tool({
  name: 'analyze_ui_architecture',
  description:
    'Analyze UI/UX architecture gaps: missing sidebar, layout shell, header extraction, responsive patterns, RTL support',
  parameters: z.object({}),
  execute: async () => {
    const basePath = process.cwd();
    const appDir = join(basePath, 'apps/manager-dashboard/src/app');

    // DYNAMIC DETECTION - scans entire app directory for components
    const detection = detectLayoutComponents(appDir);
    const {
      hasLayoutShell,
      hasSidebar,
      hasHeader: hasHeaderComponent,
      hasLayoutStore,
      hasMobileDrawer,
    } = detection;

    // Log what was found for debugging/transparency
    console.log('[UI/UX ANALYZER] Dynamic component detection:', {
      layoutShell: detection.paths.layoutShell || 'NOT FOUND',
      sidebar: detection.paths.sidebar || 'NOT FOUND',
      header: detection.paths.header || 'NOT FOUND',
      layoutStore: detection.paths.layoutStore || 'NOT FOUND',
      mobileDrawer: detection.paths.mobileDrawer || 'NOT FOUND',
    });

    // Check app.html for hardcoded header
    const appHtmlPath = join(appDir, 'app.html');
    let hasHardcodedHeader = false;
    let headerInRoot = false;
    if (existsSync(appHtmlPath)) {
      const appHtml = readFileSync(appHtmlPath, 'utf-8');
      hasHardcodedHeader =
        appHtml.includes('<header') || appHtml.includes('class="top-nav"');
      headerInRoot = hasHardcodedHeader; // If header is in app.html, it's in root
    }

    // Check for logical properties and RTL support
    const stylesPath = join(appDir, 'styles.scss');
    let hasLogicalProperties = false;
    let hasRtlSupport = false;
    if (existsSync(stylesPath)) {
      const styles = readFileSync(stylesPath, 'utf-8');
      hasLogicalProperties = /inline|block|start|end|inset/.test(styles);
      hasRtlSupport = /\[dir=['"]rtl['"]|:lang\(ar\)/.test(styles);
    }

    // Analyze gaps
    const gaps = [];
    const recommendations = [];

    if (!hasLayoutShell) {
      gaps.push({
        gap: 'Missing Layout Shell Component',
        severity: 'CRITICAL',
        why: 'No unified wrapper for all pages - header/sidebar not properly structured',
      });
      recommendations.push('Create layout-shell.component.ts');
    }

    if (!hasSidebar) {
      gaps.push({
        gap: 'Missing Sidebar Navigation Component',
        severity: 'CRITICAL',
        why: 'No collapsible sidebar for main navigation - currently only hardcoded top-nav',
      });
      recommendations.push(
        'Create sidebar.component.ts with signal-based collapse state'
      );
    }

    if (headerInRoot) {
      gaps.push({
        gap: 'Header Embedded in app.html',
        severity: 'HIGH',
        why: 'Header is hardcoded in root component instead of extracted as reusable component',
      });
      recommendations.push('Extract header.component.ts from app.html');
    }

    if (!hasLayoutStore) {
      gaps.push({
        gap: 'Missing Layout Signal Store',
        severity: 'HIGH',
        why: 'No state management for layout UI (sidebar collapse, mobile menu visibility, theme)',
      });
      recommendations.push(
        'Create layout.store.ts using @ngrx/signals pattern'
      );
    }

    if (!hasMobileDrawer) {
      gaps.push({
        gap: 'No Mobile Navigation Drawer',
        severity: 'MEDIUM',
        why: 'Mobile users see no hamburger menu or navigation drawer - only top-nav',
      });
      recommendations.push(
        'Create mobile-nav-drawer.component.ts for mobile experience'
      );
    }

    // Priority scoring for UI/UX blockers
    const uiUxBlockerScore = gaps.filter(
      (g) => g.severity === 'CRITICAL'
    ).length;

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      layoutArchitecture: {
        hasLayoutShell,
        hasSidebar,
        hasHeaderComponent,
        hasLayoutStore,
        hasMobileDrawer,
        headerInRoot,
        hasLogicalProperties,
        hasRtlSupport,
      },
      gaps,
      recommendations,
      uiUxBlockerScore,
      priority:
        uiUxBlockerScore >= 2
          ? 'BLOCKING: UI/UX architecture must be built before other features'
          : 'HIGH: Recommended before feature implementation',
      estimatedEffort: {
        layoutShell: '4h',
        sidebar: '8h',
        headerComponent: '3h',
        layoutStore: '2h',
        mobileDrawer: '4h',
        total: '21h',
      },
      message:
        gaps.length === 0
          ? 'UI/UX architecture is complete'
          : `Found ${gaps.length} critical UI/UX architecture gaps that should be addressed before implementing Phase 1 features.`,
    });
  },
});

/**
 * Tool 8: Check Blockers and Phase (DYNAMIC DETECTION)
 * MANDATORY: Must be called before making shipping recommendations
 *
 * This tool DYNAMICALLY scans the codebase to detect blocker status
 * rather than relying on hardcoded configuration values.
 */
const blockerCheckTool = tool({
  name: 'check_blockers_and_phase',
  description:
    'Dynamically scan codebase to detect blocker status and determine current project phase. MUST be called before making shipping recommendations.',
  parameters: z.object({}).describe('No parameters required - scans current project automatically'),
  execute: async () => {
    const root = process.cwd();

    // DYNAMIC DETECTION: Scan actual codebase for blocker status
    const detectionReport = await detectAllBlockers(root);

    // Get active blockers (NOT_STARTED or IN_PROGRESS with blocksAll=true)
    const activeBlockers = detectionReport.blockers.filter(
      (b) => b.status !== 'COMPLETED' && b.blocksAll
    );

    const result = {
      status: activeBlockers.length > 0 ? 'blocked' : 'ok',
      detectionMethod: 'DYNAMIC_CODEBASE_SCAN',
      scanTimestamp: detectionReport.timestamp,
      activeBlockers: activeBlockers.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        effort: b.effort,
        blocksAll: b.blocksAll,
        completionPercentage: b.evidence.completionPercentage,
        filesFound: b.evidence.filesFound,
        filesMissing: b.evidence.filesMissing,
      })),
      allBlockers: detectionReport.blockers.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        effort: b.effort,
        blocksAll: b.blocksAll,
        completionPercentage: b.evidence.completionPercentage,
      })),
      summary: detectionReport.summary,
      canShipFeatures: detectionReport.summary.canShipFeatures,
      currentPhase: detectionReport.summary.currentPhase,
      requiredActions:
        activeBlockers.length > 0
          ? activeBlockers.map(
              (b) =>
                `Complete ${b.name} (${b.id}): ${b.evidence.filesMissing.length} files missing`
            )
          : ['All critical blockers resolved - ready for Phase 2 features'],
      estimatedEffortToShip:
        activeBlockers.length > 0
          ? activeBlockers.map((b) => b.effort).join(' + ')
          : '0h (ready to ship)',
    };

    return JSON.stringify(result, null, 2);
  },
});

/**
 * Tool 8b: Update BLOCKERS.md from Detection
 * Updates the BLOCKERS.md file based on dynamic codebase scanning
 */
const updateBlockersDocTool = tool({
  name: 'update_blockers_md',
  description:
    'Scan codebase and update docs/authoritative/BLOCKERS.md with current blocker status. Call this after implementing features to keep docs in sync.',
  parameters: z.object({}).describe('No parameters required - updates current project automatically'),
  execute: async () => {
    const root = process.cwd();
    const result = await updateBlockersMdFile(root);
    return JSON.stringify(result, null, 2);
  },
});

/**
 * Type Definitions for Visual Quality Analysis
 */
interface VisualQualityViolation {
  file: string;
  line: number;
  property: string;
  currentValue: string;
  recommendedValue: string;
  category: 'spacing' | 'rtl' | 'alignment' | 'touch-target';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface VisualQualityAnalysis {
  gaps: Array<{
    gap: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    why: string;
    files: string[];
  }>;
  recommendations: string[];
}

/**
 * Helper function: Map pixel values to design tokens
 */
function mapPixelsToToken(pixels: number): string | null {
  const tokenMap: Record<number, string> = {
    4: '--space-1',
    8: '--space-2',
    12: '--space-3',
    16: '--space-4',
    20: '--space-5',
    24: '--space-6',
    32: '--space-8',
    48: '--space-12',
    64: '--space-16',
  };
  return tokenMap[pixels] || null;
}

/**
 * Helper function: Map physical properties to logical properties
 */
function mapToLogicalProperty(property: string, direction: string): string {
  const logicalMap: Record<string, Record<string, string>> = {
    margin: { left: 'margin-inline-start', right: 'margin-inline-end' },
    padding: { left: 'padding-inline-start', right: 'padding-inline-end' },
    border: { left: 'border-inline-start', right: 'border-inline-end' },
  };
  return logicalMap[property]?.[direction] || property;
}

/**
 * Helper function: Extract pixel value from CSS value
 */
function extractPixelValue(cssValue: string): number {
  const tokenMatch = cssValue.match(/--space-(\d+)/);
  if (tokenMatch) {
    const tokenNum = parseInt(tokenMatch[1]);
    return tokenNum * 4; // space-1 = 4px, space-2 = 8px, etc.
  }
  const pxMatch = cssValue.match(/(\d+)px/);
  return pxMatch ? parseInt(pxMatch[1]) : 0;
}

/**
 * Helper function: Detect alignment inconsistencies between components
 */
async function detectAlignmentInconsistencies(
  _componentPaths: string[]
): Promise<VisualQualityViolation[]> {
  const violations: VisualQualityViolation[] = [];
  const basePath = process.cwd();

  try {
    // Find layout-related components
    const headerScssPath = join(
      basePath,
      'apps/manager-dashboard/src/app/shared/components/header/header.component.scss'
    );
    const layoutScssPath = join(
      basePath,
      'apps/manager-dashboard/src/app/layouts/layout-shell/layout-shell.component.scss'
    );

    // Extract padding values from header and layout
    const paddingValues: Record<
      string,
      { file: string; value: string; line: number }
    > = {};

    // Check header padding
    if (existsSync(headerScssPath)) {
      const content = readFileSync(headerScssPath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const match = line.match(
          /padding-inline:\s*(var\(--space-(\d+)\)|(\d+)px)/
        );
        if (match) {
          paddingValues.header = {
            file: headerScssPath,
            value: match[1],
            line: index + 1,
          };
        }
      });
    }

    // Check main content padding
    if (existsSync(layoutScssPath)) {
      const content = readFileSync(layoutScssPath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('.main-content')) {
          // Look for padding in the next few lines
          for (let i = index; i < Math.min(index + 10, lines.length); i++) {
            const match = lines[i].match(
              /padding-inline:\s*(var\(--space-(\d+)\)|(\d+)px)/
            );
            if (match) {
              paddingValues.main = {
                file: layoutScssPath,
                value: match[1],
                line: i + 1,
              };
              break;
            }
          }
        }
      });
    }

    // Compare header vs main content padding
    if (paddingValues.header && paddingValues.main) {
      const headerPx = extractPixelValue(paddingValues.header.value);
      const mainPx = extractPixelValue(paddingValues.main.value);

      if (Math.abs(headerPx - mainPx) > 4) {
        violations.push({
          file: paddingValues.header.file,
          line: paddingValues.header.line,
          property: 'padding-inline',
          currentValue: paddingValues.header.value,
          recommendedValue: paddingValues.main.value,
          category: 'alignment',
          severity: 'HIGH',
        });
      }
    }
  } catch (_error) {
    // Silently handle errors in alignment detection
  }

  return violations;
}

/**
 * Helper function: Generate visual quality report from violations
 */
function generateVisualQualityReport(
  violations: VisualQualityViolation[]
): VisualQualityAnalysis {
  const gaps: VisualQualityAnalysis['gaps'] = [];
  const recommendations: string[] = [];

  // Group violations by category
  const byCategory = violations.reduce(
    (acc, v) => {
      acc[v.category] = acc[v.category] || [];
      acc[v.category].push(v);
      return acc;
    },
    {} as Record<string, VisualQualityViolation[]>
  );

  // Spacing violations
  if (byCategory.spacing?.length > 0) {
    gaps.push({
      gap: `❌ Spacing Token Violations (${byCategory.spacing.length} instances)`,
      severity: 'HIGH',
      why: `Found ${byCategory.spacing.length} hardcoded pixel values that should use design tokens from the 8px spacing scale. This breaks consistency and makes theme updates difficult.`,
      files: [...new Set(byCategory.spacing.map((v) => v.file))],
    });

    recommendations.push(
      `🎨 Fix Spacing Token Violations:\n` +
        byCategory.spacing
          .slice(0, 5)
          .map(
            (v) =>
              `   └─ ${relative(process.cwd(), v.file)}:${v.line}\n` +
              `      Change: ${v.property}: ${v.currentValue} → ${v.property}: ${v.recommendedValue}`
          )
          .join('\n') +
        (byCategory.spacing.length > 5
          ? `\n   └─ ...and ${byCategory.spacing.length - 5} more`
          : '')
    );
  }

  // RTL violations
  if (byCategory.rtl?.length > 0) {
    gaps.push({
      gap: `❌ RTL Logical Property Violations (${byCategory.rtl.length} instances)`,
      severity: 'CRITICAL',
      why: `Found ${byCategory.rtl.length} physical directional properties (left/right) that break RTL layout for Arabic/MENA markets. Per docs/authoritative/design/rtl.md, ALL directional properties MUST use logical properties.`,
      files: [...new Set(byCategory.rtl.map((v) => v.file))],
    });

    recommendations.push(
      `🌐 Fix RTL Violations (CRITICAL for Arabic support):\n` +
        byCategory.rtl
          .slice(0, 5)
          .map(
            (v) =>
              `   └─ ${relative(process.cwd(), v.file)}:${v.line}\n` +
              `      Change: ${v.property}: ${v.currentValue} → ${v.recommendedValue}`
          )
          .join('\n') +
        (byCategory.rtl.length > 5
          ? `\n   └─ ...and ${byCategory.rtl.length - 5} more`
          : '')
    );
  }

  // Alignment violations
  if (byCategory.alignment?.length > 0) {
    gaps.push({
      gap: `❌ Component Alignment Inconsistencies (${byCategory.alignment.length} instances)`,
      severity: 'HIGH',
      why: `Found ${byCategory.alignment.length} padding/margin mismatches between related components (header vs main content, sidebar vs content area). This creates visual misalignment that users notice.`,
      files: [...new Set(byCategory.alignment.map((v) => v.file))],
    });

    recommendations.push(
      `📐 Fix Alignment Inconsistencies:\n` +
        byCategory.alignment
          .map(
            (v) =>
              `   └─ ${relative(process.cwd(), v.file)}:${v.line}\n` +
              `      Change: ${v.property}: ${v.currentValue} → ${v.property}: ${v.recommendedValue}\n` +
              `      Reason: Must align with related component padding`
          )
          .join('\n')
    );
  }

  // Touch target violations
  if (byCategory['touch-target']?.length > 0) {
    gaps.push({
      gap: `❌ Touch Target Violations (${byCategory['touch-target'].length} instances)`,
      severity: 'HIGH',
      why: `Found ${byCategory['touch-target'].length} interactive elements below 48px minimum (WCAG 2.1 AA requirement). This creates accessibility issues on mobile devices.`,
      files: [...new Set(byCategory['touch-target'].map((v) => v.file))],
    });

    recommendations.push(
      `👆 Fix Touch Target Violations (Accessibility):\n` +
        byCategory['touch-target']
          .map(
            (v) =>
              `   └─ ${relative(process.cwd(), v.file)}:${v.line}\n` +
              `      Change: ${v.property}: ${v.currentValue} → ${v.property}: ${v.recommendedValue}`
          )
          .join('\n')
    );
  }

  return { gaps, recommendations };
}

/**
 * Helper function: Analyze visual quality and spacing compliance
 */
async function analyzeVisualQuality(
  componentPaths: string[]
): Promise<VisualQualityAnalysis> {
  const violations: VisualQualityViolation[] = [];
  const basePath = process.cwd();

  try {
    // Scan all SCSS files in app directory
    const appDir = join(
      basePath,
      'apps/manager-dashboard/src/app'
    );
    const scssPattern = join(appDir, '**/*.component.scss');

    // Helper function to recursively find SCSS files
    const findScssFiles = (dir: string): string[] => {
      const files: string[] = [];
      if (!existsSync(dir)) return files;

      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...findScssFiles(fullPath));
        } else if (entry.endsWith('.component.scss')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const scssFiles = findScssFiles(appDir);

    for (const scssFile of scssFiles) {
      try {
        const content = readFileSync(scssFile, 'utf-8');
        const lines = content.split('\n');

        // Category A: Spacing token violations
        lines.forEach((line, index) => {
          const spacingMatch = line.match(
            /(padding|margin|gap)(-\w+)?:\s*(\d+)px/
          );
          if (spacingMatch && spacingMatch[3] !== '0') {
            const pixels = parseInt(spacingMatch[3]);
            const token = mapPixelsToToken(pixels);
            if (token) {
              violations.push({
                file: scssFile,
                line: index + 1,
                property:
                  spacingMatch[1] + (spacingMatch[2] || ''),
                currentValue: `${pixels}px`,
                recommendedValue: `var(${token})`,
                category: 'spacing',
                severity: 'HIGH',
              });
            }
          }
        });

        // Category B: RTL violations
        lines.forEach((line, index) => {
          const rtlMatch = line.match(
            /(margin|padding|border)-(left|right):\s*([^;]+)/
          );
          if (rtlMatch) {
            const logicalProperty = mapToLogicalProperty(
              rtlMatch[1],
              rtlMatch[2]
            );
            violations.push({
              file: scssFile,
              line: index + 1,
              property: `${rtlMatch[1]}-${rtlMatch[2]}`,
              currentValue: rtlMatch[3],
              recommendedValue: `Use ${logicalProperty} instead`,
              category: 'rtl',
              severity: 'CRITICAL',
            });
          }

          const textAlignMatch = line.match(
            /text-align:\s*(left|right)/
          );
          if (textAlignMatch) {
            violations.push({
              file: scssFile,
              line: index + 1,
              property: 'text-align',
              currentValue: textAlignMatch[1],
              recommendedValue:
                textAlignMatch[1] === 'left' ? 'start' : 'end',
              category: 'rtl',
              severity: 'CRITICAL',
            });
          }
        });

        // Category D: Touch target violations
        let inButton = false;
        lines.forEach((line, index) => {
          if (
            line.match(/^(button|a|\.btn|\[role="button"\])/)
          ) {
            inButton = true;
          }
          if (inButton && line.includes('}')) {
            inButton = false;
          }
          if (inButton) {
            const heightMatch = line.match(
              /(min-)?height:\s*(\d+)px/
            );
            if (heightMatch && parseInt(heightMatch[2]) < 48) {
              violations.push({
                file: scssFile,
                line: index + 1,
                property: heightMatch[1]
                  ? 'min-height'
                  : 'height',
                currentValue: `${heightMatch[2]}px`,
                recommendedValue: 'var(--space-12) or 48px minimum',
                category: 'touch-target',
                severity: 'HIGH',
              });
            }
          }
        });
      } catch (_error) {
        // Silently skip files that fail to read
      }
    }

    // Category C: Alignment inconsistencies (cross-file analysis)
    const alignmentIssues = await detectAlignmentInconsistencies(
      componentPaths
    );
    violations.push(...alignmentIssues);

    // Generate gaps and recommendations
    return generateVisualQualityReport(violations);
  } catch (_error) {
    // Return empty analysis if something goes wrong
    return { gaps: [], recommendations: [] };
  }
}

/**
 * Tool 8: Ranked Recommendations
 */
const rankedRecommendationTool = tool({
  name: 'recommend_features_ranked',
  description: 'Rank features using weighted business and technical scoring',
  parameters: z.object({
    blockerCheckResult: z
      .object({
        status: z.enum(['ok', 'blocked']),
        activeBlockers: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            status: z.string(),
            effort: z.string(),
            blocksAll: z.boolean(),
          })
        ),
        canShipFeatures: z.boolean(),
        currentPhase: z.string(),
        requiredPhase: z.string(),
        requiredActions: z.array(z.string()),
        estimatedEffortToShip: z.string(),
        timestamp: z.string(),
      })
      .describe(
        'REQUIRED: Result from check_blockers_and_phase tool. Must be called first before generating recommendations.'
      ),
    weights: z
      .object({
        user_impact: z.number().default(1),
        business_value: z.number().default(1),
        strategic_alignment: z.number().default(1),
        completeness: z.number().default(1),
        technical_blocking: z.number().default(1),
      })
      .default({}),
    business_config: z
      .object({
        roadmap: z.string().default(''),
        customer_requests: z.string().default(''),
        revenue_impact: z.string().default(''),
      })
      .default({}),
    analysis_config: z
      .object({
        checkVisualQuality: z.boolean().default(false).describe(
          'Enable visual quality and spacing compliance analysis. Detects: spacing token violations, RTL logical property violations, component alignment inconsistencies, and touch target accessibility issues.'
        ),
      })
      .default({}),
  }),
  execute: async ({ blockerCheckResult, weights, business_config, analysis_config }) => {
    const checkVisualQuality = analysis_config?.checkVisualQuality ?? false;
    // FAIL-FAST: Validate blocker check was performed
    if (!blockerCheckResult) {
      throw new Error(
        'ENFORCEMENT VIOLATION: blockerCheckResult is required. ' +
          'You MUST call check_blockers_and_phase tool before recommend_features_ranked.'
      );
    }

    // FAIL-FAST: Validate timestamp freshness (5 minutes)
    const checkTime = new Date(blockerCheckResult.timestamp);
    const now = new Date();
    if (now.getTime() - checkTime.getTime() > 5 * 60 * 1000) {
      throw new Error(
        'ENFORCEMENT VIOLATION: Blocker check is stale (>5 min). ' +
          'Call check_blockers_and_phase again.'
      );
    }

    // EARLY: Inline UI/UX architecture analysis (execute directly, not via tool call)
    console.log('\n[UI/UX ANALYZER] Starting architecture analysis...');
    let uiUxAnalysis: any = null;
    try {
      const basePath = process.cwd();
      const appDir = join(basePath, 'apps/manager-dashboard/src/app');

      // DYNAMIC DETECTION - scans entire app directory for components
      const detection = detectLayoutComponents(appDir);
      const {
        hasLayoutShell,
        hasSidebar,
        hasHeader: hasHeaderComponent,
        hasLayoutStore,
        hasMobileDrawer,
      } = detection;

      // Log what was found for debugging/transparency
      console.log('[UI/UX ANALYZER] Dynamic component detection:', {
        layoutShell: detection.paths.layoutShell || 'NOT FOUND',
        sidebar: detection.paths.sidebar || 'NOT FOUND',
        header: detection.paths.header || 'NOT FOUND',
        layoutStore: detection.paths.layoutStore || 'NOT FOUND',
        mobileDrawer: detection.paths.mobileDrawer || 'NOT FOUND',
      });

      // Check app.html for hardcoded header
      const appHtmlPath = join(appDir, 'app.html');
      let headerInRoot = false;
      if (existsSync(appHtmlPath)) {
        const appHtml = readFileSync(appHtmlPath, 'utf-8');
        headerInRoot =
          appHtml.includes('<header') || appHtml.includes('class="top-nav"');
      }

      // DYNAMIC: Analyze feature patterns and existing shared components
      const gaps = [];
      const recommendations = [];

      // Scan features to dynamically detect what's needed
      const featuresDir = join(appDir, 'features');
      const featureFolders = existsSync(featuresDir)
        ? readdirSync(featuresDir).filter((f) =>
            statSync(join(featuresDir, f)).isDirectory()
          )
        : [];

      // Analyze features for layout-related patterns
      const hasRouterOutlet = featureFolders.some((feature) => {
        const htmlPath = join(
          featuresDir,
          feature,
          `${feature}.component.html`
        );
        if (!existsSync(htmlPath)) return false;
        const content = readFileSync(htmlPath, 'utf-8');
        return content.includes('<router-outlet>');
      });

      const usesHardcodedNavigation = featureFolders.some((feature) => {
        const htmlPath = join(
          featuresDir,
          feature,
          `${feature}.component.html`
        );
        if (!existsSync(htmlPath)) return false;
        const content = readFileSync(htmlPath, 'utf-8');
        return (
          content.includes('class="nav') ||
          content.includes('class="header') ||
          content.includes('routerLink=')
        );
      });

      // DYNAMIC: If app.html has header but features don't have router outlet = needs layout shell
      if (headerInRoot && featureFolders.length > 0 && !hasRouterOutlet) {
        if (!hasLayoutShell) {
          gaps.push({
            gap: 'Missing Layout Shell Component',
            severity: 'CRITICAL',
            why: `Detected ${featureFolders.length} feature(s) but no unified layout wrapper. Header is hardcoded in app.html. Need layout shell to properly structure: header + sidebar + router-outlet.`,
          });
          recommendations.push(
            'Create layout-shell.component.ts in apps/manager-dashboard/src/app/layouts/\n' +
              '   └─ Wire together: header, sidebar, mobile-nav-drawer, and router-outlet\n' +
              '   └─ Pattern: standalone component with OnPush change detection'
          );
        }
      }

      // DYNAMIC: If app.html has header but no sidebar = needs sidebar
      if (headerInRoot && !hasSidebar && featureFolders.length > 0) {
        gaps.push({
          gap: 'Missing Sidebar Navigation Component',
          severity: 'CRITICAL',
          why: `Detected ${featureFolders.length} feature(s) with navigation hardcoded in header. Should extract sidebar for better mobile support and feature organization.`,
        });
        recommendations.push(
          'Create sidebar.component.ts in apps/manager-dashboard/src/app/shared/components/\n' +
            '   └─ Pattern: FOLLOW existing shared components (ConfirmationDialogComponent, CancellationFormComponent)\n' +
            '   └─ Make it standalone, use signal-based collapse state, export from shared barrel\n' +
            '   └─ Supports RTL with CSS Logical Properties (start/end instead of left/right)'
        );
      }

      // DYNAMIC: Extract hardcoded header
      if (headerInRoot && featureFolders.length > 0) {
        gaps.push({
          gap: 'Header Embedded in app.html',
          severity: 'HIGH',
          why: `Header is hardcoded in root component. To support auth (user profile, logout button in Phase 1), extract as reusable component.`,
        });
        recommendations.push(
          'Extract header.component.ts to apps/manager-dashboard/src/app/shared/components/\n' +
            '   └─ Pattern: FOLLOW existing shared components (ConfirmationDialogComponent)\n' +
            '   └─ Make it standalone component with OnPush change detection\n' +
            '   └─ Will integrate user profile & logout when auth is added in Phase 1\n' +
            '   └─ Export from shared barrel for reuse across layouts'
        );
      }

      // DYNAMIC: Layout store only needed if layout is being restructured
      if (
        !hasLayoutStore &&
        (gaps.some((g) => g.gap.includes('Layout Shell')) || !hasSidebar)
      ) {
        gaps.push({
          gap: 'Missing Layout Signal Store',
          severity: 'HIGH',
          why: 'Need state management for new layout components (sidebar collapse, mobile drawer visibility, theme).',
        });
        recommendations.push(
          'Create layout.store.ts in apps/manager-dashboard/src/app/shared/state/\n' +
            '   └─ Pattern: FOLLOW existing state pattern (BookingStore uses @ngrx/signals)\n' +
            '   └─ Manage: sidebar collapsed state, mobile drawer visibility, theme toggle\n' +
            '   └─ Export from shared state barrel'
        );
      }

      // DYNAMIC: Mobile drawer only needed if responsive design is a priority
      if (!hasMobileDrawer && featureFolders.length > 0) {
        gaps.push({
          gap: 'No Mobile Navigation Drawer',
          severity: 'MEDIUM',
          why: `Detected ${featureFolders.length} feature(s). Mobile support needed for hamburger menu on small screens.`,
        });
        recommendations.push(
          'Create mobile-nav-drawer.component.ts in apps/manager-dashboard/src/app/shared/components/\n' +
            '   └─ Pattern: FOLLOW existing shared components\n' +
            '   └─ Standalone component with responsive hamburger trigger\n' +
            '   └─ Integrates with layout.store for visibility state management\n' +
            '   └─ RTL support via CSS Logical Properties'
        );
      }

      const uiUxBlockerScore = gaps.filter(
        (g: any) => g.severity === 'CRITICAL'
      ).length;

      uiUxAnalysis = {
        timestamp: new Date().toISOString(),
        layoutArchitecture: {
          hasLayoutShell,
          hasSidebar,
          hasHeaderComponent,
          hasLayoutStore,
          hasMobileDrawer,
          headerInRoot,
        },
        gaps,
        recommendations,
        uiUxBlockerScore,
        priority:
          uiUxBlockerScore >= 2
            ? 'BLOCKING: UI/UX architecture must be built before other features'
            : 'HIGH: Recommended before feature implementation',
        estimatedEffort: {
          layoutShell: '4h',
          sidebar: '8h',
          headerComponent: '3h',
          layoutStore: '2h',
          mobileDrawer: '4h',
          total: '21h',
        },
        message:
          gaps.length === 0
            ? 'UI/UX architecture is complete'
            : `Found ${gaps.length} critical UI/UX architecture gaps that should be addressed before implementing Phase 1 features.`,
      };

      console.log(
        '[UI/UX ANALYZER] ✅ Successfully analyzed. Found',
        uiUxAnalysis.gaps?.length || 0,
        'architecture gaps'
      );
      console.log('[UI/UX ANALYZER] Priority:', uiUxAnalysis.priority);
      console.log(
        '[UI/UX ANALYZER] Total estimated effort:',
        uiUxAnalysis.estimatedEffort?.total
      );
    } catch (error) {
      console.error('[UI/UX ANALYZER] ❌ Error analyzing:', error);
      uiUxAnalysis = null;
    }

    // OPTIONAL: Visual Quality & Spacing Compliance Check
    let visualQualityAnalysis: VisualQualityAnalysis | null = null;
    if (checkVisualQuality) {
      console.log('\n[VISUAL QUALITY ANALYZER] Starting visual quality analysis...');
      try {
        visualQualityAnalysis = await analyzeVisualQuality(
          uiUxAnalysis?.layoutArchitecture ? Object.keys(uiUxAnalysis.layoutArchitecture) : []
        );

        if (visualQualityAnalysis.gaps.length > 0) {
          console.log(
            '[VISUAL QUALITY ANALYZER] ✅ Analysis complete. Found',
            visualQualityAnalysis.gaps.length,
            'quality issues'
          );

          // Add visual quality issues to UI/UX analysis recommendations
          if (uiUxAnalysis) {
            uiUxAnalysis.gaps.push(...visualQualityAnalysis.gaps);
            uiUxAnalysis.recommendations.push(...visualQualityAnalysis.recommendations);
          }
        } else {
          console.log('[VISUAL QUALITY ANALYZER] ✅ No visual quality issues detected');
        }
      } catch (error) {
        console.error('[VISUAL QUALITY ANALYZER] ❌ Error analyzing:', error);
        visualQualityAnalysis = null;
      }
    }

    const scan = scanProjectState();
    const completeness = analyzeFeatureCompleteness(scan);
    const business = analyzeBusinessValue(
      scan,
      business_config
        ? {
            roadmap: business_config.roadmap,
            customerRequests: business_config.customer_requests,
            revenueImpact: business_config.revenue_impact,
          }
        : undefined
    );
    const dependencies = analyzeDependencies(scan);
    const technicalHealth = analyzeTechnicalHealth(scan);
    const resolvedWeights = resolveWeights(weights);

    // STRATEGY A: QUICK_WIN - Collect Evidence Pack V2 for per-feature metrics
    const evidencePack = collectEvidencePackV2(
      scan.basePath,
      scan.discoveredFeatures
    );

    // FAIL-FAST: Validate evidence before building report
    if (!evidencePack.gitDataAvailable) {
      console.warn('⚠️ Git data unavailable - marking as UNKNOWN in report');
    }
    if (evidencePack.discoveredFeatures.length === 0) {
      throw new Error(
        'FAIL-FAST: No features discovered. Check features directory path.'
      );
    }

    // FAIL-FAST: Check for evidence consistency between Evidence Pack and Dependency Analysis
    for (const featureScan of scan.featureScans) {
      const evidenceStores =
        evidencePack.storeUsageByFeature.get(featureScan.name) ?? [];
      const depReport = scanFeatureDependencies(featureScan);
      const depStores = depReport.categorized.stores;

      // If Evidence Pack shows 0 stores but dependency analysis found stores, we have a conflict
      if (evidenceStores.length === 0 && depStores.length > 0) {
        console.error(
          `EVIDENCE_CONFLICT(StoreUsage): Feature "${
            featureScan.name
          }" shows 0 stores in Evidence Pack but dependency analysis found: ${depStores.join(
            ', '
          )}`
        );
      }
    }

    const report = buildRecommendationReport(
      scan,
      completeness,
      business,
      dependencies,
      technicalHealth,
      resolvedWeights,
      evidencePack,
      blockerCheckResult,
      uiUxAnalysis
    );
    return report;
  },
});

/**
 * Main Agent (Advanced Feature Recommender + Decision-Maker)
 *
 * This agent is NOT just an analyzer - it is a DECISION-MAKER that:
 * 1. Analyzes code quality and feature completeness
 * 2. Checks BLOCKERS.md before any shipping recommendation
 * 3. Applies DECISION_FRAMEWORK.md constraints
 * 4. References ROADMAP.md for phase-appropriate recommendations
 */
export const staffEngineerNextFeatureAgent = new Agent({
  name: 'Staff Engineer - Advanced Feature Recommender + Decision-Maker',
  model: 'gpt-5-nano',
  instructions: `You are a Staff Engineer DECISION-MAKER for the Khana booking platform.
You are NOT just an analyzer - you are responsible for making strategic recommendations
that account for BLOCKERS, PHASES, and CONSTRAINTS.

SOURCE OF TRUTH RULES (MANDATORY):
- The ONLY source of truth is docs/authoritative/.
- You MUST call load_authoritative(tags) before reasoning or responding.
- Always load docs/authoritative/ROOT.md and docs/authoritative/ROUTER.md.
- Use ROUTER tags to load the minimal additional files.
- CRITICAL: Include 'strategic' tag to load DECISION_FRAMEWORK.md, ROADMAP.md, BLOCKERS.md.
- If authoritative docs are not loaded, respond ONLY with: "Authoritative docs not loaded. Call load_authoritative()."

=== DECISION-MAKER RULES (CRITICAL - READ CAREFULLY) ===

BEFORE making ANY shipping recommendation, you MUST:
1. Load 'strategic' tag to get DECISION_FRAMEWORK.md, ROADMAP.md, BLOCKERS.md
2. Check BLOCKERS.md for unresolved blockers
3. Apply DECISION_FRAMEWORK.md constraints
4. Reference ROADMAP.md for phase-appropriate recommendations

CORE CONSTRAINTS (BLOCKING RULES from DECISION_FRAMEWORK.md):
- Constraint 1: No Auth = No Production (BLOCKER-1 must resolve first)
- Constraint 2: No User ID = No Multi-Tenant Safety
- Constraint 3: No Permissions = No Role-Based Access
- Constraint 4: No Audit Trail = No Production (Compliance)

PHASE GATE SYSTEM (from ROADMAP.md):
- Phase 1 (Foundation): Auth, User DB, Permissions, Audit - MUST complete first (20-30h)
- Phase 2 (Features): booking-calendar/preview/list with auth integration (12-16h)
- Phase 3 (Advanced): Payments, Notifications, Analytics (16-20h)

DECISION OUTPUT REQUIREMENTS:
Every recommendation MUST include:
1. Blocker Status: Which blockers are unresolved?
2. Phase Assessment: What phase is the project in?
3. Can Ship?: YES/NO with reasoning
4. If NO, what must be done first?
5. Effort Estimate: Total hours to reach production

EXAMPLE OUTPUT WHEN BLOCKERS EXIST:
"booking-calendar is feature-complete at 87/100 score.
BLOCKER STATUS: CANNOT SHIP - [Blocker Name] ([Blocker ID], [effort]) not resolved.
PHASE: Currently in Phase [N]. Must complete Phase [N+1] first.
RECOMMENDED ACTION: [Action to resolve blocker] before shipping any feature.
EFFORT TO PRODUCTION: [blocker effort] + integration testing."

EXAMPLE OUTPUT WHEN NO BLOCKERS (Phase 1 Complete):
"booking-calendar is feature-complete at 87/100 score.
BLOCKER STATUS: CLEAR - All critical blockers resolved. Phase 1 Foundation complete.
PHASE: Currently in Phase 2 (Features). Ready for shipping.
RECOMMENDED ACTION: Complete integration testing and deploy.
EFFORT TO PRODUCTION: Testing + deployment (~4-8h)."

EXAMPLE INCORRECT OUTPUT (NEVER DO THIS):
"booking-calendar is ready to ship at 87/100 score."
This is WRONG because it doesn't check blocker status from CRITICAL_BLOCKERS config.

=== END DECISION-MAKER RULES ===

CRITICAL ADR RULES (MUST FOLLOW):
- ADR-0001 (State Ownership): Store owns DATA state (bookings, loading, error). Components own UI state (dialogs, selection, pagination, filters).
- Dialog state in components is CORRECT architecture per ADR-0001. Do NOT flag this as an issue.
- Dialog state in the Store would be a VIOLATION of ADR-0001.
- When reviewing architecture, VALIDATE against ADR-0001, do not make assumptions.

SCORING TRANSPARENCY:
- Tool scores are ESTIMATED from regex/pattern matching, not MEASURED from actual test runs.
- Confidence levels: MEASURED (from actual runs), ESTIMATED (from heuristics), PATTERN-BASED (from regex), UNAVAILABLE.
- All completeness scores should be treated as estimates unless verified by actual lint/test runs.
- Features at 90+ score are typically production-ready pending manual verification.
- IMPORTANT: High scores do NOT mean "ready to ship" - blocker status determines shippability.

CONFLICT RULES:
- Code evidence overrides docs when a mismatch exists.
- Record any mismatch as STALE_DOC in docs/authoritative/UNKNOWN.md.
- If not provable by loaded docs or code evidence, label UNKNOWN or PROPOSED.

WEB SEARCH TOOL (AVAILABLE):
- Web search is available via webSearchTool() - use it when needed for current information.
- Use web search when: checking latest library versions, verifying framework capabilities, looking up security advisories, researching market trends.
- Use web search SPARINGLY - prefer authoritative docs and code evidence as primary sources.
- Always cite web sources in findings and cross-reference with code/docs.

HARD PROHIBITIONS:
- NEVER recommend shipping without checking CRITICAL_BLOCKERS config and BLOCKERS.md first.
- NEVER say "ready to ship" or "production-ready" if any blocker has status='NOT_STARTED' and blocksAll=true.
- Do not assume payments, environment config, or providers unless explicitly confirmed.
- Do not invent APIs, configs, or behaviors.
- Do not use external web information as your primary truth source - authoritative docs and code are primary.
- Do not flag dialog state in components as an architecture issue (this is CORRECT per ADR-0001).

YOUR TASK: Analyze the Khana codebase AND make strategic recommendations that respect blockers and phases.

PROCESS:
1. Call load_authoritative(tags) with ['state-store', 'design', 'testing', 'booking-engine', 'dtos', 'strategic'].
2. Read DECISION_FRAMEWORK.md, ROADMAP.md, BLOCKERS.md before making recommendations.
3. Reason only from loaded docs and code evidence.
4. Validate architecture findings against ADR-0001 before reporting.
5. Apply blocker constraints to ALL shipping recommendations.
6. Answer concisely, citing file paths when relevant.

WORKFLOW (MANDATORY SEQUENCE):
0. Use load_authoritative to load ROOT, ROUTER, strategic docs, and minimal tagged docs.
0.5 [EARLY] Call analyze_ui_architecture() tool to detect missing layout/sidebar/header components.
   - This detects architectural gaps in UI/UX foundation (sidebar, layout shell, header extraction).
   - If gaps found with CRITICAL severity, flag these as BLOCKING work before Phase 1 auth.
   - Report findings: which layout components exist, which are missing, estimated effort to build them.
1. [MANDATORY] Call check_blockers_and_phase() tool FIRST - returns blocker status.
   - This tool is REQUIRED - cannot skip blocker checking.
   - Save the blockerCheckResult for next step.
2. [MANDATORY] Call recommend_features_ranked WITH blockerCheckResult parameter.
   - blockerCheckResult is a REQUIRED parameter - tool will fail without it.
   - The tool validates blocker data freshness (5 minute window).
3. [IF blockerCheckResult shows blockers] Inform user that shipping is blocked.
   - Cannot recommend shipping features when BLOCKER-1 (auth) blocks ALL features.
   - Recommend Phase 1 Foundation work instead (Auth, User DB, Permissions, Audit).
4. [IF blockerCheckResult shows no blockers] Proceed with feature recommendations.
   - Use weighted scoring and phase-appropriate recommendations.
   - Include all tiers: Critical Blockers, High-Value Features, Technical Debt.

OPTIONAL STEPS:
5. [OPTIONAL] Use web search for: latest Angular/NestJS/TailwindCSS versions, security advisories on dependencies, market research on booking platforms.
6. For any web search results, cite sources and cross-reference with code/docs.

RULES:
- Base findings on scan/config evidence; do not invent features or scores.
- If business config is missing, say so and leave business scores empty.
- EARLY: Always call analyze_ui_architecture() to detect missing layout components BEFORE recommending features.
- If UI/UX architecture gaps found with CRITICAL severity, recommend building layout foundation FIRST.
  This includes: sidebar, layout-shell, header component, layout signal store, mobile drawer.
- UI/UX Foundation is PRE-REQUISITE before Phase 1 auth work (auth needs somewhere to integrate).
- Use the recommend_features_ranked tool output as the final response.
- Mark all scores with their confidence level (MEASURED vs ESTIMATED).
- ALWAYS include blocker status, phase assessment, AND UI/UX architecture findings in recommendations.
- [CRITICAL] You CANNOT call recommend_features_ranked without blockerCheckResult parameter.
  The tool will REJECT your call with ENFORCEMENT VIOLATION error if this parameter is missing.
- [CRITICAL] You CANNOT recommend shipping features if blockerCheckResult.canShipFeatures is false.
  Your recommendations must explicitly state blocking condition.

STRATEGY A: QUICK_WIN - Prioritize features closest to shippable baseline.
BUT: "Shippable" means blockers are resolved, not just high code quality score.

OUTPUT FORMAT (use recommend_features_ranked tool - output EXACTLY as returned):
0. Evidence Pack (STRATEGY A: QUICK_WIN) - MUST appear first
1. Codebase Analysis Summary
2. BLOCKER STATUS REPORT (NEW - MUST INCLUDE)
3. Feature Completeness Report (with confidence levels)
4. Dependency Analysis
5. Business Value Assessment
6. Technical Health Report (ADR-0001 validated)
7. Next Feature Recommendations (Prioritized WITH blocker status)
8. PHASE ASSESSMENT (NEW - MUST INCLUDE current phase and what's needed)
9. Recommended Next Steps (blocker-aware)
10. Implementation Prompt

CRITICAL: Output the recommend_features_ranked tool result VERBATIM without summarizing or omitting sections.
CRITICAL: Always check blocker status from CRITICAL_BLOCKERS config before recommending shipping.`,
  tools: [
    authoritativeLoader,
    projectStateAnalyzer,
    featureCompletenessAnalyzer,
    testCoverageAnalyzer,
    dependencyAnalyzer,
    businessValueAnalyzer,
    technicalHealthAnalyzer,
    uiUxArchitectureAnalyzer,
    blockerCheckTool,
    updateBlockersDocTool,
    rankedRecommendationTool,
    webSearchTool(),
  ],
});

/**
 * Main entry point with HARD ENFORCEMENT of authoritative docs AND blocker validation
 *
 * This function is the DECISION-MAKER entry point that:
 * 1. Loads authoritative docs INCLUDING strategic docs (blockers, roadmap, decision framework)
 * 2. Validates agent output against ADR-0001
 * 3. Validates shipping recommendations against BLOCKERS.md
 * 4. Reports enforcement violations and warnings
 */
export async function analyzeAndRecommendNextFeature(): Promise<string> {
  // ENFORCEMENT LEVEL 1: Entry point ensures docs are loaded (including strategic)
  const loaded = await loadAuthoritativeDocs(NEXT_FEATURE_TAGS);
  if (loaded.status !== 'success') {
    return AUTHORITATIVE_FAILURE_MESSAGE;
  }

  // Verify strategic docs were loaded
  const strategicLoaded =
    loaded.resolvedTags.includes('strategic') ||
    loaded.files.some(
      (f) =>
        f.path.includes('DECISION_FRAMEWORK') ||
        f.path.includes('BLOCKERS') ||
        f.path.includes('ROADMAP')
    );

  if (!strategicLoaded) {
    console.warn(
      '\n⚠️  WARNING: Strategic docs (DECISION_FRAMEWORK, BLOCKERS, ROADMAP) may not be loaded.\n' +
        'Decision-making constraints may not be applied.\n'
    );
  }

  const context = buildAuthoritativeContext(loaded);
  const enforcePrompt = `${context}

AUTHORITATIVE ENFORCEMENT REMINDER:
- You MUST explicitly call load_authoritative(tags) before any other tool.
- Include 'strategic' tag to load DECISION_FRAMEWORK.md, ROADMAP.md, BLOCKERS.md.
- This is not optional - it is a HARD REQUIREMENT for this analysis.
- Agent will fail validation if load_authoritative is not called.

DECISION-MAKER ENFORCEMENT:
- You are a DECISION-MAKER, not just an analyzer.
- BEFORE recommending shipping, check BLOCKERS.md and CRITICAL_BLOCKERS config for unresolved blockers.
- Check blocker status dynamically - if any blocker has status 'NOT_STARTED' and blocksAll=true, shipping is blocked.
- Apply Phase Gate constraints from ROADMAP.md.
- Phase 1 Foundation is COMPLETE (Auth, User DB, Permissions, Audit Logging all implemented).
- Phase 2 Features are now READY for implementation and shipping.

After calling load_authoritative, analyze the Khana codebase and produce the advanced feature recommendation report WITH blocker status and phase assessment.`;

  const result = await run(staffEngineerNextFeatureAgent, enforcePrompt, {
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
  }

  // ENFORCEMENT LEVEL 4: Validate shipping recommendations against blockers
  // Use DYNAMIC DETECTION to check actual codebase state
  const detectionReport = await detectAllBlockers(process.cwd());
  const activeBlockers = detectionReport.blockers.filter(
    (b) => b.status !== 'COMPLETED' && b.blocksAll
  );

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

  // Log detection results
  console.log(
    `\n📊 DYNAMIC BLOCKER DETECTION: ${detectionReport.summary.completed}/${detectionReport.summary.totalBlockers} blockers resolved\n` +
      `   Current Phase: ${detectionReport.summary.currentPhase}\n` +
      `   Can Ship Features: ${detectionReport.summary.canShipFeatures ? 'YES' : 'NO'}\n`
  );

  // Only require blocker mention if there ARE active blockers
  if (activeBlockers.length > 0) {
    const blockerMentioned =
      activeBlockers.some((b) => output.includes(b.id)) ||
      output.includes('CANNOT SHIP') ||
      (output.includes('Phase 1') && output.includes('must complete'));

    if (hasShippingRecommendation && !blockerMentioned) {
      const blockerList = activeBlockers
        .map((b) => `${b.id}: ${b.name} (${b.effort}) - ${b.evidence.completionPercentage}% complete`)
        .join(', ');
      console.error(
        `\n❌ CRITICAL ENFORCEMENT VIOLATION: Agent recommends shipping without mentioning active blockers!\n` +
          `Active blockers (detected dynamically): ${blockerList}\n` +
          `Per DECISION_FRAMEWORK.md, all blockers with blocksAll=true must be resolved before shipping.\n`
      );
    }
  } else {
    // All blockers resolved - shipping recommendations are valid
    if (hasShippingRecommendation) {
      console.log(
        '\n✅ BLOCKER STATUS: All critical blockers resolved (verified by codebase scan). Shipping recommendation is valid.\n'
      );
    }

    // Auto-update BLOCKERS.md when all blockers are resolved
    const updateResult = await updateBlockersMdFile(process.cwd());
    if (updateResult.success) {
      console.log(`\n📝 AUTO-UPDATE: ${updateResult.message}\n`);
    }
  }

  // ENFORCEMENT LEVEL 5: Check for decision framework references
  const hasDecisionFrameworkReference =
    output.includes('DECISION_FRAMEWORK') ||
    output.includes('BLOCKERS.md') ||
    output.includes('ROADMAP.md') ||
    output.includes('Phase Gate') ||
    output.includes('Phase 1') ||
    output.includes('Phase 0');

  if (!hasDecisionFrameworkReference) {
    console.warn(
      '\n⚠️  ENFORCEMENT WARNING: Agent output does not reference decision framework.\n' +
        'For strategic recommendations, agent should cite DECISION_FRAMEWORK.md, BLOCKERS.md, or ROADMAP.md.\n'
    );
  }

  return output;
}
