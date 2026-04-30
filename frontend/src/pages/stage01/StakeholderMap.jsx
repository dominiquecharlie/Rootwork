import { useEffect, useState } from "react";
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

function StakeholderMap() {
  const [stakeholders, setStakeholders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
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
          Stakeholder mapping
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
          Add the people and organizations connected to your program.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => {
              setIsAdding((prev) => !prev);
              setError("");
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
              Name
            </label>
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
              Stakeholder type
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
              Relationship to program
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
              htmlFor="isDecisionMaker"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
                color: "#2C2C2C",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.95rem",
              }}
            >
              <input
                id="isDecisionMaker"
                type="checkbox"
                checked={form.is_decision_maker}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    is_decision_maker: event.target.checked,
                  }))
                }
              />
              In a decision-making role?
            </label>

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
              Notes
            </label>
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
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {stakeholders.length === 0 ? (
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
            ) : (
              stakeholders.map((stakeholder) => (
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
                  <div>
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
                    <p
                      style={{
                        margin: "0 0 4px",
                        color: "#2C2C2C",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: "0.9rem",
                      }}
                    >
                      Type: {stakeholder.stakeholder_type || "other"}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: "#2C2C2C",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: "0.9rem",
                      }}
                    >
                      Relationship: {stakeholder.relationship_to_program || "other"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteStakeholder(stakeholder.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #FCA5A5",
                      backgroundColor: "#FEF2F2",
                      color: "#B42318",
                      cursor: "pointer",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
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
      </section>
    </main>
  );
}

export default StakeholderMap;
