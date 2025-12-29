import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, sep } from 'path';
import { execSync } from 'child_process';

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
    architectureDoc: string;
    developmentGuideDoc: string;
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
    architecture: boolean;
    developmentGuide: boolean;
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
  menaMarketReadiness: {
    score: number;
    factors: string[];
    culturalFit: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  competitorAnalysis: {
    competitorCount: number;
    competitorFeatures: string[];
    differentiationOpportunity: number;
  };
  windowOfOpportunity: {
    isOpen: boolean;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    expiresIn?: string;
    reasoning: string;
  };
  strategicTiming: {
    shouldBuildNow: boolean;
    reasoning: string[];
  };
};

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
  tokensApplied: {
    colors: boolean;
    typography: boolean;
    spacing: boolean;
    borderRadius: boolean;
  };
  rtlSupport: {
    implemented: boolean;
    logicalPropertiesUsed: boolean;
    arabicFontsConfigured: boolean;
    issues: string[];
  };
  componentConsistency: {
    score: number;
    deviations: string[];
    missingComponents: string[];
  };
  accessibility: {
    wcagCompliance: 'AAA' | 'AA' | 'A' | 'NONE';
    contrastRatios: boolean;
    touchTargets: boolean;
    focusStates: boolean;
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
  const paths = {
    featuresDir: join(basePath, 'apps/manager-dashboard/src/app/features'),
    sharedComponentsDir: join(
      basePath,
      'apps/manager-dashboard/src/app/shared/components'
    ),
    bookingCalendarDir: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-calendar'
    ),
    bookingListDir: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-list'
    ),
    bookingPreviewDir: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-preview'
    ),
    bookingCalendarHtml: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.html'
    ),
    bookingCalendarTs: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-calendar/booking-calendar.component.ts'
    ),
    bookingListTs: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-list/booking-list.component.ts'
    ),
    bookingPreviewTs: join(
      basePath,
      'apps/manager-dashboard/src/app/features/booking-preview/booking-preview.component.ts'
    ),
    bookingStore: join(
      basePath,
      'apps/manager-dashboard/src/app/state/bookings/booking.store.ts'
    ),
    designSystemDoc: join(basePath, 'docs/DESIGN_SYSTEM.md'),
    architectureDoc: join(basePath, 'docs/ARCHITECTURE.md'),
    developmentGuideDoc: join(basePath, 'docs/DEVELOPMENT_GUIDE.md'),
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

  return {
    basePath,
    paths,
    features,
    sharedComponents,
    docs: {
      designSystem: existsSync(paths.designSystemDoc),
      architecture: existsSync(paths.architectureDoc),
      developmentGuide: existsSync(paths.developmentGuideDoc),
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

  const featureNames = ['booking-calendar', 'booking-list', 'booking-preview'];
  for (const featureName of featureNames) {
    const feature = scan.featureIndex[featureName];
    if (!feature) continue;

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

const buildArchitectureNotes = (scan: ProjectScan): string[] => {
  const notes: string[] = [];

  if (
    scan.calendar.hasDialogState &&
    !scan.store.hasDialogState &&
    !scan.architectureMentionsDialogState
  ) {
    notes.push(
      `Dialog state detected in booking-calendar.component.ts but not in BookingStore (${
        scan.paths.bookingStore
      }). Architecture doc explicit dialog-state rules: ${yesNo(
        scan.architectureMentionsDialogState
      )}. Treat as a design decision unless docs require store ownership.`
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

const buildActionPanelTasks = (scan: ProjectScan): string[] => {
  const tasks: string[] = [];
  const gaps = buildIntegrationGaps(scan);
  const structuralGaps = buildStructuralGaps(scan);
  const architectureNotes = buildArchitectureNotes(scan);
  const testGaps = buildTestGaps(scan);
  const qualityNotes = buildQualityNotes(scan);
  const hasWiringGaps = gaps.length > 0 || structuralGaps.length > 0;

  if (hasWiringGaps) {
    tasks.push(...gaps, ...structuralGaps);
  }

  if (
    scan.calendar.actions.confirm ||
    scan.calendar.actions.cancel ||
    scan.calendar.actions.markPaid
  ) {
    tasks.push(
      hasWiringGaps
        ? 'Validate dialog flows, cancellation reason handling, and hold timer behavior, and add tests.'
        : 'No wiring gaps detected. Validate dialog flows, cancellation reason handling, and hold timer behavior, and add tests.'
    );
    if (architectureNotes.length > 0) {
      tasks.push(...architectureNotes);
    }
    if (testGaps.length > 0) {
      tasks.push(...testGaps);
    }
    if (qualityNotes.length > 0) {
      tasks.push(...qualityNotes);
    }
  } else if (tasks.length === 0) {
    tasks.push(
      'Action panel actions not detected; build or expose calendar action handling first.'
    );
  }

  return tasks;
};

const isActionPanelFeature = (featureName: string): boolean => {
  const lower = featureName.toLowerCase();
  return lower.includes('action panel') || lower.includes('calendar');
};

const buildGeneralTasks = (scan: ProjectScan): string[] => {
  const tasks: string[] = [];
  const structuralGaps = buildStructuralGaps(scan);
  const testGaps = buildTestGaps(scan);
  const qualityNotes = buildQualityNotes(scan);

  if (structuralGaps.length > 0) {
    tasks.push(...structuralGaps);
  }
  if (testGaps.length > 0) {
    tasks.push(...testGaps);
  }
  if (qualityNotes.length > 0) {
    tasks.push(...qualityNotes);
  }

  if (scan.dependencyScan.unused.length > 0) {
    const unusedSample = scan.dependencyScan.unused.slice(0, 8).join(', ');
    tasks.push(
      `Remove unused dependencies (heuristic scan): ${
        unusedSample || 'see report'
      }.`
    );
  }
  if (scan.dependencyScan.missing.length > 0) {
    const missingSample = scan.dependencyScan.missing.slice(0, 8).join(', ');
    tasks.push(
      `Add missing dependencies for non-workspace imports: ${
        missingSample || 'see report'
      }.`
    );
  }
  if (scan.securityFindings.length > 0) {
    tasks.push('Review security-sensitive patterns and confirm they are safe.');
  }

  if (tasks.length === 0) {
    tasks.push(
      'No scan gaps detected. Identify the next product feature based on roadmap.'
    );
  }

  return tasks;
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
    'NOTE: This is ARIA pattern detection, NOT actual accessibility testing.'
  );
  details.push('Use aXe or Pa11y for real WCAG compliance validation.');

  return {
    score,
    details,
    confidence: 'PATTERN-BASED',
    source: 'ARIA attribute/keyboard handler detection',
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

const buildRecommendationScores = (
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[],
  businessScores: BusinessValueScore[],
  dependencyAnalysis: DependencyAnalysis,
  weights: RecommendationWeights
): RecommendationEntry[] => {
  const completenessMap = new Map(
    completenessScores.map((score) => [score.feature, score])
  );
  const businessMap = new Map(
    businessScores.map((score) => [score.feature, score])
  );

  const candidateFeatures = Array.from(businessMap.keys());

  return candidateFeatures.flatMap((feature) => {
    const completeness = completenessMap.get(feature);
    const business = businessMap.get(feature);
    if (!business) return [];
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
  const exists = Boolean(feature);
  const integrationTasks = isActionPanelFeature(featureName)
    ? buildActionPanelTasks(scan)
    : buildGeneralTasks(scan);

  const designRules: string[] = [];
  if (scan.docs.designSystem) {
    designRules.push(
      `Use Desert Night tokens from \`${scan.paths.designSystemDoc}\`.`
    );
  }
  if (scan.docs.architecture) {
    designRules.push(
      `Follow CSS logical properties guidance in \`${scan.paths.architectureDoc}\`.`
    );
  }
  if (designRules.length === 0) {
    designRules.push('Follow existing component styling patterns in the app.');
  }

  const storeRules: string[] = [];
  if (scan.store.exists) {
    storeRules.push(`Extend BookingStore at ${scan.paths.bookingStore}.`);
  }
  if (scan.store.usesSignals) {
    storeRules.push(
      'BookingStore uses @ngrx/signals; keep consistent patterns.'
    );
  }

  const steps: string[] = [];
  if (!exists) {
    const featureSlug = featureName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    steps.push(`Define the full user flows for ${featureName}.`);
    steps.push(
      `Create a new feature folder under apps/manager-dashboard/src/app/features/${featureSlug}.`
    );
    steps.push('Add routes and navigation entry for the new feature.');
    steps.push(
      'Build the core UI and wire data via BookingStore or API services.'
    );
  } else {
    steps.push('Address the scan-based gaps and missing flows.');
  }
  steps.push(...integrationTasks);
  if (completeness && completeness.testCoverage.score < 15) {
    steps.push('Add unit/integration tests for critical user flows.');
  }
  if (completeness && completeness.accessibility.score < 15) {
    steps.push(
      'Fix accessibility gaps (ARIA, keyboard support, focus management).'
    );
  }
  if (completeness && completeness.codeQuality.score < 15) {
    steps.push('Refactor complex or duplicated code paths.');
  }

  return `
## Task: ${featureName}

### Evidence Snapshot
- Features found: ${scan.features.join(', ') || '(none)'}
- Shared components found: ${scan.sharedComponents.join(', ') || '(none)'}
- Feature exists in repo: ${yesNo(exists)}${
    feature ? ` (${feature.path})` : ''
  } (feature: ${featureName})

### Implementation Goals
- Improve or deliver ${featureName} based on the analysis and scoring.
- Balance business value with technical health and maintainability.

### Integration Tasks (scan-based)
${formatList(integrationTasks)}

### Design Rules (evidence-based)
${formatList(designRules)}

### Store Rules (evidence-based)
${formatList(storeRules)}

### Implementation Steps
${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

### Validation
- npm run lint
- npm run format
- npx tsc --noEmit
- npm run test
`;
};

// ============================================================================
// DECISION REPORT GENERATOR (deprecated; not used by default agent)
// ============================================================================
/* eslint-disable @typescript-eslint/no-unused-vars -- deprecated report generator retained for reference */

/**
 * Generates comprehensive decision report with Phase 1 completion check,
 * UI/UX architecture analysis, market timing, and single feature decision.
 *
 * Report sections:
 * 1. Phase 1 Completion Analysis (blocker if <70%)
 * 2. UI/UX Architecture Decision (sidebar/layout refactor needed?)
 * 3. SINGLE DECISION (if Phase 1 complete)
 * 4. WHY THIS NEXT (4 dimensions + UI/UX)
 * 5. IMPLEMENTATION PLAN (exact file paths)
 * 6. SUCCESS METRICS
 * 7. BLOCKERS & RISKS
 * 8. Appendix: Full decision matrix
 */
function buildDecisionReport(
  scan: ProjectScan,
  phase1Report: Phase1CompletionReport,
  completeness: FeatureCompletenessMap,
  business: BusinessValueScore[],
  dependencies: DependencyMap,
  technicalHealth: TechnicalHealthReport,
  decisionMatrix: DecisionMatrix | null,
  uiuxAnalysis?: UIUXArchitectureAnalysis
): string {
  const sections: string[] = [];

  // Header
  sections.push('# STAFF ENGINEER DECISION REPORT\n');
  sections.push(`Generated: ${new Date().toISOString()}\n`);
  sections.push('---\n');

  // SECTION 1: Phase 1 Completion Analysis
  sections.push('## 1. PHASE 1 COMPLETION ANALYSIS\n');
  sections.push(
    `**Status**: ${
      phase1Report.overallComplete ? '✅ COMPLETE' : '🚧 INCOMPLETE'
    }\n`
  );
  sections.push(
    `**Average Completion**: ${phase1Report.averageCompletion.toFixed(
      1
    )}% (Target: ≥75%)\n\n`
  );

  for (const [featureName, analysis] of Object.entries(phase1Report.features)) {
    sections.push(
      `### ${featureName}: ${analysis.completionPercentage.toFixed(0)}%\n\n`
    );
    sections.push('**Quality Gates**:\n');
    sections.push(
      `- Implementation: ${
        analysis.qualityGates.implementation ? '✅' : '❌'
      }\n`
    );
    sections.push(
      `- Testing: ${analysis.qualityGates.testing ? '✅' : '❌'}\n`
    );
    sections.push(
      `- Accessibility: ${analysis.qualityGates.accessibility ? '✅' : '❌'}\n`
    );
    sections.push(
      `- Code Quality: ${analysis.qualityGates.codeQuality ? '✅' : '❌'}\n`
    );
    sections.push(
      `- Documentation: ${
        analysis.qualityGates.documentation ? '✅' : '❌'
      }\n\n`
    );

    if (analysis.blockers.length > 0) {
      sections.push('**Blockers**:\n');
      analysis.blockers.forEach((b) => sections.push(`- ${b}\n`));
      sections.push('\n');
    }
  }

  if (phase1Report.blockingIssues.length > 0) {
    sections.push('**🚨 BLOCKING ISSUES**:\n');
    phase1Report.blockingIssues.forEach((issue) =>
      sections.push(`- ${issue}\n`)
    );
    sections.push('\n');
  }

  if (phase1Report.recommendedActions.length > 0) {
    sections.push('**Recommended Actions**:\n');
    phase1Report.recommendedActions.forEach((action) =>
      sections.push(`- ${action}\n`)
    );
    sections.push('\n');
  }

  // If Phase 1 not complete, stop here
  if (!phase1Report.overallComplete) {
    sections.push('---\n');
    sections.push('**DECISION: BLOCKED**\n\n');
    sections.push(
      'Phase 1 features must be ≥70% complete (each) and ≥75% average before building new features.\n'
    );
    sections.push(
      'Focus on completing booking-calendar, booking-list, and booking-preview first.\n'
    );
    return sections.join('');
  }

  // SECTION 2: UI/UX Architecture Analysis
  if (uiuxAnalysis) {
    sections.push('---\n');
    sections.push('## 2. UI/UX ARCHITECTURE ANALYSIS\n\n');

    sections.push(
      `**Current Navigation**: ${uiuxAnalysis.navigation.currentPattern}\n`
    );
    sections.push(
      `**User Flow Complexity**: ${uiuxAnalysis.navigation.userFlowComplexity}\n`
    );
    sections.push(
      `**Design System Compliance**: ${uiuxAnalysis.designSystem.componentConsistency.score}%\n`
    );
    sections.push(
      `**RTL Support**: ${
        uiuxAnalysis.designSystem.rtlSupport.implemented ? '✅' : '❌'
      }\n`
    );
    sections.push(
      `**WCAG Compliance**: ${uiuxAnalysis.designSystem.accessibility.wcagCompliance}\n\n`
    );

    sections.push('**DECISION**:\n');
    if (uiuxAnalysis.decision.buildSidebarFirst) {
      sections.push('🚨 **BUILD SIDEBAR FIRST** before new features\n');
      sections.push(
        `Estimated effort: ${
          uiuxAnalysis.decision.estimatedEffort.sidebarImplementation || 0
        }h\n\n`
      );
    } else if (uiuxAnalysis.decision.refactorLayoutFirst) {
      sections.push(
        '⚠️  **REFACTOR LAYOUT FIRST** to improve design system compliance\n'
      );
      sections.push(
        `Estimated effort: ${
          uiuxAnalysis.decision.estimatedEffort.designSystemUpdates || 0
        }h\n\n`
      );
    } else {
      sections.push(
        '✅ **PROCEED WITH CURRENT UI** - No architectural blockers\n\n'
      );
    }

    sections.push('**Reasoning**:\n');
    uiuxAnalysis.decision.reasoning.forEach((r) => sections.push(`- ${r}\n`));
    sections.push('\n');
  }

  // SECTION 3: SINGLE DECISION (if available)
  if (decisionMatrix && decisionMatrix.winner.feature !== 'NONE') {
    const winner = decisionMatrix.winner;

    sections.push('---\n');
    sections.push('## 3. 🎯 DECISION: BUILD THIS NEXT\n\n');
    sections.push(`**Feature**: ${winner.feature}\n`);
    sections.push(
      `**Total Score**: ${(winner.totalScore * 100).toFixed(1)}/100\n\n`
    );

    sections.push('### WHY THIS FEATURE?\n\n');
    sections.push('**Scoring Breakdown**:\n');
    sections.push(
      `- Business Value (40%): ${(winner.factors.business.score * 100).toFixed(
        0
      )}% → ${(winner.factors.business.weightedScore * 100).toFixed(
        1
      )} points\n`
    );
    sections.push(
      `- Technical Foundation (25%): ${(
        winner.factors.technical.score * 100
      ).toFixed(0)}% → ${(winner.factors.technical.weightedScore * 100).toFixed(
        1
      )} points\n`
    );
    sections.push(
      `- Market Timing (20%): ${(winner.factors.market.score * 100).toFixed(
        0
      )}% → ${(winner.factors.market.weightedScore * 100).toFixed(1)} points\n`
    );
    sections.push(
      `- Dependency Impact (15%): ${(
        winner.factors.dependency.score * 100
      ).toFixed(0)}% → ${(
        winner.factors.dependency.weightedScore * 100
      ).toFixed(1)} points\n\n`
    );

    if (winner.whyNotOthers && winner.whyNotOthers.length > 0) {
      sections.push('**Why not others?**\n');
      winner.whyNotOthers.forEach((reason) => sections.push(`- ${reason}\n`));
      sections.push('\n');
    }

    // Generate implementation plan
    const implPlan = buildEnhancedImplementationPlan(
      winner.feature,
      scan,
      uiuxAnalysis
    );

    sections.push('---\n');
    sections.push('## 4. IMPLEMENTATION PLAN\n\n');
    sections.push(
      `**Total Effort**: ${implPlan.totalEffort.total}h (~${Math.ceil(
        implPlan.totalEffort.total / 8
      )} days)\n`
    );
    sections.push(`- Prerequisites: ${implPlan.totalEffort.prerequisites}h\n`);
    sections.push(`- Core Development: ${implPlan.totalEffort.core}h\n`);
    sections.push(`- Testing & Docs: ${implPlan.totalEffort.testing}h\n`);
    if (implPlan.totalEffort.uiRefactor > 0) {
      sections.push(`- UI Refactoring: ${implPlan.totalEffort.uiRefactor}h\n`);
    }
    if (implPlan.totalEffort.designSystem > 0) {
      sections.push(`- Design System: ${implPlan.totalEffort.designSystem}h\n`);
    }
    sections.push('\n');

    sections.push('### Tasks (in dependency order):\n\n');
    for (const taskId of implPlan.criticalPath) {
      const task = implPlan.tasks.find((t) => t.id === taskId);
      if (!task) continue;

      sections.push(`**${task.id}**: ${task.description}\n`);
      sections.push(
        `- File: \`${task.filePath}\`${
          task.lineNumber ? ` (line ${task.lineNumber})` : ''
        }\n`
      );
      sections.push(`- Operation: ${task.operation}\n`);
      sections.push(`- Effort: ${task.estimatedHours}h\n`);
      if (task.dependencies.length > 0) {
        sections.push(
          `- Depends on: ${task.dependencies.map((d) => d.taskId).join(', ')}\n`
        );
      }
      sections.push('\n');
    }

    sections.push('---\n');
    sections.push('## 5. SUCCESS METRICS\n\n');
    implPlan.successMetrics.forEach((metric) => {
      sections.push(`**${metric.name}** (${metric.type})\n`);
      sections.push(`- Target: ${metric.target}\n`);
      sections.push(`- Measurement: ${metric.measurement}\n\n`);
    });

    sections.push('---\n');
    sections.push('## 6. BLOCKERS & RISKS\n\n');
    implPlan.blockersAndRisks.forEach((risk) => {
      sections.push(`**${risk.description}**\n`);
      sections.push(
        `- Likelihood: ${risk.likelihood} | Impact: ${risk.impact}\n`
      );
      sections.push(`- Mitigation: ${risk.mitigation}\n\n`);
    });
  } else {
    sections.push('---\n');
    sections.push('## 3. DECISION: NO ELIGIBLE FEATURES\n\n');
    sections.push('No features available for decision-making.\n');
  }

  return sections.join('');
}

// ============================================================================
// Recommendation Report (tiered, evidence-based)
// ============================================================================
const buildRecommendationReport = (
  scan: ProjectScan,
  completenessScores: FeatureCompletenessScore[],
  businessScores: BusinessValueScore[],
  dependencyAnalysis: DependencyAnalysis,
  technicalHealth: TechnicalHealthReport,
  weights: RecommendationWeights
): string => {
  const businessScoresMissing = businessScores.length === 0;
  const anyBusinessUnavailable =
    !businessScoresMissing &&
    businessScores.some((score) => score.confidence === 'UNAVAILABLE');
  const effectiveWeights = weights;

  const recommendations = buildRecommendationScores(
    scan,
    completenessScores,
    businessScores,
    dependencyAnalysis,
    effectiveWeights
  ).sort((a, b) => b.score - a.score);

  const testCoverage = analyzeTestCoverage(scan);
  const criticalBlockers: string[] = [];
  for (const debt of technicalHealth.debtItems) {
    if (debt.priority === 'HIGH') {
      criticalBlockers.push(
        `${debt.issue} (Risk ${debt.risk}/10, Blocker ${debt.blocking}/10)`
      );
    }
  }

  // Check for critically low test coverage (score <= 16 or very few tests)
  const criticalTestGaps = testCoverage.filter((coverage) => {
    if (!coverage.feature.startsWith('booking-')) return false;
    // Flag if score is low OR if test count is very low (from buildTestGaps)
    const hasLowScore = coverage.score <= 16;
    return hasLowScore;
  });

  // Also check test gaps from buildTestGaps for specific low test counts
  const testGapsFromScan = buildTestGaps(scan);
  const lowTestCountFeatures = testGapsFromScan
    .filter((gap) => gap.includes('Low test coverage'))
    .map((gap) => {
      const match = gap.match(/in (booking-[^:]+):/);
      return match ? match[1] : null;
    })
    .filter((f): f is string => f !== null);

  // Combine both checks
  const allCriticalFeatures = new Set([
    ...criticalTestGaps.map((item) => item.feature),
    ...lowTestCountFeatures,
  ]);

  if (allCriticalFeatures.size > 0) {
    const featureDetails = Array.from(allCriticalFeatures).map((feature) => {
      const coverage = testCoverage.find((c) => c.feature === feature);
      return `${feature} (${coverage?.score ?? '?'}/25)`;
    });
    criticalBlockers.push(
      `Test coverage critically low on booking features: ${featureDetails.join(
        ', '
      )}. Minimum 10+ tests required per feature.`
    );
  }

  // Separate Tier 2 into new features and polish work for clearer prioritization
  const tier2Features = recommendations.filter(
    (rec) => rec.category === 'feature' && rec.subCategory === 'new'
  );
  const tier2Polish = recommendations.filter(
    (rec) => rec.category === 'feature' && rec.subCategory === 'polish'
  );

  const tier3 = [
    ...technicalHealth.debtItems.map(
      (item) =>
        `${item.issue} (Risk ${item.risk}/10, Remediation ${item.remediationHours}h, Value ${item.value}/10)`
    ),
  ];

  // Prefer new high-value features over polish work
  const topRecommendation =
    tier2Features[0] ?? tier2Polish[0] ?? recommendations[0];
  const prompt = topRecommendation
    ? buildImplementationPrompt(
        topRecommendation.feature,
        scan,
        completenessScores
      )
    : 'No recommendation available.';

  const codebaseSummaryLines = [
    `Features detected: ${scan.features.join(', ') || '(none)'}`,
    `Shared components: ${scan.sharedComponents.join(', ') || '(none)'}`,
    `Design system doc: ${yesNo(scan.docs.designSystem)} (${
      scan.paths.designSystemDoc
    })`,
    `Architecture doc: ${yesNo(scan.docs.architecture)} (${
      scan.paths.architectureDoc
    })`,
    `Development guide: ${yesNo(scan.docs.developmentGuide)} (${
      scan.paths.developmentGuideDoc
    })`,
    `Integration gaps: ${summarizeIntegrationGaps(
      technicalHealth.integrationGaps
    )}`,
    `Structural gaps: ${technicalHealth.structuralGaps.length}`,
    `Architecture notes: ${technicalHealth.architectureNotes.length}`,
  ];

  const completenessLines = completenessScores
    .map((score) => {
      // Helper function to format score with confidence indicator
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
        formatScoreWithConfidence(
          'Test coverage signal',
          score.testCoverage,
          25
        ),
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

  // Scan feature-level dependencies (internal imports, stores, components, etc.)
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
    'Shared dependencies (feature coupling):',
    formatList(dependencyAnalysis.blocking),
    '',
    'Missing feature references (import scan):',
    formatList(dependencyAnalysis.blocked),
    '',
    'Notable cross-feature uses:',
    formatList(dependencyAnalysis.notes),
    '',
    'Integration chains (heuristic):',
    formatList(dependencyAnalysis.chains),
  ].join('\n');

  const scoredFeatures = new Set(businessScores.map((score) => score.feature));
  const missingBusinessFeatures = scan.features.filter(
    (feature) => !scoredFeatures.has(feature)
  );

  const businessLines = businessScoresMissing
    ? 'SKIPPED: No business config files found (business-priority.json, feature-list.json, issues.json, feature-revenue.json).'
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

  const technicalLines = [
    'Architecture notes:',
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
    '',
    'Technical debt scoring:',
    formatList(
      technicalHealth.debtItems.map(
        (item) =>
          `${item.issue} (Risk ${item.risk}/10, Blocking ${item.blocking}/10, Remediation ${item.remediationHours}h, Value ${item.value}/10, Priority ${item.priority})`
      )
    ),
  ].join('\n');

  // Build Tier 2 output with separate NEW FEATURES and POLISH WORK sections
  const tier2NewFeaturesLines =
    tier2Features.length > 0
      ? '**NEW FEATURES (High Value)**\n' +
        tier2Features
          .map(
            (rec, index) =>
              `${index + 1}. ${rec.feature} (Score: ${
                rec.score
              }/100)\n   - User impact: ${
                rec.userImpact
              }/10\n   - Business value: ${
                rec.businessValue
              }/10\n   - Effort: ${
                rec.effortHours !== undefined
                  ? `${rec.effortHours} hours (${rec.effortConfidence}, ${rec.effortSource})`
                  : `UNKNOWN (${rec.effortSource})`
              }\n   - Why: ${rec.rationale.join(' ')}`
          )
          .join('\n')
      : '';

  const tier2PolishLines =
    tier2Polish.length > 0
      ? (tier2NewFeaturesLines ? '\n\n' : '') +
        '**POLISH WORK (Completion)**\n' +
        tier2Polish
          .map(
            (rec, index) =>
              `${index + 1}. ${rec.feature} (Score: ${
                rec.score
              }/100)\n   - User impact: ${
                rec.userImpact
              }/10\n   - Business value: ${
                rec.businessValue
              }/10\n   - Effort: ${
                rec.effortHours !== undefined
                  ? `${rec.effortHours} hours (${rec.effortConfidence}, ${rec.effortSource})`
                  : `UNKNOWN (${rec.effortSource})`
              }\n   - Why: ${rec.rationale.join(' ')}`
          )
          .join('\n')
      : '';

  const tier2Lines =
    tier2NewFeaturesLines || tier2PolishLines
      ? tier2NewFeaturesLines + tier2PolishLines
      : '- (none)';

  const tier1Lines =
    criticalBlockers.length > 0 ? formatList(criticalBlockers) : '- (none)';

  const nextSteps = [
    topRecommendation
      ? `Build: ${topRecommendation.feature} (score ${topRecommendation.score}/100).`
      : 'No top recommendation identified.',
    criticalBlockers.length > 0
      ? 'Address critical blockers first to reduce delivery risk.'
      : 'No critical blockers detected; prioritize high-value feature work.',
    tier3.length > 0
      ? 'Defer lower-impact technical debt until after high-value delivery.'
      : 'Reassess technical debt after feature delivery.',
    businessScoresMissing
      ? 'Business value assessment skipped; add business config files to enable.'
      : anyBusinessUnavailable
      ? 'Business value inputs incomplete; add missing data to business-priority.json.'
      : 'Business value scores include measured inputs.',
  ];

  return `## Codebase Analysis Summary
${formatList(codebaseSummaryLines)}

## Feature Completeness Report
${completenessLines || '- (none)'}

## Dependency Analysis
${dependencyLines}

## Business Value Assessment
${businessLinesWithMissing || '- (none)'}

## Technical Health Report
${technicalLines}

## Next Feature Recommendations (Prioritized)

### Tier 1: CRITICAL BLOCKERS
${tier1Lines}

### Tier 2: HIGH-VALUE FEATURES
${tier2Lines}

### Tier 3: TECHNICAL DEBT
${tier3.length > 0 ? formatList(tier3) : '- (none)'}

## Recommended Next Steps
${nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## Implementation Prompt
${prompt}
`;
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
      featureRequirements.required.length * 0.7; // 70% of required features

    checkpoints.push({
      name: 'Feature Requirements',
      met: featuresComplete,
      evidence: `Met: ${
        featureRequirements.met.join(', ') || 'none'
      }, Missing: ${featureRequirements.missing.join(', ') || 'none'}`,
      blockerLevel: featuresComplete ? 'LOW' : 'HIGH',
    });

    if (!featuresComplete) {
      blockers.push(
        `Missing feature requirements: ${featureRequirements.missing.join(
          ', '
        )}`
      );
      missingElements.push(...featureRequirements.missing);
    }

    // Quality Gate 2: Testing
    const testScore = completionScore.testCoverage.score;
    const testingComplete = testScore >= 12; // ≥50% threshold

    checkpoints.push({
      name: 'Unit Tests',
      met: testingComplete,
      evidence: `Test score: ${testScore}/25 (${completionScore.testCoverage.details.join(
        ', '
      )})`,
      blockerLevel: testingComplete ? 'LOW' : 'HIGH',
    });

    if (!testingComplete) {
      blockers.push(`Insufficient test coverage (score: ${testScore}/25)`);
      missingElements.push('comprehensive unit tests');
    }

    // Quality Gate 3: Accessibility
    const a11yScore = completionScore.accessibility.score;
    const a11yComplete = a11yScore >= 12; // ≥50% threshold

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
    const qualityComplete = qualityScore >= 18; // ≥75% threshold

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
 * 3. Design system readiness (Desert Night tokens, RTL, accessibility)
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
  let colorTokensUsed = 0;
  let typographyTokensUsed = 0;
  let spacingTokensUsed = 0;
  let borderRadiusTokensUsed = 0;
  let logicalPropertiesCount = 0;
  let physicalPropertiesCount = 0;

  for (const styleFile of styleFiles) {
    const content = safeRead(styleFile.path) || '';

    // Check Desert Night tokens
    if (/--color-primary|--color-accent|--color-surface/.test(content))
      colorTokensUsed++;
    if (/--font-display|--font-body|--text-/.test(content))
      typographyTokensUsed++;
    if (/--space-\d+/.test(content)) spacingTokensUsed++;
    if (/--radius-/.test(content)) borderRadiusTokensUsed++;

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

  const totalStyleFiles = styleFiles.length || 1;
  const tokensApplied = {
    colors: colorTokensUsed / totalStyleFiles > 0.5,
    typography: typographyTokensUsed / totalStyleFiles > 0.5,
    spacing: spacingTokensUsed / totalStyleFiles > 0.5,
    borderRadius: borderRadiusTokensUsed / totalStyleFiles > 0.3,
  };

  const rtlSupported = logicalPropertiesCount > physicalPropertiesCount;
  const arabicFontsConfigured = appComponentContent
    ? /Plex.*Arabic|Noto.*Arabic/.test(appComponentContent)
    : false;

  const rtlIssues: string[] = [];
  if (!rtlSupported)
    rtlIssues.push('Physical properties detected (should use logical)');
  if (!arabicFontsConfigured) rtlIssues.push('Arabic fonts not configured');
  if (physicalPropertiesCount > 10)
    rtlIssues.push(`${physicalPropertiesCount} physical property usages found`);

  const componentConsistencyScore =
    (tokensApplied.colors ? 25 : 0) +
    (tokensApplied.typography ? 25 : 0) +
    (tokensApplied.spacing ? 25 : 0) +
    (tokensApplied.borderRadius ? 25 : 0);

  const deviations: string[] = [];
  if (!tokensApplied.colors)
    deviations.push('Hardcoded colors instead of design tokens');
  if (!tokensApplied.typography)
    deviations.push('Inconsistent typography usage');
  if (!tokensApplied.spacing) deviations.push('Non-standard spacing values');

  // Check accessibility
  const contrastRatiosGood = tokensApplied.colors; // Desert Night has good contrast
  const touchTargetsGood = supportsMobile; // Assume touch targets if mobile support
  const focusStatesGood = hasRouting; // Router typically adds focus states

  const wcagCompliance: DesignSystemReadiness['accessibility']['wcagCompliance'] =
    contrastRatiosGood && touchTargetsGood && focusStatesGood
      ? 'AA'
      : contrastRatiosGood && touchTargetsGood
      ? 'A'
      : 'NONE';

  const designSystem: DesignSystemReadiness = {
    tokensApplied,
    rtlSupport: {
      implemented: rtlSupported,
      logicalPropertiesUsed: logicalPropertiesCount > 0,
      arabicFontsConfigured,
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
      contrastRatios: contrastRatiosGood,
      touchTargets: touchTargetsGood,
      focusStates: focusStatesGood,
    },
  };

  // Future design alignment
  const futureAlignment: FutureDesignAlignment = {
    clientSideVision: {
      targetUserFlow:
        'Intuitive navigation → Feature discovery → Action completion',
      plannedFeatures: [
        'Multi-facility management',
        'Analytics dashboard',
        'Customer portal',
      ],
      designEvolution: [
        'Scalable sidebar navigation',
        'Consistent Desert Night theming',
        'Full RTL support for Arabic users',
        'Mobile-first responsive design',
      ],
    },
    serverSideVision: {
      apiEndpoints: [
        '/api/facilities',
        '/api/bookings',
        '/api/analytics',
        '/api/customers',
      ],
      dataModels: ['Facility', 'Booking', 'Customer', 'Payment', 'Analytics'],
      businessLogicAlignment: [
        'RESTful API design matching UI navigation',
        'Real-time updates for booking status',
        'Multi-tenancy support for facility owners',
        'Payment integration for MENA region',
      ],
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
        ? ['Apply Desert Night design tokens consistently']
        : []),
      ...(rtlIssues.length > 0
        ? ['Convert to CSS Logical Properties for RTL support']
        : []),
      ...(wcagCompliance === 'NONE'
        ? ['Improve WCAG compliance to AA level']
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
      `Design system compliance at ${componentConsistencyScore}% (target: ≥75%)`,
      'Inconsistent use of Desert Night tokens detected',
      'RTL support needs improvement before production'
    );
    estimatedEffort.designSystemUpdates = 12; // 1.5 days
  }

  if (proceedWithCurrentUI) {
    reasoning.push(
      'Current navigation can accommodate new feature',
      'Design system compliance acceptable',
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
 * Analyzes market timing for feature implementation in MENA context.
 *
 * Evaluates:
 * 1. MENA market readiness (cultural fit, payment methods, mobile-first)
 * 2. Competitor analysis (differentiation opportunities)
 * 3. Window of opportunity (urgency, market gaps)
 * 4. Strategic timing (build now vs later)
 *
 * MENA-specific factors:
 * - Payment features: +2 score (high demand in MENA for diverse payment options)
 * - Booking features: +1 score (established pattern, table stakes)
 * - Mobile-first: +2 score (MENA has high mobile usage)
 * - Arabic/RTL: +1 score (cultural fit)
 */
function analyzeMarketTiming(feature: string): MarketTimingAnalysis {
  // MENA market readiness scoring
  let menaScore = 5; // Base score
  const factors: string[] = [];

  // Feature-specific MENA scoring
  const isPaymentFeature = /payment|checkout|billing|invoice|transaction/i.test(
    feature
  );
  const isBookingFeature = /booking|reservation|schedule|calendar/i.test(
    feature
  );
  const isAnalyticsFeature = /analytics|report|dashboard|insight|metrics/i.test(
    feature
  );
  const isCustomerFeature = /customer|client|user|profile|account/i.test(
    feature
  );
  const isCommunicationFeature =
    /notification|sms|email|whatsapp|message/i.test(feature);

  if (isPaymentFeature) {
    menaScore += 2;
    factors.push(
      'High MENA demand for flexible payment options (cash, card, installments)'
    );
    factors.push('Payment localization critical for Saudi market');
  }

  if (isBookingFeature) {
    menaScore += 1;
    factors.push(
      'Core booking functionality expected in MENA hospitality/sports sector'
    );
  }

  if (isAnalyticsFeature) {
    menaScore += 1;
    factors.push('Growing demand for data-driven decisions in MENA businesses');
  }

  if (isCustomerFeature) {
    menaScore += 1;
    factors.push(
      'Customer relationship features align with MENA business culture'
    );
  }

  if (isCommunicationFeature) {
    menaScore += 2;
    factors.push('WhatsApp/SMS notifications highly valued in MENA');
    factors.push('Mobile-first communication critical for engagement');
  }

  // Cultural fit assessment
  const culturalFit: MarketTimingAnalysis['menaMarketReadiness']['culturalFit'] =
    menaScore >= 8 ? 'HIGH' : menaScore >= 6 ? 'MEDIUM' : 'LOW';

  // Competitor analysis (heuristic-based)
  const competitorFeatures: string[] = [];
  let competitorCount = 0;
  let differentiationOpportunity = 5; // Base score

  if (isBookingFeature) {
    competitorCount = 8; // Many booking systems in market
    differentiationOpportunity = 3; // Lower opportunity
    competitorFeatures.push(
      'Basic booking calendar',
      'Slot management',
      'Customer database'
    );
  }

  if (isPaymentFeature) {
    competitorCount = 5; // Moderate competition for MENA payment integration
    differentiationOpportunity = 7; // Higher opportunity
    competitorFeatures.push(
      'Card payments',
      'MADA integration',
      'Invoice generation'
    );
    factors.push(
      'Opportunity: Integrated MENA payment methods (MADA, STC Pay, cash)'
    );
  }

  if (isAnalyticsFeature) {
    competitorCount = 3; // Lower competition for analytics
    differentiationOpportunity = 8; // High opportunity
    competitorFeatures.push('Basic reports', 'Revenue tracking');
    factors.push(
      'Opportunity: Real-time analytics with MENA business insights'
    );
  }

  if (isCommunicationFeature) {
    competitorCount = 4; // Moderate competition
    differentiationOpportunity = 7; // High opportunity
    competitorFeatures.push('Email notifications', 'SMS alerts');
    factors.push('Opportunity: WhatsApp Business API integration');
  }

  // Window of opportunity assessment
  const urgency: MarketTimingAnalysis['windowOfOpportunity']['urgency'] =
    differentiationOpportunity >= 7 && menaScore >= 7
      ? 'CRITICAL'
      : differentiationOpportunity >= 6
      ? 'HIGH'
      : differentiationOpportunity >= 4
      ? 'MEDIUM'
      : 'LOW';

  const isOpen = differentiationOpportunity >= 5;
  const expiresIn =
    urgency === 'CRITICAL'
      ? '3-6 months'
      : urgency === 'HIGH'
      ? '6-12 months'
      : urgency === 'MEDIUM'
      ? '12-18 months'
      : undefined;

  let windowReasoning = '';
  if (urgency === 'CRITICAL') {
    windowReasoning =
      'High differentiation opportunity with strong MENA market fit. Competitors likely to implement soon.';
  } else if (urgency === 'HIGH') {
    windowReasoning =
      'Good market opportunity with moderate competition. Strategic advantage if implemented well.';
  } else if (urgency === 'MEDIUM') {
    windowReasoning =
      'Standard feature with moderate competitive pressure. Implement when foundational features are complete.';
  } else {
    windowReasoning =
      'Low urgency feature. Focus on higher-priority items first.';
  }

  // Strategic timing recommendation
  const shouldBuildNow =
    (urgency === 'CRITICAL' || urgency === 'HIGH') &&
    culturalFit !== 'LOW' &&
    differentiationOpportunity >= 6;

  const timingReasoning: string[] = [];

  if (shouldBuildNow) {
    timingReasoning.push(
      'Strong market opportunity aligns with strategic goals'
    );
    timingReasoning.push(`${culturalFit} MENA cultural fit supports adoption`);
    if (differentiationOpportunity >= 7) {
      timingReasoning.push('High differentiation potential vs competitors');
    }
    if (isPaymentFeature) {
      timingReasoning.push(
        'Payment features drive revenue and reduce manual work'
      );
    }
    if (isCommunicationFeature) {
      timingReasoning.push(
        'Communication features improve customer engagement and retention'
      );
    }
  } else {
    timingReasoning.push(
      'Market timing suggests prioritizing foundational features first'
    );
    if (culturalFit === 'LOW') {
      timingReasoning.push(
        'Feature may require cultural adaptation before MENA rollout'
      );
    }
    if (differentiationOpportunity < 5) {
      timingReasoning.push(
        'Competitive landscape crowded; focus on unique value propositions'
      );
    }
  }

  return {
    feature,
    menaMarketReadiness: {
      score: menaScore,
      factors,
      culturalFit,
    },
    competitorAnalysis: {
      competitorCount,
      competitorFeatures,
      differentiationOpportunity,
    },
    windowOfOpportunity: {
      isOpen,
      urgency,
      expiresIn,
      reasoning: windowReasoning,
    },
    strategicTiming: {
      shouldBuildNow,
      reasoning: timingReasoning,
    },
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
 * - Market Timing: 20%
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

    // Factor 3: Market Timing (20% weight)
    const marketScore =
      (marketTiming.menaMarketReadiness.score / 10) * 0.4 +
      (marketTiming.competitorAnalysis.differentiationOpportunity / 10) * 0.6;
    const marketFactor: DecisionFactor = {
      name: 'Market Timing',
      score: marketScore,
      weight: 0.2,
      weightedScore: marketScore * 0.2,
      evidence: [
        `MENA market readiness: ${marketTiming.menaMarketReadiness.score}/10 (${marketTiming.menaMarketReadiness.culturalFit})`,
        `Differentiation opportunity: ${marketTiming.competitorAnalysis.differentiationOpportunity}/10`,
        `Window urgency: ${marketTiming.windowOfOpportunity.urgency}`,
        `Strategic timing: ${
          marketTiming.strategicTiming.shouldBuildNow ? 'BUILD NOW' : 'CAN WAIT'
        }`,
      ],
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
        `WARNING: Design system compliance at ${uiuxAnalysis.designSystem.componentConsistency.score}% (target: ≥75%)`
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
    )}% → ${(winner.factors.business.weightedScore * 100).toFixed(1)} points`,
    `Technical Foundation (25%): ${(
      winner.factors.technical.score * 100
    ).toFixed(0)}% → ${(winner.factors.technical.weightedScore * 100).toFixed(
      1
    )} points`,
    `Market Timing (20%): ${(winner.factors.market.score * 100).toFixed(
      0
    )}% → ${(winner.factors.market.weightedScore * 100).toFixed(1)} points`,
    `Dependency Impact (15%): ${(winner.factors.dependency.score * 100).toFixed(
      0
    )}% → ${(winner.factors.dependency.weightedScore * 100).toFixed(1)} points`,
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

/* eslint-enable @typescript-eslint/no-unused-vars */

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
 * - DESIGN_SYSTEM: Desert Night tokens, RTL support
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
      description:
        'Implement collapsible sidebar navigation with Desert Night theme',
      filePath:
        'apps/manager-dashboard/src/app/shared/components/sidebar.component.ts',
      operation: 'CREATE',
      estimatedHours: 16,
      dependencies: [],
      acceptanceCriteria: [
        'Sidebar renders with responsive collapsible behavior',
        'Desert Night design tokens applied',
        'RTL support via CSS Logical Properties',
        'Keyboard navigation and ARIA labels',
        'Mobile drawer mode for <768px screens',
      ],
    });
  }

  if (needsDesignSystem) {
    const dsTaskId = generateTaskId();
    tasks.push({
      id: dsTaskId,
      category: 'DESIGN_SYSTEM',
      description: 'Apply Desert Night tokens consistently across components',
      filePath: 'apps/manager-dashboard/src/styles.scss',
      lineNumber: 1,
      operation: 'MODIFY',
      estimatedHours: 12,
      dependencies: [],
      acceptanceCriteria: [
        'All components use CSS variables from DESIGN_SYSTEM.md',
        'Physical properties converted to logical (margin-left → margin-inline-start)',
        'Arabic font family configured in global styles',
        'WCAG AA contrast ratios verified',
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
      'DTO matches backend API contract',
      'TypeScript interfaces exported',
      'Validation decorators applied',
      'Documented with JSDoc comments',
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
      'CRUD methods implemented (GET, POST, PUT, DELETE)',
      'Error handling with Observable.catchError',
      'Loading states managed',
      'API paths follow RESTful conventions',
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
      'SignalStore with withState, withMethods, withHooks',
      'Optimistic updates with rollback on error',
      'Loading and error signals',
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
      'OnPush change detection strategy',
      'Accessibility attributes (ARIA labels, roles)',
      'Responsive layout with mobile breakpoints',
      'Error boundary for graceful failures',
    ],
  });

  const templateTaskId = generateTaskId();
  tasks.push({
    id: templateTaskId,
    category: 'CORE',
    description: `Create ${feature} template with Desert Night styling`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.html`,
    operation: 'CREATE',
    estimatedHours: 4,
    dependencies: [
      { taskId: componentTaskId, reason: 'Template for component' },
    ],
    acceptanceCriteria: [
      'Semantic HTML5 elements (header, main, section)',
      'CSS Logical Properties for RTL support',
      'Touch targets ≥48px for mobile',
      'Loading and error states rendered',
    ],
  });

  const styleTaskId = generateTaskId();
  tasks.push({
    id: styleTaskId,
    category: 'CORE',
    description: `Apply Desert Night tokens to ${feature} styles`,
    filePath: `apps/manager-dashboard/src/app/features/${feature}/${feature}.component.scss`,
    operation: 'CREATE',
    estimatedHours: 3,
    dependencies: [{ taskId: templateTaskId, reason: 'Styles for template' }],
    acceptanceCriteria: [
      'Uses design tokens (--color-*, --font-*, --space-*)',
      'No hardcoded colors or spacing values',
      'Responsive breakpoints (@media)',
      'Focus states with visible outline',
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
      'Route path defined (e.g., /${feature})',
      'Lazy loading configured',
      'Route guards if needed (auth)',
      'Title metadata for SEO',
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
      'Edge cases covered (≥80% coverage)',
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
      name: 'Test Coverage',
      target: '≥80%',
      measurement: 'Unit test coverage via Jest',
      type: 'TECHNICAL',
    },
    {
      name: 'WCAG Compliance',
      target: 'AA',
      measurement: 'axe DevTools audit passes',
      type: 'USER',
    },
    {
      name: 'User Adoption',
      target: '50% of target users within 2 weeks',
      measurement: 'Google Analytics usage tracking',
      type: 'BUSINESS',
    },
    {
      name: 'Design Consistency',
      target: '100% Desert Night tokens used',
      measurement: 'No hardcoded colors in SCSS',
      type: 'DESIGN',
    },
  ];

  // Identify blockers and risks
  const blockersAndRisks: BlockerRisk[] = [
    {
      description: 'Backend API not yet implemented',
      likelihood: 'MEDIUM',
      impact: 'HIGH',
      mitigation: 'Mock API with json-server or MSW for frontend development',
      isShared: false,
      isExternal: true,
    },
    {
      description: 'Shared DTO types may conflict with backend updates',
      likelihood: 'LOW',
      impact: 'MEDIUM',
      mitigation: 'Use API versioning and contract testing',
      isShared: true,
      isExternal: false,
    },
    {
      description: 'RTL support may reveal layout bugs',
      likelihood: 'MEDIUM',
      impact: 'MEDIUM',
      mitigation: 'Test with dir="rtl" throughout development',
      isShared: false,
      isExternal: false,
    },
    {
      description: 'SignalStore learning curve for team',
      likelihood: 'LOW',
      impact: 'LOW',
      mitigation: 'Pair programming and code review focus',
      isShared: false,
      isExternal: false,
    },
  ];

  if (needsSidebar) {
    blockersAndRisks.push({
      description: 'Sidebar refactor impacts all existing features',
      likelihood: 'HIGH',
      impact: 'HIGH',
      mitigation: 'Implement sidebar behind feature flag, gradual rollout',
      isShared: true,
      isExternal: false,
    });
  }

  return {
    feature,
    totalEffort,
    tasks,
    criticalPath,
    acceptanceCriteria: [
      'All tasks completed and acceptance criteria met',
      'Tests passing with ≥80% coverage',
      'No ESLint or TypeScript errors',
      'WCAG AA accessibility compliance',
      'Desert Night design system applied',
      'RTL support verified with Arabic locale',
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
  description: 'Analyze test coverage signals for each feature',
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
 * Tool 7: Ranked Recommendations
 */
const rankedRecommendationTool = tool({
  name: 'recommend_features_ranked',
  description: 'Rank features using weighted business and technical scoring',
  parameters: z.object({
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
  }),
  execute: async ({ weights, business_config }) => {
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
    const report = buildRecommendationReport(
      scan,
      completeness,
      business,
      dependencies,
      technicalHealth,
      resolvedWeights
    );
    return report;
  },
});

/**
 * Main Agent (Advanced Feature Recommender)
 */
export const staffEngineerNextFeatureAgent = new Agent({
  name: 'Staff Engineer - Advanced Feature Recommender',
  model: 'gpt-5-nano',
  instructions: `You are a Staff Engineer recommender for the Khana booking platform.

YOUR TASK: Analyze the Khana codebase and produce the advanced feature recommendation report.

WORKFLOW:
1. Scan project state and feature completeness.
2. Analyze dependencies, business value, and technical health.
3. Rank recommendations using weighted scoring.
4. Provide a prioritized report with tiers and an implementation prompt for the top recommendation.

RULES:
- Base findings on scan/config evidence; do not invent features or scores.
- If business config is missing, say so and leave business scores empty.
- Use the recommend_features_ranked tool output as the final response.

OUTPUT FORMAT (use recommend_features_ranked tool):
1. Codebase Analysis Summary
2. Feature Completeness Report
3. Dependency Analysis
4. Business Value Assessment
5. Technical Health Report
6. Next Feature Recommendations (Prioritized)
7. Recommended Next Steps
8. Implementation Prompt`,
  tools: [
    projectStateAnalyzer,
    featureCompletenessAnalyzer,
    testCoverageAnalyzer,
    dependencyAnalyzer,
    businessValueAnalyzer,
    technicalHealthAnalyzer,
    rankedRecommendationTool,
  ],
});

/**
 * Main entry point
 */
export async function analyzeAndRecommendNextFeature(): Promise<string> {
  const result = await run(
    staffEngineerNextFeatureAgent,
    'Analyze the Khana codebase and produce the advanced feature recommendation report.',
    {
      maxTurns: 10,
    }
  );
  return result.finalOutput ?? '';
}
