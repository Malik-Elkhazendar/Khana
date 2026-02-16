---
description: Verify the correctness and completeness of a feature implementation
---

1.  **Run Unit Tests**
    Ensure no regressions were introduced.
    // turbo
    `npx nx test manager-dashboard`

2.  **Run Linting**
    Ensure code style compliance.
    // turbo
    `npx nx lint manager-dashboard`

3.  **Build Application**
    Ensure the application builds without errors.
    // turbo
    `npx nx build manager-dashboard`

4.  **Check for Placeholders**
    Scan the codebase for temporary placeholder components that should have been removed.
    `grep -r "Placeholder" apps/manager-dashboard/src/app`

5.  **Manual Verification**
    - Start the server: `npx nx serve manager-dashboard`
    - Open [http://localhost:4200](http://localhost:4200)
    - Verify the specific feature behavior (e.g., click interactions, responsive layout).
