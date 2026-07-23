import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  
  Settings,
  Menu,
  X,
  LogOut,
  Calculator,
  FileUp,
  PiggyBank,
} from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth-context";
import { openCommandPalette } from "@/components/CommandPalette";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
  { title: "Cartões", url: "/cards", icon: CreditCard },
  { title: "Investimentos", url: "/investments", icon: PiggyBank },
  { title: "Simulador de Compras", url: "/simulator", icon: Calculator },
  { title: "Importar", url: "/import", icon: FileUp },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const navContent = (
    <>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative size-10 rounded-xl brand-mark flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-5 4 4 8-8" />
              <path d="M14 8h6v6" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-semibold text-sidebar-foreground tracking-tight">
              Finance Flow
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Wealth Console
            </span>
          </div>
          {isMobile && (
            <button onClick={() => setOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-sidebar-accent">
              <X className="size-5" />
            </button>
          )}
        </div>

        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Navegação
        </p>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => isMobile && setOpen(false)}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full transition-all ${
                    active ? "bg-primary opacity-100" : "opacity-0"
                  }`}
                />
                <item.icon className={`size-[18px] transition-colors ${active ? "text-primary" : ""}`} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => { openCommandPalette(); if (isMobile) setOpen(false); }}
          className="mt-4 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground border border-sidebar-border hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <span className="flex-1 text-left">Buscar ou executar…</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted/50 border border-border">⌘K</kbd>
        </button>
      </div>

      <div className="mt-auto p-5 space-y-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-display font-semibold text-sm">
              {(user?.user_metadata?.display_name || user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Conta"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="size-4" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  // Mobile: hamburger + overlay
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-40 p-2 rounded-lg bg-card border border-border shadow-lg"
        >
          <Menu className="size-5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-sidebar flex flex-col shadow-2xl">
              {navContent}
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop: static sidebar
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
      {navContent}
    </aside>
  );
}
