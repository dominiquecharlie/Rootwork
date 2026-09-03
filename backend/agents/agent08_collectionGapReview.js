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

const TOOL_TYPES = new Set([
  "survey",
  "interview",
  "observation",
  "administrative",
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

function formatEngagement(engagement) {
  if (!engagement) {
    return "(No community engagement documented yet.)";
  }
  return [
    `Session title: ${engagement.title || "(untitled)"}`,
    "",
    "Community members wanted:",
    engagement.community_members_wanted || "(not recorded)",
    "",
    "Priorities named:",
    engagement.priorities_named || "(not recorded)",
  ].join("\n");
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

function formatCollectionTools(tools) {
  if (!tools || tools.length === 0) {
    return "(No collection tools created yet.)";
  }
  return tools
    .map((t, i) => {
      const name = t.tool_name || "(unnamed)";
      const type = t.tool_type || "";
      return `${i + 1}. ${name} (${type})`;
    })
    .join("\n");
}

function normalizeStringArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter(Boolean);
}

function normalizeTool(row) {
  if (!row || typeof row !== "object") return null;
  const tool_name =
    typeof row.tool_name === "string" ? row.tool_name.trim() : "";
  const rationale =
    typeof row.rationale === "string" ? row.rationale.trim() : "";
  let tool_type = (row.tool_type || "").toLowerCase().trim();
  tool_type = tool_type.split("|")[0].trim();
  if (!TOOL_TYPES.has(tool_type)) tool_type = "survey";
  if (!tool_name || !rationale) return null;
  return { tool_name, tool_type, rationale };
}

function normalizeResult(parsed) {
  const funder_requirements = normalizeStringArray(parsed?.funder_requirements);
  const community_priorities = normalizeStringArray(
    parsed?.community_priorities
  );
  const coverage_gaps = normalizeStringArray(parsed?.coverage_gaps);

  const rawT = Array.isArray(parsed?.recommended_tools)
    ? parsed.recommended_tools
    : [];
  const recommended_tools = rawT.map(normalizeTool).filter(Boolean);

  return {
    funder_requirements,
    community_priorities,
    recommended_tools,
    coverage_gaps,
  };
}

async function agent08_collectionGapReview({
  orgId,
  userId,
  funder_metrics,
  engagement,
  program_design,
  collection_tools,
}) {
  const funderBlock = formatFunderMetrics(funder_metrics);
  const communityBlock = formatEngagement(engagement);
  const programBlock = formatProgramDesign(program_design);
  const toolsBlock = formatCollectionTools(collection_tools);

  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Review funder metrics, community priorities, program design, and any collection tools this organization already created. Produce a structured gap review in JSON only.

Return JSON only in this shape:
{
  "funder_requirements": [
    "what the funder needs measured"
  ],
  "community_priorities": [
    "what community said matters"
  ],
  "recommended_tools": [
    {
      "tool_name": "...",
      "tool_type": "survey",
      "rationale": "why this tool fits this org's context"
    }
  ],
  "coverage_gaps": [
    "anything not covered by the recommended tools"
  ]
}

Rules:
- funder_requirements must reflect the supplied funder metrics. Use short declarative lines, no invented funders.
- community_priorities must reflect community_members_wanted and priorities_named only. Never invent quotes.
- recommended_tools: tool_type must be exactly one of: survey, interview, observation, administrative.
- coverage_gaps should name measurement or listening gaps relative to funder_requirements, community_priorities, and program design, including gaps left after your recommended_tools.
- If collection tools already exist, avoid recommending duplicates and explain fit in rationale where relevant.
- Never use em dashes in any string value.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const userPrompt = `Funder metrics:\n\n${funderBlock}\n\n---\n\nCommunity engagement:\n\n${communityBlock}\n\n---\n\nProgram design:\n\n${programBlock}\n\n---\n\nExisting collection tools:\n\n${toolsBlock}`;

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
    parsed = {
      funder_requirements: [],
      community_priorities: [],
      recommended_tools: [],
      coverage_gaps: [],
      parse_error: true,
    };
  }

  const normalized = normalizeResult(parsed);

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "03",
    interactionType: "gap_review",
    promptSummary: "Stage 03 collection gap review",
    outputSummary: `Funder lines: ${normalized.funder_requirements.length}, priorities: ${normalized.community_priorities.length}, tools: ${normalized.recommended_tools.length}, gaps: ${normalized.coverage_gaps.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return {
    ...normalized,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };
}

module.exports = { agent08_collectionGapReview };
