import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/finance-store";
import {
  type Investment,
  type InvestmentType,
  INVESTMENT_TYPE_LABEL,
  INVESTMENT_TYPE_COLOR,
  computeCost,
  computeCurrentValue,
} from "@/lib/investments-store";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Building2, PiggyBank, RefreshCw } from "lucide-react";
import { fetchQuotes } from "@/lib/quotes.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/investments")({
  component: InvestmentsPage,
  head: () => ({
    meta: [
      { title: "Investimentos — Finance Flow" },
      { name: "description", content: "Carteira de investimentos: renda fixa, FIIs, ETFs, ações e previdência." },
    ],
  }),
});

type Row = {
  id: string; type: InvestmentType; ticker: string | null; name: string; institution: string | null;
  quantity: number | string; avg_price: number | string; current_price: number | string | null;
  current_value: number | string | null; cdi_percent: number | string | null;
  initial_amount: number | string | null; initial_date: string | null; notes: string | null;
  last_update: string | null;
};

function mapRow(r: Row): Investment {
  return {
    id: r.id,
    type: r.type,
    ticker: r.ticker ?? undefined,
    name: r.name,
    institution: r.institution ?? undefined,
    quantity: Number(r.quantity) || 0,
    avgPrice: Number(r.avg_price) || 0,
    currentPrice: r.current_price != null ? Number(r.current_price) : undefined,
    currentValue: r.current_value != null ? Number(r.current_value) : undefined,
    cdiPercent: r.cdi_percent != null ? Number(r.cdi_percent) : undefined,
    initialAmount: r.initial_amount != null ? Number(r.initial_amount) : undefined,
    initialDate: r.initial_date ?? undefined,
    notes: r.notes ?? undefined,
    lastUpdate: r.last_update ?? undefined,
  };
}

function InvestmentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const refreshQuotesFn = useServerFn(fetchQuotes);

  const handleRefreshQuotes = async () => {
    const marketItems = items.filter(
      (i) => (i.type === "fii" || i.type === "etf" || i.type === "acao") && i.ticker && i.quantity > 0,
    );
    if (!marketItems.length) {
      toast.info("Nenhum ativo de mercado com ticker cadastrado.");
      return;
    }
    setRefreshing(true);
    try {
      const tickers = Array.from(new Set(marketItems.map((i) => i.ticker!.toUpperCase())));
      const quotes = await refreshQuotesFn({ data: { tickers } });
      const byTicker = new Map(quotes.map((q) => [q.ticker, q]));
      let updated = 0;
      let failed = 0;
      const now = new Date().toISOString();
      for (const inv of marketItems) {
        const q = byTicker.get(inv.ticker!.toUpperCase());
        if (q && q.price != null && q.price > 0) {
          const newValue = q.price * inv.quantity;
          const { error } = await supabase
            .from("investments")
            .update({ current_price: q.price, current_value: newValue, last_update: now })
            .eq("id", inv.id);
          if (error) failed++;
          else updated++;
        } else {
          failed++;
        }
      }
      if (updated) toast.success(`${updated} ativo(s) atualizado(s)${failed ? ` · ${failed} sem cotação` : ""}.`);
      else toast.error("Não foi possível obter cotações. Verifique tickers ou configure BRAPI_TOKEN.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar cotações.");
    } finally {
      setRefreshing(false);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("investments").select("*").order("name");
    setItems((data as Row[] | null || []).map(mapRow));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const totals = useMemo(() => {
    const total = items.reduce((s, i) => s + computeCurrentValue(i), 0);
    const cost = items.reduce((s, i) => s + computeCost(i), 0);
    const pnl = total - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const byType = new Map<InvestmentType, number>();
    const byInst = new Map<string, number>();
    for (const it of items) {
      const v = computeCurrentValue(it);
      byType.set(it.type, (byType.get(it.type) || 0) + v);
      const inst = it.institution || "Outros";
      byInst.set(inst, (byInst.get(inst) || 0) + v);
    }
    return { total, cost, pnl, pnlPct, byType, byInst };
  }, [items]);

  const grouped = useMemo(() => {
    const g = new Map<string, Investment[]>();
    for (const it of items) {
      const inst = it.institution || "Outros";
      if (!g.has(inst)) g.set(inst, []);
      g.get(inst)!.push(it);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este investimento?")) return;
    await supabase.from("investments").delete().eq("id", id);
    setItems((s) => s.filter((i) => i.id !== id));
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl pt-16 md:pt-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
            <PiggyBank className="size-4" /> Carteira
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe sua carteira. Cadastre manualmente e atualize as cotações.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleRefreshQuotes} disabled={refreshing}>

            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando…" : "Atualizar cotações"}
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo ativo
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <Wallet className="size-3.5" /> Patrimônio total
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(totals.total)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Custo: {formatCurrency(totals.cost)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            {totals.pnl >= 0 ? <TrendingUp className="size-3.5 text-income" /> : <TrendingDown className="size-3.5 text-expense" />}
            Resultado
          </p>
          <p className={`font-display text-3xl font-semibold tabular-nums ${totals.pnl >= 0 ? "text-income" : "text-expense"}`}>
            {totals.pnl >= 0 ? "+" : ""}{formatCurrency(totals.pnl)}
          </p>
          <p className={`text-[11px] mt-1 ${totals.pnl >= 0 ? "text-income" : "text-expense"}`}>
            {totals.pnlPct >= 0 ? "+" : ""}{totals.pnlPct.toFixed(2)}%
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <Building2 className="size-3.5" /> Ativos
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums">{items.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{grouped.length} instituição(ões)</p>
        </div>
      </div>

      {/* Allocation by type */}
      {items.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-medium mb-3">Alocação por tipo</h2>
          <div className="space-y-2">
            {Array.from(totals.byType.entries()).sort((a, b) => b[1] - a[1]).map(([t, v]) => {
              const pct = totals.total > 0 ? (v / totals.total) * 100 : 0;
              return (
                <div key={t}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: INVESTMENT_TYPE_COLOR[t] }} />
                      {INVESTMENT_TYPE_LABEL[t]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(v)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: INVESTMENT_TYPE_COLOR[t] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped list */}
      {loading ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <PiggyBank className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Nenhum investimento cadastrado</p>
          <p className="text-xs text-muted-foreground mb-4">
            Comece cadastrando seus ativos manualmente. Em breve você poderá importar extratos do Inter e Mercado Pago.
          </p>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Novo ativo</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([inst, list]) => {
            const instTotal = list.reduce((s, i) => s + computeCurrentValue(i), 0);
            return (
              <div key={inst} className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-sidebar-accent/30">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm">{inst}</h3>
                    <span className="text-[11px] text-muted-foreground">({list.length})</span>
                  </div>
                  <span className="font-display text-sm font-semibold tabular-nums">{formatCurrency(instTotal)}</span>
                </div>
                <div className="divide-y divide-border">
                  {list.map((inv) => {
                    const cur = computeCurrentValue(inv);
                    const cost = computeCost(inv);
                    const pnl = cur - cost;
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                    return (
                      <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-sidebar-accent/20">
                        <span className="size-2 rounded-full" style={{ background: INVESTMENT_TYPE_COLOR[inv.type] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inv.ticker && <span className="font-mono text-xs mr-1.5 text-primary">{inv.ticker}</span>}
                            {inv.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {INVESTMENT_TYPE_LABEL[inv.type]}
                            {inv.cdiPercent != null && ` · ${inv.cdiPercent}% CDI`}
                            {inv.quantity > 0 && ` · ${inv.quantity} cotas`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(cur)}</p>
                          {cost > 0 && (
                            <p className={`text-[11px] tabular-nums ${pnl >= 0 ? "text-income" : "text-expense"}`}>
                              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct.toFixed(1)}%)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(inv)} className="p-1.5 rounded-md hover:bg-muted" title="Editar">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-md hover:bg-expense/10 hover:text-expense" title="Excluir">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <InvestmentDialog
          investment={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function InvestmentDialog({ investment, onClose, onSaved }: {
  investment: Investment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<InvestmentType>(investment?.type || "cdi");
  const [name, setName] = useState(investment?.name || "");
  const [ticker, setTicker] = useState(investment?.ticker || "");
  const [institution, setInstitution] = useState(investment?.institution || "");
  const [quantity, setQuantity] = useState(String(investment?.quantity || ""));
  const [avgPrice, setAvgPrice] = useState(String(investment?.avgPrice || ""));
  const [currentValue, setCurrentValue] = useState(String(investment?.currentValue || ""));
  const [cdiPercent, setCdiPercent] = useState(String(investment?.cdiPercent || ""));
  const [initialAmount, setInitialAmount] = useState(String(investment?.initialAmount || ""));
  const [initialDate, setInitialDate] = useState(investment?.initialDate || new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(investment?.notes || "");
  const [saving, setSaving] = useState(false);

  const isCdi = type === "cdi";
  const isPrev = type === "previdencia";
  const isMarket = type === "fii" || type === "etf" || type === "acao" || type === "cripto";
  const showInitial = isCdi || isPrev || type === "outro";

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const newCurrent = currentValue ? Number(currentValue) : null;
    const payload = {
      user_id: user.id,
      type,
      name: name.trim(),
      ticker: ticker.trim() || null,
      institution: institution.trim() || null,
      quantity: Number(quantity) || 0,
      avg_price: Number(avgPrice) || 0,
      current_value: newCurrent,
      cdi_percent: cdiPercent ? Number(cdiPercent) : null,
      initial_amount: initialAmount ? Number(initialAmount) : null,
      initial_date: initialDate || null,
      notes: notes.trim() || null,
      last_update: new Date().toISOString(),
    };
    if (investment) {
      await supabase.from("investments").update(payload).eq("id", investment.id);
      // Feedback de variação para atualizações manuais (não-mercado)
      if (!isMarket && newCurrent != null && newCurrent > 0) {
        const prev = investment.currentValue ?? investment.initialAmount ?? 0;
        if (prev > 0 && Math.abs(newCurrent - prev) > 0.001) {
          const delta = newCurrent - prev;
          const pct = (delta / prev) * 100;
          const sign = delta >= 0 ? "+" : "";
          const label = delta >= 0 ? "Ganho" : "Perda";
          const msg = `${label}: ${sign}${delta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${sign}${pct.toFixed(2)}%) desde a última atualização.`;
          if (delta >= 0) toast.success(msg);
          else toast.error(msg);
        }
      }
    } else {
      await supabase.from("investments").insert(payload);
    }
    setSaving(false);
    onSaved();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-display text-xl font-semibold mb-4">
          {investment ? "Editar" : "Novo"} investimento
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as InvestmentType)}
              className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm">
              {(Object.keys(INVESTMENT_TYPE_LABEL) as InvestmentType[]).map((t) => (
                <option key={t} value={t}>{INVESTMENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isCdi ? "Porquinho CDI" : "Ex.: MXRF11"}
                className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm" />
            </div>
            {isMarket && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
                <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="MXRF11"
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm font-mono" />
              </div>
            )}
            <div className={isMarket ? "" : "col-span-2"}>
              <label className="text-xs text-muted-foreground mb-1 block">Instituição</label>
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Inter, Mercado Pago…"
                list="inst-list" className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm" />
              <datalist id="inst-list">
                <option value="Inter" />
                <option value="Mercado Pago" />
                <option value="B3" />
                <option value="XP" />
                <option value="Nubank" />
              </datalist>
            </div>
          </div>

          {isMarket && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                <input type="number" step="0.00000001" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm tabular-nums" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço médio (R$)</label>
                <input type="number" step="0.01" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm tabular-nums" />
              </div>
            </div>
          )}

          {showInitial && (
            <div className="grid grid-cols-2 gap-3">
              {isCdi && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">% do CDI</label>
                  <input type="number" step="0.1" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)}
                    placeholder="100" className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm tabular-nums" />
                </div>
              )}
              <div className={isCdi ? "" : "col-span-2"}>
                <label className="text-xs text-muted-foreground mb-1 block">Aporte inicial (R$)</label>
                <input type="number" step="0.01" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder="Total investido até hoje"
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm tabular-nums" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Usado como base de custo para calcular ganho/perda acumulado.
                </p>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Data do aporte</label>
                <input type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm" />
              </div>
            </div>
          )}


          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Saldo atual (R$) {isPrev || isCdi ? "*" : "(opcional — sobrescreve o cálculo)"}
            </label>
            <input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="Ex.: 1250.75"
              className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm tabular-nums" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Para Renda Fixa e Previdência: informe o saldo do extrato. Para ativos de mercado, será calculado automaticamente pela cotação (em breve).
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
