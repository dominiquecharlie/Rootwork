const { supabase } = require("../lib/supabaseClient");

/**
 * Restricts a route to orgs whose organizations.tier is one of the allowed values.
 * Use after authenticateUser so req.user.orgId is set.
 *
 * @param {...string} allowedTiers e.g. requireTier("starter", "growth", "enterprise")
 */
function requireTier(...allowedTiers) {
  const requiredTiers = allowedTiers.filter(
    (t) => typeof t === "string" && t.trim().length > 0
  );
  const allowedSet = new Set(requiredTiers);

  return async function tierGateMiddleware(req, res, next) {
    if (requiredTiers.length === 0) {
      console.error("requireTier() was called with no tier names.");
      return res.status(500).json({ error: "Server misconfiguration." });
    }

    if (!req.user?.orgId) {
      return res.status(401).json({ error: "Unauthenticated." });
    }

    const { data: org, error } = await supabase
      .from("organizations")
      .select("tier")
      .eq("id", req.user.orgId)
      .maybeSingle();

    if (error || !org) {
      return res.status(403).json({
        error: "TIER_GATE",
        message:
          "Could not verify subscription tier. This feature requires Starter, Growth, or Enterprise.",
        currentTier: null,
        requiredTiers,
      });
    }

    const currentTier =
      typeof org.tier === "string" && org.tier.trim()
        ? org.tier.trim()
        : "freemium";

    if (allowedSet.has(currentTier)) {
      return next();
    }

    const starterGrowthEnterprise = new Set(["starter", "growth", "enterprise"]);
    const allPaid =
      requiredTiers.length === 3 &&
      requiredTiers.every((t) => starterGrowthEnterprise.has(t));
    const tierLabel =
      requiredTiers.length === 1
        ? requiredTiers[0]
        : requiredTiers.join(", ");

    const upgradeMessage = allPaid
      ? "This feature requires a Starter, Growth, or Enterprise plan. Upgrade your workspace to continue."
      : `This feature requires ${tierLabel} or higher.`;

    return res.status(403).json({
      error: "TIER_GATE",
      message: upgradeMessage,
      currentTier,
      requiredTiers,
    });
  };
}

module.exports = { requireTier };
