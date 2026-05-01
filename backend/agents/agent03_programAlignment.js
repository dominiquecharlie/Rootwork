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
Never use hyphens to contrast two ideas in the format "X - not Y".
Use commas, periods, or restructure the sentence instead.
Write in short declarative sentences.
Do not use corporate jargon.
`;

function normalizeGap(gap) {
  if (!gap || typeof gap !== "object") return null;
  const area = typeof gap.area === "string" ? gap.area.trim() : "";
  const observation =
    typeof gap.observation === "string" ? gap.observation.trim() : "";
  const question =
    typeof gap.question === "string" ? gap.question.trim() : "";
  if (!area && !observation && !question) return null;
  return { area, observation, question };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

async function agent03_programAlignment({
  orgId,
  userId,
  resources_needed,
  program_model,
  delivery_method,
  frequency,
  geography,
  who_leads,
  what_participation_looks_like,
  immediate_outputs,
  intended_change,
  change_level,
  currently_measuring,
}) {
  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Review all eleven program design fields as a logic model. Surface alignment gaps. Stay grounded in what the org actually wrote.

Review deliberately:
1. Whether inputs (resources_needed) are sufficient for the activities described. Consider program_model, delivery_method, frequency, geography, who_leads, and what_participation_looks_like together as the activities picture.
2. Whether those activities logically lead to the stated immediate_outputs.
3. Whether the immediate_outputs could plausibly lead to the stated longer-term outcomes in intended_change.
4. Whether change_level matches the outcome described in intended_change and the scale implied by activities and geography.
5. Whether what is currently measured (currently_measuring) connects to immediate_outputs, intended_change, or both. If nothing is measured or the answer is clearly minimal, note that. Suggest what would be worth tracking. Tie suggestions to stated outputs and outcomes.
6. Flag gaps between any of these four logic model stages: inputs, activities, outputs, outcomes. Name where the chain weakens or skips a step.

Also note tensions that are not gaps, for example delivery frequency versus ambition of intended_change, without judging the org.

Format your response as JSON only:
{
  "alignment_gaps": [
    {
      "area": "short label for the gap area",
      "observation": "what you noticed",
      "question": "a grounding question for the org to sit with"
    }
  ],
  "strengths": ["what appears well-aligned"],
  "suggested_measures": ["specific things worth tracking based on stated goals"]
}

Rules for JSON content:
- Never use em dashes in any string value.
- Never use hyphens to contrast two ideas in the format "X - not Y".
- Use short declarative sentences in observations and questions.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const rn = String(resources_needed ?? "").trim();
  const pm = String(program_model ?? "").trim();
  const dm = String(delivery_method ?? "").trim();
  const fq = String(frequency ?? "").trim();
  const geo = String(geography ?? "").trim();
  const wl = String(who_leads ?? "").trim();
  const part = String(what_participation_looks_like ?? "").trim();
  const imm = String(immediate_outputs ?? "").trim();
  const ic = String(intended_change ?? "").trim();
  const cl = String(change_level ?? "").trim();
  const meas =
    currently_measuring == null || String(currently_measuring).trim() === ""
      ? null
      : String(currently_measuring).trim();

  const fullRecord = {
    resources_needed: rn,
    program_model: pm,
    delivery_method: dm,
    frequency: fq,
    geography: geo,
    who_leads: wl,
    what_participation_looks_like: part,
    immediate_outputs: imm,
    intended_change: ic,
    change_level: cl,
    currently_measuring: meas,
  };

  const measuringDisplay = meas == null ? "(none or not stated)" : meas;

  const userPrompt = `
All eleven program design fields follow. Use them for your logic model review.

Full record as JSON:
${JSON.stringify(fullRecord, null, 2)}

1. resources_needed:
${rn}

2. program_model (activities narrative, how the program works):
${pm}

3. delivery_method (code): ${dm}

4. frequency (code): ${fq}

5. geography:
${geo}

6. who_leads (code): ${wl}

7. what_participation_looks_like:
${part}

8. immediate_outputs:
${imm}

9. intended_change (longer-term outcomes):
${ic}

10. change_level (code): ${cl}

11. currently_measuring:
${measuringDisplay}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2200,
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
      alignment_gaps: [],
      strengths: [],
      suggested_measures: [],
      parse_error: true,
      raw_output: rawOutput,
    };
  }

  const rawGaps = Array.isArray(parsed.alignment_gaps)
    ? parsed.alignment_gaps
    : [];
  const alignment_gaps = rawGaps
    .map(normalizeGap)
    .filter(Boolean);

  const strengths = normalizeStringArray(parsed.strengths);
  const suggested_measures = normalizeStringArray(parsed.suggested_measures);

  const result = {
    alignment_gaps,
    strengths,
    suggested_measures,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "01",
    interactionType: "gap_flag",
    promptSummary: "Program design alignment review",
    outputSummary: `Alignment gaps: ${alignment_gaps.length}. Strengths: ${strengths.length}. Suggested measures: ${suggested_measures.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return result;
}

module.exports = { agent03_programAlignment };
