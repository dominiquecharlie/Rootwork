// Pure question-logic helpers for Stage 03 collection tools.
// No database, no network, no env. Extracted so they can be unit tested.
// See backend/tests/questionLogic.test.js

const ALLOWED_Q_TYPES = new Set([
  "short_text",
  "long_text",
  "multiple_choice",
  "yes_no",
  "number",
  "date",
]);

const DISPLAY_IF_OPS = new Set([
  "equals",
  "not_equals",
  "answered",
  "not_answered",
]);

function normalizeDisplayIf(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const question_id =
    typeof raw.question_id === "string" ? raw.question_id.trim() : "";
  if (!question_id) {
    return null;
  }
  const display_if = { question_id };
  if (typeof raw.operator === "string") {
    const operator = raw.operator.trim();
    if (operator) display_if.operator = operator;
  }
  if (typeof raw.value === "string") {
    const value = raw.value.trim();
    if (value) display_if.value = value;
  }
  return display_if;
}

// Response submission will evaluate required only when a question is visible.
// A hidden required question must not block submission. Form not built yet.
function validateQuestionLogic(questions) {
  const errors = [];
  if (!Array.isArray(questions)) return errors;

  const seenIds = new Set();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qid =
      typeof q?.id === "string" && q.id.trim() ? q.id.trim() : "";
    if (!qid) {
      errors.push({
        question_id: `index-${i}`,
        error: "Each question must have a non-empty id.",
      });
      continue;
    }
    if (seenIds.has(qid)) {
      errors.push({
        question_id: qid,
        error: `Duplicate question id "${qid}". Each question id must be unique.`,
      });
    } else {
      seenIds.add(qid);
    }
  }

  if (errors.length > 0) return errors;

  const earlierById = new Map();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qid =
      typeof q?.id === "string" && q.id.trim() ? q.id.trim() : `index-${i}`;

    const raw = q?.display_if;
    if (raw == null) {
      earlierById.set(qid, q);
      continue;
    }

    if (typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({
        question_id: qid,
        error: "display_if must be an object.",
      });
      earlierById.set(qid, q);
      continue;
    }

    const refId =
      typeof raw.question_id === "string" ? raw.question_id.trim() : "";
    const operator =
      typeof raw.operator === "string" ? raw.operator.trim() : "";
    const hasValueKey = Object.prototype.hasOwnProperty.call(raw, "value");
    const value =
      typeof raw.value === "string" ? raw.value.trim() : undefined;

    if (!refId) {
      errors.push({
        question_id: qid,
        error: "display_if.question_id is required.",
      });
    } else if (refId === qid) {
      errors.push({
        question_id: qid,
        error: "display_if cannot reference the same question.",
      });
    } else if (!earlierById.has(refId)) {
      errors.push({
        question_id: qid,
        error: `display_if.question_id "${refId}" must reference an earlier question in the list.`,
      });
    }

    if (!DISPLAY_IF_OPS.has(operator)) {
      errors.push({
        question_id: qid,
        error:
          "display_if.operator must be equals, not_equals, answered, or not_answered.",
      });
    } else if (operator === "equals" || operator === "not_equals") {
      if (!value) {
        errors.push({
          question_id: qid,
          error: `display_if.operator "${operator}" requires a non-empty string value.`,
        });
      }
      const target = earlierById.get(refId);
      if (target) {
        if (target.type !== "multiple_choice") {
          errors.push({
            question_id: qid,
            error: `display_if.operator "${operator}" requires the referenced question to be multiple_choice.`,
          });
        } else if (value) {
          const opts = Array.isArray(target.options) ? target.options : [];
          if (!opts.includes(value)) {
            errors.push({
              question_id: qid,
              error: `display_if.value must exactly match an option on question "${refId}".`,
            });
          }
        }
      }
    } else if (operator === "answered" || operator === "not_answered") {
      if (hasValueKey && value) {
        errors.push({
          question_id: qid,
          error: `display_if.operator "${operator}" must not include a value.`,
        });
      }
    }

    earlierById.set(qid, q);
  }

  return errors;
}

function normalizeQuestions(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((q, idx) => {
      const id =
        typeof q.id === "string" && q.id.trim()
          ? q.id.trim()
          : `q-${idx}-${Date.now()}`;
      const text =
        typeof q.text === "string"
          ? q.text
          : typeof q.questionText === "string"
            ? q.questionText
            : "";
      let type = (q.type || q.questionType || "short_text")
        .toLowerCase()
        .trim();
      if (!ALLOWED_Q_TYPES.has(type)) type = "short_text";
      const required = Boolean(q.required);
      const options = Array.isArray(q.options)
        ? q.options
            .map((o) => String(o ?? "").trim())
            .filter(Boolean)
        : [];
      const row = {
        id,
        text: String(text).trim(),
        type,
        required,
      };
      if (type === "multiple_choice") {
        row.options = options;
      }
      const src =
        typeof q.source === "string"
          ? q.source.toLowerCase().trim()
          : "";
      if (src === "ai" || src === "user") {
        row.source = src;
      }
      const rationale =
        typeof q.rationale === "string" ? q.rationale.trim() : "";
      if (rationale) {
        row.rationale = rationale;
      }
      const display_if = normalizeDisplayIf(q.display_if);
      if (display_if != null) {
        row.display_if = display_if;
      }
      return row;
    })
    .filter((q) => q.text.length > 0);
}

module.exports = {
  ALLOWED_Q_TYPES,
  DISPLAY_IF_OPS,
  normalizeDisplayIf,
  normalizeQuestions,
  validateQuestionLogic,
};
