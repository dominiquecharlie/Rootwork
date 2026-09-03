// Pure predicate tests for Stage 03 community voice and reconciliation gates.
// Run: npm test          (from backend/)

const { test } = require("node:test");
const assert = require("node:assert");

const {
  hasCompleteEngagement,
  isReconciled,
} = require("../lib/stageGates");

const completeRow = {
  who_was_present: "Residents from East Austin",
  who_was_absent: "Youth under 18",
  why_absent: "Session was scheduled during school hours",
};

test("no engagement rows -> blocked", () => {
  assert.strictEqual(hasCompleteEngagement([]), false);
});

test("a row with all three fields -> passes", () => {
  assert.strictEqual(hasCompleteEngagement([completeRow]), true);
});

test("a row missing why_absent -> blocked", () => {
  assert.strictEqual(
    hasCompleteEngagement([
      {
        who_was_present: "Residents",
        who_was_absent: "Staff",
      },
    ]),
    false
  );
});

test('a row where who_was_absent is "   " -> blocked', () => {
  assert.strictEqual(
    hasCompleteEngagement([
      {
        who_was_present: "Residents",
        who_was_absent: "   ",
        why_absent: "Scheduling conflict",
      },
    ]),
    false
  );
});

test("one incomplete row and one complete row -> passes", () => {
  assert.strictEqual(
    hasCompleteEngagement([
      {
        who_was_present: "Only partial",
        who_was_absent: "",
        why_absent: "",
      },
      completeRow,
    ]),
    true
  );
});

test("null rows -> blocked", () => {
  assert.strictEqual(hasCompleteEngagement(null), false);
});

test("undefined rows -> blocked", () => {
  assert.strictEqual(hasCompleteEngagement(undefined), false);
});

test("reconciliation_completed_at null -> blocked", () => {
  assert.strictEqual(
    isReconciled({ reconciliation_completed_at: null }),
    false
  );
  assert.strictEqual(isReconciled(null), false);
  assert.strictEqual(isReconciled(undefined), false);
});

test("reconciliation_completed_at set -> passes", () => {
  assert.strictEqual(
    isReconciled({
      reconciliation_completed_at: "2026-03-01T12:00:00.000Z",
    }),
    true
  );
});
