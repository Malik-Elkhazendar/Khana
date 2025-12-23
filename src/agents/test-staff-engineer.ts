/**
 * Test/Example: Using the Staff Engineer Agent
 *
 * This file demonstrates how to use the staff engineer agent
 * to analyze your codebase and generate implementation prompts.
 *
 * To run:
 * npx ts-node src/agents/test-staff-engineer.ts
 */

import { analyzeAndGeneratePrompt } from './staff-engineer.agent';

async function main() {
  console.log('🔍 Staff Engineer Agent - Interactive Calendar Analysis\n');
  console.log('═'.repeat(80));

  // Example: Request analysis for the Interactive Calendar action panel
  const userRequest = `
I want to build the Interactive Calendar action panel feature that allows facility managers to:
1. Confirm pending bookings directly from the calendar
2. Mark payments as paid
3. Cancel bookings with reason tracking
4. View hold status and expiration time

Requirements:
- Reuse existing BookingStore for state
- Follow Desert Night design system
- Support RTL (Right-to-Left) for MENA region
- Implement keyboard accessibility
- Add confirmation dialogs before destructive actions
- Show toast notifications for success/error

The calendar view already exists in booking-calendar.component.ts.
I need guidance on the action panel enhancement.
  `;

  console.log('📋 User Request:');
  console.log(userRequest);
  console.log('\n═'.repeat(80));
  console.log('\n🤖 Staff Engineer Agent is analyzing...\n');

  try {
    const implementationPrompt = await analyzeAndGeneratePrompt(userRequest);

    console.log('✅ Generated Implementation Prompt:\n');
    console.log(implementationPrompt);

    console.log('\n═'.repeat(80));
    console.log('\n📝 Next Steps:');
    console.log('1. Copy the implementation prompt above');
    console.log('2. Follow the rules and patterns listed');
    console.log('3. Run: npm run lint:fix && npm run format');
    console.log('4. Implement the feature');
    console.log('5. Run: npm run lint && npm run test');
    console.log(
      '6. Commit: git add . && git commit -m "feat: add calendar action panel"'
    );
    console.log('\n✨ Pre-commit hooks will automatically validate!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the main function
main().catch(console.error);

/**
 * Example output structure:
 *
 * ## Task: Interactive Calendar Action Panel
 *
 * ### Business Context
 * Allow facility managers to manage bookings directly from the calendar view...
 *
 * ### Technical Scope
 * - Enhance booking-calendar.component.ts with action panel
 * - Create action-panel.component.ts for reusable actions
 * - Extend BookingStore with additional methods if needed
 *
 * ### Architecture Rules (MUST FOLLOW)
 * ✅ Reuse existing components: BookingStore, BookingCalendarComponent
 * ✅ Use @ngrx/signals for state (never RxJS subjects)
 * ... [more rules]
 *
 * ### Design System Rules
 * ✅ Desert Night theme only
 * ✅ Use CSS Logical Properties for RTL support
 * ... [more rules]
 *
 * ### Code Patterns
 * ✅ Angular Signals: signal<T>(), computed(() => ...)
 * ... [pattern examples]
 *
 * ### Validation Rules
 * ✅ ESLint must pass: npm run lint
 * ... [validation rules]
 */
