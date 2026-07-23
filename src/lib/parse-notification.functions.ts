import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(3).max(4000),
  cards: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        lastDigits: z.string().optional().nullable(),
      }),
    )
    .optional()
    .default([]),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(["income", "expense"]),
      }),
    )
    .optional()
    .default([]),
});

export type ParseNotificationResult = {
  type: "income" | "expense";
  description: string;
  amount: number;
  store?: string;
  purchaseDate?: string; // YYYY-MM-DD
  isInstallment?: boolean;
  totalInstallments?: number;
  creditCardId?: string; // matched from list
  categoryId?: string; // matched from list
  confidence?: "low" | "medium" | "high";
  raw?: string;
};

export const parseNotificationText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ParseNotificationResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const today = new Date().toISOString().split("T")[0];

    const cardsHint = data.cards.length
      ? data.cards
          .map((c) => `- id="${c.id}" nome="${c.name}"${c.lastDigits ? ` final=${c.lastDigits}` : ""}`)
          .join("\n")
      : "(nenhum cartão cadastrado)";

    const catsHint = data.categories.length
      ? data.categories.map((c) => `- id="${c.id}" nome="${c.name}" tipo=${c.type}`).join("\n")
      : "(nenhuma categoria cadastrada)";

    const system = `Você é um extrator de dados de notificações bancárias e de cartões em português.
Extraia UM lançamento financeiro a partir do texto informado.
Responda APENAS um JSON válido, sem markdown, no formato:
{
  "type": "income" | "expense",
  "description": "curta e clara (ex.: 'Compra IFOOD', 'Salário')",
  "amount": number (positivo, em reais, sem símbolo),
  "store": "estabelecimento se houver, senão omitir",
  "purchaseDate": "YYYY-MM-DD (se não houver data explícita, use ${today})",
  "isInstallment": true/false,
  "totalInstallments": number (se parcelada, ex.: '3x', 'em 6 vezes'),
  "creditCardId": "id do cartão da lista que casa com o final/nome citado, se houver",
  "categoryId": "id da categoria mais provável da lista, se aplicável",
  "confidence": "low" | "medium" | "high"
}
Regras:
- Valores brasileiros usam vírgula decimal (ex.: R$ 1.234,56 = 1234.56).
- Se não identificar valor, retorne amount = 0 e confidence = "low".
- Cartões disponíveis (case pelo final numérico ou nome):
${cardsHint}
- Categorias disponíveis:
${catsHint}
- Omita chaves cujo valor não seja identificável (não use null).`;

    const body = {
      model: "google/gemini-3.6-flash",
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
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Tentar extrair bloco JSON caso venha com texto extra.
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          throw new Error("Não foi possível interpretar a resposta da IA.");
        }
      } else {
        throw new Error("Não foi possível interpretar a resposta da IA.");
      }
    }

    const type = parsed.type === "income" ? "income" : "expense";
    const amount = Number(parsed.amount);

    const result: ParseNotificationResult = {
      type,
      description: String(parsed.description || "").slice(0, 120) || "Lançamento",
      amount: Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0,
      raw,
    };
    if (typeof parsed.store === "string" && parsed.store.trim()) result.store = parsed.store.trim();
    if (typeof parsed.purchaseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchaseDate))
      result.purchaseDate = parsed.purchaseDate;
    if (parsed.isInstallment === true) result.isInstallment = true;
    const inst = Number(parsed.totalInstallments);
    if (Number.isFinite(inst) && inst >= 2) result.totalInstallments = Math.floor(inst);

    if (typeof parsed.creditCardId === "string") {
      const found = data.cards.find((c) => c.id === parsed.creditCardId);
      if (found) result.creditCardId = found.id;
    }
    if (typeof parsed.categoryId === "string") {
      const foundCat = data.categories.find((c) => c.id === parsed.categoryId && c.type === type);
      if (foundCat) result.categoryId = foundCat.id;
    }
    if (parsed.confidence === "low" || parsed.confidence === "medium" || parsed.confidence === "high") {
      result.confidence = parsed.confidence;
    }

    return result;
  });
