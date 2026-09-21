import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HoldingsListPage from "./pages/HoldingsListPage";
import HoldingDetailPage from "./pages/HoldingDetailPage";

/**
 * Sprint 1's first real frontend pages (see
 * claude/buffett-munger-rebuild-sprint-plan-2026-09-21.md): a holding list
 * and holding detail, against the Minimal API
 * (backend/app/api/holdings.py, documents.py). Portfolio/thesis/macro
 * routes land in later sprints — see components/Layout.tsx's nav.
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HoldingsListPage />} />
        <Route path="/holdings/:id" element={<HoldingDetailPage />} />
      </Routes>
    </Layout>
  );
}
