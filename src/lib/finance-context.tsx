import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  type FinanceState,
  type Transaction,
  type TransactionType,
  type CreditCard,
  getDefaultState,
  loadState,
  saveState,
  addTransaction as addTx,
  updateTransaction as updateTx,
  updateTransactionAndFuture as updateTxFuture,
  deleteTransaction as deleteTx,
  addCategory as addCat,
  deleteCategory as delCat,
  addCreditCard as addCard,
  updateCreditCard as updateCard,
  deleteCreditCard as delCard,
  applyAccentColor,
  importData,
  exportData,
} from "./finance-store";

interface FinanceContextType {
  state: FinanceState;
  addTransaction: (tx: Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId">) => void;
  updateTransaction: (tx: Transaction) => void;
  updateTransactionAndFuture: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (name: string, type: TransactionType) => void;
  deleteCategory: (id: string) => void;
  addCreditCard: (card: Omit<CreditCard, "id">) => void;
  updateCreditCard: (card: CreditCard) => void;
  deleteCreditCard: (id: string) => void;
  setAccentColor: (color: string) => void;
  exportBackup: () => string;
  importBackup: (json: string) => boolean;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(getDefaultState);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage only on client after mount
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    applyAccentColor(loaded.accentColor);
    setHydrated(true);
  }, []);

  const update = useCallback((fn: (s: FinanceState) => FinanceState) => {
    setState((prev) => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const ctx: FinanceContextType = {
    state: hydrated ? state : getDefaultState(),
    addTransaction: (tx) => update((s) => addTx(s, tx)),
    updateTransaction: (tx) => update((s) => updateTx(s, tx)),
    updateTransactionAndFuture: (tx) => update((s) => updateTxFuture(s, tx)),
    deleteTransaction: (id) => update((s) => deleteTx(s, id)),
    addCategory: (name, type) => update((s) => addCat(s, name, type)),
    deleteCategory: (id) => update((s) => delCat(s, id)),
    addCreditCard: (card) => update((s) => addCard(s, card)),
    updateCreditCard: (card) => update((s) => updateCard(s, card)),
    deleteCreditCard: (id) => update((s) => delCard(s, id)),
    setAccentColor: (color) => {
      applyAccentColor(color);
      update((s) => ({ ...s, accentColor: color }));
    },
    exportBackup: () => exportData(state),
    importBackup: (json: string) => {
      const data = importData(json);
      if (data) {
        saveState(data);
        setState(data);
        applyAccentColor(data.accentColor);
        return true;
      }
      return false;
    },
  };

  return <FinanceContext.Provider value={ctx}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
