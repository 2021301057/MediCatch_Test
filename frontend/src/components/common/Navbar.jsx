import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import CodefSyncModal from '../CodefSyncModal';

const NAV_ITEMS = [
  { path: '/',                 label: '대시보드',      end: true },
  { path: '/pre-treatment',    label: '진료 전 검색',   badge: 'dot' },
  { path: '/checkup',          label: '건강 검진 기록' },
  { path: '/insurance',        label: '내 보험 조회' },
  { path: '/medical-records',  label: '진료 기록 & 청구', count: 2 },
  { path: '/insurance-plan',   label: '보험 추천 & 공백' },
  { path: '/health-report',    label: '건강 통합 리포트' },
];

const Icon = ({ children, size = 13 }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: size, height: size, flexShrink: 0 }}>
    {children}
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [hasHealthData, setHasHealthData] = useState(() => (
    localStorage.getItem('healthDataLoaded') === 'true'
  ));

  const shouldShowSyncGuide = !hasHealthData;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSyncSuccess = () => {
    localStorage.setItem('healthDataLoaded', 'true');
    setHasHealthData(true);
  };

  return (
    <>
    <nav className="mc-navbar">
      <div className="mc-navbar-inner">
        {/* 로고 */}
        <NavLink to="/" className="mc-nav-logo">
          <div className="mc-nav-logo-dot">
            <svg viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="mc-nav-logo-text">MediCatch</span>
        </NavLink>

        {/* 네비게이션 링크 */}
        <div className="mc-nav-links">
          {NAV_ITEMS.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.end}
              className={({ isActive }) => 'mc-nav-link' + (isActive ? ' active' : '')}
            >
              {n.label}
              {n.count && <span className="mc-nav-link-badge">{n.count}</span>}
              {n.badge === 'dot' && !n.count && <span className="mc-nav-link-dot" />}
            </NavLink>
          ))}
        </div>

        {/* 우측 액션 */}
        <div className="mc-nav-right">
          <div className="mc-sync-cta-wrap">
            {shouldShowSyncGuide && (
              <div className="mc-sync-guide-bubble">
                건강정보를 보려면 데이터를 불러오세요 :)
              </div>
            )}
            <button className="mc-btn mc-sync-cta" onClick={() => setShowSyncModal(true)} title="내 건강 데이터 불러오기">
              내 건강 불러오기
            </button>
          </div>
          <button className="mc-btn mc-btn-icon-only" title="알림">
            <Icon size={13}>
              <path d="M8 2a4 4 0 0 1 4 4v3l1.5 2h-11L4 9V6a4 4 0 0 1 4-4z"/>
              <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0"/>
            </Icon>
          </button>
          <button className="mc-nav-avatar" onClick={handleLogout} title={user?.name ? `${user.name} · 로그아웃` : '로그아웃'}>
            {user?.name?.[0] || '김'}
          </button>
        </div>
      </div>
    </nav>

    {showSyncModal && (
      <CodefSyncModal
        userId={user?.userId}
        onClose={() => setShowSyncModal(false)}
        onSuccess={handleSyncSuccess}
      />
    )}
    </>
  );
}
