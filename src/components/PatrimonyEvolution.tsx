import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/finance-store";
import { TrendingUp, TrendingDown, LineChart as LineIcon } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type SnapshotRow = { snapshot_date: string; total_value: number | string };

type MonthPoint = {
  key: string;
  label: string;
  total: number;
  delta: number;
  deltaPct: number;
};

function toMonthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS_SHORT[Number(m) - 1]}/${y.slice(2)}`;
}

export function PatrimonyEvolution({ total, userId }: { total: number; userId?: string }) {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) return;
      setLoading(true);
      // Registra/atualiza o snapshot de hoje com o patrimônio atual
      if (total > 0) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase
          .from("investment_snapshots")
          .upsert(
            { user_id: userId, snapshot_date: today, total_value: total },
            { onConflict: "user_id,snapshot_date" },
          );
      }
      const { data } = await supabase
        .from("investment_snapshots")
        .select("snapshot_date,total_value")
        .order("snapshot_date");
      if (!cancelled) {
        setRows((data as SnapshotRow[] | null) || []);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [userId, total]);

  const points = useMemo<MonthPoint[]>(() => {
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      // último snapshot do mês vence (ordenado por data)
      byMonth.set(toMonthKey(r.snapshot_date), Number(r.total_value) || 0);
    }
    const keys = Array.from(byMonth.keys()).sort();
    let prev: number | null = null;
    return keys.map((k) => {
      const value = byMonth.get(k)!;
      const delta = prev == null ? 0 : value - prev;
      const deltaPct = prev && prev > 0 ? (delta / prev) * 100 : 0;
      prev = value;
      return { key: k, label: monthLabel(k), total: value, delta, deltaPct };
    });
  }, [rows]);

  const last = points[points.length - 1];
  const first = points[0];
  const periodDelta = last && first ? last.total - first.total : 0;
  const periodPct = first && first.total > 0 ? (periodDelta / first.total) * 100 : 0;

  return (
    <div className="glass-card p-5 mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <LineIcon className="size-4 text-muted-foreground" /> Evolução do patrimônio
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Comparativo mês a mês em valor e percentual.
          </p>
        </div>
        {points.length > 1 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">No período</p>
            <p className={`font-display text-lg font-semibold tabular-nums ${periodDelta >= 0 ? "text-income" : "text-expense"}`}>
              {periodDelta >= 0 ? "+" : ""}{formatCurrency(periodDelta)} · {periodPct >= 0 ? "+" : ""}{periodPct.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Carregando histórico…</p>
      ) : points.length < 2 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          O histórico começa agora: registramos o patrimônio de hoje. A partir do próximo mês você verá a comparação
          de ganhos e perdas aqui.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={points} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="left" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={11}
                tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                formatter={((value: unknown, name: unknown) =>
                  name === "Variação %" ? `${Number(value).toFixed(2)}%` : formatCurrency(Number(value))) as never}
              />
              <Bar yAxisId="left" dataKey="total" name="Patrimônio" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="deltaPct" name="Variação %" stroke="var(--gold)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-3">Mês</th>
                  <th className="text-right font-medium py-2 px-3">Patrimônio</th>
                  <th className="text-right font-medium py-2 px-3">Variação (R$)</th>
                  <th className="text-right font-medium py-2 pl-3">Variação (%)</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p, i, arr) => {
                  const isFirstEver = i === arr.length - 1;
                  return (
                    <tr key={p.key} className="border-t border-border/40">
                      <td className="py-2 pr-3">{p.label}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatCurrency(p.total)}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${isFirstEver ? "text-muted-foreground" : p.delta >= 0 ? "text-income" : "text-expense"}`}>
                        {isFirstEver ? "—" : `${p.delta >= 0 ? "+" : ""}${formatCurrency(p.delta)}`}
                      </td>
                      <td className={`py-2 pl-3 text-right tabular-nums ${isFirstEver ? "text-muted-foreground" : p.deltaPct >= 0 ? "text-income" : "text-expense"}`}>
                        {isFirstEver ? "—" : (
                          <span className="inline-flex items-center gap-1 justify-end">
                            {p.deltaPct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {p.deltaPct >= 0 ? "+" : ""}{p.deltaPct.toFixed(2)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
