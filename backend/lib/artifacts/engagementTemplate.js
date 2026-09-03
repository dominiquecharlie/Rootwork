const { packBlocksToBuffer } = require("./documentBuilder");
const { pickLocalized, safeFilenamePart } = require("./localizedText");

function shapeEngagementTemplate({
  orgName,
  template_type,
  template_name,
  prompt_text,
}) {
  const blocks = [];
  blocks.push({
    type: "title",
    text: typeof orgName === "string" && orgName.trim() ? orgName.trim() : "Organization",
  });
  const type =
    typeof template_type === "string" && template_type.trim()
      ? template_type.trim()
      : "Template";
  const name =
    typeof template_name === "string" && template_name.trim()
      ? template_name.trim()
      : type;
  blocks.push({ type: "subtitle", text: `${type}: ${name}` });
  const body =
    typeof prompt_text === "string" ? prompt_text.trim() : "";
  if (body) {
    blocks.push({ type: "body", text: body });
  }
  return blocks;
}

async function generateEngagementTemplateDocx(input) {
  const blocks = shapeEngagementTemplate(input);
  const org =
    typeof input.orgName === "string" && input.orgName.trim()
      ? input.orgName.trim()
      : "";
  const name =
    typeof input.template_name === "string" && input.template_name.trim()
      ? input.template_name.trim()
      : "engagement-template";
  return {
    buffer: await packBlocksToBuffer(blocks, {
      title: `${org} ${name}`.trim(),
      creator: org,
    }),
    filename: `${safeFilenamePart(name)}-en.docx`,
    blocks,
  };
}

module.exports = {
  generateEngagementTemplateDocx,
  shapeEngagementTemplate,
};
