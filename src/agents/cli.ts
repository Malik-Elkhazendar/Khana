#!/usr/bin/env node

/**
 * Staff Engineer Agent CLI
 *
 * Interactive command-line interface for the Staff Engineer Agent.
 *
 * Usage:
 *   npm run staff-engineer
 *   npm run staff-engineer -- "Add a new feature for booking management"
 *   npm run staff-engineer -- --quick
 */

import * as readline from 'readline';
import { analyzeAndGeneratePrompt } from './staff-engineer.agent';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(
    '\n╔════════════════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║                         KHANA STAFF ENGINEER AGENT                         ║'
  );
  console.log(
    '║                                                                            ║'
  );
  console.log(
    '║  I analyze your codebase and generate implementation prompts that:         ║'
  );
  console.log(
    '║  ✅ Prevent duplicate features                                            ║'
  );
  console.log(
    '║  ✅ Enforce architectural consistency                                      ║'
  );
  console.log(
    '║  ✅ Follow established patterns (SignalStore, Angular signals)            ║'
  );
  console.log(
    '║  ✅ Ensure design system compliance (Desert Night, RTL)                   ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════════════╝\n'
  );

  // Check for command line arguments
  const args = process.argv.slice(2);

  let userRequest: string;

  if (args.length > 0) {
    // Use command line argument
    userRequest = args.join(' ');
  } else {
    // Interactive mode
    console.log('What do you want to build or improve?\n');
    console.log('Examples:');
    console.log(
      '  • "Add interactive calendar action panel for booking management"'
    );
    console.log(
      '  • "Create facility availability filter for the booking view"'
    );
    console.log('  • "Build admin dashboard for facility management"\n');

    userRequest = await question('📝 Your request: ');

    if (!userRequest.trim()) {
      console.log(
        '\n❌ No request provided. Use: npm run staff-engineer -- "your feature description"'
      );
      rl.close();
      process.exit(1);
    }
  }

  console.log(
    '\n═════════════════════════════════════════════════════════════════════════════\n'
  );
  console.log('🔍 Staff Engineer Agent is analyzing your codebase...\n');
  console.log('   Scanning features/');
  console.log('   Scanning state/');
  console.log('   Checking ARCHITECTURE.md');
  console.log('   Detecting duplicates');
  console.log('   Generating prompt...\n');

  try {
    const implementationPrompt = await analyzeAndGeneratePrompt(userRequest);

    console.log(
      '═════════════════════════════════════════════════════════════════════════════\n'
    );
    console.log('✅ IMPLEMENTATION PROMPT GENERATED\n');
    console.log(implementationPrompt);

    console.log(
      '\n═════════════════════════════════════════════════════════════════════════════\n'
    );
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Copy the prompt above (or save to file)');
    console.log(
      '2. Review the Architecture Rules, Design System Rules, and Code Patterns'
    );
    console.log('3. Pre-implementation:\n');
    console.log('   npm run lint:fix && npm run format\n');
    console.log('4. Implement the feature following the prompt');
    console.log('5. Post-implementation:\n');
    console.log('   npm run lint');
    console.log('   npm run test\n');
    console.log('6. Commit (pre-commit hooks will auto-validate):\n');
    console.log('   git add .');
    console.log('   git commit -m "feat: your feature description"\n');

    // Ask if they want to save to file
    const saveToFile = await question(
      '💾 Save this prompt to a file? (yes/no) [no]: '
    );

    if (
      saveToFile.toLowerCase() === 'yes' ||
      saveToFile.toLowerCase() === 'y'
    ) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      const filename = `prompt-${timestamp}.md`;
      const fs = await import('fs').then((m) => m.promises);

      try {
        await fs.writeFile(
          filename,
          `# Implementation Prompt - ${new Date().toLocaleString()}\n\n${implementationPrompt}`
        );
        console.log(`\n✅ Saved to: ${filename}`);
      } catch (error) {
        console.log(`\n❌ Failed to save: ${error}`);
      }
    }

    console.log('\n✨ Happy coding!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
