import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency } from "@/lib/finance-store";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Relatórios — Alento" },
      { name: "description", content: "Relatórios detalhados das suas finanças" },
    ],
  }),
});

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

function ReportsPage() {
  const { state } = useFinance();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const s = getMonthSummary(state.transactions, year, i);
      return { month: MONTHS_SHORT[i], receitas: s.income, despesas: s.expenses, saldo: s.balance };
    });
  }, [state.transactions, year]);

  const yearTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        income: acc.income + m.receitas,
        expenses: acc.expenses + m.despesas,
      }),
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
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [state.transactions, state.categories, year]);

  return (
    <div className="p-8 max-w-5xl">
      <header className="flex justify-between items-end mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Análise</p>
          <h1 className="text-3xl font-semibold tracking-tight">Relatórios</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
        </div>
      </header>

      {/* Year summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Receitas</p>
          <p className="text-2xl font-semibold tabular-nums text-income">{formatCurrency(yearTotals.income)}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Despesas</p>
          <p className="text-2xl font-semibold tabular-nums text-expense">{formatCurrency(yearTotals.expenses)}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-muted-foreground mb-2">Saldo Anual</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">{formatCurrency(yearTotals.income - yearTotals.expenses)}</p>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-lg font-medium mb-6">Receitas vs Despesas por Mês</h2>
        {state.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Adicione transações para ver o gráfico.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} barCategoryGap="20%">
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="receitas" fill="var(--income)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category pie chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-medium mb-6">Despesas por Categoria</h2>
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
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
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
    </div>
  );
}
