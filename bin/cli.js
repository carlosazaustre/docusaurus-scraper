#!/usr/bin/env node

const path = require('node:path');
const { Command } = require('commander');
const DocusaurusScraper = require('../scrape-docusaurus');

const program = new Command();

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
  .action(async (url, options) => {
    try {
    const scraper = new DocusaurusScraper({
      headless: options.headless,
      timeout: parseInt(options.timeout),
      delay: parseInt(options.delay),
      includeMetadata: options.metadata
    });

    const outputPath = options.output ||  `docs-${Date.now()}.md`;
    
    await scraper.scrape(url, outputPath);
    console.log(`🎉 Documentation saved to ${outputPath}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
});

program.parse();