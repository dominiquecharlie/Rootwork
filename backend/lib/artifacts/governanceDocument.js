const { packBlocksToBuffer } = require("./documentBuilder");
const { pickLocalized, safeFilenamePart } = require("./localizedText");
const {
  GOVERNANCE_CHECK_KEYS,
  LAUNCH_CHECKLIST_KEYS,
  normalizeGovernanceChecks,
  normalizeLaunchChecklist,
} = require("../stageGates");

const GOVERNANCE_LABELS = {
  consent_reviewed: "Consent language review",
  shareback_plan: "Sharing findings back with the community",
  data_storage: "Where the data lives and who can access it",
};

const LAUNCH_LABELS = {
  pilot_confirmed: "Pilot confirmed",
  staff_trained: "Staff trained",
  community_informed: "Community informed",
};

const LANGUAGE_NATIVE_LABELS = {
  en: "English",
  es: "Español",
};

function languageLabel(code) {
  const c = typeof code === "string" ? code.trim().toLowerCase() : "";
  return LANGUAGE_NATIVE_LABELS[c] || c || "Unknown";
}

function formatGeneratedDate(iso) {
  const d =
    typeof iso === "string" && iso.trim() ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function questionTextEn(question) {
  const pick = pickLocalized(question?.text, "en");
  return pick.text || (typeof question?.id === "string" ? question.id : "");
}

/**
 * Pure. Ordered content blocks for the governance documentation export.
 * English document body. Consent section includes every stored language.
 */
function shapeGovernanceDocument({
  orgName,
  toolName,
  generatedAt,
  questions,
  consentLanguage,
  governanceChecks,
  launchChecklist,
  removalUrl,
  communityEngagement,
}) {
  const blocks = [];
  const org =
    typeof orgName === "string" && orgName.trim()
      ? orgName.trim()
      : "Organization";
  const tool =
    typeof toolName === "string" && toolName.trim()
      ? toolName.trim()
      : "Collection tool";
  const dateLabel = formatGeneratedDate(generatedAt);

  // 1. Header
  blocks.push({ type: "title", text: org });
  blocks.push({ type: "subtitle", text: "Data governance documentation" });
  blocks.push({ type: "body", text: `Collection tool: ${tool}` });
  blocks.push({ type: "body", text: `Date generated: ${dateLabel}` });
  blocks.push({
    type: "note",
    text:
      "This document describes how this organization collects community answers, how consent works, how findings will be shared, and how a resident can withdraw their response.",
  });

  // 2. What is being collected (question text only)
  blocks.push({ type: "section", text: "What is being collected" });
  const list = Array.isArray(questions) ? questions : [];
  if (list.length === 0) {
    blocks.push({
      type: "body",
      text: "No questions have been saved on this tool yet.",
    });
  } else {
    list.forEach((q, i) => {
      const text = questionTextEn(q);
      blocks.push({
        type: "question",
        text: `${i + 1}. ${text || "(untitled question)"}`,
      });
    });
  }

  // 3. Consent language in every stored language
  blocks.push({ type: "section", text: "Consent language" });
  const consent =
    consentLanguage &&
    typeof consentLanguage === "object" &&
    !Array.isArray(consentLanguage)
      ? consentLanguage
      : typeof consentLanguage === "string" && consentLanguage.trim()
        ? { en: consentLanguage.trim() }
        : {};
  const consentEntries = Object.entries(consent).filter(
    ([, val]) => typeof val === "string" && val.trim()
  );
  if (consentEntries.length === 0) {
    blocks.push({
      type: "body",
      text: "No consent language has been saved for this tool yet.",
    });
  } else {
    // Prefer en first, then remaining keys in insertion order.
    consentEntries.sort(([a], [b]) => {
      if (a === "en") return -1;
      if (b === "en") return 1;
      return 0;
    });
    for (const [lang, text] of consentEntries) {
      blocks.push({
        type: "body",
        text: `${languageLabel(lang)}:`,
      });
      blocks.push({ type: "body", text: text.trim() });
    }
  }

  // 4. Governance decisions
  blocks.push({ type: "section", text: "Governance decisions" });
  const gov = normalizeGovernanceChecks(governanceChecks);
  for (const key of GOVERNANCE_CHECK_KEYS) {
    const item = gov[key];
    const label = GOVERNANCE_LABELS[key] || key;
    const detail =
      typeof item.detail === "string" && item.detail.trim()
        ? item.detail.trim()
        : "(Not answered yet.)";
    blocks.push({
      type: "question",
      text: label,
    });
    blocks.push({ type: "body", text: detail });
  }

  // 5. Launch readiness
  blocks.push({ type: "section", text: "Launch readiness" });
  const launch = normalizeLaunchChecklist(launchChecklist);
  for (const key of LAUNCH_CHECKLIST_KEYS) {
    const item = launch[key];
    const label = LAUNCH_LABELS[key] || key;
    const detail =
      typeof item.detail === "string" && item.detail.trim()
        ? item.detail.trim()
        : "(Not answered yet.)";
    blocks.push({
      type: "question",
      text: label,
    });
    blocks.push({ type: "body", text: detail });
  }

  // 6. Withdrawal (facts about the product mechanism; no product branding)
  blocks.push({ type: "section", text: "How residents can withdraw" });
  blocks.push({
    type: "body",
    text:
      "Every respondent receives a removal code when they submit. They can use that code to remove their own response at any time, without contacting the organization. The code does not expire.",
  });
  const url =
    typeof removalUrl === "string" && removalUrl.trim()
      ? removalUrl.trim()
      : "";
  if (url) {
    blocks.push({
      type: "body",
      text: `Removal page: ${url}`,
    });
  } else {
    blocks.push({
      type: "body",
      text:
        "Removal page: available after this tool is launched, at the public form removal link for this tool.",
    });
  }
  blocks.push({
    type: "body",
    text:
      "A resident who loses the code must contact the organization and describe their submission. On an anonymous form, that may not be enough to find their response.",
  });

  // 7. Connection to community input
  blocks.push({ type: "section", text: "Connection to community input" });
  const eng =
    communityEngagement &&
    typeof communityEngagement === "object" &&
    !Array.isArray(communityEngagement)
      ? communityEngagement
      : null;
  if (!eng) {
    blocks.push({
      type: "body",
      text:
        "No Stage 02 community engagement record was found for this organization. This tool has not yet been linked to documented community priorities.",
    });
  } else {
    const priorities =
      typeof eng.priorities_named === "string" && eng.priorities_named.trim()
        ? eng.priorities_named.trim()
        : "";
    const title =
      typeof eng.title === "string" && eng.title.trim()
        ? eng.title.trim()
        : "";
    if (title) {
      blocks.push({
        type: "body",
        text: `Community engagement: ${title}`,
      });
    }
    if (priorities) {
      blocks.push({
        type: "body",
        text: `Community priorities this collection is meant to serve: ${priorities}`,
      });
    } else {
      blocks.push({
        type: "body",
        text:
          "A community engagement record exists, but no community priorities were named on it.",
      });
    }
  }

  return { blocks };
}

async function generateGovernanceDocumentDocx(input) {
  const { blocks } = shapeGovernanceDocument(input);
  const org =
    typeof input.orgName === "string" && input.orgName.trim()
      ? input.orgName.trim()
      : "";
  const tool =
    typeof input.toolName === "string" && input.toolName.trim()
      ? input.toolName.trim()
      : "governance";
  return {
    buffer: await packBlocksToBuffer(blocks, {
      title: `${org} ${tool} governance`.trim(),
      creator: org,
    }),
    filename: `${safeFilenamePart(tool)}-governance.docx`,
    blocks,
  };
}

module.exports = {
  generateGovernanceDocumentDocx,
  shapeGovernanceDocument,
};
