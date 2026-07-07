import { themes } from "./themes";
import { VAR_MAP, DEFAULT_THEME_ID, THEME_STORAGE_KEY, type Theme, type ColorKey } from "./theme-types";

export const themesById: Record<string, Theme> = Object.fromEntries(themes.map((t) => [t.id, t]));

export function resolveTheme(id: string | null | undefined): Theme {
  return (id && themesById[id]) || themesById[DEFAULT_THEME_ID] || themes[0];
}

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/** Aplica os tokens do tema nas CSS vars do :root + atributos data-* para os efeitos de fundo. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const key of Object.keys(VAR_MAP) as ColorKey[]) {
    root.style.setProperty(VAR_MAP[key], theme.colors[key]);
  }
  root.style.setProperty("--gold", theme.colors.primary); // 'gold' segue o primary do tema
  root.style.setProperty("--glow", theme.glow);
  root.style.setProperty("--shadow", theme.shadow);
  root.style.setProperty("--radius", theme.radius);
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-bg", theme.background);
  root.setAttribute("data-motion", theme.motion);
  root.classList.toggle("dark", theme.isDark);
  root.classList.toggle("light", !theme.isDark);
  root.style.colorScheme = theme.isDark ? "dark" : "light";
}

/** Aplica o tema salvo (chamar antes do primeiro paint, no main.tsx). */
export function applyStoredTheme() {
  applyTheme(resolveTheme(getStoredThemeId()));
}
