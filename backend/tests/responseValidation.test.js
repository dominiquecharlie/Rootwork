// Tests for public response visibility and payload validation.
// Run: npm test          (from backend/)
// Pure functions only. No database, no env, no network.

const { test } = require("node:test");
const assert = require("node:assert");

const {
  filterVisibleAnswers,
  isQuestionVisible,
  validateResponsePayload,
} = require("../lib/questionLogic");
const { publicLanguages } = require("../lib/publicFormLanguages");

const mc = (id, textEn, options, extra = {}) => ({
  id,
  text: { en: textEn },
  type: "multiple_choice",
  required: true,
  options,
  ...extra,
});

const st = (id, textEn, extra = {}) => ({
  id,
  text: { en: textEn },
  type: "short_text",
  required: true,
  ...extra,
});

const opt = (id, en) => ({ id, label: { en } });

test("required question hidden by a condition does not block submission", () => {
  const questions = [
    mc("a", "Attend?", [opt("a-opt-0", "Yes"), opt("a-opt-1", "No")]),
    st("b", "Why not?", {
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    }),
  ];
  const answers = { a: "a-opt-0" };
  assert.strictEqual(isQuestionVisible(questions[1], answers, questions), false);
  const errors = validateResponsePayload(questions, answers);
  assert.strictEqual(errors.length, 0, errors.map((e) => e.error).join(" | "));
});

test("required question that is visible and unanswered does block", () => {
  const questions = [
    mc("a", "Attend?", [opt("a-opt-0", "Yes"), opt("a-opt-1", "No")]),
    st("b", "Why not?", {
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    }),
  ];
  const answers = { a: "a-opt-1" };
  assert.strictEqual(isQuestionVisible(questions[1], answers, questions), true);
  const errors = validateResponsePayload(questions, answers);
  assert.ok(errors.some((e) => e.question_id === "b"));
});

test("cascading: B depends on A, C depends on B; A unanswered hides B and C", () => {
  const questions = [
    mc("a", "A?", [opt("a-opt-0", "Yes"), opt("a-opt-1", "No")], {
      required: false,
    }),
    st("b", "B?", {
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-0",
      },
    }),
    st("c", "C?", {
      display_if: { question_id: "b", operator: "answered" },
    }),
  ];
  const answers = {};
  assert.strictEqual(isQuestionVisible(questions[0], answers, questions), true);
  assert.strictEqual(isQuestionVisible(questions[1], answers, questions), false);
  assert.strictEqual(isQuestionVisible(questions[2], answers, questions), false);
  const errors = validateResponsePayload(questions, answers);
  assert.strictEqual(
    errors.length,
    0,
    "hidden required B and C must not block: " + errors.map((e) => e.error).join(" | ")
  );
});

test("an answer to a hidden question is dropped", () => {
  const questions = [
    mc("a", "Attend?", [opt("a-opt-0", "Yes"), opt("a-opt-1", "No")]),
    st("b", "Why not?", {
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    }),
  ];
  const answers = { a: "a-opt-0", b: "should not store" };
  const errors = validateResponsePayload(questions, answers);
  assert.strictEqual(errors.length, 0, errors.map((e) => e.error).join(" | "));
  const stored = filterVisibleAnswers(questions, answers);
  assert.deepStrictEqual(stored, { a: "a-opt-0" });
  assert.ok(!Object.prototype.hasOwnProperty.call(stored, "b"));
});

test("an unknown question id is rejected", () => {
  const questions = [st("a", "Name?")];
  const errors = validateResponsePayload(questions, {
    a: "Ada",
    ghost: "nope",
  });
  assert.ok(errors.some((e) => e.question_id === "ghost"));
});

test("a multiple_choice answer that is a label rather than an option id is rejected", () => {
  const questions = [
    mc("a", "Attend?", [opt("a-opt-0", "Yes"), opt("a-opt-1", "No")]),
  ];
  const errors = validateResponsePayload(questions, { a: "Yes" });
  assert.ok(errors.some((e) => e.question_id === "a"));
  assert.ok(
    errors.some((e) => /option id/i.test(e.error)),
    errors.map((e) => e.error).join(" | ")
  );
});

test("not_answered behaves as the inverse of answered", () => {
  const questions = [
    st("a", "Anything?", { required: false }),
    st("b", "Shown when answered", {
      required: false,
      display_if: { question_id: "a", operator: "answered" },
    }),
    st("c", "Shown when not answered", {
      required: false,
      display_if: { question_id: "a", operator: "not_answered" },
    }),
  ];

  const empty = {};
  assert.strictEqual(isQuestionVisible(questions[1], empty, questions), false);
  assert.strictEqual(isQuestionVisible(questions[2], empty, questions), true);

  const filled = { a: "hello" };
  assert.strictEqual(isQuestionVisible(questions[1], filled, questions), true);
  assert.strictEqual(isQuestionVisible(questions[2], filled, questions), false);
});

test("empty languages_served still offers every language present on the tool", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Hello", es: "Hola" },
      type: "short_text",
      required: true,
    },
  ];
  const offered = publicLanguages({ languages_served: [] }, questions);
  assert.deepStrictEqual(offered.sort(), ["en", "es"]);
});
