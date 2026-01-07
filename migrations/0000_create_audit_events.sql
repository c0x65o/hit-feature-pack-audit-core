-- Feature Pack: audit-core
-- Create audit_events table (global audit trail)
-- Idempotent (safe to re-run)

DO $$
BEGIN
  -- Enum type for actor_type (matches drizzle enum audit_actor_type)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_actor_type') THEN
    CREATE TYPE audit_actor_type AS ENUM ('user', 'system', 'api');
  END IF;

  IF to_regclass('audit_events') IS NULL THEN
    CREATE TABLE audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- What changed
      entity_kind VARCHAR(100) NOT NULL,
      entity_id VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      summary TEXT NOT NULL,
      details JSONB,

      -- Who did it
      actor_id VARCHAR(255),
      actor_name VARCHAR(255),
      actor_type audit_actor_type NOT NULL DEFAULT 'user',

      -- Correlation / debug hooks
      correlation_id VARCHAR(255),
      pack_name VARCHAR(100),
      method VARCHAR(16),
      path TEXT,

      -- Optional request metadata
      ip_address VARCHAR(100),
      user_agent VARCHAR(500),

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;

  -- Helpful indexes (idempotent guards)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_events_entity_idx'
  ) THEN
    CREATE INDEX audit_events_entity_idx ON audit_events (entity_kind, entity_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_events_created_at_idx'
  ) THEN
    CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_events_actor_idx'
  ) THEN
    CREATE INDEX audit_events_actor_idx ON audit_events (actor_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_events_correlation_idx'
  ) THEN
    CREATE INDEX audit_events_correlation_idx ON audit_events (correlation_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'audit_events_pack_idx'
  ) THEN
    CREATE INDEX audit_events_pack_idx ON audit_events (pack_name);
  END IF;
END $$;

