import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";

const STORAGE_KEY = "sow_extraction_result";

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
      AI-extracted: confirm against your original document before continuing
    </span>
  );
}

function formatReportingLabel(value) {
  if (!value || typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  const map = {
    quarterly: "Quarterly",
    annual: "Annual",
    monthly: "Monthly",
    other: "Other",
  };
  return map[v] || value;
}

function metricTypeBadgeStyle(type) {
  const t = (type || "").toLowerCase();
  if (t === "output") {
    return { backgroundColor: "#DBEAFE", color: "#1D4ED8" };
  }
  if (t === "outcome") {
    return { backgroundColor: "#DCFCE7", color: "#166534" };
  }
  if (t === "process") {
    return { backgroundColor: "#F3F4F6", color: "#4B5563" };
  }
  if (t === "demographic") {
    return { backgroundColor: "#EDE9FE", color: "#5B21B6" };
  }
  return { backgroundColor: "#F3F4F6", color: "#6B7280" };
}

function MetricsReview() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [sowUploadId, setSowUploadId] = useState(null);
  const [funderName, setFunderName] = useState(null);
  const [funderFramework, setFunderFramework] = useState(null);
  const [reportingFrequency, setReportingFrequency] = useState(null);
  const [confidenceNotes, setConfidenceNotes] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState("output");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let raw;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw || !raw.trim()) {
      navigate("/stage02/sow", { replace: true });
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      navigate("/stage02/sow", { replace: true });
      return;
    }
    const id = data?.sow_upload?.id;
    if (!id) {
      navigate("/stage02/sow", { replace: true });
      return;
    }
    setSowUploadId(id);
    setFunderName(
      typeof data.funder_name === "string" && data.funder_name.trim()
        ? data.funder_name.trim()
        : null
    );
    setFunderFramework(
      typeof data.funder_framework === "string" &&
        data.funder_framework.trim()
        ? data.funder_framework.trim()
        : null
    );
    setReportingFrequency(
      typeof data.reporting_frequency === "string" &&
        data.reporting_frequency.trim()
        ? data.reporting_frequency.trim().toLowerCase()
        : null
    );
    setConfidenceNotes(
      Array.isArray(data.confidence_notes) ? data.confidence_notes : []
    );
    const list = Array.isArray(data.metrics) ? data.metrics : [];
    setMetrics(
      list.map((m, idx) => ({
        id: m.id || `client-${idx}-${crypto.randomUUID()}`,
        metric_name: m.metric_name || "",
        metric_description: m.metric_description || "",
        metric_type: m.metric_type || null,
        source: m.source === "manual" ? "manual" : "extracted",
      }))
    );
    setReady(true);
  }, [navigate]);

  const showFunderRow = Boolean(funderName);

  const filteredConfidence = useMemo(
    () => confidenceNotes.filter((n) => typeof n === "string" && n.trim()),
    [confidenceNotes]
  );

  function removeMetric(id) {
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  }

  function handleAddMetric(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setMetrics((prev) => [
      ...prev,
      {
        id: `local-${crypto.randomUUID()}`,
        metric_name: name,
        metric_description: newDescription.trim(),
        metric_type: newType,
        source: "manual",
      },
    ]);
    setNewName("");
    setNewDescription("");
    setNewType("output");
    setShowAddForm(false);
  }

  async function handleConfirm() {
    setSubmitError("");
    setIsSubmitting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setSubmitError("Your session has expired. Please sign in again.");
      setIsSubmitting(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const payload = {
      sow_upload_id: sowUploadId,
      reporting_frequency: reportingFrequency || "other",
      funder_framework: funderFramework,
      metrics: metrics.map((m) => ({
        metric_name: m.metric_name,
        metric_description: m.metric_description,
        metric_type: m.metric_type,
        source: m.source === "manual" ? "manual" : "extracted",
      })),
    };
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage02/confirm-metrics`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
            : "Could not save metrics.";
        throw new Error(msg);
      }
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      navigate("/stage02/templates");
    } catch (err) {
      setSubmitError(err.message || "Could not save metrics.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ready) {
    return null;
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
      <section
        style={{
          width: "100%",
          maxWidth: "720px",
          backgroundColor: "#FAF9F7",
          border: "1px solid #A8D4AA",
          borderRadius: "12px",
          padding: "28px",
          boxSizing: "border-box",
        }}
      >
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
          Here is what your funder requires
        </h1>
        <p
          style={{
            margin: "0 0 16px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          Claude extracted these metrics and reporting requirements from your
          uploaded document. Review each one carefully before continuing. These
          will travel with you through the rest of Rootwork.
        </p>
        <div style={{ textAlign: "center" }}>
          <DraftLabel />
        </div>

        {showFunderRow ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "24px",
            }}
          >
            {funderName ? (
              <span
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  backgroundColor: "#ECFDF3",
                  color: "#166534",
                  fontFamily: dmSans,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Funder: {funderName}
              </span>
            ) : null}
            {reportingFrequency ? (
              <span
                style={{
                  padding: "8px 14px",
                  borderRadius: "999px",
                  backgroundColor: "#ECFDF3",
                  color: "#166534",
                  fontFamily: dmSans,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                Reporting frequency:{" "}
                {formatReportingLabel(reportingFrequency)}
              </span>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {metrics.map((m) => {
            const typeLabel = m.metric_type
              ? m.metric_type.charAt(0).toUpperCase() + m.metric_type.slice(1)
              : "Other";
            const badge = metricTypeBadgeStyle(m.metric_type);
            return (
              <article
                key={m.id}
                style={{
                  position: "relative",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #A8D4AA",
                  borderRadius: "8px",
                  padding: "16px",
                  boxSizing: "border-box",
                }}
              >
                <button
                  type="button"
                  onClick={() => removeMetric(m.id)}
                  style={{
                    position: "absolute",
                    top: "14px",
                    right: "14px",
                    border: "none",
                    background: "none",
                    color: "#DC2626",
                    fontFamily: dmSans,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Remove
                </button>
                <h2
                  style={{
                    margin: "0 0 8px",
                    paddingRight: "72px",
                    color: green,
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                  }}
                >
                  {m.metric_name}
                </h2>
                <span
                  style={{
                    display: "inline-block",
                    marginBottom: "10px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontFamily: dmSans,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    ...badge,
                  }}
                >
                  {typeLabel}
                </span>
                <p
                  style={{
                    margin: 0,
                    color: bodyDark,
                    fontFamily: dmSans,
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  {m.metric_description || (
                    <span style={{ color: muted }}>No description.</span>
                  )}
                </p>
              </article>
            );
          })}
        </div>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Add metric
          </button>
        </div>

        {showAddForm ? (
          <form
            onSubmit={handleAddMetric}
            style={{
              marginTop: "16px",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              backgroundColor: "#FFFFFF",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontFamily: dmSans,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: bodyDark,
              }}
            >
              Name
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "6px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #D1D5DB",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontFamily: dmSans,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: bodyDark,
              }}
            >
              Description
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "6px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #D1D5DB",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label
              style={{
                display: "block",
                marginBottom: "12px",
                fontFamily: dmSans,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: bodyDark,
              }}
            >
              Type
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "6px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #D1D5DB",
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              >
                <option value="output">Output</option>
                <option value="outcome">Outcome</option>
                <option value="process">Process</option>
                <option value="demographic">Demographic</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: green,
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                Save metric
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #D1D5DB",
                  backgroundColor: "#FFFFFF",
                  color: bodyDark,
                  cursor: "pointer",
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {filteredConfidence.length > 0 ? (
          <div
            style={{
              marginTop: "24px",
              padding: "16px 18px",
              borderRadius: "8px",
              backgroundColor: "#FEF3C7",
              border: "1px solid #F59E0B",
              textAlign: "left",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "#92400E",
                fontFamily: dmSans,
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              Confidence notes
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "20px",
                color: "#92400E",
                fontFamily: dmSans,
                fontSize: "0.9rem",
                lineHeight: 1.5,
              }}
            >
              {filteredConfidence.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          style={{
            marginTop: "28px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/stage02/sow")}
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
            Back to upload
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {isSubmitting ? "Saving..." : "Confirm and continue"}
          </button>
        </div>
        {submitError ? (
          <p
            style={{
              marginTop: "14px",
              textAlign: "center",
              color: "#B42318",
              fontFamily: dmSans,
              fontSize: "0.95rem",
            }}
          >
            {submitError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default MetricsReview;
