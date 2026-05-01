import { useCallback, useId, useState } from "react";

const TYPE_KEYS = [
  "community_member",
  "partner_org",
  "government_agency",
  "funder",
  "other",
];

export function normalizeStakeholderType(raw) {
  const s = String(raw || "").toLowerCase();
  for (const key of TYPE_KEYS) {
    if (s.includes(key)) return key;
  }
  return "other";
}

export function humanizeTypeKey(key) {
  const k = normalizeStakeholderType(key);
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function CrowIllustration() {
  return (
    <svg
      width={100}
      height={80}
      viewBox="0 0 100 80"
      aria-hidden
      style={{ display: "block", margin: "0 auto 12px" }}
    >
      <polygon points="72,38 94,28 90,44 78,48" fill="#1C1C1C" />
      <polygon points="74,46 96,48 88,58 78,54" fill="#1C1C1C" />
      <polygon points="76,54 94,62 84,66 74,60" fill="#1C1C1C" />
      <ellipse cx={52} cy={46} rx={28} ry={20} fill="#1C1C1C" />
      <path
        d="M 34 52 Q 40 36 50 32 Q 58 30 64 40 Q 56 54 42 56 Q 36 56 34 52 Z"
        fill="#111111"
      />
      <circle cx={26} cy={38} r={15} fill="#1C1C1C" />
      <polygon points="4,38 20,30 20,46" fill="#374151" />
      <circle cx={18} cy={34} r={4.2} fill="#FFFFFF" />
      <circle cx={19.2} cy={33.5} r={1.6} fill="#0a0a0a" />
      <path
        d="M 42 64 L 40 76 M 38 76 L 42 78.5 L 46 76 M 54 64 L 56 76 M 54 76 L 58 78.5 L 62 76"
        stroke="#374151"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function WiltingPlantIllustration() {
  return (
    <svg
      width={100}
      height={80}
      viewBox="0 0 100 80"
      aria-hidden
      style={{ display: "block", margin: "0 auto 12px" }}
    >
      <path
        d="M 8 62 Q 50 58 92 62 L 92 68 Q 50 64 8 68 Z"
        fill="rgba(139,105,20,0.14)"
        stroke="#A8D4AA"
        strokeWidth={1}
      />
      <path
        d="M 48 68 Q 46 52 52 40 Q 58 28 68 22 Q 74 18 78 20"
        fill="none"
        stroke="#2D6A2F"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M 52 50 Q 44 46 36 50"
        fill="none"
        stroke="#2D6A2F"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <ellipse cx={34} cy={52} rx={10} ry={5} fill="#9CBD9E" transform="rotate(-28 34 52)" />
      <ellipse cx={58} cy={44} rx={11} ry={5.5} fill="#A8D4AA" transform="rotate(42 58 44)" />
      <ellipse cx={44} cy={58} rx={9} ry={4.5} fill="#A8D4AA" transform="rotate(-8 44 58)" />
      <ellipse cx={62} cy={32} rx={8} ry={5} fill="#86a878" transform="rotate(55 62 32)" />
      <path
        d="M 76 22 Q 82 26 80 32 Q 76 36 72 34 Q 70 28 76 22"
        fill="#C4D9C4"
        stroke="#2D6A2F"
        strokeWidth={1.2}
      />
      <ellipse cx={78} cy={26} rx={4} ry={6} fill="#A8D4AA" transform="rotate(70 78 26)" />
    </svg>
  );
}

function SeedPacketIllustration() {
  return (
    <svg
      width={100}
      height={80}
      viewBox="0 0 100 80"
      aria-hidden
      style={{ display: "block", margin: "0 auto 12px" }}
    >
      <ellipse cx={50} cy={48} rx={34} ry={26} fill="rgba(45,106,47,0.08)" />
      <path
        d="M 28 26 L 50 14 L 72 26 L 72 30 L 28 30 Z"
        fill="#FFFFFF"
        stroke="#2D6A2F"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect
        x={26}
        y={28}
        width={48}
        height={42}
        rx={8}
        fill="#FFFFFF"
        stroke="#2D6A2F"
        strokeWidth={1.5}
      />
      <rect x={26} y={28} width={48} height={16} rx={8} fill="#2D6A2F" />
      <rect x={26} y={38} width={48} height={8} fill="#245c27" />
      <line x1={30} y1={54} x2={30} y2={64} stroke="#A8D4AA" strokeWidth={1} />
      <line x1={70} y1={54} x2={70} y2={64} stroke="#A8D4AA" strokeWidth={1} />
      <ellipse cx={36} cy={58} rx={4} ry={7} fill="#A8D4AA" />
      <ellipse cx={44} cy={60} rx={3.5} ry={6} fill="#C4D9C4" />
      <ellipse cx={52} cy={59} rx={4} ry={7} fill="#A8D4AA" />
      <ellipse cx={60} cy={58} rx={3.5} ry={6.5} fill="#86c88a" />
      <ellipse cx={50} cy={62} rx={3} ry={5} fill="#A8D4AA" />
      <text
        x={50}
        y={39}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={7}
        fontFamily="Arial, sans-serif"
        fontWeight={700}
        letterSpacing={0.5}
      >
        SEEDS
      </text>
    </svg>
  );
}

function missingEntryLabel(entry) {
  return String(entry ?? "").trim();
}

function truncateForButton(text, maxLen) {
  const t = String(text).trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

const dmSans = '"DM Sans", system-ui, sans-serif';

/**
 * @param {object} props
 * @param {{ power_gaps?: string[], missing_stakeholder_types?: string[], questions_to_consider?: string[] }} props.gapAnalysis
 * @param {object[]} props.stakeholders
 * @param {(missingLabel: string) => void} props.onMissingTypeClick
 * @param {() => void} props.onAddMoreStakeholders
 * @param {() => void} props.onContinueToProgramDesign
 */
export default function StakeholderGarden({
  gapAnalysis = {
    power_gaps: [],
    missing_stakeholder_types: [],
    questions_to_consider: [],
  },
  stakeholders = [],
  onMissingTypeClick,
  onAddMoreStakeholders,
  onContinueToProgramDesign,
}) {
  const baseId = useId();
  const powerGaps = Array.isArray(gapAnalysis?.power_gaps)
    ? gapAnalysis.power_gaps
    : [];
  const missingTypes = Array.isArray(gapAnalysis?.missing_stakeholder_types)
    ? gapAnalysis.missing_stakeholder_types
    : [];
  const questions = Array.isArray(gapAnalysis?.questions_to_consider)
    ? gapAnalysis.questions_to_consider
    : [];

  const [acknowledgedGaps, setAcknowledgedGaps] = useState(() => ({}));

  const toggleGap = useCallback((index) => {
    setAcknowledgedGaps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const mappedCount = stakeholders.length;

  return (
    <div className="sg-eco-root" style={{ width: "100%" }}>
      <style>{`
        .sg-eco-columns {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
          max-width: 1000px;
          margin: 0 auto;
          align-items: stretch;
        }
        @media (max-width: 767px) {
          .sg-eco-columns {
            grid-template-columns: 1fr;
          }
        }
        .sg-eco-scroll {
          max-height: min(70vh, 520px);
          overflow-y: auto;
          padding-top: 4px;
        }
      `}</style>

      <div className="sg-eco-columns">
        {/* Column 1: Power gaps */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            border: "1px solid #FDE68A",
          }}
        >
          <div
            style={{
              backgroundColor: "#FEF3C7",
              borderBottom: "2px solid #F59E0B",
              padding: "16px 14px 18px",
              textAlign: "center",
            }}
          >
            <CrowIllustration />
            <h2
              style={{
                margin: "0 0 6px",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#92400E",
                lineHeight: 1.25,
              }}
            >
              {"What's eating your garden"}
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: dmSans,
                fontSize: "13px",
                color: "#B45309",
                lineHeight: 1.4,
              }}
            >
              Power gaps Claude noticed
            </p>
          </div>
          <div className="sg-eco-scroll" style={{ padding: "14px 12px 16px" }}>
            {powerGaps.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontFamily: dmSans,
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                No power gaps were returned for this map.
              </p>
            ) : (
              powerGaps.map((text, i) => (
                <div
                  key={`gap-${i}`}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #FDE68A",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: "#F59E0B",
                      marginTop: "4px",
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontFamily: dmSans,
                      fontSize: "14px",
                      color: "#2C2C2C",
                      lineHeight: 1.5,
                    }}
                  >
                    {String(text)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Missing */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            border: "1px solid #A8D4AA",
          }}
        >
          <div
            style={{
              backgroundColor: "#F0F7F0",
              borderBottom: "2px solid #A8D4AA",
              padding: "16px 14px 18px",
              textAlign: "center",
            }}
          >
            <WiltingPlantIllustration />
            <h2
              style={{
                margin: "0 0 6px",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#2D6A2F",
                lineHeight: 1.25,
              }}
            >
              {"What's wilting"}
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: dmSans,
                fontSize: "13px",
                color: "#4A8C63",
                lineHeight: 1.4,
              }}
            >
              Stakeholder types not yet in your map
            </p>
          </div>
          <div className="sg-eco-scroll" style={{ padding: "14px 12px 16px" }}>
            {missingTypes.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontFamily: dmSans,
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                No missing types were flagged.
              </p>
            ) : (
              missingTypes.map((entry, i) => {
                const label = missingEntryLabel(entry);
                return (
                  <div
                    key={`miss-${i}-${label.slice(0, 48)}-${i}`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #A8D4AA",
                      borderRadius: "8px",
                      padding: "16px",
                      marginBottom: "10px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontFamily: dmSans,
                        fontWeight: 700,
                        fontSize: "14px",
                        color: "#2D6A2F",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontFamily: dmSans,
                        fontSize: "12px",
                        color: "#6B7280",
                        lineHeight: 1.45,
                      }}
                    >
                      Not yet represented in your stakeholder map
                    </p>
                    <button
                      type="button"
                      onClick={() => onMissingTypeClick?.(label)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #2D6A2F",
                        backgroundColor: "#FFFFFF",
                        color: "#2D6A2F",
                        fontFamily: dmSans,
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Add this stakeholder
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Questions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            border: "1px solid #86EFAC",
          }}
        >
          <div
            style={{
              backgroundColor: "#F0FDF4",
              borderBottom: "2px solid #86EFAC",
              padding: "16px 14px 18px",
              textAlign: "center",
            }}
          >
            <SeedPacketIllustration />
            <h2
              style={{
                margin: "0 0 6px",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.05rem",
                color: "#166534",
                lineHeight: 1.25,
              }}
            >
              Seeds waiting to be planted
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: dmSans,
                fontSize: "13px",
                color: "#16a34a",
                lineHeight: 1.4,
              }}
            >
              Questions to sit with before moving on
            </p>
          </div>
          <div className="sg-eco-scroll" style={{ padding: "14px 12px 16px" }}>
            {questions.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontFamily: dmSans,
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                No questions were returned.
              </p>
            ) : (
              questions.map((q, i) => (
                <div
                  key={`q-${i}`}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #86EFAC",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "10px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "Georgia, serif",
                      fontStyle: "italic",
                      fontSize: "13px",
                      color: "#2C2C2C",
                      lineHeight: 1.55,
                    }}
                  >
                    {String(q)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Before you move on */}
      <div
        style={{
          marginTop: "32px",
          maxWidth: "1000px",
          marginLeft: "auto",
          marginRight: "auto",
          backgroundColor: "#F0F7F0",
          border: "1px solid #A8D4AA",
          borderRadius: "12px",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "#2D6A2F",
          }}
        >
          Before you move on
        </h3>
        <p
          style={{
            margin: "0 0 18px",
            fontFamily: dmSans,
            fontSize: "14px",
            color: "#6B7280",
            lineHeight: 1.5,
          }}
        >
          {
            "You don't need to resolve every gap right now. But name what you see."
          }
          {mappedCount > 0 ? (
            <>
              {" "}
              Your map includes {mappedCount} stakeholder
              {mappedCount === 1 ? "" : "s"}.
            </>
          ) : null}
        </p>

        {powerGaps.length > 0 ? (
          <div style={{ marginBottom: "20px" }}>
            <p
              style={{
                margin: "0 0 10px",
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "13px",
                color: "#2D6A2F",
              }}
            >
              Acknowledge what you noticed
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "0",
                listStyle: "none",
              }}
            >
              {powerGaps.map((text, i) => {
                const id = `${baseId}-gap-${i}`;
                return (
                  <li
                    key={`ack-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={Boolean(acknowledgedGaps[i])}
                      onChange={() => toggleGap(i)}
                      style={{ marginTop: "4px", flexShrink: 0 }}
                    />
                    <label
                      htmlFor={id}
                      style={{
                        fontFamily: dmSans,
                        fontSize: "14px",
                        color: "#2C2C2C",
                        lineHeight: 1.5,
                        cursor: "pointer",
                      }}
                    >
                      {String(text)}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {missingTypes.length > 0 ? (
          <div style={{ marginBottom: "22px" }}>
            <p
              style={{
                margin: "0 0 10px",
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "13px",
                color: "#2D6A2F",
              }}
            >
              Quick add
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {missingTypes.map((entry, i) => {
                const full = missingEntryLabel(entry);
                const short = truncateForButton(full, 36);
                return (
                  <button
                    key={`quick-${i}-${full.slice(0, 40)}`}
                    type="button"
                    title={full}
                    onClick={() => onMissingTypeClick?.(full)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #2D6A2F",
                      backgroundColor: "#FFFFFF",
                      color: "#2D6A2F",
                      fontFamily: dmSans,
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Add {short}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => onAddMoreStakeholders?.()}
            style={{
              flex: "1 1 200px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "2px solid #2D6A2F",
              backgroundColor: "#FFFFFF",
              color: "#2D6A2F",
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Add more stakeholders
          </button>
          <button
            type="button"
            onClick={() => onContinueToProgramDesign?.()}
            style={{
              flex: "1 1 200px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2D6A2F",
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Continue to program design
          </button>
        </div>
      </div>
    </div>
  );
}
