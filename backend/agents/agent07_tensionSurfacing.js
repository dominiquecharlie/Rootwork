const Anthropic = require("@anthropic-ai/sdk");
const { logClaudeInteraction } = require("../utils/claudeLogger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `
You are a reviewer and synthesizer inside Rootwork, a community-centered data platform.
You are never the decision-maker. Every output you produce is a draft for human review.
You never rewrite, summarize, or paraphrase community voice documentation.
Never use em dashes in any output.
Never use hyphens to contrast two ideas in the format "X - not Y".
Use commas, periods, or restructure the sentence instead.
Write in short declarative sentences.
Do not use corporate jargon.
`;

function formatFunderMetrics(metrics) {
  if (!metrics || metrics.length === 0) {
    return "(No funder metrics on file.)";
  }
  return metrics
    .map((m) => {
      const name = m.metric_name || "";
      const desc = m.metric_description || "";
      const parts = [name, desc].filter(Boolean);
      return `- ${parts.join(": ")}`;
    })
    .join("\n");
}

function formatEngagementAndVoice(engagement, voiceRecords) {
  if (!engagement) {
    return "(No community engagement documented yet.)";
  }
  const lines = [
    `Session title: ${engagement.title || "(untitled)"}`,
    "",
    "Community members wanted:",
    engagement.community_members_wanted || "(not recorded)",
    "",
    "Priorities named:",
    engagement.priorities_named || "(not recorded)",
  ];
  if (voiceRecords && voiceRecords.length > 0) {
    lines.push(
      "",
      "Verbatim community voice records (quote exactly in your reasoning, never paraphrase):"
    );
    voiceRecords.forEach((v, i) => {
      const role = v.speaker_role || "Speaker";
      const text = v.voice_content || "";
      lines.push(`${i + 1}. (${role}): ${text}`);
    });
  }
  return lines.join("\n");
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
    "Full program_model JSON for additional structure (do not contradict the intake fields above when they are set):",
    JSON.stringify(programDesign.program_model || {}, null, 2),
  ];
  return lines.join("\n");
}

function normalizeTension(row) {
  if (!row || typeof row !== "object") return null;
  const area = typeof row.area === "string" ? row.area.trim() : "";
  const observation =
    typeof row.observation === "string" ? row.observation.trim() : "";
  const question =
    typeof row.question === "string" ? row.question.trim() : "";
  if (!area || !observation || !question) return null;
  return { area, observation, question };
}

function normalizeResult(parsed) {
  const raw = Array.isArray(parsed?.tensions) ? parsed.tensions : [];
  const tensions = raw.map(normalizeTension).filter(Boolean);
  return { tensions };
}

async function agent07_tensionSurfacing({
  orgId,
  userId,
  funder_metrics,
  engagement,
  voice_records,
  program_design,
}) {
  const funderBlock = formatFunderMetrics(funder_metrics);
  const communityBlock = formatEngagementAndVoice(engagement, voice_records);
  const programBlock = formatProgramDesign(program_design);

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Compare what the funder requires, what community members said (verbatim records below), and what the organization designed in its program model. Surface genuine tensions where these three sources pull in different directions. Each tension should name the domain, state what you observe without blaming, and end with one grounding question for the organization.

Return JSON only in this shape:
{
  "tensions": [
    {
      "area": "short label",
      "observation": "what is in tension and why",
      "question": "a grounding question for the org"
    }
  ]
}

Rules:
- Return between three and six tensions when the inputs support them. Fewer is fine if overlap is high.
- For community voice, use only the exact wording supplied in the verbatim blocks. Never paraphrase or invent quotes.
- Never use em dashes in any string value.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const userPrompt = `Funder requirements and metrics:\n\n${funderBlock}\n\n---\n\nCommunity engagement and verbatim voice:\n\n${communityBlock}\n\n---\n\nProgram design:\n\n${programBlock}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
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
    parsed = { tensions: [], parse_error: true };
  }

  const normalized = normalizeResult(parsed);

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "02b",
    interactionType: "tension_surfacing",
    promptSummary: "Tension surfacing for program design reconciliation",
    outputSummary: `Tensions drafted: ${normalized.tensions.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return {
    ...normalized,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };
}

module.exports = { agent07_tensionSurfacing };
