const GATE_ERROR_CODES = new Set([
  "HARD_STOP_INCOMPLETE",
  "RECONCILIATION_INCOMPLETE",
  "TIER_GATE",
]);

/**
 * Reads a failed Stage 03 API response and classifies it for UI handling.
 * @returns {{ kind: "hard_stop"|"reconciliation"|"tier"|"generic", message: string }}
 */
export function parseStage03GateResponse(response, body) {
  const payload = body && typeof body === "object" ? body : {};
  const errorCode =
    typeof payload.error === "string" ? payload.error.trim() : "";
  const gateMessage =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : "";

  if (response.status === 403 && errorCode === "HARD_STOP_INCOMPLETE") {
    return {
      kind: "hard_stop",
      message:
        gateMessage ||
        "Community voice must be on record before collection can begin.",
    };
  }

  if (response.status === 403 && errorCode === "RECONCILIATION_INCOMPLETE") {
    return {
      kind: "reconciliation",
      message:
        gateMessage ||
        "Program design must be reconciled with community input before collection can begin.",
    };
  }

  if (response.status === 403 && errorCode === "TIER_GATE") {
    return {
      kind: "tier",
      message:
        gateMessage ||
        "This feature requires a Starter, Growth, or Enterprise plan. Upgrade your workspace to continue.",
    };
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    const trimmed = payload.error.trim();
    if (!GATE_ERROR_CODES.has(trimmed)) {
      return { kind: "generic", message: trimmed };
    }
  }

  return {
    kind: "generic",
    message: "Something went wrong. Please try again.",
  };
}

export function isPrerequisiteGateKind(kind) {
  return kind === "hard_stop" || kind === "reconciliation";
}
