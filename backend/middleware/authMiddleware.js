const { supabase } = require("../lib/supabaseClient");

/**
 * Verifies Bearer JWT and attaches the caller's primary org membership to req.user.
 * Expect Authorization: Bearer <access_token>
 */
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace(/^Bearer\s+/i, "").trim()
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization token." });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("org_members lookup failed:", membershipError.message);
    return res.status(500).json({ error: "Could not verify organization membership." });
  }

  if (!membership) {
    return res.status(403).json({ error: "No organization membership found." });
  }

  req.user = {
    id: user.id,
    userId: user.id,
    orgId: membership.org_id,
    role: membership.role,
  };

  return next();
}

module.exports = { authenticateUser };
