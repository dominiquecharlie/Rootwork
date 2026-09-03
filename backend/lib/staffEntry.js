// Staff entry eligibility and insert shaping for Stage 03.
// Pure. Routes own auth and persistence.

const STAFF_ENTRY_WHO = new Set(["staff_members", "both", "other"]);

const ENTRY_NOT_FOUND = { error: "Entry form not found." };

function staffEntryWhoCompletes(configuration) {
  if (!configuration || typeof configuration !== "object") return "";
  const who =
    typeof configuration.who_completes === "string"
      ? configuration.who_completes.trim().toLowerCase()
      : "";
  return who;
}

function defaultHasIndividualSubject(toolType) {
  const t =
    typeof toolType === "string" ? toolType.trim().toLowerCase() : "";
  return t === "interview" || t === "survey";
}

function readHasIndividualSubject(configuration, toolType) {
  if (
    configuration &&
    typeof configuration === "object" &&
    typeof configuration.has_individual_subject === "boolean"
  ) {
    return configuration.has_individual_subject;
  }
  return defaultHasIndividualSubject(toolType);
}

/**
 * Staff entry is only for launched tools whose who_completes allows staff.
 * program_participants-only and drafts both 404 with the same shape.
 */
function isStaffEntryEligible(tool) {
  if (!tool || typeof tool !== "object") return false;
  if (tool.launched_at == null) return false;
  const cfg =
    tool.configuration && typeof tool.configuration === "object"
      ? tool.configuration
      : {};
  return STAFF_ENTRY_WHO.has(staffEntryWhoCompletes(cfg));
}

/**
 * Build the collection_responses insert row for a staff entry.
 * Caller must have already validated the payload and consent.
 * Throws if entered_by is missing (route-level actor requirement).
 */
function buildStaffEntryInsert({
  orgId,
  toolId,
  userId,
  language,
  visibleAnswers,
  consentAt,
  hasIndividualSubject,
  removalCodeHash,
}) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Staff entry requires entered_by.");
  }
  const row = {
    org_id: orgId,
    collection_tool_id: toolId,
    response_payload: visibleAnswers,
    consent_acknowledged_at: consentAt,
    language,
    submitted_at: consentAt,
    entry_method: "staff",
    entered_by: userId.trim(),
  };
  if (hasIndividualSubject) {
    if (typeof removalCodeHash !== "string" || !removalCodeHash.trim()) {
      throw new Error("Individual-subject staff entry requires a removal code hash.");
    }
    row.removal_code_hash = removalCodeHash.trim();
  }
  return row;
}

module.exports = {
  ENTRY_NOT_FOUND,
  STAFF_ENTRY_WHO,
  buildStaffEntryInsert,
  defaultHasIndividualSubject,
  isStaffEntryEligible,
  readHasIndividualSubject,
  staffEntryWhoCompletes,
};
