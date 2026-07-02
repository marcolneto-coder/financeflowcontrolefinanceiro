import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FinanceProvider } from "../lib/finance-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { AppSidebar } from "../components/AppSidebar";
import { PinLockScreen } from "../components/PinLockScreen";

import { hasPin, isUnlockedThisSession } from "../lib/security-store";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Finance Flow" },
      { title: "Finance Flow — Controle Financeiro Pessoal" },
      { name: "description", content: "Controle pessoal de receitas, despesas fixas e lançamentos no cartão de crédito." },
      { property: "og:title", content: "Finance Flow — Controle Financeiro Pessoal" },
      { name: "twitter:title", content: "Finance Flow — Controle Financeiro Pessoal" },
      { property: "og:description", content: "Controle pessoal de receitas, despesas fixas e lançamentos no cartão de crédito." },
      { name: "twitter:description", content: "Controle pessoal de receitas, despesas fixas e lançamentos no cartão de crédito." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    // Apply stored theme as soon as the app mounts on the client
    if (typeof window !== "undefined") {
      const stored = (localStorage.getItem("theme-mode") as "light" | "dark" | null) || "dark";
      if (stored === "light") document.documentElement.classList.add("light");
      else document.documentElement.classList.remove("light");
      // Remove any previously persisted custom font size (feature reverted)
      localStorage.removeItem("font-size");
      document.documentElement.style.fontSize = "";
    }
  }, []);

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth";

  useEffect(() => {
    if (!loading && !user && !isAuthRoute) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, isAuthRoute, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthRoute || !user) {
    return <Outlet />;
  }

  return (
    <FinanceProvider>
      <AppLockGate>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
          
        </div>
      </AppLockGate>
    </FinanceProvider>
  );
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => hasPin() && !isUnlockedThisSession());

  if (locked) {
    return <PinLockScreen onUnlock={() => setLocked(false)} />;
  }
  return <>{children}</>;
}
