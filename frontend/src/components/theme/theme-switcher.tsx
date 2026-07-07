import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useTheme } from "@/theme/use-theme";
import { cn } from "@/lib/utils";

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span className="flex gap-0.5">
      {colors.slice(0, 4).map((c, i) => (
        <span key={i} className="size-2.5 rounded-[3px] ring-1 ring-black/25" style={{ background: c }} />
      ))}
    </span>
  );
}

export function ThemeSwitcher() {
  const { theme, themeId, setThemeId, themes } = useTheme();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground"
          title="Trocar tema"
        >
          <span className="text-sm leading-none">{theme.emoji}</span>
          <span className="hidden font-medium sm:inline">{theme.name}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[60] w-72 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <Palette className="size-3.5" /> Tema
          </div>
          <div className="max-h-[62vh] overflow-y-auto scrollbar-thin">
            {themes.map((t) => (
              <DropdownMenu.Item
                key={t.id}
                onSelect={() => setThemeId(t.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 outline-none transition-colors",
                  t.id === themeId ? "bg-secondary" : "hover:bg-secondary/60 focus:bg-secondary/60",
                )}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{t.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{t.description}</span>
                </span>
                <Swatch colors={t.preview} />
                {t.id === themeId && <Check className="size-4 shrink-0 text-primary" />}
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
