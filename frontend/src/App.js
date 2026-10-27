import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pointage from './pages/Pointage';
import Conges from './pages/Conges';
import CongesAdmin from './pages/CongesAdmin';
import Employes from './pages/Employes';
import QRCodes from './pages/QRCodes';
import Historique from './pages/Historique';
import Annonces from './pages/Annonces';
import Notifications from './pages/Notifications';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes scan { 0%,100% { top:10%; } 50% { top:85%; } }
          input::placeholder { color: var(--text3); }
          select option { background: var(--surface); color: var(--text); }
          a { transition: color 0.15s, background 0.15s; }
          a:hover { opacity: 0.85; }
        `}</style>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Page publique de pointage via URL QR — accessible sans connexion */}

          {/* Employé */}
          <Route path="/pointage" element={<ProtectedRoute><Pointage /></ProtectedRoute>} />
          <Route path="/conges" element={<ProtectedRoute><Conges /></ProtectedRoute>} />
          <Route path="/historique" element={<ProtectedRoute><Historique /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

          {/* Admin uniquement */}
          <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
          <Route path="/employes" element={<ProtectedRoute adminOnly><Employes /></ProtectedRoute>} />
          <Route path="/qrcodes" element={<ProtectedRoute adminOnly><QRCodes /></ProtectedRoute>} />
          <Route path="/conges/admin" element={<ProtectedRoute adminOnly><CongesAdmin /></ProtectedRoute>} />
          <Route path="/annonces" element={<ProtectedRoute adminOnly><Annonces /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}