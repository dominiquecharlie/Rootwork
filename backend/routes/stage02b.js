const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { agent07_tensionSurfacing } = require("../agents/agent07_tensionSurfacing");

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

async function getOrgIdForUser(userId) {
  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message };
  }

  if (!membership) {
    return { error: "No organization membership found." };
  }

  return { orgId: membership.org_id };
}

async function loadStage02bPayload(orgId) {
  const { data: metrics } = await supabase
    .from("funder_metrics")
    .select(
      "id, metric_name, metric_description, metric_type, reporting_frequency, source"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: engagementRows } = await supabase
    .from("community_engagements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  const engagement = engagementRows?.[0] || null;

  let voice_records = [];
  if (engagement?.id) {
    const { data: voices } = await supabase
      .from("community_voice_records")
      .select("*")
      .eq("org_id", orgId)
      .eq("engagement_id", engagement.id)
      .order("created_at", { ascending: true })
      .limit(3);
    voice_records = voices || [];
  }

  const { data: designRows } = await supabase
    .from("program_designs")
    .select("*")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const program_design = designRows?.[0] || null;

  const { data: recRows } = await supabase
    .from("program_design_reconciliations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  const reconciliation = recRows?.[0] || null;

  return {
    funder_metrics: metrics || [],
    engagement,
    voice_records,
    program_design,
    reconciliation,
  };
}

function normalizeResponsesPayload(responses, tensionCount) {
  let list = [];
  if (Array.isArray(responses)) {
    list = responses.map((x) =>
      typeof x === "string" ? x : String(x ?? "")
    );
  } else if (responses && typeof responses === "object") {
    list = Object.keys(responses)
      .filter((k) => /^\d+$/.test(String(k)))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => {
        const v = responses[k];
        return typeof v === "string" ? v : String(v ?? "");
      });
  }
  const n = Math.max(0, Number(tensionCount) || 0);
  return Array.from({ length: n }, (_, i) =>
    typeof list[i] === "string" ? list[i] : ""
  );
}

function buildDecisionsDocument(responses, generalNotes) {
  return {
    responses,
    general_notes:
      typeof generalNotes === "string" ? generalNotes : String(generalNotes ?? ""),
  };
}

async function getLatestIncompleteReconciliation(orgId) {
  const { data, error } = await supabase
    .from("program_design_reconciliations")
    .select("*")
    .eq("org_id", orgId)
    .is("reconciliation_completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { row: null, error: error.message };
  }
  return { row: data || null, error: null };
}

router.get("/context", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const payload = await loadStage02bPayload(orgId);
    return res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/surface-tensions", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const payload = await loadStage02bPayload(orgId);

    let result;
    try {
      result = await agent07_tensionSurfacing({
        orgId,
        userId: user.id,
        funder_metrics: payload.funder_metrics,
        engagement: payload.engagement,
        voice_records: payload.voice_records,
        program_design: payload.program_design,
      });
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Could not surface tensions.",
      });
    }

    const tensions = result.tensions || [];
    if (tensions.length === 0) {
      return res.status(400).json({
        error:
          "No tensions were produced. Add funder metrics, community documentation, and program design, then try again.",
      });
    }

    await supabase
      .from("program_design_reconciliations")
      .delete()
      .eq("org_id", orgId)
      .is("reconciliation_completed_at", null);

    const programDesignId = payload.program_design?.id || null;

    const { data: row, error: insertErr } = await supabase
      .from("program_design_reconciliations")
      .insert({
        org_id: orgId,
        previous_program_design_id: programDesignId,
        reconciled_program_design_id: null,
        tensions,
        decisions: [],
        reconciliation_completed_at: null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertErr) {
      return res.status(400).json({ error: insertErr.message });
    }

    return res.status(201).json({ reconciliation: row, tensions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/save-responses", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const b = req.body || {};
    const generalNotes =
      typeof b.general_notes === "string" ? b.general_notes : "";
    const responses = b.responses;

    const { row, error: findErr } = await getLatestIncompleteReconciliation(
      orgId
    );
    if (findErr) {
      return res.status(400).json({ error: findErr });
    }
    if (!row) {
      return res.status(400).json({
        error: "No in-progress reconciliation found for this organization.",
      });
    }

    const n = Array.isArray(row.tensions) ? row.tensions.length : 0;
    const padded = normalizeResponsesPayload(responses, n);
    const decisions = buildDecisionsDocument(padded, generalNotes);

    const { error: upErr } = await supabase
      .from("program_design_reconciliations")
      .update({ decisions })
      .eq("id", row.id)
      .eq("org_id", orgId);

    if (upErr) {
      return res.status(400).json({ error: upErr.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/complete-reconciliation", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const b = req.body || {};
    const generalNotes =
      typeof b.general_notes === "string" ? b.general_notes : "";
    const responses = b.responses;

    const { row, error: findErr } = await getLatestIncompleteReconciliation(
      orgId
    );
    if (findErr) {
      return res.status(400).json({ error: findErr });
    }
    if (!row) {
      return res.status(400).json({
        error: "No in-progress reconciliation found for this organization.",
      });
    }

    const n = Array.isArray(row.tensions) ? row.tensions.length : 0;
    const padded = normalizeResponsesPayload(responses, n);
    const decisions = buildDecisionsDocument(padded, generalNotes);
    const completedAt = new Date().toISOString();

    const { error: upErr } = await supabase
      .from("program_design_reconciliations")
      .update({
        decisions,
        reconciliation_completed_at: completedAt,
      })
      .eq("id", row.id)
      .eq("org_id", orgId);

    if (upErr) {
      return res.status(400).json({ error: upErr.message });
    }

    const { error: stage02bErr } = await supabase
      .from("stage_progress")
      .update({
        status: "completed",
        completed_at: completedAt,
        completed_by: user.id,
      })
      .eq("org_id", orgId)
      .eq("stage", "02b");

    if (stage02bErr) {
      return res.status(400).json({ error: stage02bErr.message });
    }

    const { error: stage03Err } = await supabase
      .from("stage_progress")
      .update({ status: "in_progress" })
      .eq("org_id", orgId)
      .eq("stage", "03");

    if (stage03Err) {
      return res.status(400).json({ error: stage03Err.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

module.exports = router;
