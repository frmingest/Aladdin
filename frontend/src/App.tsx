import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HoldingsListPage from "./pages/HoldingsListPage";
import HoldingDetailPage from "./pages/HoldingDetailPage";
import PortfolioPage from "./pages/PortfolioPage";
import MacroPage from "./pages/MacroPage";
import SectorPage from "./pages/SectorPage";

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
        <Route path="/" element={<HoldingsListPage />} />
        <Route path="/holdings/:id" element={<HoldingDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/macro" element={<MacroPage />} />
        <Route path="/sectors/:sector" element={<SectorPage />} />
      </Routes>
    </Layout>
  );
}
