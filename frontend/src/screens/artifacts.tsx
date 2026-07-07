import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Images, FileText, FileJson, Box, Image as ImageIcon } from "lucide-react";
import { useArtifacts } from "@/api/hooks";
import type { Artifact, ArtifactType } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";

const ICON: Record<ArtifactType, typeof FileText> = {
  render: ImageIcon, image: ImageIcon, report: FileText, json: FileJson, skp: Box,
};

export default function Artifacts() {
  const { data, isLoading, isError, error } = useArtifacts();
  const items = data?.artifacts ?? [];
  const [zoom, setZoom] = useState<Artifact | null>(null);

  return (
    <>
      <PageHeader title="Artefatos" subtitle="Renders, SKPs, relatórios e JSONs gerados pelos runs" />
      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={5} /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Images} title="Sem artefatos" /></Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => (
            <motion.div key={a.id} variants={staggerItem} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
              <ArtifactCard a={a} onZoom={setZoom} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* lightbox in-app — abre o render aqui dentro, não em outra aba */}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="top-[6vh] max-w-4xl p-2">
          <DialogTitle className="px-2 py-1 text-sm">{zoom?.name}</DialogTitle>
          {zoom?.url && (
            <img src={zoom.url} alt={zoom.name} className="max-h-[78vh] w-full rounded-md object-contain bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ArtifactCard({ a, onZoom }: { a: Artifact; onZoom: (a: Artifact) => void }) {
  const Icon = ICON[a.type] ?? FileText;
  const hasImg = (a.type === "render" || a.type === "image") && a.url;
  return (
    <Card className="overflow-hidden">
      {hasImg ? (
        <button onClick={() => onZoom(a)} className="block aspect-[4/3] w-full bg-black">
          <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-background/40 text-border">
          <Icon className="size-8" strokeWidth={1.4} />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={a.type === "render" ? "gold" : "outline"}>{a.type}</Badge>
          {a.sizeKb != null && <span className="font-mono text-[11px] text-muted-foreground/50">{a.sizeKb} kb</span>}
        </div>
        <div className="mt-1.5 truncate text-sm" title={a.name}>{a.name}</div>
        {a.runId && (
          <Link to={`/runs/${a.runId}`} className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground/50 hover:text-foreground">
            {a.runId}
          </Link>
        )}
      </div>
    </Card>
  );
}
