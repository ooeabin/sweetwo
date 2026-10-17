import { keepLogin } from '@sweetwo/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@sweetwo/ui/styles.css';
import { canSee, NoPermission } from './frame';
import { AdminGate, useAdmin } from './gate';
import { AD01Dashboard } from './pages/ad-01-dashboard';
import { AD02Members } from './pages/ad-02-members';
import { AD03Member } from './pages/ad-03-member';
import { AD06Inquiries } from './pages/ad-06-inquiries';
import { AD06Inquiry } from './pages/ad-06-inquiry';
import { AD10Notices } from './pages/ad-10-notices';
import { AD14Content } from './pages/ad-14-content';
import { AD16App } from './pages/ad-16-app';
import { AD17Audit } from './pages/ad-17-audit';
import { AD18Admins } from './pages/ad-18-admins';
import { AD18Approvals } from './pages/ad-18-approvals';
import { AD20Docs } from './pages/ad-20-docs';

// 어드민(ops.sweetwo.kr, 27 어드민 화면). 데스크톱 웹만, 기준 폭 1440·최소 1280.
// 매직 링크는 새 탭에서 열리므로 세션·PKCE 값은 localStorage(최대 8시간은 session.ts가 지킴)
keepLogin.set(true);

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Allow({ menu, children }: { menu: string; children: ReactNode }) {
  const me = useAdmin();
  return canSee(me.roles, menu) ? <>{children}</> : <NoPermission />;
}

function App() {
  return (
    <AdminGate>
      <Routes>
        <Route path="/" element={<AD01Dashboard />} />
        <Route
          path="/members"
          element={
            <Allow menu="members">
              <AD02Members />
            </Allow>
          }
        />
        <Route
          path="/members/:id"
          element={
            <Allow menu="members">
              <AD03Member />
            </Allow>
          }
        />
        <Route
          path="/inquiries"
          element={
            <Allow menu="inquiries">
              <AD06Inquiries />
            </Allow>
          }
        />
        <Route
          path="/inquiries/:id"
          element={
            <Allow menu="inquiries">
              <AD06Inquiry />
            </Allow>
          }
        />
        <Route
          path="/notices"
          element={
            <Allow menu="send">
              <AD10Notices />
            </Allow>
          }
        />
        <Route
          path="/content"
          element={
            <Allow menu="content">
              <AD14Content />
            </Allow>
          }
        />
        <Route path="/system" element={<Navigate to="/system/approvals" replace />} />
        <Route
          path="/system/approvals"
          element={
            <Allow menu="system">
              <AD18Approvals />
            </Allow>
          }
        />
        <Route
          path="/system/app"
          element={
            <Allow menu="system">
              <AD16App />
            </Allow>
          }
        />
        <Route
          path="/system/admins"
          element={
            <Allow menu="system">
              <AD18Admins />
            </Allow>
          }
        />
        <Route
          path="/system/audit"
          element={
            <Allow menu="system">
              <AD17Audit />
            </Allow>
          }
        />
        <Route path="/audit" element={<Navigate to="/system/audit" replace />} />
        <Route path="/docs" element={<AD20Docs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminGate>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root가 없어요');
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className="hg-root">
          <App />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
