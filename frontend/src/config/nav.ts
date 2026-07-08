// nav.ts — registro de navegação do cockpit (consolidado: 5 destinos no Cockpit).
import {
  LayoutGrid, Boxes, Inbox, Images, Map, Palette, GitBranch, Stamp, type LucideIcon,
} from "lucide-react";

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

export const NAV: NavSection[] = [
  {
    title: "Cockpit",
    items: [
      { to: "/", label: "Visão Geral", icon: LayoutGrid, end: true },
      { to: "/operacao", label: "Operação", icon: Boxes, badge: "runs" },
      { to: "/decisions", label: "Decisões", icon: Inbox, badge: "decisions" },
      { to: "/curation", label: "Curadoria", icon: Stamp, badge: "curation" },
      { to: "/noc", label: "NOC", icon: GitBranch },
    ],
  },
  {
    title: "Estúdio",
    items: [
      { to: "/artifacts", label: "Artefatos", icon: Images },
      { to: "/flow", label: "Como Funciona", icon: Map },
      { to: "/theme-lab", label: "Theme Lab", icon: Palette },
    ],
  },
];
