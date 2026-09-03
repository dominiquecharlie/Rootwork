import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
const mintBorder = "#A8D4AA";

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

const STAFF_ENTRY_WHO = new Set(["staff_members", "both", "other"]);

function toolAllowsStaffEntry(tool) {
  if (!tool || !tool.launched_at) return false;
  const cfg =
    tool.configuration && typeof tool.configuration === "object"
      ? tool.configuration
      : {};
  const who =
    typeof cfg.who_completes === "string"
      ? cfg.who_completes.trim().toLowerCase()
      : "";
  return STAFF_ENTRY_WHO.has(who);
}

function Tools() {
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [gapReview, setGapReview] = useState(null);
  const [prerequisiteGate, setPrerequisiteGate] = useState(null);
  const [gapTierMessage, setGapTierMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoadError("");
    setPrerequisiteGate(null);
    setGapTierMessage("");
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
    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [toolsRes, gapRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/stage03/tools`, { headers }),
        fetch(`${apiBaseUrl}/api/stage03/gap-review`, { headers }),
      ]);
      const toolsBody = await toolsRes.json().catch(() => ({}));
      const gapBody = await gapRes.json().catch(() => ({}));

      if (!toolsRes.ok) {
        const parsed = parseStage03GateResponse(toolsRes, toolsBody);
        if (isPrerequisiteGateKind(parsed.kind)) {
          setPrerequisiteGate(parsed);
          return;
        }
        setLoadError(parsed.message);
        return;
      }

      if (!gapRes.ok) {
        const parsed = parseStage03GateResponse(gapRes, gapBody);
        if (isPrerequisiteGateKind(parsed.kind)) {
          setPrerequisiteGate(parsed);
          return;
        }
        if (parsed.kind === "tier") {
          setGapTierMessage(parsed.message);
          setGapReview(null);
        } else {
          setLoadError(parsed.message);
          return;
        }
      } else {
        setGapReview(gapBody.gap_review ?? null);
      }

      setTools(Array.isArray(toolsBody?.tools) ? toolsBody.tools : []);
    } catch (err) {
      setLoadError(err.message || "Could not load Stage 03 data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recommendedTools = Array.isArray(gapReview?.recommended_tools)
    ? gapReview.recommended_tools
    : [];
  const hasLiveTool = tools.some((t) => Boolean(t.launched_at));

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
        <h1
          style={{
            margin: "0 0 24px",
            color: green,
            fontFamily: georgia,
            fontWeight: 700,
            fontSize: "1.85rem",
            lineHeight: 1.25,
            textAlign: "center",
          }}
        >
          Your collection tools
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          {tools.map((tool) => {
            const tType = (tool.tool_type || "survey").toLowerCase();
            const badge = toolTypeBadgeStyle(tType);
            const isLive = Boolean(tool.launched_at);
            return (
              <article
                key={tool.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E8E8E8",
                  borderRadius: "8px",
                  padding: "16px 18px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      color: bodyDark,
                      fontFamily: georgia,
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      flex: "1 1 200px",
                    }}
                  >
                    {tool.tool_name || "Untitled tool"}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
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
                    <span
                      style={{
                        fontFamily: dmSans,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: isLive ? green : muted,
                      }}
                    >
                      {isLive ? "Live" : "Draft"}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("tool_id", tool.id);
                      params.set(
                        "tool_name",
                        (tool.tool_name || "Collection tool").trim() ||
                          "Collection tool"
                      );
                      params.set("tool_type", tType);
                      navigate(`/stage03/builder?${params.toString()}`);
                    }}
                    style={{
                      cursor: "pointer",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      border: `2px solid ${green}`,
                      backgroundColor: "transparent",
                      color: green,
                      fontFamily: dmSans,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    Edit
                  </button>
                  {toolAllowsStaffEntry(tool) ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/stage03/tools/${encodeURIComponent(tool.id)}/entry`
                        )
                      }
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
                      Enter responses
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

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
          {gapTierMessage ? (
            <Stage03TierUpgradePrompt message={gapTierMessage} />
          ) : (
            <DraftLabel />
          )}
          {recommendedTools.length === 0 ? (
            <p
              style={{
                margin: 0,
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.92rem",
              }}
            >
              No tools were recommended in your gap review. Use Build another
              tool to start from scratch.
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
                    key={`rec-${tool.tool_name}-${idx}`}
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
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            marginTop: "8px",
          }}
        >
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
            Build another tool
          </button>
          <button
            type="button"
            disabled={!hasLiveTool}
            onClick={() => navigate("/stage04/analyze")}
            style={{
              cursor: hasLiveTool ? "pointer" : "not-allowed",
              padding: "12px 28px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
              opacity: hasLiveTool ? 1 : 0.55,
            }}
          >
            Continue to Stage 04
          </button>
        </div>
      </section>
    </main>
  );
}

export default Tools;
