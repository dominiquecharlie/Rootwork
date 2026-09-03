// Client copy of backend/lib/questionLogic.js isQuestionVisible (and helpers).
// The server is authoritative: backend/lib/questionLogic.js validateResponsePayload
// rejects on submit if visibility and answers disagree. Client-side visibility is
// for responsive show/hide only. Same duplication pattern as stage03GateResponse.js.

const DISPLAY_IF_OPS = new Set([
  "equals",
  "not_equals",
  "answered",
  "not_answered",
]);

function isNonEmptyAnswer(answer) {
  if (answer == null) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (typeof answer === "number" && Number.isFinite(answer)) return true;
  if (typeof answer === "boolean") return true;
  if (Array.isArray(answer)) return answer.length > 0;
  return false;
}

/**
 * Cascading: if the referenced question is itself not visible, this question
 * is not visible either.
 */
export function isQuestionVisible(question, answers, questions, memo) {
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

  const answer =
    answers && typeof answers === "object" ? answers[refId] : undefined;
  const answered = isNonEmptyAnswer(answer);
  const value = typeof raw.value === "string" ? raw.value.trim() : "";

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
