// Unauthenticated public respondent form.
// Mounted at /api/public. Must NOT use stage03 middleware (no authenticateUser).
// Treat every input as hostile. The public page never talks to Supabase directly.

const express = require("express");
const rateLimit = require("express-rate-limit");
const { supabase } = require("../lib/supabaseClient");
const {
  filterVisibleAnswers,
  normalizeQuestions,
  parseStoredConsentLanguage,
  validateResponsePayload,
} = require("../lib/questionLogic");
const { publicLanguages } = require("../lib/publicFormLanguages");
const { isValidPublicTokenShape } = require("../lib/publicToken");
const {
  formatRemovalCodeForDisplay,
  generateRemovalCode,
  hashRemovalCode,
  isValidRemovalCodeShape,
  PUBLIC_REMOVE_OK,
} = require("../lib/removalCode");
const { selfDeletionAudit } = require("../lib/responseDeletion");

const router = express.Router();

const PAID_PUBLIC_TIERS = new Set(["starter", "growth", "enterprise"]);

// Do NOT re-check the Community Voice Hard Stop on public form requests.
// It was already satisfied to reach launch. Re-checking it here would mean a
// deleted engagement record takes a live form dark mid-collection, which
// punishes community respondents rather than the org.

// Shared IPs are the expected case, not the suspicious one, because community
// engagement happens in rooms (one venue wifi, many phones). Per-IP limiting
// here protects against accidental floods and casual abuse. It does not stop a
// determined attacker, who rotates IPs regardless, so sizing it tight buys
// very little and costs the actual use case.
//
// These numbers are starting points to revisit after the first real community
// meeting. The in-memory store does not survive a restart or multiple instances.
function publicKeyGenerator(req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const token =
    typeof req.params?.token === "string" ? req.params.token.trim() : "";
  return `${ip}:${token}`;
}

const publicFormGetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: publicKeyGenerator,
  message: { error: "Too many requests. Try again later." },
});

const publicFormRespondLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: publicKeyGenerator,
  message: { error: "Too many requests. Try again later." },
});

// Tighter than load/submit: wrong codes must not be brute-forceable.
const publicFormRemoveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: publicKeyGenerator,
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
  const consent = parseStoredConsentLanguage(tool.consent_language);
  return {
    tool_name: typeof tool.tool_name === "string" ? tool.tool_name : "",
    languages: publicLanguages(org, questions),
    consent_language: consent || { en: "" },
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

router.get("/form/:token", publicFormGetLimiter, async (req, res) => {
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

router.post("/form/:token/respond", publicFormRespondLimiter, async (req, res) => {
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
    const removalPlain = generateRemovalCode();
    const removal_code_hash = hashRemovalCode(removalPlain);

    // Do not persist respondent IP. Rate limiting may use it in memory only.
    // Never persist the plaintext removal code.
    const { error: insertErr } = await supabase
      .from("collection_responses")
      .insert({
        org_id: tool.org_id,
        collection_tool_id: tool.id,
        response_payload: visibleAnswers,
        consent_acknowledged_at: consentAt,
        language,
        submitted_at: consentAt,
        removal_code_hash,
        entry_method: "public",
        entered_by: null,
      });

    if (insertErr) {
      console.error(insertErr);
      return res.status(500).json({ error: "Could not save response." });
    }

    return res.status(201).json({
      success: true,
      removal_code: formatRemovalCodeForDisplay(removalPlain),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

// Self-service removal. Same response shape whether the code matched or not.
router.post("/form/:token/remove", publicFormRemoveLimiter, async (req, res) => {
  setNoStore(res);
  try {
    const token =
      typeof req.params.token === "string" ? req.params.token.trim() : "";
    const loaded = await loadLaunchedPublicTool(token);
    if (!loaded) {
      return res.status(404).json({ error: "Form not found." });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const code = typeof body.code === "string" ? body.code : "";

    if (!isValidRemovalCodeShape(code)) {
      return res.status(200).json(PUBLIC_REMOVE_OK);
    }

    const codeHash = hashRemovalCode(code);
    const { data: row, error: findErr } = await supabase
      .from("collection_responses")
      .select("id, org_id, collection_tool_id")
      .eq("collection_tool_id", loaded.tool.id)
      .eq("removal_code_hash", codeHash)
      .maybeSingle();

    if (findErr || !row) {
      return res.status(200).json(PUBLIC_REMOVE_OK);
    }

    const { error: delErr } = await supabase
      .from("collection_responses")
      .delete()
      .eq("id", row.id)
      .eq("collection_tool_id", loaded.tool.id);

    if (delErr) {
      console.error(delErr);
      return res.status(500).json({ error: "Server error." });
    }

    const { error: auditErr } = await supabase
      .from("response_deletions")
      .insert(
        selfDeletionAudit({
          org_id: row.org_id,
          collection_tool_id: row.collection_tool_id,
        })
      );

    if (auditErr) {
      console.error(auditErr);
      // Response already deleted; still return the same opaque success.
    }

    return res.status(200).json(PUBLIC_REMOVE_OK);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
