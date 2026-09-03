// Shared localized string helpers for artifact generators.

function pickLocalized(map, lang) {
  const code =
    typeof lang === "string" && lang.trim() ? lang.trim().toLowerCase() : "en";
  if (typeof map === "string") {
    const text = map.trim();
    return { text, usedFallback: Boolean(text) && code !== "en" };
  }
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return { text: "", usedFallback: false };
  }
  if (typeof map[code] === "string" && map[code].trim()) {
    return { text: map[code].trim(), usedFallback: false };
  }
  if (typeof map.en === "string" && map.en.trim()) {
    return { text: map.en.trim(), usedFallback: code !== "en" };
  }
  for (const val of Object.values(map)) {
    if (typeof val === "string" && val.trim()) {
      return { text: val.trim(), usedFallback: true };
    }
  }
  return { text: "", usedFallback: false };
}

function safeFilenamePart(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return s || "document";
}

module.exports = {
  pickLocalized,
  safeFilenamePart,
};
