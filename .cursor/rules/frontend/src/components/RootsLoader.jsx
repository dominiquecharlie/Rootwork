export default function RootsLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <style>{`
        @keyframes grow1 { from { stroke-dashoffset: 120px; } to { stroke-dashoffset: 0px; } }
        @keyframes grow2 { from { stroke-dashoffset: 110px; } to { stroke-dashoffset: 0px; } }
        @keyframes grow3 { from { stroke-dashoffset: 130px; } to { stroke-dashoffset: 0px; } }
        @keyframes grow4 { from { stroke-dashoffset: 100px; } to { stroke-dashoffset: 0px; } }
        @keyframes grow5 { from { stroke-dashoffset: 115px; } to { stroke-dashoffset: 0px; } }
        @keyframes grow6 { from { stroke-dashoffset: 105px; } to { stroke-dashoffset: 0px; } }
        @keyframes sway {
          0% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
          100% { transform: rotate(-4deg); }
        }
        .r1 { stroke-dasharray: 120px; stroke-dashoffset: 120px; animation: grow1 1.2s ease-out 0s infinite alternate; }
        .r2 { stroke-dasharray: 110px; stroke-dashoffset: 110px; animation: grow2 1.2s ease-out 0.2s infinite alternate; }
        .r3 { stroke-dasharray: 130px; stroke-dashoffset: 130px; animation: grow3 1.2s ease-out 0.4s infinite alternate; }
        .r4 { stroke-dasharray: 100px; stroke-dashoffset: 100px; animation: grow4 1.2s ease-out 0.6s infinite alternate; }
        .r5 { stroke-dasharray: 115px; stroke-dashoffset: 115px; animation: grow5 1.2s ease-out 0.8s infinite alternate; }
        .r6 { stroke-dasharray: 105px; stroke-dashoffset: 105px; animation: grow6 1.2s ease-out 1.0s infinite alternate; }
        .seedling { transform-origin: 150px 98px; animation: sway 2.5s ease-in-out infinite; }
      `}</style>
      <svg width="300" height="200" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="100" width="300" height="100" fill="rgba(139,105,20,0.12)" />
        <line x1="0" y1="100" x2="300" y2="100" stroke="#7A6A45" strokeWidth="1.5" />
        <path className="r1" d="M150,100 C136,122 118,148 92,182" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <path className="r2" d="M150,100 C158,118 172,142 188,172" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <path className="r3" d="M150,100 C148,128 142,156 128,190" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <path className="r4" d="M150,100 C154,112 168,128 198,152" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <path className="r5" d="M150,100 C140,108 124,124 108,156" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <path className="r6" d="M150,100 C162,108 182,124 212,158" fill="none" stroke="#2D6A2F" strokeWidth="2" strokeLinecap="round" />
        <g className="seedling">
          <line x1="150" y1="98" x2="150" y2="72" stroke="#2D6A2F" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="141" cy="65" rx="10" ry="5.5" fill="#2D6A2F" transform="rotate(-36,141,65)" />
          <ellipse cx="159" cy="65" rx="10" ry="5.5" fill="#2D6A2F" transform="rotate(36,159,65)" />
        </g>
      </svg>
    </div>
  );
}