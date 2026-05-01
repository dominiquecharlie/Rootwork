import { useNavigate } from "react-router-dom";

const dmSans = '"DM Sans", system-ui, sans-serif';

function StepCard({ stepLabel, title, body }) {
  return (
    <article
      style={{
        backgroundColor: "#FFFFFF",
        borderLeft: "4px solid #2D6A2F",
        borderRadius: "8px",
        padding: "24px",
        textAlign: "left",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        borderTop: "1px solid #E8E8E8",
        borderRight: "1px solid #E8E8E8",
        borderBottom: "1px solid #E8E8E8",
        borderLeft: "4px solid #2D6A2F",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          color: "#6B7280",
          fontFamily: dmSans,
          fontSize: "0.8rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {stepLabel}
      </p>
      <h3
        style={{
          margin: "0 0 12px",
          color: "#2D6A2F",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: "1.15rem",
          lineHeight: 1.35,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: "#2C2C2C",
          fontFamily: dmSans,
          fontSize: "0.95rem",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
    </article>
  );
}

function Stage02Intro() {
  const navigate = useNavigate();

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
          maxWidth: "720px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: "0 0 20px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.85rem",
            lineHeight: 1.25,
          }}
        >
          Stage 02: Listen
        </h1>

        <blockquote
          style={{
            margin: "0 auto 32px",
            maxWidth: "600px",
            padding: 0,
            border: "none",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "1.2rem",
            lineHeight: 1.55,
          }}
        >
          Before you build anything, you listen. This stage exists to make sure
          community priorities and funder requirements are both visible before
          any data collection begins.
        </blockquote>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          <StepCard
            stepLabel="Step 1"
            title="Upload your funder documents (optional)"
            body="If you have a Statement of Work, grant agreement, or funder reporting template, upload it here. Claude will extract what your funder requires you to measure. This surfaces the power dynamic before community engagement begins."
          />
          <StepCard
            stepLabel="Step 2"
            title="Generate community engagement templates"
            body="Based on your program context and funder requirements, Rootwork will generate interview guides, listening session formats, and survey outlines. Take these into your community."
          />
          <StepCard
            stepLabel="Step 3"
            title="Document what you learned"
            body="Come back after your community engagement. Document who was in the room, who was not, and what community members said in their own words. Rootwork will not let you move forward until this is done."
          />
        </div>

        <div
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #F59E0B",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "28px",
            textAlign: "left",
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              color: "#92400E",
              fontFamily: dmSans,
              fontWeight: 700,
              fontSize: "1.05rem",
            }}
          >
            The Hard Stop
          </h2>
          <p
            style={{
              margin: 0,
              color: "#92400E",
              fontFamily: dmSans,
              fontSize: "0.95rem",
              lineHeight: 1.55,
            }}
          >
            Stage 03 is locked until you document real community engagement. This
            is not a checkbox. The platform waits for you to do the work.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/stage02/sow")}
          style={{
            width: "100%",
            maxWidth: "360px",
            padding: "14px 20px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "#2D6A2F",
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: dmSans,
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          Begin Stage 02
        </button>
      </section>
    </main>
  );
}

export default Stage02Intro;
