import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { IssuesList } from './pages/IssuesList';
import { ReportIssue } from './pages/ReportIssue';
import { IssueDetail } from './pages/IssueDetail';
import { CivicScorePage } from './pages/CivicScorePage';
import { Profile } from './pages/Profile';
import { CommunityRecognition } from './pages/CommunityRecognition';
import { AdminReview } from './pages/AdminReview';
import { AdminSettings } from './pages/AdminSettings';
import { About } from './pages/About';
import { Card, EmptyState, PageHeader } from './components/ui';
import { Link } from 'react-router-dom';
import { isLoggedIn } from './services/auth';
import { useAppVersion } from './lib/hooks';

function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Card>
        <EmptyState icon="search" title="That route does not exist">
          <p>Head back to the resident portal to continue.</p>
          <Link className="btn btn-primary btn-sm" to="/resident/dashboard">Go to dashboard</Link>
        </EmptyState>
      </Card>
    </>
  );
}

/** Redirects unauthenticated users to /login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  useAppVersion(); // re-render on session changes
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        {/* Resident portal */}
        <Route path="/resident/dashboard" element={<Dashboard />} />
        <Route path="/resident/issues" element={<IssuesList />} />
        <Route path="/resident/issues/new" element={<ReportIssue />} />
        <Route path="/resident/issues/:id" element={<IssueDetail />} />
        {/* Dedicated Civic Score route */}
        <Route path="/resident/civic-score" element={<CivicScorePage />} />
        <Route path="/resident/community" element={<CommunityRecognition />} />
        <Route path="/resident/profile" element={<Profile />} />
        {/* Admin console (pages self-enforce the admin role) */}
        <Route path="/admin/review" element={<AdminReview />} />
        <Route path="/admin/civic-score" element={<AdminSettings />} />
        {/* Shared */}
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
