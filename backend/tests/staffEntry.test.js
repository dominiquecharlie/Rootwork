// Staff entry eligibility and insert shaping.
// Pure. No database. Run: npm test (from backend/)

process.env.REMOVAL_CODE_PEPPER =
  process.env.REMOVAL_CODE_PEPPER || "test-pepper-for-unit-tests-only";

const { test } = require("node:test");
const assert = require("node:assert");

const {
  ENTRY_NOT_FOUND,
  buildStaffEntryInsert,
  defaultHasIndividualSubject,
  isStaffEntryEligible,
  readHasIndividualSubject,
} = require("../lib/staffEntry");
const {
  filterVisibleAnswers,
  isQuestionVisible,
  validateResponsePayload,
} = require("../lib/questionLogic");
const {
  formatRemovalCodeForDisplay,
  generateRemovalCode,
  hashRemovalCode,
} = require("../lib/removalCode");

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

function launchedStaffTool(who) {
  return {
    launched_at: "2026-09-01T00:00:00.000Z",
    configuration: { who_completes: who },
  };
}

test("program_participants only is not staff-entry eligible", () => {
  assert.strictEqual(
    isStaffEntryEligible(launchedStaffTool("program_participants")),
    false
  );
});

test("draft tool is not staff-entry eligible even when who allows staff", () => {
  assert.strictEqual(
    isStaffEntryEligible({
      launched_at: null,
      configuration: { who_completes: "staff_members" },
    }),
    false
  );
  assert.strictEqual(
    isStaffEntryEligible({
      configuration: { who_completes: "both" },
    }),
    false
  );
});

test("launched staff_members / both / other are eligible", () => {
  for (const who of ["staff_members", "both", "other"]) {
    assert.strictEqual(isStaffEntryEligible(launchedStaffTool(who)), true);
  }
});

test("ENTRY_NOT_FOUND shape matches missing-tool response", () => {
  assert.deepStrictEqual(ENTRY_NOT_FOUND, { error: "Entry form not found." });
});

test("defaultHasIndividualSubject suggests interview/survey true, others false", () => {
  assert.strictEqual(defaultHasIndividualSubject("interview"), true);
  assert.strictEqual(defaultHasIndividualSubject("survey"), true);
  assert.strictEqual(defaultHasIndividualSubject("observation"), false);
  assert.strictEqual(defaultHasIndividualSubject("administrative"), false);
});

test("readHasIndividualSubject prefers stored boolean over tool_type default", () => {
  assert.strictEqual(
    readHasIndividualSubject(
      { has_individual_subject: false },
      "interview"
    ),
    false
  );
  assert.strictEqual(
    readHasIndividualSubject({}, "interview"),
    true
  );
});

test("buildStaffEntryInsert stores entry_method staff and entered_by", () => {
  const row = buildStaffEntryInsert({
    orgId: "org-1",
    toolId: "tool-1",
    userId: "user-9",
    language: "en",
    visibleAnswers: { a: "yes" },
    consentAt: "2026-09-02T00:00:00.000Z",
    hasIndividualSubject: false,
  });
  assert.strictEqual(row.entry_method, "staff");
  assert.strictEqual(row.entered_by, "user-9");
  assert.ok(!Object.prototype.hasOwnProperty.call(row, "removal_code_hash"));
});

test("buildStaffEntryInsert requires entered_by", () => {
  assert.throws(
    () =>
      buildStaffEntryInsert({
        orgId: "org-1",
        toolId: "tool-1",
        userId: "",
        language: "en",
        visibleAnswers: {},
        consentAt: "2026-09-02T00:00:00.000Z",
        hasIndividualSubject: false,
      }),
    /entered_by/
  );
});

test("has_individual_subject true generates a removal code hash; false does not", () => {
  const plain = generateRemovalCode();
  const hash = hashRemovalCode(plain);
  const withCode = buildStaffEntryInsert({
    orgId: "org-1",
    toolId: "tool-1",
    userId: "user-9",
    language: "en",
    visibleAnswers: { a: "yes" },
    consentAt: "2026-09-02T00:00:00.000Z",
    hasIndividualSubject: true,
    removalCodeHash: hash,
  });
  assert.strictEqual(withCode.removal_code_hash, hash);
  assert.ok(formatRemovalCodeForDisplay(plain).includes("-"));

  assert.throws(
    () =>
      buildStaffEntryInsert({
        orgId: "org-1",
        toolId: "tool-1",
        userId: "user-9",
        language: "en",
        visibleAnswers: {},
        consentAt: "2026-09-02T00:00:00.000Z",
        hasIndividualSubject: true,
        removalCodeHash: null,
      }),
    /removal code hash/
  );
});

test("staff entry reuses public path visibility and required-when-visible rules", () => {
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
  const answersHidden = { a: "a-opt-0" };
  assert.strictEqual(
    isQuestionVisible(questions[1], answersHidden, questions),
    false
  );
  assert.strictEqual(
    validateResponsePayload(questions, answersHidden).length,
    0
  );
  assert.deepStrictEqual(filterVisibleAnswers(questions, answersHidden), {
    a: "a-opt-0",
  });

  const answersVisible = { a: "a-opt-1" };
  assert.strictEqual(
    isQuestionVisible(questions[1], answersVisible, questions),
    true
  );
  assert.ok(
    validateResponsePayload(questions, answersVisible).some(
      (e) => e.question_id === "b"
    )
  );
});

test("cascading visibility matches public path fixtures", () => {
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
      display_if: {
        question_id: "b",
        operator: "answered",
      },
    }),
  ];
  const empty = {};
  assert.strictEqual(isQuestionVisible(questions[1], empty, questions), false);
  assert.strictEqual(isQuestionVisible(questions[2], empty, questions), false);
});
