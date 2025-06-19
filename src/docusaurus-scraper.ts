import { Browser, chromium, Page } from 'playwright';
import TurndownService from 'turndown';
import { promises as fs } from 'node:fs';
import { ScraperOptions, TurndownConfig } from './types.js';

/**
 * DocusaurusScraper class for extracting documentation from Docusaurus sites
 */
export class DocusaurusScraper {
  private readonly headless: boolean;
  private readonly timeout: number;
  private readonly delay: number;
  private readonly includeMetadata: boolean;
  private readonly customSelectors: string[];
  private readonly turndown: TurndownService;

  /**
   * Creates a new DocusaurusScraper instance
   * @param options - Configuration options for the scraper
   */
  constructor(options: ScraperOptions = {}) {
    this.headless = options.headless ?? true;
    this.timeout = options.timeout || 10000;
    this.delay = options.delay || 500;
    this.includeMetadata = options.includeMetadata ?? true;
    this.customSelectors = options.customSelectors || [];

    const turndownConfig: TurndownConfig = {
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    };

    this.turndown = new TurndownService(turndownConfig);
    this.setupTurndownRules();
  }

  /**
   * Sets up custom Turndown rules for better Markdown conversion
   * @private
   */
  private setupTurndownRules(): void {
    // Rule for code blocks with syntax highlighting
    this.turndown.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content: string, node: Node): string => {
        const element = node as HTMLElement;
        const code = element.querySelector('code');
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
        return `\n\`\`\`${lang}\n${code?.textContent || content}\n\`\`\`\n`;
      },
    });

    // Rule for Docusaurus admonitions
    this.turndown.addRule('admonition', {
      filter: (node: Node): boolean => {
        const element = node as HTMLElement;
        return element.classList?.contains('admonition') || false;
      },
      replacement: (content: string, node: Node): string => {
        const element = node as HTMLElement;
        const type =
          [...(element.classList || [])]
            .find((c) => c.startsWith('admonition-'))
            ?.replace('admonition-', '') || 'note';
        return `\n\n:::${type}\n${content}\n:::\n\n`;
      },
    });
  }

  /**
   * Discovers documentation URLs from a Docusaurus site
   * @param page - Playwright page instance
   * @param baseUrl - Base URL of the Docusaurus site
   * @returns Promise resolving to array of discovered URLs
   */
  private async getDocumentationUrls(
    page: Page,
    baseUrl: string
  ): Promise<string[]> {
    const urls = new Set<string>();

    // Strategy 1: Try to get URLs from sitemap.xml
    try {
      await page.goto(`${baseUrl}/sitemap.xml`, { timeout: this.timeout });
      const content = await page.content();
      const matches = content.match(/<loc>(.*?)<\/loc>/g);

      if (matches) {
        matches.forEach((match) => {
          const url = match.replace(/<\/?loc>/g, '');
          if (url.startsWith(baseUrl) && !url.includes('#')) {
            urls.add(url);
          }
        });
      }
    } catch {
      console.warn('⚠️ Error fetching sitemap, trying manual discovery');
    }

    // Strategy 2: Manual discovery through navigation links
    if (urls.size === 0) {
      await page.goto(baseUrl, { timeout: this.timeout });
      await page.waitForLoadState('networkidle');

      const selectors = [
        'nav a[href*=\"/docs\"]',
        '.menu a',
        '.sidebar a',
        '[class*=\"sidebar\"] a',
        '[class*=\"menu\"] a',
        ...this.customSelectors,
      ];

      for (const selector of selectors) {
        try {
          const links = await page.$$eval(
            selector,
            (links: HTMLAnchorElement[]) =>
              links.map((l) => l.href).filter((href) => href)
          );
          links.forEach((url) => {
            if (url.startsWith(baseUrl)) urls.add(url);
          });
        } catch {
          continue;
        }
      }
    }

    return Array.from(urls).sort();
  }

  /**
   * Extracts content from a documentation page
   * @param page - Playwright page instance
   * @returns Promise resolving to extracted content or empty string
   */
  private async extractContent(page: Page): Promise<string> {
    const contentSelectors = [
      'main article',
      '.markdown',
      '[class*=\"docItemContainer\"]',
      '[class*=\"docMainContainer\"]',
      '[class*=\"content\"]',
      'main',
      'article',
    ];

    const title = await page.title();
    let content: string | null = null;

    // Try to find content using various selectors
    for (const selector of contentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          content = await element.evaluate((el: HTMLElement) => el.innerHTML);
          break;
        }
      } catch {
        continue;
      }
    }

    if (content) {
      const pageMarkdown = this.turndown.turndown(content);
      const url = page.url();
      const urlPath = new URL(url).pathname;

      return `## ${title}\n\n**URL:** ${url}\n**Ruta:** ${urlPath}\n\n${pageMarkdown}`;
    }

    return '';
  }

  /**
   * Scrapes documentation from a Docusaurus site
   * @param baseUrl - Base URL of the Docusaurus site
   * @param outputPath - Optional path to save the extracted documentation
   * @returns Promise resolving to the extracted content as string
   * @throws Error if scraping fails
   */
  public async scrape(baseUrl: string, outputPath?: string): Promise<string> {
    const browser: Browser = await chromium.launch({ headless: this.headless });
    const page: Page = await browser.newPage();

    try {
      console.log('🔍 Searching documentation URLs...');
      const urls = await this.getDocumentationUrls(page, baseUrl);
      console.log(`📄 Found ${urls.length} documentation URLs.`);

      let allContent = '';

      // Add metadata header if enabled
      if (this.includeMetadata) {
        allContent += `# Documentation from: ${baseUrl}\n`;
        allContent += `Date: ${new Date().toISOString()}\n\n`;
        allContent += '---\n\n';
      }

      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`📖 Processing ${url} (${i + 1}/${urls.length})`);

        try {
          if (!url) {
            console.log(`⚠️ Skipping undefined URL at index ${i}`);
            continue;
          }
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.timeout,
          });
          await page.waitForTimeout(this.delay);

          const content = await this.extractContent(page);

          if (content.trim()) {
            allContent += content + '\n\n---\n\n';
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(`❌ Error processing ${url}: ${errorMessage}`);
          continue;
        }
      }

      // Save to file if output path is provided
      if (outputPath) {
        try {
          await fs.writeFile(outputPath, allContent, 'utf8');
          console.log(`✅ Documentation saved to ${outputPath}`);
        } catch (writeError) {
          const errorMessage =
            writeError instanceof Error
              ? writeError.message
              : String(writeError);
          console.error(`❌ Error writing file: ${errorMessage}`);
          throw writeError;
        }
      }

      return allContent;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Scraping failed: ${errorMessage}`);
      throw error;
    } finally {
      await browser.close();
    }
  }
}
