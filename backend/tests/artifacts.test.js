// Artifact shaping tests: ordered content blocks and CSV rows.
// Pure. No database. Run: npm test

const { test } = require("node:test");
const assert = require("node:assert");

const {
  shapeCollectionInstrument,
  optionLabelForId,
} = require("../lib/artifacts/collectionInstrument");
const {
  shapeResponseCsv,
  UNANSWERED_MARKER,
} = require("../lib/artifacts/responseCsv");
const { normalizeConsentLanguage } = require("../lib/questionLogic");

const opt = (id, label) => ({ id, label });

test("normalizeConsentLanguage turns a bare string into { en }", () => {
  assert.deepStrictEqual(normalizeConsentLanguage("  Hello  "), { en: "Hello" });
});

test("instrument blocks: consent, numbered questions, branch note, answer lines", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Did you attend?", es: "¿Asistió?" },
      type: "multiple_choice",
      required: true,
      options: [
        opt("a-opt-0", { en: "Yes", es: "Sí" }),
        opt("a-opt-1", { en: "No", es: "No" }),
      ],
    },
    {
      id: "b",
      text: { en: "Why not?", es: "¿Por qué no?" },
      type: "long_text",
      required: true,
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    },
    {
      id: "c",
      text: { en: "Age" },
      type: "number",
      required: false,
    },
  ];

  const { blocks, meta } = shapeCollectionInstrument({
    orgName: "Keep Austin Healthy",
    toolName: "Exit survey",
    consentLanguage: { en: "We will use your answers to improve the program." },
    questions,
    language: "en",
  });

  assert.strictEqual(blocks[0].type, "title");
  assert.strictEqual(blocks[0].text, "Keep Austin Healthy");
  assert.ok(blocks.some((b) => b.type === "section" && b.text === "Consent"));
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("improve the program")
    )
  );
  assert.ok(blocks.some((b) => b.type === "question" && b.text.startsWith("1. ")));
  assert.ok(blocks.some((b) => b.type === "question" && b.text.startsWith("2. ")));
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "branch_note" &&
        b.text === 'Only answer this if you selected "No" for question 1.'
    )
  );
  const longAnswer = blocks.filter(
    (b) => b.type === "answer_line" && b.lines === 5
  );
  assert.ok(longAnswer.length >= 1, "long_text needs multiple lines");
  const shortNum = blocks.filter(
    (b) => b.type === "answer_line" && b.width === "short"
  );
  assert.ok(shortNum.length >= 1, "number needs a short line");
  assert.strictEqual(meta.consentMissingForLang, false);
});

test("Spanish instrument warns separately when consent has no es", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Name", es: "Nombre" },
      type: "short_text",
      required: true,
    },
  ];
  const { blocks, meta } = shapeCollectionInstrument({
    orgName: "Org",
    toolName: "Survey",
    consentLanguage: { en: "English consent only." },
    questions,
    language: "es",
  });
  assert.strictEqual(meta.consentMissingForLang, true);
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "note" &&
        /consentimiento no tiene traducción/i.test(b.text)
    )
  );
  assert.ok(blocks.some((b) => b.type === "question" && b.text.includes("Nombre")));
});

test("branch note is omitted when option id cannot be resolved (no id leak)", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Attend?" },
      type: "multiple_choice",
      required: true,
      options: [opt("a-opt-0", { en: "Yes" })],
    },
    {
      id: "b",
      text: { en: "Why?" },
      type: "short_text",
      required: true,
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "missing-id",
      },
    },
  ];
  assert.strictEqual(optionLabelForId(questions[0], "missing-id", "en"), null);
  const { blocks } = shapeCollectionInstrument({
    orgName: "Org",
    toolName: "Survey",
    consentLanguage: { en: "Consent" },
    questions,
    language: "en",
  });
  assert.ok(!blocks.some((b) => b.type === "branch_note"));
  assert.ok(!blocks.some((b) => /missing-id|a-opt/.test(b.text || "")));
});

test("Spanish branch note quoting English label sets fallback flag", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Attend?", es: "¿Asistió?" },
      type: "multiple_choice",
      required: true,
      options: [
        opt("a-opt-0", { en: "Yes" }),
        opt("a-opt-1", { en: "No" }),
      ],
    },
    {
      id: "b",
      text: { en: "Why?", es: "¿Por qué?" },
      type: "short_text",
      required: true,
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    },
  ];
  const { blocks, meta } = shapeCollectionInstrument({
    orgName: "Org",
    toolName: "Survey",
    consentLanguage: { en: "Consent", es: "Consentimiento" },
    questions,
    language: "es",
  });
  assert.strictEqual(meta.anyFallback, true);
  assert.ok(
    blocks.some((b) => b.type === "branch_note" && b.text.includes('"No"'))
  );
  assert.ok(blocks.some((b) => b.type === "note" && /inglés/i.test(b.text)));
});

test("CSV distinguishes hidden empty cells from unanswered marker", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Attend?" },
      type: "multiple_choice",
      required: true,
      options: [
        opt("a-opt-0", { en: "Yes" }),
        opt("a-opt-1", { en: "No" }),
      ],
    },
    {
      id: "b",
      text: { en: "Why not?" },
      type: "short_text",
      required: true,
      display_if: {
        question_id: "a",
        operator: "equals",
        value: "a-opt-1",
      },
    },
  ];
  const shaped = shapeResponseCsv({
    questions,
    responses: [
      {
        submitted_at: "2026-01-01T00:00:00.000Z",
        language: "en",
        response_payload: { a: "a-opt-0" },
      },
      {
        submitted_at: "2026-01-02T00:00:00.000Z",
        language: "en",
        response_payload: { a: "a-opt-1" },
      },
    ],
  });
  assert.deepStrictEqual(shaped.headers, [
    "submitted_at",
    "language",
    "Attend?",
    "Why not?",
  ]);
  // First respondent: B hidden -> empty cell. MC shows label.
  assert.deepStrictEqual(shaped.rows[0], [
    "2026-01-01T00:00:00.000Z",
    "en",
    "Yes",
    "",
  ]);
  // Second: B visible but unanswered -> marker
  assert.deepStrictEqual(shaped.rows[1], [
    "2026-01-02T00:00:00.000Z",
    "en",
    "No",
    UNANSWERED_MARKER,
  ]);
  const rendered = require("../lib/artifacts/responseCsv").renderResponseCsv(
    shaped
  );
  assert.ok(rendered.startsWith("submitted_at,language,"), "header must be line 1");
  assert.ok(!/^NOTE:/m.test(rendered), "no prose preamble in the data file");
});

const {
  shapeGovernanceDocument,
} = require("../lib/artifacts/governanceDocument");

test("governance document: ordered blocks with full details and bilingual consent", () => {
  const { blocks } = shapeGovernanceDocument({
    orgName: "Keep Austin Healthy",
    toolName: "Exit survey",
    generatedAt: "2026-09-02T15:00:00.000Z",
    questions: [
      { id: "a", text: { en: "Did you attend?", es: "¿Asistió?" }, type: "short_text" },
      { id: "b", text: { en: "What changed?" }, type: "long_text" },
    ],
    consentLanguage: {
      en: "We will use your answers to improve the program.",
      es: "Usaremos sus respuestas para mejorar el programa.",
    },
    governanceChecks: {
      consent_reviewed: {
        confirmed: true,
        detail: "Director shortened paragraph three",
      },
      shareback_plan: {
        confirmed: true,
        detail: "June community dinner poster and verbal update",
      },
      data_storage: {
        confirmed: true,
        detail: "Two staff accounts can export",
      },
    },
    launchChecklist: {
      pilot_confirmed: {
        confirmed: true,
        detail: "Tuesday dinner table of three residents",
      },
      staff_trained: {
        confirmed: true,
        detail: "Coordinator ran a 30 minute walkthrough",
      },
      community_informed: {
        confirmed: true,
        detail: "Flyer at the center and meeting announcement",
      },
    },
    removalUrl: "https://example.org/f/tok123/remove",
    communityEngagement: {
      title: "East Austin listening session",
      priorities_named: "Safer streets and evening programming",
    },
  });

  const types = blocks.map((b) => b.type);
  assert.strictEqual(blocks[0].type, "title");
  assert.strictEqual(blocks[0].text, "Keep Austin Healthy");
  assert.ok(blocks.some((b) => b.type === "subtitle"));
  assert.ok(blocks.some((b) => b.type === "body" && b.text.includes("Exit survey")));
  assert.ok(blocks.some((b) => b.type === "body" && b.text.includes("2026-09-02")));

  const sectionTexts = blocks
    .filter((b) => b.type === "section")
    .map((b) => b.text);
  assert.deepStrictEqual(sectionTexts, [
    "What is being collected",
    "Consent language",
    "Governance decisions",
    "Launch readiness",
    "How residents can withdraw",
    "Connection to community input",
  ]);

  assert.ok(
    blocks.some((b) => b.type === "question" && b.text.startsWith("1. Did you attend?"))
  );
  assert.ok(
    blocks.some((b) => b.type === "question" && b.text.startsWith("2. What changed?"))
  );
  assert.ok(!blocks.some((b) => b.type === "answer_line"));

  assert.ok(blocks.some((b) => b.type === "body" && b.text === "English:"));
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("improve the program")
    )
  );
  assert.ok(blocks.some((b) => b.type === "body" && b.text === "Español:"));
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("mejorar el programa")
    )
  );

  assert.ok(
    blocks.some(
      (b) => b.type === "body" && b.text.includes("Director shortened paragraph three")
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("Tuesday dinner table of three residents")
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("https://example.org/f/tok123/remove")
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        /does not expire/i.test(b.text)
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        /may not be enough to find their response/i.test(b.text)
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        b.text.includes("Safer streets and evening programming")
    )
  );
  assert.ok(!types.includes("option"));
  assert.ok(
    !blocks.some((b) => /Rootwork|Intentional Data/i.test(b.text || ""))
  );
});

test("governance document: missing community engagement still has the section", () => {
  const { blocks } = shapeGovernanceDocument({
    orgName: "Keep Austin Healthy",
    toolName: "Exit survey",
    generatedAt: "2026-09-02T15:00:00.000Z",
    questions: [{ id: "a", text: { en: "Hello" }, type: "short_text" }],
    consentLanguage: { en: "Consent text." },
    governanceChecks: {},
    launchChecklist: {},
    removalUrl: "",
    communityEngagement: null,
  });

  assert.ok(
    blocks.some(
      (b) => b.type === "section" && b.text === "Connection to community input"
    )
  );
  assert.ok(
    blocks.some(
      (b) =>
        b.type === "body" &&
        /No Stage 02 community engagement record was found/i.test(b.text)
    )
  );
});
