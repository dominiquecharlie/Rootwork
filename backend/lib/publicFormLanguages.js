// Languages offered on the public respondent form.
// Pure. No database, no network. See backend/tests/responseValidation.test.js

function languagesPresentOnQuestions(questions) {
  const present = new Set();
  for (const q of Array.isArray(questions) ? questions : []) {
    if (q?.text && typeof q.text === "object" && !Array.isArray(q.text)) {
      for (const [lang, val] of Object.entries(q.text)) {
        if (typeof lang !== "string" || typeof val !== "string" || !val.trim()) {
          continue;
        }
        const code = lang.trim().toLowerCase();
        if (code) present.add(code);
      }
    }
    if (Array.isArray(q?.options)) {
      for (const o of q.options) {
        if (o?.label && typeof o.label === "object" && !Array.isArray(o.label)) {
          for (const [lang, val] of Object.entries(o.label)) {
            if (
              typeof lang !== "string" ||
              typeof val !== "string" ||
              !val.trim()
            ) {
              continue;
            }
            const code = lang.trim().toLowerCase();
            if (code) present.add(code);
          }
        }
      }
    }
  }
  return present;
}

/**
 * Offered languages are the languages actually present on the tool's content.
 * languages_served orders them; it does not restrict them.
 *
 * languages_served is optional and is not collected at org creation, so
 * intersecting against it would mean a translated form silently loses its
 * translation because of an empty profile field.
 */
function publicLanguages(org, questions) {
  const present = languagesPresentOnQuestions(questions);
  if (present.size === 0) return ["en"];

  const raw = Array.isArray(org?.languages_served) ? org.languages_served : [];
  const preferred = [];
  const preferredSeen = new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const code = item.trim().toLowerCase();
    if (!code || preferredSeen.has(code)) continue;
    preferredSeen.add(code);
    preferred.push(code);
  }

  const offered = [];
  const offeredSeen = new Set();

  for (const lang of preferred) {
    if (present.has(lang) && !offeredSeen.has(lang)) {
      offeredSeen.add(lang);
      offered.push(lang);
    }
  }

  // Preserve encounter order from the content for languages not listed on the org.
  for (const lang of present) {
    if (!offeredSeen.has(lang)) {
      offeredSeen.add(lang);
      offered.push(lang);
    }
  }

  return offered;
}

module.exports = {
  languagesPresentOnQuestions,
  publicLanguages,
};
