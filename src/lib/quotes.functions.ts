import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  tickers: z.array(z.string().min(1).max(15)).min(1).max(30),
});

export type QuoteResult = {
  ticker: string;
  price: number | null;
  changePercent?: number | null;
  currency?: string;
  error?: string;
};

export const fetchQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<QuoteResult[]> => {
    const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase().replace(/\.SA$/, "");
    const tickers = Array.from(new Set(data.tickers.map(normalizeTicker))).filter(Boolean);
    if (!tickers.length) return [];

    const token = process.env.BRAPI_TOKEN;
    const url = new URL(`https://brapi.dev/api/quote/${tickers.join(",")}`);
    if (token) url.searchParams.set("token", token);

    try {
      const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        const msg = resp.status === 401 || resp.status === 402
          ? "Token Brapi inválido ou plano expirado."
          : `Brapi retornou ${resp.status}. ${text.slice(0, 120)}`;
        return tickers.map((t) => ({ ticker: t, price: null, error: msg }));
      }
      const json = (await resp.json()) as {
        results?: Array<{
          symbol: string;
          regularMarketPrice?: number | null;
          regularMarketChangePercent?: number | null;
          currency?: string;
          error?: boolean;
          message?: string;
        }>;
      };
      const map = new Map<string, QuoteResult>();
      for (const r of json.results || []) {
        const symbol = normalizeTicker(r.symbol);
        map.set(symbol, {
          ticker: symbol,
          price: r.error ? null : (r.regularMarketPrice ?? null),
          changePercent: r.regularMarketChangePercent ?? null,
          currency: r.currency,
          error: r.error ? (r.message || "Ticker não encontrado") : undefined,
        });
      }
      return tickers.map((t) => map.get(normalizeTicker(t)) || { ticker: t, price: null, error: "Sem retorno da API" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      return tickers.map((t) => ({ ticker: t, price: null, error: msg }));
    }
  });
