const { supabase } = require("../lib/supabaseClient");
const { hasCompleteEngagement, isReconciled } = require("../lib/stageGates");

async function requireCommunityVoice(req, res, next) {
  if (!req.user?.orgId) {
    return res.status(401).json({ error: "Unauthenticated." });
  }

  const { data, error } = await supabase
    .from("community_engagements")
    .select("who_was_present, who_was_absent, why_absent")
    .eq("org_id", req.user.orgId);

  if (error) {
    console.error("community_engagements lookup failed:", error.message);
    return res.status(500).json({
      error: "Could not verify community engagement documentation.",
    });
  }

  if (!hasCompleteEngagement(data)) {
    return res.status(403).json({
      error: "HARD_STOP_INCOMPLETE",
      message:
        "Community voice must be on record before collection can begin. Document who was present, who was absent, and why before continuing to Stage 03.",
    });
  }

  return next();
}

async function requireReconciliation(req, res, next) {
  if (!req.user?.orgId) {
    return res.status(401).json({ error: "Unauthenticated." });
  }

  const { data, error } = await supabase
    .from("program_design_reconciliations")
    .select("reconciliation_completed_at")
    .eq("org_id", req.user.orgId)
    .not("reconciliation_completed_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("program_design_reconciliations lookup failed:", error.message);
    return res.status(500).json({
      error: "Could not verify program design reconciliation.",
    });
  }

  if (!isReconciled(data)) {
    return res.status(403).json({
      error: "RECONCILIATION_INCOMPLETE",
      message:
        "Program design must be reconciled with community input before collection can begin. Complete Stage 02b reconciliation to continue.",
    });
  }

  return next();
}

module.exports = {
  requireCommunityVoice,
  requireReconciliation,
};
