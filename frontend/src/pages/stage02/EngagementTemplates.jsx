import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import RootsLoader from "../../components/RootsLoader";

const dmSans = '"DM Sans", system-ui, sans-serif';
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";

function DraftLabel() {
  return (
    <span
      style={{
        display: "inline-block",
        marginBottom: "12px",
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
      AI draft: adapt before use
    </span>
  );
}

function HardStopPrepBlock() {
  return (
    <div
      style={{
        backgroundColor: green,
        borderRadius: "8px",
        padding: "24px",
        marginTop: "32px",
        marginBottom: "24px",
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          color: "#FFFFFF",
          fontFamily: "Georgia, serif",
          fontSize: "1.35rem",
          fontWeight: 700,
        }}
      >
        Now take these into your community.
      </h3>
      <p
        style={{
          margin: 0,
          color: "rgba(255, 255, 255, 0.8)",
          fontFamily: dmSans,
          fontSize: "1rem",
          lineHeight: 1.6,
        }}
      >
        Rootwork will wait here while you conduct your engagement. Come back
        when you are ready to document what you learned. Stage 03 will not
        unlock until you do.
      </p>
    </div>
  );
}

function EngagementTemplates() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [templates, setTemplates] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const fetchContext = useCallback(async () => {
    setLoadError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoadError("Your session has expired. Please sign in again.");
      setLoadState("error");
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const response = await fetch(`${apiBaseUrl}/api/stage02/templates-context`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
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
          : "Could not load templates context.";
      setLoadError(msg);
      setLoadState("error");
      return;
    }
    setTemplates(Array.isArray(body.templates) ? body.templates : []);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  async function handleGenerate() {
    setGenerateError("");
    setGenerating(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setGenerateError("Your session has expired. Please sign in again.");
      setGenerating(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02/generate-templates`,
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
            : "Generation failed.";
        throw new Error(msg);
      }
      setTemplates(Array.isArray(body.templates) ? body.templates : []);
    } catch (err) {
      setGenerateError(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
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

  const hasTemplates = templates.length > 0;

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
      <section
        style={{
          width: "100%",
          maxWidth: "760px",
          boxSizing: "border-box",
        }}
      >
        {generating ? (
          <div
            style={{
              padding: "40px 24px",
              borderRadius: "12px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #A8D4AA",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                margin: "0 0 20px",
                color: green,
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.35rem",
              }}
            >
              Preparing your engagement templates...
            </h2>
            <RootsLoader />
          </div>
        ) : (
          <>
        <h1
          style={{
            margin: "0 0 12px",
            color: green,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.9rem",
            textAlign: "center",
          }}
        >
          Your community engagement templates
        </h1>
        <p
          style={{
            margin: "0 auto 24px",
            maxWidth: "600px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          Based on your program context and funder requirements, Claude has
          recommended the engagement formats below. Take these into your
          community. Come back when you have completed your engagement and are
          ready to document what you learned.
        </p>

        <div
          style={{
            backgroundColor: green,
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontSize: "0.98rem",
              lineHeight: 1.55,
            }}
          >
            These templates are starting points. Adapt them for your
            community&apos;s language, culture, and context before using them.
            The most important thing is that real conversations happen.
          </p>
        </div>

        {!hasTemplates && !generating ? (
          <div
            style={{
              textAlign: "center",
              marginBottom: "32px",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #E5E7EB",
              backgroundColor: "#FFFFFF",
            }}
          >
            <p
              style={{
                margin: "0 0 20px",
                color: bodyDark,
                fontFamily: dmSans,
                fontSize: "1rem",
                lineHeight: 1.55,
              }}
            >
              Claude will review your program design and funder requirements to
              recommend the right engagement formats for your community.
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              style={{
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: green,
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Generate engagement templates
            </button>
            {generateError ? (
              <p
                style={{
                  marginTop: "14px",
                  color: "#B42318",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                }}
              >
                {generateError}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasTemplates ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "8px",
            }}
          >
            {templates.map((t) => (
              <article
                key={t.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #A8D4AA",
                  borderRadius: "12px",
                  padding: "24px",
                  boxSizing: "border-box",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: green,
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                  }}
                >
                  {t.template_type}
                </h2>
                <DraftLabel />
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  {t.prompt_text}
                </pre>
                <button
                  type="button"
                  onClick={() => {}}
                  style={{
                    marginTop: "18px",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: `2px solid ${green}`,
                    backgroundColor: "#FFFFFF",
                    color: green,
                    cursor: "pointer",
                    fontFamily: dmSans,
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  Download as Word doc
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {hasTemplates ? <HardStopPrepBlock /> : null}

        {hasTemplates ? (
          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => navigate("/stage02/document-engagement")}
              style={{
                padding: "14px 28px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: green,
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: dmSans,
                fontWeight: 600,
                fontSize: "1.05rem",
              }}
            >
              I have completed my community engagement
            </button>
          </div>
        ) : null}
          </>
        )}
      </section>
    </main>
  );
}

export default EngagementTemplates;
