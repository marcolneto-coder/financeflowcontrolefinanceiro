import { v4 as uuidv4 } from "uuid";

export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface CreditCard {
  id: string;
  name: string;
  lastDigits: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // YYYY-MM-DD
  isFixed: boolean;
  isInstallment: boolean;
  totalInstallments: number;
  currentInstallment: number;
  installmentGroupId?: string;
  creditCardId?: string;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  accentColor: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Salário", type: "income" },
  { id: "cat-2", name: "Freelance", type: "income" },
  { id: "cat-3", name: "Investimentos", type: "income" },
  { id: "cat-4", name: "Alimentação", type: "expense" },
  { id: "cat-5", name: "Moradia", type: "expense" },
  { id: "cat-6", name: "Transporte", type: "expense" },
  { id: "cat-7", name: "Lazer", type: "expense" },
  { id: "cat-8", name: "Saúde", type: "expense" },
  { id: "cat-9", name: "Educação", type: "expense" },
  { id: "cat-10", name: "Assinaturas", type: "expense" },
];

const STORAGE_KEY = "alento-finance-data";

function getDefaultState(): FinanceState {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    creditCards: [],
    accentColor: "blue",
  };
}

export function loadState(): FinanceState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return { ...getDefaultState(), ...JSON.parse(data) };
  } catch {}
  return getDefaultState();
}

export function saveState(state: FinanceState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function addTransaction(
  state: FinanceState,
  input: Omit<Transaction, "id" | "currentInstallment" | "installmentGroupId">
): FinanceState {
  if (input.isInstallment && input.totalInstallments > 1) {
    const groupId = uuidv4();
    const perInstallment = Math.round((input.amount / input.totalInstallments) * 100) / 100;
    const baseDate = new Date(input.date + "T12:00:00");
    const newTransactions: Transaction[] = [];

    for (let i = 0; i < input.totalInstallments; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      newTransactions.push({
        ...input,
        id: uuidv4(),
        amount: perInstallment,
        currentInstallment: i + 1,
        installmentGroupId: groupId,
        date: d.toISOString().split("T")[0],
      });
    }
    return { ...state, transactions: [...state.transactions, ...newTransactions] };
  }

  return {
    ...state,
    transactions: [
      ...state.transactions,
      { ...input, id: uuidv4(), currentInstallment: 1, installmentGroupId: undefined },
    ],
  };
}

export function updateTransaction(state: FinanceState, updated: Transaction): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
  };
}

export function deleteTransaction(state: FinanceState, id: string): FinanceState {
  const tx = state.transactions.find((t) => t.id === id);
  if (tx?.installmentGroupId) {
    return {
      ...state,
      transactions: state.transactions.filter(
        (t) => t.installmentGroupId !== tx.installmentGroupId
      ),
    };
  }
  return { ...state, transactions: state.transactions.filter((t) => t.id !== id) };
}

export function addCategory(state: FinanceState, name: string, type: TransactionType): FinanceState {
  return {
    ...state,
    categories: [...state.categories, { id: uuidv4(), name, type }],
  };
}

export function deleteCategory(state: FinanceState, id: string): FinanceState {
  return { ...state, categories: state.categories.filter((c) => c.id !== id) };
}

export function addCreditCard(
  state: FinanceState,
  card: Omit<CreditCard, "id">
): FinanceState {
  return {
    ...state,
    creditCards: [...state.creditCards, { ...card, id: uuidv4() }],
  };
}

export function updateCreditCard(state: FinanceState, card: CreditCard): FinanceState {
  return {
    ...state,
    creditCards: state.creditCards.map((c) => (c.id === card.id ? card : c)),
  };
}

export function deleteCreditCard(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    creditCards: state.creditCards.filter((c) => c.id !== id),
    transactions: state.transactions.filter((t) => t.creditCardId !== id),
  };
}

export function getMonthTransactions(transactions: Transaction[], year: number, month: number) {
  return transactions.filter((t) => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getMonthSummary(transactions: Transaction[], year: number, month: number) {
  const monthTx = getMonthTransactions(transactions, year, month);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expenses, balance: income - expenses, transactions: monthTx };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
