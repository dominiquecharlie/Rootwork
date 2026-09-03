const { publicLanguages } = require("../publicFormLanguages");
const { packBlocksToBuffer } = require("./documentBuilder");
const { pickLocalized, safeFilenamePart } = require("./localizedText");

function optionLabelForId(question, optionId, lang) {
  if (!question || typeof optionId !== "string" || !optionId.trim()) {
    return null;
  }
  const opts = Array.isArray(question.options) ? question.options : [];
  const opt = opts.find(
    (o) => typeof o?.id === "string" && o.id.trim() === optionId.trim()
  );
  if (!opt) return null;
  return pickLocalized(opt.label, lang);
}

function branchInstruction({ question, questions, numberById, lang }) {
  const di = question?.display_if;
  if (!di || typeof di !== "object") {
    return { block: null, usedFallback: false };
  }

  const refId =
    typeof di.question_id === "string" ? di.question_id.trim() : "";
  const refNum = numberById.get(refId);
  const refQ = (questions || []).find((q) => q.id === refId);
  if (!refNum || !refQ) {
    return { block: null, usedFallback: false };
  }

  const op = typeof di.operator === "string" ? di.operator.trim() : "";
  const es = lang === "es";

  if (op === "answered") {
    return {
      block: {
        type: "branch_note",
        text: es
          ? `Responda solo si contestó la pregunta ${refNum}.`
          : `Only answer this if you answered question ${refNum}.`,
      },
      usedFallback: false,
    };
  }
  if (op === "not_answered") {
    return {
      block: {
        type: "branch_note",
        text: es
          ? `Responda solo si dejó en blanco la pregunta ${refNum}.`
          : `Only answer this if you left question ${refNum} blank.`,
      },
      usedFallback: false,
    };
  }

  if (op === "equals" || op === "not_equals") {
    const labelPick = optionLabelForId(refQ, di.value, lang);
    // Never print an option id into community-facing text. Omit the note.
    if (!labelPick || !labelPick.text) {
      return { block: null, usedFallback: false };
    }
    const label = labelPick.text;
    const text =
      op === "equals"
        ? es
          ? `Responda solo si eligió "${label}" en la pregunta ${refNum}.`
          : `Only answer this if you selected "${label}" for question ${refNum}.`
        : es
          ? `Responda solo si no eligió "${label}" en la pregunta ${refNum}.`
          : `Only answer this if you did not select "${label}" for question ${refNum}.`;
    return {
      block: { type: "branch_note", text },
      usedFallback: Boolean(labelPick.usedFallback),
    };
  }

  return { block: null, usedFallback: false };
}

function answerSpaceBlocks(type) {
  if (type === "long_text") {
    return [{ type: "answer_line", lines: 5, width: "full" }];
  }
  if (type === "number" || type === "date") {
    return [{ type: "answer_line", lines: 1, width: "short" }];
  }
  // short_text and anything else writable
  return [{ type: "answer_line", lines: 1, width: "full" }];
}

/**
 * Pure. Ordered content blocks for one language. Tests assert on this.
 */
function shapeCollectionInstrument({
  orgName,
  toolName,
  consentLanguage,
  questions,
  language,
}) {
  const lang =
    typeof language === "string" && language.trim()
      ? language.trim().toLowerCase()
      : "en";
  const list = Array.isArray(questions) ? questions : [];
  const blocks = [];
  let anyFallback = false;
  let consentMissingForLang = false;

  const org =
    typeof orgName === "string" && orgName.trim()
      ? orgName.trim()
      : "Organization";
  const tool =
    typeof toolName === "string" && toolName.trim()
      ? toolName.trim()
      : "Collection tool";

  blocks.push({ type: "title", text: org });
  blocks.push({ type: "subtitle", text: tool });

  const consentPick = pickLocalized(consentLanguage, lang);
  if (lang !== "en" && (!consentPick.text || consentPick.usedFallback)) {
    consentMissingForLang = true;
    blocks.push({
      type: "note",
      text:
        lang === "es"
          ? "Aviso importante: el texto de consentimiento no tiene traducción al español. La sección de consentimiento aparece en inglés."
          : "Important: consent language is not available in this language and appears in English.",
    });
  }

  if (consentPick.text) {
    if (consentPick.usedFallback) anyFallback = true;
    blocks.push({
      type: "section",
      text: lang === "es" ? "Consentimiento" : "Consent",
    });
    blocks.push({ type: "body", text: consentPick.text });
    blocks.push({ type: "spacer" });
  }

  const numberById = new Map();
  list.forEach((q, i) => {
    if (typeof q?.id === "string" && q.id.trim()) {
      numberById.set(q.id.trim(), i + 1);
    }
  });

  list.forEach((q, i) => {
    const n = i + 1;
    const picked = pickLocalized(q.text, lang);
    if (picked.usedFallback) anyFallback = true;

    blocks.push({
      type: "question",
      text: `${n}. ${picked.text}`,
      question_id: q.id,
      number: n,
    });

    const branch = branchInstruction({
      question: q,
      questions: list,
      numberById,
      lang,
    });
    if (branch.usedFallback) anyFallback = true;
    if (branch.block) blocks.push(branch.block);

    if (q.type === "multiple_choice") {
      for (const opt of Array.isArray(q.options) ? q.options : []) {
        const lab = pickLocalized(opt.label, lang);
        if (lab.usedFallback) anyFallback = true;
        if (!lab.text) continue;
        blocks.push({
          type: "option",
          text: lab.text,
          option_id: opt.id,
          marker: "☐",
        });
      }
    } else if (q.type === "yes_no") {
      blocks.push({
        type: "option",
        text: lang === "es" ? "Sí" : "Yes",
        marker: "☐",
      });
      blocks.push({
        type: "option",
        text: lang === "es" ? "No" : "No",
        marker: "☐",
      });
    } else {
      for (const line of answerSpaceBlocks(q.type)) {
        blocks.push(line);
      }
    }

    blocks.push({ type: "spacer" });
  });

  if (lang !== "en" && anyFallback && !consentMissingForLang) {
    blocks.splice(2, 0, {
      type: "note",
      text:
        lang === "es"
          ? "Algunas preguntas u opciones aparecen en inglés porque aún no tienen traducción."
          : "Some items appear in English because a translation is not available.",
    });
  } else if (lang !== "en" && anyFallback && consentMissingForLang) {
    // Consent already has its own warning. Still note other English fallbacks.
    const insertAt = blocks.findIndex((b) => b.type === "section") >= 0
      ? blocks.findIndex((b) => b.type === "section")
      : 2;
    blocks.splice(insertAt, 0, {
      type: "note",
      text:
        lang === "es"
          ? "Algunas preguntas u opciones también aparecen en inglés porque aún no tienen traducción."
          : "Some questions or options also appear in English because a translation is not available.",
    });
  }

  return {
    blocks,
    meta: { anyFallback, consentMissingForLang },
  };
}

function instrumentLanguagesForTool(questions, org) {
  return publicLanguages(org || {}, questions);
}

async function generateCollectionInstrumentDocx(input) {
  const { blocks } = shapeCollectionInstrument(input);
  const org =
    typeof input.orgName === "string" && input.orgName.trim()
      ? input.orgName.trim()
      : "";
  const tool =
    typeof input.toolName === "string" && input.toolName.trim()
      ? input.toolName.trim()
      : "instrument";
  const lang =
    typeof input.language === "string" && input.language.trim()
      ? input.language.trim().toLowerCase()
      : "en";
  return {
    buffer: await packBlocksToBuffer(blocks, {
      title: `${org} ${tool}`.trim(),
      creator: org,
    }),
    filename: `${safeFilenamePart(tool)}-${safeFilenamePart(lang)}.docx`,
    blocks,
  };
}

module.exports = {
  answerSpaceBlocks,
  branchInstruction,
  generateCollectionInstrumentDocx,
  instrumentLanguagesForTool,
  optionLabelForId,
  shapeCollectionInstrument,
};
