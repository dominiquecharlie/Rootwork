function ProgramDesign() {
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
          maxWidth: "720px",
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
            margin: "0 0 10px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.9rem",
          }}
        >
          Design your program
        </h1>
        <p
          style={{
            margin: 0,
            color: "#6B7280",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "1rem",
          }}
        >
          We will build this out next
        </p>
      </section>
    </main>
  );
}

export default ProgramDesign;
