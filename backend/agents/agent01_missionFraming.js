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
Never use em dashes in any output.
Never use hyphens to contrast two ideas in the format "X - not Y" or "X — not Y".
Use commas, periods, or restructure the sentence instead.
Write in short declarative sentences.
Do not use corporate jargon.
`;

async function agent01_missionFraming({ orgId, userId, inputs }) {
  const { who_is_most_affected, definition_of_success, theory_of_change } =
    inputs;

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Review the org's mission framing inputs and:
1. Draft a mission statement in 2-3 sentences that centers who is most affected (not the organization itself).
2. Flag any language that centers the institution over the community. Be specific about which phrase and why.
3. Flag any vague language that avoids naming who is affected or what change looks like.
4. For every flag, provide exactly three rewrite options as complete, ready-to-use replacement text.
   - Each option must be an actual sentence or phrase the org can directly copy.
   - Do not describe what to change; provide the rewritten text itself.
5. Never use em dashes in any output.
6. Never use hyphens to contrast two ideas in the format "X - not Y" or "X — not Y".
7. Use commas, periods, or restructure the sentence instead.
8. Write in short declarative sentences.
9. Do not use corporate jargon.

Format your response as JSON:
{
  "draft_mission": "...",
  "flags": [
    {
      "type": "institution_centered" | "vague_language",
      "excerpt": "the specific phrase from the draft that is problematic",
      "suggestion": "explanation of why this is a problem",
      "options": [
        "Rewrite option 1: a complete replacement sentence or phrase",
        "Rewrite option 2: a different approach to the same fix",
        "Rewrite option 3: a third alternative"
      ]
    }
  ]
}
`;

  const userPrompt = `
Org's mission framing inputs:
- Who is most affected by your program: ${who_is_most_affected}
- What does success look like: ${definition_of_success}
- Theory of change: ${theory_of_change}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
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
    parsed = { draft_mission: rawOutput, flags: [], parse_error: true };
  }

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "01",
    interactionType: "gap_flag",
    promptSummary: "Mission framing review — 3 inputs",
    outputSummary: `Draft generated. ${parsed.flags?.length || 0} flags raised.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return parsed;
}

module.exports = { agent01_missionFraming };
