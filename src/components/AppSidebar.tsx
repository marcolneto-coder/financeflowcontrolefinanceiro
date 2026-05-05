import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth-context";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
  { title: "Cartões", url: "/cards", icon: CreditCard },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
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
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="size-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <div className="size-3.5 rounded-full bg-primary" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-foreground">
            Alento
          </span>
          {isMobile && (
            <button onClick={() => setOpen(false)} className="ml-auto p-1.5 rounded-lg hover:bg-accent">
              <X className="size-5" />
            </button>
          )}
        </div>

        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              onClick={() => isMobile && setOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.url)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Alento Finance
          </p>
          <p className="text-xs text-muted-foreground">
            Controle pessoal de finanças
          </p>
        </div>
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
