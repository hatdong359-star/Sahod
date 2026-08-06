export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0d9488" />
      {/* one source node fanning out to three recipients */}
      <circle cx="9" cy="16" r="2.6" fill="#fff" />
      <circle cx="23" cy="9" r="2.2" fill="#c6ebe3" />
      <circle cx="23" cy="16" r="2.2" fill="#f5765b" />
      <circle cx="23" cy="23" r="2.2" fill="#c6ebe3" />
      <path
        d="M11 15.2 21 9.6M11.4 16h9.2M11 16.8 21 22.4"
        stroke="#fff"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={size} />
      <span className="font-display text-[1.4rem] font-bold tracking-tight text-ink">sahod</span>
    </div>
  );
}
