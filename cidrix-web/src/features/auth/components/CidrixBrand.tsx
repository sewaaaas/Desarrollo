export function CidrixBrand() {
  return (
    <div
      aria-label="CIDRIX"
      className="flex items-center justify-center gap-2.5"
      role="img"
    >
      <svg
        aria-hidden="true"
        className="h-11 w-10 shrink-0"
        viewBox="0 0 40 44"
      >
        <defs>
          <linearGradient id="cidrix-brand-gradient" x1="4" x2="34" y1="5" y2="36">
            <stop offset="0" stopColor="#2fa4ee" />
            <stop offset="0.58" stopColor="#1475e6" />
            <stop offset="1" stopColor="#105dcc" />
          </linearGradient>
        </defs>
        <path
          d="M21 2.5 36 11v5.7l-8.2 4.7v-5.6L21 12l-8.5 4.8v10L21 31.5l6.8-3.8 8.2 4.7v5.5L21 46.5 4 36.9V7.9L21 2.5Z"
          fill="url(#cidrix-brand-gradient)"
          transform="scale(.84 .84) translate(2 1)"
        />
        <path
          d="m27.8 15.8 8.2-4.7-15-8.6-6.3 3.6Z"
          fill="#45b5f0"
          opacity=".9"
          transform="scale(.84 .84) translate(2 1)"
        />
      </svg>
      <span className="text-[1.35rem] font-bold tracking-[0.09em] text-[#111936]">
        CIDRIX
      </span>
    </div>
  )
}
