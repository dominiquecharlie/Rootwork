import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RootsLoader from "../../components/RootsLoader";
import { supabase } from "../../lib/supabaseClient";

const stakeholderTypeOptions = [
  "community_member",
  "partner_org",
  "government_agency",
  "funder",
  "other",
];

const relationshipOptions = [
  "affected_by",
  "accountable_to",
  "funding",
  "partnering",
  "other",
];

function StakeholderListCards({ stakeholders, onDelete }) {
  if (stakeholders.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          textAlign: "center",
          color: "#6B7280",
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}
      >
        No stakeholders added yet.
      </p>
    );
  }

  return stakeholders.map((stakeholder) => {
    const isDecisionMaker = Boolean(
      stakeholder.in_decision_making_role ?? stakeholder.is_decision_maker
    );
    return (
      <article
        key={stakeholder.id}
        style={{
          border: "1px solid #E3E3E3",
          borderLeft: "4px solid #2D6A2F",
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 6px",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontSize: "1.05rem",
            }}
          >
            {stakeholder.name || "Unnamed stakeholder"}
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                backgroundColor: "#A8D4AA",
                color: "#2D6A2F",
                borderRadius: "999px",
                padding: "4px 8px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.76rem",
                fontWeight: 600,
              }}
            >
              {stakeholder.stakeholder_type || "other"}
            </span>
            <span
              style={{
                backgroundColor: "#A8D4AA",
                color: "#2D6A2F",
                borderRadius: "999px",
                padding: "4px 8px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.76rem",
                fontWeight: 600,
              }}
            >
              {stakeholder.relationship_to_program || "other"}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              color: isDecisionMaker ? "#2D6A2F" : "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            {isDecisionMaker ? "Decision maker" : "Affected by decisions"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onDelete(stakeholder.id)}
          style={{
            padding: 0,
            border: "none",
            backgroundColor: "transparent",
            color: "#B42318",
            cursor: "pointer",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontWeight: 700,
            textDecoration: "underline",
          }}
        >
          Remove
        </button>
      </article>
    );
  });
}

function StakeholderMap() {
  const navigate = useNavigate();
  const [stakeholders, setStakeholders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [continueError, setContinueError] = useState("");
  const [isGapAnalysisRunning, setIsGapAnalysisRunning] = useState(false);
  const [form, setForm] = useState({
    name: "",
    stakeholder_type: "community_member",
    relationship_to_program: "affected_by",
    is_decision_maker: false,
    notes: "",
  });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadStakeholders() {
    setError("");
    setIsLoading(true);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage01/stakeholders`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let backendError = "Could not load stakeholders.";
        try {
          const payload = await response.json();
          if (payload?.error) backendError = payload.error;
        } catch {
          // ignore parse failures
        }
        throw new Error(backendError);
      }

      const payload = await response.json();
      const list = Array.isArray(payload?.stakeholders)
        ? payload.stakeholders
        : Array.isArray(payload)
          ? payload
          : [];
      setStakeholders(list);
    } catch (loadError) {
      setError(loadError.message || "Could not load stakeholders.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadStakeholders();
  }, []);

  function resetForm() {
    setForm({
      name: "",
      stakeholder_type: "community_member",
      relationship_to_program: "affected_by",
      is_decision_maker: false,
      notes: "",
    });
  }

  async function handleAddStakeholder(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setContinueError("");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage01/stakeholders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        let backendError = "Could not add stakeholder.";
        try {
          const payload = await response.json();
          if (payload?.error) backendError = payload.error;
        } catch {
          // ignore parse failures
        }
        throw new Error(backendError);
      }

      await loadStakeholders();
      resetForm();
      setIsAdding(false);
    } catch (saveError) {
      setError(saveError.message || "Could not add stakeholder.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteStakeholder(id) {
    setError("");
    setContinueError("");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage01/stakeholders/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let backendError = "Could not delete stakeholder.";
        try {
          const payload = await response.json();
          if (payload?.error) backendError = payload.error;
        } catch {
          // ignore parse failures
        }
        throw new Error(backendError);
      }

      setStakeholders((prev) => prev.filter((stakeholder) => stakeholder.id !== id));
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete stakeholder.");
    }
  }

  async function handleSaveAndContinue() {
    if (stakeholders.length < 2) {
      setContinueError("Add at least 2 stakeholders before continuing.");
      return;
    }
    setError("");
    setContinueError("");
    setIsGapAnalysisRunning(true);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      setIsGapAnalysisRunning(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage01/stakeholder-gap`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let backendError = "Could not run stakeholder gap analysis.";
        try {
          const payload = await response.json();
          if (payload?.error) backendError = payload.error;
        } catch {
          // ignore parse failures
        }
        throw new Error(backendError);
      }

      const payload = await response.json();
      const next = {
        power_gaps: Array.isArray(payload?.power_gaps)
          ? payload.power_gaps
          : [],
        missing_stakeholder_types: Array.isArray(
          payload?.missing_stakeholder_types
        )
          ? payload.missing_stakeholder_types
          : [],
        questions_to_consider: Array.isArray(
          payload?.questions_to_consider
        )
          ? payload.questions_to_consider
          : [],
      };
      try {
        sessionStorage.setItem(
          "stakeholder_gap_analysis",
          JSON.stringify(next)
        );
      } catch {
        // ignore quota or privacy mode
      }
      try {
        sessionStorage.setItem(
          "stakeholder_list",
          JSON.stringify(stakeholders)
        );
      } catch {
        // ignore quota or privacy mode
      }
      navigate("/stage01/garden");
    } catch (gapError) {
      setError(
        gapError.message || "Could not run stakeholder gap analysis."
      );
    } finally {
      setIsGapAnalysisRunning(false);
    }
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
          maxWidth: "760px",
          backgroundColor: "#FAF9F7",
          border: "1px solid #A8D4AA",
          borderRadius: "12px",
          padding: "28px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontSize: "1.75rem",
            textAlign: "center",
          }}
        >
          Map your stakeholders
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            color: "#2C2C2C",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "0.95rem",
            textAlign: "center",
          }}
        >
          Add everyone who is affected by, accountable to, or involved in your
          program. Be honest about who holds power and who doesn't.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => {
              setIsAdding((prev) => !prev);
              setError("");
              setContinueError("");
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2D6A2F",
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            {isAdding ? "Cancel" : "Add stakeholder"}
          </button>
        </div>

        {isAdding ? (
          <form
            onSubmit={handleAddStakeholder}
            style={{
              border: "1px solid #A8D4AA",
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <label
              htmlFor="stakeholderName"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
              }}
            >
              Name or group
            </label>
            <p
              style={{
                margin: "0 0 8px",
                color: "#6B7280",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.84rem",
              }}
            >
              This can be an individual, a community group, or an organization
            </p>
            <input
              id="stakeholderName"
              required
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              style={{
                width: "100%",
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #A8D4AA",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                boxSizing: "border-box",
              }}
            />

            <label
              htmlFor="stakeholderType"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
              }}
            >
              What best describes them?
            </label>
            <select
              id="stakeholderType"
              value={form.stakeholder_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  stakeholder_type: event.target.value,
                }))
              }
              style={{
                width: "100%",
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #A8D4AA",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                boxSizing: "border-box",
              }}
            >
              {stakeholderTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label
              htmlFor="stakeholderRelationship"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
              }}
            >
              How are they connected to your program?
            </label>
            <select
              id="stakeholderRelationship"
              value={form.relationship_to_program}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  relationship_to_program: event.target.value,
                }))
              }
              style={{
                width: "100%",
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #A8D4AA",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                boxSizing: "border-box",
              }}
            >
              {relationshipOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
              }}
            >
              Do they hold decision-making power in your program?
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    is_decision_maker: true,
                  }))
                }
                style={{
                  textAlign: "left",
                  borderRadius: "8px",
                  border: form.is_decision_maker
                    ? "2px solid #2D6A2F"
                    : "1px solid #A8D4AA",
                  backgroundColor: form.is_decision_maker ? "#F0F7F0" : "#FFFFFF",
                  color: "#2C2C2C",
                  padding: "12px",
                  cursor: "pointer",
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontWeight: 600,
                }}
              >
                Yes, they help make decisions
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    is_decision_maker: false,
                  }))
                }
                style={{
                  textAlign: "left",
                  borderRadius: "8px",
                  border: !form.is_decision_maker
                    ? "2px solid #2D6A2F"
                    : "1px solid #A8D4AA",
                  backgroundColor: !form.is_decision_maker ? "#F0F7F0" : "#FFFFFF",
                  color: "#2C2C2C",
                  padding: "12px",
                  cursor: "pointer",
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontWeight: 600,
                }}
              >
                No, they are affected by decisions
              </button>
            </div>

            <label
              htmlFor="stakeholderNotes"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
              }}
            >
              Anything else to note?
            </label>
            <p
              style={{
                margin: "0 0 8px",
                color: "#6B7280",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.84rem",
              }}
            >
              Power dynamics, barriers to participation, or context that matters
            </p>
            <textarea
              id="stakeholderNotes"
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              style={{
                width: "100%",
                minHeight: "90px",
                marginBottom: "12px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #A8D4AA",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={isSaving}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2D6A2F",
                color: "#FFFFFF",
                cursor: isSaving ? "not-allowed" : "pointer",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
              }}
            >
              {isSaving ? "Saving..." : "Save stakeholder"}
            </button>
          </form>
        ) : null}

        {isLoading ? (
          <p
            style={{
              margin: 0,
              textAlign: "center",
              color: "#2C2C2C",
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            Loading stakeholders...
          </p>
        ) : isGapAnalysisRunning ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px 48px",
            }}
          >
            <p
              style={{
                margin: "0 0 20px",
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.2rem",
              }}
            >
              Mapping your garden...
            </p>
            <RootsLoader />
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            <StakeholderListCards
              stakeholders={stakeholders}
              onDelete={handleDeleteStakeholder}
            />
          </div>
        )}

        {error ? (
          <p
            style={{
              marginTop: "14px",
              color: "#B42318",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              textAlign: "center",
            }}
          >
            {error}
          </p>
        ) : null}
        {!isLoading && !isGapAnalysisRunning ? (
          <button
            type="button"
            onClick={handleSaveAndContinue}
            style={{
              width: "100%",
              marginTop: "16px",
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
            Save and continue
          </button>
        ) : null}
        {continueError ? (
          <p
            style={{
              marginTop: "10px",
              color: "#B42318",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              textAlign: "center",
            }}
          >
            {continueError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default StakeholderMap;
