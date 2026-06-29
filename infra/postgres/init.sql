-- CodeSync bootstrap schema
-- Flyway (in the API service) owns migrations from V1 onward.
-- This file only ensures the database exists with correct encoding.

-- Set sensible defaults
ALTER DATABASE codesync SET timezone TO 'UTC';

-- Seed schema version table used by Flyway (it will create its own if absent)
-- Nothing else here — Flyway handles the rest.
