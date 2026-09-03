// Pure predicate tests for Stage 03 community voice, reconciliation, launch,
// and governance gates. Run: npm test (from backend/)

const { test } = require("node:test");
const assert = require("node:assert");

const {
  governanceChecksComplete,
  hasCompleteEngagement,
  incompleteGovernanceItems,
  incompleteLaunchChecklistItems,
  isReconciled,
  launchChecklistComplete,
  normalizeGovernanceChecks,
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

const completeGovernance = {
  consent_reviewed: {
    confirmed: true,
    detail: "Program director shortened the third paragraph",
  },
  shareback_plan: {
    confirmed: true,
    detail: "Poster and verbal update at the June community dinner",
  },
  data_storage: {
    confirmed: true,
    detail: "Stored in Rootwork; only two staff accounts can export",
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

test("launch checklist: malformed inputs fail closed", () => {
  assert.strictEqual(launchChecklistComplete("nope"), false);
  assert.strictEqual(launchChecklistComplete(["a"]), false);
  assert.strictEqual(
    launchChecklistComplete({
      ...completeChecklist,
      pilot_confirmed: true,
    }),
    false
  );
  assert.strictEqual(
    launchChecklistComplete({
      ...completeChecklist,
      pilot_confirmed: { confirmed: true, detail: 12 },
    }),
    false
  );
  assert.strictEqual(
    launchChecklistComplete({
      ...completeChecklist,
      pilot_confirmed: ["confirmed"],
    }),
    false
  );
});

test("governance checks: all three complete -> passes", () => {
  assert.strictEqual(governanceChecksComplete(completeGovernance), true);
  assert.deepStrictEqual(incompleteGovernanceItems(completeGovernance), []);
});

test("governance checks: any one unconfirmed -> fails", () => {
  for (const key of ["consent_reviewed", "shareback_plan", "data_storage"]) {
    const broken = {
      ...completeGovernance,
      [key]: { ...completeGovernance[key], confirmed: false },
    };
    assert.strictEqual(governanceChecksComplete(broken), false);
    assert.ok(incompleteGovernanceItems(broken).includes(key));
  }
});

test("governance checks: confirmed with blank or whitespace detail -> fails", () => {
  for (const detail of ["", "   ", "\t\n"]) {
    const broken = {
      ...completeGovernance,
      shareback_plan: { confirmed: true, detail },
    };
    assert.strictEqual(governanceChecksComplete(broken), false);
    assert.deepStrictEqual(incompleteGovernanceItems(broken), [
      "shareback_plan",
    ]);
  }
});

test("governance checks: missing key -> fails", () => {
  const { data_storage: _drop, ...partial } = completeGovernance;
  assert.strictEqual(governanceChecksComplete(partial), false);
  assert.ok(incompleteGovernanceItems(partial).includes("data_storage"));
});

test("governance checks: legacy bare booleans normalize then fail closed", () => {
  const legacy = {
    consent_reviewed: true,
    shareback_plan: true,
    data_storage: true,
  };
  const normalized = normalizeGovernanceChecks(legacy);
  assert.deepStrictEqual(normalized.consent_reviewed, {
    confirmed: true,
    detail: "",
  });
  assert.strictEqual(governanceChecksComplete(normalized), false);
  assert.deepStrictEqual(incompleteGovernanceItems(normalized), [
    "consent_reviewed",
    "shareback_plan",
    "data_storage",
  ]);
});

test("governance checks: null / empty / malformed fail closed", () => {
  assert.strictEqual(governanceChecksComplete(null), false);
  assert.strictEqual(governanceChecksComplete(undefined), false);
  assert.strictEqual(governanceChecksComplete({}), false);
  assert.strictEqual(governanceChecksComplete("nope"), false);
  assert.strictEqual(governanceChecksComplete(["a"]), false);
  assert.strictEqual(
    governanceChecksComplete({
      ...completeGovernance,
      consent_reviewed: true,
    }),
    false
  );
  assert.strictEqual(
    governanceChecksComplete({
      ...completeGovernance,
      consent_reviewed: { confirmed: true, detail: 99 },
    }),
    false
  );
  assert.strictEqual(
    governanceChecksComplete({
      ...completeGovernance,
      consent_reviewed: ["yes"],
    }),
    false
  );
  assert.deepStrictEqual(incompleteGovernanceItems(null), [
    "consent_reviewed",
    "shareback_plan",
    "data_storage",
  ]);
});
