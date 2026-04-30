import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance-context";
import { useState } from "react";
import { Trash2, Palette } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Configurações — Alento" },
      { name: "description", content: "Personalize seu app de finanças" },
    ],
  }),
});

const ACCENT_OPTIONS = [
  { name: "Azul", value: "blue", color: "#3b82f6" },
  { name: "Violeta", value: "violet", color: "#8b5cf6" },
  { name: "Rosa", value: "pink", color: "#ec4899" },
  { name: "Esmeralda", value: "emerald", color: "#10b981" },
  { name: "Âmbar", value: "amber", color: "#f59e0b" },
  { name: "Ciano", value: "cyan", color: "#06b6d4" },
  { name: "Vermelho", value: "red", color: "#ef4444" },
  { name: "Índigo", value: "indigo", color: "#6366f1" },
];

function SettingsPage() {
  const { state, setAccentColor, deleteCategory } = useFinance();
  const [tab, setTab] = useState<"appearance" | "categories">("appearance");

  const incomeCategories = state.categories.filter((c) => c.type === "income");
  const expenseCategories = state.categories.filter((c) => c.type === "expense");

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">Personalizar</p>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit">
        {(["appearance", "categories"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t === "appearance" ? "Aparência" : "Categorias"}
          </button>
        ))}
      </div>

      {tab === "appearance" && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="size-4 text-muted-foreground" />
              <h2 className="text-lg font-medium">Cor de destaque</h2>
            </div>
            <div className="glass-card p-6">
              <div className="grid grid-cols-4 gap-4">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAccentColor(opt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                      state.accentColor === opt.value
                        ? "bg-accent ring-2 ring-ring"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="size-8 rounded-full" style={{ backgroundColor: opt.color }} />
                    <span className="text-xs font-medium">{opt.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                A cor de destaque será aplicada em futura atualização de temas dinâmicos.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-medium mb-4">Categorias de Receita</h2>
            <div className="glass-card p-4">
              {incomeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhuma categoria de receita.</p>
              ) : (
                <div className="space-y-1">
                  {incomeCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="size-2 rounded-full bg-income" />
                        <span className="text-sm">{cat.name}</span>
                      </div>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium mb-4">Categorias de Despesa</h2>
            <div className="glass-card p-4">
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhuma categoria de despesa.</p>
              ) : (
                <div className="space-y-1">
                  {expenseCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="size-2 rounded-full bg-expense" />
                        <span className="text-sm">{cat.name}</span>
                      </div>
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Novas categorias podem ser criadas diretamente ao adicionar uma transação.
          </p>
        </div>
      )}
    </div>
  );
}
