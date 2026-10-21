import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMore = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
);
export const IconCamera = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .8-.4l1-1.3a1 1 0 0 1 .8-.4h3.4a1 1 0 0 1 .8.4l1 1.3a1 1 0 0 0 .8.4h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </svg>
);
export const IconPhotos = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5.5" width="14" height="14" rx="2.5" />
    <path d="M7 3.5h10.5a3 3 0 0 1 3 3V17" />
    <path d="M3.5 16l3.6-3.6a1.5 1.5 0 0 1 2.1 0L14 17" />
    <circle cx="12.8" cy="10" r="1.3" />
  </svg>
);
export const IconInvite = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3 20a6.5 6.5 0 0 1 13 0" />
    <path d="M19 8v6M16 11h6" />
  </svg>
);
export const IconShare = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3.5v11" />
    <path d="M8 7l4-3.5L16 7" />
    <path d="M7.5 10.5H6.5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </svg>
);
export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6" />
    <path d="M6 7l.8 11.2A2 2 0 0 0 8.8 20h6.4a2 2 0 0 0 2-1.8L18 7" />
    <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
  </svg>
);
export const IconPen = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);
export const IconStar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3.8l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z" />
  </svg>
);
export const IconGrid = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);
export const IconCollage = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="9" height="11" rx="1" transform="rotate(-6 8 10.5)" />
    <rect x="11" y="7.5" width="9.5" height="11.5" rx="1" transform="rotate(5 15.75 13.25)" />
  </svg>
);
export const IconShuffle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M16.5 4.5L20 8l-3.5 3.5" />
    <path d="M4 8h3.5c3 0 4 8 7 8H20" />
    <path d="M16.5 12.5L20 16l-3.5 3.5" />
    <path d="M4 16h3.5c1.3 0 2.2-1.4 3-3M20 8h-5.5c-1.3 0-2.2 1.4-3 3" />
  </svg>
);
export const IconLink = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4L11.5 6" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1.3-1.2" />
  </svg>
);
export const IconLeave = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </svg>
);
export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
    <path d="M5 19.5h14" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconRefresh = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </svg>
);
export const IconImage = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 16l4.6-4.6a1.5 1.5 0 0 1 2.1 0L16 17.2" />
    <path d="M14 15l1.6-1.6a1.5 1.5 0 0 1 2.1 0l2.8 2.8" />
    <circle cx="15.5" cy="9" r="1.5" />
  </svg>
);
