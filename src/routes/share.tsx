import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/share")({
  component: ShareTargetPage,
  validateSearch: (search: Record<string, unknown>) => ({
    title: typeof search.title === "string" ? search.title : undefined,
    text: typeof search.text === "string" ? search.text : undefined,
    url: typeof search.url === "string" ? search.url : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Compartilhar — Finance Flow" },
      { name: "description", content: "Recebendo notificação compartilhada para criar transação." },
    ],
  }),
});

function ShareTargetPage() {
  const { title, text, url } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const combined = [title, text, url].filter(Boolean).join("\n").trim();
    if (combined && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("shareTarget.pendingText", combined);
      } catch { /* ignore */ }
    }
    navigate({ to: "/", replace: true });
  }, [title, text, url, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
