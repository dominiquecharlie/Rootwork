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

// Stage 03 launch checklist (Capability Map): confirmation plus required detail.
// Stored on collection_tools.configuration.launch_checklist.
const LAUNCH_CHECKLIST_KEYS = [
  "pilot_confirmed",
  "staff_trained",
  "community_informed",
];

function launchChecklistItemComplete(item) {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return false;
  }
  return Boolean(item.confirmed) && isNonemptyTrimmedString(item.detail);
}

function launchChecklistComplete(checklist) {
  if (
    checklist == null ||
    typeof checklist !== "object" ||
    Array.isArray(checklist)
  ) {
    return false;
  }
  for (const key of LAUNCH_CHECKLIST_KEYS) {
    if (!launchChecklistItemComplete(checklist[key])) {
      return false;
    }
  }
  return true;
}

function incompleteLaunchChecklistItems(checklist) {
  const src =
    checklist != null &&
    typeof checklist === "object" &&
    !Array.isArray(checklist)
      ? checklist
      : {};
  return LAUNCH_CHECKLIST_KEYS.filter(
    (key) => !launchChecklistItemComplete(src[key])
  );
}

module.exports = {
  LAUNCH_CHECKLIST_KEYS,
  hasCompleteEngagement,
  incompleteLaunchChecklistItems,
  isReconciled,
  launchChecklistComplete,
  launchChecklistItemComplete,
};
