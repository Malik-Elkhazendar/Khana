# Remediation Gate Runbook

## Purpose

Use this sequence to validate remediation-critical paths before release.

## Environment

Run from repo root with daemon/cloud noise disabled:

```bash
export NX_DAEMON=false
export NX_NO_CLOUD=true
```

## Gate Sequence

1. Frontend E2E (Chromium)

```bash
npx nx e2e manager-dashboard-e2e -- --project=chromium
```

2. Backend E2E

```bash
# Optional cleanup for startup race noise
pkill -f "api:serve:development|fork.js .*api:serve:development" || true

npx nx e2e api-e2e --output-style=stream
```

3. Frontend unit tests

```bash
npx nx test manager-dashboard --runInBand
```

4. Backend unit tests

```bash
npx nx test api --runInBand
```

5. Shared contracts

```bash
npx nx test shared-dtos --runInBand
```

## Expected Outcome

All commands complete successfully.

## Notes

- API logs include expected negative-path errors (401/404/409/429) during E2E.
- These are test assertions, not release blockers.
- If `api-e2e` reports a startup race, rerun after the cleanup command above.
