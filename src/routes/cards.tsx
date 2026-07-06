import { createFileRoute, Link } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { formatCurrency, type CardBrand } from "@/lib/finance-store";
import { useState } from "react";
import { Plus, Pencil, Trash2, X, CreditCard, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardBrandIcon, CARD_BRANDS } from "@/components/CardBrandIcon";

export const Route = createFileRoute("/cards")({
  component: CardsPage,
  head: () => ({
    meta: [
      { title: "Cartões — Finance Flow" },
      { name: "description", content: "Gerencie seus cartões de crédito" },
    ],
  }),
});

const CARD_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#ef4444", "#06b6d4", "#6366f1", "#1e293b", "#78716c",
];

function CardsPage() {
  const { state, addCreditCard, updateCreditCard, deleteCreditCard } = useFinance();
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<typeof state.creditCards[0] | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Gerenciar</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Cartões de Crédito</h1>
        </div>
        <Button onClick={() => { setEditCard(null); setShowForm(true); }}>
          <Plus className="size-4" />
          Novo cartão
        </Button>
      </header>

      {state.creditCards.length === 0 ? (
        <div className="glass-card p-8 md:p-12 text-center text-muted-foreground">
          <CreditCard className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Nenhum cartão cadastrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {state.creditCards.map((card) => {
            const cardExpenses = state.transactions.filter(
              (t) => t.creditCardId === card.id && t.type === "expense"
            );
            const now = new Date();
            const monthExpenses = cardExpenses.filter((t) => {
              const d = new Date(t.date + "T12:00:00");
              return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            });
            const spent = monthExpenses.reduce((s, t) => s + t.amount, 0);
            const pct = card.limit > 0 ? (spent / card.limit) * 100 : 0;

            return (
              <div key={card.id} className="space-y-4">
                <div
                  className="relative aspect-[1.6/1] p-4 md:p-6 rounded-2xl text-white shadow-xl overflow-hidden flex flex-col justify-between"
                  style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}99)` }}
                >
                  <div className="absolute top-0 right-0 size-40 bg-white/10 blur-[50px] rounded-full -mr-20 -mt-20" />
                  <div className="flex justify-between items-start relative z-10">
                    <CardBrandIcon brand={card.brand || "other"} className="w-12 h-8" />
                    <div className="flex gap-1">
                      <button onClick={() => { setEditCard(card); setShowForm(true); }} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => deleteCreditCard(card.id)} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/50 transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <p className="text-xs md:text-sm opacity-60 mb-1">{card.name}</p>
                    <p className="text-base md:text-lg tracking-[0.2em] font-light">
                      •••• •••• •••• {card.lastDigits}
                    </p>
                  </div>
                </div>

                <div className="glass-card p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Fatura do mês</span>
                    <span className="tabular-nums font-medium">
                      {formatCurrency(spent)} / {formatCurrency(card.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: pct >= 100 ? "var(--expense)" : pct >= 80 ? "#f59e0b" : card.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-xs font-medium ${pct >= 100 ? "text-expense" : pct >= 80 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {pct.toFixed(1)}% utilizado
                      {pct >= 100 ? " ⚠ limite excedido" : pct >= 80 ? " ⚠ atenção" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Fecha dia {card.closingDay}</span>
                    <span>Vence dia {card.dueDay}</span>
                  </div>
                  <Link
                    to="/cards/$cardId/invoice"
                    params={{ cardId: card.id }}
                    className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium bg-accent/50 hover:bg-accent transition-colors"
                  >
                    <Receipt className="size-3.5" /> Ver fatura por ciclo
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CardFormDialog
          editCard={editCard}
          onClose={() => { setShowForm(false); setEditCard(null); }}
          onSave={(data) => {
            if (editCard) {
              updateCreditCard({ ...editCard, ...data });
            } else {
              addCreditCard(data);
            }
            setShowForm(false);
            setEditCard(null);
          }}
        />
      )}
    </div>
  );
}

function CardFormDialog({
  editCard,
  onClose,
  onSave,
}: {
  editCard: { id: string; name: string; lastDigits: string; limit: number; closingDay: number; dueDay: number; color: string; brand?: CardBrand } | null;
  onClose: () => void;
  onSave: (data: { name: string; lastDigits: string; limit: number; closingDay: number; dueDay: number; color: string; brand: CardBrand }) => void;
}) {
  const [name, setName] = useState(editCard?.name || "");
  const [lastDigits, setLastDigits] = useState(editCard?.lastDigits || "");
  const [limit, setLimit] = useState(editCard?.limit?.toString() || "");
  const [closingDay, setClosingDay] = useState(editCard?.closingDay?.toString() || "25");
  const [dueDay, setDueDay] = useState(editCard?.dueDay?.toString() || "5");
  const [color, setColor] = useState(editCard?.color || CARD_COLORS[0]);
  const [brand, setBrand] = useState<CardBrand>(editCard?.brand || "visa");

  const handleSubmit = () => {
    if (!name.trim() || !lastDigits.trim()) return;
    onSave({
      name: name.trim(),
      lastDigits: lastDigits.trim(),
      limit: parseFloat(limit) || 0,
      closingDay: parseInt(closingDay) || 25,
      dueDay: parseInt(dueDay) || 5,
      color,
      brand,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto border border-border bg-card rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">{editCard ? "Editar Cartão" : "Novo Cartão"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bandeira</label>
            <div className="grid grid-cols-3 gap-2">
              {CARD_BRANDS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => setBrand(b.value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${
                    brand === b.value ? "bg-primary/10 ring-2 ring-ring" : "bg-input hover:bg-accent"
                  }`}
                >
                  <CardBrandIcon brand={b.value} className="w-10 h-6" />
                  <span className="text-[10px] font-medium">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do cartão</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Itaú..."
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Últimos 4 dígitos</label>
            <input type="text" value={lastDigits} onChange={(e) => setLastDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" maxLength={4}
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Limite</label>
            <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="10000" step="100" min="0"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Dia fechamento</label>
              <input type="number" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} min="1" max="31"
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Dia vencimento</label>
              <input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} min="1" max="31"
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-full transition-all ${color === c ? "ring-2 ring-ring ring-offset-2 ring-offset-card scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!name.trim() || !lastDigits.trim()}>
            {editCard ? "Salvar" : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
