// theme-types.ts — modelo do sistema de temas do cockpit.
// Cores são HSL triplets ("222 14% 5%") para casar com o Tailwind (hsl(var(--x) / <alpha>)).

export const COLOR_KEYS = [
  "background", "foreground", "card", "cardForeground", "popover", "popoverForeground",
  "primary", "primaryForeground", "secondary", "secondaryForeground",
  "muted", "mutedForeground", "accent", "accentForeground",
  "destructive", "destructiveForeground", "border", "input", "ring",
  "success", "warning", "danger", "info", "purple", "orange",
  "sidebar", "sidebarForeground", "header", "headerForeground",
  "surface", "surface2", "faint", "gridColor", "gradientStart", "gradientEnd",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

/** chave do tema → nome da CSS var aplicada no :root */
export const VAR_MAP: Record<ColorKey, string> = {
  background: "--background", foreground: "--foreground",
  card: "--card", cardForeground: "--card-foreground",
  popover: "--popover", popoverForeground: "--popover-foreground",
  primary: "--primary", primaryForeground: "--primary-foreground",
  secondary: "--secondary", secondaryForeground: "--secondary-foreground",
  muted: "--muted", mutedForeground: "--muted-foreground",
  accent: "--accent", accentForeground: "--accent-foreground",
  destructive: "--destructive", destructiveForeground: "--destructive-foreground",
  border: "--border", input: "--input", ring: "--ring",
  success: "--ok", warning: "--warn", danger: "--danger", info: "--blue",
  purple: "--purple", orange: "--orange",
  sidebar: "--sidebar", sidebarForeground: "--sidebar-foreground",
  header: "--header", headerForeground: "--header-foreground",
  surface: "--surface", surface2: "--surface-2", faint: "--faint",
  gridColor: "--grid", gradientStart: "--gradient-start", gradientEnd: "--gradient-end",
};

export type ThemeBackground = "none" | "grid" | "mesh" | "glass" | "glow" | "dots";
export type ThemeMotion = "subtle" | "smooth" | "energetic";

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isDark: boolean;
  background: ThemeBackground;
  motion: ThemeMotion;
  cardStyle: string;
  badgeStyle: string;
  /** 4 cores HEX para o swatch do dropdown */
  preview: string[];
  /** tokens de cor em HSL triplet */
  colors: Record<ColorKey, string>;
  glow: string;
  shadow: string;
  radius: string;
}

export const DEFAULT_THEME_ID = "obsidian-agent";
export const THEME_STORAGE_KEY = "cockpit-theme";
