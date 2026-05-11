import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import FloatingHealthChat from './components/FloatingHealthChat';
import useAuthStore from './store/authStore';
import { authAPI } from './api/services';

// Pages
import LoginPage        from './pages/LoginPage';
import Dashboard        from './pages/Dashboard';
import PreTreatment     from './pages/PreTreatmentSearch';
import CheckupRecords   from './pages/CheckupRecords';
import InsuranceList    from './pages/InsuranceList';
import MedicalRecords   from './pages/MedicalRecords';
import InsurancePlan    from './pages/InsurancePlan';
import HealthReport     from './pages/HealthReport';

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const lastContentPath = useRef('/');
  const isLogin = location.pathname === '/login';

  useEffect(() => {
    if (isLogin) return;

    if (location.pathname === '/chat') {
      const params = new URLSearchParams(location.search);
      setChatQuery(params.get('q') || params.get('query') || '');
      setChatOpen(true);
      navigate(lastContentPath.current || '/', { replace: true });
      return;
    }

    lastContentPath.current = `${location.pathname}${location.search}${location.hash}`;
  }, [isLogin, location, navigate]);

  if (isLogin) return children;
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh' }}>
        {children}
      </main>
      {isAuthenticated && (
        <FloatingHealthChat
          open={chatOpen}
          onOpen={() => setChatOpen(true)}
          onClose={() => setChatOpen(false)}
          initialQuery={chatQuery}
        />
      )}
    </>
  );
}

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      authAPI.profile().then(r => setUser(r)).catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"                element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/pre-treatment"   element={<PrivateRoute><PreTreatment /></PrivateRoute>} />
          <Route path="/checkup"         element={<PrivateRoute><CheckupRecords /></PrivateRoute>} />
          <Route path="/insurance"       element={<PrivateRoute><InsuranceList /></PrivateRoute>} />
          <Route path="/medical-records" element={<PrivateRoute><MedicalRecords /></PrivateRoute>} />
          <Route path="/insurance-plan"  element={<PrivateRoute><InsurancePlan /></PrivateRoute>} />
          <Route path="/health-report"   element={<PrivateRoute><HealthReport /></PrivateRoute>} />
          <Route path="/chat"            element={<PrivateRoute><Navigate to="/" replace /></PrivateRoute>} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
