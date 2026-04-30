import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function NewOrg() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("nonprofit");
  const [primaryGeography, setPrimaryGeography] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

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
    setIsSubmitting(false);

    setTimeout(() => {
      navigate("/dashboard", { replace: true });
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
