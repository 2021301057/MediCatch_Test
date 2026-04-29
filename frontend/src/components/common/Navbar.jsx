import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const NAV_ITEMS = [
  { path: '/',                 label: '대시보드',      end: true },
  { path: '/pre-treatment',    label: '진료 전 검색',   badge: 'dot' },
  { path: '/checkup',          label: '건강 검진 기록' },
  { path: '/insurance',        label: '내 보험 조회' },
  { path: '/medical-records',  label: '진료 기록 & 청구', count: 2 },
  { path: '/insurance-plan',   label: '보험 추천 & 공백' },
  { path: '/health-report',    label: '건강 통합 리포트' },
  { path: '/chat',             label: '건강 AI 채팅' },
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
  const [spin, setSpin] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    if (syncing) return;
    setSpin(true);
    setSyncing(true);
    setTimeout(() => {
      setSpin(false);
      setSyncing(false);
    }, 900);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
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
          <span className="mc-sync-note">
            <span className="mc-sync-dot" />
            {syncing ? '동기화 중…' : '동기화 완료'}
          </span>
          <button className="mc-btn" onClick={handleSync} disabled={syncing} title="데이터 갱신">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                width: 12, height: 12, flexShrink: 0,
                transition: 'transform .8s',
                transform: spin ? 'rotate(360deg)' : 'none',
              }}>
              <path d="M2 8a6 6 0 1 1 1.5 4" />
              <path d="M2 12V8h4" />
            </svg>
            갱신
          </button>
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
  );
}
