#!/usr/bin/env node

import { Command } from 'commander';
import { DocumentationScraper } from './documentation-scraper.js';
import { CLIOptions, Platform } from './types.js';

const program = new Command();

/**
 * Main CLI function that handles command line arguments and executes the scraper
 * @param url - Base URL of the documentation site
 * @param options - CLI options from commander
 */
async function main(url: string, options: CLIOptions): Promise<void> {
  try {
    // Validate platform option
    const validPlatforms: Platform[] = ['docusaurus', 'mintlify', 'auto'];
    if (!validPlatforms.includes(options.platform)) {
      console.error(
        `❌ Invalid platform: ${options.platform}. Valid options: ${validPlatforms.join(', ')}`
      );
      process.exit(1);
    }

    const scraper = new DocumentationScraper({
      headless: options.headless,
      timeout: parseInt(options.timeout, 10),
      delay: parseInt(options.delay, 10),
      includeMetadata: options.metadata,
      platform: options.platform,
      recursiveCrawling: options.recursiveCrawling,
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
  .description('Extract documentation from Docusaurus sites and alternatives')
  .version('1.0.0')
  .argument('<url>', 'Base URL of the documentation site')
  .option('-o, --output <file>', 'Output markdown file')
  .option('--no-headless', 'Run browser in visible mode')
  .option('-t, --timeout <ms>', 'Page timeout in milliseconds', '10000')
  .option('-d, --delay <ms>', 'Delay between requests', '500')
  .option('--no-metadata', 'Skip metadata in output')
  .option(
    '-p, --platform <platform>',
    'Documentation platform type (docusaurus, mintlify, auto)',
    'auto'
  )
  .option(
    '--no-recursive-crawling',
    'Disable recursive crawling and use sitemap/initial discovery only'
  )
  .action(main);

program.parse();
