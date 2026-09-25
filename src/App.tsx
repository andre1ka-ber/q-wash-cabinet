import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, useAuth, color, font, GhostButton, ConfirmDialog } from 'q-wash-shared';
import { CabinetShell } from './shared/layout/CabinetShell';
import { LoginPage } from './features/auth/LoginPage';
import { ServicesPage } from './features/services/ServicesPage';
import { BoxesPage } from './features/boxes/BoxesPage';
import { HoursPage } from './features/hours/HoursPage';
import { PhotosPage } from './features/photos/PhotosPage';
import { QrCodePage } from './features/qr-code/QrCodePage';

const queryClient = new QueryClient();

function FullScreenLoader() {
  return <div style={{ minHeight: '100vh', background: color.pageBg }} />;
}

// This app has no point-picker anywhere (locked-in design, PLAN.md) — it
// assumes the logged-in account is scoped to exactly one washing point via
// User.washing_point_id. An admin/customer account (or a staff account
// somehow missing the field) has nowhere sensible to land here.
function UnsupportedAccount() {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          background: color.pageBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 420,
            maxWidth: '100%',
            background: color.panel,
            border: `1px solid ${color.border}`,
            borderRadius: 20,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 18 }}>
            Этот аккаунт не привязан к мойке
          </div>
          <div style={{ color: color.textMuted, fontSize: 13 }}>
            Кабинет мойки доступен только сотрудникам, закреплённым за конкретной мойкой. Обратитесь к администратору
            сети.
          </div>
          <GhostButton onClick={() => setLogoutConfirmOpen(true)} style={{ alignSelf: 'center', padding: '11px 22px' }}>
            Выйти
          </GhostButton>
        </div>
      </div>
      {logoutConfirmOpen && (
        <ConfirmDialog
          title="Выйти из аккаунта?"
          message="Понадобится снова ввести логин и пароль, чтобы продолжить работу."
          confirmLabel="Выйти"
          onConfirm={() => void authStore.logout()}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
    </>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (!user || (user.role !== 'staff' && user.role !== 'worker') || !user.washing_point_id) {
    return <UnsupportedAccount />;
  }
  return <>{children}</>;
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <LoginPage />;
}

function AppRoutes() {
  useEffect(() => {
    authStore.restore();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <CabinetShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<ServicesPage />} />
        <Route path="boxes" element={<BoxesPage />} />
        <Route path="hours" element={<HoursPage />} />
        <Route path="photos" element={<PhotosPage />} />
        <Route path="qr-code" element={<QrCodePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
