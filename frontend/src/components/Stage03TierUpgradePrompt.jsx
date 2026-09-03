const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const amberBorder = "#F59E0B";
const amberBrown = "#92400E";

function Stage03TierUpgradePrompt({ message, style }) {
  return (
    <div
      style={{
        marginBottom: "20px",
        padding: "16px",
        borderRadius: "8px",
        backgroundColor: "#FEF3C7",
        border: `1px solid ${amberBorder}`,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <h2
        style={{
          margin: "0 0 10px",
          color: amberBrown,
          fontFamily: georgia,
          fontWeight: 700,
          fontSize: "1.1rem",
          lineHeight: 1.3,
        }}
      >
        Upgrade to unlock this feature
      </h2>
      <p
        style={{
          margin: "0 0 14px",
          color: amberBrown,
          fontFamily: dmSans,
          fontSize: "0.95rem",
          lineHeight: 1.55,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={() => {}}
        style={{
          cursor: "pointer",
          padding: "10px 18px",
          borderRadius: "8px",
          border: `2px solid ${amberBorder}`,
          backgroundColor: "transparent",
          color: amberBrown,
          fontFamily: dmSans,
          fontWeight: 600,
          fontSize: "0.88rem",
          lineHeight: 1.35,
        }}
      >
        Upgrade to Starter
      </button>
    </div>
  );
}

export default Stage03TierUpgradePrompt;
