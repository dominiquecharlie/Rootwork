function isNonemptyTrimmedString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function rowHasCompleteEngagement(row) {
  if (!row || typeof row !== "object") return false;
  return (
    isNonemptyTrimmedString(row.who_was_present) &&
    isNonemptyTrimmedString(row.who_was_absent) &&
    isNonemptyTrimmedString(row.why_absent)
  );
}

function hasCompleteEngagement(rows) {
  if (rows == null || !Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  return rows.some(rowHasCompleteEngagement);
}

function isReconciled(row) {
  if (row == null || typeof row !== "object") return false;
  return row.reconciliation_completed_at != null;
}

// Confirmation plus required detail. Shared by launch checklist and governance.
function checklistItemComplete(item) {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }
  return Boolean(item.confirmed) && isNonemptyTrimmedString(item.detail);
}

function normalizeChecklistItem(raw) {
  // Legacy bare boolean: true -> { confirmed: true, detail: "" }.
  if (typeof raw === "boolean") {
    return { confirmed: raw, detail: "" };
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { confirmed: false, detail: "" };
  }
  return {
    confirmed: Boolean(raw.confirmed),
    detail: typeof raw.detail === "string" ? raw.detail : "",
  };
}

function normalizeChecklistMap(raw, keys) {
  const src =
    raw != null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const key of keys) {
    out[key] = normalizeChecklistItem(src[key]);
  }
  return out;
}

function checklistComplete(map, keys) {
  if (map == null || typeof map !== "object" || Array.isArray(map)) {
    return false;
  }
  for (const key of keys) {
    if (!checklistItemComplete(map[key])) {
      return false;
    }
  }
  return true;
}

function incompleteChecklistItems(map, keys) {
  const src =
    map != null && typeof map === "object" && !Array.isArray(map) ? map : {};
  return keys.filter((key) => !checklistItemComplete(src[key]));
}

// Stage 03 launch checklist (Capability Map).
// Stored on collection_tools.configuration.launch_checklist.
const LAUNCH_CHECKLIST_KEYS = [
  "pilot_confirmed",
  "staff_trained",
  "community_informed",
];

function launchChecklistItemComplete(item) {
  return checklistItemComplete(item);
}

function launchChecklistComplete(checklist) {
  return checklistComplete(checklist, LAUNCH_CHECKLIST_KEYS);
}

function incompleteLaunchChecklistItems(checklist) {
  return incompleteChecklistItems(checklist, LAUNCH_CHECKLIST_KEYS);
}

function normalizeLaunchChecklist(raw) {
  return normalizeChecklistMap(raw, LAUNCH_CHECKLIST_KEYS);
}

// Governance checks: same confirmed + detail shape as launch checklist.
// Stored on collection_tools.configuration.governance_checks.
const GOVERNANCE_CHECK_KEYS = [
  "consent_reviewed",
  "shareback_plan",
  "data_storage",
];

function governanceChecksComplete(checks) {
  return checklistComplete(checks, GOVERNANCE_CHECK_KEYS);
}

function incompleteGovernanceItems(checks) {
  return incompleteChecklistItems(checks, GOVERNANCE_CHECK_KEYS);
}

function normalizeGovernanceChecks(raw) {
  return normalizeChecklistMap(raw, GOVERNANCE_CHECK_KEYS);
}

module.exports = {
  GOVERNANCE_CHECK_KEYS,
  LAUNCH_CHECKLIST_KEYS,
  governanceChecksComplete,
  hasCompleteEngagement,
  incompleteGovernanceItems,
  incompleteLaunchChecklistItems,
  isReconciled,
  launchChecklistComplete,
  launchChecklistItemComplete,
  normalizeGovernanceChecks,
  normalizeLaunchChecklist,
};
