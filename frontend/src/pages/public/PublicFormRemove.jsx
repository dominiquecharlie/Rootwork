import { useState } from "react";
import { Link, useParams } from "react-router-dom";

// Same constraints as PublicForm: no Supabase, no third-party assets.
const bodyFont =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const headingFont = 'Georgia, "Times New Roman", Times, serif';

const green = "#2D6A2F";
const mint = "#A8D4AA";
const warm = "#FAF9F7";
const charcoal = "#2C2C2C";
const muted = "#4B5563";

const UI = {
  en: {
    title: "Remove your answers",
    body:
      "Enter the removal code you received when you submitted. If the code matches a response on this form, that response will be deleted.",
    codeLabel: "Removal code",
    submit: "Remove my answers",
    submitting: "Working…",
    doneTitle: "Request received",
    doneBody:
      "If that code matched a response on this form, those answers are now deleted. For privacy, we do not confirm whether a code was found.",
    rateLimited: "Too many attempts. Please wait a moment and try again.",
    networkError: "We could not reach the server. Check your connection and try again.",
    backToForm: "Back to the form",
  },
  es: {
    title: "Eliminar sus respuestas",
    body:
      "Ingrese el código de eliminación que recibió al enviar. Si el código coincide con una respuesta de este formulario, esa respuesta se eliminará.",
    codeLabel: "Código de eliminación",
    submit: "Eliminar mis respuestas",
    submitting: "Procesando…",
    doneTitle: "Solicitud recibida",
    doneBody:
      "Si ese código coincidió con una respuesta de este formulario, esas respuestas ya están eliminadas. Por privacidad, no confirmamos si se encontró un código.",
    rateLimited: "Demasiados intentos. Espere un momento e intente de nuevo.",
    networkError:
      "No pudimos conectar con el servidor. Revise su conexión e intente de nuevo.",
    backToForm: "Volver al formulario",
  },
};

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
}

function PublicFormRemove() {
  const { token: rawToken } = useParams();
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const [lang] = useState(() =>
    typeof navigator !== "undefined" &&
    typeof navigator.language === "string" &&
    navigator.language.toLowerCase().startsWith("es")
      ? "es"
      : "en"
  );
  const copy = UI[lang] || UI.en;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase()}/api/public/form/${encodeURIComponent(token)}/remove`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({ code }),
        }
      );
      if (response.status === 429) {
        setError(copy.rateLimited);
        setSubmitting(false);
        return;
      }
      if (response.status === 404) {
        // Same calm outcome as a completed request: do not reveal form state.
        setDone(true);
        setSubmitting(false);
        return;
      }
      if (!response.ok) {
        setError(copy.networkError);
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError(copy.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: warm,
        color: charcoal,
        fontFamily: bodyFont,
        padding: "20px 16px 48px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px", margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 12px",
            fontFamily: headingFont,
            fontSize: "1.75rem",
            color: green,
          }}
        >
          {done ? copy.doneTitle : copy.title}
        </h1>
        {done ? (
          <p
            style={{
              margin: "0 0 20px",
              fontFamily: bodyFont,
              fontSize: "1.05rem",
              lineHeight: 1.55,
            }}
          >
            {copy.doneBody}
          </p>
        ) : (
          <>
            <p
              style={{
                margin: "0 0 20px",
                fontFamily: bodyFont,
                fontSize: "1.05rem",
                lineHeight: 1.55,
              }}
            >
              {copy.body}
            </p>
            <form onSubmit={handleSubmit}>
              <label
                htmlFor="removal-code"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontFamily: bodyFont,
                  fontWeight: 600,
                }}
              >
                {copy.codeLabel}
              </label>
              <input
                id="removal-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  borderRadius: "8px",
                  border: `1px solid ${mint}`,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "1.15rem",
                  letterSpacing: "0.04em",
                  color: charcoal,
                  backgroundColor: "#FFFFFF",
                  boxSizing: "border-box",
                }}
              />
              {error ? (
                <p
                  role="alert"
                  style={{
                    margin: "0 0 14px",
                    fontFamily: bodyFont,
                    color: "#B91C1C",
                  }}
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                style={{
                  minHeight: "48px",
                  padding: "12px 22px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor:
                    submitting || !code.trim() ? "#9CA3AF" : green,
                  color: "#FFFFFF",
                  fontFamily: bodyFont,
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  cursor:
                    submitting || !code.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? copy.submitting : copy.submit}
              </button>
            </form>
          </>
        )}
        {token ? (
          <p style={{ marginTop: "28px" }}>
            <Link
              to={`/f/${encodeURIComponent(token)}`}
              style={{ color: green, fontFamily: bodyFont, fontWeight: 600 }}
            >
              {copy.backToForm}
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default PublicFormRemove;
