/** Minimal professional stroke icon set (feather-style), inline SVG only. */

const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-1.5 4L16 12H5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  award: <><circle cx="12" cy="9" r="5.5" /><path d="m8.5 13.5-1.8 7 5.3-3 5.3 3-1.8-7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c1.2-3.8 4-5.7 7.5-5.7s6.3 1.9 7.5 5.7" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.8 20c1-3.2 3.3-4.9 6.2-4.9s5.2 1.7 6.2 4.9" /><path d="M16 5.6a3.4 3.4 0 0 1 0 6.3" /><path d="M18.1 15.6c1.7.8 2.7 2.3 3.1 4.4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6v.2" /></>,
  bell: <><path d="M6 9.5a6 6 0 0 1 12 0c0 4.4 1.5 5.9 2 6.5H4c.5-.6 2-2.1 2-6.5Z" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></>,
  shield: <><path d="M12 3 5 5.8v5.4c0 4.4 3 7.9 7 9.8 4-1.9 7-5.4 7-9.8V5.8Z" /><path d="m9 11.5 2.2 2.2L15.4 9.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2.8 12h3M18.2 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20.5 20.5-4.9-4.9" /></>,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7 5.3-5.8" /></>,
  camera: <><path d="M4 8.5h3l1.7-2.5h6.6L17 8.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.4" /></>,
  'refresh-cw': <><path d="M20.5 11a8.5 8.5 0 0 0-14.9-4.5L3 9" /><path d="M3 4v5h5" /><path d="M3.5 13a8.5 8.5 0 0 0 14.9 4.5L21 15" /><path d="M21 20v-5h-5" /></>,
  copy: <><rect x="9" y="9" width="11.5" height="11.5" rx="2" /><path d="M5.5 14.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8A1.5 1.5 0 0 1 14.5 5v.5" /></>,
  list: <><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  star: <><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  'alert-triangle': <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.2" /><path d="M12 17.1v.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.4 2" /></>,
  'map-pin': <><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  droplet: <><path d="M12 3.5S5.8 10 5.8 14.2a6.2 6.2 0 0 0 12.4 0C18.2 10 12 3.5 12 3.5Z" /></>,
  zap: <><path d="M13 2.5 4.5 13.5H11L9.8 21.5 19.5 10H13l1-7.5Z" /></>,
  road: <><path d="M4 21 9 3M20 21 15 3" /><path d="M12 5v2.5M12 11v2.5M12 17v2.5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7 7.5 20.5h9L17.5 7" /><path d="M10 11v5.5M14 11v5.5" /></>,
  'file-text': <><path d="M6 3.5h8L19 8.5v12H6v-17Z" /><path d="M14 3.5v5h5" /><path d="M9 12.5h6M9 16h6" /></>,
  'arrow-right': <><path d="M4 12h16" /><path d="m13.5 5.5 6.5 6.5-6.5 6.5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></>,
  download: <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M4 20.5h16" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  play: <><polygon points="5 3 19 12 5 21 5 3" /></>,
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const paths = PATHS[name] ?? PATHS.info;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}
