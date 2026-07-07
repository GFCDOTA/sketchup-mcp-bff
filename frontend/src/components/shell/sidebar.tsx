import { NavLink } from "react-router-dom";
import { Boxes } from "lucide-react";
import { NAV } from "@/config/nav";
import { useRuns, useDecisions, useCuration } from "@/api/hooks";
import { DEFAULT_PLANT } from "@/api/client";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { data: runs } = useRuns();
  const { data: decisions } = useDecisions();
  const { data: curation } = useCuration(DEFAULT_PLANT);
  const setOpen = useUi((s) => s.setSidebarOpen);

  const badges: Record<string, number> = {
    runs: (runs?.runs ?? []).filter((r) => r.status === "running").length,
    decisions: (decisions?.decisions ?? []).filter((d) => d.status === "pending").length,
    curation: curation?.awaiting_human ?? 0,
  };

  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <span className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/50 text-primary-foreground shadow-glow">
          <Boxes className="size-4" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">INTERIOR</span> COCKPIT
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/50">AI devtool</div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {NAV.map((section) => (
          <div key={section.title}>
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                        )}
                        <item.icon className={cn("size-[17px]", isActive ? "text-primary" : "text-muted-foreground/70")} />
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && (
                          <span className="rounded-full border border-border bg-background px-1.5 text-[10.5px] font-semibold text-primary">
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="px-1 text-[10.5px] text-muted-foreground/40">
          Interior Studio · AI Cockpit
        </div>
      </div>
    </aside>
  );
}
