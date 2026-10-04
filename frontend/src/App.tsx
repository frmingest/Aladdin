import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";

/**
 * Route-level code-splitting (2026-09-28, page-load-performance
 * investigation (write-up since removed; see docs/page-load-root-cause-2026-10-03.md)
 * P0 fix #2): every page used to be a static import here, so opening any
 * one page downloaded and parsed all 14 pages' code (and their
 * dependencies, e.g. `recharts` used by only a handful) before the first
 * page could even paint — the ~795 kB main-bundle warning `npm run build`
 * has been printing since Sprint 1. `React.lazy` turns each page back into
 * its own chunk, fetched only when its route is actually visited; the
 * `Suspense` fallback below covers the brief gap while that chunk loads.
 */
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
// Game mode (F33, G2): its own chunk, so default mode downloads nothing for it.
const FortressPage = lazy(() => import("./pages/FortressPage"));
const SiegeSimulatorPage = lazy(() => import("./pages/SiegeSimulatorPage"));
// Sprint 24 (G14): the fortress replayed through time.
const ChroniclePage = lazy(() => import("./pages/ChroniclePage"));
const CouncilPage = lazy(() => import("./pages/CouncilPage"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const CompetencePage = lazy(() => import("./pages/CompetencePage"));
// Marketplace (G9): the street of watchlist stores and the deep-dive inside each.
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const MarketStorePage = lazy(() => import("./pages/MarketStorePage"));
const HoldingsListPage = lazy(() => import("./pages/HoldingsListPage"));
const HoldingDetailPage = lazy(() => import("./pages/HoldingDetailPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const MarginOfSafetyPage = lazy(() => import("./pages/MarginOfSafetyPage"));
const MacroPage = lazy(() => import("./pages/MacroPage"));
const SectorPage = lazy(() => import("./pages/SectorPage"));
const WatchlistPage = lazy(() => import("./pages/WatchlistPage"));
const ThesisMonitorPage = lazy(() => import("./pages/ThesisMonitorPage"));
const PortfolioRiskPage = lazy(() => import("./pages/PortfolioRiskPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const PreciousMetalsPage = lazy(() => import("./pages/PreciousMetalsPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const AnalysisQueuePage = lazy(() => import("./pages/AnalysisQueuePage"));
const SystemStatusPage = lazy(() => import("./pages/SystemStatusPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span className="text-sm text-ink-muted">Loading…</span>
    </div>
  );
}

/**
 * Sprint 1 built the first real frontend pages (see
 * claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md): a holding list
 * and holding detail, against the Minimal API
 * (backend/app/api/holdings.py, documents.py). Portfolio was added next
 * (CSV import + account/snapshot management, backend/app/api/portfolio.py,
 * accounts.py). Sprint 2 closes out with the research UI: Macro (portfolio-
 * wide) and Sector (per-sector, linked from Macro and from a holding's own
 * sector), plus a company-research panel on HoldingDetailPage itself —
 * thesis/valuation routes still land in later sprints, see
 * components/Layout.tsx's nav.
 */
export default function App() {
  return (
    <Layout>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/fortress" element={<FortressPage />} />
          <Route path="/fortress/siege" element={<SiegeSimulatorPage />} />
          <Route path="/fortress/chronicle" element={<ChroniclePage />} />
          <Route path="/fortress/council" element={<CouncilPage />} />
          <Route path="/fortress/records" element={<RecordsPage />} />
          <Route path="/fortress/circle" element={<CompetencePage />} />
          <Route path="/fortress/marketplace" element={<MarketplacePage />} />
          <Route path="/fortress/marketplace/:holdingId" element={<MarketStorePage />} />
          <Route path="/holdings" element={<HoldingsListPage />} />
          <Route path="/holdings/:id" element={<HoldingDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/margin-of-safety" element={<MarginOfSafetyPage />} />
          <Route path="/macro" element={<MacroPage />} />
          <Route path="/sectors/:sector" element={<SectorPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/thesis" element={<ThesisMonitorPage />} />
          <Route path="/risk" element={<PortfolioRiskPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/precious-metals" element={<PreciousMetalsPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/analysis-queue" element={<AnalysisQueuePage />} />
          <Route path="/status" element={<SystemStatusPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
