import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, RefreshCw, Search } from "lucide-react";
import { NAV } from "@/config/nav";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { ConnBadge } from "./conn-badge";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

function currentLabel(pathname: string): string {
  const items = NAV.flatMap((s) => s.items);
  const exact = items.find((i) => i.to === pathname);
  if (exact) return exact.label;
  const prefix = items
    .filter((i) => i.to !== "/" && pathname.startsWith(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return prefix?.label ?? "Visão Geral";
}

export function Topbar() {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const setCmdk = useUi((s) => s.setCmdkOpen);
  const setSidebar = useUi((s) => s.setSidebarOpen);

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-header/80 px-5 text-header-foreground backdrop-blur-md">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebar(true)}>
        <Menu className="size-5" />
      </Button>

      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight">{currentLabel(pathname)}</h1>
        <span className="text-xs text-muted-foreground/50">Interior Studio · AI Cockpit</span>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setCmdk(true)}
        className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground/70 transition-colors hover:border-border/80 hover:bg-secondary sm:flex"
      >
        <Search className="size-3.5" />
        <span>Buscar…</span>
        <kbd className="ml-2 rounded-sm border border-border bg-secondary px-1.5 font-mono text-[10.5px]">⌘K</kbd>
      </button>

      <Button variant="ghost" size="icon" title="Atualizar" onClick={() => qc.invalidateQueries()}>
        <RefreshCw className="size-[17px]" />
      </Button>

      <ThemeSwitcher />
      <ConnBadge />
    </header>
  );
}
