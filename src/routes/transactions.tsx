import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { type Transaction, type TransactionType, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Copy, Search, X as XIcon, SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, TrendingUp, TrendingDown, CreditCard as CreditCardIcon, Repeat, Calendar, ChevronUp } from "lucide-react";
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
  const highlightRef = useRef<HTMLLIElement | null>(null);
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem("tx-compact") === "1";
  });
  useEffect(() => { localStorage.setItem("tx-compact", compact ? "1" : "0"); }, [compact]);

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
  const activeFilterCount = [q, fromDate, toDate, cardFilter, categoryFilter, minValue, maxValue, onlyFixed, onlyFixedNoCard, onlyInstallment].filter(Boolean).length;

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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Gerenciar</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight font-display">Transações</h1>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant={hasActiveSearch ? "default" : "outline"} size="sm" onClick={() => setShowSearch((s) => !s)} className="flex-1 sm:flex-none relative">
            <SlidersHorizontal className="size-4 mr-2" />
            <span>Buscar</span>
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-background/20 text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button size="sm" onClick={() => { setEditTx(null); setShowForm(true); }} className="flex-1 sm:flex-none">
            <Plus className="size-4 mr-2" />
            <span>Nova</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium shrink-0">Ordenar por</span>
        <div className="flex flex-wrap items-center gap-2">
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                {label}
                <Icon className={`size-3 transition-transform ${active ? "opacity-100" : "opacity-60"}`} />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCompact((v) => !v)}
          className={`sm:ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
            compact
              ? "bg-primary/10 text-primary border-primary/40"
              : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
          }`}
          title="Alternar densidade da lista"
        >
          {compact ? "Modo compacto" : "Modo confortável"}
        </button>
      </div>

      {/* Totals summary based on active filters */}
      {(() => {
        const totalIncome = visibleTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const totalExpense = visibleTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const net = totalIncome - totalExpense;
        return (
          <div className="glass-card p-3 md:p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total ({visibleTx.length})</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalIncome + totalExpense)}</span>
            </div>
            {(filter === "all" || filter === "income") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Receitas</span>
                <span className="font-semibold tabular-nums text-income">{formatCurrency(totalIncome)}</span>
              </div>
            )}
            {(filter === "all" || filter === "expense") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <span className="font-semibold tabular-nums text-expense">{formatCurrency(totalExpense)}</span>
              </div>
            )}
            {filter === "all" && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">Saldo</span>
                <span className={`font-semibold tabular-nums ${net >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(net)}</span>
              </div>
            )}
          </div>
        );
      })()}


      {visibleTx.length === 0 ? (
        <div className="glass-card p-8 md:p-12 text-center text-muted-foreground">
          <p className="text-sm">{hasActiveSearch ? "Nenhum resultado para a busca." : "Nenhuma transação neste mês."}</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditTx(null); setShowForm(true); }}>
            <Plus className="size-4" />
            Criar transação
          </Button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <ul className="divide-y divide-border/40">
            {visibleTx.map((tx) => {
              const cat = state.categories.find((c) => c.id === tx.categoryId);
              const card = tx.creditCardId ? state.creditCards.find((c) => c.id === tx.creditCardId) : null;
              const isIncome = tx.type === "income";
              const isHighlighted = highlightId === tx.id;
              const TypeIcon = isIncome ? TrendingUp : TrendingDown;
              return (
                <li
                  key={tx.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={`relative group transition-all duration-200 ${
                    isHighlighted ? "bg-primary/10" : "hover:bg-accent/15"
                  }`}
                >
                  <div className={`flex items-center gap-3 md:gap-4 ${compact ? "pl-4 pr-3 md:pl-5 md:pr-4 py-2.5" : "pl-5 pr-4 md:pl-6 md:pr-5 py-[18px]"}`}>
                    {/* Type indicator */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 ${compact ? "h-6" : "h-9"} w-1 rounded-r ${
                        isIncome ? "bg-income" : "bg-expense"
                      }`}
                    />

                    {/* Icon */}
                    <div
                      className={`${compact ? "size-8 rounded-lg" : "size-11 rounded-2xl"} flex items-center justify-center shrink-0 ${
                        isIncome ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
                      }`}
                    >
                      <TypeIcon className={compact ? "size-4" : "size-5"} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className={`flex items-center gap-2 ${compact ? "mb-0.5" : "mb-1.5"}`}>
                        <p className={`${compact ? "text-sm" : "text-[15px]"} font-semibold tracking-tight truncate text-foreground`}>
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {tx.isFixed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              <Repeat className="size-2.5" />
                              <span className="hidden sm:inline">Fixa</span>
                            </span>
                          )}
                          {tx.isInstallment && (
                            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                              {tx.currentInstallment}/{tx.totalInstallments}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="size-3.5 opacity-70" />
                          {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {cat && (
                          <>
                            <span className="text-border">•</span>
                            <span className="truncate max-w-[120px] sm:max-w-none">{cat.name}</span>
                          </>
                        )}
                        {card && (
                          <>
                            <span className="text-border">•</span>
                            <span className="inline-flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-none">
                              <CreditCardIcon className="size-3.5 opacity-70" />
                              {card.name}
                            </span>
                          </>
                        )}
                        {tx.store && (
                          <>
                            <span className="text-border">•</span>
                            <span className="truncate max-w-[140px] sm:max-w-none">{tx.store}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0 min-w-[90px] md:min-w-[110px]">
                      <p
                        className={`${compact ? "text-sm md:text-base" : "text-base md:text-lg"} font-bold tabular-nums tracking-tight ${
                          isIncome ? "text-income" : "text-expense"
                        }`}
                      >
                        {isIncome ? "+" : "−"} {formatCurrency(tx.amount)}
                      </p>
                      {!compact && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          {isIncome ? "Receita" : "Despesa"}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => duplicateToNextMonth(tx.id)}
                        title="Duplicar para próximo mês"
                        className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        onClick={() => { setEditTx(tx); setShowForm(true); }}
                        title="Editar"
                        className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        title="Excluir"
                        className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile actions row */}
                  <div className="sm:hidden flex items-center justify-end gap-1 px-4 pb-3 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => duplicateToNextMonth(tx.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="size-3.5" />
                      Duplicar
                    </button>
                    <button
                      onClick={() => { setEditTx(tx); setShowForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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
