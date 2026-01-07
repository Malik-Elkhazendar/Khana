/**
 * Staff Engineer Agent - CLI Entry Point
 *
 * Analyzes the Khana codebase and recommends the next feature to build.
 * This script is invoked by the /staff-engineer custom command.
 *
 * Usage: npx ts-node src/agents/run-analysis.ts [mode]
 * Modes: next-feature (default), custom-request
 */

// Load environment variables from .env file
import 'dotenv/config';

import { analyzeAndRecommendNextFeature } from './staff-engineer-next-feature.agent';
import { analyzeAndGeneratePrompt } from './staff-engineer.agent';
import { loadAuthoritativeDocs } from './authoritative-loader';
import {
  AUTHORITATIVE_FAILURE_MESSAGE,
  NEXT_FEATURE_TAGS,
  STAFF_ENGINEER_TAGS,
} from './authoritative-config';

async function main() {
  const mode = process.argv[2] || 'next-feature';
  const customRequest = process.argv[3];

  try {
    const tags =
      mode === 'next-feature' ? NEXT_FEATURE_TAGS : STAFF_ENGINEER_TAGS;
    const loaded = await loadAuthoritativeDocs(tags);
    if (loaded.status !== 'success') {
      console.log(AUTHORITATIVE_FAILURE_MESSAGE);
      process.exit(1);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('🚀 STAFF ENGINEER AGENT');
    console.log('═'.repeat(80) + '\n');

    if (mode === 'next-feature') {
      console.log('📊 Analyzing Khana codebase...\n');
      const result = await analyzeAndRecommendNextFeature();
      console.log(result);
    } else if (mode === 'custom' && customRequest) {
      console.log(`📝 Analyzing request: "${customRequest}"\n`);
      const result = await analyzeAndGeneratePrompt(customRequest);
      console.log(result);
    } else {
      console.error('❌ Invalid mode or missing request parameter');
      process.exit(1);
    }

    console.log('\n' + '═'.repeat(80));
    console.log(
      '✅ Analysis complete. Follow the implementation prompt above.'
    );
    console.log('═'.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    process.exit(1);
  }
}

main();
