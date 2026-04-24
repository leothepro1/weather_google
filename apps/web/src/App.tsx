import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './lib/auth.js';
import { Dashboard } from './pages/Dashboard.js';
import { Login } from './pages/Login.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
