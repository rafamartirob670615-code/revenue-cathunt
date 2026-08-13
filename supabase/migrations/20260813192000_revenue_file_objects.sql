BEGIN;

CREATE TABLE revenue.file_objects (
  object_key text PRIMARY KEY,
  body bytea NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE revenue.file_objects ENABLE ROW LEVEL SECURITY;

COMMIT;
