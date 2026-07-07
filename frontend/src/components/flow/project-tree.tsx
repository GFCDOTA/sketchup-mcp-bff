import { Folder, FileCode2, FileText, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/data/flow";

function depthOf(path: string) {
  return Math.max(0, path.replace(/\/+$/, "").split("/").length - 1);
}
function leafOf(path: string) {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}
function isDir(path: string) {
  return path.endsWith("/") || !leafOf(path).includes(".");
}
function iconFor(path: string) {
  if (isDir(path)) return Folder;
  if (/\.(ts|tsx|js|py|rb)$/.test(path)) return FileCode2;
  if (/\.(skp|png|jpg)$/.test(path)) return Box;
  return FileText;
}

export function ProjectTree({ title, nodes, accent = "gold" }: { title: string; nodes: TreeNode[]; accent?: "gold" | "blue" }) {
  return (
    <div className="rounded-lg border border-border bg-popover p-3">
      <div className={cn("mb-2 px-1 font-mono text-xs font-semibold", accent === "gold" ? "text-primary" : "text-blue")}>
        {title}
      </div>
      <div className="space-y-px">
        {nodes.map((n) => {
          const d = depthOf(n.path);
          const Icon = iconFor(n.path);
          const dir = isDir(n.path);
          return (
            <div
              key={n.path}
              className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-white/[0.03]"
              style={{ paddingLeft: 6 + d * 16 }}
              title={n.path}
            >
              <Icon className={cn("size-3.5 shrink-0", dir ? (accent === "gold" ? "text-primary/80" : "text-blue/80") : "text-muted-foreground/50")} />
              <span className={cn("shrink-0 font-mono text-xs", dir ? "font-medium text-foreground" : "text-muted-foreground")}>
                {leafOf(n.path)}{dir && !n.path.endsWith("/") ? "/" : ""}
              </span>
              <span className="ml-2 truncate text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground/70">
                {n.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
