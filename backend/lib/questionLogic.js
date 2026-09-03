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

// Deterministic option id from question id and position in the input options array.
function derivedOptionId(questionId, optIdx) {
  return `${questionId}-opt-${optIdx}`;
}

// Open-ended language keys. Never assume only en/es.
function normalizeLocalizedMap(raw, stringFallback) {
  if (typeof raw === "string") {
    const en = raw.trim();
    return en ? { en } : null;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out = {};
    for (const [lang, val] of Object.entries(raw)) {
      if (typeof lang !== "string") continue;
      const key = lang.trim();
      if (!key || typeof val !== "string") continue;
      const trimmed = val.trim();
      if (trimmed) out[key] = trimmed;
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  if (typeof stringFallback === "string" && stringFallback.trim()) {
    return { en: stringFallback.trim() };
  }
  return null;
}

function hasNonEmptyEn(localizedOrString) {
  if (typeof localizedOrString === "string") {
    return localizedOrString.trim().length > 0;
  }
  if (
    localizedOrString &&
    typeof localizedOrString === "object" &&
    !Array.isArray(localizedOrString)
  ) {
    return (
      typeof localizedOrString.en === "string" &&
      localizedOrString.en.trim().length > 0
    );
  }
  return false;
}

// Blank when text is neither a non-empty string nor an object with non-empty en.
function isBlankQuestionText(rawQ) {
  if (!rawQ || typeof rawQ !== "object") return true;
  if (hasNonEmptyEn(rawQ.text)) return false;
  if (typeof rawQ.questionText === "string" && rawQ.questionText.trim()) {
    return false;
  }
  return true;
}

// consent_language: bare string -> { en }, or open-ended localized map.
// Same shape as question text / option labels.
function normalizeConsentLanguage(raw) {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{")) {
      try {
        return normalizeLocalizedMap(JSON.parse(trimmed));
      } catch {
        return { en: trimmed };
      }
    }
    return { en: trimmed };
  }
  return normalizeLocalizedMap(raw);
}

function serializeConsentLanguage(map) {
  if (!map || typeof map !== "object") return null;
  return JSON.stringify(map);
}

function parseStoredConsentLanguage(raw) {
  return normalizeConsentLanguage(raw);
}

// An option is usable when it carries a non-empty English label (string or label.en).
function isUsableOption(o) {
  if (typeof o === "string") return o.trim().length > 0;
  if (o && typeof o === "object" && !Array.isArray(o)) {
    if (typeof o.label === "string") return o.label.trim().length > 0;
    if (o.label && typeof o.label === "object" && !Array.isArray(o.label)) {
      return typeof o.label.en === "string" && o.label.en.trim().length > 0;
    }
    return false;
  }
  return false;
}

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

// Legacy display_if.value held English option labels. Remap label.en -> option
// id only when the referenced question still had bare string options in this
// pass. New-shape input that points at a label is left alone so validation
// rejects it. Match label.en only so a coincidental Spanish string cannot
// resolve to the wrong option.
function resolveDisplayIfValue(value, referencedQuestion, allowLabelRemap) {
  if (
    !value ||
    !referencedQuestion ||
    referencedQuestion.type !== "multiple_choice"
  ) {
    return value;
  }
  const opts = Array.isArray(referencedQuestion.options)
    ? referencedQuestion.options
    : [];

  if (opts.some((o) => o && o.id === value)) return value;

  if (!allowLabelRemap) return value;

  for (const o of opts) {
    if (!o || !o.label || typeof o.label !== "object") continue;
    if (typeof o.label.en === "string" && o.label.en === value) {
      return o.id;
    }
  }
  return value;
}

function normalizeOptions(rawOptions, questionId) {
  if (!Array.isArray(rawOptions)) return [];
  const out = [];
  for (let optIdx = 0; optIdx < rawOptions.length; optIdx++) {
    const o = rawOptions[optIdx];

    if (typeof o === "string") {
      const label = normalizeLocalizedMap(o);
      out.push({
        id: derivedOptionId(questionId, optIdx),
        label: label || {},
      });
      continue;
    }

    if (!o || typeof o !== "object" || Array.isArray(o)) {
      out.push({
        id: derivedOptionId(questionId, optIdx),
        label: {},
      });
      continue;
    }

    const label = normalizeLocalizedMap(o.label) || {};
    const id =
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : derivedOptionId(questionId, optIdx);

    out.push({ id, label });
  }
  return out;
}

// Required is evaluated only when a question is visible. A hidden required
// question must not block submission. See isQuestionVisible and
// validateResponsePayload.
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

    if (!hasNonEmptyEn(q?.text)) {
      errors.push({
        question_id: qid,
        error: "Question text must include a non-empty en value.",
      });
    }

    if (q?.type === "multiple_choice") {
      const opts = Array.isArray(q.options) ? q.options : [];
      const seenOptIds = new Set();
      for (let oi = 0; oi < opts.length; oi++) {
        const opt = opts[oi] || {};
        const oid =
          typeof opt.id === "string" && opt.id.trim() ? opt.id.trim() : "";
        if (!oid) {
          errors.push({
            question_id: qid,
            error: `Option at position ${oi} must have a non-empty id.`,
          });
        } else if (seenOptIds.has(oid)) {
          errors.push({
            question_id: qid,
            error: `Duplicate option id "${oid}". Each option id must be unique within a question.`,
          });
        } else {
          seenOptIds.add(oid);
        }
        if (!hasNonEmptyEn(opt.label)) {
          errors.push({
            question_id: qid,
            error: `Option at position ${oi} must include a non-empty en label.`,
          });
        }
      }
    }

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
          const ids = opts
            .map((o) => (typeof o?.id === "string" ? o.id : ""))
            .filter(Boolean);
          if (!ids.includes(value)) {
            errors.push({
              question_id: qid,
              error: `display_if.value must exactly match an option id on question "${refId}".`,
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

function optionsWereLegacyStrings(rawOptions) {
  return (
    Array.isArray(rawOptions) && rawOptions.some((o) => typeof o === "string")
  );
}

function normalizeQuestions(input) {
  if (!Array.isArray(input)) return [];
  const normalized = [];
  const legacyOptionsById = new Map();

  for (let idx = 0; idx < input.length; idx++) {
    const q = input[idx] || {};
    // Fallback q-${idx} can collide with a real question whose id is literally
    // "q-2". validateQuestionLogic reports it as a duplicate id. Acceptable.
    const id =
      typeof q.id === "string" && q.id.trim() ? q.id.trim() : `q-${idx}`;

    const text = normalizeLocalizedMap(
      q.text,
      typeof q.questionText === "string" ? q.questionText : undefined
    );
    if (!text) continue;

    let type = (q.type || q.questionType || "short_text").toLowerCase().trim();
    if (!ALLOWED_Q_TYPES.has(type)) type = "short_text";

    const row = {
      id,
      text,
      type,
      required: Boolean(q.required),
    };

    const legacyOpts = optionsWereLegacyStrings(q.options);
    if (type === "multiple_choice") {
      row.options = normalizeOptions(q.options, id);
    }

    const src =
      typeof q.source === "string" ? q.source.toLowerCase().trim() : "";
    if (src === "ai" || src === "user") {
      row.source = src;
    }
    const rationale =
      typeof q.rationale === "string" ? q.rationale.trim() : "";
    if (rationale) {
      row.rationale = rationale;
    }

    let display_if = normalizeDisplayIf(q.display_if);
    if (display_if) {
      const earlier = normalized.find((x) => x.id === display_if.question_id);
      if (display_if.value && earlier) {
        display_if = {
          ...display_if,
          value: resolveDisplayIfValue(
            display_if.value,
            earlier,
            Boolean(legacyOptionsById.get(display_if.question_id))
          ),
        };
      }
      row.display_if = display_if;
    }

    legacyOptionsById.set(id, legacyOpts);
    normalized.push(row);
  }

  return normalized;
}

function isNonEmptyAnswer(answer) {
  if (answer == null) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (typeof answer === "number" && Number.isFinite(answer)) return true;
  if (typeof answer === "boolean") return true;
  if (Array.isArray(answer)) return answer.length > 0;
  return false;
}

// Shared by the public form client and the submit validator. Cascading: if the
// referenced question is itself not visible, this question is not visible.
function isQuestionVisible(question, answers, questions, memo) {
  if (!question || typeof question !== "object") return false;
  const qid =
    typeof question.id === "string" && question.id.trim()
      ? question.id.trim()
      : "";
  if (!qid) return false;

  const cache = memo instanceof Map ? memo : new Map();
  if (cache.has(qid)) return cache.get(qid);

  const raw = question.display_if;
  if (raw == null) {
    cache.set(qid, true);
    return true;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    cache.set(qid, false);
    return false;
  }

  const refId =
    typeof raw.question_id === "string" ? raw.question_id.trim() : "";
  const operator =
    typeof raw.operator === "string" ? raw.operator.trim() : "";
  if (!refId || !DISPLAY_IF_OPS.has(operator)) {
    cache.set(qid, false);
    return false;
  }

  const list = Array.isArray(questions) ? questions : [];
  const ref = list.find(
    (q) => typeof q?.id === "string" && q.id.trim() === refId
  );
  if (!ref) {
    cache.set(qid, false);
    return false;
  }

  if (!isQuestionVisible(ref, answers, list, cache)) {
    cache.set(qid, false);
    return false;
  }

  const answer = answers && typeof answers === "object" ? answers[refId] : undefined;
  const answered = isNonEmptyAnswer(answer);
  const value =
    typeof raw.value === "string" ? raw.value.trim() : "";

  let visible = false;
  if (operator === "equals") {
    visible =
      answered && typeof answer === "string" && answer.trim() === value;
  } else if (operator === "not_equals") {
    visible =
      answered && typeof answer === "string" && answer.trim() !== value;
  } else if (operator === "answered") {
    visible = answered;
  } else if (operator === "not_answered") {
    visible = !answered;
  }

  cache.set(qid, visible);
  return visible;
}

function validateResponsePayload(questions, answers) {
  const errors = [];
  const list = Array.isArray(questions) ? questions : [];
  const ans =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? answers
      : {};

  const knownIds = new Set(
    list
      .map((q) => (typeof q?.id === "string" ? q.id.trim() : ""))
      .filter(Boolean)
  );

  for (const key of Object.keys(ans)) {
    if (!knownIds.has(key)) {
      errors.push({
        question_id: key,
        error: `Unknown question id "${key}".`,
      });
    }
  }

  const memo = new Map();

  for (const q of list) {
    const qid = typeof q?.id === "string" ? q.id.trim() : "";
    if (!qid) continue;

    const visible = isQuestionVisible(q, ans, list, memo);
    if (!visible) continue;

    const rawAnswer = Object.prototype.hasOwnProperty.call(ans, qid)
      ? ans[qid]
      : undefined;
    const answered = isNonEmptyAnswer(rawAnswer);

    if (q.required && !answered) {
      errors.push({
        question_id: qid,
        error: "This question is required.",
      });
      continue;
    }

    if (!answered) continue;

    if (q.type === "multiple_choice") {
      const value =
        typeof rawAnswer === "string" ? rawAnswer.trim() : "";
      const opts = Array.isArray(q.options) ? q.options : [];
      const ids = opts
        .map((o) => (typeof o?.id === "string" ? o.id.trim() : ""))
        .filter(Boolean);
      if (!value || !ids.includes(value)) {
        errors.push({
          question_id: qid,
          error: "Answer must be an option id on this question.",
        });
      }
    }
  }

  return errors;
}

function filterVisibleAnswers(questions, answers) {
  const list = Array.isArray(questions) ? questions : [];
  const ans =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? answers
      : {};
  const memo = new Map();
  const out = {};
  for (const q of list) {
    const qid = typeof q?.id === "string" ? q.id.trim() : "";
    if (!qid) continue;
    if (!Object.prototype.hasOwnProperty.call(ans, qid)) continue;
    if (!isQuestionVisible(q, ans, list, memo)) continue;
    out[qid] = ans[qid];
  }
  return out;
}

module.exports = {
  ALLOWED_Q_TYPES,
  DISPLAY_IF_OPS,
  derivedOptionId,
  filterVisibleAnswers,
  hasNonEmptyEn,
  isBlankQuestionText,
  isNonEmptyAnswer,
  isQuestionVisible,
  isUsableOption,
  normalizeConsentLanguage,
  normalizeDisplayIf,
  normalizeLocalizedMap,
  normalizeQuestions,
  parseStoredConsentLanguage,
  resolveDisplayIfValue,
  serializeConsentLanguage,
  validateQuestionLogic,
  validateResponsePayload,
};
