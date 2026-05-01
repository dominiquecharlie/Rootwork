import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StakeholderGarden from "../../components/StakeholderGarden";

const GAP_KEY = "stakeholder_gap_analysis";
const LIST_KEY = "stakeholder_list";

function parseStoredData() {
  const gapRaw = sessionStorage.getItem(GAP_KEY);
  const listRaw = sessionStorage.getItem(LIST_KEY);
  if (!gapRaw || !listRaw) return null;
  let gap;
  let list;
  try {
    gap = JSON.parse(gapRaw);
    list = JSON.parse(listRaw);
  } catch {
    return null;
  }
  if (!gap || typeof gap !== "object" || !Array.isArray(list)) return null;
  return { gap, list };
}

export default function StakeholderGardenResults() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [stakeholders, setStakeholders] = useState([]);

  useEffect(() => {
    const parsed = parseStoredData();
    if (!parsed) {
      navigate("/stage01/stakeholders", { replace: true });
      return;
    }
    setGapAnalysis(parsed.gap);
    setStakeholders(parsed.list);
    setHydrated(true);
  }, [navigate]);

  function handleMissingTypeClick(typeKey) {
    try {
      sessionStorage.setItem("stakeholder_prefill_type", String(typeKey));
    } catch {
      // ignore
    }
    navigate("/stage01/stakeholders");
  }

  if (!hydrated || !gapAnalysis) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          margin: 0,
        }}
      />
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
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "1000px",
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
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontSize: "1.75rem",
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Your stakeholder garden
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: "#F0F7F0",
            border: "1px solid #A8D4AA",
            color: "#2C2C2C",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "0.88rem",
            textAlign: "center",
          }}
        >
          Draft insights from your map. Verify before acting on any
          suggestion.
        </p>

        <StakeholderGarden
          gapAnalysis={gapAnalysis}
          stakeholders={stakeholders}
          onMissingTypeClick={handleMissingTypeClick}
          onAddMoreStakeholders={() => navigate("/stage01/stakeholders")}
          onContinueToProgramDesign={() => navigate("/stage01/documents")}
        />
      </section>
    </main>
  );
}
