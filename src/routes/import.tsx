import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useFinance } from "@/lib/finance-context";
import { type TransactionType, formatCurrency } from "@/lib/finance-store";
import { Button } from "@/components/ui/button";
import { FileUp, Upload, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/import")({
  component: ImportPage,
  head: () => ({
    meta: [
      { title: "Importar Extrato — Finance Flow" },
      { name: "description", content: "Importe transações a partir de CSV ou OFX" },
    ],
  }),
});

type ParsedRow = {
  raw: string[];
  date?: string;
  description?: string;
  amount?: number;
  type?: TransactionType;
  selected: boolean;
};

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  for (const c of firstLine) if (c in counts) counts[c as keyof typeof counts]++;
  const best = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  for (const line of lines) {
    // simple CSV: split by delim; supports "" quotes for embedded delim
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    rows.push(out.map((c) => c.trim()));
  }
  return rows;
}

function parseAmount(v: string): number {
  if (!v) return 0;
  // Handle "R$ 1.234,56" or "1234.56" or "-1,50"
  let s = v.replace(/[R$\s]/g, "");
  const neg = s.startsWith("-") || /\(.+\)/.test(s);
  s = s.replace(/[()\-]/g, "");
  // If both . and , present, assume . is thousands, , is decimal
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}

function parseDate(v: string): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  // ISO YYYY-MM-DD
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const br = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (br) {
    const y = br[3].length === 2 ? "20" + br[3] : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return undefined;
}

function parseOFX(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const block = m[1];
    const get = (tag: string) => {
      const rr = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i").exec(block);
      return rr ? rr[1].trim() : "";
    };
    const dtRaw = get("DTPOSTED");
    // YYYYMMDD[HHMMSS[.mmm]][+/-tz]
    const d = dtRaw.match(/^(\d{4})(\d{2})(\d{2})/);
    const date = d ? `${d[1]}-${d[2]}-${d[3]}` : undefined;
    const amount = parseFloat(get("TRNAMT"));
    const memo = get("MEMO") || get("NAME") || "Sem descrição";
    rows.push({
      raw: [dtRaw, memo, get("TRNAMT")],
      date,
      description: memo,
      amount: Math.abs(amount),
      type: amount < 0 ? "expense" : "income",
      selected: true,
    });
  }
  return rows;
}

function ImportPage() {
  const { state, addTransactionsBulk } = useFinance();
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState("");
  const [format, setFormat] = useState<"csv" | "ofx">("csv");
  const [delim, setDelim] = useState(",");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapDate, setMapDate] = useState<number>(-1);
  const [mapDesc, setMapDesc] = useState<number>(-1);
  const [mapAmount, setMapAmount] = useState<number>(-1);
  const [mapType, setMapType] = useState<number>(-1); // optional
  const [defaultType, setDefaultType] = useState<TransactionType>("expense");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [defaultCardId, setDefaultCardId] = useState("");
  const [ofxRows, setOfxRows] = useState<ParsedRow[]>([]);
  const [status, setStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const handleFile = async (f: File) => {
    setFileName(f.name);
    const text = await f.text();
    setRawText(text);
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "ofx" || /<OFX>/i.test(text)) {
      setFormat("ofx");
      setOfxRows(parseOFX(text));
    } else {
      setFormat("csv");
      const d = detectDelimiter(text);
      setDelim(d);
      setCsvRows(parseCSV(text, d));
    }
    setStatus(null);
  };

  const reparseCSV = (newDelim: string) => {
    setDelim(newDelim);
    if (rawText) setCsvRows(parseCSV(rawText, newDelim));
  };

  const previewRows: ParsedRow[] = useMemo(() => {
    if (format === "ofx") return ofxRows;
    const data = hasHeader ? csvRows.slice(1) : csvRows;
    return data.map((r) => {
      const date = mapDate >= 0 ? parseDate(r[mapDate]) : undefined;
      const description = mapDesc >= 0 ? r[mapDesc] : undefined;
      const amount = mapAmount >= 0 ? parseAmount(r[mapAmount]) : undefined;
      let type: TransactionType = defaultType;
      if (mapType >= 0 && r[mapType]) {
        const v = r[mapType].toLowerCase();
        if (/(cred|entrada|receita|income|deposit)/.test(v)) type = "income";
        else if (/(deb|saida|despesa|expense|pagamento|withdraw)/.test(v)) type = "expense";
      } else if (amount !== undefined) {
        type = amount < 0 ? "expense" : defaultType;
      }
      return {
        raw: r,
        date,
        description,
        amount: amount !== undefined ? Math.abs(amount) : undefined,
        type,
        selected: !!(date && description && amount && amount > 0),
      };
    });
  }, [format, ofxRows, csvRows, hasHeader, mapDate, mapDesc, mapAmount, mapType, defaultType]);

  const [rowsState, setRowsState] = useState<Record<number, boolean>>({});
  const toggleRow = (i: number) => setRowsState((s) => ({ ...s, [i]: !(s[i] ?? previewRows[i]?.selected) }));

  const validCount = previewRows.filter((r, i) => (rowsState[i] ?? r.selected) && r.date && r.description && r.amount).length;

  const handleImport = async () => {
    const today = new Date().toISOString().split("T")[0];
    const rows = previewRows
      .filter((r, i) => (rowsState[i] ?? r.selected) && r.date && r.description && r.amount)
      .map((r) => ({
        description: r.description!,
        amount: r.amount!,
        type: r.type || defaultType,
        categoryId: defaultCategoryId,
        date: r.date || today,
        isFixed: false,
        isInstallment: false,
        totalInstallments: 1,
        creditCardId: defaultCardId || undefined,
      }));
    if (rows.length === 0) {
      setStatus({ type: "err", msg: "Nenhuma linha válida para importar." });
      return;
    }
    const n = await addTransactionsBulk(rows);
    setStatus({ type: "ok", msg: `${n} transações importadas com sucesso!` });
  };

  const columns = csvRows[0] || [];

  return (
    <div className="p-4 md:p-8 max-w-5xl pt-16 md:pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
          <FileUp className="size-4" /> Ferramentas
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Importar Extrato</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie um arquivo CSV ou OFX do seu banco. Mapeie as colunas e revise antes de importar.</p>
      </header>

      <div className="glass-card p-4 md:p-6 mb-6">
        <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="size-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">{fileName || "Clique para escolher um arquivo"}</p>
            <p className="text-xs text-muted-foreground mt-1">CSV, OFX</p>
          </div>
          <input type="file" accept=".csv,.ofx,.txt" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      </div>

      {csvRows.length > 0 && format === "csv" && (
        <div className="glass-card p-4 md:p-6 mb-6 space-y-4">
          <h2 className="text-sm font-medium">Mapeamento de colunas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Separador</label>
              <select value={delim} onChange={(e) => reparseCSV(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs">
                <option value=",">Vírgula ( , )</option>
                <option value=";">Ponto e vírgula ( ; )</option>
                <option value={"\t"}>Tab</option>
                <option value="|">Pipe ( | )</option>
              </select>
            </div>
            <label className="flex items-end gap-2 text-xs pb-1.5">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="size-3.5 accent-primary" />
              Primeira linha é cabeçalho
            </label>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Tipo padrão</label>
              <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as TransactionType)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs">
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Categoria padrão</label>
              <select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs">
                <option value="">Sem categoria</option>
                {state.categories.filter((c) => c.type === defaultType).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Coluna Data", value: mapDate, set: setMapDate, required: true },
              { label: "Coluna Descrição", value: mapDesc, set: setMapDesc, required: true },
              { label: "Coluna Valor", value: mapAmount, set: setMapAmount, required: true },
              { label: "Coluna Tipo (opcional)", value: mapType, set: setMapType, required: false },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] text-muted-foreground mb-1 block">
                  {f.label}{f.required && <span className="text-expense"> *</span>}
                </label>
                <select value={f.value} onChange={(e) => f.set(parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs">
                  <option value={-1}>—</option>
                  {columns.map((c, i) => (
                    <option key={i} value={i}>{hasHeader ? c : `Coluna ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Cartão (opcional — aplica em todas as linhas)</label>
            <select value={defaultCardId} onChange={(e) => setDefaultCardId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md bg-input border-0 text-xs">
              <option value="">Sem cartão</option>
              {state.creditCards.map((c) => (
                <option key={c.id} value={c.id}>{c.name} •••• {c.lastDigits}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="glass-card p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Prévia ({validCount} de {previewRows.length} válidas)</h2>
            <Button onClick={handleImport} disabled={validCount === 0}>
              Importar {validCount > 0 ? validCount : ""}
            </Button>
          </div>
          {status && (
            <div className={`flex items-center gap-2 p-3 mb-4 rounded-lg text-xs ${status.type === "ok" ? "bg-income/10 text-income" : "bg-expense/10 text-expense"}`}>
              {status.type === "ok" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
              {status.msg}
            </div>
          )}
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-2 w-8"></th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 200).map((r, i) => {
                  const selected = rowsState[i] ?? r.selected;
                  const valid = r.date && r.description && r.amount;
                  return (
                    <tr key={i} className={`border-b border-border/50 ${!valid ? "opacity-40" : ""}`}>
                      <td className="p-2">
                        <input type="checkbox" checked={selected} onChange={() => toggleRow(i)} disabled={!valid} className="size-3.5 accent-primary" />
                      </td>
                      <td className="p-2 tabular-nums">{r.date || "—"}</td>
                      <td className="p-2 truncate max-w-[300px]" title={r.description}>{r.description || "—"}</td>
                      <td className={`p-2 text-right tabular-nums ${r.type === "income" ? "text-income" : "text-expense"}`}>
                        {r.amount !== undefined ? formatCurrency(r.amount) : "—"}
                      </td>
                      <td className="p-2">{r.type === "income" ? "Receita" : "Despesa"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {previewRows.length > 200 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Mostrando 200 primeiras. Todas as {previewRows.length} serão importadas se marcadas.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
