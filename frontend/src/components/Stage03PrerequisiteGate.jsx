import { Link } from "react-router-dom";

const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";
const mintBorder = "#A8D4AA";

function Stage03PrerequisiteGate({ kind, message }) {
  const isHardStop = kind === "hard_stop";
  const heading = isHardStop
    ? "Community voice comes first"
    : "Reconciliation comes first";
  const ctaLabel = isHardStop
    ? "Go to community engagement documentation"
    : "Go to program reconciliation";
  const ctaTo = isHardStop
    ? "/stage02/document-engagement"
    : "/stage02b/reconcile";

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF9F7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "640px",
          textAlign: "center",
          backgroundColor: "#F0F7F0",
          border: `1px solid ${mintBorder}`,
          borderRadius: "12px",
          padding: "36px 28px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 16px",
            color: green,
            fontFamily: georgia,
            fontWeight: 700,
            fontSize: "1.75rem",
            lineHeight: 1.3,
          }}
        >
          {heading}
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: bodyDark,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <Link
          to={ctaTo}
          style={{
            display: "inline-block",
            padding: "12px 20px",
            borderRadius: "8px",
            backgroundColor: green,
            color: "#FFFFFF",
            fontFamily: dmSans,
            fontWeight: 600,
            fontSize: "0.95rem",
            textDecoration: "none",
          }}
        >
          {ctaLabel}
        </Link>
        <p
          style={{
            margin: "20px 0 0",
            color: muted,
            fontFamily: dmSans,
            fontSize: "0.85rem",
            lineHeight: 1.5,
          }}
        >
          Stage 03 opens once this step is complete. This is not a failure. It is
          the order Rootwork is built on.
        </p>
      </section>
    </main>
  );
}

export default Stage03PrerequisiteGate;
