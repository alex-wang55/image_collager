import { useId } from "react";
import { cx } from "./ui";

/** Two prints, one on top of the other. Same drawing as the app icon (see public/icons). */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  // useId can contain characters that break url(#...) references
  const id = "lm" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sky = `${id}-sky`;
  const sea = `${id}-sea`;
  const sky2 = `${id}-sky2`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={cx("shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9824f" />
          <stop offset="1" stopColor="#f6cf86" />
        </linearGradient>
        <linearGradient id={sea} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c6a78" />
          <stop offset="1" stopColor="#22414b" />
        </linearGradient>
        <linearGradient id={sky2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9cbd6" />
          <stop offset="1" stopColor="#dfe9e4" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="#d4452a" />
      <g transform="translate(-14 -14)">
        <g transform="rotate(-9 256 256)">
          <rect x="112" y="118" width="214" height="252" rx="10" fill="#f3e4d4" />
          <rect x="128" y="134" width="182" height="182" rx="4" fill={`url(#${sky2})`} />
          <path d="M128 262 Q170 236 214 254 T310 246 V316 H128 Z" fill="#6f9a7f" />
        </g>
        <g transform="rotate(7 256 256)">
          <rect x="186" y="146" width="214" height="252" rx="10" fill="#fffdf9" />
          <rect x="202" y="162" width="182" height="182" rx="4" fill={`url(#${sky})`} />
          <circle cx="293" cy="272" r="34" fill="#fff1d2" />
          <rect x="202" y="272" width="182" height="72" fill={`url(#${sea})`} />
          <rect x="248" y="128" width="92" height="32" fill="#ecdcb6" opacity="0.92" transform="rotate(-5 294 144)" />
        </g>
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark size={30} />
      <span className="font-hand text-[30px] font-bold leading-none tracking-tight">shoebox</span>
    </span>
  );
}
