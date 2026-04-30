import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { type Transaction, type TransactionType, formatCurrency, getNextMonth } from "@/lib/finance-store";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  head: () => ({
    meta: [
      { title: "Transações — Alento" },
      { name: "description", content: "Gerencie suas receitas e despesas" },
    ],
  }),
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function TransactionsPage() {
  const { state, deleteTransaction } = useFinance();
  const next = getNextMonth();
  const [year, setYear] = useState(next.year);
  const [month, setMonth] = useState(next.month);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const monthTx = state.transactions
    .filter((t) => {
      const d = new Date(t.date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .filter((t) => filter === "all" || t.type === filter)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const goMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl pt-16 md:pt-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Gerenciar</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Transações</h1>
        </div>
        <Button onClick={() => { setEditTx(null); setShowForm(true); }}>
          <Plus className="size-4" />
          Nova transação
        </Button>
      </header>

      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(-1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={() => goMonth(1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
        </div>
        <div className="flex gap-1 sm:ml-auto">
          {(["all", "income", "expense"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}>
              {f === "all" ? "Todas" : f === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </div>

      {monthTx.length === 0 ? (
        <div className="glass-card p-8 md:p-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhuma transação encontrada neste mês.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditTx(null); setShowForm(true); }}>
            <Plus className="size-4" />
            Criar transação
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {monthTx.map((tx) => {
            const cat = state.categories.find((c) => c.id === tx.categoryId);
            const card = tx.creditCardId ? state.creditCards.find((c) => c.id === tx.creditCardId) : null;
            const isIncome = tx.type === "income";
            return (
              <div key={tx.id} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl hover:bg-accent/30 transition-colors group">
                <div className={`size-8 md:size-10 rounded-full flex items-center justify-center text-xs md:text-sm font-medium ${isIncome ? "bg-income/10 text-income" : "bg-expense/10 text-expense"}`}>
                  {tx.description.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                    {cat?.name || "Sem categoria"}
                    {card ? ` • ${card.name}` : ""}
                    {tx.store ? ` • ${tx.store}` : ""}
                    {tx.isInstallment ? ` • Parcela ${tx.currentInstallment}/${tx.totalInstallments}` : ""}
                    {tx.isFixed ? " • Fixa" : ""}
                    {" • "}{new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className={`text-xs md:text-sm font-semibold tabular-nums whitespace-nowrap ${isIncome ? "text-income" : "text-expense"}`}>
                  {isIncome ? "+" : "-"} {formatCurrency(tx.amount)}
                </p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditTx(tx); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => deleteTransaction(tx.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <TransactionFormDialog
          editTransaction={editTx}
          onClose={() => { setShowForm(false); setEditTx(null); }}
        />
      )}
    </div>
  );
}
