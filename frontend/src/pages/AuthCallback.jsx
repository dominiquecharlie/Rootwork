import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function confirmSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession();
        if (error) {
          navigate("/login", { replace: true });
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      navigate("/login", { replace: true });
    }

    confirmSession();
  }, [navigate]);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF9F7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "#2D6A2F",
          fontFamily: "\"DM Sans\", system-ui, sans-serif",
          fontSize: "1.1rem",
        }}
      >
        Signing you in...
      </p>
    </main>
  );
}

export default AuthCallback;
