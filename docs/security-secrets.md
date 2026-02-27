# Secret Management Guide

## Scope

This document defines how Khana manages runtime secrets for the API.

## Source of Truth for Env Loading

API env files are resolved from the workspace root using `resolveEnvFilePaths()` in `apps/api/src/app/config/env-files.ts`.

- Do not use `apps/api/.env` files.
- Keep tracked templates in root:
  - `.env.example`
  - `.env.development.local.example`

## Local Development

- Keep real local secrets only in `.env.development.local` (gitignored).
- Treat `.env.example` and `.env.development` as placeholders/non-secret defaults.
- Never commit real secrets to tracked env files.

## Staging and Production

- Inject secrets through CI/CD or secret manager only.
- Recommended providers:
  - HashiCorp Vault
  - AWS Secrets Manager
  - GCP Secret Manager
  - Azure Key Vault
- Do not store staging/production secrets in git.

## Required JWT Secret Policy

For `NODE_ENV=staging` and `NODE_ENV=production`, API startup fails if:

- `JWT_SECRET` is missing
- `JWT_REFRESH_SECRET` is missing
- either secret is shorter than 32 chars
- either secret contains weak markers (for example `change-in-production`, `change_me`, `default`, `example`, `placeholder`, `your_`)

## Rotation Policy

When exposure is suspected:

1. Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. Invalidate active sessions/tokens after rotation.
3. Rotate database credentials if they were reused outside local development.
4. Audit recent logs/usage for unauthorized activity.

## Incident Response Checklist

1. Revoke exposed sessions/tokens.
2. Rotate secrets in secret manager.
3. Redeploy workloads with new secret versions.
4. Verify repository has only placeholder values in tracked env templates.
