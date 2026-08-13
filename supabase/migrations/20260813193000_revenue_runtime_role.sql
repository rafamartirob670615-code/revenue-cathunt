BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'revenue_runtime') THEN
    CREATE ROLE revenue_runtime NOLOGIN;
  END IF;
END
$$;

REVOKE ALL ON SCHEMA revenue FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA revenue TO revenue_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA revenue TO revenue_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA revenue TO revenue_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA revenue
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO revenue_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA revenue
  GRANT USAGE, SELECT ON SEQUENCES TO revenue_runtime;

DO $$
DECLARE
  revenue_table record;
BEGIN
  FOR revenue_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'revenue'
  LOOP
    EXECUTE format(
      'CREATE POLICY revenue_runtime_all ON revenue.%I FOR ALL TO revenue_runtime USING (true) WITH CHECK (true)',
      revenue_table.tablename
    );
  END LOOP;
END
$$;

COMMIT;
