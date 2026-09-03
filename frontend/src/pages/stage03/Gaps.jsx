import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Stage03PrerequisiteGate from "../../components/Stage03PrerequisiteGate";
import Stage03TierUpgradePrompt from "../../components/Stage03TierUpgradePrompt";
import {
  isPrerequisiteGateKind,
  parseStage03GateResponse,
} from "../../lib/stage03GateResponse";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";
const amberBorder = "#F59E0B";
const amberBrown = "#92400E";
const mintBorder = "#A8D4AA";

const PAID_TIERS = new Set(["starter", "growth", "enterprise"]);

const upgradeButtonStyle = {
  cursor: "pointer",
  padding: "10px 18px",
  borderRadius: "8px",
  border: `2px solid ${amberBorder}`,
  backgroundColor: "transparent",
  color: amberBrown,
  fontFamily: dmSans,
  fontWeight: 600,
  fontSize: "0.88rem",
  lineHeight: 1.35,
  textAlign: "center",
};

function DraftLabel() {
  return (
    <span
      style={{
        display: "inline-block",
        marginBottom: "14px",
        padding: "6px 12px",
        borderRadius: "8px",
        backgroundColor: "#ECFDF3",
        color: "#166534",
        fontFamily: dmSans,
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      AI-recommended: you decide what to build
    </span>
  );
}

function toolTypeLabel(type) {
  const t = (type || "").toLowerCase().trim();
  const map = {
    survey: "Survey",
    interview: "Interview",
    observation: "Observation",
    administrative: "Administrative",
  };
  return map[t] || type || "Tool";
}

function toolTypeBadgeStyle(type) {
  const t = (type || "").toLowerCase().trim();
  if (t === "survey") {
    return { backgroundColor: "#DBEAFE", color: "#1D4ED8" };
  }
  if (t === "interview") {
    return { backgroundColor: "#EDE9FE", color: "#5B21B6" };
  }
  if (t === "observation") {
    return { backgroundColor: "#FEF3C7", color: "#B45309" };
  }
  if (t === "administrative") {
    return { backgroundColor: "#F3F4F6", color: "#4B5563" };
  }
  return { backgroundColor: "#F3F4F6", color: "#6B7280" };
}

function Gaps() {
  const navigate = useNavigate();
  const [gapReview, setGapReview] = useState(null);
  const [orgTier, setOrgTier] = useState("freemium");
  const [prerequisiteGate, setPrerequisiteGate] = useState(null);
  const [tierGateMessage, setTierGateMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPageData = useCallback(async () => {
    setLoadError("");
    setPrerequisiteGate(null);
    setTierGateMessage("");
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoadError("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const authHeaders = {
      Authorization: `Bearer ${session.access_token}`,
    };
    try {
      const [gapRes, meRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/stage03/gap-review`, { headers: authHeaders }),
        fetch(`${apiBaseUrl}/api/orgs/me`, { headers: authHeaders }),
      ]);
      const gapBody = await gapRes.json().catch(() => ({}));
      if (!gapRes.ok) {
        const parsed = parseStage03GateResponse(gapRes, gapBody);
        if (isPrerequisiteGateKind(parsed.kind)) {
          setPrerequisiteGate(parsed);
          return;
        }
        if (parsed.kind === "tier") {
          setTierGateMessage(parsed.message);
          setGapReview(null);
        } else {
          setLoadError(parsed.message);
          return;
        }
      } else {
        setGapReview(gapBody.gap_review ?? null);
      }
      const meBody = await meRes.json().catch(() => ({}));
      if (!meRes.ok) {
        const parsed = parseStage03GateResponse(meRes, meBody);
        setLoadError(parsed.message);
        return;
      }
      const rawTier =
        typeof meBody?.org?.tier === "string" ? meBody.org.tier.trim() : "";
      const tier = rawTier ? rawTier.toLowerCase() : "freemium";
      setOrgTier(tier);
    } catch (err) {
      setLoadError(err.message || "Could not load gap review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const isFreemium = !PAID_TIERS.has(orgTier);

  const coverageGaps =
    gapReview && Array.isArray(gapReview.coverage_gaps)
      ? gapReview.coverage_gaps
      : [];
  const recommendedTools =
    gapReview && Array.isArray(gapReview.recommended_tools)
      ? gapReview.recommended_tools
      : [];

  if (prerequisiteGate) {
    return (
      <Stage03PrerequisiteGate
        kind={prerequisiteGate.kind}
        message={prerequisiteGate.message}
      />
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <p style={{ margin: 0, color: muted, fontFamily: dmSans }}>Loading...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#B91C1C",
            fontFamily: dmSans,
            textAlign: "center",
            maxWidth: "480px",
          }}
        >
          {loadError}
        </p>
      </main>
    );
  }

  if (!gapReview && !tierGateMessage) {
    return <Navigate to="/stage03/collect" replace />;
  }

  const showFreemiumBanner = isFreemium || Boolean(tierGateMessage);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF9F7",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "720px",
          textAlign: "left",
        }}
      >
        {showFreemiumBanner ? (
          tierGateMessage ? (
            <Stage03TierUpgradePrompt message={tierGateMessage} />
          ) : (
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#FEF3C7",
              border: `1px solid ${amberBorder}`,
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                color: amberBrown,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.15rem",
                lineHeight: 1.3,
              }}
            >
              You are on the Freemium plan
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                color: amberBrown,
                fontFamily: dmSans,
                fontSize: "0.95rem",
                lineHeight: 1.55,
              }}
            >
              Viewing your recommended tools is free. Building and launching
              collection tools requires a Starter plan at $49/mo.
            </p>
            <button
              type="button"
              onClick={() => {}}
              style={upgradeButtonStyle}
            >
              Upgrade to Starter
            </button>
          </div>
          )
        ) : null}

        <h1
          style={{
            margin: "0 0 28px",
            color: green,
            fontFamily: georgia,
            fontWeight: 700,
            fontSize: "1.85rem",
            lineHeight: 1.25,
            textAlign: "center",
          }}
        >
          Gaps and recommended tools
        </h1>

        <section
          style={{
            backgroundColor: "#FFFFFF",
            borderLeft: `4px solid ${amberBorder}`,
            borderTop: "1px solid #E8E8E8",
            borderRight: "1px solid #E8E8E8",
            borderBottom: "1px solid #E8E8E8",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "20px",
            boxSizing: "border-box",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.15rem",
            }}
          >
            Coverage gaps
          </h2>
          {coverageGaps.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.92rem",
              }}
            >
              No additional coverage gaps were listed.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontFamily: dmSans,
                color: bodyDark,
                fontSize: "0.95rem",
                lineHeight: 1.55,
              }}
            >
              {coverageGaps.map((g, i) => (
                <li key={`g-${i}`} style={{ marginBottom: "8px" }}>
                  {g}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${mintBorder}`,
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "20px",
            boxSizing: "border-box",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.15rem",
            }}
          >
            Recommended collection tools
          </h2>
          <DraftLabel />
          {recommendedTools.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.92rem",
              }}
            >
              {isFreemium
                ? "No tools were recommended in this review."
                : "No tools were recommended. You can still build a custom tool below."}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {recommendedTools.map((tool, idx) => {
                const tType = (tool.tool_type || "survey").toLowerCase();
                const badge = toolTypeBadgeStyle(tType);
                return (
                  <article
                    key={`${tool.tool_name}-${idx}`}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      padding: "16px",
                      backgroundColor: "#FAF9F7",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          color: green,
                          fontFamily: georgia,
                          fontWeight: 700,
                          fontSize: "1.05rem",
                          flex: "1 1 160px",
                        }}
                      >
                        {tool.tool_name || "Tool"}
                      </h3>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontFamily: dmSans,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          ...badge,
                        }}
                      >
                        {toolTypeLabel(tType)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: "0 0 14px",
                        color: bodyDark,
                        fontFamily: dmSans,
                        fontSize: "0.92rem",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {tool.rationale || ""}
                    </p>
                    {isFreemium ? (
                      <button
                        type="button"
                        onClick={() => {}}
                        style={upgradeButtonStyle}
                      >
                        Upgrade to Starter to build this tool
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set(
                            "tool_name",
                            (tool.tool_name || "Collection tool").trim() ||
                              "Collection tool"
                          );
                          params.set("tool_type", tType);
                          if (tType === "survey") {
                            params.set("survey_purpose", "pre_intake");
                          }
                          navigate(`/stage03/builder?${params.toString()}`);
                        }}
                        style={{
                          cursor: "pointer",
                          padding: "10px 18px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: green,
                          color: "#FFFFFF",
                          fontFamily: dmSans,
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        Build this tool
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div style={{ textAlign: "center" }}>
          {isFreemium ? (
            <button
              type="button"
              onClick={() => {}}
              style={{ ...upgradeButtonStyle, padding: "12px 22px" }}
            >
              Upgrade to Starter to build this tool
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("tool_name", "Custom collection tool");
                params.set("tool_type", "survey");
                params.set("survey_purpose", "pre_intake");
                navigate(`/stage03/builder?${params.toString()}`);
              }}
              style={{
                cursor: "pointer",
                padding: "12px 22px",
                borderRadius: "8px",
                border: `2px solid ${green}`,
                backgroundColor: "transparent",
                color: green,
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Build a custom tool
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default Gaps;
