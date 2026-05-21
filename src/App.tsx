import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LeadsPage } from "@/pages/LeadsPage";
import { BoardPage } from "@/pages/BoardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/**
 * Top-level routes. /leads/:id/edit is rendered by LeadsPage, which uses
 * the route param to drive the modal — that way the URL is deep-linkable
 * and refresh-safe without splitting state across two routes.
 */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/leads" replace />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadsPage />} />
        <Route path="/leads/:id/:mode" element={<LeadsPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
