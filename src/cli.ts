#!/usr/bin/env node

import { Command } from 'commander';
import { DocusaurusScraper } from './docusaurus-scraper.js';
import { CLIOptions } from './types.js';

const program = new Command();

/**
 * Main CLI function that handles command line arguments and executes the scraper
 * @param url - Base URL of the Docusaurus site
 * @param options - CLI options from commander
 */
async function main(url: string, options: CLIOptions): Promise<void> {
  try {
    const scraper = new DocusaurusScraper({
      headless: options.headless,
      timeout: parseInt(options.timeout, 10),
      delay: parseInt(options.delay, 10),
      includeMetadata: options.metadata,
    });

    const outputPath = options.output || `docs-${Date.now()}.md`;

    await scraper.scrape(url, outputPath);
    console.log(`🎉 Documentation saved to ${outputPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', errorMessage);
    process.exit(1);
  }
}

// Configure CLI program
program
  .name('docusaurus-scraper')
  .description('Extract documentation from Docusaurus sites')
  .version('1.0.0')
  .argument('<url>', 'Base URL of the Docusaurus site')
  .option('-o, --output <file>', 'Output markdown file')
  .option('--no-headless', 'Run browser in visible mode')
  .option('-t, --timeout <ms>', 'Page timeout in milliseconds', '10000')
  .option('-d, --delay <ms>', 'Delay between requests', '500')
  .option('--no-metadata', 'Skip metadata in output')
  .action(main);

program.parse();