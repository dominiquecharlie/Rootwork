import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { isQuestionVisible } from "../../lib/questionVisibility";

// System fonts only. Do not load Google Fonts or other third-party assets on
// this page. Community respondents should not make external requests to answer.
const bodyFont =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const headingFont = 'Georgia, "Times New Roman", Times, serif';

const green = "#2D6A2F";
const mint = "#A8D4AA";
const warm = "#FAF9F7";
const charcoal = "#2C2C2C";
const muted = "#4B5563";
const danger = "#B91C1C";

// Language names in their own language. Never translate these labels.
const LANGUAGE_NATIVE_LABELS = {
  en: "English",
  es: "Español",
};

const UI = {
  en: {
    loading: "Loading form…",
    unavailableTitle: "This form is not available",
    unavailableBody:
      "The form you opened cannot be used right now. If you think this is a mistake, ask the person who shared the link with you.",
    rateLimited:
      "Too many attempts. Please wait a moment and try again.",
    networkError:
      "We could not reach the server. Check your connection and try again. Your answers are still here.",
    retry: "Try again",
    required: "Required",
    consentLabel: "I have read this and I agree to continue.",
    submit: "Submit answers",
    submitting: "Submitting…",
    thankYouTitle: "Thank you",
    thankYouBody:
      "Your answers have been saved for the organization that asked these questions. They will use them to understand community needs and improve their program.",
    thankYouRemove:
      "If you want your answers removed, contact the organization that collected them and ask them to delete your response. Keep a copy of this page or the link you used if that helps you reach them.",
    selectOption: "Select an option",
    yes: "Yes",
    no: "No",
  },
  es: {
    loading: "Cargando formulario…",
    unavailableTitle: "Este formulario no está disponible",
    unavailableBody:
      "El formulario que abrió no se puede usar en este momento. Si cree que es un error, pregunte a la persona que le compartió el enlace.",
    rateLimited:
      "Demasiados intentos. Espere un momento e intente de nuevo.",
    networkError:
      "No pudimos conectar con el servidor. Revise su conexión e intente de nuevo. Sus respuestas siguen aquí.",
    retry: "Intentar de nuevo",
    required: "Obligatorio",
    consentLabel: "He leído esto y acepto continuar.",
    submit: "Enviar respuestas",
    submitting: "Enviando…",
    thankYouTitle: "Gracias",
    thankYouBody:
      "Sus respuestas se guardaron para la organización que hizo estas preguntas. Las usarán para entender las necesidades de la comunidad y mejorar su programa.",
    thankYouRemove:
      "Si desea que eliminen sus respuestas, contacte a la organización que las recopiló y pida que borren su respuesta. Guarde una copia de esta página o del enlace que usó si eso le ayuda a contactarlos.",
    selectOption: "Seleccione una opción",
    yes: "Sí",
    no: "No",
  },
};

function uiCopy(lang) {
  return UI[lang] || UI.en;
}

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

const shellStyle = {
  minHeight: "100vh",
  backgroundColor: warm,
  color: charcoal,
  fontFamily: bodyFont,
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
  fontFamily: bodyFont,
  fontSize: "1.05rem",
  color: charcoal,
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
};

const questionTitleStyle = {
  display: "block",
  marginBottom: "8px",
  fontFamily: headingFont,
  fontWeight: 700,
  fontSize: "1.1rem",
  color: charcoal,
  lineHeight: 1.35,
};

function PublicForm() {
  const { token: rawToken } = useParams();
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  const [loadState, setLoadState] = useState("loading");
  const [form, setForm] = useState(null);
  const [language, setLanguage] = useState("en");
  const [answers, setAnswers] = useState({});
  const [consent, setConsent] = useState(false);
  const [questionErrors, setQuestionErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copy = uiCopy(language);

  const loadForm = useCallback(async () => {
    if (!token) {
      setLoadState("unavailable");
      setForm(null);
      return;
    }
    setLoadState("loading");
    setFormError("");
    try {
      const response = await fetch(
        `${apiBase()}/api/public/form/${encodeURIComponent(token)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );
      if (response.status === 404) {
        setLoadState("unavailable");
        setForm(null);
        return;
      }
      if (response.status === 429) {
        setLoadState("rate_limited");
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
      });
      setLanguage(nextLang);
      setLoadState("ready");
    } catch {
      setLoadState("network");
    }
  }, [token]);

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
      const response = await fetch(
        `${apiBase()}/api/public/form/${encodeURIComponent(token)}/respond`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
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
      if (response.status === 429) {
        setFormError(copy.rateLimited);
        setSubmitting(false);
        return;
      }
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
            : copy.networkError
        );
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setFormError(copy.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <main style={shellStyle} aria-busy="true">
        <div style={cardStyle}>
          <p style={{ fontFamily: bodyFont, fontSize: "1.1rem", color: muted }}>
            {copy.loading}
          </p>
        </div>
      </main>
    );
  }

  if (loadState === "unavailable") {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <h1
            style={{
              margin: "0 0 12px",
              fontFamily: headingFont,
              fontSize: "1.75rem",
              color: green,
            }}
          >
            {copy.unavailableTitle}
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: charcoal,
            }}
          >
            {copy.unavailableBody}
          </p>
        </div>
      </main>
    );
  }

  if (loadState === "rate_limited" || loadState === "network") {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          <p
            style={{
              margin: "0 0 16px",
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: charcoal,
            }}
          >
            {loadState === "rate_limited" ? copy.rateLimited : copy.networkError}
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
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main style={shellStyle}>
        <div style={cardStyle}>
          {form?.tool_name ? (
            <p
              style={{
                margin: "0 0 8px",
                fontFamily: bodyFont,
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
              fontFamily: headingFont,
              fontSize: "1.75rem",
              color: green,
            }}
          >
            {copy.thankYouTitle}
          </h1>
          <p
            style={{
              margin: "0 0 14px",
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              lineHeight: 1.55,
              color: charcoal,
            }}
          >
            {copy.thankYouBody}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              lineHeight: 1.55,
              color: charcoal,
            }}
          >
            {copy.thankYouRemove}
          </p>
        </div>
      </main>
    );
  }

  const languages = form?.languages || [];
  const showToggle = languages.length > 1;
  const consentText = pickLocalized(form?.consent_language, language);
  const consentFallbackWarning =
    language !== "en" &&
    (!consentText ||
      !(
        form?.consent_language &&
        typeof form.consent_language === "object" &&
        typeof form.consent_language[language] === "string" &&
        form.consent_language[language].trim()
      ));

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
        {showToggle ? (
          <div
            role="group"
            aria-label="Language"
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
                    fontFamily: bodyFont,
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
              margin: 0,
              fontFamily: headingFont,
              fontSize: "1.85rem",
              lineHeight: 1.25,
              color: green,
            }}
          >
            {form?.tool_name || "Form"}
          </h1>
        </header>

        <form onSubmit={handleSubmit} noValidate>
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
                    fontFamily: bodyFont,
                    fontWeight: 500,
                    fontSize: "0.9rem",
                    color: muted,
                  }}
                >
                  {copy.required}
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
                              { value: "yes", label: copy.yes },
                              { value: "no", label: copy.no },
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
                                    fontFamily: bodyFont,
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
                                      fontFamily: bodyFont,
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
                        fontFamily: bodyFont,
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

          <section
            style={{
              marginTop: "36px",
              paddingTop: "24px",
              borderTop: `1px solid ${mint}`,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontFamily: headingFont,
                fontSize: "1.25rem",
                color: green,
              }}
            >
              {language === "es" ? "Consentimiento" : "Consent"}
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
                  fontFamily: bodyFont,
                  fontSize: "0.95rem",
                  lineHeight: 1.45,
                  color: charcoal,
                }}
              >
                {language === "es"
                  ? "Aviso: el consentimiento no tiene traducción al español. El texto a continuación está en inglés."
                  : "Notice: consent is not available in this language. The text below is in English."}
              </p>
            ) : null}
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: `1px solid ${mint}`,
                backgroundColor: "#FFFFFF",
                fontFamily: bodyFont,
                fontSize: "1.05rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                color: charcoal,
                marginBottom: "16px",
              }}
            >
              {consentText}
            </div>
            <label
              htmlFor="consent-ack"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                minHeight: "48px",
                cursor: "pointer",
                fontFamily: bodyFont,
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
              <span>{copy.consentLabel}</span>
            </label>
          </section>

          {formError ? (
            <p
              role="alert"
              style={{
                margin: "16px 0 0",
                color: danger,
                fontFamily: bodyFont,
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
              marginTop: "24px",
              minHeight: "52px",
              padding: "14px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: !consent || submitting ? "#9CA3AF" : green,
              color: "#FFFFFF",
              fontFamily: bodyFont,
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: !consent || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? copy.submitting : copy.submit}
          </button>
        </form>
      </div>
    </main>
  );
}

export default PublicForm;
