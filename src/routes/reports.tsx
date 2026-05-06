import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { CardBrandIcon } from "@/components/CardBrandIcon";

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
  const [tab, setTab] = useState<"overview" | "cards">("overview");

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

  // 12-month detailed card projection starting from current month
  const current = getCurrentMonth();
  const cardProjection = useMemo(() => {
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      let m = current.month + i;
      let y = current.year;
      while (m > 11) { m -= 12; y++; }
      months.push({ year: y, month: m, label: `${MONTHS_FULL[m]}/${y}` });
    }

    const cardBlocks = state.creditCards.map((card) => {
      const monthly = months.map(({ year: y, month: m }) => {
        const txs = state.transactions
          .filter((t) => {
            if (t.creditCardId !== card.id || t.type !== "expense") return false;
            const d = new Date(t.date + "T12:00:00");
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        const total = txs.reduce((s, t) => s + t.amount, 0);
        return { txs, total };
      });
      const cardTotal = monthly.reduce((s, m) => s + m.total, 0);
      return { card, monthly, cardTotal };
    });

    const grandTotal = cardBlocks.reduce((s, b) => s + b.cardTotal, 0);
    return { months, cardBlocks, grandTotal };
  }, [state.transactions, state.creditCards, current.month, current.year]);

  return (
    <div className="p-4 md:p-8 max-w-6xl pt-16 md:pt-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Análise</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Relatórios</h1>
        </div>
        {tab === "overview" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setYear((y) => y - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
            <span className="text-sm font-medium min-w-[60px] text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
          </div>
        )}
      </header>

      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit flex-wrap">
        {(["overview", "cards"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>
            {t === "overview" ? "Visão Geral" : "Projeção Cartões"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
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
                    formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="receitas" fill="var(--income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

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
                      formatter={(value) => formatCurrency(Number(value))} />
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
        <div className="space-y-6">
          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-medium">Projeção 12 Meses — Cartões</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Transações detalhadas a partir de {MONTHS_FULL[cardProjection.months[0]?.month]}/{cardProjection.months[0]?.year}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total geral (12 meses)</p>
                <p className="text-xl font-semibold tabular-nums text-expense">{formatCurrency(cardProjection.grandTotal)}</p>
              </div>
            </div>
          </div>

          {state.creditCards.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Nenhum cartão cadastrado.
            </div>
          ) : (
            cardProjection.cardBlocks.map(({ card, monthly, cardTotal }) => (
              <div key={card.id} className="glass-card p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color }}>
                      <CardBrandIcon brand={card.brand} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{card.name}</p>
                      {card.lastDigits && <p className="text-[10px] text-muted-foreground">•••• {card.lastDigits}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">Total cartão</p>
                    <p className="text-base font-semibold tabular-nums text-expense">{formatCurrency(cardTotal)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {monthly.every((m) => m.txs.length === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem lançamentos previstos.</p>
                  ) : (
                    monthly.map((m, i) => {
                      if (m.txs.length === 0) return null;
                      const mo = cardProjection.months[i];
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-2 text-xs">
                            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                              {MONTHS_FULL[mo.month]}/{mo.year}
                            </span>
                            <span className="tabular-nums font-medium text-expense">{formatCurrency(m.total)}</span>
                          </div>
                          <div className="space-y-1">
                            {m.txs.map((tx) => {
                              const cat = state.categories.find((c) => c.id === tx.categoryId);
                              return (
                                <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-accent/30">
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate">
                                      {tx.description}
                                      {tx.isInstallment && tx.totalInstallments > 1 && (
                                        <span className="text-muted-foreground ml-1">({tx.currentInstallment}/{tx.totalInstallments})</span>
                                      )}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {cat?.name}
                                      {tx.store ? ` • ${tx.store}` : ""}
                                    </p>
                                  </div>
                                  <span className="tabular-nums shrink-0 ml-2">{formatCurrency(tx.amount)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
