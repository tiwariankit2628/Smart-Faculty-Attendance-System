import React from 'react';

export function BotanicalIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="leafGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#10B981" stopOpacity="0.8" />
          <stop stopColor="#059669" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="leafGrad2" x1="1" y1="0" x2="0" y2="1">
          <stop stopColor="#34D399" stopOpacity="0.9" />
          <stop stopColor="#10B981" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Gentle curved twig */}
      <path
        d="M20 75 Q45 50 85 20"
        stroke="#059669"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Leaf 1 */}
      <path
        d="M40 55 C30 45 35 30 50 35 C55 45 50 55 40 55 Z"
        fill="url(#leafGrad1)"
      />

      {/* Leaf 2 */}
      <path
        d="M60 38 C55 24 70 15 78 26 C80 38 70 42 60 38 Z"
        fill="url(#leafGrad2)"
      />

      {/* Leaf 3 (Top bud) */}
      <path
        d="M85 20 C82 8 96 6 98 16 C96 24 88 24 85 20 Z"
        fill="url(#leafGrad1)"
      />

      {/* Soft accent dots */}
      <circle cx="28" cy="62" r="3" fill="#10B981" opacity="0.3" />
      <circle cx="52" cy="46" r="2.5" fill="#34D399" opacity="0.4" />
    </svg>
  );
}
