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

function summarizeQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return "(No questions drafted yet.)";
  }
  return questions
    .map((q, i) => {
      // Prefer English from the localized map; fall back to legacy string text.
      let text = "";
      if (typeof q.text === "string") {
        text = q.text;
      } else if (q.text && typeof q.text === "object" && typeof q.text.en === "string") {
        text = q.text.en;
      } else if (typeof q.questionText === "string") {
        text = q.questionText;
      }
      const type = q.type || q.questionType || "";
      const req = q.required ? "required" : "optional";
      return `${i + 1}. [${type}] (${req}) ${text}`;
    })
    .join("\n");
}

function formatOrgProfile(orgProfile) {
  if (!orgProfile) {
    return "(No org profile on file.)";
  }
  const w = orgProfile.who_is_most_affected;
  return `Who is most affected (org profile): ${w && String(w).trim() ? String(w).trim() : "(not set)"}`;
}

function formatProgramDesign(programDesign) {
  if (!programDesign) {
    return "(No program design on file.)";
  }
  const intake = programDesign.program_model?.stage01_intake || {};
  const lines = [
    `intended_change: ${intake.intended_change || "(not set)"}`,
    `immediate_outputs: ${intake.immediate_outputs || "(not set)"}`,
    `change_level: ${intake.change_level || "(not set)"}`,
    "",
    "program_model JSON:",
    JSON.stringify(programDesign.program_model || {}, null, 2),
  ];
  return lines.join("\n");
}

function formatOrganization(organization) {
  if (!organization) {
    return "(No organization row on file.)";
  }
  const langs = Array.isArray(organization.languages_served)
    ? organization.languages_served.join(", ")
    : organization.languages_served || "(not set)";
  return [
    `org_type: ${organization.org_type || "(not set)"}`,
    `primary_geography: ${organization.primary_geography || "(not set)"}`,
    `languages_served: ${langs}`,
  ].join("\n");
}

async function agent09_consentDraft({
  orgId,
  userId,
  tool_name,
  tool_type,
  who_completes,
  questions,
  org_profile,
  program_design,
  organization,
}) {
  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your task: Draft consent language for a single data collection tool. The audience is adult participants or staff who will complete the instrument. The tone should be respectful, plain language, and suitable for community-centered programs.

Return JSON only in this shape:
{ "consent_text": "full draft consent wording as one string with paragraph breaks using newline characters where helpful" }

Rules:
- Explain what data is collected, why, who will see it, voluntary participation, and how to withdraw or ask questions.
- Ground the wording in the org profile, geography, languages, and program design context you were given when it helps clarity.
- Name the organization only as "this organization" unless the user message includes an explicit legal name you should mirror exactly.
- Never use em dashes.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const userPrompt = `Tool name: ${tool_name || "(unnamed tool)"}
Tool type: ${tool_type || "unspecified"}
Who completes this: ${who_completes || "unspecified"}

Planned questions (summary):
${summarizeQuestions(questions)}

--- Org profile ---
${formatOrgProfile(org_profile)}

--- Program design ---
${formatProgramDesign(program_design)}

--- Organization ---
${formatOrganization(organization)}

Write consent text that fits this tool and context.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstBlock = response.content[0];
  const rawOutput =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

  let parsed;
  try {
    let jsonText = rawOutput.trim();
    const fenced = jsonText.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
    if (fenced) jsonText = fenced[1].trim();
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = { consent_text: "" };
  }

  const consent_text =
    typeof parsed.consent_text === "string" ? parsed.consent_text.trim() : "";

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "03",
    interactionType: "consent_draft",
    promptSummary: "Collection tool consent draft",
    outputSummary: `Consent draft chars: ${consent_text.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return { consent_text };
}

module.exports = { agent09_consentDraft };
