function Stage02Intro() {
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
          maxWidth: "560px",
          textAlign: "center",
          fontFamily: '"DM Sans", system-ui, sans-serif',
          color: "#2C2C2C",
        }}
      >
        <h1
          style={{
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontSize: "1.75rem",
            margin: "0 0 12px",
          }}
        >
          Stage 02
        </h1>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          This intro page is a placeholder. More content will ship here soon.
        </p>
      </section>
    </main>
  );
}

export default Stage02Intro;
