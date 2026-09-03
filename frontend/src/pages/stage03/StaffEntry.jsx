import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isQuestionVisible } from "../../lib/questionVisibility";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const green = "#2D6A2F";
const mint = "#A8D4AA";
const warm = "#FAF9F7";
const charcoal = "#2C2C2C";
const muted = "#6B7280";
const danger = "#B91C1C";

const LANGUAGE_NATIVE_LABELS = {
  en: "English",
  es: "Español",
};

function languageToggleLabel(code) {
  return LANGUAGE_NATIVE_LABELS[code] || code;
}

function pickLocalized(map, lang) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return "";
  if (typeof map[lang] === "string" && map[lang].trim()) {
    return map[lang].trim();
  }
  if (typeof map.en === "string" && map.en.trim()) {
    return map.en.trim();
  }
  for (const val of Object.values(map)) {
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

const shellStyle = {
  minHeight: "100vh",
  backgroundColor: warm,
  color: charcoal,
  fontFamily: dmSans,
  padding: "20px 16px 48px",
  boxSizing: "border-box",
};

const cardStyle = {
  width: "100%",
  maxWidth: "560px",
  margin: "0 auto",
};

const inputStyle = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "8px",
  border: `1px solid ${mint}`,
  fontFamily: dmSans,
  fontSize: "1.05rem",
  color: charcoal,
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
};

const questionTitleStyle = {
  display: "block",
  marginBottom: "8px",
  fontFamily: georgia,
  fontWeight: 700,
  fontSize: "1.1rem",
  color: charcoal,
  lineHeight: 1.35,
};

const backLinkStyle = {
  display: "inline-block",
  marginBottom: "20px",
  fontFamily: dmSans,
  fontSize: "0.95rem",
  fontWeight: 600,
  color: green,
  textDecoration: "none",
};

function StaffEntry() {
  const { toolId: rawToolId } = useParams();
  const toolId = typeof rawToolId === "string" ? rawToolId.trim() : "";

  const [loadState, setLoadState] = useState("loading");
  const [form, setForm] = useState(null);
  const [language, setLanguage] = useState("en");
  const [answers, setAnswers] = useState({});
  const [consent, setConsent] = useState(false);
  const [questionErrors, setQuestionErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [removalCode, setRemovalCode] = useState("");
  const [removalUrl, setRemovalUrl] = useState("");

  const loadForm = useCallback(async () => {
    if (!toolId) {
      setLoadState("unavailable");
      setForm(null);
      return;
    }
    setLoadState("loading");
    setFormError("");
    try {
      const token = await getAccessToken();
      if (!token) {
        setFormError("Your session has expired. Please sign in again.");
        setLoadState("network");
        return;
      }
      const response = await fetch(
        `${apiBase()}/api/stage03/tools/${encodeURIComponent(toolId)}/entry`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );
      if (response.status === 404) {
        setLoadState("unavailable");
        setForm(null);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setFormError("Your session has expired. Please sign in again.");
        setLoadState("network");
        return;
      }
      if (!response.ok) {
        setLoadState("network");
        return;
      }
      const body = await response.json().catch(() => null);
      if (!body || typeof body !== "object") {
        setLoadState("network");
        return;
      }
      const languages = Array.isArray(body.languages)
        ? body.languages.filter((l) => typeof l === "string" && l.trim())
        : ["en"];
      const nextLang = languages.includes("en")
        ? "en"
        : languages[0] || "en";
      setForm({
        tool_name:
          typeof body.tool_name === "string" ? body.tool_name.trim() : "",
        languages,
        consent_language:
          body.consent_language && typeof body.consent_language === "object"
            ? body.consent_language
            : typeof body.consent_language === "string"
              ? { en: body.consent_language }
              : { en: "" },
        questions: Array.isArray(body.questions) ? body.questions : [],
        public_token:
          typeof body.public_token === "string" && body.public_token.trim()
            ? body.public_token.trim()
            : null,
      });
      setLanguage(nextLang);
      setLoadState("ready");
    } catch {
      setLoadState("network");
    }
  }, [toolId]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const questions = form?.questions || [];

  const visibleQuestions = useMemo(() => {
    const memo = new Map();
    return questions.filter((q) =>
      isQuestionVisible(q, answers, questions, memo)
    );
  }, [questions, answers]);

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setQuestionErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent || submitting || !form) return;
    setSubmitting(true);
    setFormError("");
    setQuestionErrors({});
    try {
      const token = await getAccessToken();
      if (!token) {
        setFormError("Your session has expired. Please sign in again.");
        setSubmitting(false);
        return;
      }
      const response = await fetch(
        `${apiBase()}/api/stage03/tools/${encodeURIComponent(toolId)}/entry`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            consent_acknowledged: true,
            language,
            answers,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setLoadState("unavailable");
        setSubmitting(false);
        return;
      }
      if (!response.ok) {
        const errs = Array.isArray(body?.errors) ? body.errors : [];
        if (errs.length > 0) {
          const map = {};
          for (const err of errs) {
            if (typeof err?.question_id === "string" && err.question_id.trim()) {
              map[err.question_id.trim()] =
                typeof err.error === "string" && err.error.trim()
                  ? err.error.trim()
                  : "Invalid answer.";
            }
          }
          setQuestionErrors(map);
          const firstId = Object.keys(map)[0];
          if (firstId) {
            const el = document.getElementById(`q-${firstId}`);
            if (el && typeof el.focus === "function") {
              el.focus({ preventScroll: false });
            } else if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
          setSubmitting(false);
          return;
        }
        setFormError(
          typeof body?.error === "string" && body.error.trim()
            ? body.error.trim()
            : "Could not save this entry. Check your connection and try again."
        );
        setSubmitting(false);
        return;
      }
      const code =
        typeof body?.removal_code === "string" ? body.removal_code.trim() : "";
      let url =
        typeof body?.removal_url === "string" ? body.removal_url.trim() : "";
      if (!url && form.public_token) {
        url = `/f/${encodeURIComponent(form.public_token)}/remove`;
      }
      setRemovalCode(code);
      setRemovalUrl(url);
      setSubmitted(true);
    } catch {
      setFormError(
        "Could not save this entry. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main style={shellStyle} aria-busy="true">
        <div style={cardStyle}>
          <p style={{ fontFamily: dmSans, fontSize: "1.1rem", color: muted }}>
            Loading staff entry…
          </p>
        </div>
      </main>
    );
  }

  if (loadState === "unavailable") {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <Link to="/stage03/tools" style={backLinkStyle}>
            Back to tools
          </Link>
          <h1
            style={{
              margin: "0 0 12px",
              fontFamily: georgia,
              fontSize: "1.75rem",
              color: green,
            }}
          >
            This entry form is not available.
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: dmSans,
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: charcoal,
            }}
          >
            Staff entry may be closed for this tool, or the tool may not allow
            staff to record answers.
          </p>
        </div>
      </main>
    );
  }

  if (loadState === "network") {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <Link to="/stage03/tools" style={backLinkStyle}>
            Back to tools
          </Link>
          <p
            style={{
              margin: "0 0 16px",
              fontFamily: dmSans,
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: charcoal,
            }}
          >
            {formError ||
              "Could not load this entry form. Check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={loadForm}
            style={{
              minHeight: "48px",
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontSize: "1.05rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (submitted) {
    const absoluteRemovalUrl =
      removalUrl &&
      typeof window !== "undefined" &&
      removalUrl.startsWith("/")
        ? `${window.location.origin}${removalUrl}`
        : removalUrl;

    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <Link to="/stage03/tools" style={backLinkStyle}>
            Back to tools
          </Link>
          {form?.tool_name ? (
            <p
              style={{
                margin: "0 0 8px",
                fontFamily: dmSans,
                fontSize: "0.95rem",
                color: muted,
              }}
            >
              {form.tool_name}
            </p>
          ) : null}
          <h1
            style={{
              margin: "0 0 12px",
              fontFamily: georgia,
              fontSize: "1.75rem",
              color: green,
            }}
          >
            Entry saved
          </h1>
          {removalCode ? (
            <section
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "8px",
                border: `2px solid ${green}`,
                backgroundColor: "#FFFFFF",
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  fontFamily: georgia,
                  fontSize: "1.2rem",
                  color: green,
                }}
              >
                Removal code
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "1.65rem",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                  color: charcoal,
                  wordBreak: "break-all",
                }}
                aria-label="Removal code"
              >
                {removalCode}
              </p>
              <p
                style={{
                  margin: "0 0 10px",
                  fontFamily: dmSans,
                  fontSize: "1.05rem",
                  lineHeight: 1.55,
                  color: charcoal,
                }}
              >
                Give this code and the removal URL to the person whose answers
                these are. These are someone&apos;s words and they can withdraw
                them. This code does not expire.
              </p>
              {absoluteRemovalUrl ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: dmSans,
                    fontSize: "0.95rem",
                    wordBreak: "break-all",
                    color: charcoal,
                    lineHeight: 1.5,
                  }}
                >
                  Removal URL: {absoluteRemovalUrl}
                </p>
              ) : null}
            </section>
          ) : (
            <p
              style={{
                margin: "0 0 20px",
                fontFamily: dmSans,
                fontSize: "1.05rem",
                lineHeight: 1.55,
                color: charcoal,
              }}
            >
              The entry was saved. No removal code was issued because this tool
              does not record one specific person&apos;s words.
            </p>
          )}
          <Link
            to="/stage03/tools"
            style={{
              display: "inline-block",
              minHeight: "48px",
              padding: "12px 20px",
              borderRadius: "8px",
              backgroundColor: green,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontSize: "1.05rem",
              fontWeight: 600,
              textDecoration: "none",
              lineHeight: "24px",
              boxSizing: "border-box",
            }}
          >
            Back to tools
          </Link>
        </div>
      </main>
    );
  }

  const languages = form?.languages || [];
  const showToggle = languages.length > 1;
  const consentText = pickLocalized(form?.consent_language, language);
  const consentExactForLang =
    form?.consent_language &&
    typeof form.consent_language === "object" &&
    typeof form.consent_language[language] === "string" &&
    form.consent_language[language].trim();
  const consentFallbackWarning =
    language !== "en" && (!consentText || !consentExactForLang);

  return (
    <main style={shellStyle}>
      <style>{`
        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible {
          outline: 3px solid ${green};
          outline-offset: 2px;
        }
      `}</style>
      <div style={cardStyle}>
        <Link to="/stage03/tools" style={backLinkStyle}>
          Back to tools
        </Link>

        {showToggle ? (
          <div
            role="group"
            aria-label="Administration language"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "20px",
            }}
          >
            {languages.map((code) => {
              const active = language === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  aria-pressed={active}
                  style={{
                    minHeight: "44px",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: active ? `2px solid ${green}` : `1px solid ${mint}`,
                    backgroundColor: active ? "#ECFDF3" : "#FFFFFF",
                    color: charcoal,
                    fontFamily: dmSans,
                    fontSize: "1rem",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {languageToggleLabel(code)}
                </button>
              );
            })}
          </div>
        ) : null}

        <header style={{ marginBottom: "24px" }}>
          <h1
            style={{
              margin: "0 0 8px",
              fontFamily: georgia,
              fontSize: "1.85rem",
              lineHeight: 1.25,
              color: green,
            }}
          >
            {form?.tool_name || "Staff entry"}
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: dmSans,
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: muted,
            }}
          >
            Staff entry. Record answers in the language you are administering.
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <section
            style={{
              marginBottom: "28px",
              paddingBottom: "24px",
              borderBottom: `1px solid ${mint}`,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontFamily: georgia,
                fontSize: "1.25rem",
                color: green,
              }}
            >
              Consent
            </h2>
            {consentFallbackWarning ? (
              <p
                role="alert"
                style={{
                  margin: "0 0 12px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #F87171",
                  backgroundColor: "#FEF2F2",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  lineHeight: 1.45,
                  color: charcoal,
                }}
              >
                Notice: consent is not available in this language. The text
                below is in English.
              </p>
            ) : null}
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: `1px solid ${mint}`,
                backgroundColor: "#FFFFFF",
                fontFamily: dmSans,
                fontSize: "1.05rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                color: charcoal,
                marginBottom: "16px",
              }}
            >
              {consentText || "No consent text is available for this tool."}
            </div>
            <label
              htmlFor="consent-ack"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                minHeight: "48px",
                cursor: "pointer",
                fontFamily: dmSans,
                fontSize: "1.05rem",
                lineHeight: 1.4,
                color: charcoal,
              }}
            >
              <input
                id="consent-ack"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{
                  width: "24px",
                  height: "24px",
                  marginTop: "2px",
                  flexShrink: 0,
                  accentColor: green,
                }}
              />
              <span>
                The person I am interviewing / recording gave this consent.
              </span>
            </label>
          </section>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
          >
            {visibleQuestions.map((q) => {
              const qid = q.id;
              const text = pickLocalized(q.text, language);
              const error = questionErrors[qid];
              const required = Boolean(q.required);
              const fieldId = `q-${qid}`;
              const errorId = `err-${qid}`;

              const requiredNote = required ? (
                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    fontFamily: dmSans,
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    color: muted,
                  }}
                >
                  Required
                </span>
              ) : null;

              return (
                <div key={qid}>
                  {q.type === "multiple_choice" || q.type === "yes_no" ? (
                    <fieldset
                      style={{
                        border: "none",
                        margin: 0,
                        padding: 0,
                        minWidth: 0,
                      }}
                    >
                      <legend style={questionTitleStyle}>
                        {text}
                        {requiredNote}
                      </legend>
                      <div
                        id={fieldId}
                        tabIndex={-1}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {q.type === "yes_no"
                          ? [
                              { value: "yes", label: "Yes" },
                              { value: "no", label: "No" },
                            ].map((opt) => {
                              const inputId = `${fieldId}-${opt.value}`;
                              return (
                                <label
                                  key={opt.value}
                                  htmlFor={inputId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    minHeight: "48px",
                                    padding: "12px 14px",
                                    borderRadius: "8px",
                                    border: `1px solid ${mint}`,
                                    backgroundColor: "#FFFFFF",
                                    cursor: "pointer",
                                    fontFamily: dmSans,
                                    fontSize: "1.05rem",
                                  }}
                                >
                                  <input
                                    id={inputId}
                                    type="radio"
                                    name={qid}
                                    value={opt.value}
                                    checked={answers[qid] === opt.value}
                                    onChange={() => setAnswer(qid, opt.value)}
                                    style={{
                                      width: "22px",
                                      height: "22px",
                                      flexShrink: 0,
                                      accentColor: green,
                                    }}
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              );
                            })
                          : (Array.isArray(q.options) ? q.options : []).map(
                              (opt) => {
                                const oid =
                                  typeof opt?.id === "string" ? opt.id : "";
                                if (!oid) return null;
                                const optLabel = pickLocalized(
                                  opt.label,
                                  language
                                );
                                const inputId = `${fieldId}-${oid}`;
                                return (
                                  <label
                                    key={oid}
                                    htmlFor={inputId}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "12px",
                                      minHeight: "48px",
                                      padding: "12px 14px",
                                      borderRadius: "8px",
                                      border: `1px solid ${mint}`,
                                      backgroundColor: "#FFFFFF",
                                      cursor: "pointer",
                                      fontFamily: dmSans,
                                      fontSize: "1.05rem",
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    <input
                                      id={inputId}
                                      type="radio"
                                      name={qid}
                                      value={oid}
                                      checked={answers[qid] === oid}
                                      onChange={() => setAnswer(qid, oid)}
                                      style={{
                                        width: "22px",
                                        height: "22px",
                                        marginTop: "2px",
                                        flexShrink: 0,
                                        accentColor: green,
                                      }}
                                    />
                                    <span>{optLabel}</span>
                                  </label>
                                );
                              }
                            )}
                      </div>
                    </fieldset>
                  ) : (
                    <>
                      <label htmlFor={fieldId} style={questionTitleStyle}>
                        {text}
                        {requiredNote}
                      </label>
                      {q.type === "long_text" ? (
                        <textarea
                          id={fieldId}
                          name={qid}
                          value={
                            typeof answers[qid] === "string"
                              ? answers[qid]
                              : ""
                          }
                          onChange={(e) => setAnswer(qid, e.target.value)}
                          rows={4}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? errorId : undefined}
                          style={{
                            ...inputStyle,
                            minHeight: "120px",
                            resize: "vertical",
                            borderColor: error ? "#F87171" : mint,
                          }}
                        />
                      ) : (
                        <input
                          id={fieldId}
                          name={qid}
                          type={
                            q.type === "number"
                              ? "number"
                              : q.type === "date"
                                ? "date"
                                : "text"
                          }
                          value={
                            typeof answers[qid] === "string" ||
                            typeof answers[qid] === "number"
                              ? String(answers[qid])
                              : ""
                          }
                          onChange={(e) => setAnswer(qid, e.target.value)}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? errorId : undefined}
                          style={{
                            ...inputStyle,
                            borderColor: error ? "#F87171" : mint,
                          }}
                        />
                      )}
                    </>
                  )}

                  {error ? (
                    <p
                      id={errorId}
                      style={{
                        margin: "8px 0 0",
                        color: danger,
                        fontFamily: dmSans,
                        fontSize: "0.95rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {formError ? (
            <p
              role="alert"
              style={{
                margin: "16px 0 0",
                color: danger,
                fontFamily: dmSans,
                fontSize: "1rem",
                lineHeight: 1.45,
              }}
            >
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!consent || submitting}
            style={{
              display: "block",
              width: "100%",
              marginTop: "28px",
              minHeight: "52px",
              padding: "14px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: !consent || submitting ? "#9CA3AF" : green,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: !consent || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Saving…" : "Save entry"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default StaffEntry;
