import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import {
  type Transaction,
  type TransactionType,
  type CreditCard,
  type Category,
  type CardBrand,
  type Tag,
  applyAccentColor,
  DEFAULT_CATEGORIES,
} from "./finance-store";

interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  tags: Tag[];
  accentColor: string;
}

interface FinanceContextType {
  state: FinanceState;
  loading: boolean;
  addTransaction: (tx: Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId"> & { tagIds?: string[] }) => Promise<void>;
  addTransactionsBulk: (txs: Array<Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId">>) => Promise<number>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  updateTransactionAndFuture: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  duplicateToNextMonth: (id: string) => Promise<void>;
  duplicateTransaction: (id: string) => Promise<void>;
  bulkDeleteTransactions: (ids: string[]) => Promise<void>;
  bulkSetCategory: (ids: string[], categoryId: string) => Promise<void>;
  bulkAddTag: (ids: string[], tagId: string) => Promise<void>;
  bulkRemoveTag: (ids: string[], tagId: string) => Promise<void>;
  setTransactionTags: (txId: string, tagIds: string[]) => Promise<void>;
  addCategory: (name: string, type: TransactionType) => Promise<string | null>;
  deleteCategory: (id: string) => Promise<void>;
  addTag: (name: string, color: string) => Promise<string | null>;
  updateTag: (tag: Tag) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  addCreditCard: (card: Omit<CreditCard, "id">) => Promise<void>;
  updateCreditCard: (card: CreditCard) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  exportBackup: () => string;
  importBackup: (json: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const initialState: FinanceState = {
  transactions: [],
  categories: [],
  creditCards: [],
  tags: [],
  accentColor: "blue",
};

// DB row → app types
type TxRow = {
  id: string; type: TransactionType; description: string; amount: number | string; date: string;
  category_id: string | null; credit_card_id: string | null; store: string | null;
  purchase_date: string | null; billing_month: string | null;
  is_fixed: boolean; is_installment: boolean;
  total_installments: number | null; current_installment: number | null;
  installment_group_id: string | null; created_at: string;
};

function mapTx(r: TxRow): Transaction {
  return {
    id: r.id,
    type: r.type,
    description: r.description,
    amount: Number(r.amount),
    categoryId: r.category_id ?? "",
    date: r.date,
    isFixed: r.is_fixed,
    isInstallment: r.is_installment,
    totalInstallments: r.total_installments ?? 1,
    currentInstallment: r.current_installment ?? 1,
    installmentGroupId: r.installment_group_id ?? undefined,
    creditCardId: r.credit_card_id ?? undefined,
    store: r.store ?? undefined,
    purchaseDate: r.purchase_date ?? undefined,
    billingMonth: r.billing_month ?? undefined,
    createdAt: r.created_at,
  };
}

function txToRow(t: Transaction | (Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId"> & Partial<Pick<Transaction, "currentInstallment" | "installmentGroupId">>), userId: string) {
  return {
    user_id: userId,
    type: t.type,
    description: t.description,
    amount: t.amount,
    date: t.date,
    category_id: t.categoryId || null,
    credit_card_id: t.creditCardId || null,
    store: t.store || null,
    purchase_date: t.purchaseDate || null,
    billing_month: t.billingMonth || null,
    is_fixed: t.isFixed ?? false,
    is_installment: t.isInstallment ?? false,
    total_installments: t.totalInstallments ?? null,
    current_installment: t.currentInstallment ?? null,
    installment_group_id: t.installmentGroupId ?? null,
  };
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<FinanceState>(initialState);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(initialState);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: cats }, { data: cards }, { data: txs }, { data: profile }, { data: tagRows }, { data: txTagRows }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("credit_cards").select("*").order("name"),
      supabase.from("transactions").select("*"),
      supabase.from("profiles").select("accent_color").eq("id", user.id).maybeSingle(),
      supabase.from("tags").select("*").order("name"),
      supabase.from("transaction_tags").select("transaction_id, tag_id"),
    ]);

    const categories: Category[] = (cats || []).map((c) => ({ id: c.id, name: c.name, type: c.type as TransactionType }));

    // Seed default categories first time
    if (categories.length === 0) {
      const seed = DEFAULT_CATEGORIES.map((c) => ({ user_id: user.id, name: c.name, type: c.type }));
      const { data: inserted } = await supabase.from("categories").insert(seed).select("*");
      if (inserted) {
        for (const c of inserted) categories.push({ id: c.id, name: c.name, type: c.type as TransactionType });
      }
    }

    const creditCards: CreditCard[] = (cards || []).map((c) => ({
      id: c.id, name: c.name, lastDigits: c.last_digits ?? "", limit: Number(c.card_limit ?? 0),
      closingDay: c.closing_day ?? 25, dueDay: c.due_day ?? 5, color: c.color ?? "#3b82f6",
      brand: (c.brand ?? "other") as CardBrand,
    }));

    const tags: Tag[] = (tagRows || []).map((t) => ({ id: t.id, name: t.name, color: t.color ?? "#64748b" }));

    // Build txId -> tagIds map
    const tagsByTx: Record<string, string[]> = {};
    for (const r of (txTagRows || [])) {
      const key = r.transaction_id;
      if (!tagsByTx[key]) tagsByTx[key] = [];
      tagsByTx[key].push(r.tag_id);
    }

    const transactions = (txs || []).map((r) => {
      const tx = mapTx(r as TxRow);
      tx.tagIds = tagsByTx[tx.id] || [];
      return tx;
    });

    const accentColor = profile?.accent_color || "blue";
    applyAccentColor(accentColor);

    setState({ transactions, categories, creditCards, tags, accentColor });
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const persistTagsForTx = useCallback(async (txId: string, tagIds: string[]) => {
    if (!user) return;
    await supabase.from("transaction_tags").delete().eq("transaction_id", txId);
    if (tagIds.length > 0) {
      await supabase.from("transaction_tags").insert(
        tagIds.map((tag_id) => ({ transaction_id: txId, tag_id, user_id: user.id }))
      );
    }
  }, [user]);

  const addTransaction: FinanceContextType["addTransaction"] = async (input) => {
    if (!user) return;
    const tagIds = input.tagIds || [];
    if (input.isInstallment && input.totalInstallments > 1) {
      const groupId = uuidv4();
      const per = Math.round((input.amount / input.totalInstallments) * 100) / 100;
      const baseDate = input.billingMonth
        ? new Date(input.billingMonth + "-15T12:00:00")
        : new Date(input.date + "T12:00:00");
      const rows = [];
      for (let i = 0; i < input.totalInstallments; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const dateStr = d.toISOString().split("T")[0];
        const billingStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        rows.push(txToRow(
          { ...input, amount: per, currentInstallment: i + 1, installmentGroupId: groupId, date: dateStr, billingMonth: billingStr },
          user.id
        ));
      }
      const { data } = await supabase.from("transactions").insert(rows).select("*");
      if (data) {
        if (tagIds.length) {
          for (const row of data) await persistTagsForTx(row.id, tagIds);
        }
        setState((s) => ({
          ...s,
          transactions: [...s.transactions, ...data.map((r) => {
            const t = mapTx(r as TxRow); t.tagIds = [...tagIds]; return t;
          })],
        }));
      }
      return;
    }
    let finalDate = input.date;
    if (input.billingMonth && !input.isInstallment) {
      const day = input.date.split("-")[2] || "15";
      finalDate = `${input.billingMonth}-${day}`;
    }
    const row = txToRow({ ...input, date: finalDate, currentInstallment: 1 }, user.id);
    const { data } = await supabase.from("transactions").insert(row).select("*").single();
    if (data) {
      if (tagIds.length) await persistTagsForTx(data.id, tagIds);
      const t = mapTx(data as TxRow); t.tagIds = [...tagIds];
      setState((s) => ({ ...s, transactions: [...s.transactions, t] }));
    }
  };

  const addTransactionsBulk: FinanceContextType["addTransactionsBulk"] = async (txs) => {
    if (!user || txs.length === 0) return 0;
    const rows = txs.map((t) => txToRow({ ...t, currentInstallment: 1 }, user.id));
    const { data, error } = await supabase.from("transactions").insert(rows).select("*");
    if (error || !data) return 0;
    setState((s) => ({ ...s, transactions: [...s.transactions, ...data.map((r) => mapTx(r as TxRow))] }));
    return data.length;
  };

  const updateTransaction: FinanceContextType["updateTransaction"] = async (tx) => {
    if (!user) return;
    const { data } = await supabase.from("transactions").update(txToRow(tx, user.id)).eq("id", tx.id).select("*").single();
    if (data) setState((s) => ({ ...s, transactions: s.transactions.map((t) => t.id === tx.id ? mapTx(data as TxRow) : t) }));
  };

  const updateTransactionAndFuture: FinanceContextType["updateTransactionAndFuture"] = async (tx) => {
    if (!user) return;
    await updateTransaction(tx);
    if (tx.installmentGroupId) {
      const future = state.transactions.filter(
        (t) => t.installmentGroupId === tx.installmentGroupId && t.currentInstallment > tx.currentInstallment
      );
      for (const t of future) {
        const monthDiff = t.currentInstallment - tx.currentInstallment;
        const baseDate = new Date(tx.date + "T12:00:00");
        baseDate.setMonth(baseDate.getMonth() + monthDiff);
        const newDate = baseDate.toISOString().split("T")[0];
        await supabase.from("transactions").update({
          description: tx.description, amount: tx.amount, category_id: tx.categoryId,
          credit_card_id: tx.creditCardId || null, store: tx.store || null, date: newDate,
        }).eq("id", t.id);
      }
      await refresh();
    }
  };

  const deleteTransaction: FinanceContextType["deleteTransaction"] = async (id) => {
    const tx = state.transactions.find((t) => t.id === id);
    if (tx?.installmentGroupId) {
      await supabase.from("transactions").delete().eq("installment_group_id", tx.installmentGroupId);
      setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.installmentGroupId !== tx.installmentGroupId) }));
    } else {
      await supabase.from("transactions").delete().eq("id", id);
      setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
    }
  };

  const duplicateToNextMonth: FinanceContextType["duplicateToNextMonth"] = async (id) => {
    if (!user) return;
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    const d = new Date(tx.date + "T12:00:00");
    d.setMonth(d.getMonth() + 1);
    const newDate = d.toISOString().split("T")[0];
    const newBilling = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = txToRow({
      ...tx, date: newDate, billingMonth: tx.billingMonth ? newBilling : undefined,
      isInstallment: false, installmentGroupId: undefined, totalInstallments: 1, currentInstallment: 1,
    }, user.id);
    const { data } = await supabase.from("transactions").insert(row).select("*").single();
    if (data) setState((s) => ({ ...s, transactions: [...s.transactions, mapTx(data as TxRow)] }));
  };

  const addCategory: FinanceContextType["addCategory"] = async (name, type) => {
    if (!user) return null;
    const { data } = await supabase.from("categories").insert({ user_id: user.id, name, type }).select("*").single();
    if (data) {
      const cat = { id: data.id, name: data.name, type: data.type as TransactionType };
      setState((s) => ({ ...s, categories: [...s.categories, cat] }));
      return cat.id;
    }
    return null;
  };

  const deleteCategory: FinanceContextType["deleteCategory"] = async (id) => {
    await supabase.from("categories").delete().eq("id", id);
    setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
  };

  const addCreditCard: FinanceContextType["addCreditCard"] = async (card) => {
    if (!user) return;
    const { data } = await supabase.from("credit_cards").insert({
      user_id: user.id, name: card.name, brand: card.brand, last_digits: card.lastDigits,
      card_limit: card.limit, closing_day: card.closingDay, due_day: card.dueDay, color: card.color,
    }).select("*").single();
    if (data) {
      setState((s) => ({ ...s, creditCards: [...s.creditCards, {
        id: data.id, name: data.name, lastDigits: data.last_digits ?? "", limit: Number(data.card_limit ?? 0),
        closingDay: data.closing_day ?? 25, dueDay: data.due_day ?? 5, color: data.color ?? "#3b82f6",
        brand: (data.brand ?? "other") as CardBrand,
      }] }));
    }
  };

  const updateCreditCard: FinanceContextType["updateCreditCard"] = async (card) => {
    await supabase.from("credit_cards").update({
      name: card.name, brand: card.brand, last_digits: card.lastDigits,
      card_limit: card.limit, closing_day: card.closingDay, due_day: card.dueDay, color: card.color,
    }).eq("id", card.id);
    setState((s) => ({ ...s, creditCards: s.creditCards.map((c) => c.id === card.id ? card : c) }));
  };

  const deleteCreditCard: FinanceContextType["deleteCreditCard"] = async (id) => {
    await supabase.from("credit_cards").delete().eq("id", id);
    setState((s) => ({
      ...s,
      creditCards: s.creditCards.filter((c) => c.id !== id),
      transactions: s.transactions.filter((t) => t.creditCardId !== id),
    }));
  };

  const setAccentColor: FinanceContextType["setAccentColor"] = async (color) => {
    applyAccentColor(color);
    setState((s) => ({ ...s, accentColor: color }));
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, accent_color: color });
    }
  };

  const exportBackup = () => JSON.stringify({
    transactions: state.transactions,
    categories: state.categories,
    creditCards: state.creditCards,
    accentColor: state.accentColor,
    exportedAt: new Date().toISOString(),
  }, null, 2);

  const importBackup: FinanceContextType["importBackup"] = async (json) => {
    if (!user) return false;
    try {
      const data = JSON.parse(json);
      if (!data.transactions || !data.categories) return false;
      // Wipe existing
      await supabase.from("transactions").delete().eq("user_id", user.id);
      await supabase.from("credit_cards").delete().eq("user_id", user.id);
      await supabase.from("categories").delete().eq("user_id", user.id);
      // Insert categories first; map old id → new id
      const catIdMap: Record<string, string> = {};
      if (data.categories.length) {
        const { data: insCats } = await supabase.from("categories")
          .insert(data.categories.map((c: Category) => ({ user_id: user.id, name: c.name, type: c.type })))
          .select("*");
        (insCats || []).forEach((c, i) => { catIdMap[data.categories[i].id] = c.id; });
      }
      const cardIdMap: Record<string, string> = {};
      if (data.creditCards?.length) {
        const { data: insCards } = await supabase.from("credit_cards").insert(
          data.creditCards.map((c: CreditCard) => ({
            user_id: user.id, name: c.name, brand: c.brand, last_digits: c.lastDigits,
            card_limit: c.limit, closing_day: c.closingDay, due_day: c.dueDay, color: c.color,
          }))
        ).select("*");
        (insCards || []).forEach((c, i) => { cardIdMap[data.creditCards[i].id] = c.id; });
      }
      if (data.transactions.length) {
        await supabase.from("transactions").insert(
          data.transactions.map((t: Transaction) => txToRow({
            ...t,
            categoryId: catIdMap[t.categoryId] || "",
            creditCardId: t.creditCardId ? cardIdMap[t.creditCardId] : undefined,
          }, user.id))
        );
      }
      if (data.accentColor) await setAccentColor(data.accentColor);
      await refresh();
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  };

  return (
    <FinanceContext.Provider value={{
      state, loading, addTransaction, updateTransaction, updateTransactionAndFuture,
      deleteTransaction, duplicateToNextMonth, addCategory, deleteCategory,
      addCreditCard, updateCreditCard, deleteCreditCard, setAccentColor,
      exportBackup, importBackup, refresh,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
