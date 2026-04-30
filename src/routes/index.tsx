import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, type Transaction } from "@/lib/finance-store";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Alento" },
      { name: "description", content: "Visão geral das suas finanças pessoais" },
    ],
  }),
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function DashboardPage() {
  const { state } = useFinance();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const summary = getMonthSummary(state.transactions, year, month);
  const prevSummary = getMonthSummary(
    state.transactions,
    month === 0 ? year - 1 : year,
    month === 0 ? 11 : month - 1
  );

  const balanceDiff = prevSummary.balance !== 0
    ? ((summary.balance - prevSummary.balance) / Math.abs(prevSummary.balance)) * 100
    : 0;

  const recentTx = [...summary.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const cardExpenses = summary.transactions.filter(
    (t) => t.type === "expense" && t.creditCardId
  );
  const cardTotal = cardExpenses.reduce((s, t) => s + t.amount, 0);

  const categoryBreakdown = summary.transactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const cat = state.categories.find((c) => c.id === t.categoryId);
      const name = cat?.name || "Sem categoria";
      acc[name] = (acc[name] || 0) + t.amount;
      return acc;
    }, {});

  const topCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const goMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex justify-between items-end mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Visão geral</p>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goMonth(-1)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={() => goMonth(1)}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
          >
            →
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard
          label="Receitas"
          value={summary.income}
          icon={<TrendingUp className="size-5" />}
          colorClass="text-income"
        />
        <SummaryCard
          label="Despesas"
          value={summary.expenses}
          icon={<TrendingDown className="size-5" />}
          colorClass="text-expense"
        />
        <SummaryCard
          label="Saldo"
          value={summary.balance}
          icon={<Wallet className="size-5" />}
          colorClass="text-primary"
          diff={balanceDiff}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Recent Transactions */}
        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Transações Recentes</h2>
          </div>
          {recentTx.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              Nenhuma transação neste mês. Adicione uma na aba Transações.
            </div>
          ) : (
            <div className="space-y-1">
              {recentTx.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={state.categories} cards={state.creditCards} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Spending */}
          <div>
            <h2 className="text-lg font-medium mb-4">Gastos no Cartão</h2>
            <div className="glass-card p-6">
              <p className="text-2xl font-semibold tabular-nums">{formatCurrency(cardTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {cardExpenses.length} lançamento{cardExpenses.length !== 1 ? "s" : ""} neste mês
              </p>
              {state.creditCards.map((card) => {
                const spent = cardExpenses
                  .filter((t) => t.creditCardId === card.id)
                  .reduce((s, t) => s + t.amount, 0);
                if (spent === 0) return null;
                const pct = card.limit > 0 ? (spent / card.limit) * 100 : 0;
                return (
                  <div key={card.id} className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{card.name} •••• {card.lastDigits}</span>
                      <span className="tabular-nums">{formatCurrency(spent)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {state.creditCards.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Nenhum cartão cadastrado.
                </p>
              )}
            </div>
          </div>

          {/* Top Categories */}
          <div>
            <h2 className="text-lg font-medium mb-4">Top Categorias</h2>
            <div className="glass-card p-6">
              {topCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem despesas neste mês.</p>
              ) : (
                <div className="space-y-3">
                  {topCategories.map(([name, amount]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-sm">{name}</span>
                      <span className="text-sm tabular-nums font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  colorClass,
  diff,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  diff?: number;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={colorClass}>{icon}</div>
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatCurrency(value)}</p>
      {diff !== undefined && diff !== 0 && (
        <p className={`text-xs mt-2 flex items-center gap-1 ${diff > 0 ? "text-income" : "text-expense"}`}>
          {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(diff).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

function TransactionRow({
  tx,
  categories,
  cards,
}: {
  tx: Transaction;
  categories: { id: string; name: string }[];
  cards: { id: string; name: string; lastDigits: string }[];
}) {
  const cat = categories.find((c) => c.id === tx.categoryId);
  const card = tx.creditCardId ? cards.find((c) => c.id === tx.creditCardId) : null;
  const isIncome = tx.type === "income";

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/30 transition-colors">
      <div
        className={`size-10 rounded-full flex items-center justify-center text-sm font-medium ${
          isIncome ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
        }`}
      >
        {tx.description.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.description}</p>
        <p className="text-xs text-muted-foreground">
          {cat?.name || "Sem categoria"}
          {card ? ` • ${card.name}` : ""}
          {tx.isInstallment ? ` • ${tx.currentInstallment}/${tx.totalInstallments}` : ""}
          {tx.isFixed ? " • Fixa" : ""}
        </p>
      </div>
      <p className={`text-sm font-semibold tabular-nums ${isIncome ? "text-income" : "text-expense"}`}>
        {isIncome ? "+" : "-"} {formatCurrency(tx.amount)}
      </p>
    </div>
  );
}
