import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RootsLoader from "../../components/RootsLoader";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";
const amberTop = "#F59E0B";
const lightGreenTop = "#A8D4AA";
const brownLabel = "#92400E";

function DraftLabel() {
  return (
    <span
      style={{
        display: "inline-block",
        marginBottom: "16px",
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
      AI-surfaced: your judgment determines what happens next
    </span>
  );
}

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseDecisionsToForm(decisions, tensionCount) {
  const n = Math.max(0, tensionCount);
  const empty = {
    generalNotes: "",
    perTension: Array.from({ length: n }, () => ""),
  };
  if (!decisions || (Array.isArray(decisions) && decisions.length === 0)) {
    return empty;
  }
  if (typeof decisions !== "object" || Array.isArray(decisions)) {
    return empty;
  }
  const gn =
    typeof decisions.general_notes === "string"
      ? decisions.general_notes
      : "";
  const raw = decisions.responses ?? decisions.per_tension_responses;
  let arr = [];
  if (Array.isArray(raw)) {
    arr = raw.map((x) => (typeof x === "string" ? x : String(x ?? "")));
  } else if (raw && typeof raw === "object") {
    arr = Object.keys(raw)
      .filter((k) => /^\d+$/.test(String(k)))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => {
        const v = raw[k];
        return typeof v === "string" ? v : String(v ?? "");
      });
  }
  const perTension = Array.from({ length: n }, (_, i) =>
    typeof arr[i] === "string" ? arr[i] : ""
  );
  return { generalNotes: gn, perTension };
}

function savedResponseAt(decisions, index, tensionCount) {
  return parseDecisionsToForm(decisions, tensionCount).perTension[index] ?? "";
}

function cardShell(borderTopColor) {
  return {
    flex: "1 1 280px",
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
    borderTop: `4px solid ${borderTopColor}`,
    padding: "20px",
    boxSizing: "border-box",
    textAlign: "left",
  };
}

function Reconcile() {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [surfaceError, setSurfaceError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [perTensionResponses, setPerTensionResponses] = useState([]);

  const fetchContext = useCallback(async (opts = {}) => {
    const { quiet } = opts;
    if (!quiet) {
      setLoadError("");
      setLoadingContext(true);
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoadError("Your session has expired. Please sign in again.");
      if (!quiet) setLoadingContext(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage02b/context`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not load reconciliation context."
        );
      }
      setContext(body);
    } catch (err) {
      if (!quiet) {
        setLoadError(err.message || "Could not load reconciliation context.");
      }
    } finally {
      if (!quiet) setLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const reconciliation = context?.reconciliation;
  const tensions = useMemo(
    () =>
      Array.isArray(reconciliation?.tensions) ? reconciliation.tensions : [],
    [reconciliation]
  );
  const isComplete = Boolean(reconciliation?.reconciliation_completed_at);

  useEffect(() => {
    const d = reconciliation?.decisions;
    const { generalNotes, perTension } = parseDecisionsToForm(
      d,
      tensions.length
    );
    setGeneralNotes(generalNotes);
    setPerTensionResponses(perTension);
  }, [reconciliation?.id, tensions.length, reconciliation?.decisions]);

  const showSurfaceCTA = !isComplete && tensions.length === 0;
  const showTensionWork = !isComplete && tensions.length > 0;
  const showCompleted = isComplete && tensions.length > 0;

  async function getSessionToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function handleSurfaceTensions() {
    setSurfaceError("");
    setGenerating(true);
    const token = await getSessionToken();
    if (!token) {
      setSurfaceError("Your session has expired. Please sign in again.");
      setGenerating(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02b/surface-tensions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not surface tensions."
        );
      }
      const rec = body?.reconciliation;
      if (!rec) throw new Error("Invalid server response.");
      setContext((prev) => ({
        ...prev,
        reconciliation: rec,
      }));
    } catch (err) {
      setSurfaceError(err.message || "Could not surface tensions.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    setSaveError("");
    setSaving(true);
    const token = await getSessionToken();
    if (!token) {
      setSaveError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02b/save-responses`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            general_notes: generalNotes,
            responses: perTensionResponses,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not save draft."
        );
      }
      if (body?.success) {
        await fetchContext({ quiet: true });
      }
    } catch (err) {
      setSaveError(err.message || "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaveError("");
    setSaving(true);
    const token = await getSessionToken();
    if (!token) {
      setSaveError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02b/complete-reconciliation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            general_notes: generalNotes,
            responses: perTensionResponses,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not complete reconciliation."
        );
      }
      if (!body?.success) {
        throw new Error("Could not complete reconciliation.");
      }
      navigate("/stage03/collect");
    } catch (err) {
      setSaveError(err.message || "Could not complete reconciliation.");
    } finally {
      setSaving(false);
    }
  }

  function setResponseAt(index, value) {
    setPerTensionResponses((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  if (loadingContext && !context) {
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

  const metrics = context?.funder_metrics || [];
  const engagement = context?.engagement;
  const voiceQuotes = context?.voice_records || [];
  const design = context?.program_design?.program_model?.stage01_intake || {};

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
            Looking for tensions...
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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          boxSizing: "border-box",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: "36px" }}>
          <h1
            style={{
              margin: "0 0 14px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "2rem",
              lineHeight: 1.2,
            }}
          >
            Reconcile what you learned
          </h1>
          <p
            style={{
              margin: "0 auto",
              maxWidth: "640px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "1rem",
              lineHeight: 1.6,
            }}
          >
            You have heard from your funder and from your community. Now look
            at both together alongside your original program design. Name the
            tensions. Decide how you will respond.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "36px",
          }}
        >
          <section style={cardShell(amberTop)}>
            <h2
              style={{
                margin: "0 0 14px",
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              Your funder requires
            </h2>
            {metrics.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: muted,
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  lineHeight: 1.55,
                }}
              >
                No funder metrics on file. You can add them in Stage 02.
              </p>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  color: bodyDark,
                  fontFamily: dmSans,
                }}
              >
                {metrics.map((m) => (
                  <li key={m.id} style={{ marginBottom: "12px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {m.metric_name || "Metric"}
                    </div>
                    {m.metric_description ? (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "0.82rem",
                          color: muted,
                          lineHeight: 1.45,
                        }}
                      >
                        {m.metric_description}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={cardShell(green)}>
            <h2
              style={{
                margin: "0 0 14px",
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              Your community said
            </h2>
            {!engagement ? (
              <p
                style={{
                  margin: 0,
                  color: muted,
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  lineHeight: 1.55,
                }}
              >
                No community engagement documented yet.
              </p>
            ) : (
              <>
                <p
                  style={{
                    margin: "0 0 12px",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  {engagement.title || "Recent engagement"}
                </p>
                <p
                  style={{
                    margin: "0 0 8px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  Community members wanted
                </p>
                <p
                  style={{
                    margin: "0 0 14px",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {asText(engagement.community_members_wanted) ||
                    "Not recorded."}
                </p>
                <p
                  style={{
                    margin: "0 0 8px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  Priorities named
                </p>
                <p
                  style={{
                    margin: "0 0 16px",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {asText(engagement.priorities_named) || "Not recorded."}
                </p>
                {voiceQuotes.length > 0 ? (
                  <div>
                    {voiceQuotes.map((v) => (
                      <blockquote
                        key={v.id}
                        style={{
                          margin: "0 0 12px",
                          padding: "0 0 0 12px",
                          borderLeft: "3px solid #A8D4AA",
                          color: green,
                          fontFamily: georgia,
                          fontStyle: "italic",
                          fontSize: "0.95rem",
                          lineHeight: 1.55,
                        }}
                      >
                        {v.voice_content}
                      </blockquote>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section style={cardShell(lightGreenTop)}>
            <h2
              style={{
                margin: "0 0 14px",
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              Your original program design
            </h2>
            {!design.intended_change &&
            !design.immediate_outputs &&
            !design.change_level ? (
              <p
                style={{
                  margin: 0,
                  color: muted,
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  lineHeight: 1.55,
                }}
              >
                No program design on file yet.
              </p>
            ) : (
              <>
                <p
                  style={{
                    margin: "0 0 6px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Intended change
                </p>
                <p
                  style={{
                    margin: "0 0 14px",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {asText(design.intended_change) || "Not set."}
                </p>
                <p
                  style={{
                    margin: "0 0 6px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Immediate outputs
                </p>
                <p
                  style={{
                    margin: "0 0 14px",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {asText(design.immediate_outputs) || "Not set."}
                </p>
                <p
                  style={{
                    margin: "0 0 6px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Change level
                </p>
                <p
                  style={{
                    margin: 0,
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                  }}
                >
                  {asText(design.change_level) || "Not set."}
                </p>
              </>
            )}
          </section>
        </div>

        {showSurfaceCTA ? (
          <section
            style={{
              textAlign: "center",
              maxWidth: "560px",
              margin: "0 auto 40px",
              padding: "8px 12px",
            }}
          >
            <p
              style={{
                margin: "0 0 20px",
                color: bodyDark,
                fontFamily: dmSans,
                fontSize: "0.98rem",
                lineHeight: 1.6,
              }}
            >
              Claude will review your funder requirements, community voice,
              and program design together and surface where they are in tension.
            </p>
            {surfaceError ? (
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#B91C1C",
                  fontFamily: dmSans,
                  fontSize: "0.9rem",
                }}
              >
                {surfaceError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSurfaceTensions}
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
              Surface tensions
            </button>
          </section>
        ) : null}

        {showTensionWork || showCompleted ? (
          <section style={{ marginBottom: "32px" }}>
            {!showCompleted ? <DraftLabel /> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tensions.map((t, i) => {
                const area =
                  typeof t?.area === "string" && t.area.trim()
                    ? t.area.trim()
                    : `Tension ${i + 1}`;
                const observation =
                  typeof t?.observation === "string" ? t.observation : "";
                const question =
                  typeof t?.question === "string" ? t.question : "";
                return (
                  <article
                    key={`${area}-${i}`}
                    style={{
                      backgroundColor: "#FFFFFF",
                      padding: "20px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      borderLeft: `4px solid ${amberTop}`,
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: dmSans,
                        fontWeight: 700,
                        color: brownLabel,
                        fontSize: "0.95rem",
                        marginBottom: "8px",
                      }}
                    >
                      {area}
                    </div>
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontFamily: dmSans,
                        color: bodyDark,
                        fontSize: "0.95rem",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {observation}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: georgia,
                        fontStyle: "italic",
                        color: green,
                        fontSize: "1rem",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {question}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {showCompleted ? (
          <section
            style={{
              marginBottom: "28px",
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#ECFDF3",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              This reconciliation is complete.
            </p>
            <button
              type="button"
              onClick={() => navigate("/stage03/collect")}
              style={{
                marginTop: "14px",
                cursor: "pointer",
                padding: "10px 22px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: green,
                color: "#FFFFFF",
                fontFamily: dmSans,
                fontWeight: 600,
              }}
            >
              Continue to Stage 03
            </button>
          </section>
        ) : null}

        {showTensionWork ? (
          <section style={{ marginTop: "8px" }}>
            <h2
              style={{
                margin: "0 0 8px",
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.45rem",
              }}
            >
              How will you respond?
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.95rem",
                lineHeight: 1.55,
                maxWidth: "720px",
              }}
            >
              You do not need to resolve every tension. You need to name what you
              see and document how you will move forward.
            </p>

            {tensions.map((t, i) => {
              const area =
                typeof t?.area === "string" && t.area.trim()
                  ? t.area.trim()
                  : `Tension ${i + 1}`;
              return (
                <label
                  key={`resp-${area}-${i}`}
                  style={{
                    display: "block",
                    marginBottom: "20px",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color: green,
                      fontFamily: georgia,
                      fontWeight: 700,
                      fontSize: "0.95rem",
                    }}
                  >
                    Your response to: {area}
                  </span>
                  <textarea
                    value={perTensionResponses[i] ?? ""}
                    onChange={(e) => setResponseAt(i, e.target.value)}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #A8D4AA",
                      fontFamily: dmSans,
                      fontSize: "0.95rem",
                      color: bodyDark,
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </label>
              );
            })}

            <label style={{ display: "block", marginBottom: "24px" }}>
              <span
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: green,
                  fontFamily: georgia,
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                Anything else to document about this reconciliation?
              </span>
              <textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #A8D4AA",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  color: bodyDark,
                  backgroundColor: "#FFFFFF",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </label>

            {saveError ? (
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#B91C1C",
                  fontFamily: dmSans,
                  fontSize: "0.9rem",
                }}
              >
                {saveError}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                disabled={saving}
                onClick={saveDraft}
                style={{
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
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
                Save and revisit later
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleComplete}
                style={{
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  padding: "12px 22px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: green,
                  color: "#FFFFFF",
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                Complete reconciliation
              </button>
            </div>
          </section>
        ) : null}

        {showCompleted &&
        reconciliation?.decisions &&
        typeof reconciliation.decisions === "object" &&
        !Array.isArray(reconciliation.decisions) ? (
          <section style={{ marginTop: "28px", textAlign: "left" }}>
            <h3
              style={{
                margin: "0 0 12px",
                color: green,
                fontFamily: georgia,
                fontWeight: 700,
                fontSize: "1.2rem",
              }}
            >
              Your documented responses
            </h3>
            {tensions.map((t, i) => {
              const area =
                typeof t?.area === "string" && t.area.trim()
                  ? t.area.trim()
                  : `Tension ${i + 1}`;
              const saved = savedResponseAt(
                reconciliation.decisions,
                i,
                tensions.length
              );
              return (
                <div key={`read-${i}`} style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      fontFamily: dmSans,
                      fontWeight: 700,
                      color: green,
                      marginBottom: "6px",
                    }}
                  >
                    {area}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontFamily: dmSans,
                      color: bodyDark,
                      fontSize: "0.92rem",
                      lineHeight: 1.5,
                    }}
                  >
                    {saved || "No response recorded."}
                  </p>
                </div>
              );
            })}
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontFamily: dmSans,
                  fontWeight: 700,
                  color: green,
                  marginBottom: "6px",
                }}
              >
                General notes
              </div>
              <p
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontFamily: dmSans,
                  color: bodyDark,
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                }}
              >
                {typeof reconciliation.decisions.general_notes === "string" &&
                reconciliation.decisions.general_notes.trim()
                  ? reconciliation.decisions.general_notes
                  : "None."}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default Reconcile;
