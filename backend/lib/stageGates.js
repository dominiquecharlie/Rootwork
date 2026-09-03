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

module.exports = {
  hasCompleteEngagement,
  isReconciled,
};
