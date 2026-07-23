
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cdi','previdencia','fii','etf','acao','cripto','outro')),
  ticker TEXT,
  name TEXT NOT NULL,
  institution TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC,
  current_value NUMERIC,
  cdi_percent NUMERIC,
  initial_amount NUMERIC,
  initial_date DATE,
  notes TEXT,
  last_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments all" ON public.investments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER investments_set_updated_at BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX investments_user_idx ON public.investments(user_id);

CREATE TABLE public.investment_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  total_value NUMERIC NOT NULL,
  breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_snapshots TO authenticated;
GRANT ALL ON public.investment_snapshots TO service_role;
ALTER TABLE public.investment_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots all" ON public.investment_snapshots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX investment_snapshots_user_date_idx ON public.investment_snapshots(user_id, snapshot_date DESC);
