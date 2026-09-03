// Audit row payloads for response_deletions.
// Records THAT a deletion happened, never the deleted content.

function selfDeletionAudit({ org_id, collection_tool_id }) {
  return {
    org_id,
    collection_tool_id,
    method: "self",
    deleted_by: null,
  };
}

function orgDeletionAudit({ org_id, collection_tool_id, deleted_by }) {
  if (typeof deleted_by !== "string" || !deleted_by.trim()) {
    throw new Error("org deletion requires deleted_by.");
  }
  return {
    org_id,
    collection_tool_id,
    method: "org",
    deleted_by: deleted_by.trim(),
  };
}

module.exports = {
  orgDeletionAudit,
  selfDeletionAudit,
};
