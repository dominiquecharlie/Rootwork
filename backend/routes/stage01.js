const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { agent01_missionFraming } = require("../agents/agent01_missionFraming");

const router = express.Router();

async function getAuthenticatedUser(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;

  if (!token) {
    res.status(401).json({ error: "Missing Authorization token." });
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    res.status(401).json({ error: "Invalid or expired auth token." });
    return null;
  }

  return user;
}

router.post("/mission-draft", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const body = req.body || {};
    const who = body.who_is_most_affected ?? body.whoIsMostAffected;
    const success = body.definition_of_success ?? body.definitionOfSuccess;
    const toc = body.theory_of_change ?? body.theoryOfChange;

    if (!who || !success || !toc) {
      return res.status(400).json({
        error:
          "Missing required fields: who_is_most_affected, definition_of_success, theory_of_change.",
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return res.status(400).json({ error: membershipError.message });
    }

    if (!membership) {
      return res.status(400).json({ error: "No organization membership found." });
    }

    const orgId = membership.org_id;

    const { error: upsertInputsError } = await supabase.from("org_profiles").upsert(
      {
        org_id: orgId,
        who_is_most_affected: who,
        definition_of_success: success,
        theory_of_change: toc,
      },
      { onConflict: "org_id" }
    );

    if (upsertInputsError) {
      return res.status(400).json({ error: upsertInputsError.message });
    }

    const agentResult = await agent01_missionFraming({
      orgId,
      userId: user.id,
      inputs: {
        who_is_most_affected: who,
        definition_of_success: success,
        theory_of_change: toc,
      },
    });

    const draftMissionStatement =
      typeof agentResult.draft_mission === "string"
        ? agentResult.draft_mission
        : "";
    const claudeMissionFlags = Array.isArray(agentResult.flags)
      ? agentResult.flags
      : [];

    const { error: upsertDraftError } = await supabase.from("org_profiles").upsert(
      {
        org_id: orgId,
        who_is_most_affected: who,
        definition_of_success: success,
        theory_of_change: toc,
        draft_mission_statement: draftMissionStatement,
        claude_mission_flags: claudeMissionFlags,
      },
      { onConflict: "org_id" }
    );

    if (upsertDraftError) {
      return res.status(400).json({ error: upsertDraftError.message });
    }

    return res.status(200).json({
      draft_mission: agentResult.draft_mission,
      draft_mission_statement: draftMissionStatement,
      flags: agentResult.flags || [],
      claude_mission_flags: claudeMissionFlags,
      parse_error: Boolean(agentResult.parse_error),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

module.exports = router;
