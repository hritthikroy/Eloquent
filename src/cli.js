#!/usr/bin/env node

/**
 * Eloquent / Antigravity CLI Tool
 * Exposes developer commands including clibb-prompt.
 */

const { run: runClibbPrompt } = require('./commands/clibbPrompt');

function printHelp() {
  console.log(`
Eloquent CLI - Antigravity Developer Tooling

Usage:
  eloquent-cli <command> [arguments] [options]

Commands:
  clibb-prompt <intent>       Generate a structured 3-section Clibb developer prompt.
  help                        Display this help text.

Options:
  --snippet "<code>"         Attach an embedded code snippet to validate and embed.
  -h, --help                 Show help information.

Examples:
  eloquent-cli clibb-prompt "Implement low-latency PCM audio ring buffer"
  eloquent-cli clibb-prompt "Synchronize state across Electron and Go backend"
`);
}

function main(args = process.argv.slice(2)) {
  if (args.length === 0 || args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    printHelp();
    return 0;
  }

  const command = args[0];

  switch (command) {
    case 'clibb-prompt': {
      const intentArgs = [];
      let codeSnippet = null;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--snippet' && i + 1 < args.length) {
          codeSnippet = args[++i];
        } else {
          intentArgs.push(args[i]);
        }
      }

      const rawIntent = intentArgs.join(' ');
      if (!rawIntent || rawIntent.trim().length === 0) {
        console.error('❌ Error: Missing intent argument for clibb-prompt.');
        console.error('Usage: eloquent-cli clibb-prompt "<intent>"');
        return 1;
      }

      try {
        const prompt = runClibbPrompt(rawIntent, { codeSnippet });
        console.log(prompt);
        return 0;
      } catch (err) {
        console.error(`❌ Error generating Clibb prompt: ${err.message}`);
        return 1;
      }
    }

    default:
      console.error(`❌ Unknown command: "${command}". Run "eloquent-cli --help" for available commands.`);
      return 1;
  }
}

if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

module.exports = {
  main,
  printHelp
};
