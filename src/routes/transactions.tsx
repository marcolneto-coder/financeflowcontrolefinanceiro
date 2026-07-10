import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { type Transaction, type TransactionType, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Copy, Search, X as XIcon, SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, TrendingUp, TrendingDown, CreditCard as CreditCardIcon, Repeat, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";

type SortField = "date" | "description" | "store" | "amount";
type SortDir = "asc" | "desc";

type TxSearch = { year?: number; month?: number; highlight?: string };

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  validateSearch: (search: Record<string, unknown>): TxSearch => ({
    year: typeof search.year === "number" ? search.year : search.year ? Number(search.year) : undefined,
    month: typeof search.month === "number" ? search.month : search.month ? Number(search.month) : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
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
  const search = Route.useSearch();
  const current = getCurrentMonth();
  const [year, setYear] = useState(search.year ?? current.year);
  const [month, setMonth] = useState(search.month ?? current.month);
  const [filter, setFilter] = useState<"all" | TransactionType>("all");
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof localStorage === "undefined") return "date";
    return (localStorage.getItem("tx-sort-field") as SortField) || "date";
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (typeof localStorage === "undefined") return "desc";
    return (localStorage.getItem("tx-sort-dir") as SortDir) || "desc";
  });
  useEffect(() => { localStorage.setItem("tx-sort-field", sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem("tx-sort-dir", sortDir); }, [sortDir]);
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir(f === "date" || f === "amount" ? "desc" : "asc"); }
  };
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [highlightId, setHighlightId] = useState<string | undefined>(search.highlight);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (search.year !== undefined) setYear(search.year);
    if (search.month !== undefined) setMonth(search.month);
    if (search.highlight) setHighlightId(search.highlight);
  }, [search.year, search.month, search.highlight]);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(() => setHighlightId(undefined), 3000);
      return () => clearTimeout(t);
    }
  }, [highlightId]);


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
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        let cmp = 0;
        if (sortField === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        else if (sortField === "amount") cmp = a.amount - b.amount;
        else if (sortField === "description") cmp = a.description.localeCompare(b.description, "pt-BR", { sensitivity: "base" });
        else if (sortField === "store") cmp = (a.store || "").localeCompare(b.store || "", "pt-BR", { sensitivity: "base" });
        return cmp * dir;
      });
  }, [state.transactions, year, month, filter, q, fromDate, toDate, cardFilter, categoryFilter, minValue, maxValue, onlyFixed, onlyFixedNoCard, onlyInstallment, searchAll, hasActiveSearch, sortField, sortDir]);

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

      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-1 glass-card p-1">
          <button onClick={() => goMonth(-1)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-accent transition-colors">←</button>
          <span className="text-sm font-medium min-w-[140px] text-center px-2">
            {searchAll && hasActiveSearch ? "Todos os meses" : `${MONTHS[month]} ${year}`}
          </span>
          <button onClick={() => goMonth(1)} className="px-3 py-1.5 text-sm rounded-lg hover:bg-accent transition-colors">→</button>
        </div>
        <div className="flex gap-1 sm:ml-auto glass-card p-1">
          {(["all", "income", "expense"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
              }`}>
              {f === "all" ? "Todas" : f === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ordenar:</span>
        {([
          { f: "date" as const, label: "Data" },
          { f: "description" as const, label: "Nome" },
          { f: "store" as const, label: "Estabelecimento" },
          { f: "amount" as const, label: "Valor" },
        ]).map(({ f, label }) => {
          const active = sortField === f;
          const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
          return (
            <button key={f} onClick={() => toggleSort(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                active ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}>
              {label}
              <Icon className="size-3" />
            </button>
          );
        })}
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
        <div className="glass-card divide-y divide-border/40 overflow-hidden">
          {visibleTx.map((tx) => {
            const cat = state.categories.find((c) => c.id === tx.categoryId);
            const card = tx.creditCardId ? state.creditCards.find((c) => c.id === tx.creditCardId) : null;
            const isIncome = tx.type === "income";
            const isHighlighted = highlightId === tx.id;
            const TypeIcon = isIncome ? TrendingUp : TrendingDown;
            return (
              <div
                key={tx.id}
                ref={isHighlighted ? highlightRef : undefined}
                className={`relative flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 hover:bg-accent/20 transition-colors group ${isHighlighted ? "bg-primary/10" : ""}`}
              >
                <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${isIncome ? "bg-income" : "bg-expense"}`} />
                <div className={`size-10 md:size-11 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? "bg-income/10 text-income" : "bg-expense/10 text-expense"}`}>
                  <TypeIcon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold truncate">{tx.description}</p>
                    {tx.isFixed && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        <Repeat className="size-2.5" />Fixa
                      </span>
                    )}
                    {tx.isInstallment && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 shrink-0">
                        {tx.currentInstallment}/{tx.totalInstallments}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                    {cat && <><span className="opacity-40">•</span><span>{cat.name}</span></>}
                    {card && (
                      <><span className="opacity-40">•</span>
                      <span className="inline-flex items-center gap-1"><CreditCardIcon className="size-3" />{card.name}</span></>
                    )}
                    {tx.store && <><span className="opacity-40">•</span><span className="truncate">{tx.store}</span></>}
                  </div>
                </div>
                <p className={`text-sm md:text-base font-bold tabular-nums whitespace-nowrap ${isIncome ? "text-income" : "text-expense"}`}>
                  {isIncome ? "+" : "−"} {formatCurrency(tx.amount)}
                </p>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => duplicateToNextMonth(tx.id)} title="Duplicar para próximo mês"
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="size-3.5" />
                  </button>
                  <button onClick={() => { setEditTx(tx); setShowForm(true); }} title="Editar"
                    className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => deleteTransaction(tx.id)} title="Excluir"
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
