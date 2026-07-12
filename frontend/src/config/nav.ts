// nav.ts — registro de navegação do cockpit (consolidado: 5 destinos no Cockpit).
import { LayoutGrid, Inbox, Stamp, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** chave de badge dinâmico calculado na sidebar */
  badge?: "runs" | "decisions" | "curation";
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// Corte 2026-07-12 (Felipe: "deixa só o que vai ter ganho de progresso"; gap #2
// da nota 8/10 do GPT era a nav inchada): 8 destinos → 3. Operação/NOC/Artefatos/
// Como Funciona/Theme Lab saíram do MENU — as rotas seguem vivas por URL direto
// (telas não deletadas; curation/overview carregam WIP de outra sessão).
export const NAV: NavSection[] = [
  {
    title: "Cockpit",
    items: [
      { to: "/", label: "Hoje", icon: LayoutGrid, end: true },
      { to: "/curation", label: "Curadoria", icon: Stamp, badge: "curation" },
      { to: "/decisions", label: "Decisões", icon: Inbox, badge: "decisions" },
    ],
  },
];
