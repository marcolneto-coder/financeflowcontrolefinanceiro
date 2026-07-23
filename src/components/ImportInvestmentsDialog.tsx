import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { parseInvestmentsText, type ParsedInvestment } from "@/lib/parse-investments.functions";
import { INVESTMENT_TYPE_LABEL, type InvestmentType } from "@/lib/investments-store";
import { toast } from "sonner";
import { Sparkles, X, Upload, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/finance-store";

type Row = { id: string; name: string; ticker: string | null; institution: string | null };

export function ImportInvestmentsDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const parseFn = useServerFn(parseInvestmentsText);
  const [text, setText] = useState("");
  const [defaultInstitution, setDefaultInstitution] = useState("");
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<ParsedInvestment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setText(String(e.target?.result || ""));
    reader.readAsText(f);
  };

  const handleParse = async () => {
    if (text.trim().length < 5) {
      toast.error("Cole o conteúdo do extrato ou selecione um arquivo.");
      return;
    }
    setParsing(true);
    try {
      const res = await parseFn({ data: { text: text.slice(0, 20000), defaultInstitution: defaultInstitution.trim() || undefined } });
      if (!res.items.length) {
        toast.error("Nenhum ativo identificado. Verifique o conteúdo.");
      } else {
        setItems(res.items);
        setSelected(new Set(res.items.map((_, i) => i)));
        toast.success(`${res.items.length} ativo(s) identificado(s). Revise e importe.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao interpretar extrato.");
    } finally {
      setParsing(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ParsedInvestment>) => {
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const toggle = (idx: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx); else n.add(idx);
      return n;
    });
  };

  const handleImport = async () => {
    if (!user) return;
    const toSave = items.filter((_, i) => selected.has(i));
    if (!toSave.length) return;
    setSaving(true);
    try {
      // Fetch existing to detect updates by (ticker+institution) or (name+institution)
      const { data: existingData } = await supabase.from("investments").select("id,name,ticker,institution");
      const existing = (existingData as Row[] | null) || [];
      const key = (n?: string | null, t?: string | null, i?: string | null) =>
        `${(t || "").toUpperCase()}|${(n || "").toLowerCase().trim()}|${(i || "").toLowerCase().trim()}`;
      const map = new Map(existing.map((e) => [key(e.name, e.ticker, e.institution), e.id]));

      let inserted = 0, updated = 0;
      const now = new Date().toISOString();
      for (const it of toSave) {
        const payload = {
          user_id: user.id,
          type: it.type,
          name: it.name,
          ticker: it.ticker || null,
          institution: it.institution || null,
          quantity: it.quantity ?? 0,
          avg_price: it.avgPrice ?? 0,
          current_value: it.currentValue ?? null,
          cdi_percent: it.cdiPercent ?? null,
          initial_amount: it.initialAmount ?? null,
          last_update: now,
        };
        const existingId = map.get(key(it.name, it.ticker, it.institution));
        if (existingId) {
          const { error } = await supabase.from("investments").update(payload).eq("id", existingId);
          if (!error) updated++;
        } else {
          const { error } = await supabase.from("investments").insert(payload);
          if (!error) inserted++;
        }
      }
      toast.success(`Importação concluída · ${inserted} novo(s) · ${updated} atualizado(s).`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Importar extrato de investimentos
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cole o texto do extrato (Inter, Mercado Pago, XP, B3, Investidor10…) ou selecione um arquivo CSV/TXT. A IA identifica automaticamente cada ativo.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Instituição padrão (opcional)</label>
                <input value={defaultInstitution} onChange={(e) => setDefaultInstitution(e.target.value)}
                  placeholder="Ex.: Banco Inter, Mercado Pago…"
                  className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Arquivo CSV/TXT</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-md bg-input text-sm cursor-pointer hover:bg-muted">
                  <Upload className="size-4" />
                  <span className="truncate">Selecionar…</span>
                  <input type="file" accept=".csv,.txt,.tsv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conteúdo do extrato</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12}
                placeholder="Cole aqui o texto do seu extrato de posições. Ex.:&#10;Porquinho — Rende 100% do CDI — R$ 5.230,45&#10;MXRF11 — 100 cotas — PM R$ 10,20 — Atual R$ 1.075,00&#10;Previdência Inter — R$ 12.400,00"
                className="w-full px-3 py-2 rounded-md bg-input border-0 text-sm font-mono" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Dica: para PDFs, abra o arquivo, selecione tudo (Ctrl+A) e cole aqui.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleParse} disabled={parsing || text.trim().length < 5}>
                <Sparkles className="size-4" />
                {parsing ? "Analisando…" : "Analisar com IA"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <FileText className="size-3.5" /> Revise, edite se necessário e importe. Itens já existentes (mesmo nome/ticker + instituição) serão atualizados.
              </p>
              <div className="flex gap-2 text-xs">
                <button className="underline" onClick={() => setSelected(new Set(items.map((_, i) => i)))}>Todos</button>
                <button className="underline" onClick={() => setSelected(new Set())}>Nenhum</button>
              </div>
            </div>

            <div className="border border-border rounded-lg divide-y divide-border max-h-[50vh] overflow-y-auto">
              {items.map((it, i) => {
                const isSel = selected.has(i);
                return (
                  <div key={i} className={`p-3 ${isSel ? "" : "opacity-50"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(i)} className="mt-1" />
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
                        <select value={it.type} onChange={(e) => updateItem(i, { type: e.target.value as InvestmentType })}
                          className="px-2 py-1.5 rounded bg-input text-xs">
                          {(Object.keys(INVESTMENT_TYPE_LABEL) as InvestmentType[]).map((t) => (
                            <option key={t} value={t}>{INVESTMENT_TYPE_LABEL[t]}</option>
                          ))}
                        </select>
                        <input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })}
                          className="px-2 py-1.5 rounded bg-input text-xs md:col-span-2" placeholder="Nome" />
                        <input value={it.ticker || ""} onChange={(e) => updateItem(i, { ticker: e.target.value.toUpperCase() })}
                          className="px-2 py-1.5 rounded bg-input text-xs font-mono" placeholder="Ticker" />
                        <input value={it.institution || ""} onChange={(e) => updateItem(i, { institution: e.target.value })}
                          className="px-2 py-1.5 rounded bg-input text-xs" placeholder="Instituição" />
                        <input type="number" step="0.01" value={it.currentValue ?? ""}
                          onChange={(e) => updateItem(i, { currentValue: e.target.value ? Number(e.target.value) : undefined })}
                          className="px-2 py-1.5 rounded bg-input text-xs tabular-nums text-right" placeholder="Valor R$" />
                      </div>
                    </div>
                    {(it.quantity || it.avgPrice || it.cdiPercent) && (
                      <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                        {it.quantity ? `Qtd: ${it.quantity} · ` : ""}
                        {it.avgPrice ? `PM: ${formatCurrency(it.avgPrice)} · ` : ""}
                        {it.cdiPercent ? `${it.cdiPercent}% CDI` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setItems([]); setSelected(new Set()); }}>← Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleImport} disabled={saving || selected.size === 0}>
                  {saving ? "Salvando…" : `Importar ${selected.size} item(ns)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
