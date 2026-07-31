// Pure types & helpers (no localStorage). Persistence happens in finance-context via Supabase.

export type TransactionType = "income" | "expense";
export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
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

export type PaymentMethod = "debit" | "pix" | "cash" | "transfer";

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
  paymentMethod?: PaymentMethod;
  createdAt?: string;
  tagIds?: string[];
}

// Compute the closing/due dates of the billing cycle that contains `date`.
// Returns { cycleStart, cycleEnd, closingDate, dueDate, invoiceMonth }.
// invoiceMonth = the month the invoice is due (YYYY-MM).
export function getBillingCycleFor(
  date: Date,
  closingDay: number,
  dueDay: number,
): { cycleStart: Date; cycleEnd: Date; closingDate: Date; dueDate: Date; invoiceMonth: string } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDate();
  // If purchase is on/before closingDay, invoice closes this month; else next month.
  const closesThisMonth = day <= closingDay;
  const closingYear = closesThisMonth ? d.getFullYear() : d.getFullYear() + (d.getMonth() === 11 ? 1 : 0);
  const closingMonth = closesThisMonth ? d.getMonth() : (d.getMonth() + 1) % 12;
  const closingDate = new Date(closingYear, closingMonth, closingDay);
  const cycleEnd = closingDate;
  const cycleStart = new Date(closingDate);
  cycleStart.setMonth(cycleStart.getMonth() - 1);
  cycleStart.setDate(closingDay + 1);
  // Due date is normally the next dueDay after closing. If dueDay <= closingDay,
  // due date falls in the following month.
  const dueYear = dueDay > closingDay ? closingYear : closingYear + (closingMonth === 11 ? 1 : 0);
  const dueMonth = dueDay > closingDay ? closingMonth : (closingMonth + 1) % 12;
  const dueDate = new Date(dueYear, dueMonth, dueDay);
  const invoiceMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
  return { cycleStart, cycleEnd, closingDate, dueDate, invoiceMonth };
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

const accentFrom = (value: string) => ({ primary: value, ring: value, sidebarPrimary: value });

export const ACCENT_COLORS: Record<string, { primary: string; ring: string; sidebarPrimary: string }> = {
  blue: accentFrom("oklch(0.7 0.12 220)"),
  sky: accentFrom("oklch(0.74 0.13 235)"),
  cyan: accentFrom("oklch(0.7 0.12 195)"),
  teal: accentFrom("oklch(0.68 0.12 180)"),
  emerald: accentFrom("oklch(0.65 0.17 155)"),
  green: accentFrom("oklch(0.7 0.18 145)"),
  lime: accentFrom("oklch(0.78 0.18 125)"),
  amber: accentFrom("oklch(0.75 0.15 80)"),
  gold: accentFrom("oklch(0.78 0.13 90)"),
  orange: accentFrom("oklch(0.7 0.18 55)"),
  red: accentFrom("oklch(0.6 0.2 25)"),
  rose: accentFrom("oklch(0.65 0.19 15)"),
  pink: accentFrom("oklch(0.65 0.18 350)"),
  fuchsia: accentFrom("oklch(0.66 0.2 325)"),
  violet: accentFrom("oklch(0.65 0.15 300)"),
  purple: accentFrom("oklch(0.6 0.18 305)"),
  indigo: accentFrom("oklch(0.6 0.15 270)"),
  slate: accentFrom("oklch(0.65 0.03 250)"),
  bronze: accentFrom("oklch(0.62 0.09 55)"),
  mint: accentFrom("oklch(0.8 0.11 165)"),
};

/** Accepts a preset key (e.g. "blue") or a custom hex value (e.g. "#ff8800"). */
export function applyAccentColor(color: string) {
  if (typeof document === "undefined") return;
  const accent = color?.startsWith("#") ? accentFrom(color) : ACCENT_COLORS[color];
  if (!accent) return;
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
