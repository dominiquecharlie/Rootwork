const MAX_CHARS = 120000;

function truncate(text) {
  const t = String(text || "");
  if (t.length <= MAX_CHARS) return t;
  return `${t.slice(0, MAX_CHARS)}\n\n[Document truncated for processing length.]`;
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>}
 */
async function extractProgramDocumentText(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Expected a file buffer.");
  }

  if (mimeType === "text/plain") {
    return truncate(buffer.toString("utf8"));
  }

  if (mimeType === "application/pdf") {
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return truncate(result?.text || "");
    } finally {
      if (parser && typeof parser.destroy === "function") {
        try {
          await parser.destroy();
        } catch {
          // ignore
        }
      }
    }
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = require("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return truncate(value || "");
  }

  throw new Error("Unsupported mime type for text extraction.");
}

module.exports = { extractProgramDocumentText, MAX_CHARS };
