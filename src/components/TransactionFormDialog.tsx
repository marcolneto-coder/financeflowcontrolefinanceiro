import { useState, useMemo } from "react";
import { useFinance } from "@/lib/finance-context";
import { type Transaction, type TransactionType, formatCurrency, getNextMonth } from "@/lib/finance-store";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  editTransaction: Transaction | null;
  onClose: () => void;
}

export function TransactionFormDialog({ editTransaction, onClose }: Props) {
  const { state, addTransaction, updateTransactionAndFuture, addCategory } = useFinance();
  const isEdit = !!editTransaction;

  const [type, setType] = useState<TransactionType>(editTransaction?.type || "expense");
  const [description, setDescription] = useState(editTransaction?.description || "");
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() || "");
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || "");
  const [date, setDate] = useState(editTransaction?.date || new Date().toISOString().split("T")[0]);
  const [isFixed, setIsFixed] = useState(editTransaction?.isFixed || false);
  const [isInstallment, setIsInstallment] = useState(editTransaction?.isInstallment || false);
  const [totalInstallments, setTotalInstallments] = useState(editTransaction?.totalInstallments?.toString() || "2");
  const [creditCardId, setCreditCardId] = useState(editTransaction?.creditCardId || "");
  const [store, setStore] = useState(editTransaction?.store || "");
  const [purchaseDate, setPurchaseDate] = useState(editTransaction?.purchaseDate || new Date().toISOString().split("T")[0]);
  
  // Billing month: default to next month
  const nextMonth = getNextMonth();
  const defaultBillingMonth = editTransaction?.billingMonth || `${nextMonth.year}-${String(nextMonth.month + 1).padStart(2, "0")}`;
  const [billingMonth, setBillingMonth] = useState(defaultBillingMonth);
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);

  const filteredCategories = useMemo(
    () => state.categories.filter((c) => c.type === type),
    [state.categories, type]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const parsedInstallments = parseInt(totalInstallments) || 2;
  const installmentValue = parsedAmount > 0 && parsedInstallments > 0
    ? Math.round((parsedAmount / parsedInstallments) * 100) / 100
    : 0;

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const newId = await addCategory(trimmed, type);
    if (newId) setCategoryId(newId);
    setShowNewCategory(false);
    setNewCategoryName("");
  };

  // Parse billing month to get starting month info for installment preview
  const billingMonthDate = new Date(billingMonth + "-15T12:00:00");
  const installmentPreview = useMemo(() => {
    if (!isInstallment || parsedAmount <= 0) return [];
    const items = [];
    for (let i = 0; i < parsedInstallments; i++) {
      const d = new Date(billingMonthDate);
      d.setMonth(d.getMonth() + i);
      items.push({
        label: `${MONTHS[d.getMonth()]}/${d.getFullYear()}`,
        value: installmentValue,
        num: i + 1,
      });
    }
    return items;
  }, [isInstallment, parsedAmount, parsedInstallments, billingMonth, installmentValue]);

  const handleSubmit = () => {
    if (!description.trim() || parsedAmount <= 0) return;

    const hasCreditCard = type === "expense" && creditCardId;

    if (isEdit && editTransaction) {
      updateTransactionAndFuture({
        ...editTransaction,
        description: description.trim(),
        amount: parsedAmount,
        type,
        categoryId,
        date,
        isFixed,
        creditCardId: creditCardId || undefined,
        store: store || undefined,
        purchaseDate: hasCreditCard ? purchaseDate : undefined,
        billingMonth: hasCreditCard ? billingMonth : undefined,
      });
    } else {
      addTransaction({
        description: description.trim(),
        amount: parsedAmount,
        type,
        categoryId,
        date: hasCreditCard ? billingMonth + "-" + purchaseDate.split("-")[2] : date,
        isFixed,
        isInstallment: type === "expense" && isInstallment,
        totalInstallments: type === "expense" && isInstallment ? parsedInstallments : 1,
        creditCardId: type === "expense" && creditCardId ? creditCardId : undefined,
        store: store || undefined,
        purchaseDate: hasCreditCard ? purchaseDate : undefined,
        billingMonth: hasCreditCard ? billingMonth : undefined,
      });
    }
    onClose();
  };

  const showCardFields = type === "expense" && creditCardId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-4 md:p-6 m-4 max-h-[90vh] overflow-y-auto border border-border bg-card rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Editar Transação" : "Nova Transação"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Type Toggle */}
        {!isEdit && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-5">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  type === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {t === "income" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel, Salário..."
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {isInstallment && !isEdit ? "Valor Total" : "Valor"}
            </label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00" step="0.01" min="0"
              className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring tabular-nums" />
          </div>

          {/* Credit Card selection (before date so billing month shows) */}
          {type === "expense" && state.creditCards.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cartão de Crédito (opcional)</label>
              <select value={creditCardId} onChange={(e) => setCreditCardId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Nenhum</option>
                {state.creditCards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</option>
                ))}
              </select>
            </div>
          )}

          {/* Card-specific fields */}
          {showCardFields && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Loja / Estabelecimento</label>
                <input type="text" value={store} onChange={(e) => setStore(e.target.value)}
                  placeholder="Ex: Amazon, iFood..."
                  className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data da compra</label>
                <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fatura de lançamento (mês)</label>
                <input type="month" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <p className="text-[10px] text-muted-foreground mt-1">Define em qual mês a despesa será lançada</p>
              </div>
            </>
          )}

          {/* Date (only for non-card transactions) */}
          {!showCardFields && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria</label>
            <div className="flex gap-2">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Selecionar...</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={() => setShowNewCategory(!showNewCategory)} className="p-2.5 rounded-lg bg-input hover:bg-accent transition-colors" title="Nova categoria">
                <Plus className="size-4" />
              </button>
            </div>
            {showNewCategory && (
              <div className="flex gap-2 mt-2">
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="flex-1 px-3 py-2 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} />
                <Button size="sm" onClick={handleCreateCategory}>Criar</Button>
              </div>
            )}
          </div>

          {/* Fixed */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} className="size-4 rounded accent-primary" />
            <span className="text-sm">Despesa/Receita fixa (recorrente)</span>
          </label>

          {/* Installment */}
          {type === "expense" && !isEdit && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isInstallment} onChange={(e) => setIsInstallment(e.target.checked)} className="size-4 rounded accent-primary" />
                <span className="text-sm">Parcelada</span>
              </label>

              {isInstallment && (
                <div className="pl-7 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Número de parcelas</label>
                    <input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} min="2" max="48"
                      className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  {parsedAmount > 0 && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                      <p className="text-sm font-medium text-primary">
                        {parsedInstallments}x de {formatCurrency(installmentValue)}
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {installmentPreview.map((p) => (
                          <div key={p.num} className="flex justify-between text-xs text-muted-foreground">
                            <span>Parcela {p.num} — {p.label}</span>
                            <span className="tabular-nums">{formatCurrency(p.value)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground border-t border-border pt-1">
                        Total: {formatCurrency(parsedAmount)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!description.trim() || parsedAmount <= 0}>
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
