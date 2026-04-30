const express = require("express");
const { supabase } = require("../lib/supabaseClient");

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

router.get("/me", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return res.status(400).json({ error: membershipError.message });
    }

    if (!membership) {
      return res.json({ org: null });
    }

    const org = membership.organizations;

    const { data: stageProgress, error: stageError } = await supabase
      .from("stage_progress")
      .select("*")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: true });

    if (stageError) {
      return res.status(400).json({ error: stageError.message });
    }

    return res.json({
      org,
      stageProgress: stageProgress || [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error." });
  }
});

router.post("/create", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const body = req.body || {};
    const name = body.name;
    const orgType = body.org_type ?? body.orgType;
    const primaryGeography = body.primary_geography ?? body.primaryGeography;

    if (!name || !orgType || !primaryGeography) {
      return res.status(400).json({
        error:
          "Missing required fields: name, org_type, and primary_geography.",
      });
    }

    const { data: createdOrg, error: orgInsertError } = await supabase
      .from("organizations")
      .insert({
        name,
        org_type: orgType,
        primary_geography: primaryGeography,
        tier: "freemium",
      })
      .select("*")
      .single();

    if (orgInsertError || !createdOrg) {
      return res
        .status(400)
        .json({ error: orgInsertError?.message || "Could not create org." });
    }

    const { error: memberInsertError } = await supabase.from("org_members").insert({
      org_id: createdOrg.id,
      user_id: user.id,
      role: "admin",
    });

    if (memberInsertError) {
      await supabase.from("organizations").delete().eq("id", createdOrg.id);
      return res.status(400).json({ error: memberInsertError.message });
    }

    const stageRows = [
      { org_id: createdOrg.id, stage: "01", status: "in_progress" },
      { org_id: createdOrg.id, stage: "02_sow", status: "locked" },
      { org_id: createdOrg.id, stage: "02_templates", status: "locked" },
      { org_id: createdOrg.id, stage: "02_hardstop", status: "locked" },
      { org_id: createdOrg.id, stage: "02b", status: "locked" },
      { org_id: createdOrg.id, stage: "03", status: "locked" },
      { org_id: createdOrg.id, stage: "04", status: "locked" },
      { org_id: createdOrg.id, stage: "05", status: "locked" },
    ];

    const { error: stageInsertError } = await supabase
      .from("stage_progress")
      .insert(stageRows);

    if (stageInsertError) {
      await supabase.from("org_members").delete().eq("org_id", createdOrg.id);
      await supabase.from("organizations").delete().eq("id", createdOrg.id);
      return res.status(400).json({ error: stageInsertError.message });
    }

    return res.status(201).json(createdOrg);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error." });
  }
});

module.exports = router;
