import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { NAV } from "@/config/nav";
import { useUi } from "@/store/ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function CommandPalette() {
  const open = useUi((s) => s.cmdkOpen);
  const setOpen = useUi((s) => s.setCmdkOpen);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="top-[14vh] max-w-[560px] overflow-hidden p-0">
        <DialogTitle className="sr-only">Buscar páginas e ações</DialogTitle>
        <Command className="[&_[cmdk-input]]:border-border">
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 text-muted-foreground/60" />
            <Command.Input
              autoFocus
              placeholder="Buscar páginas e ações…"
              className="flex-1 bg-transparent py-4 text-base outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground/60">
              Nada encontrado.
            </Command.Empty>
            <Command.Group
              heading="Páginas"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
            >
              {NAV.flatMap((s) => s.items).map((item) => (
                <Command.Item
                  key={item.to}
                  value={item.label}
                  onSelect={() => go(() => navigate(item.to))}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground aria-selected:bg-secondary aria-selected:text-foreground"
                >
                  <item.icon className="size-4 text-muted-foreground/60" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group
              heading="Ações"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
            >
              <Command.Item
                value="Atualizar dados"
                onSelect={() => go(() => qc.invalidateQueries())}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground aria-selected:bg-secondary aria-selected:text-foreground"
              >
                <RefreshCw className="size-4 text-muted-foreground/60" />
                Atualizar dados
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
