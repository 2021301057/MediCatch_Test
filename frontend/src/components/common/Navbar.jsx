import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import CodefSyncModal from '../CodefSyncModal';
import ProfileAvatar from './ProfileAvatar';

const NAV_ITEMS = [
  { path: '/',                 label: '대시보드',      end: true },
  { path: '/pre-treatment',    label: '진료 전 검색' },
  { path: '/checkup',          label: '건강 검진 기록' },
  { path: '/insurance',        label: '내 보험 조회' },
  { path: '/medical-records',  label: '진료 기록' },
  { path: '/insurance-plan',   label: '보험 공백' },
  { path: '/health-report',    label: '건강 통합 리포트' },
];

const DEFAULT_AVATAR = { key: 'bot' };
const loadAvatar = () => {
  try {
    return JSON.parse(localStorage.getItem('medicatchAvatar') || 'null') || DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
};

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatar, setAvatar] = useState(loadAvatar);
  const userMenuRef = useRef(null);
  const [hasHealthData, setHasHealthData] = useState(() => (
    localStorage.getItem('healthDataLoaded') === 'true'
  ));

  const shouldShowSyncGuide = !hasHealthData && !user?.codefConnectionCount;
  const displayId = user?.codefId || localStorage.getItem('codefId') || user?.email || localStorage.getItem('email') || '로그인 사용자';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const syncAvatar = (event) => setAvatar(event.detail || loadAvatar());
    window.addEventListener('medicatch-avatar-change', syncAvatar);
    window.addEventListener('storage', syncAvatar);
    return () => {
      window.removeEventListener('medicatch-avatar-change', syncAvatar);
      window.removeEventListener('storage', syncAvatar);
    };
  }, []);

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
          <div className="mc-user-menu-wrap" ref={userMenuRef}>
            <button
              className="mc-nav-avatar mc-profile-nav-avatar"
              onClick={() => setShowUserMenu((v) => !v)}
              title={user?.name ? `${user.name} 메뉴` : '사용자 메뉴'}
              aria-expanded={showUserMenu}
            >
              <ProfileAvatar type={avatar.key} size={30} />
            </button>
            {showUserMenu && (
              <div className="mc-user-menu">
                <button
                  className="mc-user-menu-id"
                  onClick={() => { setShowUserMenu(false); navigate('/account'); }}
                  type="button"
                >
                  {displayId}
                </button>
                <button className="mc-user-menu-logout" onClick={handleLogout}>로그아웃</button>
              </div>
            )}
          </div>
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
