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

function normalizeTemplate(row) {
  if (!row || typeof row !== "object") return null;
  const type =
    typeof row.template_type === "string" ? row.template_type.trim() : "";
  const name =
    typeof row.template_name === "string" ? row.template_name.trim() : "";
  const body =
    typeof row.prompt_text === "string" ? row.prompt_text.trim() : "";
  if (!type || !body) return null;
  return {
    template_type: type,
    template_name: name || type,
    prompt_text: body,
  };
}

function normalizeResult(parsed) {
  const raw = Array.isArray(parsed?.templates) ? parsed.templates : [];
  const templates = raw.map(normalizeTemplate).filter(Boolean);
  return { templates };
}

async function agent05_engagementTemplates({
  orgId,
  userId,
  programContextText,
  funderMetricsText,
}) {
  const systemPrompt = `
${BASE_SYSTEM_PROMPT}

Your specific task: Recommend concrete community engagement formats so staff can listen before building data tools. Use the program context and funder metrics provided. Produce ready-to-adapt outlines, not final legal or IRB language.

Return JSON only in this shape:
{
  "templates": [
    {
      "template_type": "One of: Community Survey, Listening Session Guide, One-on-One Interview Protocol, Focus Group Guide, or another clear format label",
      "template_name": "Short internal title for this draft",
      "prompt_text": "Full draft text with numbered sections where helpful. Use plain text line breaks."
    }
  ]
}

Rules:
- Return three to five templates when possible. At least one survey-style and one conversation-style format when the context supports both.
- Ground every recommendation in the supplied context. If context is thin, say what is missing and still offer cautious generic outlines.
- Never use em dashes in any string value.
- Return valid JSON only. No markdown fences around the JSON.
`;

  const userPrompt = `Program context:\n\n${programContextText}\n\nFunder metrics and reporting expectations:\n\n${funderMetricsText}`;

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
      templates: [],
      parse_error: true,
    };
  }

  const normalized = normalizeResult(parsed);

  await logClaudeInteraction({
    orgId,
    userId,
    stage: "02",
    interactionType: "engagement_templates",
    promptSummary: "Engagement templates generation",
    outputSummary: `Templates drafted: ${normalized.templates.length}.`,
    tokensUsed:
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0),
  });

  return {
    ...normalized,
    ...(parsed.parse_error ? { parse_error: true } : {}),
  };
}

module.exports = { agent05_engagementTemplates };
