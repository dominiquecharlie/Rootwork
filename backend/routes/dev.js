const express = require("express");
const { supabase } = require("../lib/supabaseClient");

const router = express.Router();

router.post("/magic-link", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found." });
  }

  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const redirectTo =
    process.env.DEV_AUTH_REDIRECT_URL || "http://localhost:5173/auth/callback";

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const originalActionLink = data?.properties?.action_link || null;
  let actionLink = originalActionLink;

  // Supabase can fall back to SITE_URL if redirect allow-list is not configured.
  // In dev, force the returned URL to our callback so it opens the local app.
  if (actionLink) {
    const parsed = new URL(actionLink);
    parsed.searchParams.set("redirect_to", redirectTo);
    actionLink = parsed.toString();
  }

  return res.json({
    action_link: actionLink,
    original_action_link: originalActionLink,
  });
});

module.exports = router;
