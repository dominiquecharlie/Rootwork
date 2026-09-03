// Regression tests for Stage 03 question logic (display_if branching).
// Run: npm test          (from backend/)
// These are pure-function tests. No database, no env, no network.
//
// Every failing case here was a real bug at some point. Do not delete a case
// because it is inconvenient. Add cases when you find new ones.

const { test } = require("node:test");
const assert = require("node:assert");

const {
  normalizeDisplayIf,
  normalizeQuestions,
  validateQuestionLogic,
} = require("../lib/questionLogic");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const mc = (id, text, options) => ({
  id,
  text,
  type: "multiple_choice",
  required: true,
  options,
});

const st = (id, text, extra = {}) => ({
  id,
  text,
  type: "short_text",
  required: true,
  ...extra,
});

const mcNew = (id, textEn, options) => ({
  id,
  text: { en: textEn },
  type: "multiple_choice",
  required: true,
  options,
});

const stNew = (id, textEn, extra = {}) => ({
  id,
  text: { en: textEn },
  type: "short_text",
  required: true,
  ...extra,
});

// Mirrors what POST /save-tool does: normalize, then validate.
function save(questions) {
  const normalized = normalizeQuestions(questions);
  return { normalized, errors: validateQuestionLogic(normalized) };
}

const errorText = (errors) => errors.map((e) => e.error).join(" | ");

// ---------------------------------------------------------------------------
// normalizeDisplayIf: whitelisting
// ---------------------------------------------------------------------------

test("display_if keeps only question_id, operator, value", () => {
  const out = normalizeDisplayIf({
    question_id: "a",
    operator: "equals",
    value: "Yes",
    injected: "<script>",
    __proto__unsafe: true,
    nested: { deep: 1 },
  });
  assert.deepStrictEqual(Object.keys(out).sort(), [
    "operator",
    "question_id",
    "value",
  ]);
});

test("display_if trims question_id, operator and value", () => {
  const out = normalizeDisplayIf({
    question_id: "  a  ",
    operator: "  equals  ",
    value: "  Yes  ",
  });
  assert.deepStrictEqual(out, {
    question_id: "a",
    operator: "equals",
    value: "Yes",
  });
});

// Regression: normalizeDisplayIf used to return {} here, which was then attached
// to the question and rejected on save with "question_id is required" for a
// condition the user never set. Broke the moment the builder UI cleared a rule.
test("unusable display_if becomes null, never an empty object", () => {
  assert.strictEqual(normalizeDisplayIf({}), null);
  assert.strictEqual(normalizeDisplayIf({ operator: "equals" }), null);
  assert.strictEqual(normalizeDisplayIf({ question_id: "   " }), null);
  assert.strictEqual(normalizeDisplayIf("nope"), null);
  assert.strictEqual(normalizeDisplayIf(["a"]), null);
  assert.strictEqual(normalizeDisplayIf(42), null);
  assert.strictEqual(normalizeDisplayIf(null), null);
  assert.strictEqual(normalizeDisplayIf(undefined), null);
});

test("a question with an unusable display_if stores no display_if key", () => {
  const { normalized, errors } = save([st("a", "A"), st("b", "B", { display_if: {} })]);
  assert.strictEqual(errors.length, 0, errorText(errors));
  assert.ok(!("display_if" in normalized[1]));
});

test("a question with a string display_if stores no display_if key", () => {
  const { normalized, errors } = save([
    st("a", "A"),
    st("b", "B", { display_if: "nope" }),
  ]);
  assert.strictEqual(errors.length, 0, errorText(errors));
  assert.ok(!("display_if" in normalized[1]));
});

// ---------------------------------------------------------------------------
// validateQuestionLogic: accepted configurations
// ---------------------------------------------------------------------------

test("questions with no conditions are valid", () => {
  const { errors } = save([st("a", "A"), st("b", "B")]);
  assert.strictEqual(errors.length, 0, errorText(errors));
});

test("equals against an earlier multiple_choice question is valid", () => {
  const { normalized, errors } = save([
    mc("a", "Did you attend?", ["Yes", "No"]),
    st("b", "Why not?", {
      display_if: { question_id: "a", operator: "equals", value: "No" },
    }),
  ]);
  assert.strictEqual(errors.length, 0, errorText(errors));
  assert.strictEqual(normalized[1].display_if.value, "a-opt-1");
});

test("answered works against any earlier question type", () => {
  const { errors } = save([
    st("a", "A"),
    st("b", "B", { display_if: { question_id: "a", operator: "answered" } }),
  ]);
  assert.strictEqual(errors.length, 0, errorText(errors));
});

test("a value with surrounding whitespace still matches its option", () => {
  const { normalized, errors } = save([
    mc("a", "A", ["Yes", "No"]),
    st("b", "B", {
      display_if: { question_id: "a", operator: "equals", value: "  No  " },
    }),
  ]);
  assert.strictEqual(errors.length, 0, errorText(errors));
  assert.strictEqual(normalized[1].display_if.value, "a-opt-1");
});

test("a valid condition survives the save and hydrate round trip", () => {
  const { normalized } = save([
    mc("a", "A", ["Yes", "No"]),
    st("b", "B", {
      display_if: { question_id: "a", operator: "equals", value: "Yes" },
    }),
  ]);
  const again = normalizeQuestions(normalized);
  assert.deepStrictEqual(again[1].display_if, {
    question_id: "a",
    operator: "equals",
    value: "a-opt-0",
  });
});

// ---------------------------------------------------------------------------
// validateQuestionLogic: rejected configurations
// ---------------------------------------------------------------------------

const rejects = [
  [
    "forward reference",
    [st("a", "A", { display_if: { question_id: "b", operator: "answered" } }), st("b", "B")],
  ],
  [
    "self reference",
    [st("a", "A", { display_if: { question_id: "a", operator: "answered" } })],
  ],
  [
    "reference to a question that does not exist",
    [st("b", "B", { display_if: { question_id: "gone", operator: "answered" } })],
  ],
  [
    "duplicate question ids",
    [st("a", "A"), st("a", "B")],
  ],
  [
    "equals against a non multiple_choice question",
    [
      st("a", "A"),
      st("b", "B", { display_if: { question_id: "a", operator: "equals", value: "Yes" } }),
    ],
  ],
  [
    "value that is not one of the options",
    [
      mc("a", "A", ["Yes", "No"]),
      st("b", "B", { display_if: { question_id: "a", operator: "equals", value: "Maybe" } }),
    ],
  ],
  [
    "answered carrying a value",
    [
      st("a", "A"),
      st("b", "B", { display_if: { question_id: "a", operator: "answered", value: "x" } }),
    ],
  ],
  [
    "an operator that is not supported",
    [
      st("a", "A"),
      st("b", "B", { display_if: { question_id: "a", operator: "greater_than" } }),
    ],
  ],
  [
    "equals with no value",
    [
      mc("a", "A", ["Yes", "No"]),
      st("b", "B", { display_if: { question_id: "a", operator: "equals" } }),
    ],
  ],
];

for (const [name, questions] of rejects) {
  test(`rejected: ${name}`, () => {
    const { errors } = save(questions);
    assert.ok(errors.length > 0, "expected at least one error, got none");
    for (const e of errors) {
      assert.ok(e.question_id, "every error must name a question_id");
      assert.ok(e.error && e.error.length > 0, "every error must carry a message");
    }
  });
}

// Cycles cannot exist because a condition may only point backwards. This test
// exists so that if anyone ever relaxes the earlier-reference rule, they are
// forced to add real cycle detection at the same time.
test("a mutual pair is impossible under the earlier-reference rule", () => {
  const { errors } = save([
    st("a", "A", { display_if: { question_id: "b", operator: "answered" } }),
    st("b", "B", { display_if: { question_id: "a", operator: "answered" } }),
  ]);
  assert.ok(errors.length > 0, "a mutual reference must not validate");
});

// ---------------------------------------------------------------------------
// known sharp edge, documented so it is not rediscovered the hard way
// ---------------------------------------------------------------------------

// normalizeQuestions drops any question whose text is blank. If that question
// was the target of a condition, the reference breaks and the error lands on
// the wrong question. POST /save-tool must reject blank text on the raw body
// BEFORE calling normalizeQuestions. This test pins the lib behavior so the
// route guard is the thing that has to hold.
test("blank text questions are dropped by normalize, which breaks references", () => {
  const { normalized, errors } = save([
    mc("a", "", ["Yes", "No"]),
    st("b", "B", {
      display_if: { question_id: "a", operator: "equals", value: "Yes" },
    }),
  ]);
  assert.strictEqual(normalized.length, 1, "the blank question is silently removed");
  assert.ok(errors.length > 0, "the surviving question now has a broken reference");
});

// ---------------------------------------------------------------------------
// multilingual shape: legacy migration, idempotence, validation
// ---------------------------------------------------------------------------

test("legacy string options and label-matched display_if migrate to option ids", () => {
  const { normalized, errors } = save([
    mc("a", "Did you attend?", ["Yes", "No"]),
    st("b", "Why not?", {
      display_if: { question_id: "a", operator: "equals", value: "No" },
    }),
  ]);
  assert.strictEqual(errors.length, 0, errorText(errors));
  assert.deepStrictEqual(normalized[0].text, { en: "Did you attend?" });
  assert.deepStrictEqual(normalized[0].options, [
    { id: "a-opt-0", label: { en: "Yes" } },
    { id: "a-opt-1", label: { en: "No" } },
  ]);
  assert.deepStrictEqual(normalized[1].text, { en: "Why not?" });
  assert.deepStrictEqual(normalized[1].display_if, {
    question_id: "a",
    operator: "equals",
    value: "a-opt-1",
  });
});

test("normalize is idempotent for legacy, new-shape, and mixed input", () => {
  const legacy = [
    mc("a", "Attend?", ["Yes", "No"]),
    st("b", "Why?", {
      display_if: { question_id: "a", operator: "equals", value: "No" },
    }),
  ];
  const newShape = [
    mcNew("a", "Attend?", [
      { id: "a-opt-0", label: { en: "Yes", es: "Sí" } },
      { id: "a-opt-1", label: { en: "No" } },
    ]),
    stNew("b", "Why?", {
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    }),
  ];
  const mixed = [
    mc("a", "Attend?", [
      { id: "custom-yes", label: { en: "Yes" } },
      "No",
    ]),
    stNew("b", "Why?", {
      display_if: { question_id: "a", operator: "equals", value: "No" },
    }),
  ];

  for (const [label, input] of [
    ["legacy", legacy],
    ["new-shape", newShape],
    ["mixed", mixed],
  ]) {
    const once = normalizeQuestions(input);
    const twice = normalizeQuestions(once);
    assert.deepStrictEqual(twice, once, `${label} must be idempotent`);
  }
});

test("duplicate option ids are rejected", () => {
  const { errors } = save([
    mcNew("a", "A", [
      { id: "dup", label: { en: "Yes" } },
      { id: "dup", label: { en: "No" } },
    ]),
  ]);
  assert.ok(errors.length > 0, "expected duplicate option id error");
  assert.ok(
    errors.some((e) => e.question_id === "a" && /Duplicate option id/.test(e.error)),
    errorText(errors)
  );
});

test("option label missing en is rejected", () => {
  const { errors } = save([
    mcNew("a", "A", [{ id: "a-opt-0", label: { es: "Sí" } }]),
  ]);
  assert.ok(errors.length > 0, "expected missing en label error");
  assert.ok(
    errors.some(
      (e) => e.question_id === "a" && /non-empty en label/.test(e.error)
    ),
    errorText(errors)
  );
});

test("question text missing en is rejected", () => {
  const { errors } = save([
    {
      id: "a",
      text: { es: "Hola" },
      type: "short_text",
      required: true,
    },
  ]);
  assert.ok(errors.length > 0, "expected missing en text error");
  assert.ok(
    errors.some(
      (e) => e.question_id === "a" && /non-empty en value/.test(e.error)
    ),
    errorText(errors)
  );
});

test("new-shape display_if.value pointing at a label is rejected", () => {
  const { normalized, errors } = save([
    mcNew("a", "A", [
      { id: "a-opt-0", label: { en: "Yes" } },
      { id: "a-opt-1", label: { en: "No" } },
    ]),
    stNew("b", "B", {
      display_if: { question_id: "a", operator: "equals", value: "Yes" },
    }),
  ]);
  assert.strictEqual(
    normalized[1].display_if.value,
    "Yes",
    "label must not be remapped on new-shape input"
  );
  assert.ok(errors.length > 0, "expected rejection for label-as-value");
  assert.ok(
    errors.some(
      (e) =>
        e.question_id === "b" && /option id on question "a"/.test(e.error)
    ),
    errorText(errors)
  );
});

test("legacy display_if.value matching no option label fails on the dependent question", () => {
  const { normalized, errors } = save([
    mc("a", "A", ["Yes", "No"]),
    st("b", "B", {
      display_if: { question_id: "a", operator: "equals", value: "Maybe" },
    }),
  ]);
  assert.ok(
    normalized[1].display_if,
    "broken condition must not be silently dropped"
  );
  assert.strictEqual(normalized[1].display_if.value, "Maybe");
  assert.ok(errors.length > 0, "expected validation failure");
  assert.ok(
    errors.some((e) => e.question_id === "b"),
    `expected error on question b, got: ${errorText(errors)}`
  );
});
