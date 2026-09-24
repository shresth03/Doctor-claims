import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/shell/AppShell";

// Each screen is its own chunk so heavy dependencies (charts, etc.) only load where they're used.
const OverviewPage = lazy(() => import("./features/overview/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const DoctorReviewPage = lazy(() => import("./features/doctor-review/DoctorReviewPage").then((m) => ({ default: m.DoctorReviewPage })));
const DocumentationPage = lazy(() => import("./features/documentation/DocumentationPage").then((m) => ({ default: m.DocumentationPage })));
const BillingPage = lazy(() => import("./features/billing/BillingPage").then((m) => ({ default: m.BillingPage })));
const CompliancePage = lazy(() => import("./features/compliance/CompliancePage").then((m) => ({ default: m.CompliancePage })));
const ObservabilityPage = lazy(() => import("./features/observability/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const AuditTrailPage = lazy(() => import("./features/audit-trail/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/doctor-review" element={<DoctorReviewPage />} />
        <Route path="/documentation" element={<DocumentationPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
