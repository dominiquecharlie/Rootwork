const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { supabase } = require("../lib/supabaseClient");
const { agent01_missionFraming } = require("../agents/agent01_missionFraming");
const { agent02_stakeholderGap } = require("../agents/agent02_stakeholderGap");
const { agent03_programAlignment } = require("../agents/agent03_programAlignment");
const { agent04_documentExtraction } = require("../agents/agent04_documentExtraction");
const { extractProgramDocumentText } = require("../utils/documentTextExtract");

const router = express.Router();

const DELIVERY_VALUES = new Set([
  "in_person",
  "virtual",
  "hybrid",
  "phone_based",
  "home_visits",
  "other",
]);

const FREQUENCY_VALUES = new Set([
  "daily",
  "weekly",
  "bi_weekly",
  "monthly",
  "quarterly",
  "episodic",
  "other",
]);

const LEADER_VALUES = new Set([
  "staff_members",
  "community_members",
  "volunteers",
  "peer_educators",
  "contracted_facilitators",
  "mixed",
  "other",
]);

const CHANGE_LEVEL_VALUES = new Set([
  "individual",
  "family",
  "community",
  "systems",
  "multiple_levels",
]);

const DOCUMENT_UPLOAD_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function sanitizeOriginalFilename(name) {
  const base = String(name || "document").replace(/[/\\]/g, "_");
  const cleaned = base.replace(/[^a-zA-Z0-9._\- ]+/g, "_").slice(0, 200);
  return cleaned || "document";
}

function extensionForMime(mime) {
  if (mime === "application/pdf") return ".pdf";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx";
  }
  if (mime === "text/plain") return ".txt";
  return "";
}

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

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

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

router.get("/stakeholders", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const { data, error } = await supabase
      .from("stakeholders")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ stakeholders: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/stakeholders", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const body = req.body || {};
    const name = body.name;
    const stakeholderType = body.stakeholder_type;
    const relationshipToProgram = body.relationship_to_program;
    const inDecisionMakingRole =
      body.in_decision_making_role ?? body.is_decision_maker ?? false;
    const notes = body.notes ?? null;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Missing required field: name." });
    }

    const { data, error } = await supabase
      .from("stakeholders")
      .insert({
        org_id: orgId,
        name: String(name).trim(),
        stakeholder_type: stakeholderType ?? null,
        relationship_to_program: relationshipToProgram ?? null,
        in_decision_making_role: Boolean(inDecisionMakingRole),
        notes,
      })
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ stakeholder: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.delete("/stakeholders/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const stakeholderId = req.params.id;
    if (!stakeholderId) {
      return res.status(400).json({ error: "Missing stakeholder id." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("stakeholders")
      .select("id, org_id")
      .eq("id", stakeholderId)
      .maybeSingle();

    if (existingError) {
      return res.status(400).json({ error: existingError.message });
    }

    if (!existing) {
      return res.status(404).json({ error: "Stakeholder not found." });
    }

    if (existing.org_id !== orgId) {
      return res.status(403).json({ error: "Not allowed to delete this stakeholder." });
    }

    const { error: deleteError } = await supabase
      .from("stakeholders")
      .delete()
      .eq("id", stakeholderId)
      .eq("org_id", orgId);

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/stakeholder-gap", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const { data: stakeholders, error: stakeholderError } = await supabase
      .from("stakeholders")
      .select("name, stakeholder_type, relationship_to_program, in_decision_making_role")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (stakeholderError) {
      return res.status(400).json({ error: stakeholderError.message });
    }

    const { data: orgProfile, error: profileError } = await supabase
      .from("org_profiles")
      .select("who_is_most_affected, theory_of_change")
      .eq("org_id", orgId)
      .maybeSingle();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    const gapAnalysis = await agent02_stakeholderGap({
      orgId,
      userId: user.id,
      stakeholders: stakeholders || [],
      context: {
        who_is_most_affected: orgProfile?.who_is_most_affected || "",
        theory_of_change: orgProfile?.theory_of_change || "",
      },
    });

    return res.status(200).json({
      power_gaps: Array.isArray(gapAnalysis.power_gaps)
        ? gapAnalysis.power_gaps
        : [],
      missing_stakeholder_types: Array.isArray(
        gapAnalysis.missing_stakeholder_types
      )
        ? gapAnalysis.missing_stakeholder_types
        : [],
      questions_to_consider: Array.isArray(gapAnalysis.questions_to_consider)
        ? gapAnalysis.questions_to_consider
        : [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post(
  "/document-upload",
  (req, res, next) => {
    const upload = documentUpload.single("file");
    upload(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File is larger than 25 MB." });
          return;
        }
        res.status(400).json({ error: err.message || "Upload failed." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const { orgId, error: orgError } = await getOrgIdForUser(user.id);
      if (orgError) {
        return res.status(400).json({ error: orgError });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: "Missing file. Use multipart form field named file.",
        });
      }

      const mime = req.file.mimetype || "";
      if (!DOCUMENT_UPLOAD_MIMES.has(mime)) {
        return res.status(400).json({
          error:
            "Unsupported file type. Use PDF, Word (.docx), or plain text.",
        });
      }

      const originalName = sanitizeOriginalFilename(req.file.originalname);
      const lower = originalName.toLowerCase();
      if (
        !lower.endsWith(".pdf") &&
        !lower.endsWith(".docx") &&
        !lower.endsWith(".txt")
      ) {
        return res.status(400).json({
          error: "Filename must end with .pdf, .docx, or .txt.",
        });
      }

      const ext = extensionForMime(mime);
      if (!ext) {
        return res
          .status(400)
          .json({ error: "Could not determine file extension." });
      }

      const bucket =
        process.env.PROGRAM_DOCUMENTS_BUCKET || "program-documents";
      const objectName = `${orgId}/stage01/${crypto.randomUUID()}${ext}`;

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(objectName, req.file.buffer, {
          contentType: mime,
          upsert: false,
        });

      if (storageError) {
        return res.status(400).json({
          error:
            storageError.message ||
            "Could not store file. Check storage bucket configuration.",
        });
      }

      let documentText;
      try {
        documentText = await extractProgramDocumentText(req.file.buffer, mime);
      } catch (extractErr) {
        await supabase.storage.from(bucket).remove([objectName]);
        return res.status(400).json({
          error: extractErr.message || "Could not read file text.",
        });
      }

      const textForModel =
        documentText && String(documentText).trim()
          ? documentText
          : "(No readable text was extracted from this file.)";

      let extraction;
      try {
        extraction = await agent04_documentExtraction({
          orgId,
          userId: user.id,
          documentText: textForModel,
          mimeType: mime,
          originalFilename: originalName,
        });
      } catch (agentErr) {
        console.error(agentErr);
        await supabase.storage.from(bucket).remove([objectName]);
        return res.status(500).json({
          error: agentErr.message || "Document analysis failed.",
        });
      }

      const extractedPayload = {
        extracted: extraction.extracted,
        confidence_notes: extraction.confidence_notes,
        missing: extraction.missing,
      };
      if (extraction.parse_error) extractedPayload.parse_error = true;

      const { data: row, error: insertError } = await supabase
        .from("stage01_program_documents")
        .insert({
          org_id: orgId,
          storage_path: objectName,
          original_filename: originalName,
          mime_type: mime,
          file_size_bytes: req.file.size,
          uploaded_by: user.id,
          extracted_data: extractedPayload,
        })
        .select(
          "id, storage_path, original_filename, mime_type, file_size_bytes, uploaded_at, extracted_data"
        )
        .single();

      if (insertError) {
        await supabase.storage.from(bucket).remove([objectName]);
        return res.status(400).json({ error: insertError.message });
      }

      return res.status(201).json({
        document: row,
        extracted: extractedPayload.extracted,
        confidence_notes: extractedPayload.confidence_notes,
        missing: extractedPayload.missing,
        ...(extractedPayload.parse_error ? { parse_error: true } : {}),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || "Server error." });
    }
  }
);

router.post("/program-design", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const body = req.body || {};
    // Eleven logic model fields (snake_case or camelCase aliases).
    const resourcesNeeded =
      body.resources_needed ?? body.resourcesNeeded ?? "";
    const programModelActivities =
      body.program_model ?? body.programModel ?? "";
    const deliveryMethod =
      body.delivery_method ?? body.deliveryMethod ?? "";
    const frequency = body.frequency ?? "";
    const geography = body.geography ?? "";
    const whoLeads = body.who_leads ?? body.whoLeads ?? "";
    const whatParticipationLooksLike =
      body.what_participation_looks_like ??
      body.whatParticipationLooksLike ??
      "";
    const immediateOutputs =
      body.immediate_outputs ?? body.immediateOutputs ?? "";
    const intendedChange =
      body.intended_change ?? body.intendedChange ?? "";
    const changeLevel = body.change_level ?? body.changeLevel ?? "";
    const currentlyMeasuring =
      body.currently_measuring ?? body.currentlyMeasuring ?? null;

    if (!String(resourcesNeeded).trim()) {
      return res.status(400).json({ error: "Missing required field: resources_needed." });
    }
    if (!String(programModelActivities).trim()) {
      return res.status(400).json({ error: "Missing required field: program_model." });
    }
    if (!deliveryMethod || !DELIVERY_VALUES.has(String(deliveryMethod))) {
      return res.status(400).json({ error: "Invalid or missing field: delivery_method." });
    }
    if (!frequency || !FREQUENCY_VALUES.has(String(frequency))) {
      return res.status(400).json({ error: "Invalid or missing field: frequency." });
    }
    if (!String(geography).trim()) {
      return res.status(400).json({ error: "Missing required field: geography." });
    }
    if (!whoLeads || !LEADER_VALUES.has(String(whoLeads))) {
      return res.status(400).json({ error: "Invalid or missing field: who_leads." });
    }
    if (!String(whatParticipationLooksLike).trim()) {
      return res.status(400).json({ error: "Missing required field: what_participation_looks_like." });
    }
    if (!String(immediateOutputs).trim()) {
      return res.status(400).json({ error: "Missing required field: immediate_outputs." });
    }
    if (!String(intendedChange).trim()) {
      return res.status(400).json({ error: "Missing required field: intended_change." });
    }
    if (!changeLevel || !CHANGE_LEVEL_VALUES.has(String(changeLevel))) {
      return res.status(400).json({ error: "Invalid or missing field: change_level." });
    }

    const measuringTrimmed =
      currentlyMeasuring == null || currentlyMeasuring === ""
        ? null
        : String(currentlyMeasuring).trim() || null;

    const programModel = {
      stage01_intake: {
        resources_needed: String(resourcesNeeded).trim(),
        program_model: String(programModelActivities).trim(),
        delivery_method: String(deliveryMethod),
        frequency: String(frequency),
        geography: String(geography).trim(),
        who_leads: String(whoLeads),
        what_participation_looks_like: String(whatParticipationLooksLike).trim(),
        immediate_outputs: String(immediateOutputs).trim(),
        intended_change: String(intendedChange).trim(),
        change_level: String(changeLevel),
        currently_measuring: measuringTrimmed,
      },
    };

    const { data: designRow, error: upsertDesignError } = await supabase
      .from("program_designs")
      .upsert(
        {
          org_id: orgId,
          version: 1,
          version_label: "Pre-community input",
          program_model: programModel,
          claude_alignment_flags: {},
          created_by: user.id,
        },
        { onConflict: "org_id,version" }
      )
      .select("id, version, created_at")
      .single();

    if (upsertDesignError || !designRow) {
      return res.status(400).json({
        error: upsertDesignError?.message || "Could not save program design.",
      });
    }

    let alignment_gaps = [];
    let strengths = [];
    let suggested_measures = [];

    try {
      const agentResult = await agent03_programAlignment({
        orgId,
        userId: user.id,
        resources_needed: String(resourcesNeeded).trim(),
        program_model: String(programModelActivities).trim(),
        delivery_method: String(deliveryMethod),
        frequency: String(frequency),
        geography: String(geography).trim(),
        who_leads: String(whoLeads),
        what_participation_looks_like: String(whatParticipationLooksLike).trim(),
        immediate_outputs: String(immediateOutputs).trim(),
        intended_change: String(intendedChange).trim(),
        change_level: String(changeLevel),
        currently_measuring: measuringTrimmed,
      });

      alignment_gaps = agentResult.alignment_gaps || [];
      strengths = agentResult.strengths || [];
      suggested_measures = agentResult.suggested_measures || [];

      const claude_alignment_flags = {
        alignment_gaps,
        strengths,
        suggested_measures,
      };

      const { error: flagsUpdateError } = await supabase
        .from("program_designs")
        .update({ claude_alignment_flags })
        .eq("id", designRow.id)
        .eq("org_id", orgId);

      if (flagsUpdateError) {
        return res.status(400).json({ error: flagsUpdateError.message });
      }

      const { data: finalDesign, error: fetchDesignError } = await supabase
        .from("program_designs")
        .select(
          "id, version, created_at, version_label, program_model, claude_alignment_flags, created_by"
        )
        .eq("id", designRow.id)
        .eq("org_id", orgId)
        .single();

      if (fetchDesignError) {
        return res.status(400).json({ error: fetchDesignError.message });
      }

      return res.status(201).json({
        program_design: finalDesign,
        alignment_gaps,
        strengths,
        suggested_measures,
      });
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Program alignment review failed.",
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

module.exports = router;
