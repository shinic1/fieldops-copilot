import type { ReactNode } from "react";

export type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "camera"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "command"
  | "globe"
  | "guard"
  | "location"
  | "mic"
  | "offline"
  | "play"
  | "radio"
  | "reset"
  | "route"
  | "shield"
  | "spark"
  | "tests"
  | "users"
  | "wifi";

const PATHS: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  alert: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v4m0 3.5h.01" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  camera: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m8 6 1.4-2h5.2L16 6" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  command: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h6m-6 4h10m-10 4h8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  guard: (
    <>
      <path d="M12 3 4.5 6v5c0 4.8 3.2 8.3 7.5 10 4.3-1.7 7.5-5.2 7.5-10V6L12 3Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  offline: (
    <>
      <path d="M2 8.5A15 15 0 0 1 5.2 6M8.5 4.2A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 4-2.2M13 9.3A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4 0a6 6 0 0 0 0-8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8m14.8 0a10.5 10.5 0 0 0 0-14.8" />
    </>
  ),
  reset: (
    <>
      <path d="M4 4v6h6" />
      <path d="M5.5 15a8 8 0 1 0 .5-7L4 10" />
    </>
  ),
  route: (
    <path d="M5 5h5a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11m-3-3 3 3-3 3M5 2v6" />
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5c0 4.8 3.2 8.3 7.5 10 4.3-1.7 7.5-5.2 7.5-10V6L12 3Z" />
      <path d="M12 8v4m0 4h.01" />
    </>
  ),
  spark: (
    <path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Zm7 14 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
  ),
  tests: (
    <>
      <path d="M9 3h6l1 3h3v15H5V6h3l1-3Z" />
      <path d="m8 13 2 2 5-5m-7 8h8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.8M17 15a5 5 0 0 1 3.5 4.8" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {PATHS[name]}
      </g>
    </svg>
  );
}
