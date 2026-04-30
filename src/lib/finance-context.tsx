import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  type FinanceState,
  type Transaction,
  type TransactionType,
  type CreditCard,
  loadState,
  saveState,
  addTransaction as addTx,
  updateTransaction as updateTx,
  deleteTransaction as deleteTx,
  addCategory as addCat,
  deleteCategory as delCat,
  addCreditCard as addCard,
  updateCreditCard as updateCard,
  deleteCreditCard as delCard,
} from "./finance-store";

interface FinanceContextType {
  state: FinanceState;
  addTransaction: (tx: Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId">) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (name: string, type: TransactionType) => void;
  deleteCategory: (id: string) => void;
  addCreditCard: (card: Omit<CreditCard, "id">) => void;
  updateCreditCard: (card: CreditCard) => void;
  deleteCreditCard: (id: string) => void;
  setAccentColor: (color: string) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(loadState);

  const update = useCallback((fn: (s: FinanceState) => FinanceState) => {
    setState((prev) => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const ctx: FinanceContextType = {
    state,
    addTransaction: (tx) => update((s) => addTx(s, tx)),
    updateTransaction: (tx) => update((s) => updateTx(s, tx)),
    deleteTransaction: (id) => update((s) => deleteTx(s, id)),
    addCategory: (name, type) => update((s) => addCat(s, name, type)),
    deleteCategory: (id) => update((s) => delCat(s, id)),
    addCreditCard: (card) => update((s) => addCard(s, card)),
    updateCreditCard: (card) => update((s) => updateCard(s, card)),
    deleteCreditCard: (id) => update((s) => delCard(s, id)),
    setAccentColor: (color) => update((s) => ({ ...s, accentColor: color })),
  };

  return <FinanceContext.Provider value={ctx}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
