import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(3).max(20000),
  defaultInstitution: z.string().max(80).optional(),
});

export type ParsedInvestment = {
  type: "cdi" | "previdencia" | "fii" | "etf" | "acao" | "cripto" | "outro";
  name: string;
  ticker?: string;
  institution?: string;
  quantity?: number;
  avgPrice?: number;
  currentValue?: number;
  cdiPercent?: number;
  initialAmount?: number;
};

export type ParseInvestmentsResult = {
  items: ParsedInvestment[];
  raw?: string;
};

export const parseInvestmentsText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ParseInvestmentsResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const system = `Você é um extrator de posições de investimentos em português a partir de extratos de bancos/corretoras (Banco Inter, Mercado Pago, XP, B3, Investidor10, etc.).
Responda APENAS um JSON válido, sem markdown, no formato:
{
  "items": [
    {
      "type": "cdi" | "previdencia" | "fii" | "etf" | "acao" | "cripto" | "outro",
      "name": "nome curto e legível (ex.: 'Porquinho CDI', 'MXRF11', 'Tesouro Selic 2029')",
      "ticker": "ticker B3 se aplicável (ex.: MXRF11, BOVA11, PETR4), sem sufixo .SA",
      "institution": "instituição financeira (ex.: 'Banco Inter', 'Mercado Pago', 'XP')",
      "quantity": number (cotas/unidades quando fizer sentido),
      "avgPrice": number (preço médio unitário, se houver),
      "currentValue": number (valor atual da posição em R$),
      "cdiPercent": number (para renda fixa vinculada ao CDI, ex.: 100, 120),
      "initialAmount": number (valor aportado inicial em renda fixa, quando o preço médio não faz sentido)
    }
  ]
}
Regras:
- Classifique como "cdi" caixas/porquinhos/cofrinhos, CDBs, LCIs, LCAs, tesouro pós-fixado.
- "previdencia" para PGBL/VGBL.
- "fii" para tickers terminados em 11 de fundo imobiliário; "etf" para ETFs (IVVB11, BOVA11...); "acao" para ações comuns/preferenciais (PETR4, VALE3...).
- "cripto" para BTC, ETH, etc.
- Valores brasileiros usam vírgula decimal (R$ 1.234,56 = 1234.56).
- Omita chaves cujo valor não seja identificável (não use null).
- Se a instituição não estiver clara na linha, use ${data.defaultInstitution ? `"${data.defaultInstitution}"` : "omita"}.
- Ignore linhas de resumo/totais, rentabilidade, cabeçalhos e rodapés.
- Se nada for identificável, retorne { "items": [] }.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: data.text },
      ],
      response_format: { type: "json_object" },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "raw-fetch",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error("Muitas requisições à IA. Tente novamente em instantes.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha ao chamar IA [${resp.status}]: ${errText.slice(0, 200)}`);
    }

    const json = await resp.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: { items?: unknown[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { throw new Error("Não foi possível interpretar a resposta da IA."); }
      } else throw new Error("Não foi possível interpretar a resposta da IA.");
    }

    const validTypes = new Set(["cdi", "previdencia", "fii", "etf", "acao", "cripto", "outro"]);
    const items: ParsedInvestment[] = [];
    for (const it of Array.isArray(parsed.items) ? parsed.items : []) {
      const o = it as Record<string, unknown>;
      const type = typeof o.type === "string" && validTypes.has(o.type) ? (o.type as ParsedInvestment["type"]) : "outro";
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
      if (!name) continue;
      const entry: ParsedInvestment = { type, name };
      if (typeof o.ticker === "string" && o.ticker.trim()) entry.ticker = o.ticker.trim().toUpperCase().replace(/\.SA$/i, "");
      if (typeof o.institution === "string" && o.institution.trim()) entry.institution = o.institution.trim();
      else if (data.defaultInstitution) entry.institution = data.defaultInstitution;
      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };
      const q = num(o.quantity); if (q !== undefined) entry.quantity = q;
      const ap = num(o.avgPrice); if (ap !== undefined) entry.avgPrice = ap;
      const cv = num(o.currentValue); if (cv !== undefined) entry.currentValue = cv;
      const cdi = num(o.cdiPercent); if (cdi !== undefined) entry.cdiPercent = cdi;
      const ia = num(o.initialAmount); if (ia !== undefined) entry.initialAmount = ia;
      items.push(entry);
    }

    return { items, raw };
  });
