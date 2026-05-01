const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { supabase } = require("../lib/supabaseClient");
const { agent04_sowExtraction } = require("../agents/agent04_sowExtraction");
const { agent05_engagementTemplates } = require("../agents/agent05_engagementTemplates");
const { extractProgramDocumentText } = require("../utils/documentTextExtract");

const router = express.Router();

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const BUCKET = process.env.SOW_DOCUMENTS_BUCKET || "sow-documents";

function sowFileFilter(req, file, cb) {
  const mime = file.mimetype || "";
  const name = String(file.originalname || "").toLowerCase();
  const extOk =
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt");
  if (ALLOWED_MIMES.has(mime) && extOk) {
    cb(null, true);
    return;
  }
  cb(new Error("Only PDF, Word (.docx), and plain text (.txt) are allowed."));
}

const sowUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: sowFileFilter,
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

async function removeStorageObject(bucket, objectPath) {
  if (!objectPath) return;
  await supabase.storage.from(bucket).remove([objectPath]);
}

router.post(
  "/sow-upload",
  (req, res, next) => {
    const upload = sowUpload.single("file");
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
    let storagePath = null;
    let sowUploadId = null;

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
      const originalName = sanitizeOriginalFilename(req.file.originalname);
      const ext = extensionForMime(mime);
      if (!ext) {
        return res
          .status(400)
          .json({ error: "Could not determine file extension." });
      }

      storagePath = `${orgId}/${crypto.randomUUID()}${ext}`;

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, req.file.buffer, {
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

      const { data: sowRow, error: insertSowError } = await supabase
        .from("sow_uploads")
        .insert({
          org_id: orgId,
          file_name: originalName,
          file_path: storagePath,
          file_type: mime,
          upload_status: "processing",
          file_size_bytes: req.file.size,
          uploaded_by: user.id,
        })
        .select(
          "id, org_id, file_name, file_path, file_type, upload_status, file_size_bytes, uploaded_by, uploaded_at, created_at"
        )
        .single();

      if (insertSowError) {
        await removeStorageObject(BUCKET, storagePath);
        return res.status(400).json({ error: insertSowError.message });
      }

      sowUploadId = sowRow.id;

      let documentText;
      try {
        documentText = await extractProgramDocumentText(req.file.buffer, mime);
      } catch (extractErr) {
        await supabase.from("sow_uploads").delete().eq("id", sowUploadId);
        await removeStorageObject(BUCKET, storagePath);
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
        extraction = await agent04_sowExtraction({
          orgId,
          userId: user.id,
          documentText: textForModel,
          mimeType: mime,
          originalFilename: originalName,
        });
      } catch (agentErr) {
        console.error(agentErr);
        await supabase.from("sow_uploads").delete().eq("id", sowUploadId);
        await removeStorageObject(BUCKET, storagePath);
        return res.status(500).json({
          error: agentErr.message || "SOW analysis failed.",
        });
      }

      const framework = extraction.funder_framework || null;
      const reportingFrequency = extraction.reporting_frequency || "other";

      const metricsToInsert = (extraction.metrics || []).map((m) => ({
        org_id: orgId,
        sow_upload_id: sowUploadId,
        metric_name: m.metric_name,
        metric_description: m.metric_description,
        metric_type: m.metric_type,
        reporting_frequency: reportingFrequency,
        funder_framework: framework,
        source: "extracted",
      }));

      let insertedMetrics = [];
      if (metricsToInsert.length > 0) {
        const { data: metricRows, error: metricsError } = await supabase
          .from("funder_metrics")
          .insert(metricsToInsert)
          .select(
            "id, org_id, sow_upload_id, metric_name, metric_description, metric_type, reporting_frequency, funder_framework, source, created_at"
          );

        if (metricsError) {
          await supabase
            .from("funder_metrics")
            .delete()
            .eq("sow_upload_id", sowUploadId);
          await supabase.from("sow_uploads").delete().eq("id", sowUploadId);
          await removeStorageObject(BUCKET, storagePath);
          return res.status(400).json({ error: metricsError.message });
        }
        insertedMetrics = metricRows || [];
      }

      const { data: completedSow, error: updateError } = await supabase
        .from("sow_uploads")
        .update({ upload_status: "complete" })
        .eq("id", sowUploadId)
        .select(
          "id, org_id, file_name, file_path, file_type, upload_status, file_size_bytes, uploaded_by, uploaded_at, created_at, updated_at"
        )
        .single();

      if (updateError) {
        await supabase
          .from("funder_metrics")
          .delete()
          .eq("sow_upload_id", sowUploadId);
        await supabase.from("sow_uploads").delete().eq("id", sowUploadId);
        await removeStorageObject(BUCKET, storagePath);
        return res.status(400).json({ error: updateError.message });
      }

      return res.status(201).json({
        sow_upload: completedSow || sowRow,
        metrics: insertedMetrics,
        funder_name: extraction.funder_name || null,
        funder_framework: extraction.funder_framework || null,
        reporting_frequency: reportingFrequency,
        confidence_notes: extraction.confidence_notes || [],
        missing: extraction.missing || [],
      });
    } catch (err) {
      console.error(err);
      if (sowUploadId) {
        await supabase
          .from("funder_metrics")
          .delete()
          .eq("sow_upload_id", sowUploadId);
        await supabase.from("sow_uploads").delete().eq("id", sowUploadId);
      }
      if (storagePath) {
        await removeStorageObject(BUCKET, storagePath);
      }
      return res.status(500).json({ error: err.message || "Server error." });
    }
  }
);

const METRIC_TYPES = new Set(["output", "outcome", "process", "demographic"]);

router.post("/confirm-metrics", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const sowUploadId = req.body?.sow_upload_id;
    const metrics = Array.isArray(req.body?.metrics) ? req.body.metrics : null;
    const reportingFrequency =
      typeof req.body?.reporting_frequency === "string" &&
      req.body.reporting_frequency.trim()
        ? req.body.reporting_frequency.trim().toLowerCase()
        : "other";

    const normalizedSowId =
      sowUploadId != null && String(sowUploadId).trim()
        ? String(sowUploadId).trim()
        : null;
    if (!normalizedSowId) {
      return res.status(400).json({ error: "Missing sow_upload_id." });
    }
    if (!metrics) {
      return res.status(400).json({ error: "Missing metrics array." });
    }

    const { data: sowRow, error: sowError } = await supabase
      .from("sow_uploads")
      .select("id, org_id")
      .eq("id", normalizedSowId)
      .maybeSingle();

    if (sowError || !sowRow) {
      return res.status(400).json({ error: "SOW upload not found." });
    }
    if (sowRow.org_id !== orgId) {
      return res.status(403).json({ error: "Not allowed for this upload." });
    }

    const { error: delError } = await supabase
      .from("funder_metrics")
      .delete()
      .eq("org_id", orgId);

    if (delError) {
      return res.status(400).json({ error: delError.message });
    }

    const rows = [];
    for (const m of metrics) {
      const name =
        typeof m.metric_name === "string" ? m.metric_name.trim() : "";
      if (!name) continue;
      const desc =
        typeof m.metric_description === "string"
          ? m.metric_description.trim()
          : "";
      let metricType =
        typeof m.metric_type === "string"
          ? m.metric_type.trim().toLowerCase()
          : null;
      if (!METRIC_TYPES.has(metricType)) metricType = null;
      rows.push({
        org_id: orgId,
        sow_upload_id: normalizedSowId,
        metric_name: name,
        metric_description: desc || null,
        metric_type: metricType,
        reporting_frequency: reportingFrequency,
        source: "confirmed",
      });
    }

    if (rows.length > 0) {
      const { error: insError } = await supabase.from("funder_metrics").insert(rows);

      if (insError) {
        return res.status(400).json({ error: insError.message });
      }
    }

    const completedAt = new Date().toISOString();
    const { data: progressRows, error: progressError } = await supabase
      .from("stage_progress")
      .update({
        status: "completed",
        completed_at: completedAt,
        completed_by: user.id,
      })
      .eq("org_id", orgId)
      .eq("stage", "02_sow")
      .select("id");

    if (progressError) {
      return res.status(400).json({ error: progressError.message });
    }
    if (!progressRows || progressRows.length === 0) {
      return res.status(400).json({
        error: "Stage progress row for 02_sow was not found for this org.",
      });
    }

    return res.status(200).json({
      success: true,
      metrics_count: rows.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

async function loadTemplatesContextBundle(orgId) {
  const { data: designRows, error: designErr } = await supabase
    .from("program_designs")
    .select("id, version, version_label, program_model, created_at, updated_at")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const latestDesign = designRows?.[0] || null;

  const { data: metrics, error: metricsErr } = await supabase
    .from("funder_metrics")
    .select(
      "id, metric_name, metric_description, metric_type, reporting_frequency, funder_framework, source, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: templates, error: templatesErr } = await supabase
    .from("engagement_templates")
    .select(
      "id, template_name, template_type, prompt_text, generated_by, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return {
    program_design: latestDesign,
    funder_metrics: metrics || [],
    templates: templates || [],
    errors: {
      program_design: designErr?.message,
      funder_metrics: metricsErr?.message,
      engagement_templates: templatesErr?.message,
    },
  };
}

function programContextForAgent(design) {
  if (!design?.program_model) {
    return "(No program design on file yet.)";
  }
  try {
    return JSON.stringify(design.program_model, null, 2);
  } catch {
    return String(design.program_model);
  }
}

function funderMetricsForAgent(metrics) {
  if (!metrics || metrics.length === 0) {
    return "(No funder metrics on file yet.)";
  }
  return metrics
    .map((m) => {
      const bits = [
        m.metric_name,
        m.metric_type ? `type: ${m.metric_type}` : null,
        m.metric_description || null,
        m.reporting_frequency
          ? `reporting frequency: ${m.reporting_frequency}`
          : null,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");
}

router.get("/templates-context", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const bundle = await loadTemplatesContextBundle(orgId);

    return res.status(200).json({
      program_context: bundle.program_design
        ? {
            id: bundle.program_design.id,
            version: bundle.program_design.version,
            version_label: bundle.program_design.version_label,
            program_model: bundle.program_design.program_model,
            updated_at: bundle.program_design.updated_at,
            created_at: bundle.program_design.created_at,
          }
        : null,
      funder_metrics: bundle.funder_metrics,
      templates: bundle.templates,
      load_errors: bundle.errors,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/generate-templates", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const bundle = await loadTemplatesContextBundle(orgId);
    const programText = programContextForAgent(bundle.program_design);
    const metricsText = funderMetricsForAgent(bundle.funder_metrics);

    let generation;
    try {
      generation = await agent05_engagementTemplates({
        orgId,
        userId: user.id,
        programContextText: programText,
        funderMetricsText: metricsText,
      });
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Template generation failed.",
      });
    }

    const templates = generation.templates || [];
    if (templates.length === 0) {
      return res.status(400).json({
        error:
          "No templates were produced. Add program design or funder metrics and try again.",
      });
    }

    const { error: delErr } = await supabase
      .from("engagement_templates")
      .delete()
      .eq("org_id", orgId);

    if (delErr) {
      return res.status(400).json({ error: delErr.message });
    }

    const rows = templates.map((t) => ({
      org_id: orgId,
      template_name: t.template_name,
      template_type: t.template_type,
      prompt_text: t.prompt_text,
      generated_by: "agent05_engagementTemplates",
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("engagement_templates")
      .insert(rows)
      .select(
        "id, template_name, template_type, prompt_text, generated_by, created_at"
      );

    if (insErr) {
      return res.status(400).json({ error: insErr.message });
    }

    return res.status(201).json({ templates: inserted || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

module.exports = router;
