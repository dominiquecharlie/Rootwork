import { useNavigate } from "react-router-dom";

function StakeholderEducation() {
  const navigate = useNavigate();

  const conceptCards = [
    {
      title: "Who is a stakeholder?",
      body: "Anyone affected by, accountable to, or involved in your program. This includes people your org serves, partners, funders, and government agencies.",
    },
    {
      title: "Who gets left out?",
      body: "The most important stakeholders are often missing from the map. Ask who is affected but not in the room, and why.",
    },
    {
      title: "Power matters",
      body: "Note who holds decision-making power and who doesn't. A stakeholder map that ignores power dynamics is incomplete.",
    },
  ];

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
          maxWidth: "980px",
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
            fontSize: "2rem",
          }}
        >
          Who shapes your work?
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            color: "#2C2C2C",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "1rem",
            lineHeight: 1.5,
          }}
        >
          Before mapping your stakeholders, let's make sure we're thinking about
          the full picture.
        </p>

        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            backgroundColor: "#2D6A2F",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#FFFFFF",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 0,
                height: 0,
                borderTop: "11px solid transparent",
                borderBottom: "11px solid transparent",
                borderLeft: "18px solid #FFFFFF",
              }}
            />
            <span>Video coming soon</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            marginBottom: "26px",
            textAlign: "left",
          }}
        >
          {conceptCards.map((card) => (
            <article
              key={card.title}
              style={{
                border: "1px solid #A8D4AA",
                borderRadius: "10px",
                backgroundColor: "#FFFFFF",
                padding: "16px",
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  color: "#2D6A2F",
                  fontFamily: "Georgia, serif",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                }}
              >
                {card.title}
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "#2C2C2C",
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: "0.95rem",
                  lineHeight: 1.55,
                }}
              >
                {card.body}
              </p>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate("/stage01/stakeholders")}
          style={{
            width: "100%",
            maxWidth: "360px",
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
          Start mapping stakeholders
        </button>
      </section>
    </main>
  );
}

export default StakeholderEducation;
