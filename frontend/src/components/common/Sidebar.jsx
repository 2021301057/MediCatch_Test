import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { path: '/',                  icon: '🏠', label: '대시보드' },
  { path: '/pre-treatment',     icon: '🔍', label: '진료 전 검색',    badge: 'NEW' },
  { path: '/checkup',           icon: '🏥', label: '건강 검진 기록' },
  { path: '/insurance',         icon: '🛡️', label: '내 보험 조회' },
  { path: '/medical-records',   icon: '📋', label: '진료 기록 & 청구' },
  { path: '/insurance-plan',    icon: '📊', label: '보험 추천 & 공백' },
  { path: '/health-report',     icon: '📈', label: '건강 통합 리포트' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={styles.sidebar}>
      {/* 로고 */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>🏥</span>
        <span style={styles.logoText}>MediCatch</span>
      </div>

      {/* 사용자 정보 */}
      {user && (
        <div style={styles.userCard}>
          <div style={styles.avatar}>{user.name?.[0] || '?'}</div>
          <div>
            <div style={styles.userName}>{user.name}</div>
            <div style={styles.userEmail}>{user.email}</div>
          </div>
        </div>
      )}

      {/* 네비게이션 */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ path, icon, label, badge }) => (
          <NavLink key={path} to={path} end={path === '/'} style={({ isActive }) => ({
            ...styles.navItem,
            ...(isActive ? styles.navActive : {}),
          })}>
            <span style={styles.navIcon}>{icon}</span>
            <span style={styles.navLabel}>{label}</span>
            {badge && <span style={{ ...styles.badge, ...(badge === 'AI' ? styles.badgeAI : styles.badgeNew) }}>{badge}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 로그아웃 */}
      <button onClick={handleLogout} style={styles.logoutBtn}>
        🚪 로그아웃
      </button>
    </aside>
  );
}

const styles = {
  sidebar: { width: 240, minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', padding: '0 0 20px 0', position: 'fixed', left: 0, top: 0, zIndex: 100 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, padding: '24px 20px 20px', borderBottom: '1px solid #1e293b' },
  logoIcon: { fontSize: 28 },
  logoText: { fontSize: 20, fontWeight: 700, color: '#fff' },
  userCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', margin: '12px 12px 8px', background: '#1e293b', borderRadius: 10 },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  userName: { color: '#f1f5f9', fontSize: 13, fontWeight: 600 },
  userEmail: { color: '#64748b', fontSize: 11 },
  nav: { flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#94a3b8', textDecoration: 'none', fontSize: 13, transition: 'all .15s' },
  navActive: { background: '#1d4ed8', color: '#fff' },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  navLabel: { flex: 1 },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10 },
  badgeNew: { background: '#ef4444', color: '#fff' },
  badgeAI: { background: '#7c3aed', color: '#fff' },
  logoutBtn: { margin: '0 12px', padding: '10px 12px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13, textAlign: 'left' },
};
