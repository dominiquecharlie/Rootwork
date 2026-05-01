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

const EXTRACTED_FIELD_KEYS = [
  "resources_needed",
  "program_model",
  "delivery_method",
  "frequency",
  "geography",
  "who_leads",
  "what_participation_looks_like",
  "immediate_outputs",
  "intended_change",
  "change_level",
  "currently_measuring",
];

function normalizeExtractedField(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length ? t : null;
  }
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeExtractionResult(parsed) {
  const raw = parsed && typeof parsed.extracted === "object" ? parsed.extracted : {};
  const extracted = {};
  for (const key of EXTRACTED_FIELD_KEYS) {
    extracted[key] = normalizeExtractedField(raw[key]);
  }

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

  return { extracted, confidence_notes, missing };
}

async function agent04_documentExtraction({
  orgId,
  userId,
  documentText,
  mimeType,
  originalFilename,
}) {
  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Read the uploaded program document text and extract structured fields for a later program design form. Quote or paraphrase only what the document supports. If something is not stated, use null for that field.

Extract where possible:
1. Resources and inputs mentioned (staffing, funding, partnerships, space)
2. Program activities described
3. Delivery method and frequency if mentioned (plain language or short codes if the document uses them)
4. Geography or location if mentioned
5. Who leads the program
6. What participation looks like
7. Immediate outputs or short-term results expected
8. Longer-term outcomes or goals stated
9. Change level (individual, community, systems) if indicated
10. Any existing measurement or data collection described

Return JSON only in this shape:
{
  "extracted": {
    "resources_needed": null or string,
    "program_model": null or string,
    "delivery_method": null or string,
    "frequency": null or string,
    "geography": null or string,
    "who_leads": null or string,
    "what_participation_looks_like": null or string,
    "immediate_outputs": null or string,
    "intended_change": null or string,
    "change_level": null or string,
    "currently_measuring": null or string
  },
  "confidence_notes": ["fields where you were uncertain or inferring beyond the text"],
  "missing": ["field labels not mentioned in the document at all"]
}

Rules:
- Use null for any field not found in the document.
- Never use em dashes in any string value.
- Never use hyphens to contrast two ideas in the format "X - not Y".
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
      extracted: EXTRACTED_FIELD_KEYS.reduce((acc, k) => {
        acc[k] = null;
        return acc;
      }, {}),
      confidence_notes: ["Model output was not valid JSON."],
      missing: EXTRACTED_FIELD_KEYS.map((k) => k),
      parse_error: true,
      raw_output: rawOutput,
    };
  }

  const normalized = normalizeExtractionResult(parsed);

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "01",
    interactionType: "extraction",
    promptSummary: `Document extraction: ${safeName}`,
    outputSummary: `Fields with values: ${EXTRACTED_FIELD_KEYS.filter((k) => normalized.extracted[k]).length}. Missing entries: ${normalized.missing.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return {
    ...normalized,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };
}

module.exports = { agent04_documentExtraction };
