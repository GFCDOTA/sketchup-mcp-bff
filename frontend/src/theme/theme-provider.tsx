import { createContext, useCallback, useState, type ReactNode } from "react";
import { themes } from "./themes";
import { applyTheme, getStoredThemeId, resolveTheme } from "./apply-theme";
import { THEME_STORAGE_KEY, type Theme } from "./theme-types";

interface ThemeCtx {
  theme: Theme;
  themeId: string;
  setThemeId: (id: string) => void;
  themes: Theme[];
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // o tema já foi aplicado no main.tsx (pré-paint); aqui só guardamos o id corrente.
  const [themeId, setId] = useState<string>(() => resolveTheme(getStoredThemeId()).id);

  const setThemeId = useCallback((id: string) => {
    const t = resolveTheme(id);
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 380);
    }
    applyTheme(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t.id);
    } catch {
      /* sem localStorage */
    }
    setId(t.id);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: resolveTheme(themeId), themeId, setThemeId, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}
