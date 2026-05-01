import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";
const OTHER_TEMPLATE = "__other__";

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: bodyDark,
  fontFamily: dmSans,
  fontWeight: 600,
  fontSize: "0.95rem",
  textAlign: "left",
};

const helperListStyle = {
  margin: "0 0 10px",
  paddingLeft: "20px",
  color: muted,
  fontFamily: dmSans,
  fontSize: "0.85rem",
  lineHeight: 1.5,
  textAlign: "left",
};

function inputStyle() {
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

function sectionTitle(text) {
  return (
    <h2
      style={{
        margin: "0 0 18px",
        color: green,
        fontFamily: "Georgia, serif",
        fontWeight: 700,
        fontSize: "1.2rem",
        textAlign: "left",
      }}
    >
      {text}
    </h2>
  );
}

function DocumentEngagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");

  const [sessionTitle, setSessionTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateDisplayLabel, setTemplateDisplayLabel] = useState("");
  const [participantCount, setParticipantCount] = useState("");
  const [whoPresent, setWhoPresent] = useState("");
  const [whoAbsent, setWhoAbsent] = useState("");
  const [whyAbsent, setWhyAbsent] = useState("");
  const [communityWanted, setCommunityWanted] = useState("");
  const [concernsRaised, setConcernsRaised] = useState("");
  const [prioritiesNamed, setPrioritiesNamed] = useState("");
  const [primaryLanguageYes, setPrimaryLanguageYes] = useState(null);
  const [primaryLanguageBarrier, setPrimaryLanguageBarrier] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadContext = useCallback(async () => {
    setContextError("");
    setContextLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setContextError("Your session has expired. Please sign in again.");
      setContextLoading(false);
      return;
    }
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const response = await fetch(`${apiBaseUrl}/api/stage02/templates-context`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok) {
      setContextError(
        typeof body?.error === "string" && body.error.trim()
          ? body.error
          : "Could not load templates."
      );
      setContextLoading(false);
      return;
    }
    setTemplates(Array.isArray(body.templates) ? body.templates : []);
    setContextLoading(false);
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  function onTemplateChange(e) {
    const value = e.target.value;
    setTemplateId(value);
    if (value === OTHER_TEMPLATE) {
      setTemplateDisplayLabel("Other or no template");
      return;
    }
    const t = templates.find((x) => x.id === value);
    setTemplateDisplayLabel(
      t ? `${t.template_type}: ${t.template_name}` : ""
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!templateId) {
      setSubmitError("Choose which template you used.");
      return;
    }
    if (primaryLanguageYes !== true && primaryLanguageYes !== false) {
      setSubmitError(
        "Select whether the engagement was conducted in the community's primary language."
      );
      return;
    }
    if (primaryLanguageYes === false && !primaryLanguageBarrier.trim()) {
      setSubmitError(
        "Explain why the engagement was not conducted in the community's primary language."
      );
      return;
    }

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
      title: sessionTitle.trim(),
      engagement_date: occurredAt,
      template_used: templateId,
      participant_count: Number(participantCount),
      who_was_present: whoPresent.trim(),
      who_was_absent: whoAbsent.trim(),
      why_absent: whyAbsent.trim(),
      what_community_said: communityWanted.trim(),
      concerns_raised: concernsRaised.trim(),
      priorities_named: prioritiesNamed.trim(),
      conducted_in_primary_language: primaryLanguageYes,
      language_notes:
        primaryLanguageYes === false ? primaryLanguageBarrier.trim() : "",
      accessibility_notes: accessibilityNotes.trim(),
    };
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/stage02/document-engagement`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
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
            : "Save failed.";
        throw new Error(msg);
      }
      navigate("/stage02/community-voice");
    } catch (err) {
      setSubmitError(err.message || "Save failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (contextLoading) {
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

  if (contextError) {
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
          {contextError}
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "720px",
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
          Document your community engagement
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
          You went out and listened. Now document what happened. Be specific and
          honest, especially about who was not in the room.
        </p>

        <div
          style={{
            backgroundColor: "#F0F7F0",
            border: "1px solid #A8D4AA",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              margin: 0,
              color: green,
              fontFamily: dmSans,
              fontSize: "0.95rem",
              lineHeight: 1.55,
              textAlign: "left",
            }}
          >
            Community voice will be recorded exactly as you enter it. Claude
            will not rewrite or summarize what community members said.
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#FAF9F7",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          {sectionTitle("Section 1: About this engagement session")}

          <label style={labelStyle}>
            What did you call this session?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <p
            style={{
              margin: "0 0 10px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            A short name to identify this engagement (example: &quot;East
            Austin listening session, March 2026&quot;)
          </p>
          <input
            required
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            style={{ ...inputStyle(), marginBottom: "18px" }}
          />

          <label style={labelStyle}>
            When did this engagement happen?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <input
            required
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            style={{ ...inputStyle(), marginBottom: "18px" }}
          />

          <label style={labelStyle}>
            Which template did you use?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <select
            required
            value={templateId}
            onChange={onTemplateChange}
            style={{ ...inputStyle(), marginBottom: "18px" }}
          >
            <option value="">Select a template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.template_type}: {t.template_name}
              </option>
            ))}
            <option value={OTHER_TEMPLATE}>Other or no template</option>
          </select>

          <label style={labelStyle}>
            How many people participated?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <input
            required
            type="number"
            min={1}
            step={1}
            value={participantCount}
            onChange={(e) => setParticipantCount(e.target.value)}
            style={{ ...inputStyle(), marginBottom: 0 }}
          />
        </div>

        <div
          style={{
            backgroundColor: "#FAF9F7",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          {sectionTitle("Section 2: Who was in the room")}

          <label style={labelStyle}>
            Who was present? <span style={{ color: "#B42318" }}>*</span>
          </label>
          <ul style={helperListStyle}>
            <li>List the community members, roles, or groups who participated</li>
            <li>Be specific about who they are and their relationship to your program</li>
            <li>
              Example: &quot;Eight mothers from the Montopolis neighborhood, all
              current program participants&quot;
            </li>
          </ul>
          <textarea
            required
            rows={5}
            value={whoPresent}
            onChange={(e) => setWhoPresent(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: "18px" }}
          />

          <label style={labelStyle}>
            Who was NOT in the room?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <p
            style={{
              margin: "0 0 8px",
              color: "#B42318",
              fontFamily: dmSans,
              fontSize: "0.82rem",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            Required. This field is as important as who was present.
          </p>
          <ul style={helperListStyle}>
            <li>
              Which community members or groups were missing from this conversation?
            </li>
            <li>Be honest and specific</li>
            <li>
              Example: &quot;Fathers and male caregivers, Spanish-dominant
              speakers who could not attend due to language access gaps, anyone
              working evening shifts&quot;
            </li>
          </ul>
          <textarea
            required
            rows={5}
            value={whoAbsent}
            onChange={(e) => setWhoAbsent(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: "18px" }}
          />

          <label style={labelStyle}>
            Why were they absent? <span style={{ color: "#B42318" }}>*</span>
          </label>
          <ul style={helperListStyle}>
            <li>What barriers prevented their participation?</li>
            <li>What would need to change to include them next time?</li>
            <li>
              Example: &quot;Session was held at 10am on a Tuesday, which excluded
              working adults. No Spanish interpretation was available.&quot;
            </li>
          </ul>
          <textarea
            required
            rows={5}
            value={whyAbsent}
            onChange={(e) => setWhyAbsent(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: 0 }}
          />
        </div>

        <div
          style={{
            backgroundColor: "#FAF9F7",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}
        >
          {sectionTitle("Section 3: What community members said")}

          <label style={labelStyle}>
            What did community members say they wanted?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <ul style={helperListStyle}>
            <li>Record their words as directly as possible</li>
            <li>Do not summarize or paraphrase. Use their language.</li>
            <li>
              Example: &quot;Participants said they wanted more one-on-one time
              with the coach, not group sessions. Several said they felt
              embarrassed sharing financial details in front of others.&quot;
            </li>
          </ul>
          <textarea
            required
            rows={6}
            value={communityWanted}
            onChange={(e) => setCommunityWanted(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: "18px" }}
          />

          <label style={labelStyle}>What concerns were raised?</label>
          <p
            style={{
              margin: "0 0 10px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            Record specific concerns in community members&apos; own words
          </p>
          <textarea
            rows={4}
            value={concernsRaised}
            onChange={(e) => setConcernsRaised(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: "18px" }}
          />

          <label style={labelStyle}>
            What priorities did community members name?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </label>
          <p
            style={{
              margin: "0 0 10px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            What did they say matters most to them?
          </p>
          <textarea
            required
            rows={4}
            value={prioritiesNamed}
            onChange={(e) => setPrioritiesNamed(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: 0 }}
          />
        </div>

        <div
          style={{
            backgroundColor: "#FAF9F7",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
          }}
        >
          {sectionTitle("Section 4: Access and inclusion")}

          <p style={{ ...labelStyle, marginBottom: "12px" }}>
            Was the engagement conducted in the community&apos;s primary language?{" "}
            <span style={{ color: "#B42318" }}>*</span>
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setPrimaryLanguageYes(true);
                setPrimaryLanguageBarrier("");
              }}
              style={{
                flex: "1 1 200px",
                padding: "16px",
                borderRadius: "8px",
                border:
                  primaryLanguageYes === true
                    ? `2px solid ${green}`
                    : "1px solid #D1D5DB",
                backgroundColor: "#FFFFFF",
                cursor: "pointer",
                fontFamily: dmSans,
                fontWeight: 600,
                color: bodyDark,
                textAlign: "left",
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setPrimaryLanguageYes(false)}
              style={{
                flex: "1 1 200px",
                padding: "16px",
                borderRadius: "8px",
                border:
                  primaryLanguageYes === false
                    ? `2px solid ${green}`
                    : "1px solid #D1D5DB",
                backgroundColor: "#FFFFFF",
                cursor: "pointer",
                fontFamily: dmSans,
                fontWeight: 600,
                color: bodyDark,
                textAlign: "left",
              }}
            >
              No, and here is why:
            </button>
          </div>
          {primaryLanguageYes === false ? (
            <textarea
              required
              rows={4}
              value={primaryLanguageBarrier}
              onChange={(e) => setPrimaryLanguageBarrier(e.target.value)}
              placeholder="Explain why the session was not held in the community's primary language."
              style={{ ...inputStyle(), resize: "vertical", marginBottom: "18px" }}
            />
          ) : null}

          <label style={labelStyle}>
            What accessibility accommodations were made or needed?
          </label>
          <p
            style={{
              margin: "0 0 10px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            Transportation, childcare, physical accessibility, interpretation,
            other
          </p>
          <textarea
            rows={4}
            value={accessibilityNotes}
            onChange={(e) => setAccessibilityNotes(e.target.value)}
            style={{ ...inputStyle(), resize: "vertical", marginBottom: 0 }}
          />
        </div>

        {submitError ? (
          <p
            style={{
              marginBottom: "16px",
              color: "#B42318",
              fontFamily: dmSans,
              fontSize: "0.95rem",
              textAlign: "center",
            }}
          >
            {submitError}
          </p>
        ) : null}

        <div style={{ textAlign: "center" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "14px 28px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.75 : 1,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          >
            {isSubmitting ? "Saving..." : "Save engagement documentation"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default DocumentEngagement;
