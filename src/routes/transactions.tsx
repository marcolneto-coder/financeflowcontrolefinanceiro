import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { type Transaction, type TransactionType, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Copy, Search, X as XIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  head: () => ({
    meta: [
      { title: "Transações — Finance Flow" },
      { name: "description", content: "Gerencie suas receitas e despesas" },
    ],
  }),
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function TransactionsPage() {
  const { state, deleteTransaction, duplicateToNextMonth } = useFinance();
  const current = getCurrentMonth();
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  // Advanced search
  const [showSearch, setShowSearch] = useState(false);
  const [searchAll, setSearchAll] = useState(false); // search across all months
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [cardFilter, setCardFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [onlyFixed, setOnlyFixed] = useState(false);
  const [onlyFixedNoCard, setOnlyFixedNoCard] = useState(false);
  const [onlyInstallment, setOnlyInstallment] = useState(false);

  const hasActiveSearch = q || fromDate || toDate || cardFilter || categoryFilter || minValue || maxValue || onlyFixed || onlyFixedNoCard || onlyInstallment;

  const visibleTx = useMemo(() => {
    return state.transactions
      .filter((t) => {
        // Month gate (skipped if searching across all months)
        if (!(searchAll && hasActiveSearch)) {
          const d = new Date(t.date + "T12:00:00");
          if (d.getFullYear() !== year || d.getMonth() !== month) return false;
        }
        if (filter !== "all" && t.type !== filter) return false;
        if (q && !`${t.description} ${t.store || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (fromDate && t.date < fromDate) return false;
        if (toDate && t.date > toDate) return false;
        if (cardFilter && t.creditCardId !== cardFilter) return false;
        if (categoryFilter && t.categoryId !== categoryFilter) return false;
        if (minValue && t.amount < parseFloat(minValue)) return false;
        if (maxValue && t.amount > parseFloat(maxValue)) return false;
        if (onlyFixed && !t.isFixed) return false;
        if (onlyFixedNoCard && (!t.isFixed || t.creditCardId)) return false;
        if (onlyInstallment && !t.isInstallment) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, year, month, filter, q, fromDate, toDate, cardFilter, categoryFilter, minValue, maxValue, onlyFixed, onlyFixedNoCard, onlyInstallment, searchAll, hasActiveSearch]);

  const clearSearch = () => {
    setQ(""); setFromDate(""); setToDate(""); setCardFilter(""); setCategoryFilter("");
    setMinValue(""); setMaxValue(""); setOnlyFixed(false); setOnlyFixedNoCard(false); setOnlyInstallment(false);
  };

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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Gerenciar</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Transações</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSearch((s) => !s)}>
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Buscar</span>
          </Button>
          <Button onClick={() => { setEditTx(null); setShowForm(true); }}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nova transação</span>
          </Button>
        </div>
      </header>

      {showSearch && (
        <div className="glass-card p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição ou loja..."
              className="flex-1 px-3 py-2 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {hasActiveSearch && (
              <button onClick={clearSearch} className="p-2 rounded-lg hover:bg-accent" title="Limpar">
                <XIcon className="size-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">De</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Até</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Valor a partir</label>
              <input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="0,00" step="0.01"
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Valor até</label>
              <input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} placeholder="0,00" step="0.01"
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Cartão</label>
              <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos</option>
                {state.creditCards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Categoria</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todas</option>
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer self-end">
              <input type="checkbox" checked={onlyFixed} onChange={(e) => setOnlyFixed(e.target.checked)} className="size-3.5 accent-primary" />
              Apenas fixas
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer self-end">
              <input type="checkbox" checked={onlyFixedNoCard} onChange={(e) => setOnlyFixedNoCard(e.target.checked)} className="size-3.5 accent-primary" />
              Fixas sem cartão
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer self-end">
              <input type="checkbox" checked={onlyInstallment} onChange={(e) => setOnlyInstallment(e.target.checked)} className="size-3.5 accent-primary" />
              Apenas parceladas
            </label>
          </div>
          {hasActiveSearch && (
            <label className="flex items-center gap-2 text-xs cursor-pointer pt-2 border-t border-border">
              <input type="checkbox" checked={searchAll} onChange={(e) => setSearchAll(e.target.checked)} className="size-3.5 accent-primary" />
              Buscar em todos os meses (ignora filtro de mês)
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => goMonth(-1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {searchAll && hasActiveSearch ? "Todos os meses" : `${MONTHS[month]} ${year}`}
          </span>
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

      {visibleTx.length === 0 ? (
        <div className="glass-card p-8 md:p-12 text-center text-muted-foreground">
          <p className="text-sm">{hasActiveSearch ? "Nenhum resultado para a busca." : "Nenhuma transação neste mês."}</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditTx(null); setShowForm(true); }}>
            <Plus className="size-4" />
            Criar transação
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {visibleTx.map((tx) => {
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
                <div className="flex gap-1">
                  <button onClick={() => duplicateToNextMonth(tx.id)} title="Duplicar para próximo mês"
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="size-3.5" />
                  </button>
                  <button onClick={() => { setEditTx(tx); setShowForm(true); }} title="Editar"
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => deleteTransaction(tx.id)} title="Excluir"
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
