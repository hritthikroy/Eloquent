/**
 * Clibb Prompt Template
 * Defines the 3-section layout:
 * 1. Clear Technical Objective
 * 2. Key Files / Architecture
 * 3. Quality Requirements & AST Verification
 * Guarantees zero trailing whitespace and strict section ordering.
 */

function formatClibbPrompt({ objective, affectedFiles, qualityDirectives, codeSnippet = null }) {
  const cleanObjective = objective.trim();

  const filesSection = affectedFiles
    .map(f => `- \`${f}\``)
    .join('\n');

  const qualitySection = qualityDirectives
    .map(q => `- ${q}`)
    .join('\n');

  const snippetBlock = codeSnippet
    ? `\n\nReference Implementation:\n\`\`\`javascript\n${codeSnippet.trim()}\n\`\`\``
    : '';

  const rawPrompt = `Clear Technical Objective
${cleanObjective}${snippetBlock}

Key Files / Architecture
${filesSection}

Quality Requirements & AST Verification
${qualitySection}`;

  // Strip trailing whitespace from every line and ensure single trailing newline
  return rawPrompt
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

module.exports = {
  formatClibbPrompt
};
