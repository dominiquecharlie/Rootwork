import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function NewOrg() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("nonprofit");
  const [primaryGeography, setPrimaryGeography] = useState("");
  const [orgPhase, setOrgPhase] = useState("");
  const [orgPhaseError, setOrgPhaseError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");
    setOrgPhaseError("");

    if (!orgPhase) {
      setOrgPhaseError("Please select where you are starting from");
      setIsSubmitting(false);
      return;
    }

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

    const response = await fetch(`${apiBaseUrl}/api/orgs/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: orgName,
        orgType,
        primaryGeography,
        org_phase: orgPhase,
      }),
    });

    if (!response.ok) {
      let backendError = "Could not create organization. Please try again.";
      try {
        const errorPayload = await response.json();
        if (errorPayload?.error) {
          backendError = errorPayload.error;
        }
      } catch (_error) {
        // Ignore JSON parse errors and keep fallback message.
      }

      setError(backendError);
      setIsSubmitting(false);
      return;
    }

    setMessage("Organization created successfully.");
    setOrgName("");
    setOrgType("nonprofit");
    setPrimaryGeography("");
    setOrgPhase("");
    setIsSubmitting(false);

    setTimeout(() => {
      navigate("/stage01/mission", { replace: true });
    }, 400);
  }

  const fieldLabelStyle = {
    display: "block",
    marginBottom: "8px",
    color: "#2C2C2C",
    fontFamily: "\"DM Sans\", system-ui, sans-serif",
    fontSize: "0.95rem",
    textAlign: "left",
  };

  const fieldInputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #A8D4AA",
    marginBottom: "14px",
    fontFamily: "\"DM Sans\", system-ui, sans-serif",
    boxSizing: "border-box",
    backgroundColor: "#FFFFFF",
    color: "#2C2C2C",
  };

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
      <section
        style={{
          width: "100%",
          maxWidth: "560px",
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
            margin: "0 0 12px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontSize: "2rem",
          }}
        >
          Set up your organization
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            color: "#2C2C2C",
            fontFamily: "\"DM Sans\", system-ui, sans-serif",
          }}
        >
          Add your organization details to begin onboarding.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="orgName" style={fieldLabelStyle}>
            Organization name
          </label>
          <input
            id="orgName"
            name="orgName"
            type="text"
            required
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            style={fieldInputStyle}
          />

          <label htmlFor="orgType" style={fieldLabelStyle}>
            Organization type
          </label>
          <select
            id="orgType"
            name="orgType"
            value={orgType}
            onChange={(event) => setOrgType(event.target.value)}
            style={fieldInputStyle}
          >
            <option value="nonprofit">nonprofit</option>
            <option value="grassroots">grassroots</option>
            <option value="government">government</option>
            <option value="foundation">foundation</option>
            <option value="cbo">cbo</option>
            <option value="other">other</option>
          </select>

          <label htmlFor="primaryGeography" style={fieldLabelStyle}>
            Primary geography
          </label>
          <input
            id="primaryGeography"
            name="primaryGeography"
            type="text"
            required
            placeholder="City, county, or region"
            value={primaryGeography}
            onChange={(event) => setPrimaryGeography(event.target.value)}
            style={fieldInputStyle}
          />

          <label style={fieldLabelStyle}>Where are you starting from?</label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            {[
              {
                value: "scratch",
                title: "Building from scratch",
                description:
                  "You're a new or early-stage organization ready to build your mission, stakeholders, and program design for the first time.",
              },
              {
                value: "audit",
                title: "Auditing an existing program",
                description:
                  "You have a program already running and want to bring it into Rootwork to audit, rebuild, and strengthen your data infrastructure.",
              },
              {
                value: "new_program",
                title: "Launching a new program",
                description:
                  "Your organization is established but you're starting a new program and want to build it right from the beginning.",
              },
            ].map((option) => {
              const isSelected = orgPhase === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setOrgPhase(option.value);
                    setOrgPhaseError("");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderRadius: "10px",
                    border: isSelected
                      ? "2px solid #2D6A2F"
                      : "1px solid #A8D4AA",
                    backgroundColor: isSelected ? "#F0F7F0" : "#FFFFFF",
                    padding: "14px",
                    cursor: "pointer",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      color: "#2D6A2F",
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "1rem",
                    }}
                  >
                    {option.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#2C2C2C",
                      fontFamily: "\"DM Sans\", system-ui, sans-serif",
                      fontSize: "0.9rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
          {orgPhaseError ? (
            <p
              style={{
                margin: "-4px 0 12px",
                color: "#B42318",
                fontFamily: "\"DM Sans\", system-ui, sans-serif",
                fontSize: "0.9rem",
                textAlign: "left",
              }}
            >
              {orgPhaseError}
            </p>
          ) : null}

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
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "Creating..." : "Create organization"}
          </button>
        </form>

        {message ? (
          <p
            style={{
              marginTop: "14px",
              color: "#2D6A2F",
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
            }}
          >
            {message}
          </p>
        ) : null}

        {error ? (
          <p
            style={{
              marginTop: "14px",
              color: "#B42318",
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
            }}
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default NewOrg;
