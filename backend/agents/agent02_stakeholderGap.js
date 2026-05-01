const Anthropic = require("@anthropic-ai/sdk");
const { logClaudeInteraction } = require("../utils/claudeLogger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `
You are a reviewer and synthesizer inside Rootwork, a community-centered data platform.
You are never the decision-maker. Every output you produce is for human review before it is treated as final.
You never rewrite, summarize, or paraphrase community voice documentation.
Community members are compensated experts whose knowledge is primary, not supplementary.
Do not center the organization's expertise over community-defined priorities.
You are not an evaluator of organizational performance. You surface patterns, name gaps, and ask questions.
Do not prefix any output with the word Draft. Do not use the word Draft anywhere in your response. Return only the analysis content itself.
Never use em dashes in any output.
Never use hyphens to contrast two ideas in the format "X - not Y" or "X — not Y".
Use commas, periods, or restructure the sentence instead.
Write in short declarative sentences.
Do not use corporate jargon.
`;

async function agent02_stakeholderGap({
  orgId,
  userId,
  stakeholders = [],
  context = {},
}) {
  const { who_is_most_affected = "", theory_of_change = "" } = context;

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Review the stakeholder map and identify representation and power gaps.
1. Check whether community members appear only as beneficiaries and not in decision-making roles.
2. For missing_stakeholder_types, each array entry must be a full descriptive name of a stakeholder perspective that appears missing from the map given the program context, such as "Local government agency or city department", "Faith-based community organization", "Healthcare provider or clinic", or "School or educational institution". Infer what is actually missing from this program. Each string should read like a role or institution a user would recognize, not a database enum. If you would otherwise output only a generic label like other, funder, community_member, partner_org, or government_agency, replace it with a concrete descriptive phrase tied to this program.
3. Surface power imbalances, including who holds decision-making power and who is affected by decisions.
4. Suggest who may be missing from the map based on the program context.
5. Keep every line practical and specific to the provided inputs.

Format your response as JSON:
{
  "power_gaps": ["Specific observation about power or representation..."],
  "missing_stakeholder_types": ["Full descriptive missing stakeholder perspective..."],
  "questions_to_consider": ["Reflective question for the team..."]
}

Return valid JSON only.
`;

  const userPrompt = `
Program context:
- Who is most affected: ${who_is_most_affected}
- Theory of change: ${theory_of_change}

Stakeholders:
${JSON.stringify(stakeholders, null, 2)}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
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
    parsed = {
      power_gaps: [],
      missing_stakeholder_types: [],
      questions_to_consider: [],
      parse_error: true,
      raw_output: rawOutput,
    };
  }

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "01",
    interactionType: "gap_flag",
    promptSummary: "Stakeholder gap analysis",
    outputSummary: `Power gaps: ${parsed.power_gaps?.length || 0}. Missing types: ${
      parsed.missing_stakeholder_types?.length || 0
    }.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return parsed;
}

module.exports = { agent02_stakeholderGap };
