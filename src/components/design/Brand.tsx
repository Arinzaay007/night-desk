/** The Night Desk mark — crescent + ascending plan line. */
export function LogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="nd-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a2340" />
          <stop offset="1" stopColor="#070a13" />
        </linearGradient>
        <linearGradient id="nd-ember" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd4a5" />
          <stop offset="0.5" stopColor="#ff9d4d" />
          <stop offset="1" stopColor="#f9731a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#nd-bg)" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="17.25"
        stroke="#fff"
        strokeOpacity="0.13"
        strokeWidth="1.5"
      />
      <path
        d="M41.5 16.5a17 17 0 1 0 8 26.6A19 19 0 0 1 41.5 16.5Z"
        fill="url(#nd-ember)"
      />
      <path
        d="M14 43.5 24 33l7.5 7L46 24.5"
        stroke="#ffcf9d"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="24.5" r="5.2" fill="#070a13" stroke="#ffd4a5" strokeWidth="3.2" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <LogoMark size={compact ? 30 : 34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[16.5px] font-semibold tracking-[-0.032em] text-mist-50">
          Night Desk
        </span>
        {!compact && (
          <span className="num text-[8.5px] uppercase tracking-[0.32em] text-mist-500 mt-[3px]">
            plan · link · mirror
          </span>
        )}
      </span>
    </span>
  );
}
