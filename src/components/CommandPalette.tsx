import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Calculator,
  FileUp,
  Settings,
  Plus,
  Search,
  Keyboard,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useFinance } from "@/lib/finance-context";
import { formatCurrency } from "@/lib/finance-store";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import { ParseNotificationDialog } from "@/components/ParseNotificationDialog";

const NEW_TX_EVENT = "app:new-transaction";
const OPEN_PALETTE_EVENT = "app:open-palette";

export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}
export function openNewTransaction() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NEW_TX_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [showNewTx, setShowNewTx] = useState(false);
  const [showParse, setShowParse] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { state } = useFinance();

  // Global shortcuts
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl/Cmd+K → toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // N → new transaction
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowNewTx(true);
        return;
      }
      // / → open palette in search mode
      if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // ? → shortcut help
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
    };
    const onOpen = () => setOpen(true);
    const onNew = () => setShowNewTx(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    window.addEventListener(NEW_TX_EVENT, onNew);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
      window.removeEventListener(NEW_TX_EVENT, onNew);
    };
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  // Transaction search results (limit for perf)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.transactions
      .filter((t) => {
        return (
          t.description.toLowerCase().includes(q) ||
          (t.store ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, 8);
  }, [query, state.transactions]);

  const toggleTheme = () => {
    if (typeof document === "undefined") return;
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("theme-mode", isLight ? "light" : "dark");
    setOpen(false);
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar transações, navegar ou executar ações..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Transações">
              {results.map((tx) => {
                const cat = state.categories.find((c) => c.id === tx.categoryId);
                return (
                  <CommandItem
                    key={tx.id}
                    value={`tx-${tx.id}-${tx.description}-${tx.store ?? ""}`}
                    onSelect={() => {
                      const d = new Date(tx.date + "T12:00:00");
                      setOpen(false);
                      navigate({
                        to: "/transactions",
                        search: { year: d.getFullYear(), month: d.getMonth(), highlight: tx.id },
                      });
                    }}
                  >
                    <Search className="size-4" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{tx.description}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {new Date(tx.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        {cat ? ` • ${cat.name}` : ""}
                        {tx.store ? ` • ${tx.store}` : ""}
                      </div>
                    </div>
                    <span
                      className={`tabular-nums text-xs font-semibold ${
                        tx.type === "income" ? "text-income" : "text-expense"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "−"} {formatCurrency(tx.amount)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandGroup heading="Ações rápidas">
            <CommandItem onSelect={() => { setOpen(false); setShowNewTx(true); }}>
              <Plus className="size-4" />
              Nova transação
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); setShowParse(true); }}>
              <Sparkles className="size-4" />
              Extrair de notificação (IA)
            </CommandItem>
            <CommandItem onSelect={toggleTheme}>
              <Sun className="size-4" />
              Alternar tema claro / escuro
              <Moon className="size-4 opacity-60" />
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); setShowHelp(true); }}>
              <Keyboard className="size-4" />
              Atalhos de teclado
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ir para">
            <CommandItem onSelect={() => go("/")}>
              <LayoutDashboard className="size-4" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/transactions")}>
              <ArrowLeftRight className="size-4" />
              Transações
            </CommandItem>
            <CommandItem onSelect={() => go("/cards")}>
              <CreditCard className="size-4" />
              Cartões
            </CommandItem>
            <CommandItem onSelect={() => go("/simulator")}>
              <Calculator className="size-4" />
              Simulador de Compras
            </CommandItem>
            <CommandItem onSelect={() => go("/import")}>
              <FileUp className="size-4" />
              Importar
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="size-4" />
              Configurações
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {showNewTx && (
        <TransactionFormDialog editTransaction={null} onClose={() => setShowNewTx(false)} />
      )}
      {showParse && <ParseNotificationDialog onClose={() => setShowParse(false)} />}
      {showHelp && <ShortcutsDialog onClose={() => setShowHelp(false)} />}
    </>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows: Array<[string, string]> = [
    ["Ctrl / ⌘ + K", "Abrir paleta de comandos"],
    ["N", "Nova transação"],
    ["/", "Buscar (abrir paleta)"],
    ["?", "Ver atalhos"],
    ["Esc", "Fechar diálogos"],
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Atalhos de teclado</h2>
        </div>
        <ul className="space-y-2">
          {rows.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="px-2 py-1 text-[11px] font-mono rounded-md border border-border bg-muted/40">{k}</kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Atalhos ficam desativados quando você está digitando em um campo.
        </p>
      </div>
    </div>
  );
}
