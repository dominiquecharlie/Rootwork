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
    return "not_started";
  }

  function statusBorderColor(status) {
    if (status === "in_progress") return "#2D6A2F";
    if (status === "complete") return "#2C2C2C";
    return "#A8D4AA";
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

            return (
              <article
                key={stage.key}
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
                }}
              >
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
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#2C2C2C",
                    fontFamily: "\"DM Sans\", system-ui, sans-serif",
                    fontSize: "0.95rem",
                  }}
                >
                  {status}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
