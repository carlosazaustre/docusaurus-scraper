# Docusaurus Scraper

A command-line tool to extract documentation from Docusaurus sites and convert it to Markdown format.

## Motivation

When working with AI-powered code completion and generation tools, you often need to provide context about third-party dependencies and their APIs. These LLM agents perform better when they have access to comprehensive documentation in a structured format.

This tool solves that problem by:

- **Extracting complete documentation** from Docusaurus sites
- **Converting to Markdown format** that's optimal for LLM consumption
- **Preserving structure and formatting** including code blocks, links, and navigation
- **Providing context-rich output** that helps AI agents understand how to use libraries and APIs

Perfect for feeding documentation to AI coding assistants, building knowledge bases, or creating offline documentation archives.

## Installation

### Global Installation

```bash
npm install -g docusaurus-scraper
```

### Local Installation

```bash
npm install docusaurus-scraper
```

## Usage

### Command Line Interface

```bash
# Basic usage
docusaurus-scraper https://docs.example.com

# Specify output file
docusaurus-scraper https://docs.example.com -o my-docs.md

# Run with visible browser (useful for debugging)
docusaurus-scraper https://docs.example.com --no-headless

# Custom timeout and delay
docusaurus-scraper https://docs.example.com -t 15000 -d 1000

# Skip metadata in output
docusaurus-scraper https://docs.example.com --no-metadata
```

### Programmatic Usage

```javascript
const DocusaurusScraper = require('docusaurus-scraper');

const scraper = new DocusaurusScraper({
  headless: true,
  timeout: 10000,
  delay: 500,
  includeMetadata: true,
});

const markdown = await scraper.scrape('https://docs.example.com', 'output.md');
console.log('Documentation extracted successfully!');
```

## CLI Options

| Option                | Description                  | Default               |
| --------------------- | ---------------------------- | --------------------- |
| `-o, --output <file>` | Output markdown file         | `docs-{timestamp}.md` |
| `--no-headless`       | Run browser in visible mode  | `false`               |
| `-t, --timeout <ms>`  | Page timeout in milliseconds | `10000`               |
| `-d, --delay <ms>`    | Delay between requests       | `500`                 |
| `--no-metadata`       | Skip metadata in output      | `false`               |

## Configuration Options

When using programmatically, you can pass these options to the constructor:

```javascript
const scraper = new DocusaurusScraper({
  headless: true, // Run browser in headless mode
  timeout: 10000, // Page load timeout
  delay: 500, // Delay between page requests
  includeMetadata: true, // Include metadata in output
  customSelectors: [], // Additional CSS selectors for content discovery
});
```

## Output Format

The tool generates clean Markdown with:

- **Hierarchical structure** with proper heading levels
- **Preserved code blocks** with syntax highlighting
- **Working links** and references
- **Metadata section** (optional) with source URL and extraction date
- **Page-by-page organization** with clear separators

Example output structure:

```markdown
# Documentation from: https://docs.example.com

Date: 2025-01-19T10:30:00.000Z

---

## Getting Started | Example Docs

**URL:** [https://docs.example.com/getting-started](https://docs.example.com/getting-started)

Content here...

---

## API Reference | Example Docs

**URL:** [https://docs.example.com/api](https://docs.example.com/api)

More content...
```

## Features

- ✅ **Automatic URL Discovery** - Finds documentation pages via sitemap or navigation crawling
- ✅ **Content Extraction** - Intelligently identifies main content areas
- ✅ **Markdown Conversion** - Clean conversion preserving formatting
- ✅ **Code Block Preservation** - Maintains syntax highlighting information
- ✅ **Link Resolution** - Preserves internal and external links
- ✅ **Configurable Output** - Customizable formatting and metadata options
- ✅ **Error Handling** - Graceful handling of failed pages or network issues

## Requirements

- Node.js >= 14.0.0
- Internet connection for accessing target documentation sites

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Run linting: `npm run lint`
4. Format code: `npm run format`

### Publishing

This project uses [release-please](https://github.com/googleapis/release-please) for automated versioning and publishing. When you merge changes to the main branch, a release PR will be automatically created. Merging that PR will trigger a new release.

## Dependencies

- [`playwright`](https://playwright.dev/) - For browser automation and page rendering
- [`turndown`](https://github.com/mixmark-io/turndown) - HTML to Markdown conversion
- [`commander`](https://github.com/tj/commander.js) - Command-line interface

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
