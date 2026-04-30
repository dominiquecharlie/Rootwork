import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [devMagicLink, setDevMagicLink] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");
    setDevMagicLink("");

    if (import.meta.env.DEV) {
      const response = await fetch("http://localhost:4000/api/dev/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error || "Could not generate magic link.");
        setIsSubmitting(false);
        return;
      }

      setMessage("Dev magic link generated. Open the link below.");
      setDevMagicLink(payload?.action_link || "");
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Check your email for a magic login link.");
    setEmail("");
    setIsSubmitting(false);
  }

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
          maxWidth: "440px",
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
          Rootwork Login
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            color: "#2C2C2C",
            fontFamily: "\"DM Sans\", system-ui, sans-serif",
          }}
        >
          Enter your email to receive a magic link.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#2C2C2C",
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
              fontSize: "0.95rem",
            }}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.org"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #A8D4AA",
              marginBottom: "14px",
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
              boxSizing: "border-box",
            }}
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
            {isSubmitting ? "Sending..." : "Send magic link"}
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

        {devMagicLink ? (
          <p
            style={{
              marginTop: "10px",
              fontFamily: "\"DM Sans\", system-ui, sans-serif",
              wordBreak: "break-all",
            }}
          >
            <a href={devMagicLink} style={{ color: "#2D6A2F" }}>
              Open magic link
            </a>
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

export default Login;
