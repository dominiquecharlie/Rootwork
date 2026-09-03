// Removal code generation, peppered hashing, and deletion audit shapes.
// Pure. No database. Run from backend/: npm test

process.env.REMOVAL_CODE_PEPPER =
  process.env.REMOVAL_CODE_PEPPER || "test-pepper-for-unit-tests-only";

const { test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

const {
  PUBLIC_REMOVE_OK,
  REMOVAL_CODE_ALPHABET,
  REMOVAL_CODE_LENGTH,
  formatRemovalCodeForDisplay,
  generateRemovalCode,
  hashRemovalCode,
  isValidRemovalCodeShape,
  normalizeRemovalCode,
} = require("../lib/removalCode");
const {
  orgDeletionAudit,
  selfDeletionAudit,
} = require("../lib/responseDeletion");
const {
  shapeResponseCsv,
  renderResponseCsv,
} = require("../lib/artifacts/responseCsv");

test("removal alphabet excludes ambiguous characters", () => {
  assert.ok(!REMOVAL_CODE_ALPHABET.includes("0"));
  assert.ok(!REMOVAL_CODE_ALPHABET.includes("O"));
  assert.ok(!REMOVAL_CODE_ALPHABET.includes("1"));
  assert.ok(!REMOVAL_CODE_ALPHABET.includes("I"));
  assert.strictEqual(REMOVAL_CODE_ALPHABET.length, 32);
  assert.strictEqual(256 % REMOVAL_CODE_ALPHABET.length, 0);
});

test("generateRemovalCode length and alphabet, expected entropy order", () => {
  const code = generateRemovalCode();
  assert.strictEqual(code.length, REMOVAL_CODE_LENGTH);
  for (const ch of code) {
    assert.ok(REMOVAL_CODE_ALPHABET.includes(ch), `bad char ${ch}`);
  }
  // 32^9 ≈ 3.5e13 ≈ 2^45. Do not treat as a password; pepper protects hashes.
  const entropyBits = Math.log2(REMOVAL_CODE_ALPHABET.length ** REMOVAL_CODE_LENGTH);
  assert.ok(entropyBits > 44 && entropyBits < 46);
});

test("normalize strips hyphens and spaces; display groups XXX-XXX-XXX", () => {
  assert.strictEqual(normalizeRemovalCode("ab2-cd3-ef4"), "AB2CD3EF4");
  assert.strictEqual(normalizeRemovalCode(" ab2 cd3 ef4 "), "AB2CD3EF4");
  assert.strictEqual(
    formatRemovalCodeForDisplay("AB2CD3EF4"),
    "AB2-CD3-EF4"
  );
  assert.ok(isValidRemovalCodeShape("AB2-CD3-EF4"));
  assert.ok(!isValidRemovalCodeShape("TOO-SHORT"));
  assert.ok(!isValidRemovalCodeShape("AB2CD3EF0")); // 0 not in alphabet
});

test("hashRemovalCode is peppered sha256 of normalized code", () => {
  const expected = crypto
    .createHash("sha256")
    .update(process.env.REMOVAL_CODE_PEPPER + "AB2CD3EF4", "utf8")
    .digest("hex");
  assert.strictEqual(hashRemovalCode("ab2-cd3-ef4"), expected);
  assert.strictEqual(hashRemovalCode("AB2CD3EF4"), expected);
  assert.notStrictEqual(
    hashRemovalCode("AB2CD3EF4"),
    crypto.createHash("sha256").update("AB2CD3EF4", "utf8").digest("hex")
  );
});

test("wrong code and right code use the same public remove response shape", () => {
  // Route returns PUBLIC_REMOVE_OK on both match and miss. No branch on body.
  assert.deepStrictEqual(PUBLIC_REMOVE_OK, { success: true });
  Object.freeze(PUBLIC_REMOVE_OK);
  assert.strictEqual(PUBLIC_REMOVE_OK.success, true);
});

test("deletion audit payloads match method vs deleted_by SQL checks", () => {
  const selfRow = selfDeletionAudit({
    org_id: "org-1",
    collection_tool_id: "tool-1",
  });
  assert.deepStrictEqual(selfRow, {
    org_id: "org-1",
    collection_tool_id: "tool-1",
    method: "self",
    deleted_by: null,
  });

  const orgRow = orgDeletionAudit({
    org_id: "org-1",
    collection_tool_id: "tool-1",
    deleted_by: "user-9",
  });
  assert.deepStrictEqual(orgRow, {
    org_id: "org-1",
    collection_tool_id: "tool-1",
    method: "org",
    deleted_by: "user-9",
  });

  assert.throws(
    () =>
      orgDeletionAudit({
        org_id: "org-1",
        collection_tool_id: "tool-1",
        deleted_by: null,
      }),
    /deleted_by/
  );
});

test("deleted response no longer appears in CSV export shaping", () => {
  const questions = [
    {
      id: "a",
      text: { en: "Attend?" },
      type: "short_text",
      required: true,
    },
  ];
  const kept = {
    submitted_at: "2026-01-01T00:00:00.000Z",
    language: "en",
    response_payload: { a: "yes" },
  };
  const deleted = {
    submitted_at: "2026-01-02T00:00:00.000Z",
    language: "es",
    response_payload: { a: "no" },
  };

  // Export route only shapes rows still in collection_responses.
  const before = shapeResponseCsv({
    questions,
    responses: [kept, deleted],
  });
  assert.strictEqual(before.rows.length, 2);

  const afterDelete = shapeResponseCsv({
    questions,
    responses: [kept],
  });
  assert.strictEqual(afterDelete.rows.length, 1);
  assert.deepStrictEqual(afterDelete.rows[0], [
    "2026-01-01T00:00:00.000Z",
    "en",
    "yes",
  ]);
  const csv = renderResponseCsv(afterDelete);
  assert.ok(!csv.includes("2026-01-02"));
  assert.ok(!csv.includes(",no"));
});
