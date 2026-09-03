const Anthropic = require("@anthropic-ai/sdk");
const { logClaudeInteraction } = require("../utils/claudeLogger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `
You are a reviewer and synthesizer inside Rootwork, a community-centered data platform.
You are never the decision-maker. Every output you produce is a draft for human review.
Never use em dashes in any output.
Never use hyphens to contrast two ideas in the format "X - not Y".
Use commas, periods, or restructure the sentence instead.
Write in short declarative sentences.
Do not use corporate jargon.
`;

const ALLOWED_Q_TYPES = new Set([
  "short_text",
  "long_text",
  "multiple_choice",
  "yes_no",
  "number",
  "date",
]);

function formatFunderMetrics(metrics) {
  if (!metrics || metrics.length === 0) {
    return "(No funder metrics on file.)";
  }
  return metrics
    .map((m) => {
      const parts = [m.metric_name, m.metric_description || ""].filter(
        Boolean
      );
      return `- ${parts.join(": ")}`;
    })
    .join("\n");
}

function formatCommunityPriorities(cp) {
  if (!cp || typeof cp !== "object") {
    return "(No community priorities on file.)";
  }
  const pn =
    typeof cp.priorities_named === "string" ? cp.priorities_named.trim() : "";
  const cmw =
    typeof cp.community_members_wanted === "string"
      ? cp.community_members_wanted.trim()
      : "";
  return [
    "priorities_named:",
    pn || "(not recorded)",
    "",
    "community_members_wanted:",
    cmw || "(not recorded)",
  ].join("\n");
}

function formatProgramDesign(programDesign) {
  if (!programDesign || typeof programDesign !== "object") {
    return "(No program design on file.)";
  }
  const ic = String(programDesign.intended_change ?? "").trim();
  const io = String(programDesign.immediate_outputs ?? "").trim();
  const cl = String(programDesign.change_level ?? "").trim();
  const rn = String(programDesign.resources_needed ?? "").trim();
  return [
    `intended_change: ${ic || "(not set)"}`,
    `immediate_outputs: ${io || "(not set)"}`,
    `change_level: ${cl || "(not set)"}`,
    `resources_needed: ${rn || "(not set)"}`,
  ].join("\n");
}

function formatWhoCompletes(who) {
  const map = {
    program_participants: "Program participants",
    staff_members: "Staff members",
    both: "Both participants and staff",
    other: "Other or mixed audience",
  };
  const k = typeof who === "string" ? who.toLowerCase().trim() : "";
  return map[k] || who || "(not specified)";
}

function formatSurveyPurpose(purpose) {
  const p = typeof purpose === "string" ? purpose.toLowerCase().trim() : "";
  if (p === "pre_intake") return "pre_intake (pre-program intake baseline)";
  if (p === "post_exit") return "post_exit (post-program exit)";
  if (p === "satisfaction") return "satisfaction (satisfaction and experience)";
  return p || "(not set)";
}

function buildInstrumentSpecification(tool_type, survey_purpose) {
  const t = (tool_type || "survey").toLowerCase().trim();
  const sp = (survey_purpose || "").toLowerCase().trim();

  if (t === "survey" && sp === "pre_intake") {
    return `
Instrument: pre_intake survey.

You must output exactly 9 questions in this order. Types, required flags, and multiple_choice options must match exactly. Use the rationale string given for each item that lists one; for other items omit the rationale key or use an empty string.

Placeholder rules: Replace the primary program goal phrase using intended_change from program design. Replace the key skill or knowledge area phrase using immediate_outputs from program design. Shorten or clarify if needed so questions stay readable. Never leave square brackets or placeholder tokens in final text.

Q1: Text "What is your age range?" Type multiple_choice. required true. options exactly: ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65 or older"]

Q2: Text "What is your primary language?" Type short_text. required true.

Q3: Text "What zip code do you live in?" Type short_text. required true.

Q4: Text "How did you hear about this program?" Type multiple_choice. required false. options exactly: ["Word of mouth", "Social media", "Community organization", "Healthcare provider", "School or educator", "Other"]

Q5: Text must read: Before starting this program, how would you rate your confidence in [PRIMARY GOAL FROM intended_change]? Type number. required true. rationale exactly: Rate from 1 (not at all confident) to 5 (very confident). This will be compared with your exit survey score.

Q6: Text "Before starting this program, how would you rate your overall wellbeing?" Type number. required true. rationale exactly: Rate from 1 (very poor) to 5 (excellent). This will be compared with your exit survey score.

Q7: Text must read: Before starting this program, how much do you feel you understand [SKILL AREA FROM immediate_outputs]? Type number. required true. rationale exactly: Rate from 1 (not at all) to 5 (very well). This will be compared with your exit survey score.

Q8: Text "What is your main goal for participating in this program?" Type long_text. required true.

Q9: Text "Is there anything else you would like us to know before you begin?" Type long_text. required false.
`;
  }

  if (t === "survey" && sp === "post_exit") {
    return `
Instrument: post_exit survey.

You must output exactly 8 questions in this order. Types, required flags, and rationale strings must match the specification below.

Placeholder rules: For Q1, Q2, and Q3 use the same primary goal wording, wellbeing wording, and skill or knowledge area wording you would use on a matching pre_intake survey for this program, drawn from intended_change and immediate_outputs in program design. Never leave square brackets in final text.

Q1: Text must read: After completing this program, how would you rate your confidence in [SAME PRIMARY PROGRAM GOAL AS PRE-SURVEY]? Type number. required true. rationale exactly: Rate from 1 (not at all confident) to 5 (very confident). Compare this with your intake score to measure change.

Q2: Text "After completing this program, how would you rate your overall wellbeing?" Type number. required true. rationale exactly: Rate from 1 (very poor) to 5 (excellent). Compare this with your intake score to measure change.

Q3: Text must read: After completing this program, how much do you feel you understand [SAME KEY SKILL OR KNOWLEDGE AREA AS PRE-SURVEY]? Type number. required true. rationale exactly: Rate from 1 (not at all) to 5 (very well). Compare this with your intake score to measure change.

Q4: Text "What changed for you as a result of participating in this program?" Type long_text. required true.

Q5: Text "What was most helpful about this program?" Type long_text. required true.

Q6: Text "What could have been better or more useful?" Type long_text. required false.

Q7: Text "How likely are you to recommend this program to someone you know?" Type number. required true. rationale exactly: Rate from 1 (not at all likely) to 5 (very likely).

Q8: Text "What would you tell someone who is thinking about joining this program?" Type long_text. required false.
`;
  }

  if (t === "survey" && sp === "satisfaction") {
    return `
Instrument: satisfaction survey.

You must output exactly 7 questions in this order.

Q1: Text "Overall, how satisfied are you with this program?" Type number. required true. rationale exactly: Rate from 1 (very dissatisfied) to 5 (very satisfied).

Q2: Text "How would you rate the quality of support from program staff?" Type number. required true. rationale exactly: Rate from 1 (poor) to 5 (excellent).

Q3: Text "How accessible was this program for you (location, timing, language, transportation)?" Type number. required true. rationale exactly: Rate from 1 (very difficult) to 5 (very easy).

Q4: Text "How relevant was this program to your needs?" Type number. required true. rationale exactly: Rate from 1 (not at all relevant) to 5 (very relevant).

Q5: Text "What did this program do well?" Type long_text. required true.

Q6: Text "What could this program improve?" Type long_text. required false.

Q7: Text "Is there anything else you would like us to know?" Type long_text. required false.
`;
  }

  if (t === "observation") {
    return `
Instrument: observation log.

You must output exactly 7 questions in this order.

Q1: Text "Date and session number" Type short_text. required true.

Q2: Text "How would you describe overall participation and engagement in today's session?" Type long_text. required true.

Q3: Text "What barriers or challenges did participants face today?" Type long_text. required false.

Q4: Text "What worked particularly well in today's session?" Type long_text. required true.

Q5: Text "Were there any notable moments or breakthroughs worth documenting?" Type long_text. required false.

Q6: Text "What follow-up actions are needed before the next session?" Type long_text. required false.

Q7: Text "What adjustments would you make to improve the next session?" Type long_text. required true.
`;
  }

  if (t === "administrative") {
    return `
Instrument: administrative tracking record.

You must output exactly 10 fields as questions in this order. Types, required flags, and options must match exactly.

Q1: Text "Enrollment date" Type date. required true.

Q2: Text "Age range" Type multiple_choice. required true. options exactly: ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65 or older"]

Q3: Text "Gender identity" Type multiple_choice. required true. options exactly: ["Woman", "Man", "Non-binary or genderqueer", "Transgender", "I use a different term", "Prefer not to say"]

Q4: Text "Race and ethnicity" Type multiple_choice. required true. options exactly: ["Black or African American", "Hispanic or Latine", "White", "Asian or Asian American", "Native American or Alaska Native", "Native Hawaiian or Pacific Islander", "Multiracial", "I use a different term", "Prefer not to say"]

Q5: Text "Primary language spoken at home" Type short_text. required true.

Q6: Text "Zip code" Type short_text. required true.

Q7: Text "Household size" Type number. required false.

Q8: Text "Annual household income range" Type multiple_choice. required false. options exactly: ["Under $25,000", "$25,000 to $49,999", "$50,000 to $74,999", "$75,000 to $99,999", "$100,000 or more", "Prefer not to say"]

Q9: Text "How did this participant hear about the program?" Type multiple_choice. required false. options exactly: ["Word of mouth", "Social media", "Community organization", "Healthcare provider", "School or educator", "Other"]

Q10: Text "Number of sessions attended this period" Type number. required false.
`;
  }

  if (t === "interview") {
    return `
Instrument: interview guide.

Generate 6 to 8 reflective prompts appropriate for semi-structured interviews, grounded in funder metrics, community priorities, and program design. Mix short_text and long_text. Keep language respectful and plain. Order prompts from broad to more specific.

For this instrument only, also return a non-empty tool_notes string with brief guidance on timing, consent, and documentation for staff.
`;
  }

  return `
Instrument: generic collection tool.

Produce 6 to 10 items appropriate to this tool type, grounded in the org context provided.
`;
}

function maxQuestionsForTool(tool_type, survey_purpose) {
  const t = (tool_type || "").toLowerCase().trim();
  const sp = (survey_purpose || "").toLowerCase().trim();
  if (t === "survey" && sp === "pre_intake") return 9;
  if (t === "survey" && sp === "post_exit") return 8;
  if (t === "survey" && sp === "satisfaction") return 7;
  if (t === "observation") return 7;
  if (t === "administrative") return 10;
  if (t === "interview") return 8;
  return 12;
}

function normalizeQuestionsFromModel(raw, tool_type, survey_purpose) {
  if (!Array.isArray(raw)) return [];
  const cap = maxQuestionsForTool(tool_type, survey_purpose);
  const out = [];
  const t = (tool_type || "").toLowerCase().trim();
  for (const q of raw) {
    if (out.length >= cap) break;
    // Model still emits English string text/options. Adapt to the multilingual
    // shape at this boundary only. Do not rewrite the prompt.
    const textEn =
      typeof q.text === "string"
        ? q.text.trim()
        : typeof q.text?.en === "string"
          ? q.text.en.trim()
          : "";
    if (!textEn) continue;
    let type = (q.type || "short_text").toLowerCase().trim();
    if (!ALLOWED_Q_TYPES.has(type)) type = "short_text";
    if (t === "administrative") {
      const adminAllowed = new Set([
        "short_text",
        "number",
        "multiple_choice",
        "date",
      ]);
      if (!adminAllowed.has(type)) {
        type = "short_text";
      }
    }
    const required = Boolean(q.required);
    const row = { text: { en: textEn }, type, required };
    if (type === "multiple_choice") {
      const opts = Array.isArray(q.options)
        ? q.options
            .map((o) => {
              if (typeof o === "string") return o.trim();
              if (o && typeof o === "object") {
                if (typeof o.label === "string") return o.label.trim();
                if (typeof o.label?.en === "string") return o.label.en.trim();
              }
              return "";
            })
            .filter(Boolean)
        : [];
      const labels =
        opts.length >= 2 ? opts.slice(0, 24) : ["Option A", "Option B"];
      // Ids are assigned later by normalizeQuestions once the question has an id.
      row.options = labels.map((en) => ({ label: { en } }));
    }
    const rationale =
      typeof q.rationale === "string" ? q.rationale.trim() : "";
    if (rationale) row.rationale = rationale;
    out.push(row);
  }
  return out;
}

function parseJsonFromAssistant(rawOutput) {
  let jsonText = String(rawOutput || "").trim();
  const fenced = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fenced) jsonText = fenced[1].trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function agent09b_questionSuggestions({
  orgId,
  userId,
  tool_name,
  tool_type,
  survey_purpose,
  funder_metrics,
  community_priorities,
  program_design,
  who_completes,
}) {
  const purposeLine = formatSurveyPurpose(survey_purpose);
  const specBlock = buildInstrumentSpecification(tool_type, survey_purpose);
  const tt = (tool_type || "").toLowerCase().trim();
  const toolNotesRule =
    tt === "interview"
      ? "tool_notes must be a short paragraph of staff guidance on timing, consent, and documentation."
      : "tool_notes must be an empty string.";

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your task: Produce the questions array for one collection instrument. The org will edit your list. Follow the instrument specification below exactly for this tool type and survey purpose.

${specBlock}

Return JSON only in this shape:
{
  "questions": [
    {
      "text": "the full question text",
      "type": "short_text | long_text | multiple_choice | yes_no | number | date",
      "required": true or false,
      "options": ["option 1", "option 2"],
      "rationale": "optional one sentence when the specification requires it"
    }
  ],
  "tool_notes": ""
}

Rules:
- type must be exactly one of: short_text, long_text, multiple_choice, yes_no, number, date.
- For multiple_choice only, include options with at least two non-empty strings matching the specification. Omit the options key for other types.
- required must be a boolean for every question.
- Never use em dashes in any string value.
- Return valid JSON only. No markdown fences around the JSON.
- ${toolNotesRule}
`;

  const userPrompt = `Tool name: ${tool_name || "(unnamed tool)"}
Tool type: ${tool_type || "survey"}
Survey purpose (surveys only): ${purposeLine}
Who completes this instrument: ${formatWhoCompletes(who_completes)}

--- Funder metrics ---
${formatFunderMetrics(funder_metrics)}

--- Community priorities ---
${formatCommunityPriorities(community_priorities)}

--- Program design (Stage 01 intake summary) ---
${formatProgramDesign(program_design)}

Use intended_change from program design as the source for the primary program goal wording in pre_intake and post_exit items that need it. Use immediate_outputs as the source for the key skill or knowledge area wording. Generate the JSON response for this tool only.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstBlock = response.content[0];
  const rawOutput =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

  const parsed = parseJsonFromAssistant(rawOutput);
  const questionsRaw =
    parsed && Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = normalizeQuestionsFromModel(
    questionsRaw,
    tool_type,
    survey_purpose
  );

  const tool_notes =
    typeof parsed?.tool_notes === "string" ? parsed.tool_notes.trim() : "";

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "03",
    interactionType: "question_suggestions",
    promptSummary: `Question suggestions for ${tool_name || "tool"} (${tool_type}${
      survey_purpose ? `, ${survey_purpose}` : ""
    })`,
    outputSummary: `Questions: ${questions.length}. tool_notes chars: ${tool_notes.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return { questions, tool_notes };
}

module.exports = { agent09b_questionSuggestions };
