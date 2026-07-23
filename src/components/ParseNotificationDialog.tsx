import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/lib/finance-context";
import { parseNotificationText, type ParseNotificationResult } from "@/lib/parse-notification.functions";
import { TransactionFormDialog } from "./TransactionFormDialog";
import type { Transaction } from "@/lib/finance-store";

interface Props {
  onClose: () => void;
  initialText?: string;
  autoAnalyze?: boolean;
}

export function ParseNotificationDialog({ onClose, initialText, autoAnalyze }: Props) {
  const { state } = useFinance();
  const [text, setText] = useState(initialText ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Partial<Transaction> | null>(null);
  const [confidence, setConfidence] = useState<ParseNotificationResult["confidence"]>();
  const [autoTriggered, setAutoTriggered] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseNotificationText({
        data: {
          text: text.trim(),
          cards: state.creditCards.map((c) => ({ id: c.id, name: c.name, lastDigits: c.lastDigits })),
          categories: state.categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
        },
      });

      const seed: Partial<Transaction> = {
        type: result.type,
        description: result.description,
        amount: result.amount,
        categoryId: result.categoryId || "",
        creditCardId: result.creditCardId,
        store: result.store,
        purchaseDate: result.purchaseDate,
        date: result.purchaseDate || new Date().toISOString().split("T")[0],
        isInstallment: !!result.isInstallment,
        totalInstallments: result.totalInstallments,
        isFixed: false,
      };
      setConfidence(result.confidence);
      setPrefill(seed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao analisar notificação");
    } finally {
      setLoading(false);
    }
  };

  if (prefill) {
    return (
      <>
        {confidence === "low" && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-3 py-2 rounded-lg bg-amber-500/90 text-white text-xs shadow-lg">
            Confiança baixa — revise os campos antes de salvar.
          </div>
        )}
        <TransactionFormDialog editTransaction={null} prefill={prefill} onClose={onClose} />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-4 md:p-6 m-4 max-h-[90vh] overflow-y-auto border border-border bg-card rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Criar por notificação
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Cole aqui o texto de uma notificação de banco ou cartão. A IA vai extrair valor,
          estabelecimento, cartão e parcelas — você confirma antes de salvar.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Ex.: "Compra aprovada: R$ 89,90 em IFOOD no cartão final 1234 em 3x"'}
          rows={6}
          className="w-full px-3 py-2.5 rounded-lg bg-input border-0 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleAnalyze} className="flex-1" disabled={!text.trim() || loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" /> Analisando...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-1" /> Analisar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
