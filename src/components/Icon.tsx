import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  anchor: "M12 3v15M8 6h8M5 13H2c0 5 4 8 10 8s10-3 10-8h-3M8 18l4 3 4-3",
  book: "M12 5c-3-2-7-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-1-10 1Zm0 0v15",
  words: "M4 4h16v16H4zM8 9h8M8 13h6M8 17h3",
  quests: "M7 5h14M7 12h14M7 19h14M2 5h1M2 12h1M2 19h1",
  map: "m2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3Zm7-3v17m6-14v17",
  fish: "M4 12c5-10 13-9 18 0-5 9-13 10-18 0Zm0 0L1 7v10Zm12-2h.01",
  moon: "M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z",
  sun: "M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  sound: "M11 4 5 9H2v6h3l6 5Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  mute: "M11 4 5 9H2v6h3l6 5Zm5 5 6 6m0-6-6 6",
  pause: "M8 4v16M16 4v16",
  play: "m7 3 14 9-14 9Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  close: "m5 5 14 14M5 19 19 5",
  compass: "m15 9-2 4-4 2 2-4ZM22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  eye: "M1 12c6-10 16-10 22 0-6 10-16 10-22 0Zm15 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  check: "m4 12 5 5L20 6",
  help: "M9 8c0-4 7-4 7 0 0 3-4 3-4 6m0 4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  lock: "M6 11V7a6 6 0 0 1 12 0v4M4 11h16v11H4zM12 15v3",
  sail: "M12 2v17M10 4 2 16h8Zm4 2 8 10h-8ZM2 19h20l-4 3H6Z",
  bell: "M4 17h16l-2-4V8a6 6 0 0 0-12 0v5Zm6 3h4",
  leaf: "M3 21C22 19 23 3 22 2 7 0 1 8 3 21Zm1-1L17 7",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.compass} />
    </svg>
  );
}
export function PepePortrait({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      className="pepe-portrait"
      viewBox="0 0 160 180"
      role="img"
      aria-label="A green Pepe worker with heavy-lidded eyes, wide red-brown lips, yellow oilskins and an IMD apron"
    >
      <path fill="#233b30" d="M0 0h160v180H0z" />
      <path fill="#b9a252" d="M21 180v-38q8-37 58-38t60 38v38" />
      <path fill="#c2aa55" d="M29 83Q19 11 80 8q62 4 57 75Z" />
      <ellipse
        cx="80"
        cy="83"
        rx="54"
        ry="49"
        fill={variant === 4 ? "#698373" : "#718a49"}
      />
      <path fill="#577238" d="M27 68q7 51 58 48t47-54q15 64-49 66T27 68" />
      <ellipse cx="55" cy="62" rx="23" ry="22" fill="#bec59e" />
      <ellipse cx="104" cy="63" rx="23" ry="22" fill="#bec59e" />
      <ellipse cx="61" cy="69" rx="7" ry="12" fill="#16251e" />
      <ellipse cx="98" cy="69" rx="7" ry="12" fill="#16251e" />
      <path
        d="M31 59q22-17 47 1M81 60q22-16 48 3"
        fill="#718a49"
        stroke="#365331"
        strokeWidth="3"
      />
      <path
        d="M37 97q46 21 85-2-36 38-80 14Z"
        fill="#8e5144"
        stroke="#573c31"
        strokeWidth="3"
      />
      <path
        d="M43 102q41 16 73-1"
        fill="none"
        stroke="#402e28"
        strokeWidth="3"
      />
      <path fill="#344239" d="m48 129 10 11h43l9-11 12 51H36Z" />
      <text
        x="80"
        y="163"
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontSize="18"
        fill="#c7c1a7"
      >
        IMD
      </text>
      <path d="M39 126 46 158M119 126l-5 32" stroke="#e1c870" strokeWidth="5" />
      {variant === 4 && (
        <path d="M80 132v20m-6-14h12" stroke="#a8ab8e" strokeWidth="3" />
      )}
    </svg>
  );
}
