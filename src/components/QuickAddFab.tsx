import { useState, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useFinance } from "@/lib/finance-context";
import { type TransactionType } from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { useRouterState } from "@tanstack/react-router";

export function QuickAddFab() {
  const { state, addTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Hide FAB on auth route
  if (pathname === "/auth") return null;

  const cats = useMemo(
    () => state.categories.filter((c) => c.type === type),
    [state.categories, type]
  );

  const reset = () => {
    setDescription("");
    setAmount("");
    setCategoryId("");
    setDate(new Date().toISOString().split("T")[0]);
    setType("expense");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = async () => {
    const val = parseFloat(amount);
    if (!description.trim() || !val || val <= 0) return;
    setSaving(true);
    await addTransaction({
      description: description.trim(),
      amount: val,
      type,
      categoryId,
      date,
      isFixed: false,
      isInstallment: false,
      totalInstallments: 1,
    });
    setSaving(false);
    close();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Lançamento rápido"
      >
        <Plus className="size-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card w-full sm:max-w-md p-5 m-0 sm:m-4 max-h-[90vh] overflow-y-auto border border-border bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-semibold">Lançamento rápido</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setType(t);
                    setCategoryId("");
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    type === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t === "income" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="R$ 0,00"
                step="0.01"
                inputMode="decimal"
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-base font-medium tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sem categoria</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="outline" onClick={close} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={submit}
                disabled={saving || !description.trim() || !amount}
                className="flex-1"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
