export default function RootsLoader() {
  return (
    <>
      <style>{`
        @keyframes rl-canopy-sway {
          from { transform: rotate(-3deg); }
          to { transform: rotate(3deg); }
        }
        @keyframes rl-root-grow {
          from { stroke-dashoffset: 120; }
          to { stroke-dashoffset: 0; }
        }
        .rl-canopy {
          transform-box: fill-box;
          transform-origin: 150px 180px;
          animation: rl-canopy-sway 3s ease-in-out infinite alternate;
        }
        .rl-root {
          fill: none;
          stroke: #2D6A2F;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: rl-root-grow 1.5s ease-in-out infinite alternate;
        }
        .rl-root-1 { animation-delay: 0s; }
        .rl-root-2 { animation-delay: 0.25s; }
        .rl-root-3 { animation-delay: 0.5s; }
        .rl-root-4 { animation-delay: 0.75s; }
        .rl-root-5 { animation-delay: 1s; }
        .rl-root-6 { animation-delay: 1.25s; }
      `}</style>
      <svg
        width={300}
        height={260}
        viewBox="0 0 300 260"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        style={{ display: "block", margin: "0 auto", borderRadius: "8px" }}
      >
        <rect x={0} y={0} width={300} height={180} fill="#FAF9F7" />
        <rect
          x={0}
          y={180}
          width={300}
          height={80}
          fill="rgba(139,105,20,0.10)"
        />
        <line
          x1={0}
          y1={180}
          x2={300}
          y2={180}
          stroke="#7A6A45"
          strokeWidth={1.5}
        />

        <path
          className="rl-root rl-root-1"
          d="M150,180 C135,200 115,220 88,248"
        />
        <path
          className="rl-root rl-root-2"
          d="M150,180 C160,195 175,215 195,242"
        />
        <path
          className="rl-root rl-root-3"
          d="M150,180 C148,205 140,228 125,255"
        />
        <path
          className="rl-root rl-root-4"
          d="M150,180 C155,198 168,215 200,238"
        />
        <path
          className="rl-root rl-root-5"
          d="M150,180 C138,195 120,210 100,235"
        />
        <path
          className="rl-root rl-root-6"
          d="M150,180 C163,195 183,210 215,238"
        />

        <path
          d="M140,180 L160,180 L154,110 L146,110 Z"
          fill="#5C3D1E"
        />

        <path
          d="M150,110 C128,95 102,78 78,58"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path
          d="M150,110 C172,95 198,78 222,58"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path
          d="M128,92 C115,82 100,70 92,58"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d="M118,82 C105,72 95,62 88,52"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d="M172,92 C185,82 200,70 208,58"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d="M182,82 C195,72 205,62 212,52"
          fill="none"
          stroke="#5C3D1E"
          strokeWidth={3}
          strokeLinecap="round"
        />

        <g className="rl-canopy">
          <circle cx={150} cy={75} r={38} fill="#2D6A2F" />
          <circle cx={118} cy={88} r={28} fill="#3A7A3A" />
          <circle cx={182} cy={88} r={28} fill="#3A7A3A" />
        </g>
      </svg>
    </>
  );
}
