// Pure predicate tests for Stage 03 community voice, reconciliation, and launch gates.
// Run: npm test          (from backend/)

const { test } = require("node:test");
const assert = require("node:assert");

const {
  hasCompleteEngagement,
  incompleteLaunchChecklistItems,
  isReconciled,
  launchChecklistComplete,
} = require("../lib/stageGates");

const completeRow = {
  who_was_present: "Residents from East Austin",
  who_was_absent: "Youth under 18",
  why_absent: "Session was scheduled during school hours",
};

const completeChecklist = {
  pilot_confirmed: {
    confirmed: true,
    detail: "Three residents from the Tuesday night dinner",
  },
  staff_trained: {
    confirmed: true,
    detail: "Program coordinator ran a 30 minute walkthrough",
  },
  community_informed: {
    confirmed: true,
    detail: "Posted a flyer at the center and announced it at the meeting",
  },
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

test("launch checklist: all three complete -> passes", () => {
  assert.strictEqual(launchChecklistComplete(completeChecklist), true);
  assert.deepStrictEqual(incompleteLaunchChecklistItems(completeChecklist), []);
});

test("launch checklist: any one unconfirmed -> fails", () => {
  for (const key of [
    "pilot_confirmed",
    "staff_trained",
    "community_informed",
  ]) {
    const broken = {
      ...completeChecklist,
      [key]: { ...completeChecklist[key], confirmed: false },
    };
    assert.strictEqual(launchChecklistComplete(broken), false);
    assert.ok(incompleteLaunchChecklistItems(broken).includes(key));
  }
});

test("launch checklist: confirmed with blank or whitespace detail -> fails", () => {
  for (const detail of ["", "   ", "\t\n"]) {
    const broken = {
      ...completeChecklist,
      pilot_confirmed: { confirmed: true, detail },
    };
    assert.strictEqual(launchChecklistComplete(broken), false);
    assert.deepStrictEqual(incompleteLaunchChecklistItems(broken), [
      "pilot_confirmed",
    ]);
  }
});

test("launch checklist: missing key -> fails", () => {
  const { community_informed: _drop, ...partial } = completeChecklist;
  assert.strictEqual(launchChecklistComplete(partial), false);
  assert.ok(
    incompleteLaunchChecklistItems(partial).includes("community_informed")
  );
});

test("launch checklist: legacy tool with no launch_checklist fails closed", () => {
  assert.strictEqual(launchChecklistComplete(null), false);
  assert.strictEqual(launchChecklistComplete(undefined), false);
  assert.strictEqual(launchChecklistComplete({}), false);
  assert.deepStrictEqual(incompleteLaunchChecklistItems(null), [
    "pilot_confirmed",
    "staff_trained",
    "community_informed",
  ]);
});
