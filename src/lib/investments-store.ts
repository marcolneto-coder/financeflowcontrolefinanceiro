export type InvestmentType = "cdi" | "previdencia" | "fii" | "etf" | "acao" | "cripto" | "outro";

export interface Investment {
  id: string;
  type: InvestmentType;
  ticker?: string;
  name: string;
  institution?: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  currentValue?: number;
  cdiPercent?: number;
  initialAmount?: number;
  initialDate?: string;
  notes?: string;
  lastUpdate?: string;
}

export const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  cdi: "Renda Fixa (CDI)",
  previdencia: "Previdência",
  fii: "FII",
  etf: "ETF",
  acao: "Ação",
  cripto: "Cripto",
  outro: "Outro",
};

export const INVESTMENT_TYPE_COLOR: Record<InvestmentType, string> = {
  cdi: "#22c55e",
  previdencia: "#a855f7",
  fii: "#3b82f6",
  etf: "#f59e0b",
  acao: "#ef4444",
  cripto: "#eab308",
  outro: "#94a3b8",
};

export function computeCurrentValue(inv: Investment): number {
  if (inv.currentValue != null && inv.currentValue > 0) return Number(inv.currentValue);
  if (inv.currentPrice != null && inv.quantity) return Number(inv.currentPrice) * Number(inv.quantity);
  if (inv.avgPrice && inv.quantity) return Number(inv.avgPrice) * Number(inv.quantity);
  if (inv.initialAmount) return Number(inv.initialAmount);
  return 0;
}

export function computeCost(inv: Investment): number {
  if (inv.avgPrice && inv.quantity) return Number(inv.avgPrice) * Number(inv.quantity);
  if (inv.initialAmount) return Number(inv.initialAmount);
  return 0;
}
