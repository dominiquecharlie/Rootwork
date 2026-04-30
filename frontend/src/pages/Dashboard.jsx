import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const stageCards = [
  { key: "01", label: "Onboard" },
  { key: "02_sow", label: "Upload SOW" },
  { key: "02_templates", label: "Engagement Templates" },
  { key: "02_hardstop", label: "Community Engagement" },
  { key: "02b", label: "Reconcile" },
  { key: "03", label: "Collect" },
  { key: "04", label: "Analyze" },
  { key: "05", label: "Connect" },
];

const stageRoutes = {
  "01": "/stage01/mission",
  "02_sow": "/stage02/sow",
  "02_templates": "/stage02/templates",
  "02_hardstop": "/stage02/hardstop",
  "02b": "/stage02b/reconcile",
  "03": "/stage03/collect",
  "04": "/stage04/analyze",
  "05": "/stage05/connect",
};

function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [stageProgress, setStageProgress] = useState([]);

  useEffect(() => {
    async function loadOrgData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          navigate("/login", { replace: true });
          return;
        }

        const apiBaseUrl =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

        const response = await fetch(`${apiBaseUrl}/api/orgs/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          navigate("/onboarding", { replace: true });
          return;
        }

        const payload = await response.json();

        if (!payload?.org) {
          navigate("/onboarding", { replace: true });
          return;
        }

        setOrg(payload.org);
        setStageProgress(payload.stageProgress || payload.stage_progress || []);
        setIsLoading(false);
      } catch (_error) {
        navigate("/onboarding", { replace: true });
      }
    }

    loadOrgData();
  }, [navigate]);

  if (isLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "\"DM Sans\", system-ui, sans-serif",
          color: "#2C2C2C",
        }}
      >
        Loading...
      </main>
    );
  }

  function normalizeStatus(rawStatus) {
    if (rawStatus === "in_progress") return "in_progress";
    if (rawStatus === "completed" || rawStatus === "complete") return "complete";
    if (rawStatus === "not_started") return "not_started";
    return "locked";
  }

  function statusBorderColor(status) {
    if (status === "in_progress") return "#2D6A2F";
    if (status === "complete") return "#2C2C2C";
    return "#A8D4AA";
  }

  function renderStatusIcon(status) {
    if (status === "in_progress") {
      return (
        <div
          aria-hidden="true"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "999px",
            backgroundColor: "#2D6A2F",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-35%, -50%)",
              width: 0,
              height: 0,
              borderTop: "5px solid transparent",
              borderBottom: "5px solid transparent",
              borderLeft: "8px solid #FFFFFF",
            }}
          />
        </div>
      );
    }

    if (status === "complete") {
      return (
        <div
          aria-hidden="true"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "999px",
            backgroundColor: "#2D6A2F",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "6px",
              height: "11px",
              borderRight: "2px solid #FFFFFF",
              borderBottom: "2px solid #FFFFFF",
              transform: "translate(-45%, -60%) rotate(42deg)",
            }}
          />
        </div>
      );
    }

    if (status === "not_started") {
      return (
        <div
          aria-hidden="true"
          style={{
            width: "22px",
            height: "24px",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "8px",
              top: "0px",
              width: "8px",
              height: "8px",
              border: "2px solid #A8D4AA",
              borderBottom: "none",
              borderRadius: "8px 8px 0 0",
              transform: "rotate(16deg)",
              transformOrigin: "left bottom",
              backgroundColor: "transparent",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "3px",
              bottom: "0px",
              width: "16px",
              height: "12px",
              border: "2px solid #A8D4AA",
              borderRadius: "2px",
              backgroundColor: "transparent",
            }}
          />
        </div>
      );
    }

    return (
      <div
        aria-hidden="true"
        style={{
          width: "22px",
          height: "24px",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "5px",
            top: "0px",
            width: "8px",
            height: "8px",
            border: "2px solid #6B7280",
            borderBottom: "none",
            borderRadius: "8px 8px 0 0",
            backgroundColor: "transparent",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "3px",
            bottom: "0px",
            width: "16px",
            height: "12px",
            border: "2px solid #6B7280",
            borderRadius: "2px",
            backgroundColor: "#6B7280",
          }}
        />
      </div>
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF9F7",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 24px",
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
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              border: "1px solid #2D6A2F",
              borderRadius: "8px",
              backgroundColor: "transparent",
              color: "#2D6A2F",
              padding: "6px 10px",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "0.86rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
        <h1
          style={{
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            margin: "0 0 20px",
          }}
        >
          {org?.name}
        </h1>

        <div
          style={{
            display: "grid",
            gap: "14px",
            justifyItems: "center",
          }}
        >
          {stageCards.map((stage) => {
            const matchedStage = stageProgress.find((entry) => entry.stage === stage.key);
            const status = normalizeStatus(matchedStage?.status);
            const isClickable = status === "in_progress" || status === "complete";
            const stageRoute = stageRoutes[stage.key];

            return (
              <article
                key={stage.key}
                onClick={() => {
                  if (isClickable && stageRoute) {
                    navigate(stageRoute);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && isClickable && stageRoute) {
                    navigate(stageRoute);
                  }
                }}
                style={{
                  width: "100%",
                  maxWidth: "620px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E3E3E3",
                  borderLeft: `4px solid ${statusBorderColor(status)}`,
                  borderRadius: "10px",
                  padding: "14px 16px",
                  textAlign: "left",
                  boxSizing: "border-box",
                  cursor: isClickable ? "pointer" : "not-allowed",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#2D6A2F",
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                    }}
                  >
                    {stage.label}
                  </h3>
                </div>
                {renderStatusIcon(status)}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
