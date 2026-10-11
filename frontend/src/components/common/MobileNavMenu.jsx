import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', label: '대시보드', icon: 'dashboard', end: true },
  { path: '/pre-treatment', label: '진료검색', icon: 'search' },
  { path: '/medical-records', label: '진료기록', icon: 'record' },
  { path: '/insurance', label: '보험조회', icon: 'insurance' },
  { path: '/insurance-plan', label: '보험공백', icon: 'shield' },
  { path: '/checkup', label: '검진기록', icon: 'checkup' },
  { path: '/health-report', label: '건강리포트', icon: 'report' },
  { path: '/health-report?mbti=1', label: '건강MBTI', icon: 'mbti', mbti: true },
];

const ICONS = {
  dashboard: (
    <>
      <path d="M4 5.5h5.5V11H4zM14.5 5.5H20V9h-5.5zM4 15h5.5v3.5H4zM14.5 13H20v5.5h-5.5z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.25" />
      <path d="m15 15 4 4" />
    </>
  ),
  record: (
    <>
      <path d="M6.5 4.5h11a1.8 1.8 0 0 1 1.8 1.8v12.2a1.8 1.8 0 0 1-1.8 1.8h-11a1.8 1.8 0 0 1-1.8-1.8V6.3a1.8 1.8 0 0 1 1.8-1.8Z" />
      <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
    </>
  ),
  insurance: (
    <>
      <path d="M5 6.5 12 4l7 2.5v5.3c0 4.1-2.8 7-7 8.2-4.2-1.2-7-4.1-7-8.2Z" />
      <path d="M9 12h6M12 9v6" />
    </>
  ),
  shield: (
    <>
      <path d="M6 5.5 12 3l6 2.5v5.1c0 4-2.4 6.8-6 8.4-3.6-1.6-6-4.4-6-8.4Z" />
      <path d="M9.3 12.3 11.2 14l3.7-4" />
    </>
  ),
  checkup: (
    <>
      <path d="M7 4.5h10a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
      <path d="M9 4v4M15 4v4M8 10h8M10 14h4" />
    </>
  ),
  report: (
    <>
      <path d="M5.5 19V5.5h13V19" />
      <path d="M8.5 16v-4M12 16V8M15.5 16v-6" />
    </>
  ),
  mbti: (
    <>
      <path d="M5.5 7.5h3v3h-3zM15.5 7.5h3v3h-3zM10.5 13.5h3v3h-3z" />
      <path d="M8.5 9h2.8M13.8 9h1.7M12 10.5v3" />
    </>
  ),
};

const MobileMenuIcon = ({ type }) => (
  <span className="mc-mobile-home-menu-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[type]}
    </svg>
  </span>
);

export default function MobileNavMenu() {
  const location = useLocation();
  const isMbtiOpen = location.pathname === '/health-report'
    && new URLSearchParams(location.search).get('mbti') === '1';

  return (
    <nav className="mc-mobile-home-menu" aria-label="주요 메뉴">
      {NAV_ITEMS.map((item) => {
        if (item.mbti) {
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mc-mobile-home-menu-item mc-mobile-home-menu-mbti${isMbtiOpen ? ' active' : ''}`}
            >
              <MobileMenuIcon type={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `mc-mobile-home-menu-item${isActive && !isMbtiOpen ? ' active' : ''}`}
          >
            <MobileMenuIcon type={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
