GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_snapshots TO authenticated;
GRANT ALL ON public.investment_snapshots TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS investment_snapshots_user_date_idx ON public.investment_snapshots (user_id, snapshot_date);