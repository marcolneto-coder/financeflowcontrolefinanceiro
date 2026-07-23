import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFinance } from "@/lib/finance-context";
import { formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/simulator")({
  component: SimulatorPage,
  head: () => ({
    meta: [
      { title: "Simulador de Compras — Finance Flow" },
      { name: "description", content: "Simule o impacto de uma compra parcelada" },
    ],
  }),
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function SimulatorPage() {
  const { state, addTransaction } = useFinance();
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("6");
  const [creditCardId, setCreditCardId] = useState(state.creditCards[0]?.id || "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [scope, setScope] = useState<"thisCard" | "allCards" | "allExpenses">("thisCard");

  const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;
  const parsedInstallments = Math.max(1, parseInt(installments) || 1);
  const perInstallment = parsedAmount > 0 ? Math.round((parsedAmount / parsedInstallments) * 100) / 100 : 0;

  const now = getCurrentMonth();

  // Projection: for each of the next N months, sum existing expenses + new installment
  const projection = useMemo(() => {
    const months = Math.max(parsedInstallments, 6);
    const rows: { label: string; existing: number; simulated: number; y: number; m: number }[] = [];
    for (let i = 0; i < months; i++) {
      const m = (now.month + i) % 12;
      const y = now.year + Math.floor((now.month + i) / 12);
      const existing = state.transactions
        .filter((t) => {
          if (t.type !== "expense") return false;
          if (scope === "thisCard") {
            if (!creditCardId) return false;
            if (t.creditCardId !== creditCardId) return false;
          } else if (scope === "allCards") {
            if (!t.creditCardId) return false;
          }
          const d = new Date(t.date + "T12:00:00");
          return d.getFullYear() === y && d.getMonth() === m;
        })
        .reduce((s, t) => s + t.amount, 0);
      const simulated = i < parsedInstallments ? perInstallment : 0;
      rows.push({ label: `${MONTHS[m]}/${String(y).slice(2)}`, existing, simulated, y, m });
    }
    return rows;
  }, [parsedInstallments, perInstallment, state.transactions, now.year, now.month, scope, creditCardId]);

  const maxBar = Math.max(1, ...projection.map((p) => p.existing + p.simulated));

  const handleCreate = async () => {
    if (!description.trim() || parsedAmount <= 0 || !creditCardId) return;
    setCreating(true);
    const nextMonth = { year: now.year + (now.month === 11 ? 1 : 0), month: (now.month + 1) % 12 };
    const billing = `${nextMonth.year}-${String(nextMonth.month + 1).padStart(2, "0")}`;
    await addTransaction({
      description: description.trim(),
      amount: parsedAmount,
      type: "expense",
      categoryId,
      date: new Date().toISOString().split("T")[0],
      isFixed: false,
      isInstallment: true,
      totalInstallments: parsedInstallments,
      creditCardId,
      billingMonth: billing,
      purchaseDate: new Date().toISOString().split("T")[0],
    });
    setCreating(false);
    setCreated(true);
    setTimeout(() => setCreated(false), 3000);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl pt-16 md:pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
          <Calculator className="size-4" /> Planejamento
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Simulador de Parcelamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Veja o impacto de uma compra parcelada nos próximos meses.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-4 md:p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição (opcional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Notebook novo"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor total</label>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Número de parcelas</label>
            <input type="number" min="1" max="48" value={installments} onChange={(e) => setInstallments(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cartão</label>
            <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Sem cartão</option>
              {state.creditCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria (opcional)</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Sem categoria</option>
              {state.categories.filter((c) => c.type === "expense").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">Impacto mensal</p>
            <p className="text-2xl font-semibold tabular-nums text-primary mt-1">
              {parsedInstallments}x {formatCurrency(perInstallment)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total: {formatCurrency(parsedAmount)}</p>
          </div>

          <Button onClick={handleCreate} disabled={!description.trim() || parsedAmount <= 0 || !creditCardId || creating} className="w-full">
            {creating ? "Criando..." : created ? "✓ Transação criada!" : "Criar transação parcelada"}
          </Button>
        </div>

        <div className="glass-card p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Impacto na projeção</h2>
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comparar contra</label>
            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
              {([
                { v: "thisCard", label: "Somente este cartão" },
                { v: "allCards", label: "Todos os cartões" },
                { v: "allExpenses", label: "Todas as despesas" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setScope(opt.v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    scope === opt.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {scope === "thisCard" && !creditCardId && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Selecione um cartão acima para comparar.</p>
            )}
          </div>
          {parsedAmount <= 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Informe o valor para ver o impacto.</p>
          ) : (
            <div className="space-y-2">
              {projection.map((row, i) => {
                const total = row.existing + row.simulated;
                const existingPct = (row.existing / maxBar) * 100;
                const simulatedPct = (row.simulated / maxBar) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(row.existing)}
                        {row.simulated > 0 && <span className="text-primary"> + {formatCurrency(row.simulated)}</span>}
                        {" = "}<span className="font-medium text-foreground">{formatCurrency(total)}</span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-expense/70" style={{ width: `${existingPct}%` }} />
                      <div className="h-full bg-primary" style={{ width: `${simulatedPct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 pt-3 text-[10px] text-muted-foreground border-t border-border">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-expense/70" />
                  {scope === "thisCard" ? "Gastos deste cartão" : scope === "allCards" ? "Gastos de todos os cartões" : "Todas as despesas"}
                </span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Parcelamento simulado</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
