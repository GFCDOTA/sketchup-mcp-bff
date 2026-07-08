import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/shell/app-shell";
import { LoadingState } from "@/components/states";
import Overview from "@/screens/overview";
import Operacao from "@/screens/operacao";
import RunDetail from "@/screens/run-detail";
import Decisions from "@/screens/decisions";
import Curation from "@/screens/curation";
import Artifacts from "@/screens/artifacts";
import NocLedger from "@/screens/noc-ledger";

// telas de documentação (pesadas, com animações) — carregadas sob demanda
const Flow = lazy(() => import("@/screens/flow"));
const ThemeLab = lazy(() => import("@/screens/theme-lab"));

const lazyEl = (node: React.ReactNode) => (
  <Suspense fallback={<LoadingState label="Carregando…" />}>{node}</Suspense>
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Overview />} />
        <Route path="/operacao" element={<Operacao />} />
        <Route path="/runs/:id" element={<RunDetail />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/curation" element={<Curation />} />
        <Route path="/noc" element={<NocLedger />} />
        <Route path="/artifacts" element={<Artifacts />} />
        <Route path="/flow" element={lazyEl(<Flow />)} />
        <Route path="/theme-lab" element={lazyEl(<ThemeLab />)} />

        {/* redirects das rotas antigas → Operação (abas) / Como Funciona */}
        <Route path="/decision-history" element={<Navigate to="/decisions" replace />} />
        <Route path="/agents" element={<Navigate to="/operacao?tab=agentes" replace />} />
        <Route path="/runs" element={<Navigate to="/operacao?tab=runs" replace />} />
        <Route path="/workflows" element={<Navigate to="/operacao?tab=workflows" replace />} />
        <Route path="/models" element={<Navigate to="/operacao?tab=modelos" replace />} />
        <Route path="/docs" element={<Navigate to="/flow" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
