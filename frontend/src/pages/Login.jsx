import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setMessage("");

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
          backgroundColor: "#FFFFFF",
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
