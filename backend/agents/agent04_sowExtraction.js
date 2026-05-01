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

const REPORTING_FREQ = new Set(["quarterly", "annual", "monthly", "other"]);
const METRIC_TYPES = new Set([
  "output",
  "outcome",
  "process",
  "demographic",
]);

function normalizeReportingFrequency(value) {
  if (typeof value !== "string") return "other";
  const v = value.trim().toLowerCase();
  if (REPORTING_FREQ.has(v)) return v;
  return "other";
}

function normalizeMetricType(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (METRIC_TYPES.has(v)) return v;
  return null;
}

function normalizeMetric(row) {
  if (!row || typeof row !== "object") return null;
  const name =
    typeof row.metric_name === "string" ? row.metric_name.trim() : "";
  if (!name) return null;
  const descRaw =
    typeof row.metric_description === "string"
      ? row.metric_description.trim()
      : typeof row.metric_definition === "string"
        ? row.metric_definition.trim()
        : "";
  return {
    metric_name: name,
    metric_description: descRaw || null,
    metric_type: normalizeMetricType(row.metric_type),
  };
}

function normalizeResult(parsed) {
  const funder_name =
    typeof parsed?.funder_name === "string" && parsed.funder_name.trim()
      ? parsed.funder_name.trim()
      : null;
  const funder_framework =
    typeof parsed?.funder_framework === "string" &&
    parsed.funder_framework.trim()
      ? parsed.funder_framework.trim()
      : null;
  const reporting_frequency = normalizeReportingFrequency(
    parsed?.reporting_frequency
  );

  const rawMetrics = Array.isArray(parsed?.metrics) ? parsed.metrics : [];
  const metrics = rawMetrics.map(normalizeMetric).filter(Boolean);

  const confidence_notes = Array.isArray(parsed?.confidence_notes)
    ? parsed.confidence_notes
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : [];

  const missing = Array.isArray(parsed?.missing)
    ? parsed.missing
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    funder_name,
    funder_framework,
    reporting_frequency,
    metrics,
    confidence_notes,
    missing,
  };
}

async function agent04_sowExtraction({
  orgId,
  userId,
  documentText,
  mimeType,
  originalFilename,
}) {
  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Read the funder document text and extract every metric, deliverable, and reporting requirement the funder expects the grantee to track, measure, or submit.

Name the funder when the document makes it clear. Identify the overall reporting cadence when stated. Capture the evaluation or compliance framework when named (for example GPRA, WIOA, or a named results framework). Each metric entry should be one obligation the document ties to measurement or reporting.

Return JSON only in this shape:
{
  "funder_name": "string or null if not stated",
  "funder_framework": "string or null if not stated",
  "reporting_frequency": "quarterly | annual | monthly | other",
  "metrics": [
    {
      "metric_name": "short label",
      "metric_description": "what must be measured or reported, grounded in the text",
      "metric_type": "output | outcome | process | demographic"
    }
  ],
  "confidence_notes": ["fields where Claude was uncertain"],
  "missing": ["information not found in the document"]
}

Rules:
- If the document has no reporting metrics, return an empty metrics array.
- Use reporting_frequency value "other" when cadence is unclear or not one of quarterly, annual, or monthly.
- Never use em dashes in any string value.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const safeName = String(originalFilename || "document").slice(0, 200);
  const meta = `Original filename: ${safeName}\nMIME type: ${mimeType}\n\n`;
  const userPrompt = `${meta}Document text:\n\n${documentText}`;

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
    parsed = {
      funder_name: null,
      funder_framework: null,
      reporting_frequency: "other",
      metrics: [],
      confidence_notes: ["Model output was not valid JSON."],
      missing: [],
      parse_error: true,
    };
  }

  const normalized = normalizeResult(parsed);

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "02",
    interactionType: "extraction",
    promptSummary: `SOW extraction: ${safeName}`,
    outputSummary: `Funder: ${normalized.funder_name || "unknown"}. Metrics: ${normalized.metrics.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return {
    ...normalized,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };
}

module.exports = { agent04_sowExtraction };
