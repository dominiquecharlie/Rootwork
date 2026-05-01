import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";

const SPEAKER_ROLES = [
  "Community member",
  "Program participant",
  "Community leader",
  "Family member",
  "Other",
];

function inputBase() {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #D1D5DB",
    fontFamily: dmSans,
    fontSize: "0.95rem",
  };
}

function CommunityVoice() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [engagement, setEngagement] = useState(null);
  const [records, setRecords] = useState([]);

  const [voiceContent, setVoiceContent] = useState("");
  const [speakerRole, setSpeakerRole] = useState(SPEAKER_ROLES[0]);
  const [engagementContext, setEngagementContext] = useState("");
  const [formError, setFormError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  const loadData = useCallback(async () => {
    setLoadError("");
    setLoadState("loading");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoadError("Your session has expired. Please sign in again.");
      setLoadState("error");
      return;
    }
    const headers = { Authorization: `Bearer ${session.access_token}` };

    const engRes = await fetch(`${apiBaseUrl}/api/stage02/engagements`, {
      headers,
    });
    let engBody = {};
    try {
      engBody = await engRes.json();
    } catch {
      engBody = {};
    }
    if (!engRes.ok) {
      setLoadError(
        typeof engBody?.error === "string" && engBody.error.trim()
          ? engBody.error
          : "Could not load engagements."
      );
      setLoadState("error");
      return;
    }
    const list = Array.isArray(engBody.engagements) ? engBody.engagements : [];
    const latest = list[0];
    if (!latest) {
      setEngagement(null);
      setRecords([]);
      setLoadState("ready");
      return;
    }
    setEngagement(latest);

    const recUrl = `${apiBaseUrl}/api/stage02/community-voice-records?engagement_id=${encodeURIComponent(latest.id)}`;
    const recRes = await fetch(recUrl, { headers });
    let recBody = {};
    try {
      recBody = await recRes.json();
    } catch {
      recBody = {};
    }
    if (!recRes.ok) {
      setLoadError(
        typeof recBody?.error === "string" && recBody.error.trim()
          ? recBody.error
          : "Could not load voice records."
      );
      setLoadState("error");
      return;
    }
    setRecords(Array.isArray(recBody.records) ? recBody.records : []);
    setLoadState("ready");
  }, [apiBaseUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddRecord(e) {
    e.preventDefault();
    if (!engagement) return;
    setFormError("");
    const trimmed = voiceContent.trim();
    if (!trimmed) {
      setFormError("Enter what they said before adding this record.");
      return;
    }
    setIsAdding(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setFormError("Your session has expired. Please sign in again.");
      setIsAdding(false);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage02/community-voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          engagement_id: engagement.id,
          voice_content: trimmed,
          speaker_role: speakerRole,
          engagement_context: engagementContext.trim() || "",
        }),
      });
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) {
        const msg =
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not save record.";
        throw new Error(msg);
      }
      const newRec = body.record;
      if (newRec) {
        setRecords((prev) => [...prev, newRec]);
      }
      setVoiceContent("");
      setEngagementContext("");
      setSpeakerRole(SPEAKER_ROLES[0]);
    } catch (err) {
      setFormError(err.message || "Could not save record.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemoveRecord(id) {
    setRemovingId(id);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setRemovingId(null);
      return;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02/community-voice-records/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (!response.ok) {
        let body = {};
        try {
          body = await response.json();
        } catch {
          body = {};
        }
        const msg =
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Remove failed.";
        throw new Error(msg);
      }
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // keep list; user can retry
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCompleteHardstop() {
    if (records.length < 1) return;
    setCompleteError("");
    setIsCompleting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setCompleteError("Your session has expired. Please sign in again.");
      setIsCompleting(false);
      return;
    }
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02/complete-hardstop`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) {
        const msg =
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not complete this step.";
        throw new Error(msg);
      }
      navigate("/stage02b/reconcile");
    } catch (err) {
      setCompleteError(err.message || "Could not complete this step.");
    } finally {
      setIsCompleting(false);
    }
  }

  if (loadState === "loading") {
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
        <p style={{ fontFamily: dmSans, color: bodyDark }}>Loading...</p>
      </main>
    );
  }

  if (loadState === "error") {
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
            fontFamily: dmSans,
            color: "#B42318",
            textAlign: "center",
            maxWidth: "480px",
          }}
        >
          {loadError}
        </p>
      </main>
    );
  }

  if (!engagement) {
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
        <div style={{ textAlign: "center", maxWidth: "480px" }}>
          <p
            style={{
              margin: "0 0 16px",
              color: bodyDark,
              fontFamily: dmSans,
              fontSize: "1rem",
              lineHeight: 1.55,
            }}
          >
            No engagement session found. Document an engagement first, then
            return here to record community voice.
          </p>
          <button
            type="button"
            onClick={() => navigate("/stage02/document-engagement")}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Go to engagement documentation
          </button>
        </div>
      </main>
    );
  }

  const count = records.length;

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
      <div style={{ width: "100%", maxWidth: "720px", boxSizing: "border-box" }}>
        <p
          style={{
            margin: "0 0 8px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "0.9rem",
            textAlign: "center",
          }}
        >
          Documenting voice for session
        </p>
        <p
          style={{
            margin: "0 0 20px",
            color: green,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            textAlign: "center",
          }}
        >
          {engagement.title || "Untitled engagement"}
        </p>

        <h1
          style={{
            margin: "0 0 12px",
            color: green,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.85rem",
            textAlign: "center",
          }}
        >
          Record community voice
        </h1>
        <p
          style={{
            margin: "0 auto 20px",
            maxWidth: "600px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          Enter what community members said in their own words. Do not summarize
          or paraphrase. These records are stored exactly as you enter them and
          will never be rewritten by Claude.
        </p>

        <div
          style={{
            backgroundColor: green,
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontSize: "0.95rem",
              lineHeight: 1.55,
              textAlign: "left",
            }}
          >
            Every record on this page is stored verbatim. Claude will never
            rewrite, summarize, or paraphrase community voice. When these words
            appear in your reports, they appear exactly as entered here.
          </p>
        </div>

        {records.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginBottom: "24px",
            }}
          >
            {records.map((r) => (
              <article
                key={r.id}
                style={{
                  position: "relative",
                  backgroundColor: "#FFFFFF",
                  borderLeft: `4px solid ${green}`,
                  borderRadius: "8px",
                  padding: "16px",
                  borderTop: "1px solid #E8E8E8",
                  borderRight: "1px solid #E8E8E8",
                  borderBottom: "1px solid #E8E8E8",
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    color: bodyDark,
                    fontFamily: "Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "1.05rem",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.voice_content}
                </p>
                {r.speaker_role ? (
                  <span
                    style={{
                      display: "inline-block",
                      marginBottom: "8px",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      backgroundColor: "#ECFDF3",
                      color: "#166534",
                      fontFamily: dmSans,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                    }}
                  >
                    {r.speaker_role}
                  </span>
                ) : null}
                <div>
                  <button
                    type="button"
                    disabled={removingId === r.id}
                    onClick={() => handleRemoveRecord(r.id)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#DC2626",
                      fontFamily: dmSans,
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor:
                        removingId === r.id ? "not-allowed" : "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    {removingId === r.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #A8D4AA",
            backgroundColor: "#FAF9F7",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              color: green,
              fontFamily: dmSans,
              fontWeight: 700,
              fontSize: "1.05rem",
              textAlign: "left",
            }}
          >
            Add a voice record
          </h2>
          <form onSubmit={handleAddRecord}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                color: bodyDark,
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              What did they say? <span style={{ color: "#B42318" }}>*</span>
            </label>
            <p
              style={{
                margin: "0 0 8px",
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.85rem",
                lineHeight: 1.45,
              }}
            >
              Enter their words as directly as possible. Use quotes if you are
              transcribing. Do not clean up grammar or summarize.
            </p>
            <textarea
              required
              value={voiceContent}
              onChange={(e) => setVoiceContent(e.target.value)}
              style={{
                ...inputBase(),
                minHeight: "120px",
                resize: "vertical",
                marginBottom: "16px",
              }}
            />

            <label
              style={{
                display: "block",
                marginBottom: "6px",
                color: bodyDark,
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Who said this? <span style={{ color: "#B42318" }}>*</span>
            </label>
            <select
              required
              value={speakerRole}
              onChange={(e) => setSpeakerRole(e.target.value)}
              style={{ ...inputBase(), marginBottom: "16px" }}
            >
              {SPEAKER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <label
              style={{
                display: "block",
                marginBottom: "6px",
                color: bodyDark,
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Any context to note?
            </label>
            <p
              style={{
                margin: "0 0 8px",
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.85rem",
                lineHeight: 1.45,
              }}
            >
              Where were they, what were they responding to, or anything else
              that gives this record meaning
            </p>
            <textarea
              value={engagementContext}
              onChange={(e) => setEngagementContext(e.target.value)}
              rows={3}
              style={{
                ...inputBase(),
                resize: "vertical",
                marginBottom: "14px",
              }}
            />

            {formError ? (
              <p
                style={{
                  marginBottom: "10px",
                  color: "#B42318",
                  fontFamily: dmSans,
                  fontSize: "0.9rem",
                }}
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isAdding}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: `2px solid ${green}`,
                backgroundColor: "#FFFFFF",
                color: green,
                cursor: isAdding ? "not-allowed" : "pointer",
                opacity: isAdding ? 0.75 : 1,
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              {isAdding ? "Saving..." : "Add this record"}
            </button>
          </form>
        </div>

        <p
          style={{
            margin: "0 0 20px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "0.95rem",
            textAlign: "center",
          }}
        >
          {count} voice record{count === 1 ? "" : "s"} saved for this session
        </p>

        <div style={{ marginBottom: "24px" }}>
          {count === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "8px",
                backgroundColor: "#FEF3C7",
                border: "1px solid #F59E0B",
                color: "#92400E",
                fontFamily: dmSans,
                fontSize: "0.95rem",
                textAlign: "center",
              }}
            >
              Add at least one community voice record before continuing
            </div>
          ) : (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "8px",
                backgroundColor: "#ECFDF3",
                border: "1px solid #A8D4AA",
                color: "#166534",
                fontFamily: dmSans,
                fontSize: "0.95rem",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              Community voice documented. You are ready to move to reconciliation.
            </div>
          )}
        </div>

        {completeError ? (
          <p
            style={{
              marginBottom: "12px",
              color: "#B42318",
              fontFamily: dmSans,
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {completeError}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/stage02/document-engagement")}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Add another engagement session
          </button>
          <button
            type="button"
            disabled={count < 1 || isCompleting}
            onClick={handleCompleteHardstop}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              cursor: count < 1 || isCompleting ? "not-allowed" : "pointer",
              opacity: count < 1 || isCompleting ? 0.55 : 1,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {isCompleting ? "Continuing..." : "Continue to reconciliation"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default CommunityVoice;
