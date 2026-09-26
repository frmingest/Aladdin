import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AnalysisQueuePage from "./pages/AnalysisQueuePage";
import DashboardPage from "./pages/DashboardPage";
import HoldingsListPage from "./pages/HoldingsListPage";
import HoldingDetailPage from "./pages/HoldingDetailPage";
import PortfolioPage from "./pages/PortfolioPage";
import JournalPage from "./pages/JournalPage";
import MacroPage from "./pages/MacroPage";
import MarginOfSafetyPage from "./pages/MarginOfSafetyPage";
import SectorPage from "./pages/SectorPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import ThesisMonitorPage from "./pages/ThesisMonitorPage";
import WatchlistPage from "./pages/WatchlistPage";

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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/holdings" element={<HoldingsListPage />} />
        <Route path="/holdings/:id" element={<HoldingDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/margin-of-safety" element={<MarginOfSafetyPage />} />
        <Route path="/macro" element={<MacroPage />} />
        <Route path="/sectors/:sector" element={<SectorPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/thesis" element={<ThesisMonitorPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/analysis-queue" element={<AnalysisQueuePage />} />
        <Route path="/status" element={<SystemStatusPage />} />
      </Routes>
    </Layout>
  );
}
