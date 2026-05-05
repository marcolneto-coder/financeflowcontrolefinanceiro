import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, getNextMonth } from "@/lib/finance-store";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Relatórios — Finance Flow" },
      { name: "description", content: "Relatórios detalhados das suas finanças" },
    ],
  }),
});

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

function ReportsPage() {
  const { state } = useFinance();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<"overview" | "cards" | "projection">("overview");

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const s = getMonthSummary(state.transactions, year, i);
      return { month: MONTHS_SHORT[i], receitas: s.income, despesas: s.expenses, saldo: s.balance };
    });
  }, [state.transactions, year]);

  const yearTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({ income: acc.income + m.receitas, expenses: acc.expenses + m.despesas }),
      { income: 0, expenses: 0 }
    );
  }, [monthlyData]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    state.transactions
      .filter((t) => {
        const d = new Date(t.date + "T12:00:00");
        return d.getFullYear() === year && t.type === "expense";
      })
      .forEach((t) => {
        const cat = state.categories.find((c) => c.id === t.categoryId);
        const name = cat?.name || "Outros";
        map[name] = (map[name] || 0) + t.amount;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [state.transactions, state.categories, year]);

  // 12-month card projection starting from next month
  const next = getNextMonth();
  const cardProjection = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      let m = next.month + i;
      let y = next.year;
      while (m > 11) { m -= 12; y++; }
      months.push({ year: y, month: m, label: `${MONTHS_SHORT[m]}/${y}` });
    }

    const cardRows = state.creditCards.map((card) => {
      const values = months.map(({ year: y, month: m }) => {
        return state.transactions
          .filter((t) => {
            if (t.creditCardId !== card.id || t.type !== "expense") return false;
            const d = new Date(t.date + "T12:00:00");
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .reduce((s, t) => s + t.amount, 0);
      });
      const total = values.reduce((s, v) => s + v, 0);
      return { card, values, total };
    });

    const grandTotals = months.map((_, i) =>
      cardRows.reduce((s, r) => s + r.values[i], 0)
    );
    const grandTotal = grandTotals.reduce((s, v) => s + v, 0);

    return { months, cardRows, grandTotals, grandTotal };
  }, [state.transactions, state.creditCards, next.month, next.year]);

  // Monthly projection: 12 months ahead — cards aggregated, fixed expenses detailed
  const monthlyProjection = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      let m = next.month + i;
      let y = next.year;
      while (m > 11) { m -= 12; y++; }
      months.push({ year: y, month: m, label: `${MONTHS_SHORT[m]}/${y}` });
    }

    // Card totals per month
    const cardTotalsRow = state.creditCards.map((card) => {
      const values = months.map(({ year: y, month: m }) =>
        state.transactions
          .filter((t) => {
            if (t.creditCardId !== card.id || t.type !== "expense") return false;
            const d = new Date(t.date + "T12:00:00");
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .reduce((s, t) => s + t.amount, 0)
      );
      return { card, values, total: values.reduce((s, v) => s + v, 0) };
    });

    // Fixed expenses (no credit card) detailed by description+category
    const fixedExpenses = state.transactions.filter((t) => t.type === "expense" && t.isFixed && !t.creditCardId);
    // Group by description
    const fixedGroups = new Map<string, { description: string; categoryId: string; values: number[]; total: number }>();
    for (const tx of fixedExpenses) {
      const key = `${tx.description}__${tx.categoryId}`;
      if (!fixedGroups.has(key)) {
        fixedGroups.set(key, { description: tx.description, categoryId: tx.categoryId, values: months.map(() => 0), total: 0 });
      }
      const grp = fixedGroups.get(key)!;
      months.forEach(({ year: y, month: m }, i) => {
        const d = new Date(tx.date + "T12:00:00");
        if (d.getFullYear() === y && d.getMonth() === m) {
          grp.values[i] += tx.amount;
        }
      });
    }
    // Recompute totals
    for (const grp of fixedGroups.values()) {
      grp.total = grp.values.reduce((s, v) => s + v, 0);
    }
    const fixedRows = Array.from(fixedGroups.values()).filter((r) => r.total > 0);

    // Grand totals per month
    const monthGrandTotals = months.map((_, i) =>
      cardTotalsRow.reduce((s, r) => s + r.values[i], 0) +
      fixedRows.reduce((s, r) => s + r.values[i], 0)
    );
    const grandTotal = monthGrandTotals.reduce((s, v) => s + v, 0);

    return { months, cardTotalsRow, fixedRows, monthGrandTotals, grandTotal };
  }, [state.transactions, state.creditCards, next.month, next.year]);

  return (
    <div className="p-4 md:p-8 max-w-6xl pt-16 md:pt-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Análise</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Relatórios</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit flex-wrap">
        {(["overview", "cards", "projection"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>
            {t === "overview" ? "Visão Geral" : t === "cards" ? "Projeção Cartões" : "Projeção Mensal"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Year summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Total Receitas</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-income">{formatCurrency(yearTotals.income)}</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Total Despesas</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-expense">{formatCurrency(yearTotals.expenses)}</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Saldo Anual</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-primary">{formatCurrency(yearTotals.income - yearTotals.expenses)}</p>
            </div>
          </div>

          {/* Monthly bar chart */}
          <div className="glass-card p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-medium mb-6">Receitas vs Despesas por Mês</h2>
            {state.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Adicione transações para ver o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barCategoryGap="20%">
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar dataKey="receitas" fill="var(--income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category pie chart */}
          <div className="glass-card p-4 md:p-6">
            <h2 className="text-base md:text-lg font-medium mb-6">Despesas por Categoria</h2>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem despesas neste ano.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm flex-1">{cat.name}</span>
                      <span className="text-sm tabular-nums font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "cards" && (
        <div className="glass-card p-4 md:p-6">
          <h2 className="text-base md:text-lg font-medium mb-4">Projeção 12 Meses — Cartões de Crédito</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Previsão de gastos a partir de {MONTHS_FULL[cardProjection.months[0]?.month]} {cardProjection.months[0]?.year}
          </p>

          {state.creditCards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum cartão cadastrado.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground sticky left-0 bg-card z-10 min-w-[120px]">Cartão</th>
                    {cardProjection.months.map((m) => (
                      <th key={m.label} className="text-right py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">{m.label}</th>
                    ))}
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cardProjection.cardRows.map(({ card, values, total }) => (
                    <tr key={card.id} className="border-b border-border/50 hover:bg-accent/20">
                      <td className="py-2 px-2 font-medium sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full" style={{ backgroundColor: card.color }} />
                          <span className="truncate">{card.name}</span>
                        </div>
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className={`text-right py-2 px-2 tabular-nums ${v > 0 ? "text-expense" : "text-muted-foreground"}`}>
                          {v > 0 ? formatCurrency(v) : "—"}
                        </td>
                      ))}
                      <td className="text-right py-2 px-2 tabular-nums font-semibold text-expense">
                        {total > 0 ? formatCurrency(total) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 px-2 sticky left-0 bg-card z-10">Total</td>
                    {cardProjection.grandTotals.map((v, i) => (
                      <td key={i} className={`text-right py-2 px-2 tabular-nums ${v > 0 ? "text-expense" : "text-muted-foreground"}`}>
                        {v > 0 ? formatCurrency(v) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2 px-2 tabular-nums text-expense">
                      {cardProjection.grandTotal > 0 ? formatCurrency(cardProjection.grandTotal) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "projection" && (
        <div className="glass-card p-4 md:p-6">
          <h2 className="text-base md:text-lg font-medium mb-2">Projeção Mensal de Despesas</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Cartões agregados por total e despesas fixas detalhadas — próximos 12 meses.
          </p>

          {monthlyProjection.cardTotalsRow.length === 0 && monthlyProjection.fixedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Cadastre cartões ou despesas fixas para visualizar a projeção.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground sticky left-0 bg-card z-10 min-w-[160px]">Item</th>
                    {monthlyProjection.months.map((m) => (
                      <th key={m.label} className="text-right py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">{m.label}</th>
                    ))}
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Cartões — apenas total por cartão */}
                  {monthlyProjection.cardTotalsRow.length > 0 && (
                    <tr className="bg-muted/30">
                      <td colSpan={monthlyProjection.months.length + 2} className="py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/30 z-10">
                        Cartões de Crédito (total por cartão)
                      </td>
                    </tr>
                  )}
                  {monthlyProjection.cardTotalsRow.map(({ card, values, total }) => (
                    <tr key={card.id} className="border-b border-border/50 hover:bg-accent/20">
                      <td className="py-2 px-2 font-medium sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full" style={{ backgroundColor: card.color }} />
                          <span className="truncate">{card.name}</span>
                        </div>
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className={`text-right py-2 px-2 tabular-nums ${v > 0 ? "text-expense" : "text-muted-foreground"}`}>
                          {v > 0 ? formatCurrency(v) : "—"}
                        </td>
                      ))}
                      <td className="text-right py-2 px-2 tabular-nums font-semibold text-expense">
                        {total > 0 ? formatCurrency(total) : "—"}
                      </td>
                    </tr>
                  ))}

                  {/* Despesas fixas — detalhadas */}
                  {monthlyProjection.fixedRows.length > 0 && (
                    <tr className="bg-muted/30">
                      <td colSpan={monthlyProjection.months.length + 2} className="py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky left-0 bg-muted/30 z-10">
                        Despesas Fixas (detalhadas)
                      </td>
                    </tr>
                  )}
                  {monthlyProjection.fixedRows.map((row, idx) => {
                    const cat = state.categories.find((c) => c.id === row.categoryId);
                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="py-2 px-2 font-medium sticky left-0 bg-card z-10">
                          <div className="truncate">{row.description}</div>
                          {cat && <div className="text-[10px] text-muted-foreground truncate">{cat.name}</div>}
                        </td>
                        {row.values.map((v, i) => (
                          <td key={i} className={`text-right py-2 px-2 tabular-nums ${v > 0 ? "text-expense" : "text-muted-foreground"}`}>
                            {v > 0 ? formatCurrency(v) : "—"}
                          </td>
                        ))}
                        <td className="text-right py-2 px-2 tabular-nums font-semibold text-expense">
                          {row.total > 0 ? formatCurrency(row.total) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2 px-2 sticky left-0 bg-card z-10">Total Geral</td>
                    {monthlyProjection.monthGrandTotals.map((v, i) => (
                      <td key={i} className={`text-right py-2 px-2 tabular-nums ${v > 0 ? "text-expense" : "text-muted-foreground"}`}>
                        {v > 0 ? formatCurrency(v) : "—"}
                      </td>
                    ))}
                    <td className="text-right py-2 px-2 tabular-nums text-expense">
                      {monthlyProjection.grandTotal > 0 ? formatCurrency(monthlyProjection.grandTotal) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
