const { supabase } = require("../lib/supabaseClient");

async function logClaudeInteraction({
  orgId,
  userId,
  stage,
  interactionType,
  promptSummary,
  outputSummary,
  tokensUsed,
}) {
  const { error } = await supabase.from("claude_interactions").insert({
    org_id: orgId,
    user_id: userId,
    stage,
    interaction_type: interactionType,
    prompt_summary: promptSummary,
    output_summary: outputSummary,
    model: "claude-sonnet-4-6",
    tokens_used: tokensUsed,
  });

  if (error) {
    console.error("Claude interaction log failed:", error.message);
  }
}

module.exports = { logClaudeInteraction };
