import React from 'react';

const COLORS = {
  medi: ['#E0F2FE', '#38BDF8', '#0284C7'],
  shield: ['#DBEAFE', '#60A5FA', '#2563EB'],
  leaf: ['#D1FAE5', '#34D399', '#0F766E'],
  pill: ['#FFE4E6', '#FB7185', '#BE123C'],
  sparkle: ['#FEF3C7', '#FBBF24', '#B45309'],
  bot: ['#EEF2FF', '#A5B4FC', '#4F46E5'],
};

function Face({ color = '#2563EB', y = 34, smile = true }) {
  return (
    <>
      <circle cx="25" cy={y} r="2.1" fill={color} />
      <circle cx="39" cy={y} r="2.1" fill={color} />
      {smile ? (
        <path d={`M28 ${y + 8} Q32 ${y + 11} 36 ${y + 8}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.72" />
      ) : (
        <circle cx="32" cy={y + 8} r="1.7" fill={color} opacity="0.62" />
      )}
    </>
  );
}

export default function ProfileAvatar({ type = 'medi', size = 34, className = '' }) {
  const [bg1, bg2, ink] = COLORS[type] || COLORS.medi;
  const gid = `avatar-grad-${type}`;

  return (
    <svg className={`mc-profile-svg-avatar ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="9" y1="7" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill={`url(#${gid})`} />

      {type === 'medi' && (
        <>
          <rect x="19" y="21" width="26" height="26" rx="7" fill="#FFFFFF" />
          <rect x="29" y="14" width="6" height="13" rx="3" fill="#FFFFFF" />
          <rect x="25" y="18" width="14" height="6" rx="3" fill="#FFFFFF" />
          <path d="M32 25 V34M27.5 29.5H36.5" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          <Face color={ink} y={37} />
        </>
      )}

      {type === 'shield' && (
        <>
          <path d="M32 14 L47 20 V32 C47 42 40 49 32 52 C24 49 17 42 17 32 V20 Z" fill="#FFFFFF" />
          <path d="M32 20 V43" stroke={ink} strokeWidth="2.4" strokeLinecap="round" opacity="0.18" />
          <Face color={ink} y={31} />
          <path d="M27 43 H37" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity="0.28" />
        </>
      )}

      {type === 'leaf' && (
        <>
          <path d="M32 16 C22 18 17 26 18 37 C19 47 27 52 32 52 C37 52 45 47 46 37 C47 26 42 18 32 16Z" fill="#FFFFFF" />
          <path d="M32 17 C31 28 31 39 32 50" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity="0.18" />
          <path d="M32 18 C24 21 21 27 22 33" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity="0.18" />
          <Face color={ink} y={34} />
        </>
      )}

      {type === 'pill' && (
        <>
          <g transform="rotate(-18 32 34)">
            <rect x="17" y="22" width="30" height="24" rx="12" fill="#FFFFFF" />
            <path d="M32 22 V46" stroke={ink} strokeWidth="2" opacity="0.16" />
          </g>
          <Face color={ink} y={34} smile={false} />
          <path d="M48 18 L50 23 L55 25 L50 27 L48 32 L46 27 L41 25 L46 23Z" fill="#FFFFFF" opacity="0.9" />
        </>
      )}

      {type === 'sparkle' && (
        <>
          <circle cx="32" cy="36" r="17" fill="#FFFFFF" />
          <path d="M32 12 L35 21 L44 24 L35 27 L32 36 L29 27 L20 24 L29 21Z" fill="#FFFFFF" opacity="0.95" />
          <path d="M49 35 L51 39 L55 41 L51 43 L49 47 L47 43 L43 41 L47 39Z" fill="#FFFFFF" opacity="0.88" />
          <Face color={ink} y={35} />
        </>
      )}

      {type === 'bot' && (
        <>
          <rect x="18" y="23" width="28" height="24" rx="10" fill="#FFFFFF" />
          <path d="M32 16 V23" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="14" r="4" fill="#FFFFFF" />
          <rect x="24" y="31" width="5" height="5" rx="2.5" fill={ink} />
          <rect x="35" y="31" width="5" height="5" rx="2.5" fill={ink} />
          <path d="M28 41 H36" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          <path d="M16 34 H11M48 34 H53" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
