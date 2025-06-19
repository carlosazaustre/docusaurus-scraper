/**
 * Configuration options for the DocusaurusScraper
 */
export interface ScraperOptions {
  /** Whether to run browser in headless mode */
  headless?: boolean;
  /** Page timeout in milliseconds */
  timeout?: number;
  /** Delay between requests in milliseconds */
  delay?: number;
  /** Whether to include metadata in output */
  includeMetadata?: boolean;
  /** Custom CSS selectors for finding navigation links */
  customSelectors?: string[];
}

/**
 * Turndown configuration for converting HTML to Markdown
 */
export interface TurndownConfig {
  headingStyle: 'atx' | 'setext';
  bulletListMarker: '-' | '*' | '+';
  codeBlockStyle: 'fenced' | 'indented';
}

/**
 * Extracted content from a documentation page
 */
export interface ExtractedContent {
  title: string;
  url: string;
  urlPath: string;
  markdown: string;
}

/**
 * CLI command options
 */
export interface CLIOptions {
  output?: string;
  headless: boolean;
  timeout: string;
  delay: string;
  metadata: boolean;
}