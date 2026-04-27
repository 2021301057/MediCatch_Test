import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/common/Navbar';
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
import HealthChat       from './pages/HealthChat';

function Layout({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  if (isLogin) return children;
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh' }}>
        {children}
      </main>
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
      authAPI.profile().then(r => setUser(r.data)).catch(() => {});
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
          <Route path="/chat"            element={<PrivateRoute><HealthChat /></PrivateRoute>} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
