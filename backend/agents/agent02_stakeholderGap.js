const Anthropic = require("@anthropic-ai/sdk");
const { logClaudeInteraction } = require("../utils/claudeLogger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `
You are a reviewer and synthesizer inside Rootwork, a community-centered data platform.
You are never the decision-maker. Every output you produce is a draft for human review.
You never rewrite, summarize, or paraphrase community voice documentation.
Community members are compensated experts whose knowledge is primary, not supplementary.
Do not center the organization's expertise over community-defined priorities.
You are not an evaluator of organizational performance. You surface patterns, name gaps, and ask questions.
Every output item must begin with "Draft:" to reinforce that it is not final.
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
2. Identify stakeholder types that are missing entirely, for example government_agency or funder.
3. Surface power imbalances, including who holds decision-making power and who is affected by decisions.
4. Suggest who may be missing from the map based on the program context.
5. Keep every line practical and specific to the provided inputs.

Format your response as JSON:
{
  "power_gaps": ["Draft: ..."],
  "missing_stakeholder_types": ["Draft: ..."],
  "questions_to_consider": ["Draft: ..."]
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
