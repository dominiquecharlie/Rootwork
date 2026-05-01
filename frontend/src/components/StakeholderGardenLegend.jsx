import { humanizeTypeKey } from "./StakeholderGarden";

export default function StakeholderGardenLegend() {
  const mini = { display: "flex", alignItems: "center", gap: "8px" };
  const lab = {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: "0.8rem",
    color: "#2C2C2C",
  };
  return (
    <div
      style={{
        marginTop: "16px",
        padding: "14px 16px",
        border: "1px solid #A8D4AA",
        borderRadius: "10px",
        backgroundColor: "#FFFFFF",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          color: "#2D6A2F",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: "1rem",
        }}
      >
        Legend
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "14px",
        }}
      >
        <div style={mini}>
          <svg width={28} height={56} aria-hidden>
            <line
              x1={14}
              y1={52}
              x2={14}
              y2={8}
              stroke="#2D6A2F"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={14} cy={8} r={6} fill="#2D6A2F" />
          </svg>
          <span style={lab}>Decision maker (taller stem)</span>
        </div>
        <div style={mini}>
          <svg width={28} height={56} aria-hidden>
            <line
              x1={14}
              y1={52}
              x2={14}
              y2={28}
              stroke="#2D6A2F"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle cx={14} cy={22} r={6} fill="#2D6A2F" />
          </svg>
          <span style={lab}>Affected by decisions (shorter stem)</span>
        </div>
      </div>
      <p
        style={{
          margin: "0 0 8px",
          color: "#2D6A2F",
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontWeight: 600,
          fontSize: "0.82rem",
        }}
      >
        Stakeholder type shapes
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "10px",
        }}
      >
        <div style={mini}>
          <svg width={32} height={28} aria-hidden>
            <circle cx={16} cy={14} r={10} fill="#2D6A2F" />
          </svg>
          <span style={lab}>{humanizeTypeKey("community_member")}</span>
        </div>
        <div style={mini}>
          <svg width={36} height={24} aria-hidden>
            <rect x={4} y={2} width={28} height={20} rx={4} fill="#4A8C63" />
          </svg>
          <span style={lab}>{humanizeTypeKey("partner_org")}</span>
        </div>
        <div style={mini}>
          <svg width={32} height={32} aria-hidden>
            <polygon points="16,4 26,16 16,28 6,16" fill="#1B3A2D" />
          </svg>
          <span style={lab}>{humanizeTypeKey("government_agency")}</span>
        </div>
        <div style={mini}>
          <svg width={32} height={32} aria-hidden>
            <polygon
              points="16,2 19,12 30,12 21,18 24,29 16,23 8,29 11,18 2,12 13,12"
              fill="#2D6A2F"
            />
          </svg>
          <span style={lab}>{humanizeTypeKey("funder")}</span>
        </div>
        <div style={mini}>
          <svg width={32} height={28} aria-hidden>
            <circle
              cx={16}
              cy={14}
              r={10}
              fill="#A8D4AA"
              stroke="#2D6A2F"
              strokeWidth={2}
            />
          </svg>
          <span style={lab}>{humanizeTypeKey("other")}</span>
        </div>
      </div>
    </div>
  );
}
