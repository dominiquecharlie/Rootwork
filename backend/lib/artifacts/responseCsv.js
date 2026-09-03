const { isQuestionVisible } = require("../questionLogic");
const { pickLocalized, safeFilenamePart } = require("./localizedText");

// CSV cell convention (also shown next to the download button in the UI):
// - Empty cell: question was hidden by branching for that respondent.
// - [no answer]: question was visible and left blank.
// Do not treat those the same when computing response rates.
// Do not put explanatory prose in the data file. Header row must be line 1.
const UNANSWERED_MARKER = "[no answer]";

function escapeCsvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function optionLabelEn(question, optionId) {
  const opts = Array.isArray(question?.options) ? question.options : [];
  const opt = opts.find(
    (o) => typeof o?.id === "string" && o.id.trim() === String(optionId || "").trim()
  );
  if (!opt) return String(optionId || "");
  return pickLocalized(opt.label, "en").text || String(optionId || "");
}

function formatAnswerCell(question, rawAnswer) {
  if (rawAnswer == null || rawAnswer === "") return UNANSWERED_MARKER;
  if (typeof rawAnswer === "string" && !rawAnswer.trim()) {
    return UNANSWERED_MARKER;
  }
  if (question?.type === "multiple_choice") {
    return optionLabelEn(question, rawAnswer);
  }
  return String(rawAnswer);
}

/**
 * Pure shaping for tests. headers are English question text.
 * cells use empty string for hidden-by-logic and UNANSWERED_MARKER for blank.
 */
function shapeResponseCsv({ questions, responses }) {
  const list = Array.isArray(questions) ? questions : [];
  const headers = [
    "submitted_at",
    "language",
    ...list.map((q) => {
      const en = pickLocalized(q.text, "en").text;
      return en || q.id;
    }),
  ];

  const rows = [];
  for (const row of Array.isArray(responses) ? responses : []) {
    const answers =
      row?.response_payload && typeof row.response_payload === "object"
        ? row.response_payload
        : {};
    const memo = new Map();
    const cells = [
      typeof row.submitted_at === "string" ? row.submitted_at : "",
      typeof row.language === "string" ? row.language : "",
    ];
    for (const q of list) {
      const visible = isQuestionVisible(q, answers, list, memo);
      if (!visible) {
        cells.push("");
        continue;
      }
      const raw = Object.prototype.hasOwnProperty.call(answers, q.id)
        ? answers[q.id]
        : undefined;
      cells.push(formatAnswerCell(q, raw));
    }
    rows.push(cells);
  }

  return { headers, rows, unansweredMarker: UNANSWERED_MARKER };
}

function renderResponseCsv(shaped) {
  const lines = [shaped.headers.map(escapeCsvCell).join(",")];
  for (const row of shaped.rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function responseCsvFilename(toolName) {
  return `${safeFilenamePart(toolName || "responses")}-responses.csv`;
}

module.exports = {
  UNANSWERED_MARKER,
  formatAnswerCell,
  renderResponseCsv,
  responseCsvFilename,
  shapeResponseCsv,
};
