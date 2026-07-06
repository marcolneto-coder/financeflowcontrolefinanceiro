import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFinance } from "@/lib/finance-context";
import { formatCurrency, getBillingCycleFor } from "@/lib/finance-store";
import { ArrowLeft, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

export const Route = createFileRoute("/cards/$cardId/invoice")({
  component: InvoicePage,
  head: () => ({
    meta: [{ title: "Fatura — Finance Flow" }],
  }),
});

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function InvoicePage() {
  const { cardId } = Route.useParams();
  const { state } = useFinance();
  const card = state.creditCards.find((c) => c.id === cardId);
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = current, +1 next, -1 prev

  const cycle = useMemo(() => {
    if (!card) return null;
    // Anchor: today shifted by `offset` months
    const anchor = new Date(now.getFullYear(), now.getMonth() + offset, Math.min(now.getDate(), 28));
    return getBillingCycleFor(anchor, card.closingDay, card.dueDay);
  }, [card, offset, now]);

  const txs = useMemo(() => {
    if (!card || !cycle) return [];
    return state.transactions
      .filter((t) => t.creditCardId === card.id && t.type === "expense")
      .filter((t) => {
        // Use billingMonth if defined, else purchaseDate/date within cycle
        if (t.billingMonth) return t.billingMonth === cycle.invoiceMonth;
        const d = new Date((t.purchaseDate || t.date) + "T12:00:00");
        return d >= cycle.cycleStart && d <= cycle.cycleEnd;
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [card, cycle, state.transactions]);

  const total = txs.reduce((s, t) => s + t.amount, 0);
  const pct = card && card.limit > 0 ? (total / card.limit) * 100 : 0;

  if (!card) {
    return (
      <div className="p-8">
        <p className="text-sm">Cartão não encontrado.</p>
        <Link to="/cards" className="text-primary text-sm">← Voltar para cartões</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl pt-16 md:pt-8">
      <Link to="/cards" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>
      <header className="mb-6">
        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
          <Receipt className="size-4" /> Fatura por ciclo
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{card.name}</h1>
        <p className="text-xs text-muted-foreground mt-1">Fecha dia {card.closingDay} · Vence dia {card.dueDay}</p>
      </header>

      <div className="glass-card p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setOffset((o) => o - 1)} className="p-2 rounded-lg hover:bg-accent">
            <ChevronLeft className="size-4" />
          </button>
          {cycle && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Fatura de</p>
              <p className="text-lg md:text-xl font-semibold">
                {MONTHS[cycle.dueDate.getMonth()]} {cycle.dueDate.getFullYear()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {cycle.cycleStart.toLocaleDateString("pt-BR")} → {cycle.cycleEnd.toLocaleDateString("pt-BR")} · Vence {cycle.dueDate.toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
          <button onClick={() => setOffset((o) => o + 1)} className="p-2 rounded-lg hover:bg-accent">
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-lg md:text-2xl font-semibold tabular-nums text-expense mt-1">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lançamentos</p>
            <p className="text-lg md:text-2xl font-semibold tabular-nums mt-1">{txs.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Limite usado</p>
            <p className={`text-lg md:text-2xl font-semibold tabular-nums mt-1 ${pct >= 100 ? "text-expense" : pct >= 80 ? "text-amber-500" : ""}`}>
              {pct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 md:p-6">
        <h2 className="text-sm font-medium mb-4">Lançamentos</h2>
        {txs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Sem lançamentos nesta fatura.</p>
        ) : (
          <div className="space-y-1">
            {txs.map((t) => {
              const cat = state.categories.find((c) => c.id === t.categoryId);
              return (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                  <div className="size-8 rounded-full bg-expense/10 text-expense flex items-center justify-center text-xs font-medium">
                    {t.description.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium truncate">{t.description}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                      {cat?.name || "Sem categoria"}
                      {t.store ? ` · ${t.store}` : ""}
                      {t.isInstallment ? ` · ${t.currentInstallment}/${t.totalInstallments}` : ""}
                      {" · "}{new Date((t.purchaseDate || t.date) + "T12:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <p className="text-xs md:text-sm font-semibold tabular-nums text-expense">
                    - {formatCurrency(t.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
