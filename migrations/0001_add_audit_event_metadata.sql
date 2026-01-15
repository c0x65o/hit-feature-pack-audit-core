-- Feature Pack: audit-core
-- Add audit metadata columns + outcome enum

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_outcome') THEN
    CREATE TYPE audit_outcome AS ENUM ('success', 'failure', 'denied', 'error');
  END IF;
END $$;

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS changes JSONB,
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS outcome audit_outcome,
  ADD COLUMN IF NOT EXISTS target_kind VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS target_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS auth_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS mfa_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(120),
  ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS audit_events_event_type_idx ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS audit_events_outcome_idx ON audit_events (outcome);
CREATE INDEX IF NOT EXISTS audit_events_target_idx ON audit_events (target_kind, target_id);
CREATE INDEX IF NOT EXISTS audit_events_session_idx ON audit_events (session_id);
