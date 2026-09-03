import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RootsLoader from "../../components/RootsLoader";
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
const amberBg = "#FEF3C7";
const mintBorder = "#A8D4AA";
const mintBg = "#F0F7F0";

function StepCard({ stepLabel, title, body }) {
  return (
    <article
      style={{
        backgroundColor: "#FFFFFF",
        borderLeft: "4px solid #2D6A2F",
        borderRadius: "8px",
        padding: "24px",
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        borderTop: "1px solid #E8E8E8",
        borderRight: "1px solid #E8E8E8",
        borderBottom: "1px solid #E8E8E8",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          color: muted,
          fontFamily: dmSans,
          fontSize: "0.8rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {stepLabel}
      </p>
      <h3
        style={{
          margin: "0 0 12px",
          color: green,
          fontFamily: georgia,
          fontWeight: 700,
          fontSize: "1.15rem",
          lineHeight: 1.35,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: bodyDark,
          fontFamily: dmSans,
          fontSize: "0.95rem",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
    </article>
  );
}

function Collect() {
  const navigate = useNavigate();
  const [gapReview, setGapReview] = useState(null);
  const [prerequisiteGate, setPrerequisiteGate] = useState(null);
  const [tierGateMessage, setTierGateMessage] = useState("");
  const [tierPostMessage, setTierPostMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [gapError, setGapError] = useState("");

  const fetchGapReview = useCallback(async () => {
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
    try {
      const gapRes = await fetch(`${apiBaseUrl}/api/stage03/gap-review`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
          return;
        }
        setLoadError(parsed.message);
        return;
      }
      setGapReview(gapBody.gap_review ?? null);
    } catch (err) {
      setLoadError(err.message || "Could not load Stage 03 data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGapReview();
  }, [fetchGapReview]);

  async function getSessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function handleGapReview() {
    setGapError("");
    setTierPostMessage("");
    setGenerating(true);
    const token = await getSessionToken();
    if (!token) {
      setGapError("Your session has expired. Please sign in again.");
      setGenerating(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage03/gap-review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const parsed = parseStage03GateResponse(response, body);
        if (isPrerequisiteGateKind(parsed.kind)) {
          setPrerequisiteGate(parsed);
          return;
        }
        if (parsed.kind === "tier") {
          setTierPostMessage(parsed.message);
          return;
        }
        setGapError(parsed.message);
        return;
      }
      const gr = body?.gap_review;
      if (!gr) throw new Error("Invalid server response.");
      setGapReview(gr);
    } catch (err) {
      setGapError(err.message || "Could not generate gap review.");
    } finally {
      setGenerating(false);
    }
  }

  const funderRequirements = Array.isArray(gapReview?.funder_requirements)
    ? gapReview.funder_requirements
    : Array.isArray(gapReview?.funder_metrics)
      ? gapReview.funder_metrics.map((m) => {
          const name = m.metric_name || "Metric";
          const desc = m.metric_description
            ? `${name}: ${m.metric_description}`
            : name;
          return desc;
        })
      : [];
  const communityPriorities = Array.isArray(gapReview?.community_priorities)
    ? gapReview.community_priorities
    : [];
  const showGapResults = Boolean(gapReview);
  const showGenerateBlock = !gapReview;

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

  if (generating) {
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
        <section
          style={{
            width: "100%",
            maxWidth: "680px",
            textAlign: "center",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            backgroundColor: "#FAF9F7",
            padding: "32px 28px",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: "0 0 20px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.65rem",
            }}
          >
            Reviewing your collection needs...
          </h1>
          <RootsLoader />
        </section>
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
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: "0 0 16px",
            color: green,
            fontFamily: georgia,
            fontWeight: 700,
            fontSize: "1.85rem",
            lineHeight: 1.25,
          }}
        >
          Stage 03: Collect
        </h1>
        {tierGateMessage ? (
          <Stage03TierUpgradePrompt
            message={tierGateMessage}
            style={{ margin: "0 auto 24px", maxWidth: "600px", textAlign: "left" }}
          />
        ) : null}
        <p
          style={{
            margin: "0 auto 32px",
            maxWidth: "600px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          Now that you have heard from your funder and your community, it is
          time to build your data collection tools. Start by reviewing what
          needs to be measured.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <StepCard
            stepLabel="Step 1"
            title="Review your collection gaps"
            body="Claude will compare your funder requirements and community priorities to identify what data you need to collect and what tools will serve you best."
          />
          <StepCard
            stepLabel="Step 2"
            title="Build your collection tools"
            body="Use Rootwork's survey builder to create your data collection instruments. You will add and refine questions in the builder."
          />
          <StepCard
            stepLabel="Step 3"
            title="Launch when ready"
            body="When your instruments are ready, participants and staff can complete them with clear expectations you define in the tool settings."
          />
        </div>

        {showGenerateBlock ? (
          <div
            style={{
              marginBottom: "36px",
              padding: "0 8px",
            }}
          >
            <p
              style={{
                margin: "0 0 18px",
                color: bodyDark,
                fontFamily: dmSans,
                fontSize: "0.98rem",
                lineHeight: 1.6,
              }}
            >
              Claude will review your funder metrics, community priorities, and
              program design to identify what you need to collect and how.
            </p>
            {tierPostMessage ? (
              <Stage03TierUpgradePrompt message={tierPostMessage} />
            ) : null}
            {gapError ? (
              <p
                style={{
                  margin: "0 0 12px",
                  color: "#B91C1C",
                  fontFamily: dmSans,
                  fontSize: "0.9rem",
                }}
              >
                {gapError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleGapReview}
              style={{
                cursor: "pointer",
                padding: "12px 28px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: green,
                color: "#FFFFFF",
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Review collection gaps
            </button>
          </div>
        ) : null}

        {showGapResults ? (
          <div style={{ textAlign: "left" }}>
            <section
              style={{
                backgroundColor: amberBg,
                border: `1px solid ${amberBorder}`,
                borderRadius: "8px",
                padding: "20px",
                marginBottom: "20px",
                boxSizing: "border-box",
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
                What your funder requires you to measure
              </h2>
              {funderRequirements.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.92rem",
                  }}
                >
                  No funder measurement lines were returned. Add funder metrics in
                  Stage 02, then run this review again if needed.
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
                  {funderRequirements.map((line, i) => {
                    const colon = line.indexOf(":");
                    const hasSplit =
                      colon > 0 && colon < line.length - 1;
                    return (
                      <li key={`f-${i}`} style={{ marginBottom: "12px" }}>
                        {hasSplit ? (
                          <>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                              }}
                            >
                              {line.slice(0, colon).trim()}
                            </div>
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "0.85rem",
                                color: muted,
                                lineHeight: 1.45,
                              }}
                            >
                              {line.slice(colon + 1).trim()}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                            {line}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              style={{
                backgroundColor: mintBg,
                border: `1px solid ${mintBorder}`,
                borderRadius: "8px",
                padding: "20px",
                marginBottom: "24px",
                boxSizing: "border-box",
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
                What your community said matters
              </h2>
              {communityPriorities.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.92rem",
                  }}
                >
                  No community priority bullets were returned. Check your
                  engagement notes in Stage 02 and try again if needed.
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
                  {communityPriorities.map((p, i) => (
                    <li key={`c-${i}`} style={{ marginBottom: "8px" }}>
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={() => navigate("/stage03/gaps")}
                style={{
                  cursor: "pointer",
                  padding: "12px 28px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: green,
                  color: "#FFFFFF",
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                See gaps and recommendations
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default Collect;
