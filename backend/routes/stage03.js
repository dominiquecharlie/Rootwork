const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { authenticateUser } = require("../middleware/authMiddleware");
const {
  requireCommunityVoice,
  requireReconciliation,
} = require("../middleware/stageGates");
const { requireTier } = require("../middleware/tierGate");
const { agent08_collectionGapReview } = require("../agents/agent08_collectionGapReview");
const { agent09_consentDraft } = require("../agents/agent09_consentDraft");
const {
  agent09b_questionSuggestions,
} = require("../agents/agent09b_questionSuggestions");
const {
  isBlankQuestionText,
  isUsableOption,
  normalizeConsentLanguage,
  normalizeQuestions,
  parseStoredConsentLanguage,
  serializeConsentLanguage,
  validateQuestionLogic,
} = require("../lib/questionLogic");
const { generatePublicToken } = require("../lib/publicToken");
const {
  generateCollectionInstrumentDocx,
  instrumentLanguagesForTool,
} = require("../lib/artifacts/collectionInstrument");
const {
  renderResponseCsv,
  responseCsvFilename,
  shapeResponseCsv,
} = require("../lib/artifacts/responseCsv");

const router = express.Router();
const requireStarterTier = requireTier("starter", "growth", "enterprise");

router.use(authenticateUser);
router.use(requireCommunityVoice);
router.use(requireReconciliation);

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

async function loadGapReviewData(orgId) {
  const { data: metrics } = await supabase
    .from("funder_metrics")
    .select(
      "id, metric_name, metric_description, metric_type, reporting_frequency, source"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: engagementRows } = await supabase
    .from("community_engagements")
    .select(
      "id, title, community_members_wanted, priorities_named, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  const engagement = engagementRows?.[0] || null;

  const { data: designRows } = await supabase
    .from("program_designs")
    .select("*")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const program_design = designRows?.[0] || null;

  const { data: tools } = await supabase
    .from("collection_tools")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return {
    funder_metrics: metrics || [],
    engagement,
    program_design,
    collection_tools: tools || [],
  };
}

const ALLOWED_TOOL_TYPES = new Set([
  "survey",
  "interview",
  "observation",
  "administrative",
]);

const ALLOWED_SURVEY_PURPOSE = new Set([
  "pre_intake",
  "post_exit",
  "satisfaction",
]);

const ALLOWED_WHO = new Set([
  "program_participants",
  "staff_members",
  "both",
  "other",
]);

function normalizeToolType(t) {
  const raw = String(t ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  let s = raw.toLowerCase().trim();
  const pipe = s.indexOf("|");
  if (pipe >= 0) s = s.slice(0, pipe).trim();
  if (ALLOWED_TOOL_TYPES.has(s)) return s;
  if (s.includes("administrat") || /^admin(istrative)?$/.test(s)) {
    return "administrative";
  }
  if (s.includes("observation") || (s.startsWith("observ") && s.length >= 6)) {
    return "observation";
  }
  if (s.includes("interview")) return "interview";
  return "survey";
}

function normalizeWhoCompletes(v) {
  const s = (v || "").toLowerCase().trim();
  if (ALLOWED_WHO.has(s)) return s;
  return "program_participants";
}

function normalizeGovernanceChecksInput(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      consent_reviewed: false,
      shareback_plan: false,
      data_storage: false,
    };
  }
  return {
    consent_reviewed: Boolean(raw.consent_reviewed),
    shareback_plan: Boolean(raw.shareback_plan),
    data_storage: Boolean(raw.data_storage),
  };
}

function buildConfiguration(who_completes, questions, status, governance_checks) {
  return {
    who_completes,
    questions,
    status: status || "draft",
    governance_checks: normalizeGovernanceChecksInput(governance_checks),
  };
}

function isConfigurationNonEmpty(configuration) {
  if (!configuration || typeof configuration !== "object") return false;
  return Object.keys(configuration).length > 0;
}

function governanceChecksComplete(configuration) {
  if (!configuration || typeof configuration !== "object") return false;
  const gc =
    configuration.governance_checks || configuration.governance || {};
  return Boolean(
    gc.consent_reviewed && gc.shareback_plan && gc.data_storage
  );
}

async function loadConsentDraftContext(orgId) {
  const { data: orgProfile } = await supabase
    .from("org_profiles")
    .select("who_is_most_affected")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: designRows } = await supabase
    .from("program_designs")
    .select("*")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const program_design = designRows?.[0] || null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("org_type, primary_geography, languages_served")
    .eq("id", orgId)
    .maybeSingle();

  return {
    org_profile: orgProfile || null,
    program_design,
    organization: organization || null,
  };
}

function extractProgramDesignSummary(row) {
  if (!row || typeof row !== "object") {
    return {
      intended_change: "",
      immediate_outputs: "",
      change_level: "",
      resources_needed: "",
    };
  }
  const intake = row.program_model?.stage01_intake || {};
  return {
    intended_change:
      typeof intake.intended_change === "string"
        ? intake.intended_change.trim()
        : "",
    immediate_outputs:
      typeof intake.immediate_outputs === "string"
        ? intake.immediate_outputs.trim()
        : "",
    change_level:
      typeof intake.change_level === "string"
        ? intake.change_level.trim()
        : "",
    resources_needed:
      typeof intake.resources_needed === "string"
        ? intake.resources_needed.trim()
        : "",
  };
}

function getHardcodedQuestions(tool_typeInput, survey_purposeInput, program_design) {
  console.log("getHardcodedQuestions called with:", {
    tool_type: tool_typeInput,
    survey_purpose: survey_purposeInput,
  });
  const tool_type = normalizeToolType(tool_typeInput);
  const survey_purpose = String(survey_purposeInput ?? "").toLowerCase().trim();
  const pd = extractProgramDesignSummary(program_design);
  const intended_change =
    pd.intended_change || "your program goals";
  const immediate_outputs =
    pd.immediate_outputs || "key skills from this program";

  console.log("hardcoded check - administrative:", tool_type === "administrative");
  if (tool_type === "administrative") {
    return {
      questions: [
        {
          text: "Enrollment date",
          type: "date",
          required: true,
          rationale: "Tracks when the participant joined the program.",
        },
        {
          text: "Age range",
          type: "multiple_choice",
          required: true,
          options: [
            "Under 18",
            "18-24",
            "25-34",
            "35-44",
            "45-54",
            "55-64",
            "65 or older",
          ],
          rationale: "Required for demographic reporting.",
        },
        {
          text: "Gender identity",
          type: "multiple_choice",
          required: true,
          options: [
            "Woman",
            "Man",
            "Non-binary or genderqueer",
            "Transgender",
            "I use a different term",
            "Prefer not to say",
          ],
          rationale: "Required for demographic reporting.",
        },
        {
          text: "Race and ethnicity",
          type: "multiple_choice",
          required: true,
          options: [
            "Black or African American",
            "Hispanic or Latine",
            "White",
            "Asian or Asian American",
            "Native American or Alaska Native",
            "Native Hawaiian or Pacific Islander",
            "Multiracial",
            "I use a different term",
            "Prefer not to say",
          ],
          rationale: "Required for demographic reporting.",
        },
        {
          text: "Primary language spoken at home",
          type: "short_text",
          required: true,
          rationale: "Informs language access planning.",
        },
        {
          text: "Zip code",
          type: "short_text",
          required: true,
          rationale: "Documents geographic reach of the program.",
        },
        {
          text: "Household size",
          type: "number",
          required: false,
          rationale: "Optional context for participant circumstances.",
        },
        {
          text: "Annual household income range",
          type: "multiple_choice",
          required: false,
          options: [
            "Under $25,000",
            "$25,000 to $49,999",
            "$50,000 to $74,999",
            "$75,000 to $99,999",
            "$100,000 or more",
            "Prefer not to say",
          ],
          rationale: "Optional economic context.",
        },
        {
          text: "How did this participant hear about the program?",
          type: "multiple_choice",
          required: false,
          options: [
            "Word of mouth",
            "Social media",
            "Community organization",
            "Healthcare provider",
            "School or educator",
            "Other",
          ],
          rationale: "Tracks referral sources for outreach planning.",
        },
        {
          text: "Number of sessions attended this period",
          type: "number",
          required: false,
          rationale: "Tracks participation intensity.",
        },
      ],
      tool_notes:
        "Complete one record per participant at enrollment. Rootwork stores all records automatically and assigns each a unique participant ID. Update the session count field each time the participant attends a program session.",
    };
  }

  console.log(
    "checking pre_intake:",
    tool_type === "survey" && survey_purpose === "pre_intake"
  );
  if (tool_type === "survey" && survey_purpose === "pre_intake") {
    return {
      questions: [
        {
          text: "What is your age range?",
          type: "multiple_choice",
          required: true,
          options: [
            "Under 18",
            "18-24",
            "25-34",
            "35-44",
            "45-54",
            "55-64",
            "65 or older",
          ],
          rationale: "Baseline demographic data.",
        },
        {
          text: "What is your primary language?",
          type: "short_text",
          required: true,
          rationale: "Informs language access needs.",
        },
        {
          text: "What zip code do you live in?",
          type: "short_text",
          required: true,
          rationale: "Documents geographic reach.",
        },
        {
          text: "How did you hear about this program?",
          type: "multiple_choice",
          required: false,
          options: [
            "Word of mouth",
            "Social media",
            "Community organization",
            "Healthcare provider",
            "School or educator",
            "Other",
          ],
          rationale: "Tracks referral sources.",
        },
        {
          text: `Before starting this program, how would you rate your confidence in ${intended_change}?`,
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all confident) to 5 (very confident). This will be compared with your exit survey score.",
        },
        {
          text: "Before starting this program, how would you rate your overall wellbeing?",
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (very poor) to 5 (excellent). This will be compared with your exit survey score.",
        },
        {
          text: `Before starting this program, how much do you feel you understand ${immediate_outputs}?`,
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all) to 5 (very well). This will be compared with your exit survey score.",
        },
        {
          text: "What is your main goal for participating in this program?",
          type: "long_text",
          required: true,
          rationale: "Captures participant goals at baseline.",
        },
        {
          text: "Is there anything else you would like us to know before you begin?",
          type: "long_text",
          required: false,
          rationale: "Open space for participant voice.",
        },
      ],
      tool_notes:
        "Share this survey with participants at their first session. Rootwork stores all responses automatically. Use the exit survey later to measure change.",
    };
  }

  if (tool_type === "survey" && survey_purpose === "post_exit") {
    return {
      questions: [
        {
          text: `After completing this program, how would you rate your confidence in ${intended_change}?`,
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all confident) to 5 (very confident). Compare this with your intake score to measure change.",
        },
        {
          text: "After completing this program, how would you rate your overall wellbeing?",
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (very poor) to 5 (excellent). Compare this with your intake score to measure change.",
        },
        {
          text: `After completing this program, how much do you feel you understand ${immediate_outputs}?`,
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all) to 5 (very well). Compare this with your intake score to measure change.",
        },
        {
          text: "What changed for you as a result of participating in this program?",
          type: "long_text",
          required: true,
          rationale: "Captures perceived change in participant's own words.",
        },
        {
          text: "What was most helpful about this program?",
          type: "long_text",
          required: true,
          rationale: "Identifies program strengths.",
        },
        {
          text: "What could have been better or more useful?",
          type: "long_text",
          required: false,
          rationale: "Identifies areas for improvement.",
        },
        {
          text: "How likely are you to recommend this program to someone you know?",
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all likely) to 5 (very likely).",
        },
        {
          text: "What would you tell someone who is thinking about joining this program?",
          type: "long_text",
          required: false,
          rationale: "Captures participant testimonial language.",
        },
      ],
      tool_notes:
        "Share this survey with participants at their last session. Rootwork stores all responses automatically and links them to intake data for pre/post comparison.",
    };
  }

  if (tool_type === "survey" && survey_purpose === "satisfaction") {
    return {
      questions: [
        {
          text: "Overall, how satisfied are you with this program?",
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (very dissatisfied) to 5 (very satisfied).",
        },
        {
          text: "How would you rate the quality of support from program staff?",
          type: "number",
          required: true,
          rationale: "Rate from 1 (poor) to 5 (excellent).",
        },
        {
          text: "How accessible was this program for you (location, timing, language, transportation)?",
          type: "number",
          required: true,
          rationale: "Rate from 1 (very difficult) to 5 (very easy).",
        },
        {
          text: "How relevant was this program to your needs?",
          type: "number",
          required: true,
          rationale:
            "Rate from 1 (not at all relevant) to 5 (very relevant).",
        },
        {
          text: "What did this program do well?",
          type: "long_text",
          required: true,
          rationale: "Captures qualitative strengths.",
        },
        {
          text: "What could this program improve?",
          type: "long_text",
          required: false,
          rationale: "Captures qualitative improvement areas.",
        },
        {
          text: "Is there anything else you would like us to know?",
          type: "long_text",
          required: false,
          rationale: "Open space for additional feedback.",
        },
      ],
      tool_notes:
        "Share this survey with participants at any point during or after their program experience. Rootwork stores all responses automatically.",
    };
  }

  if (tool_type === "observation") {
    return {
      questions: [
        {
          text: "Date and session number",
          type: "short_text",
          required: true,
          rationale: "Identifies which session this log refers to.",
        },
        {
          text: "How would you describe overall participation and engagement in today's session?",
          type: "long_text",
          required: true,
          rationale: "Captures a holistic view of the session.",
        },
        {
          text: "What barriers or challenges did participants face today?",
          type: "long_text",
          required: false,
          rationale: "Documents obstacles for follow-up planning.",
        },
        {
          text: "What worked particularly well in today's session?",
          type: "long_text",
          required: true,
          rationale: "Highlights strengths to repeat.",
        },
        {
          text: "Were there any notable moments or breakthroughs worth documenting?",
          type: "long_text",
          required: false,
          rationale: "Preserves qualitative highlights.",
        },
        {
          text: "What follow-up actions are needed before the next session?",
          type: "long_text",
          required: false,
          rationale: "Links observations to concrete next steps.",
        },
        {
          text: "What adjustments would you make to improve the next session?",
          type: "long_text",
          required: true,
          rationale: "Supports continuous improvement.",
        },
      ],
      tool_notes:
        "Complete one log entry per session. Rootwork stores all entries automatically. Use these records to track patterns over time and inform program adjustments.",
    };
  }

  console.log(
    "getHardcodedQuestions no match; raw char codes:",
    [...String(tool_typeInput ?? "")].map((c) => c.charCodeAt(0)),
    "normalized JSON:",
    JSON.stringify(tool_type)
  );
  return null;
}

async function loadBuilderAssistContext(orgId) {
  const { data: metrics } = await supabase
    .from("funder_metrics")
    .select(
      "id, metric_name, metric_description, metric_type, reporting_frequency, source"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: engagementRows } = await supabase
    .from("community_engagements")
    .select(
      "id, title, community_members_wanted, priorities_named, created_at"
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: designRows } = await supabase
    .from("program_designs")
    .select("*")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const { data: orgProfile } = await supabase
    .from("org_profiles")
    .select("who_is_most_affected")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: organization } = await supabase
    .from("organizations")
    .select("org_type, primary_geography, languages_served")
    .eq("id", orgId)
    .maybeSingle();

  return {
    funder_metrics: metrics || [],
    engagement: engagementRows?.[0] || null,
    program_design: designRows?.[0] || null,
    org_profile: orgProfile || null,
    organization: organization || null,
  };
}

function resolveToolId(body) {
  const b = body || {};
  const a =
    typeof b.tool_id === "string"
      ? b.tool_id.trim()
      : typeof b.collection_tool_id === "string"
        ? b.collection_tool_id.trim()
        : "";
  return a;
}

router.post("/suggest-questions", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const b = req.body || {};
    const tool_name = typeof b.tool_name === "string" ? b.tool_name.trim() : "";
    const tool_type = normalizeToolType(b.tool_type);
    const who_completes = normalizeWhoCompletes(b.who_completes);
    const rawPurpose =
      typeof b.survey_purpose === "string" ? b.survey_purpose.trim() : "";
    const survey_purpose = rawPurpose ? rawPurpose.toLowerCase() : "";

    console.log("raw tool_type from body:", b.tool_type);
    console.log("normalized tool_type:", tool_type);
    console.log("survey_purpose:", survey_purpose);

    if (!tool_name) {
      return res.status(400).json({ error: "tool_name is required." });
    }

    if (tool_type === "survey") {
      if (!ALLOWED_SURVEY_PURPOSE.has(survey_purpose)) {
        return res.status(400).json({
          error:
            "survey_purpose is required for surveys. Use pre_intake, post_exit, or satisfaction.",
        });
      }
    }

    const ctx = await loadBuilderAssistContext(orgId);

    const hardcoded = getHardcodedQuestions(
      b.tool_type,
      rawPurpose,
      ctx.program_design
    );
    console.log("hardcoded result:", hardcoded ? "FOUND" : "NULL");

    if (hardcoded) {
      let consent_text = "";
      let consent_language = null;
      try {
        const consentResult = await agent09_consentDraft({
          orgId,
          userId: user.id,
          tool_name,
          tool_type,
          who_completes,
          questions: hardcoded.questions,
          org_profile: ctx.org_profile,
          program_design: ctx.program_design,
          organization: ctx.organization,
        });
        consent_text =
          typeof consentResult?.consent_text === "string"
            ? consentResult.consent_text.trim()
            : "";
        consent_language =
          consentResult?.consent_language ||
          (consent_text ? { en: consent_text } : null);
      } catch (e) {
        console.error("Consent draft failed:", e.message);
      }
      return res.status(200).json({
        questions: hardcoded.questions,
        tool_notes: hardcoded.tool_notes,
        consent_text,
        consent_language,
      });
    }

    const community_priorities = {
      priorities_named:
        typeof ctx.engagement?.priorities_named === "string"
          ? ctx.engagement.priorities_named
          : "",
      community_members_wanted:
        typeof ctx.engagement?.community_members_wanted === "string"
          ? ctx.engagement.community_members_wanted
          : "",
    };
    const program_design = extractProgramDesignSummary(ctx.program_design);

    let qResult;
    let consentResult;
    try {
      [qResult, consentResult] = await Promise.all([
        agent09b_questionSuggestions({
          orgId,
          userId: user.id,
          tool_name,
          tool_type,
          survey_purpose: tool_type === "survey" ? survey_purpose : "",
          funder_metrics: ctx.funder_metrics,
          community_priorities,
          program_design,
          who_completes,
        }),
        agent09_consentDraft({
          orgId,
          userId: user.id,
          tool_name,
          tool_type,
          who_completes,
          questions: [],
          org_profile: ctx.org_profile,
          program_design: ctx.program_design,
          organization: ctx.organization,
        }),
      ]);
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Could not generate suggestions.",
      });
    }

    const questions = Array.isArray(qResult?.questions)
      ? qResult.questions
      : [];
    if (questions.length === 0) {
      return res.status(400).json({
        error:
          "No suggested questions were returned. Try again or add questions manually.",
      });
    }

    const consent_text =
      typeof consentResult?.consent_text === "string"
        ? consentResult.consent_text.trim()
        : "";
    const consent_language =
      consentResult?.consent_language ||
      (consent_text ? { en: consent_text } : null);

    let tool_notes =
      typeof qResult?.tool_notes === "string" ? qResult.tool_notes.trim() : "";
    if (tool_type === "observation") {
      tool_notes =
        "Complete one log entry per session. Rootwork stores all entries automatically. Use these records to track patterns over time and inform program adjustments.";
    }

    return res.status(200).json({
      questions,
      tool_notes,
      consent_text,
      consent_language,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/consent-draft", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const b = req.body || {};
    const tool_name = typeof b.tool_name === "string" ? b.tool_name.trim() : "";
    const tool_type = normalizeToolType(b.tool_type);

    if (!tool_name) {
      return res.status(400).json({ error: "tool_name is required." });
    }

    const who_completes = normalizeWhoCompletes(b.who_completes);
    const questions = normalizeQuestions(b.questions);

    const context = await loadConsentDraftContext(orgId);

    let result;
    try {
      result = await agent09_consentDraft({
        orgId,
        userId: user.id,
        tool_name,
        tool_type,
        who_completes,
        questions,
        org_profile: context.org_profile,
        program_design: context.program_design,
        organization: context.organization,
      });
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Could not generate consent draft.",
      });
    }

    if (!result.consent_text) {
      return res.status(400).json({
        error: "Consent draft was empty. Try again or edit manually.",
      });
    }

    return res.status(200).json({
      consent_text: result.consent_text,
      consent_language: result.consent_language || { en: result.consent_text },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/save-tool", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const b = req.body || {};
    const tool_name = typeof b.tool_name === "string" ? b.tool_name.trim() : "";
    const tool_type = normalizeToolType(b.tool_type);
    const who_completes = normalizeWhoCompletes(b.who_completes);
    const consentMap = normalizeConsentLanguage(b.consent_language);
    const consent_language = serializeConsentLanguage(consentMap);
    const governance_checks = b.governance_checks;

    if (!tool_name) {
      return res.status(400).json({ error: "tool_name is required." });
    }

    if (Array.isArray(b.questions)) {
      for (let i = 0; i < b.questions.length; i++) {
        const rawQ = b.questions[i] || {};
        const qid =
          typeof rawQ.id === "string" && rawQ.id.trim()
            ? rawQ.id.trim()
            : `index-${i}`;

        // text may be a bare string (legacy) or { en, ... } (new shape).
        if (isBlankQuestionText(rawQ)) {
          return res.status(400).json({
            error: "Question text cannot be empty.",
            errors: [
              {
                question_id: qid,
                error: "Question text cannot be empty.",
              },
            ],
          });
        }

        const rawType = String(rawQ.type || rawQ.questionType || "")
          .toLowerCase()
          .trim();
        if (
          rawType === "multiple_choice" &&
          Array.isArray(rawQ.options)
        ) {
          for (let oi = 0; oi < rawQ.options.length; oi++) {
            if (!isUsableOption(rawQ.options[oi])) {
              return res.status(400).json({
                error: "Question option is invalid.",
                errors: [
                  {
                    question_id: qid,
                    error: `Option at position ${oi} must include a non-empty en label.`,
                  },
                ],
              });
            }
          }
        }
      }
    }

    const questions = normalizeQuestions(b.questions);
    const logicErrors = validateQuestionLogic(questions);
    if (logicErrors.length > 0) {
      return res.status(400).json({
        error: "Question logic is invalid.",
        errors: logicErrors,
      });
    }

    const configuration = buildConfiguration(
      who_completes,
      questions,
      "draft",
      governance_checks
    );

    const toolId = resolveToolId(b);

    if (toolId) {
      const { data: existing, error: findErr } = await supabase
        .from("collection_tools")
        .select("id, org_id")
        .eq("id", toolId)
        .maybeSingle();

      if (findErr || !existing || existing.org_id !== orgId) {
        return res.status(400).json({ error: "Collection tool not found." });
      }

      const { data: updated, error: upErr } = await supabase
        .from("collection_tools")
        .update({
          tool_name,
          tool_type,
          consent_language: consent_language || null,
          configuration,
        })
        .eq("id", toolId)
        .eq("org_id", orgId)
        .select("*")
        .single();

      if (upErr) {
        return res.status(400).json({ error: upErr.message });
      }
      return res.status(200).json({ tool: updated });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("collection_tools")
      .insert({
        org_id: orgId,
        tool_name,
        tool_type,
        consent_language: consent_language || null,
        configuration,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insErr) {
      return res.status(400).json({ error: insErr.message });
    }

    return res.status(201).json({ tool: inserted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/launch-tool", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const toolId = resolveToolId(req.body || {});

    if (!toolId) {
      return res.status(400).json({ error: "tool_id is required." });
    }

    const { data: row, error: findErr } = await supabase
      .from("collection_tools")
      .select("*")
      .eq("id", toolId)
      .maybeSingle();

    if (findErr || !row || row.org_id !== orgId) {
      return res.status(400).json({ error: "Collection tool not found." });
    }

    const consent = parseStoredConsentLanguage(row.consent_language);
    if (!consent || !consent.en) {
      return res.status(400).json({
        error:
          "Consent language must be saved before launch. English consent cannot be empty.",
      });
    }

    const cfg = row.configuration;
    if (!isConfigurationNonEmpty(cfg)) {
      return res.status(400).json({
        error: "Tool configuration is empty. Save the tool draft first.",
      });
    }

    if (!governanceChecksComplete(cfg)) {
      return res.status(400).json({
        error:
          "All three governance confirmations must be saved on this tool before launch.",
      });
    }

    const launchQuestions = normalizeQuestions(
      Array.isArray(cfg.questions) ? cfg.questions : []
    );
    const logicErrors = validateQuestionLogic(launchQuestions);
    if (logicErrors.length > 0) {
      return res.status(400).json({
        error: "Question logic is invalid.",
        errors: logicErrors,
      });
    }

    const launchedAt = new Date().toISOString();
    // Generate public_token once at first launch and keep it on re-launch so
    // existing community links stay valid. Rotation is a separate deliberate action.
    const updates = { launched_at: launchedAt };
    if (
      typeof row.public_token !== "string" ||
      !row.public_token.trim()
    ) {
      updates.public_token = generatePublicToken();
    }

    const { data: updated, error: upErr } = await supabase
      .from("collection_tools")
      .update(updates)
      .eq("id", toolId)
      .eq("org_id", orgId)
      .select("id, public_token, launched_at")
      .single();

    if (upErr) {
      return res.status(400).json({ error: upErr.message });
    }

    const { error: stage03Err } = await supabase
      .from("stage_progress")
      .update({
        status: "completed",
        completed_at: launchedAt,
        completed_by: user.id,
      })
      .eq("org_id", orgId)
      .eq("stage", "03");

    if (stage03Err) {
      return res.status(400).json({ error: stage03Err.message });
    }

    const { error: stage04Err } = await supabase
      .from("stage_progress")
      .update({ status: "in_progress" })
      .eq("org_id", orgId)
      .eq("stage", "04");

    if (stage04Err) {
      return res.status(400).json({ error: stage04Err.message });
    }

    return res.status(200).json({
      success: true,
      public_token: updated?.public_token || updates.public_token || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

// Take a live form down without rotating the token. Clearing launched_at makes
// the public loader 404. The same token can be re-enabled by launching again.
router.post("/unlaunch-tool", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const toolId = resolveToolId(req.body || {});
    if (!toolId) {
      return res.status(400).json({ error: "tool_id is required." });
    }

    const { data: row, error: findErr } = await supabase
      .from("collection_tools")
      .select("id, org_id, launched_at")
      .eq("id", toolId)
      .maybeSingle();

    if (findErr || !row || row.org_id !== orgId) {
      return res.status(400).json({ error: "Collection tool not found." });
    }

    const { error: upErr } = await supabase
      .from("collection_tools")
      .update({ launched_at: null })
      .eq("id", toolId)
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

// Invalidate outstanding public links by issuing a new token. Deliberate:
// does not clear launched_at. The form stays live only at the new token URL.
router.post("/rotate-public-token", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const toolId = resolveToolId(req.body || {});
    if (!toolId) {
      return res.status(400).json({ error: "tool_id is required." });
    }

    const { data: row, error: findErr } = await supabase
      .from("collection_tools")
      .select("id, org_id")
      .eq("id", toolId)
      .maybeSingle();

    if (findErr || !row || row.org_id !== orgId) {
      return res.status(400).json({ error: "Collection tool not found." });
    }

    const public_token = generatePublicToken();
    const { data: updated, error: upErr } = await supabase
      .from("collection_tools")
      .update({ public_token })
      .eq("id", toolId)
      .eq("org_id", orgId)
      .select("id, public_token, launched_at")
      .single();

    if (upErr) {
      return res.status(400).json({ error: upErr.message });
    }

    return res.status(200).json({
      success: true,
      public_token: updated.public_token,
      launched: Boolean(updated.launched_at),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.get("/tools", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const { data: tools, error } = await supabase
      .from("collection_tools")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ tools: tools || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.get("/gap-review", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const { data: row } = await supabase
      .from("collection_gap_reviews")
      .select("payload")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const gap_review =
      row?.payload && typeof row.payload === "object" ? row.payload : null;

    return res.status(200).json({ gap_review });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

router.post("/gap-review", requireStarterTier, async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { orgId, error: orgError } = await getOrgIdForUser(user.id);
    if (orgError) {
      return res.status(400).json({ error: orgError });
    }

    const inputs = await loadGapReviewData(orgId);

    let result;
    try {
      result = await agent08_collectionGapReview({
        orgId,
        userId: user.id,
        funder_metrics: inputs.funder_metrics,
        engagement: inputs.engagement,
        program_design: inputs.program_design,
        collection_tools: inputs.collection_tools,
      });
    } catch (agentErr) {
      console.error(agentErr);
      return res.status(500).json({
        error: agentErr.message || "Could not generate gap review.",
      });
    }

    const payload = {
      funder_requirements: result.funder_requirements || [],
      community_priorities: result.community_priorities || [],
      recommended_tools: result.recommended_tools || [],
      coverage_gaps: result.coverage_gaps || [],
    };

    const totalLen =
      payload.funder_requirements.length +
      payload.community_priorities.length +
      payload.recommended_tools.length +
      payload.coverage_gaps.length;

    if (totalLen === 0) {
      return res.status(400).json({
        error:
          "Gap review returned no content. Add funder metrics, community notes, and program design, then try again.",
      });
    }

    const { error: insertErr } = await supabase
      .from("collection_gap_reviews")
      .insert({
        org_id: orgId,
        payload,
        created_by: user.id,
      });

    if (insertErr) {
      return res.status(400).json({ error: insertErr.message });
    }

    return res.status(201).json({ gap_review: payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error." });
  }
});

// Downloadable paper instrument (.docx). Starter+. One language per request.
router.get(
  "/tools/:toolId/download-instrument",
  requireStarterTier,
  async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const { orgId, error: orgError } = await getOrgIdForUser(user.id);
      if (orgError) {
        return res.status(400).json({ error: orgError });
      }

      const toolId =
        typeof req.params.toolId === "string" ? req.params.toolId.trim() : "";
      if (!toolId) {
        return res.status(400).json({ error: "tool_id is required." });
      }

      const { data: tool, error: findErr } = await supabase
        .from("collection_tools")
        .select("*")
        .eq("id", toolId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (findErr || !tool) {
        return res.status(400).json({ error: "Collection tool not found." });
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("name, languages_served")
        .eq("id", orgId)
        .maybeSingle();

      const cfg =
        tool.configuration && typeof tool.configuration === "object"
          ? tool.configuration
          : {};
      const questions = normalizeQuestions(
        Array.isArray(cfg.questions) ? cfg.questions : []
      );
      const offered = instrumentLanguagesForTool(questions, org || {});
      const requested =
        typeof req.query.lang === "string" && req.query.lang.trim()
          ? req.query.lang.trim().toLowerCase()
          : "en";
      const language = offered.includes(requested) ? requested : offered[0] || "en";

      const result = await generateCollectionInstrumentDocx({
        orgName: org?.name || "",
        toolName: tool.tool_name || "Collection tool",
        consentLanguage: parseStoredConsentLanguage(tool.consent_language),
        questions,
        language,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      return res.status(200).send(result.buffer);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || "Server error." });
    }
  }
);

// Response export (CSV). Starter+.
router.get(
  "/tools/:toolId/download-responses",
  requireStarterTier,
  async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const { orgId, error: orgError } = await getOrgIdForUser(user.id);
      if (orgError) {
        return res.status(400).json({ error: orgError });
      }

      const toolId =
        typeof req.params.toolId === "string" ? req.params.toolId.trim() : "";
      if (!toolId) {
        return res.status(400).json({ error: "tool_id is required." });
      }

      const { data: tool, error: findErr } = await supabase
        .from("collection_tools")
        .select("id, org_id, tool_name, configuration")
        .eq("id", toolId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (findErr || !tool) {
        return res.status(400).json({ error: "Collection tool not found." });
      }

      const cfg =
        tool.configuration && typeof tool.configuration === "object"
          ? tool.configuration
          : {};
      const questions = normalizeQuestions(
        Array.isArray(cfg.questions) ? cfg.questions : []
      );

      const { data: responses, error: respErr } = await supabase
        .from("collection_responses")
        .select("submitted_at, language, response_payload")
        .eq("org_id", orgId)
        .eq("collection_tool_id", toolId)
        .order("submitted_at", { ascending: true });

      if (respErr) {
        return res.status(400).json({ error: respErr.message });
      }

      const shaped = shapeResponseCsv({
        questions,
        responses: responses || [],
      });
      const csv = renderResponseCsv(shaped);
      const filename = responseCsvFilename(tool.tool_name);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      return res.status(200).send(csv);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || "Server error." });
    }
  }
);

module.exports = router;
