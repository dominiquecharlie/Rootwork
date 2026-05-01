import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const fieldStyle = {
  marginBottom: "22px",
  textAlign: "left",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#2D6A2F",
  fontFamily: "Georgia, serif",
  fontWeight: 700,
  fontSize: "1rem",
};

const promptStyle = {
  margin: "0 0 10px",
  color: "#2C2C2C",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.85rem",
  lineHeight: 1.45,
};

const textareaStyle = {
  width: "100%",
  minHeight: "120px",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #A8D4AA",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.95rem",
  color: "#2C2C2C",
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
  resize: "vertical",
};

const selectStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #A8D4AA",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.95rem",
  color: "#2C2C2C",
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
};

const sectionBlockStyle = {
  marginBottom: "32px",
  textAlign: "left",
};

const sectionHeadingStyle = {
  margin: "0 0 8px",
  color: "#2D6A2F",
  fontFamily: "Georgia, serif",
  fontWeight: 700,
  fontSize: "1.25rem",
};

const sectionExplanationStyle = {
  margin: "0 0 18px",
  color: "#6B7280",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.92rem",
  lineHeight: 1.55,
};

const deliveryOptions = [
  { value: "", label: "Select an option" },
  { value: "in_person", label: "In-person" },
  { value: "virtual", label: "Virtual" },
  { value: "hybrid", label: "Hybrid" },
  { value: "phone_based", label: "Phone-based" },
  { value: "home_visits", label: "Home visits" },
  { value: "other", label: "Other" },
];

const frequencyOptions = [
  { value: "", label: "Select an option" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "episodic", label: "Episodic" },
  { value: "other", label: "Other" },
];

const leaderOptions = [
  { value: "", label: "Select an option" },
  { value: "staff_members", label: "Staff members" },
  { value: "community_members", label: "Community members" },
  { value: "volunteers", label: "Volunteers" },
  { value: "peer_educators", label: "Peer educators" },
  { value: "contracted_facilitators", label: "Contracted facilitators" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

const changeLevelOptions = [
  { value: "", label: "Select an option" },
  { value: "individual", label: "Individual" },
  { value: "family", label: "Family" },
  { value: "community", label: "Community" },
  { value: "systems", label: "Systems" },
  { value: "multiple_levels", label: "Multiple levels" },
];

function optionLabel(options, value) {
  const found = options.find((o) => o.value === value);
  return found?.label && found.value !== "" ? found.label : value || "";
}

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
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      AI-surfaced, verify before acting
    </span>
  );
}

function ExtractedNoticeDraftLabel() {
  return (
    <span
      style={{
        display: "inline-block",
        marginTop: "10px",
        padding: "6px 12px",
        borderRadius: "8px",
        backgroundColor: "#ECFDF3",
        color: "#166534",
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      AI-extracted, confirm before use
    </span>
  );
}

function matchSelectValue(options, extracted) {
  if (extracted == null) return null;
  const s = String(extracted).trim();
  if (!s) return null;
  const exact = options.find((o) => o.value === s);
  if (exact?.value) return exact.value;
  const slug = s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  const slugMatch = options.find((o) => o.value === slug);
  if (slugMatch?.value) return slugMatch.value;
  const lower = s.toLowerCase();
  const labelMatch = options.find(
    (o) =>
      o.label &&
      o.label.toLowerCase().replace(/\s+/g, " ").trim() === lower
  );
  if (labelMatch?.value) return labelMatch.value;
  return null;
}

function FieldLabelWithHint({ htmlFor, fieldKey, prefilledHints, children }) {
  const showDot = Boolean(prefilledHints[fieldKey]);
  return (
    <label htmlFor={htmlFor} style={{ display: "block", marginBottom: "6px" }}>
      <span
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          color: "#2D6A2F",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: "1rem",
        }}
      >
        {showDot ? (
          <span
            title="Pre-filled from your uploaded document"
            aria-label="Pre-filled from document"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#4ADE80",
              marginTop: "0.38em",
              flexShrink: 0,
              boxShadow: "0 0 0 1px #A8D4AA",
            }}
          />
        ) : null}
        <span>{children}</span>
      </span>
    </label>
  );
}

const INTAKE_DISPLAY_ROWS = [
  {
    key: "resources_needed",
    label: "What resources does your program depend on?",
  },
  { key: "program_model", label: "How does your program work?" },
  { key: "delivery_method", label: "How is the program delivered?" },
  { key: "frequency", label: "How often does programming happen?" },
  { key: "geography", label: "Where does the program operate?" },
  { key: "who_leads", label: "Who leads the program?" },
  {
    key: "what_participation_looks_like",
    label: "What does participation look like?",
  },
  {
    key: "immediate_outputs",
    label: "What are you hoping to change in the immediate term?",
  },
  {
    key: "intended_change",
    label: "What longer-term change do you hope your outputs lead to?",
  },
  {
    key: "change_level",
    label: "At what level is this change happening?",
  },
  {
    key: "currently_measuring",
    label: "What are you currently measuring, if anything?",
  },
];

function formatIntakeValue(key, intake) {
  if (!intake) return "";
  const raw = intake[key];
  if (raw == null || String(raw).trim() === "") {
    if (key === "currently_measuring") return "Nothing stated";
    return "";
  }
  if (key === "delivery_method") {
    return optionLabel(deliveryOptions, String(raw));
  }
  if (key === "frequency") {
    return optionLabel(frequencyOptions, String(raw));
  }
  if (key === "who_leads") {
    return optionLabel(leaderOptions, String(raw));
  }
  if (key === "change_level") {
    return optionLabel(changeLevelOptions, String(raw));
  }
  return String(raw).trim();
}

function FormSection({ title, explanation, children }) {
  return (
    <div style={sectionBlockStyle}>
      <h2 style={sectionHeadingStyle}>{title}</h2>
      <p style={sectionExplanationStyle}>{explanation}</p>
      {children}
    </div>
  );
}

function ProgramDesign() {
  const navigate = useNavigate();
  const [resourcesNeeded, setResourcesNeeded] = useState("");
  const [programModel, setProgramModel] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [frequency, setFrequency] = useState("");
  const [geography, setGeography] = useState("");
  const [whoLeads, setWhoLeads] = useState("");
  const [participationLooksLike, setParticipationLooksLike] = useState("");
  const [immediateOutputs, setImmediateOutputs] = useState("");
  const [intendedChange, setIntendedChange] = useState("");
  const [changeLevel, setChangeLevel] = useState("");
  const [currentlyMeasuring, setCurrentlyMeasuring] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [alignmentGaps, setAlignmentGaps] = useState([]);
  const [strengths, setStrengths] = useState([]);
  const [suggestedMeasures, setSuggestedMeasures] = useState([]);
  const [submittedIntake, setSubmittedIntake] = useState(null);
  const [prefilledHints, setPrefilledHints] = useState({});
  const [showExtractedBanner, setShowExtractedBanner] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("extracted_program_data");
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;

    const hints = {};

    function applyText(key, value, setter) {
      if (value == null) return;
      const t = String(value).trim();
      if (!t) return;
      setter(t);
      hints[key] = true;
    }

    applyText("resources_needed", data.resources_needed, setResourcesNeeded);
    applyText("program_model", data.program_model, setProgramModel);
    applyText("geography", data.geography, setGeography);
    applyText(
      "what_participation_looks_like",
      data.what_participation_looks_like,
      setParticipationLooksLike
    );
    applyText("immediate_outputs", data.immediate_outputs, setImmediateOutputs);
    applyText("intended_change", data.intended_change, setIntendedChange);
    applyText("currently_measuring", data.currently_measuring, setCurrentlyMeasuring);

    const dm = matchSelectValue(deliveryOptions, data.delivery_method);
    if (dm) {
      setDeliveryMethod(dm);
      hints.delivery_method = true;
    }
    const fq = matchSelectValue(frequencyOptions, data.frequency);
    if (fq) {
      setFrequency(fq);
      hints.frequency = true;
    }
    const wl = matchSelectValue(leaderOptions, data.who_leads);
    if (wl) {
      setWhoLeads(wl);
      hints.who_leads = true;
    }
    const cl = matchSelectValue(changeLevelOptions, data.change_level);
    if (cl) {
      setChangeLevel(cl);
      hints.change_level = true;
    }

    setPrefilledHints(hints);
    setShowExtractedBanner(Object.keys(hints).length > 0);
  }, []);

  function buildIntakeFromForm() {
    return {
      resources_needed: resourcesNeeded.trim(),
      program_model: programModel.trim(),
      delivery_method: deliveryMethod,
      frequency,
      geography: geography.trim(),
      who_leads: whoLeads,
      what_participation_looks_like: participationLooksLike.trim(),
      immediate_outputs: immediateOutputs.trim(),
      intended_change: intendedChange.trim(),
      change_level: changeLevel,
      currently_measuring: currentlyMeasuring.trim() || null,
    };
  }

  function handleReviseProgramDesign() {
    setResultsLoaded(false);
    setAlignmentGaps([]);
    setStrengths([]);
    setSuggestedMeasures([]);
    setSubmittedIntake(null);
    setError("");
  }

  function handleSaveAndContinue() {
    navigate("/stage02/intro");
  }

  function validateRequired() {
    if (!resourcesNeeded.trim()) return false;
    if (!programModel.trim()) return false;
    if (!deliveryMethod || !frequency || !geography.trim()) return false;
    if (!whoLeads || !participationLooksLike.trim()) return false;
    if (!immediateOutputs.trim() || !intendedChange.trim() || !changeLevel) {
      return false;
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!validateRequired()) {
      setError("Please complete all required fields.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

    const body = buildIntakeFromForm();

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage01/program-design`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let backendError = "Could not submit program design.";
        try {
          const payload = await response.json();
          if (payload?.error) backendError = payload.error;
        } catch {
          // ignore
        }
        throw new Error(backendError);
      }

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        throw new Error("Could not read the server response.");
      }

      setSubmittedIntake(buildIntakeFromForm());
      setAlignmentGaps(
        Array.isArray(payload.alignment_gaps) ? payload.alignment_gaps : []
      );
      setStrengths(Array.isArray(payload.strengths) ? payload.strengths : []);
      setSuggestedMeasures(
        Array.isArray(payload.suggested_measures)
          ? payload.suggested_measures
          : []
      );
      setResultsLoaded(true);
      sessionStorage.removeItem("extracted_program_data");
    } catch (err) {
      setError(err.message || "Could not submit program design.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
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
        <style>
          {`
            @keyframes programDesignPulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.12); opacity: 0.65; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}
        </style>
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
              margin: "0 0 12px",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "1.8rem",
            }}
          >
            Reviewing your program design...
          </h1>
          <p
            style={{
              margin: "0 auto 18px",
              maxWidth: "620px",
              color: "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            Claude is looking for alignment gaps between your goals, your
            delivery model, and what you are currently measuring. This takes a
            few seconds.
          </p>
          <div
            aria-hidden="true"
            style={{
              width: "1.5rem",
              height: "1.5rem",
              borderRadius: "999px",
              backgroundColor: "#2D6A2F",
              margin: "0 auto",
              animation: "programDesignPulse 1.2s ease-in-out infinite",
            }}
          />
        </section>
      </main>
    );
  }

  if (resultsLoaded && submittedIntake) {
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
            maxWidth: "1100px",
            backgroundColor: "#FAF9F7",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "28px",
            boxSizing: "border-box",
            textAlign: "left",
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "1.75rem",
              textAlign: "center",
            }}
          >
            Program design review
          </h1>
          <p
            style={{
              margin: "0 0 28px",
              color: "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "0.95rem",
              textAlign: "center",
            }}
          >
            Read alignment notes alongside what you submitted. Edit your inputs
            anytime with Revise program design.
          </p>

          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: "300px",
                position: "sticky",
                top: "24px",
              }}
            >
              <div
                style={{
                  border: "1px solid #A8D4AA",
                  borderRadius: "12px",
                  padding: "20px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.2rem",
                  }}
                >
                  Your program design
                </h2>
                <DraftLabel />
                <div style={{ marginTop: "8px" }}>
                  {INTAKE_DISPLAY_ROWS.map((row) => (
                    <div key={row.key} style={{ marginBottom: "18px" }}>
                      <p
                        style={{
                          margin: "0 0 4px",
                          color: "#2D6A2F",
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontWeight: 700,
                          fontSize: "0.9rem",
                        }}
                      >
                        {row.label}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#2C2C2C",
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: "0.95rem",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {formatIntakeValue(row.key, submittedIntake)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: "300px" }}>
              <section style={{ marginBottom: "28px" }}>
                <h2
                  style={{
                    margin: "0 0 14px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  Alignment gaps
                </h2>
                {alignmentGaps.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "#6B7280",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: "0.9rem",
                    }}
                  >
                    No gaps were returned. You can still revise your inputs or
                    continue when ready.
                  </p>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                  >
                    {alignmentGaps.map((gap, index) => (
                      <div
                        key={`${gap.area || "gap"}-${index}`}
                        style={{
                          border: "1px solid #F59E0B",
                          borderRadius: "12px",
                          backgroundColor: "#FFFBEB",
                          padding: "14px 16px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 8px",
                            color: "#92400E",
                            fontFamily: '"DM Sans", system-ui, sans-serif',
                            fontWeight: 700,
                            fontSize: "0.95rem",
                          }}
                        >
                          {gap.area || "Gap"}
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px",
                            color: "#2C2C2C",
                            fontFamily: '"DM Sans", system-ui, sans-serif',
                            fontSize: "0.9rem",
                            lineHeight: 1.5,
                          }}
                        >
                          {gap.observation || ""}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: "#78350F",
                            fontFamily: "Georgia, serif",
                            fontSize: "0.95rem",
                            fontStyle: "italic",
                            lineHeight: 1.45,
                          }}
                        >
                          {gap.question || ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section
                style={{
                  marginBottom: "28px",
                  border: "1px solid #A8D4AA",
                  borderRadius: "12px",
                  backgroundColor: "#F0F7F0",
                  padding: "16px 18px",
                }}
              >
                <h2
                  style={{
                    margin: "0 0 12px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  What appears well-aligned
                </h2>
                {strengths.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "#6B7280",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: "0.9rem",
                    }}
                  >
                    No strengths list was returned.
                  </p>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      color: "#2C2C2C",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: "0.92rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {strengths.map((s, i) => (
                      <li key={`strength-${i}`}>{s}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2
                  style={{
                    margin: "0 0 12px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  Worth tracking
                </h2>
                {suggestedMeasures.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "#6B7280",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: "0.9rem",
                    }}
                  >
                    No suggested measures were returned.
                  </p>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      color: "#2C2C2C",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: "0.92rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {suggestedMeasures.map((m, i) => (
                      <li key={`measure-${i}`}>{m}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              justifyContent: "center",
              marginTop: "32px",
            }}
          >
            <button
              type="button"
              onClick={handleReviseProgramDesign}
              style={{
                flex: "1 1 220px",
                maxWidth: "320px",
                padding: "12px",
                borderRadius: "8px",
                border: "2px solid #2D6A2F",
                backgroundColor: "#FFFFFF",
                color: "#2D6A2F",
                cursor: "pointer",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Revise program design
            </button>
            <button
              type="button"
              onClick={handleSaveAndContinue}
              style={{
                flex: "1 1 220px",
                maxWidth: "320px",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2D6A2F",
                color: "#FFFFFF",
                cursor: "pointer",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              Save and continue to Stage 02
            </button>
          </div>
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
      <section
        style={{
          width: "100%",
          maxWidth: "720px",
          backgroundColor: "#FAF9F7",
          border: "1px solid #A8D4AA",
          borderRadius: "12px",
          padding: "28px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.9rem",
          }}
        >
          Design your program
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            color: "#6B7280",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "1rem",
          }}
        >
          Walk through inputs, activities, outputs, outcomes, and measurement
          using a simple logic model. This helps Rootwork see how your program
          fits together.
        </p>

        {showExtractedBanner ? (
          <div
            style={{
              marginBottom: "24px",
              textAlign: "left",
              border: "1px solid #A8D4AA",
              borderRadius: "12px",
              backgroundColor: "#F0F7F0",
              padding: "18px 20px",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.15rem",
              }}
            >
              We found some details in your document.
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                color: "#2C2C2C",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.95rem",
                lineHeight: 1.55,
              }}
            >
              The fields below have been pre-filled based on what Claude extracted
              from your uploaded document. Review each one and make any
              corrections before submitting.
            </p>
            <ExtractedNoticeDraftLabel />
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <FormSection
            title="Inputs"
            explanation="What does your organization need to run this program? Think about funding, staff, space, partnerships, and community relationships."
          >
            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="resourcesNeeded"
                fieldKey="resources_needed"
                prefilledHints={prefilledHints}
              >
                What resources does your program depend on?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>
                  List funding sources, staff roles, physical spaces, equipment,
                  or key partnerships
                </li>
                <li>
                  Include community relationships and trust that took time to
                  build
                </li>
                <li>
                  Example: Two part-time peer educators, a community center
                  partnership, CDBG funding, and relationships with local clinics
                </li>
              </ul>
              <textarea
                id="resourcesNeeded"
                name="resourcesNeeded"
                required
                value={resourcesNeeded}
                onChange={(e) => setResourcesNeeded(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </FormSection>

          <FormSection
            title="Activities"
            explanation="What does your program actually do? These are the actions your team and participants take together."
          >
            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="programModel"
                fieldKey="program_model"
                prefilledHints={prefilledHints}
              >
                How does your program work?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>Describe the core activities participants engage in</li>
                <li>What does a typical session or interaction look like?</li>
                <li>
                  Example: Weekly two-hour financial coaching sessions led by
                  trained peer educators in community centers
                </li>
              </ul>
              <textarea
                id="programModel"
                name="programModel"
                required
                value={programModel}
                onChange={(e) => setProgramModel(e.target.value)}
                style={textareaStyle}
              />
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="deliveryMethod"
                fieldKey="delivery_method"
                prefilledHints={prefilledHints}
              >
                How is the program delivered?
              </FieldLabelWithHint>
              <select
                id="deliveryMethod"
                name="deliveryMethod"
                required
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                style={selectStyle}
              >
                {deliveryOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="frequency"
                fieldKey="frequency"
                prefilledHints={prefilledHints}
              >
                How often does programming happen?
              </FieldLabelWithHint>
              <select
                id="frequency"
                name="frequency"
                required
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                style={selectStyle}
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="geography"
                fieldKey="geography"
                prefilledHints={prefilledHints}
              >
                Where does the program operate?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>
                  Be specific about geography. Name neighborhood, city, county,
                  or region.
                </li>
                <li>
                  Example: East Austin, Texas, primarily zip codes 78702 and
                  78721
                </li>
              </ul>
              <textarea
                id="geography"
                name="geography"
                required
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                style={textareaStyle}
              />
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="whoLeads"
                fieldKey="who_leads"
                prefilledHints={prefilledHints}
              >
                Who leads the program?
              </FieldLabelWithHint>
              <select
                id="whoLeads"
                name="whoLeads"
                required
                value={whoLeads}
                onChange={(e) => setWhoLeads(e.target.value)}
                style={selectStyle}
              >
                {leaderOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="participationLooksLike"
                fieldKey="what_participation_looks_like"
                prefilledHints={prefilledHints}
              >
                What does participation look like?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>What does someone actually do when they participate?</li>
                <li>How long is a typical participant involved?</li>
                <li>Is participation ongoing or time-limited?</li>
              </ul>
              <textarea
                id="participationLooksLike"
                name="participationLooksLike"
                required
                value={participationLooksLike}
                onChange={(e) => setParticipationLooksLike(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </FormSection>

          <FormSection
            title="Outputs"
            explanation="What do you expect to produce or change in the short term, directly as a result of your activities?"
          >
            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="immediateOutputs"
                fieldKey="immediate_outputs"
                prefilledHints={prefilledHints}
              >
                What are you hoping to change in the immediate term?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>
                  Think about changes you expect to see during or right after
                  participation
                </li>
                <li>
                  Focus on direct results of your activities that show up first
                </li>
                <li>
                  Example: Participants complete a personal budget, open a
                  savings account, and attend at least four sessions
                </li>
              </ul>
              <textarea
                id="immediateOutputs"
                name="immediateOutputs"
                required
                value={immediateOutputs}
                onChange={(e) => setImmediateOutputs(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </FormSection>

          <FormSection
            title="Outcomes"
            explanation="What longer-term change are you working toward? Outcomes are the deeper shift that builds on your outputs."
          >
            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="intendedChange"
                fieldKey="intended_change"
                prefilledHints={prefilledHints}
              >
                What longer-term change do you hope your outputs lead to?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>
                  Describe the change you hope to see 6 months, 1 year, or longer
                  after participation
                </li>
                <li>
                  How do you think the immediate changes will affect participants
                  or the community over time?
                </li>
                <li>
                  Example: Participants build emergency savings, reduce debt,
                  and report feeling more confident managing their finances over
                  the long term
                </li>
              </ul>
              <textarea
                id="intendedChange"
                name="intendedChange"
                required
                value={intendedChange}
                onChange={(e) => setIntendedChange(e.target.value)}
                style={textareaStyle}
              />
            </div>

            <div style={fieldStyle}>
              <FieldLabelWithHint
                htmlFor="changeLevel"
                fieldKey="change_level"
                prefilledHints={prefilledHints}
              >
                At what level is this change happening?
              </FieldLabelWithHint>
              <select
                id="changeLevel"
                name="changeLevel"
                required
                value={changeLevel}
                onChange={(e) => setChangeLevel(e.target.value)}
                style={selectStyle}
              >
                {changeLevelOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>

          <FormSection
            title="Measurement"
            explanation="What are you already tracking? Even informal data counts."
          >
            <div style={{ ...fieldStyle, marginBottom: "22px" }}>
              <FieldLabelWithHint
                htmlFor="currentlyMeasuring"
                fieldKey="currently_measuring"
                prefilledHints={prefilledHints}
              >
                What are you currently measuring, if anything?
              </FieldLabelWithHint>
              <ul
                style={{
                  ...promptStyle,
                  paddingLeft: "20px",
                  margin: "0 0 10px",
                }}
              >
                <li>List any data you already collect, even informally</li>
                <li>
                  If you are not measuring anything yet, that is okay. Write{" "}
                  <code
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "0.82em",
                      backgroundColor: "#ECFDF3",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    nothing yet
                  </code>
                </li>
                <li>This helps us understand where you are starting from</li>
              </ul>
              <textarea
                id="currentlyMeasuring"
                name="currentlyMeasuring"
                value={currentlyMeasuring}
                onChange={(e) => setCurrentlyMeasuring(e.target.value)}
                style={textareaStyle}
              />
            </div>
          </FormSection>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2D6A2F",
              color: "#FFFFFF",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Generate program design review
          </button>
        </form>

        {error ? (
          <p
            style={{
              marginTop: "14px",
              color: "#B42318",
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default ProgramDesign;
