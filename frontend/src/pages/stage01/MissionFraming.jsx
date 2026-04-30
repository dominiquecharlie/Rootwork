import { useState } from "react";
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
      AI draft — review and edit before use
    </span>
  );
}

function MissionFraming() {
  const navigate = useNavigate();
  const [whoIsMostAffected, setWhoIsMostAffected] = useState("");
  const [definitionOfSuccess, setDefinitionOfSuccess] = useState("");
  const [theoryOfChange, setTheoryOfChange] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftEdit, setDraftEdit] = useState("");
  const [flags, setFlags] = useState([]);
  const [parseError, setParseError] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [selectedOptionByFlag, setSelectedOptionByFlag] = useState({});
  const [lastInsertedText, setLastInsertedText] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setDraftLoaded(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your session has expired. Please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

    const response = await fetch(`${apiBaseUrl}/api/stage01/mission-draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        who_is_most_affected: whoIsMostAffected,
        definition_of_success: definitionOfSuccess,
        theory_of_change: theoryOfChange,
      }),
    });

    if (!response.ok) {
      let backendError = "Could not save mission framing. Please try again.";
      try {
        const payload = await response.json();
        if (payload?.error) backendError = payload.error;
      } catch {
        // ignore
      }
      setError(backendError);
      setIsSubmitting(false);
      return;
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      setError("Could not read the server response.");
      setIsSubmitting(false);
      return;
    }

    const statement =
      typeof payload.draft_mission_statement === "string"
        ? payload.draft_mission_statement
        : typeof payload.draft_mission === "string"
          ? payload.draft_mission
          : "";

    setDraftEdit(statement);
    setFlags(Array.isArray(payload.flags) ? payload.flags : []);
    setSelectedOptionByFlag({});
    setLastInsertedText("");
    setParseError(Boolean(payload.parse_error));
    setDraftLoaded(true);
    setIsSubmitting(false);
  }

  function handleSaveAndContinue() {
    navigate("/stage01/stakeholders/intro");
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
            @keyframes missionPulse {
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
            Growing your mission statement...
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
            This usually takes a few seconds. Claude will surface a draft and
            some things to consider — remember, you're the expert here. Review
            everything before moving on.
          </p>
          <div
            aria-hidden="true"
            style={{
              width: "1.5rem",
              height: "1.5rem",
              borderRadius: "999px",
              backgroundColor: "#2D6A2F",
              margin: "0 auto",
              animation: "missionPulse 1.2s ease-in-out infinite",
            }}
          />
        </section>
      </main>
    );
  }

  const draftHighlightIndex =
    lastInsertedText && draftEdit
      ? draftEdit.indexOf(lastInsertedText)
      : -1;
  const draftBeforeInsert =
    draftHighlightIndex >= 0 ? draftEdit.slice(0, draftHighlightIndex) : draftEdit;
  const draftInsertedSegment =
    draftHighlightIndex >= 0
      ? draftEdit.slice(
          draftHighlightIndex,
          draftHighlightIndex + lastInsertedText.length
        )
      : "";
  const draftAfterInsert =
    draftHighlightIndex >= 0
      ? draftEdit.slice(draftHighlightIndex + lastInsertedText.length)
      : "";

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
            fontSize: "1.75rem",
          }}
        >
          Mission framing
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            color: "#2C2C2C",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "0.95rem",
          }}
        >
          Center the people your program affects, not the institution.
        </p>

        {!draftLoaded ? (
          <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label htmlFor="whoIsMostAffected" style={labelStyle}>
              Who is most affected by your program?
            </label>
            <ul
              style={{
                ...promptStyle,
                paddingLeft: "20px",
                margin: "0 0 10px",
              }}
            >
              <li>
                Think about the people closest to the problem, not the
                organization delivering the service
              </li>
              <li>
                Be specific — name the community, demographic, or group rather
                than saying "the community"
              </li>
              <li>
                Example: "Latinas over 50 in East Austin who are uninsured and
                managing chronic illness"
              </li>
            </ul>
            <textarea
              id="whoIsMostAffected"
              name="whoIsMostAffected"
              required
              value={whoIsMostAffected}
              onChange={(e) => setWhoIsMostAffected(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="definitionOfSuccess" style={labelStyle}>
              What does success look like for them?
            </label>
            <ul
              style={{
                ...promptStyle,
                paddingLeft: "20px",
                margin: "0 0 10px",
              }}
            >
              <li>
                Describe change from their perspective, not the organization's
                outputs
              </li>
              <li>
                What would be different in their lives, not how many people you
                served
              </li>
              <li>
                Example: "Participants feel confident managing their health,
                have a primary care provider, and report reduced stress around
                medical costs"
              </li>
            </ul>
            <textarea
              id="definitionOfSuccess"
              name="definitionOfSuccess"
              required
              value={definitionOfSuccess}
              onChange={(e) => setDefinitionOfSuccess(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="theoryOfChange" style={labelStyle}>
              What is your theory of change?
            </label>
            <ul
              style={{
                margin: "0 0 10px",
                color: "#6B7280",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.82rem",
                lineHeight: 1.45,
                paddingLeft: "20px",
              }}
            >
              <li>A theory of change explains how your work creates impact</li>
              <li>
                Use this format: If we [do this activity], then [this group]
                will [experience this change], which will lead to [this larger
                outcome]
              </li>
              <li>
                Example: "If we provide weekly financial coaching to single
                mothers, then participants will build emergency savings, which
                will lead to greater financial stability for their families"
              </li>
            </ul>
            <textarea
              id="theoryOfChange"
              name="theoryOfChange"
              required
              value={theoryOfChange}
              onChange={(e) => setTheoryOfChange(e.target.value)}
              style={textareaStyle}
            />
          </div>

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
            {isSubmitting ? "Generating draft…" : "Generate mission draft"}
          </button>
          </form>
        ) : null}

        {draftLoaded ? (
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                display: "flex",
                gap: "24px",
                alignItems: "flex-start",
                maxWidth: "1100px",
                margin: "28px auto 0",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "300px", position: "sticky", top: "24px" }}>
                <div
                  style={{
                    border: "1px solid #A8D4AA",
                    borderRadius: "12px",
                    padding: "20px",
                    backgroundColor: "#FFFFFF",
                    marginBottom: "24px",
                  }}
                >
                  <DraftLabel />
                  <p
                    style={{
                      margin: "0 0 16px",
                      color: "#2C2C2C",
                      fontFamily: "Georgia, serif",
                      fontSize: "1.05rem",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {draftEdit.trim() ? (
                      draftHighlightIndex >= 0 ? (
                        <>
                          {draftBeforeInsert}
                          <span style={{ color: "#2D6A2F", fontWeight: 600 }}>
                            {draftInsertedSegment}
                          </span>
                          {draftAfterInsert}
                        </>
                      ) : (
                        draftEdit
                      )
                    ) : (
                      "—"
                    )}
                  </p>
                  <label
                    htmlFor="draftMissionEdit"
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color: "#2D6A2F",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Edit your mission statement
                  </label>
                  <textarea
                    id="draftMissionEdit"
                    name="draftMissionEdit"
                    value={draftEdit}
                    onChange={(e) => {
                      setDraftEdit(e.target.value);
                      setLastInsertedText("");
                    }}
                    style={{
                      ...textareaStyle,
                      minHeight: "140px",
                      lineHeight: 1.55,
                      fontSize: "1rem",
                    }}
                  />
                  {parseError ? (
                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "#B45309",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: "0.85rem",
                      }}
                    >
                      The model response was not valid JSON; the text above is shown
                      raw. You can edit it into your final mission statement.
                    </p>
                  ) : null}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "300px" }}>
                {flags.length > 0 ? (
                  <div style={{ marginBottom: "24px" }}>
                    <h2
                      style={{
                        margin: "0 0 14px",
                        color: "#2D6A2F",
                        fontFamily: "Georgia, serif",
                        fontWeight: 700,
                        fontSize: "1.15rem",
                      }}
                    >
                      Things to consider
                    </h2>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {flags.map((flag, index) => (
                        <li
                          key={index}
                          style={{
                            border: "2px solid #F59E0B",
                            borderRadius: "10px",
                            padding: "14px 16px",
                            backgroundColor: "#FFFBEB",
                            textAlign: "left",
                          }}
                        >
                          {flag.type ? (
                            <p
                              style={{
                                margin: "0 0 8px",
                                fontFamily: '"DM Sans", system-ui, sans-serif',
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color: "#B45309",
                              }}
                            >
                              {String(flag.type).replace(/_/g, " ")}
                            </p>
                          ) : null}
                          <p
                            style={{
                              margin: "0 0 8px",
                              color: "#78350F",
                              fontFamily: "Georgia, serif",
                              fontSize: "0.95rem",
                              fontStyle: "italic",
                              lineHeight: 1.45,
                            }}
                          >
                            {flag.excerpt || "—"}
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
                            <span style={{ fontWeight: 600 }}>Suggestion: </span>
                            {flag.suggestion || "—"}
                          </p>
                          {Array.isArray(flag.options) && flag.options.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              {flag.options.slice(0, 3).map((optionText, optionIndex) => {
                                const isSelected =
                                  selectedOptionByFlag[index] === optionIndex;
                                return (
                                  <button
                                    key={`${index}-${optionIndex}`}
                                    type="button"
                                    onClick={() => {
                                      const nextOptionText = optionText || "";
                                      setDraftEdit((prevDraft) => {
                                        const excerpt = flag.excerpt || "";
                                        if (excerpt && prevDraft.includes(excerpt)) {
                                          return prevDraft.replace(excerpt, nextOptionText);
                                        }

                                        if (!prevDraft.trim()) return nextOptionText;
                                        if (!nextOptionText.trim()) return prevDraft;
                                        return `${prevDraft} ${nextOptionText}`;
                                      });
                                      setLastInsertedText(nextOptionText);
                                      setSelectedOptionByFlag((prev) => ({
                                        ...prev,
                                        [index]: optionIndex,
                                      }));
                                    }}
                                    title={optionText || ""}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      borderRadius: "8px",
                                      border: isSelected
                                        ? "2px solid #2D6A2F"
                                        : "1px solid #2D6A2F",
                                      backgroundColor: isSelected ? "#ECFDF3" : "#FFFFFF",
                                      color: "#2C2C2C",
                                      padding: "10px 12px",
                                      cursor: "pointer",
                                      fontFamily: '"DM Sans", system-ui, sans-serif',
                                    }}
                                  >
                                    <span
                                      style={{
                                        display: "block",
                                        fontWeight: 700,
                                        color: "#2D6A2F",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Option {optionIndex + 1}
                                    </span>
                                    <span
                                      style={{
                                        display: "block",
                                        fontSize: "0.88rem",
                                        lineHeight: 1.45,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {optionText || "—"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveAndContinue}
              style={{
                width: "100%",
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
              Save and continue
            </button>
          </div>
        ) : null}

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

export default MissionFraming;
