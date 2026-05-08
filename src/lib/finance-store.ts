// Pure types & helpers (no localStorage). Persistence happens in finance-context via Supabase.

export type TransactionType = "income" | "expense";
export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other";

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
  brand: CardBrand;
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
  store?: string;
  purchaseDate?: string;
  billingMonth?: string; // YYYY-MM
  createdAt?: string;
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

export function getNextMonth(): { year: number; month: number } {
  const now = new Date();
  let m = now.getMonth() + 1;
  let y = now.getFullYear();
  if (m > 11) { m = 0; y++; }
  return { year: y, month: m };
}

export function getCurrentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export type ThemeMode = "light" | "dark";

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") root.classList.add("light");
  else root.classList.remove("light");
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "dark";
  return (localStorage.getItem("theme-mode") as ThemeMode) || "dark";
}

export function setStoredThemeMode(mode: ThemeMode) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("theme-mode", mode);
  applyThemeMode(mode);
}

// Font size scaling (in pt). Default = 16pt (browser default). Step = 0.5pt.
export const FONT_SIZE_DEFAULT = 16;
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 22;
export const FONT_SIZE_STEP = 0.5;

export function applyFontSize(size: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${size}px`;
}

export function getStoredFontSize(): number {
  if (typeof localStorage === "undefined") return FONT_SIZE_DEFAULT;
  const v = parseFloat(localStorage.getItem("font-size") || "");
  return Number.isFinite(v) ? v : FONT_SIZE_DEFAULT;
}

export function setStoredFontSize(size: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("font-size", String(size));
  applyFontSize(size);
}

export const ACCENT_COLORS: Record<string, { primary: string; ring: string; sidebarPrimary: string }> = {
  blue: { primary: "oklch(0.7 0.12 220)", ring: "oklch(0.7 0.12 220)", sidebarPrimary: "oklch(0.7 0.12 220)" },
  violet: { primary: "oklch(0.65 0.15 300)", ring: "oklch(0.65 0.15 300)", sidebarPrimary: "oklch(0.65 0.15 300)" },
  pink: { primary: "oklch(0.65 0.18 350)", ring: "oklch(0.65 0.18 350)", sidebarPrimary: "oklch(0.65 0.18 350)" },
  emerald: { primary: "oklch(0.65 0.17 155)", ring: "oklch(0.65 0.17 155)", sidebarPrimary: "oklch(0.65 0.17 155)" },
  amber: { primary: "oklch(0.75 0.15 80)", ring: "oklch(0.75 0.15 80)", sidebarPrimary: "oklch(0.75 0.15 80)" },
  cyan: { primary: "oklch(0.7 0.12 195)", ring: "oklch(0.7 0.12 195)", sidebarPrimary: "oklch(0.7 0.12 195)" },
  red: { primary: "oklch(0.6 0.2 25)", ring: "oklch(0.6 0.2 25)", sidebarPrimary: "oklch(0.6 0.2 25)" },
  indigo: { primary: "oklch(0.6 0.15 270)", ring: "oklch(0.6 0.15 270)", sidebarPrimary: "oklch(0.6 0.15 270)" },
};

export function applyAccentColor(color: string) {
  const accent = ACCENT_COLORS[color];
  if (!accent || typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--ring", accent.ring);
  root.style.setProperty("--sidebar-primary", accent.sidebarPrimary);
  root.style.setProperty("--sidebar-ring", accent.ring);
  root.style.setProperty("--chart-1", accent.primary);
}

const DEFAULT_INCOME = ["Salário", "Freelance", "Investimentos"];
const DEFAULT_EXPENSE = ["Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Assinaturas"];
export const DEFAULT_CATEGORIES = [
  ...DEFAULT_INCOME.map((name) => ({ name, type: "income" as TransactionType })),
  ...DEFAULT_EXPENSE.map((name) => ({ name, type: "expense" as TransactionType })),
];
