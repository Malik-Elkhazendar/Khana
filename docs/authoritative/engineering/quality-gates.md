# Quality Gates

Primary scripts (package.json):

- npm run lint
- npm run test
- npm run build
- npm run check (lint + test + build)

Manual checks (available because TypeScript is installed):

- npx tsc --noEmit (TypeScript type check)

Definition of Done:

- Lint passes with no errors.
- Unit tests pass.
- Build succeeds for affected projects.
- Type check passes when applicable.

Evidence:

- package.json (scripts, devDependencies.typescript)
