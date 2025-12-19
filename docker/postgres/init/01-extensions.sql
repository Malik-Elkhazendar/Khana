-- Khana PostgreSQL Extensions
-- Runs automatically on first container start

-- UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fuzzy text search (useful for Arabic names and search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
