-- Tags table (pre-registered, like categories)
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags all" ON public.tags FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Junction table transaction <-> tags
CREATE TABLE public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_tags TO authenticated;
GRANT ALL ON public.transaction_tags TO service_role;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx_tags all" ON public.transaction_tags FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transaction_tags_tx ON public.transaction_tags(transaction_id);
CREATE INDEX idx_transaction_tags_tag ON public.transaction_tags(tag_id);