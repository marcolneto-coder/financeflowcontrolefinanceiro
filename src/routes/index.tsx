import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, CreditCard, CalendarDays, Plus, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { DashboardReports } from "@/components/DashboardReports";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { ParseNotificationDialog } from "@/components/ParseNotificationDialog";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKS_STORAGE_KEY = "dashboard.weeklyBalance.weeks";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Finance Flow" },
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
  const current = getCurrentMonth();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showParseNotif, setShowParseNotif] = useState(false);
  const [sharedText, setSharedText] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const pending = sessionStorage.getItem("shareTarget.pendingText");
      if (pending) {
        sessionStorage.removeItem("shareTarget.pendingText");
        setSharedText(pending);
        setShowParseNotif(true);
      }
    } catch { /* ignore */ }
  }, []);

  const summary = getMonthSummary(state.transactions, year, month);
  const prevSummary = getMonthSummary(
    state.transactions,
    month === 0 ? year - 1 : year,
    month === 0 ? 11 : month - 1
  );

  const pctDiff = (curr: number, prev: number) =>
    prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0;
  const balanceDiff = pctDiff(summary.balance, prevSummary.balance);


  const expenseTxs = summary.transactions.filter((t) => t.type === "expense");
  const cardExpenses = expenseTxs.filter((t) => t.creditCardId);
  const cardTotal = cardExpenses.reduce((s, t) => s + t.amount, 0);
  const fixedNonCardTotal = expenseTxs.filter((t) => t.isFixed && !t.creditCardId).reduce((s, t) => s + t.amount, 0);
  const fixedAndCardTotal = cardTotal + fixedNonCardTotal;
  const dailyExpensesTxs = expenseTxs.filter((t) => !t.creditCardId && !t.isFixed);
  const dailyTotal = dailyExpensesTxs.reduce((s, t) => s + t.amount, 0);

  const prevExpenseTxs = prevSummary.transactions.filter((t) => t.type === "expense");
  const prevFixedAndCardTotal = prevExpenseTxs.filter((t) => t.creditCardId || t.isFixed).reduce((s, t) => s + t.amount, 0);
  const prevDailyTotal = prevExpenseTxs.filter((t) => !t.creditCardId && !t.isFixed).reduce((s, t) => s + t.amount, 0);

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
    <div className="p-4 md:p-8 max-w-6xl pt-16 md:pt-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Visão geral</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => goMonth(-1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={() => goMonth(1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
          <button
            onClick={() => setShowParseNotif(true)}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
            title="Extrair transação de notificação com IA"
          >
            <Sparkles className="size-4" /> Notificação
          </button>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="size-4" /> Nova transação
          </button>
        </div>
      </header>

      {showQuickAdd && (
        <TransactionFormDialog editTransaction={null} onClose={() => setShowQuickAdd(false)} />
      )}

      {showParseNotif && (
        <ParseNotificationDialog
          initialText={sharedText}
          autoAnalyze={!!sharedText}
          onClose={() => { setShowParseNotif(false); setSharedText(undefined); }}
        />
      )}


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mb-8">
        <SummaryCard label="Receitas" value={summary.income} icon={<TrendingUp className="size-5" />} colorClass="text-income" diff={pctDiff(summary.income, prevSummary.income)} />
        <ExpensesBreakdownCard
          total={fixedAndCardTotal}
          cardExpenses={cardTotal}
          nonCardExpenses={fixedNonCardTotal}
          diff={pctDiff(fixedAndCardTotal, prevFixedAndCardTotal)}
        />
        <DailyExpensesCard
          transactions={dailyExpensesTxs}
          total={dailyTotal}
          diff={pctDiff(dailyTotal, prevDailyTotal)}
        />
        <SummaryCard label="Saldo" value={summary.balance} icon={<Wallet className="size-5" />} colorClass="text-primary" diff={balanceDiff} />
        <WeeklyBalanceCard balance={summary.balance} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div>
          <h2 className="text-base md:text-lg font-medium mb-4">Gastos no Cartão</h2>
          <div className="glass-card p-4 md:p-6">
            <p className="text-xl md:text-2xl font-semibold tabular-nums">{formatCurrency(cardTotal)}</p>
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
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {state.creditCards.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">Nenhum cartão cadastrado.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-base md:text-lg font-medium mb-4">Top Categorias</h2>
          <div className="glass-card p-4 md:p-6">
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


      <DashboardReports />
    </div>
  );
}

function SummaryCard({ label, value, icon, colorClass, diff, invertColor }: {
  label: string; value: number; icon: React.ReactNode; colorClass: string; diff?: number; invertColor?: boolean;
}) {
  // For expenses, an increase (diff > 0) is "bad" → expense color
  const positiveIsGood = !invertColor;
  const isGood = positiveIsGood ? (diff ?? 0) > 0 : (diff ?? 0) < 0;
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <p className="text-xs md:text-sm text-muted-foreground">{label}</p>
        <div className={colorClass}>{icon}</div>
      </div>
      <p className="text-xl md:text-3xl font-semibold tabular-nums tracking-tight">{formatCurrency(value)}</p>
      {diff !== undefined && diff !== 0 && (
        <p className={`text-xs mt-2 flex items-center gap-1 ${isGood ? "text-income" : "text-expense"}`}>
          {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(diff).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  );
}


function ExpensesBreakdownCard({ total, cardExpenses, nonCardExpenses, diff }: {
  total: number; cardExpenses: number; nonCardExpenses: number; diff: number;
}) {
  const isBad = diff > 0;
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <p className="text-xs md:text-sm text-muted-foreground">Fixas + Cartão</p>
        <div className="text-expense"><TrendingDown className="size-5" /></div>
      </div>
      <p className="text-xl md:text-3xl font-semibold tabular-nums tracking-tight">{formatCurrency(total)}</p>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="size-3" /> Cartão
          </span>
          <span className="tabular-nums font-medium">{formatCurrency(cardExpenses)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-3" /> Fixas
          </span>
          <span className="tabular-nums font-medium">{formatCurrency(nonCardExpenses)}</span>
        </div>
      </div>
      {diff !== 0 && (
        <p className={`text-xs mt-3 flex items-center gap-1 ${isBad ? "text-expense" : "text-income"}`}>
          {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(diff).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

function DailyExpensesCard({ transactions, total, diff }: {
  transactions: Array<{ paymentMethod?: "debit" | "pix" | "cash" | "transfer"; amount: number }>;
  total: number;
  diff: number;
}) {
  const isBad = diff > 0;
  const byMethod = { debit: 0, pix: 0, cash: 0, transfer: 0, none: 0 };
  for (const t of transactions) {
    const k = t.paymentMethod ?? "none";
    byMethod[k] += t.amount;
  }
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <p className="text-xs md:text-sm text-muted-foreground">Dia a dia</p>
        <div className="text-expense"><Wallet className="size-5" /></div>
      </div>
      <p className="text-xl md:text-3xl font-semibold tabular-nums tracking-tight">{formatCurrency(total)}</p>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Débito</span>
          <span className="tabular-nums font-medium">{formatCurrency(byMethod.debit)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Pix</span>
          <span className="tabular-nums font-medium">{formatCurrency(byMethod.pix)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Transferência</span>
          <span className="tabular-nums font-medium">{formatCurrency(byMethod.transfer)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Dinheiro</span>
          <span className="tabular-nums font-medium">{formatCurrency(byMethod.cash)}</span>
        </div>
        {byMethod.none > 0 && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Sem forma</span>
            <span className="tabular-nums font-medium">{formatCurrency(byMethod.none)}</span>
          </div>
        )}
      </div>
      {diff !== 0 && (
        <p className={`text-xs mt-3 flex items-center gap-1 ${isBad ? "text-expense" : "text-income"}`}>
          {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(diff).toFixed(1)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

function WeeklyBalanceCard({ balance }: { balance: number }) {
  const [weeks, setWeeks] = useState<string>("4");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WEEKS_STORAGE_KEY);
      if (saved) setWeeks(saved);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try {
      if (weeks !== "") localStorage.setItem(WEEKS_STORAGE_KEY, weeks);
    } catch { /* ignore */ }
  }, [weeks]);
  const weeksNum = parseFloat(weeks.replace(",", "."));
  const perWeek = Number.isFinite(weeksNum) && weeksNum > 0 ? balance / weeksNum : null;
  return (
    <div className="glass-card p-4 md:p-6">
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <p className="text-xs md:text-sm text-muted-foreground">Saldo por semana</p>
        <div className="text-primary"><CalendarDays className="size-5" /></div>
      </div>
      <p className="text-xl md:text-3xl font-semibold tabular-nums tracking-tight">
        {perWeek !== null ? formatCurrency(perWeek) : "—"}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">Semanas:</label>
        <input
          type="number"
          min="1"
          step="1"
          inputMode="decimal"
          value={weeks}
          onChange={(e) => setWeeks(e.target.value)}
          className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
