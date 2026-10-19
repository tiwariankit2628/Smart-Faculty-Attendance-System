import React from 'react';

export function CampusIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyGrad" x1="140" y1="0" x2="140" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1EDFF" stopOpacity="0.8" />
          <stop stopColor="#EAF3FF" stopOpacity="0.4" />
          <stop stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="buildingGrad" x1="150" y1="50" x2="150" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E0D7FF" />
          <stop stopColor="#F4F1FF" />
        </linearGradient>
        <linearGradient id="roofGrad" x1="150" y1="20" x2="150" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7865FF" />
          <stop stopColor="#5938F5" />
        </linearGradient>
        <linearGradient id="towerGrad" x1="180" y1="30" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D9CEFD" />
          <stop stopColor="#EFEAFF" />
        </linearGradient>
        <linearGradient id="treeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#34D399" />
          <stop stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Soft background clouds */}
      <circle cx="210" cy="40" r="30" fill="url(#skyGrad)" opacity="0.6" />
      <circle cx="240" cy="50" r="22" fill="url(#skyGrad)" opacity="0.5" />
      <circle cx="160" cy="45" r="25" fill="url(#skyGrad)" opacity="0.4" />

      {/* Main Classical Academic Wing (Left) */}
      <rect x="80" y="85" width="90" height="95" rx="6" fill="url(#buildingGrad)" opacity="0.85" />
      {/* Windows row 1 */}
      <rect x="92" y="96" width="12" height="18" rx="4" fill="#5938F5" opacity="0.25" />
      <rect x="112" y="96" width="12" height="18" rx="4" fill="#5938F5" opacity="0.25" />
      <rect x="132" y="96" width="12" height="18" rx="4" fill="#5938F5" opacity="0.25" />
      <rect x="152" y="96" width="12" height="18" rx="4" fill="#5938F5" opacity="0.25" />
      {/* Windows row 2 */}
      <rect x="92" y="124" width="12" height="18" rx="4" fill="#5938F5" opacity="0.2" />
      <rect x="112" y="124" width="12" height="18" rx="4" fill="#5938F5" opacity="0.2" />
      <rect x="132" y="124" width="12" height="18" rx="4" fill="#5938F5" opacity="0.2" />
      <rect x="152" y="124" width="12" height="18" rx="4" fill="#5938F5" opacity="0.2" />

      {/* Roof cornice */}
      <rect x="76" y="80" width="98" height="6" rx="2" fill="#7865FF" opacity="0.5" />

      {/* Clocktower Centerpiece */}
      <rect x="175" y="48" width="55" height="135" rx="4" fill="url(#towerGrad)" />
      {/* Clocktower Pediment / Pyramid Roof */}
      <polygon points="202.5,12 170,48 235,48" fill="url(#roofGrad)" opacity="0.9" />
      {/* Small Finial / Spire */}
      <rect x="201" y="2" width="3" height="11" rx="1.5" fill="#5938F5" />
      <circle cx="202.5" cy="2" r="2.5" fill="#7865FF" />

      {/* Clock Face */}
      <circle cx="202.5" cy="72" r="13" fill="#FFFFFF" stroke="#7865FF" strokeWidth="2.5" />
      <circle cx="202.5" cy="72" r="2" fill="#5938F5" />
      <line x1="202.5" y1="72" x2="202.5" y2="64" stroke="#5938F5" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="202.5" y1="72" x2="208" y2="72" stroke="#5938F5" strokeWidth="1.8" strokeLinecap="round" />

      {/* Archway Windows on Tower */}
      <rect x="186" y="100" width="12" height="24" rx="6" fill="#5938F5" opacity="0.3" />
      <rect x="207" y="100" width="12" height="24" rx="6" fill="#5938F5" opacity="0.3" />

      {/* Grand Arch Entrance on Ground Level */}
      <path d="M190 180 V152 C190 145 195 140 202.5 140 C210 140 215 145 215 152 V180 Z" fill="#5938F5" opacity="0.75" />
      <circle cx="202.5" cy="148" r="4" fill="#FFFFFF" opacity="0.8" />

      {/* Right Wing */}
      <rect x="230" y="95" width="45" height="85" rx="4" fill="url(#buildingGrad)" opacity="0.8" />
      <rect x="238" y="108" width="10" height="16" rx="3" fill="#5938F5" opacity="0.2" />
      <rect x="254" y="108" width="10" height="16" rx="3" fill="#5938F5" opacity="0.2" />
      <rect x="238" y="134" width="10" height="16" rx="3" fill="#5938F5" opacity="0.18" />
      <rect x="254" y="134" width="10" height="16" rx="3" fill="#5938F5" opacity="0.18" />

      {/* Lush Campus Greenery / Trees in foreground */}
      <ellipse cx="60" cy="172" rx="28" ry="24" fill="url(#treeGrad)" opacity="0.75" />
      <ellipse cx="78" cy="165" rx="20" ry="18" fill="#10B981" opacity="0.8" />
      <ellipse cx="168" cy="175" rx="18" ry="16" fill="url(#treeGrad)" opacity="0.85" />
      <ellipse cx="255" cy="174" rx="22" ry="18" fill="url(#treeGrad)" opacity="0.8" />
      <ellipse cx="270" cy="170" rx="16" ry="14" fill="#34D399" opacity="0.9" />

      {/* Soft ground line with gradient */}
      <rect x="0" y="180" width="280" height="20" fill="url(#skyGrad)" opacity="0.5" />
    </svg>
  );
}
