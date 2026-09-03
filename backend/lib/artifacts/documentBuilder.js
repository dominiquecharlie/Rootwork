// Shared Word document builder for Rootwork downloadable artifacts.
// Generators emit plain content blocks. This file is the only place that
// knows about the docx package. Blocks in, Buffer out.

const { AlignmentType, Document, Packer, Paragraph, TextRun } = require("docx");

const FONT = "Calibri";
const SIZE_TITLE = 32;
const SIZE_HEADING = 26;
const SIZE_BODY = 22;
const SIZE_NOTE = 20;

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: opts.size || SIZE_BODY,
    bold: Boolean(opts.bold),
    italics: Boolean(opts.italics),
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 200 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [run(text, opts)],
  });
}

function paragraphsFromBlocks(blocks) {
  const out = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    switch (b.type) {
      case "title":
        out.push(para(b.text, { size: SIZE_TITLE, bold: true, after: 120 }));
        break;
      case "subtitle":
        out.push(para(b.text, { size: SIZE_HEADING, bold: true, after: 200 }));
        break;
      case "body":
        out.push(para(b.text, { size: SIZE_BODY, after: 200 }));
        break;
      case "note":
        out.push(para(b.text, { size: SIZE_NOTE, italics: true, after: 240 }));
        break;
      case "section":
        out.push(para(b.text, { size: SIZE_HEADING, bold: true, after: 160 }));
        break;
      case "question":
        out.push(para(b.text, { size: SIZE_BODY, bold: true, after: 80 }));
        break;
      case "branch_note":
        out.push(para(b.text, { size: SIZE_NOTE, italics: true, after: 120 }));
        break;
      case "option":
        out.push(
          para(`  ${b.marker || "☐"}  ${b.text}`, {
            size: SIZE_BODY,
            after: 60,
          })
        );
        break;
      case "answer_line": {
        const width =
          b.width === "short"
            ? "____________________"
            : "______________________________________________";
        const lines = Math.max(1, Number(b.lines) || 1);
        for (let i = 0; i < lines; i++) {
          out.push(para(width, { size: SIZE_BODY, after: 80 }));
        }
        break;
      }
      case "spacer":
        out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * @param {object[]} blocks
 * @param {{ title?: string, creator?: string }} meta
 * creator must be the org name or "". Never leave the library default.
 */
async function packBlocksToBuffer(blocks, meta = {}) {
  const creator = typeof meta.creator === "string" ? meta.creator : "";
  const doc = new Document({
    creator,
    title: typeof meta.title === "string" ? meta.title : "",
    description: "",
    sections: [{ children: paragraphsFromBlocks(blocks) }],
  });
  return Packer.toBuffer(doc);
}

module.exports = {
  FONT,
  packBlocksToBuffer,
  paragraphsFromBlocks,
};
