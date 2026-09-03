// Unauthenticated public respondent form.
// Mounted at /api/public. Must NOT use stage03 middleware (no authenticateUser).
// Treat every input as hostile. The public page never talks to Supabase directly.

const express = require("express");
const rateLimit = require("express-rate-limit");
const { supabase } = require("../lib/supabaseClient");
const {
  filterVisibleAnswers,
  normalizeQuestions,
  validateResponsePayload,
} = require("../lib/questionLogic");
const { publicLanguages } = require("../lib/publicFormLanguages");
const { isValidPublicTokenShape } = require("../lib/publicToken");

const router = express.Router();

const PAID_PUBLIC_TIERS = new Set(["starter", "growth", "enterprise"]);

// Do NOT re-check the Community Voice Hard Stop on public form requests.
// It was already satisfied to reach launch. Re-checking it here would mean a
// deleted engagement record takes a live form dark mid-collection, which
// punishes community respondents rather than the org.

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Per IP and per token. express-rate-limit is installed; this key does not
  // survive a process restart or multiple instances without a shared store.
  keyGenerator: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const token =
      typeof req.params?.token === "string" ? req.params.token.trim() : "";
    return `${ip}:${token}`;
  },
  message: { error: "Too many requests. Try again later." },
});

function setNoStore(res) {
  res.set("Cache-Control", "no-store");
}

/**
 * Resolve :token to a launched, paid-tier tool.
 * On any failure return null so the route responds 404 (not 403).
 * Never reveal whether the token is missing, unpaid, or not launched.
 */
async function loadLaunchedPublicTool(token) {
  if (!isValidPublicTokenShape(token)) return null;

  const { data: tool, error: toolErr } = await supabase
    .from("collection_tools")
    .select(
      "id, org_id, tool_name, tool_type, configuration, consent_language, launched_at, public_token"
    )
    .eq("public_token", token)
    .maybeSingle();

  if (toolErr || !tool) return null;
  if (!tool.launched_at) return null;
  if (!tool.org_id) return null;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, tier, languages_served")
    .eq("id", tool.org_id)
    .maybeSingle();

  if (orgErr || !org) return null;

  const tier =
    typeof org.tier === "string" && org.tier.trim()
      ? org.tier.trim().toLowerCase()
      : "";
  if (!PAID_PUBLIC_TIERS.has(tier)) return null;

  return { tool, org };
}

/**
 * Field-by-field whitelist for GET /api/public/form/:token.
 * Never spread a DB row. Never return org id/name, rationale, source,
 * created_by, user ids, funder metrics, gap review, or community voice.
 * tool_type is intentionally omitted: respondents do not need the instrument
 * classification.
 */
function buildPublicFormPayload(tool, org, questions) {
  return {
    tool_name: typeof tool.tool_name === "string" ? tool.tool_name : "",
    languages: publicLanguages(org, questions),
    consent_language:
      typeof tool.consent_language === "string" ? tool.consent_language : "",
    questions: questions.map((q) => {
      const row = {
        id: q.id,
        text: q.text,
        type: q.type,
        required: Boolean(q.required),
      };
      if (q.type === "multiple_choice" && Array.isArray(q.options)) {
        row.options = q.options.map((o) => ({
          id: o.id,
          label: o.label,
        }));
      }
      if (q.display_if) {
        const display_if = {
          question_id: q.display_if.question_id,
          operator: q.display_if.operator,
        };
        if (typeof q.display_if.value === "string") {
          display_if.value = q.display_if.value;
        }
        row.display_if = display_if;
      }
      return row;
    }),
  };
}

router.get("/form/:token", publicFormLimiter, async (req, res) => {
  setNoStore(res);
  try {
    const token =
      typeof req.params.token === "string" ? req.params.token.trim() : "";
    const loaded = await loadLaunchedPublicTool(token);
    if (!loaded) {
      return res.status(404).json({ error: "Form not found." });
    }

    const { tool, org } = loaded;
    const cfg =
      tool.configuration && typeof tool.configuration === "object"
        ? tool.configuration
        : {};
    const questions = normalizeQuestions(
      Array.isArray(cfg.questions) ? cfg.questions : []
    );

    return res.status(200).json(buildPublicFormPayload(tool, org, questions));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

router.post("/form/:token/respond", publicFormLimiter, async (req, res) => {
  setNoStore(res);
  try {
    const token =
      typeof req.params.token === "string" ? req.params.token.trim() : "";
    const loaded = await loadLaunchedPublicTool(token);
    if (!loaded) {
      return res.status(404).json({ error: "Form not found." });
    }

    const { tool, org } = loaded;
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const consentAcknowledged = Boolean(body.consent_acknowledged);
    if (!consentAcknowledged) {
      return res.status(400).json({
        error: "Consent must be acknowledged before submitting.",
      });
    }

    const language =
      typeof body.language === "string" ? body.language.trim().toLowerCase() : "";
    if (!language) {
      return res.status(400).json({ error: "language is required." });
    }

    const cfg =
      tool.configuration && typeof tool.configuration === "object"
        ? tool.configuration
        : {};
    const questions = normalizeQuestions(
      Array.isArray(cfg.questions) ? cfg.questions : []
    );

    const offered = publicLanguages(org, questions);
    if (!offered.includes(language)) {
      return res.status(400).json({
        error: "language is not offered for this form.",
      });
    }

    const answers =
      body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
        ? body.answers
        : {};

    const errors = validateResponsePayload(questions, answers);
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Response is invalid.",
        errors,
      });
    }

    const visibleAnswers = filterVisibleAnswers(questions, answers);
    const consentAt = new Date().toISOString();

    // Do not persist respondent IP. Rate limiting may use it in memory only.
    const { error: insertErr } = await supabase
      .from("collection_responses")
      .insert({
        org_id: tool.org_id,
        collection_tool_id: tool.id,
        response_payload: visibleAnswers,
        consent_acknowledged_at: consentAt,
        language,
        submitted_at: consentAt,
      });

    if (insertErr) {
      console.error(insertErr);
      return res.status(500).json({ error: "Could not save response." });
    }

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
