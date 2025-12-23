# Khana Development Guide

Welcome to the Khana project development guide. This guide covers code quality standards, development workflows, and best practices for the team.

## Table of Contents

1. [Introduction & Philosophy](#introduction--philosophy)
2. [Quick Start for New Developers](#quick-start-for-new-developers)
3. [Daily Development Workflow](#daily-development-workflow)
4. [Code Quality Tools Reference](#code-quality-tools-reference)
5. [Component Creation Checklist](#component-creation-checklist)
6. [Common ESLint Errors & Solutions](#common-eslint-errors--solutions)
7. [Testing Guide](#testing-guide)
8. [Bypassing Hooks](#bypassing-hooks-when--how)
9. [Troubleshooting](#troubleshooting)

---

## Introduction & Philosophy

Khana is built with **quality-first principles**. Every pull request must pass code quality checks before merging. This isn't about being pedantic—it's about:

- **Consistency**: Everyone writes code the same way
- **Readability**: New developers can understand existing code
- **Maintainability**: Technical debt is minimized
- **Reliability**: Fewer bugs make it to production

### Our Standards

- **ESLint**: Static code analysis catches bugs and enforces patterns
- **Prettier**: Automatic code formatting removes formatting debates
- **Jest**: Unit tests ensure components work correctly
- **Playwright**: E2E tests validate real user workflows
- **TypeScript**: Strict type checking prevents entire categories of bugs
- **Git Hooks**: Automatic pre-commit validation prevents breaking changes

### When to Ask for Help

- **"How do I fix this ESLint error?"** → See [Common ESLint Errors](#common-eslint-errors--solutions)
- **"Why is Prettier reformatting my code?"** → Read [Code Quality Tools](#code-quality-tools-reference)
- **"Can I skip these checks?"** → Yes, see [Bypassing Hooks](#bypassing-hooks-when--how) (sparingly!)
- **"Something broke after my changes"** → See [Troubleshooting](#troubleshooting)

---

## Quick Start for New Developers

### Initial Setup (First Time Only)

```bash
# 1. Clone the repository
git clone <repository-url>
cd khana

# 2. Install dependencies (including dev tools)
npm install

# 3. Verify setup
npm run lint        # Should pass with no errors
npm run test        # Should pass with all tests
npm run build       # Should complete without errors
```

### Verify Git Hooks Are Working

```bash
# Try to commit a file with intentional formatting issues
echo "const x=1" > test.js
git add test.js

# This should FAIL because Prettier will fix formatting
# You'll see: "ESLint and Prettier are fixing files..."
git commit -m "test commit"

# Delete test file
git rm test.js
```

If the commit failed, you're all set! The pre-commit hooks are working.

---

## Daily Development Workflow

### 1. Start Your Day

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Run all checks to ensure nothing is broken
npm run check
# This runs: lint + test + build
```

### 2. Create a Feature Branch

```bash
# Create feature branch from main
git checkout main
git pull
git checkout -b feature/add-booking-confirmation

# Branch naming convention:
# - feature/short-description
# - fix/short-description
# - refactor/short-description
# - docs/short-description
```

### 3. Make Your Changes

```bash
# Edit files, create components, write tests
# The code quality tools will help you as you go

# Before committing, run local checks
npm run lint:fix    # Auto-fix formatting and some linting issues
npm run test        # Run tests
npm run format      # Format all code
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit (pre-commit hooks will run automatically)
git commit -m "feat: add booking confirmation modal"

# If pre-commit checks fail:
# - Fix errors in your editor
# - Re-add the files
# - Try commit again
```

If ESLint or Prettier makes changes:

```bash
# Review the changes (auto-fixed by the hook)
git diff

# If satisfied, stage and commit again
git add .
git commit -m "feat: add booking confirmation modal"
```

### 5. Push and Create PR

```bash
# Push your branch
git push origin feature/add-booking-confirmation

# Create Pull Request on GitHub
# - Add descriptive title
# - Reference any related issues
# - Fill out PR template if present

# CI/CD will run full checks (lint + test + build)
# All must pass before merge
```

### 6. Code Review & Merge

- Team members review your code
- CI/CD runs automated checks
- Once approved, squash and merge to main
- Delete your feature branch

---

## Code Quality Tools Reference

### ESLint: Static Code Analysis

**Purpose**: Catches bugs, enforces patterns, ensures consistency

**Runs On**: Every commit (changed files only), every push (CI/CD)

**Key Rules**:

- No unused variables: `const unused = 5;` ❌
- No missing keys in loops: `{items.map(item => (...))}` needs key prop ❌
- No console logs in production code: `console.log()` ❌
- No hardcoded values: Strings/numbers should be constants or config ❌
- Proper typing: All function parameters and returns should be typed ❌
- Module boundaries: Can't import across Nx workspace boundaries ❌

**Example Fix**:

```typescript
// ❌ BEFORE: ESLint Error
const BookingCard = ({ booking }) => {
  return (
    <div>
      <h1>{booking.title}</h1>
      <p>{booking.description}</p>
      <button onClick={() => console.log('clicked')}>{booking.status === 'pending' ? 'Confirm' : 'Done'}</button>
    </div>
  );
};

// ✅ AFTER: Fixes applied
const BookingCard = ({ booking }: { booking: Booking }): JSX.Element => {
  const PENDING_TEXT = 'Confirm';
  const DONE_TEXT = 'Done';

  const handleClick = (): void => {
    // Removed console.log, added proper handler
  };

  return (
    <div key={booking.id}>
      <h1>{booking.title}</h1>
      <p>{booking.description}</p>
      <button onClick={handleClick}>{booking.status === 'pending' ? PENDING_TEXT : DONE_TEXT}</button>
    </div>
  );
};
```

**Run ESLint**:

```bash
npm run lint              # Check for errors
npm run lint:fix          # Auto-fix fixable errors
npm run lint:all          # Check entire workspace
```

### Prettier: Code Formatter

**Purpose**: Automatic formatting removes formatting debates

**Rules**:

- Single quotes (not double quotes)
- 2-space indentation
- Consistent line breaks
- Consistent spacing

**Runs On**: Every commit (changed files only)

**Example**:

```typescript
// ❌ BEFORE: Inconsistent formatting
const data: BookingData = { title: 'My Booking', status: 'pending', guests: 4 };

// ✅ AFTER: Prettier formats automatically
const data: BookingData = { title: 'My Booking', status: 'pending', guests: 4 };
```

**Never Edit Prettier Config** - It's standardized for the team. If formatting bothers you, that's the point—everyone writes identically.

**Run Prettier**:

```bash
npm run format            # Format all changed files
npm run format:check      # Check if files need formatting
```

### TypeScript: Type Safety

**Purpose**: Catch type errors before runtime

**Key Patterns in Khana**:

#### Angular Component with Signals

```typescript
import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  template: `...`,
})
export class BookingFormComponent {
  // Input signal: receives data from parent
  booking = input.required<Booking>();

  // Output signal: sends data to parent
  saved = output<Booking>();

  // Internal signal: local component state
  formData = signal<BookingFormData>({ guests: 1 });

  // Computed value: reactive derived state
  totalPrice = computed(() => {
    return this.formData().guests * this.booking().pricePerGuest;
  });

  // Method with proper typing
  onSave(): void {
    const newBooking: Booking = {
      ...this.booking(),
      ...this.formData(),
    };
    this.saved.emit(newBooking);
  }
}
```

#### NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '@khana/shared-dtos';

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>
  ) {}

  // Always type parameters and return values
  async createBooking(data: CreateBookingDto): Promise<Booking> {
    const booking: Booking = this.bookingRepo.create(data);
    return this.bookingRepo.save(booking);
  }

  async getBooking(id: string): Promise<Booking | null> {
    return this.bookingRepo.findOneBy({ id });
  }
}
```

#### Using Shared DTOs

```typescript
// ✅ GOOD: Use shared types across monorepo
import { Booking, CreateBookingDto } from '@khana/shared-dtos';

const booking: Booking = { id: '1', title: 'My Booking' };

// ❌ BAD: Never duplicate types
type MyBooking = { id: string; title: string }; // Don't do this!
```

**Run TypeScript Check**:

```bash
npx tsc --noEmit       # Check types without emitting
```

### Jest: Unit Testing

**Purpose**: Verify components and services work correctly

**Basic Test Structure**:

```typescript
import { render, screen } from '@testing-library/angular';
import { BookingCard } from './booking-card.component';

describe('BookingCard', () => {
  it('should display booking title', async () => {
    const booking = { id: '1', title: 'My Booking' };

    const { fixture } = await render(BookingCard, {
      componentProperties: { booking },
    });

    expect(screen.getByText('My Booking')).toBeInTheDocument();
  });

  it('should emit save event when save button clicked', async () => {
    const booking = { id: '1', title: 'My Booking' };
    const { fixture } = await render(BookingCard, {
      componentProperties: { booking },
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveButton);

    expect(component.saved.emit).toHaveBeenCalledWith(booking);
  });
});
```

**Run Tests**:

```bash
npm run test              # Run all tests once
npm run test:watch       # Run tests, re-run on file changes
npm run test:all         # Test entire workspace
```

### Playwright: E2E Testing

**Purpose**: Verify real user workflows work end-to-end

**Basic Test Structure**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should create booking successfully', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:4200');

    // Fill form
    await page.fill('input[name="title"]', 'My Booking');
    await page.fill('input[name="guests"]', '4');

    // Submit
    await page.click('button:has-text("Create Booking")');

    // Verify success
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    await expect(page.locator('text=Booking Created')).toBeVisible();
  });
});
```

**Run Playwright**:

```bash
npx nx test apps/manager-dashboard-e2e   # Run E2E tests
```

---

## Component Creation Checklist

When creating a new Angular component, follow this checklist:

### Structural

- [ ] Component is standalone (`standalone: true`)
- [ ] Selector follows convention: `app-feature-name`
- [ ] Component in dedicated file: `feature-name.component.ts`
- [ ] Inputs defined with `input()` or `input.required<Type>()`
- [ ] Outputs defined with `output<Type>()`
- [ ] All parameters have explicit types
- [ ] All return values have explicit types

### Example

```typescript
import { Component, input, output, signal, computed } from '@angular/core';

@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, NgIf],
  template: `
    <div class="booking-card">
      <h2>{{ booking().title }}</h2>
      <p>{{ booking().description }}</p>
      <button (click)="onEdit()">Edit</button>
    </div>
  `,
  styles: [
    `
      .booking-card {
        border: 1px solid #ccc;
        padding: 16px;
        border-radius: 8px;
      }
    `,
  ],
})
export class BookingCardComponent {
  booking = input.required<Booking>();
  edited = output<Booking>();

  onEdit(): void {
    this.edited.emit(this.booking());
  }
}
```

### Functionality

- [ ] All user interactions have handlers
- [ ] No hardcoded values (use constants or config)
- [ ] No `console.log()` statements in production code
- [ ] Proper error handling
- [ ] Loading/error states handled
- [ ] Accessible (semantic HTML, ARIA labels)

### State Management

- [ ] Use signals for reactive state: `signal()`
- [ ] Use computed for derived state: `computed()`
- [ ] Use SignalStore for shared state
- [ ] Avoid manual subscriptions (use signals instead)

### Testing

- [ ] Unit tests for component logic
- [ ] Tests for all user interactions
- [ ] Tests for edge cases
- [ ] Test coverage ≥80% for components

### Code Quality

- [ ] No ESLint errors: `npm run lint`
- [ ] Properly formatted: `npm run format`
- [ ] Types compile: `npx tsc --noEmit`
- [ ] Tests pass: `npm run test`

---

## Common ESLint Errors & Solutions

### Error 1: Unused Variables

**Message**: `'variable' is defined but never used`

```typescript
// ❌ ERROR
const result = calculateTotal(items);
return totalPrice;

// ✅ FIXED
const totalPrice = calculateTotal(items);
return totalPrice;

// OR if not needed
// (remove the variable entirely)
return calculateTotal(items);
```

### Error 2: Missing TypeScript Types

**Message**: `Missing return type on function`

```typescript
// ❌ ERROR
export const formatDate = (date) => {
  return date.toLocaleDateString();
};

// ✅ FIXED
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString();
};
```

### Error 3: Console Logs in Production

**Message**: `Unexpected console statement`

```typescript
// ❌ ERROR (in component/service code)
export class BookingService {
  createBooking(data: BookingData): Booking {
    console.log('Creating booking:', data); // ❌ Remove this
    return this.repo.save(data);
  }
}

// ✅ FIXED
export class BookingService {
  private readonly logger = inject(Logger); // Use proper logging

  createBooking(data: BookingData): Booking {
    this.logger.debug('Creating booking:', data); // Use logger service
    return this.repo.save(data);
  }
}

// ✅ Console.log is ALLOWED only in tests
it('should log message', () => {
  console.log('test message'); // ✅ OK in tests
  expect(true).toBe(true);
});
```

### Error 4: Hardcoded Values

**Message**: `String literals should be constants`

```typescript
// ❌ ERROR
export class BookingList {
  bookings = signal<Booking[]>([]);

  onFilterPending(): void {
    this.bookings.set(this.bookings().filter((b) => b.status === 'pending'));
  }
}

// ✅ FIXED: Extract constants
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

export class BookingList {
  bookings = signal<Booking[]>([]);

  onFilterPending(): void {
    this.bookings.set(this.bookings().filter((b) => b.status === BOOKING_STATUS.PENDING));
  }
}
```

### Error 5: Missing React/Angular Keys

**Message**: `Missing 'key' prop for element in list`

```typescript
// ❌ ERROR
export const BookingList = ({ bookings }: Props): JSX.Element => {
  return (
    <ul>
      {bookings.map((booking) => (
        <li>{booking.title}</li>
      ))}
    </ul>
  );
};

// ✅ FIXED: Add unique key
export const BookingList = ({ bookings }: Props): JSX.Element => {
  return (
    <ul>
      {bookings.map((booking) => (
        <li key={booking.id}>{booking.title}</li>
      ))}
    </ul>
  );
};
```

### Error 6: Prettier Formatting

**Message**: Code doesn't match Prettier format (during pre-commit)

```typescript
// ❌ ERROR: Inconsistent formatting
const data={title:"My Booking",guests:4,status:"pending"}

// ✅ AUTO-FIXED by Prettier
const data = { title: 'My Booking', guests: 4, status: 'pending' };

// Solution: Let Prettier fix it automatically
npm run format
```

---

## Testing Guide

### Unit Tests (Jest)

**When**: Test component logic, service methods, utilities

**Location**: `*.spec.ts` files next to implementation

**Example**:

```typescript
import { render, screen, fireEvent } from '@testing-library/angular';
import { BookingForm } from './booking-form.component';
import { BookingService } from '../services/booking.service';

describe('BookingForm', () => {
  let service: BookingService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingForm],
      providers: [BookingService],
    }).compileComponents();

    service = TestBed.inject(BookingService);
  });

  it('should submit form with valid data', async () => {
    const { fixture } = await render(BookingForm);

    await fireEvent.click(screen.getByLabelText(/title/i));
    await fireEvent.type(screen.getByLabelText(/title/i), 'My Booking');

    await fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(service.createBooking).toHaveBeenCalledWith(expect.objectContaining({ title: 'My Booking' }));
  });

  it('should show error on invalid submission', async () => {
    const { fixture } = await render(BookingForm);

    await fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});
```

**Run Tests**:

```bash
npm run test              # Run all tests once
npm run test:watch       # Re-run on file changes
npm run test:all         # Test entire workspace
```

### E2E Tests (Playwright)

**When**: Test complete user workflows

**Location**: `apps/*/e2e/src/*.spec.ts`

**Example**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Booking Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app before each test
    await page.goto('http://localhost:4200/bookings/new');
  });

  test('should create booking with valid data', async ({ page }) => {
    // Fill form fields
    await page.fill('input[placeholder="Title"]', 'Court Reservation');
    await page.fill('input[placeholder="Guests"]', '4');
    await page.selectOption('select[name="status"]', 'pending');

    // Submit form
    await page.click('button:has-text("Create Booking")');

    // Verify navigation to success page
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // Verify success message
    await expect(page.locator('text=Booking created successfully')).toBeVisible();
  });

  test('should show validation errors', async ({ page }) => {
    // Try to submit empty form
    await page.click('button:has-text("Create Booking")');

    // Verify error messages
    await expect(page.locator('text=Title is required')).toBeVisible();
    await expect(page.locator('text=Guests is required')).toBeVisible();
  });
});
```

**Run E2E Tests**:

```bash
# Run E2E tests for manager dashboard
npx nx test apps/manager-dashboard-e2e

# Run with specific browser
npx nx test apps/manager-dashboard-e2e --browser=firefox
```

### Test Coverage

```bash
# Generate coverage report
npm run test -- --coverage

# View coverage for specific file
npm run test -- libs/shared-utils --coverage
```

---

## Bypassing Hooks (When & How)

### When You Might Need to Bypass

❌ **DON'T bypass for**:

- "I don't want to fix the errors"
- "The check is too strict"
- "I'm in a hurry"

✅ **OK to bypass for**:

- Emergency hotfix needed immediately
- Debugging production issue
- Experimental branch you'll delete anyway
- Temporary test code

### How to Bypass

```bash
# Bypass pre-commit hooks (NOT recommended)
git commit --no-verify

# Bypass with short flag
git commit -nm "commit message"

# ⚠️ WARNING
# CI/CD will STILL run checks on push/PR
# Your PR will fail if you bypass locally
# Better to fix issues now than in CI
```

### Better Alternative: Fix Issues Locally

```bash
# Auto-fix most ESLint/Prettier issues
npm run lint:fix

# Format code
npm run format

# Stage and commit
git add .
git commit -m "fix: resolve code quality issues"
```

---

## Troubleshooting

### Problem: "Pre-commit hook failed"

**Symptom**: `husky - pre-commit hook exited with code 1`

**Solution**:

```bash
# 1. See what failed
npm run lint              # Show ESLint errors
npm run format:check      # Show formatting issues

# 2. Fix errors
npm run lint:fix          # Auto-fix what it can

# 3. Manual fixes for remaining issues (follow suggestions)

# 4. Stage and try commit again
git add .
git commit -m "feat: description"
```

### Problem: "Prettier keeps changing my code"

**Symptom**: Formatting changes every time you run prettier

**Solution**: You have conflicting formatting tools. Run all formatting commands:

```bash
npm run lint:fix          # Fix ESLint issues first
npm run format            # Then run Prettier
git add .
git commit -m "style: apply code formatting"
```

### Problem: "ESLint says unused import but I use it"

**Symptom**: ESLint error but you're sure you use it

**Common causes**:

```typescript
// ❌ Wrong: Imported but not used in code
import { CommonModule } from '@angular/common';

@Component({
  imports: [CommonModule] // ✅ Used in imports array, not in code
})

// ✅ Correct: ESLint knows about imports array
import { CommonModule } from '@angular/common';

@Component({
  imports: [CommonModule] // ESLint recognizes this as usage
})

// ❌ Wrong: Template-only reference (ESLint can't see)
// If you use CommonModule only in template like *ngIf
// You still need to declare it in imports!
```

### Problem: "Prettier formatting changed my logic"

**Symptom**: Prettier reformatted code and broke it

**Cause**: Usually a syntax error. Example:

```typescript
// ❌ Invalid syntax - Prettier will reformat oddly
const result = calculate(a, b); // ❌ Missing comma after b

// ✅ Correct
const result = calculate(
  a,
  b // ✅ Comma added automatically
);
```

**Solution**: Fix the underlying syntax issue, not the formatting.

### Problem: "npm run lint passes, but pre-commit fails"

**Symptom**: `npm run lint` passes locally but `git commit` fails

**Cause**: Staged files differ from working directory

**Solution**:

```bash
# Make sure all changes are staged
git add .

# Re-run lint on staged files only
npx lint-staged

# If that passes, try committing
git commit -m "fix: description"
```

### Problem: "Tests pass locally but fail in CI"

**Symptom**: `npm run test` works, but GitHub Actions fails

**Common causes**:

- Different Node/npm versions
- Environment variables not set
- Missing test data

**Solution**:

```bash
# Check Node version matches CI
node --version

# Run same test command as CI
npm run test:all

# Check environment
echo $NODE_ENV

# If still failing, check CI logs on GitHub Actions
```

### Problem: "I accidentally committed a large file"

**Symptom**: Committed node_modules or build artifacts

**Solution**:

```bash
# Remove from git history (not disk)
git rm --cached path/to/file
echo "path/to/file" >> .gitignore
git add .gitignore
git commit -m "chore: remove cached files from git"

# Or reset last commit if not pushed yet
git reset HEAD~1
```

### Problem: "Module boundary violation" ESLint error

**Symptom**: ESLint error about importing across module boundaries

**Example**:

```typescript
// ❌ ERROR: Apps can't import from other apps
// In apps/manager-dashboard
import { BookingService } from '../api/services'; // ❌ Wrong

// ✅ CORRECT: Use shared libraries
import { BookingService } from '@khana/booking-engine';
```

**Solution**:

- Extract shared code to a lib in `libs/`
- Both apps can then import from the lib
- See Nx monorepo documentation for details

---

## Getting Help

- **Code style questions**: Check [Code Quality Tools Reference](#code-quality-tools-reference)
- **Component patterns**: See [Component Creation Checklist](#component-creation-checklist)
- **Testing questions**: Review [Testing Guide](#testing-guide)
- **ESLint errors**: Check [Common ESLint Errors & Solutions](#common-eslint-errors--solutions)
- **Still stuck**: Ask team in #dev-help Slack channel
