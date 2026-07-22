import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, BarChart3, PieChart as PieIcon, CreditCard, Repeat, ExternalLink } from "lucide-react";
import { CardBrandIcon } from "@/components/CardBrandIcon";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

const STORAGE_KEY = "dashboard.reportBlocks";

type BlockId = "evolution" | "categories" | "cardsProjection" | "fixed";

const BLOCK_META: { id: BlockId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "evolution", label: "Evolução anual (receitas × despesas)", icon: BarChart3 },
  { id: "categories", label: "Despesas por categoria (ano)", icon: PieIcon },
  { id: "cardsProjection", label: "Projeção de cartões (próx. 6 meses)", icon: CreditCard },
  { id: "fixed", label: "Despesas fixas do mês", icon: Repeat },
];

const DEFAULT_ENABLED: Record<BlockId, boolean> = {
  evolution: true,
  categories: true,
  cardsProjection: false,
  fixed: false,
};

function useEnabledBlocks() {
  const [enabled, setEnabled] = useState<Record<BlockId, boolean>>(DEFAULT_ENABLED);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEnabled({ ...DEFAULT_ENABLED, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);
  const toggle = (id: BlockId) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return { enabled, toggle };
}

export function DashboardReports() {
  const { enabled, toggle } = useEnabledBlocks();
  const anyEnabled = Object.values(enabled).some(Boolean);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Relatórios</p>
          <h2 className="text-base md:text-lg font-medium">Visão analítica</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cards"
            className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver projeção de cartões <ExternalLink className="size-3" />
          </Link>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="size-4" />
                Personalizar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Blocos exibidos
              </p>
              <div className="space-y-2">
                {BLOCK_META.map(({ id, label, icon: Icon }) => (
                  <label key={id} className="flex items-start gap-2.5 cursor-pointer rounded-md p-1.5 hover:bg-accent/50">
                    <Checkbox checked={enabled[id]} onCheckedChange={() => toggle(id)} className="mt-0.5" />
                    <span className="flex items-start gap-2 text-sm">
                      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span>{label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!anyEnabled && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Nenhum relatório selecionado. Use <span className="font-medium">Personalizar</span> para escolher.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {enabled.evolution && <EvolutionBlock />}
        {enabled.categories && <CategoriesBlock />}
        {enabled.cardsProjection && <CardsProjectionBlock />}
        {enabled.fixed && <FixedBlock />}
      </div>
    </section>
  );
}

function BlockShell({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm md:text-base font-medium">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function EvolutionBlock() {
  const { state } = useFinance();
  const year = new Date().getFullYear();
  const data = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const s = getMonthSummary(state.transactions, year, i);
      return { month: MONTHS_SHORT[i], receitas: s.income, despesas: s.expenses };
    }), [state.transactions, year]);
  const hasData = data.some((d) => d.receitas > 0 || d.despesas > 0);

  return (
    <BlockShell title={`Receitas × Despesas — ${year}`}>
      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sem dados no ano.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barCategoryGap="20%">
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
              formatter={(value) => formatCurrency(Number(value))} />
            <Bar dataKey="receitas" fill="var(--income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </BlockShell>
  );
}

function CategoriesBlock() {
  const { state } = useFinance();
  const year = new Date().getFullYear();
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    state.transactions
      .filter((t) => {
        const d = new Date(t.date + "T12:00:00");
        return t.type === "expense" && d.getFullYear() === year;
      })
      .forEach((t) => {
        const cat = state.categories.find((c) => c.id === t.categoryId);
        const name = cat?.name || "Outros";
        map[name] = (map[name] || 0) + t.amount;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [state.transactions, state.categories, year]);
  const total = data.reduce((s, c) => s + c.value, 0);

  return (
    <BlockShell title={`Despesas por categoria — ${year}`}>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sem despesas neste ano.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {data.slice(0, 8).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-2 text-xs">
                <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="tabular-nums text-muted-foreground w-10 text-right">{((cat.value / total) * 100).toFixed(0)}%</span>
                <span className="tabular-nums font-medium w-20 text-right">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BlockShell>
  );
}

function CardsProjectionBlock() {
  const { state } = useFinance();
  const current = getCurrentMonth();
  const months = useMemo(() => {
    const out: { year: number; month: number; label: string }[] = [];
    for (let off = 0; off < 6; off++) {
      let m = current.month + off;
      let y = current.year;
      while (m > 11) { m -= 12; y++; }
      out.push({ year: y, month: m, label: `${MONTHS_SHORT[m]}/${String(y).slice(2)}` });
    }
    return out;
  }, [current.month, current.year]);

  const rows = useMemo(() => state.creditCards.map((card) => {
    const per = months.map(({ year, month }) =>
      state.transactions
        .filter((t) => t.creditCardId === card.id && t.type === "expense" && (() => {
          const d = new Date(t.date + "T12:00:00");
          return d.getFullYear() === year && d.getMonth() === month;
        })())
        .reduce((s, t) => s + t.amount, 0)
    );
    return { card, per, total: per.reduce((a, b) => a + b, 0) };
  }), [state.creditCards, state.transactions, months]);

  const totals = months.map((_, i) => rows.reduce((s, r) => s + r.per[i], 0));

  return (
    <BlockShell title="Projeção de cartões — próx. 6 meses">
      {state.creditCards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhum cartão cadastrado.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium px-2 py-2">Cartão</th>
                {months.map((m) => (
                  <th key={m.label} className="text-right font-medium px-2 py-2 whitespace-nowrap">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ card, per }) => (
                <tr key={card.id} className="border-t border-border/40">
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <CardBrandIcon brand={card.brand} className="w-6 h-4" />
                      <span className="truncate font-medium">{card.name}</span>
                    </div>
                  </td>
                  {per.map((v, i) => (
                    <td key={i} className="text-right tabular-nums px-2 py-2 whitespace-nowrap">
                      {v > 0 ? formatCurrency(v) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border/60 font-semibold">
                <td className="px-2 py-2 text-right">Total</td>
                {totals.map((v, i) => (
                  <td key={i} className="text-right tabular-nums px-2 py-2 whitespace-nowrap text-expense">
                    {v > 0 ? formatCurrency(v) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </BlockShell>
  );
}

function FixedBlock() {
  const { state } = useFinance();
  const current = getCurrentMonth();
  const items = useMemo(() => {
    return state.transactions
      .filter((t) => {
        if (!t.isFixed || t.type !== "expense") return false;
        const d = new Date(t.date + "T12:00:00");
        return d.getFullYear() === current.year && d.getMonth() === current.month;
      })
      .sort((a, b) => b.amount - a.amount);
  }, [state.transactions, current.month, current.year]);
  const total = items.reduce((s, t) => s + t.amount, 0);

  return (
    <BlockShell
      title={`Despesas fixas — ${MONTHS_FULL[current.month]}`}
      right={<span className="text-sm tabular-nums font-semibold text-expense">{formatCurrency(total)}</span>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhuma despesa fixa neste mês.</p>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
          {items.map((t) => {
            const cat = state.categories.find((c) => c.id === t.categoryId);
            return (
              <div key={t.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/30 last:border-0">
                <span className="flex-1 truncate">{t.description}</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{cat?.name || "—"}</span>
                <span className="tabular-nums font-medium text-expense w-24 text-right">{formatCurrency(t.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </BlockShell>
  );
}
