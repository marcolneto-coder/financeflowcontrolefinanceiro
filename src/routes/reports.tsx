import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { getMonthSummary, formatCurrency, getCurrentMonth } from "@/lib/finance-store";
import { useState, useMemo, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { CardBrandIcon } from "@/components/CardBrandIcon";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, EyeOff, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Relatórios — Finance Flow" },
      { name: "description", content: "Relatórios detalhados das suas finanças" },
    ],
  }),
});

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6366f1"];

function ReportsPage() {
  const { state } = useFinance();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<"overview" | "cards">("overview");
  const [hidePast, setHidePast] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [catView, setCatView] = useState<"yearly" | "monthly">("yearly");
  const [catMonth, setCatMonth] = useState<number>(now.getMonth());


  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const s = getMonthSummary(state.transactions, year, i);
      return { month: MONTHS_SHORT[i], receitas: s.income, despesas: s.expenses, saldo: s.balance };
    });
  }, [state.transactions, year]);

  const yearTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({ income: acc.income + m.receitas, expenses: acc.expenses + m.despesas }),
      { income: 0, expenses: 0 }
    );
  }, [monthlyData]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    state.transactions
      .filter((t) => {
        const d = new Date(t.date + "T12:00:00");
        if (d.getFullYear() !== year || t.type !== "expense") return false;
        if (catView === "monthly" && d.getMonth() !== catMonth) return false;
        return true;
      })
      .forEach((t) => {
        const cat = state.categories.find((c) => c.id === t.categoryId);
        const name = cat?.name || "Outros";
        map[name] = (map[name] || 0) + t.amount;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [state.transactions, state.categories, year, catView, catMonth]);

  // Projection: from January of current year through 12 months ahead of current month.
  // When past months are hidden, extend the tail so 12 future months always remain visible.
  const current = getCurrentMonth();
  const hiddenPastCount = useMemo(() => {
    if (hidePast) return current.month; // Jan..current.month-1
    let n = 0;
    for (let m = 0; m < current.month; m++) {
      if (hiddenCols.has(`${current.year}-${m}`)) n++;
    }
    return n;
  }, [hidePast, hiddenCols, current.month, current.year]);

  const cardProjection = useMemo(() => {
    const months: { year: number; month: number; label: string; key: string; isPast: boolean }[] = [];
    const startY = current.year;
    const startM = 0;
    const totalEnd = current.month + 11 + hiddenPastCount;
    for (let off = 0; off <= totalEnd; off++) {
      let m = startM + off;
      let y = startY;
      while (m > 11) { m -= 12; y++; }
      const isPast = y < current.year || (y === current.year && m < current.month);
      months.push({
        year: y, month: m,
        label: `${MONTHS_FULL[m]}/${y}`,
        key: `${y}-${m}`,
        isPast,
      });
    }

    const cardBlocks = state.creditCards.map((card) => {
      const monthly = months.map(({ year: y, month: m }) => {
        const txs = state.transactions
          .filter((t) => {
            if (t.creditCardId !== card.id || t.type !== "expense") return false;
            const d = new Date(t.date + "T12:00:00");
            return d.getFullYear() === y && d.getMonth() === m;
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        const total = txs.reduce((s, t) => s + t.amount, 0);
        return { txs, total };
      });
      const cardTotal = monthly.reduce((s, m) => s + m.total, 0);
      return { card, monthly, cardTotal };
    });

    const grandTotal = cardBlocks.reduce((s, b) => s + b.cardTotal, 0);
    return { months, cardBlocks, grandTotal };
  }, [state.transactions, state.creditCards, current.month, current.year, hiddenPastCount]);

  // Indices of months currently visible (after hidePast and manual hide)
  const visibleIdx = useMemo(() => {
    return cardProjection.months
      .map((mo, i) => ({ mo, i }))
      .filter(({ mo }) => {
        if (hiddenCols.has(mo.key)) return false;
        if (hidePast && mo.isPast) return false;
        return true;
      })
      .map(({ i }) => i);
  }, [cardProjection.months, hiddenCols, hidePast]);

  const goToTransaction = (y: number, m: number, txId?: string) => {
    navigate({ to: "/transactions", search: { year: y, month: m, highlight: txId } });
  };



  const buildExportRows = () => {
    const visibleMonths = visibleIdx.map((i) => cardProjection.months[i]);
    const monthsLen = cardProjection.months.length;
    const header = ["Cartão", "Descrição", ...visibleMonths.map((mo) => `${MONTHS_SHORT[mo.month]}/${String(mo.year).slice(2)}`)];
    const rows: (string | number)[][] = [header];
    cardProjection.cardBlocks.forEach(({ card, monthly }) => {
      const rowMap = new Map<string, { description: string; store?: string; isInstallment: boolean; totalInstallments: number; perMonth: (number | null)[] }>();
      monthly.forEach((m, mi) => {
        m.txs.forEach((tx) => {
          const key = tx.installmentGroupId
            ? `inst:${tx.installmentGroupId}`
            : `single:${tx.description}|${tx.store || ""}|${tx.amount}`;
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              description: tx.description, store: tx.store,
              isInstallment: tx.isInstallment, totalInstallments: tx.totalInstallments,
              perMonth: Array(monthsLen).fill(null),
            });
          }
          const r = rowMap.get(key)!;
          r.perMonth[mi] = (r.perMonth[mi] || 0) + tx.amount;
        });
      });
      const allRows = Array.from(rowMap.values()).filter((r) =>
        visibleIdx.some((i) => r.perMonth[i] != null)
      );
      allRows.forEach((r, ri) => {
        rows.push([
          ri === 0 ? card.name : "",
          r.description + (r.store ? ` / ${r.store}` : "") + (r.isInstallment && r.totalInstallments > 1 ? ` (${r.totalInstallments}x)` : ""),
          ...visibleIdx.map((i) => (r.perMonth[i] != null ? Number(r.perMonth[i]!.toFixed(2)) : "")),
        ]);
      });
      rows.push([
        `Subtotal — ${card.name}`, "",
        ...visibleIdx.map((i) => (monthly[i].total > 0 ? Number(monthly[i].total.toFixed(2)) : "")),
      ]);
    });
    rows.push([
      "TOTAL GERAL", "",
      ...visibleIdx.map((i) => {
        const total = cardProjection.cardBlocks.reduce((s, b) => s + b.monthly[i].total, 0);
        return total > 0 ? Number(total.toFixed(2)) : "";
      }),
    ]);
    return rows;
  };


  const exportExcel = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projeção Cartões");
    XLSX.writeFile(wb, `projecao-cartoes-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = () => {
    const rows = buildExportRows();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Projeção 12 Meses — Cartões", 40, 30);
    autoTable(doc, {
      head: [rows[0] as string[]],
      body: rows.slice(1).map((r) =>
        r.map((c) => (typeof c === "number" ? formatCurrency(c) : String(c)))
      ),
      startY: 50,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 80] },
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    doc.save(`projecao-cartoes-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl pt-16 md:pt-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Análise</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Relatórios</h1>
        </div>
        {tab === "overview" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setYear((y) => y - 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">←</button>
            <span className="text-sm font-medium min-w-[60px] text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent transition-colors">→</button>
          </div>
        )}
      </header>

      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit flex-wrap">
        {(["overview", "cards"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>
            {t === "overview" ? "Visão Geral" : "Projeção Cartões"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Total Receitas</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-income">{formatCurrency(yearTotals.income)}</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Total Despesas</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-expense">{formatCurrency(yearTotals.expenses)}</p>
            </div>
            <div className="glass-card p-4 md:p-6">
              <p className="text-xs md:text-sm text-muted-foreground mb-2">Saldo Anual</p>
              <p className="text-xl md:text-2xl font-semibold tabular-nums text-primary">{formatCurrency(yearTotals.income - yearTotals.expenses)}</p>
            </div>
          </div>

          <div className="glass-card p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-medium mb-6">Receitas vs Despesas por Mês</h2>
            {state.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Adicione transações para ver o gráfico.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barCategoryGap="20%">
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="receitas" fill="var(--income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-base md:text-lg font-medium">Despesas por Categoria</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  {(["yearly", "monthly"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCatView(v)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        catView === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {v === "yearly" ? "Anual" : "Mensal"}
                    </button>
                  ))}
                </div>
                {catView === "monthly" && (
                  <select
                    value={catMonth}
                    onChange={(e) => setCatMonth(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-background"
                  >
                    {MONTHS_FULL.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sem despesas {catView === "monthly" ? `em ${MONTHS_FULL[catMonth]}/${year}` : "neste ano"}.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm flex-1">{cat.name}</span>
                      <span className="text-sm tabular-nums font-medium">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "cards" && (
        <div className="space-y-4">
          <div className="glass-card p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-medium">Projeção — Cartões</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {cardProjection.months[0] && (
                    <>De {MONTHS_FULL[cardProjection.months[0].month]}/{cardProjection.months[0].year} até {MONTHS_FULL[cardProjection.months[cardProjection.months.length - 1].month]}/{cardProjection.months[cardProjection.months.length - 1].year}</>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total geral</p>
                  <p className="text-xl font-semibold tabular-nums text-expense">{formatCurrency(cardProjection.grandTotal)}</p>
                </div>
                {state.creditCards.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHidePast((v) => !v)}
                      title={hidePast ? "Mostrar meses passados" : "Ocultar meses passados"}
                    >
                      {hidePast ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      {hidePast ? "Mostrar passados" : "Ocultar passados"}
                    </Button>
                    {hiddenCols.size > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setHiddenCols(new Set())}>
                        Restaurar colunas ({hiddenCols.size})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={exportExcel}>
                      <FileSpreadsheet className="size-4" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPdf}>
                      <FileDown className="size-4" /> PDF
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {state.creditCards.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Nenhum cartão cadastrado.
            </div>
          ) : (
            <div className="glass-card p-2 md:p-4 overflow-auto max-h-[calc(100vh-16rem)]">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-semibold sticky top-0 left-0 z-40 min-w-[120px] w-[120px] bg-primary text-primary-foreground">Cartão</th>
                    <th className="text-left p-2 font-semibold sticky top-0 lg:left-[120px] z-30 min-w-[200px] w-[200px] bg-primary text-primary-foreground">Descrição</th>
                    {visibleIdx.map((i) => {
                      const mo = cardProjection.months[i];
                      return (
                        <th
                          key={mo.key}
                          className="text-right p-2 font-semibold whitespace-nowrap text-primary-foreground sticky top-0 z-20 bg-primary"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>{MONTHS_SHORT[mo.month].toLowerCase()}/{String(mo.year).slice(2)}</span>
                            <button
                              type="button"
                              title="Ocultar coluna"
                              onClick={() =>
                                setHiddenCols((prev) => {
                                  const n = new Set(prev);
                                  n.add(mo.key);
                                  return n;
                                })
                              }
                              className="opacity-50 hover:opacity-100 transition-opacity"
                            >
                              <EyeOff className="size-3" />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {cardProjection.cardBlocks.map(({ card, monthly }) => {
                    type Row = {
                      key: string;
                      description: string;
                      store?: string;
                      isInstallment: boolean;
                      totalInstallments: number;
                      perMonth: ({ amount: number; txIds: string[] } | null)[];
                    };
                    const rowMap = new Map<string, Row>();
                    monthly.forEach((m, mi) => {
                      m.txs.forEach((tx) => {
                        const key = tx.installmentGroupId
                          ? `inst:${tx.installmentGroupId}`
                          : `single:${tx.description}|${tx.store || ""}|${tx.amount}`;
                        if (!rowMap.has(key)) {
                          rowMap.set(key, {
                            key,
                            description: tx.description,
                            store: tx.store,
                            isInstallment: tx.isInstallment,
                            totalInstallments: tx.totalInstallments,
                            perMonth: Array(cardProjection.months.length).fill(null),
                          });
                        }
                        const row = rowMap.get(key)!;
                        const cell = row.perMonth[mi] || { amount: 0, txIds: [] };
                        cell.amount += tx.amount;
                        cell.txIds.push(tx.id);
                        row.perMonth[mi] = cell;
                      });
                    });
                    // hide rows whose visible cells are all empty
                    const rows = Array.from(rowMap.values()).filter((r) =>
                      visibleIdx.some((i) => r.perMonth[i] != null)
                    );

                    return (
                      <Fragment key={card.id}>
                        {rows.length === 0 ? (
                          <tr key={`${card.id}-empty`} className="border-b border-border/50">
                            <td className="p-2 align-middle sticky left-0 z-30 w-[120px] bg-primary text-primary-foreground">
                              <div className="flex items-center gap-2">
                                <CardBrandIcon brand={card.brand} className="w-7 h-4" />
                                <span className="truncate">{card.name}</span>
                              </div>
                            </td>
                            <td className="p-2 lg:sticky lg:left-[120px] lg:z-20 w-[200px] bg-primary text-primary-foreground lg:bg-primary italic">Sem lançamentos</td>
                            {visibleIdx.map((i) => (
                              <td key={i} className="p-2 bg-primary/5" />
                            ))}
                          </tr>
                        ) : (
                          rows.map((row, ri) => (
                            <tr key={`${card.id}-${row.key}`} className="border-b border-border/30 hover:bg-accent/40">
                              <td className="p-2 align-middle sticky left-0 z-30 w-[120px] bg-primary text-primary-foreground">
                                {ri === 0 && (
                                  <div className="flex items-center gap-2">
                                    <CardBrandIcon brand={card.brand} className="w-7 h-4" />
                                    <span className="truncate font-medium">{card.name}</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-2 align-middle lg:sticky lg:left-[120px] lg:z-20 w-[200px] bg-card text-foreground lg:bg-primary lg:text-primary-foreground">
                                <span className="truncate">
                                  {row.description}
                                  {row.store ? ` / ${row.store}` : ""}
                                  {row.isInstallment && row.totalInstallments > 1 && (
                                    <span className="text-muted-foreground lg:text-primary-foreground/70 ml-1">({row.totalInstallments}x)</span>
                                  )}
                                </span>
                              </td>
                              {visibleIdx.map((i) => {
                                const cell = row.perMonth[i];
                                const mo = cardProjection.months[i];
                                return (
                                  <td
                                    key={i}
                                    className={`text-right p-0 tabular-nums whitespace-nowrap text-foreground ${mo.isPast ? "bg-primary/5" : "bg-primary/10"}`}
                                  >
                                    {cell ? (
                                      <button
                                        type="button"
                                        onClick={() => goToTransaction(mo.year, mo.month, cell.txIds[0])}
                                        className="w-full h-full p-2 text-right hover:bg-primary/20 transition-colors cursor-pointer"
                                        title="Ver transação"
                                      >
                                        {formatCurrency(cell.amount)}
                                      </button>
                                    ) : (
                                      <span className="block p-2 text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                        <tr key={`${card.id}-subtotal`} className="border-b-2 border-border font-semibold">
                          <td className="p-2 sticky left-0 z-30 w-[120px] text-right uppercase text-[10px] tracking-wider bg-primary text-primary-foreground">Subtotal</td>
                          <td className="p-2 lg:sticky lg:left-[120px] lg:z-20 w-[200px] bg-primary text-primary-foreground">{card.name}</td>
                          {visibleIdx.map((i) => {
                            const m = monthly[i];
                            return (
                              <td key={i} className="text-right p-2 tabular-nums whitespace-nowrap text-expense bg-primary/15">
                                {m.total > 0 ? formatCurrency(m.total) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}
                  <tr className="font-bold border-t-2 border-primary">
                    <td className="p-2 sticky left-0 z-10 w-[120px] uppercase text-[11px] tracking-wider bg-primary/50 text-foreground">
                      Total
                    </td>
                    <td className="p-2 lg:sticky lg:left-[120px] z-10 w-[200px] uppercase text-[11px] tracking-wider bg-primary/40 text-foreground">
                      Todos os cartões
                    </td>
                    {visibleIdx.map((i) => {
                      const total = cardProjection.cardBlocks.reduce((s, b) => s + b.monthly[i].total, 0);
                      return (
                        <td key={i} className="text-right p-2 tabular-nums whitespace-nowrap text-expense bg-primary/25">
                          {total > 0 ? formatCurrency(total) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
