import { Browser, chromium, Page } from 'playwright';
import TurndownService from 'turndown';
import { promises as fs } from 'node:fs';
import {
  ScraperOptions,
  TurndownConfig,
  Platform,
  PlatformConfig,
} from './types.js';

/**
 * DocusaurusScraper class for extracting documentation from Docusaurus sites and alternatives
 */
export class DocumentationScraper {
  private readonly headless: boolean;
  private readonly timeout: number;
  private readonly delay: number;
  private readonly includeMetadata: boolean;
  private readonly customSelectors: string[];
  private readonly platform: Platform;
  private readonly recursiveCrawling: boolean;
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
    this.platform = options.platform || 'auto';
    this.recursiveCrawling = options.recursiveCrawling ?? true;

    const turndownConfig: TurndownConfig = {
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    };

    this.turndown = new TurndownService(turndownConfig);
    this.setupTurndownRules();
  }

  /**
   * Gets platform-specific configuration
   * @param detectedPlatform - The detected or specified platform
   * @returns Platform configuration object
   */
  private getPlatformConfig(detectedPlatform: Platform): PlatformConfig {
    const configs: Record<Platform, PlatformConfig> = {
      docusaurus: {
        navigationSelectors: [
          'nav a[href*="/docs"]',
          '.menu a',
          '.sidebar a',
          '[class*="sidebar"] a',
          '[class*="menu"] a',
        ],
        contentSelectors: [
          'main article',
          '.markdown',
          '[class*="docItemContainer"]',
          '[class*="docMainContainer"]',
          '[class*="content"]',
          'main',
          'article',
        ],
        useSitemap: true,
      },
      mintlify: {
        navigationSelectors: [
          '.docs-sidebar a',
          '.sidebar a',
          'nav a',
          '[data-nav] a',
          '.navigation a',
          '[class*="sidebar"] a',
          '[class*="nav"] a',
          '.docs-nav a',
        ],
        contentSelectors: [
          '.docs-content',
          '.markdown',
          'main article',
          '[class*="content"]',
          '.prose',
          'main',
          'article',
          '.page-content',
        ],
        useSitemap: true,
        urlPatterns: [/\/docs\//, /\/guide\//, /\/api\//, /\/reference\//],
        excludePatterns: [
          /\/api\/auth\//,
          /\/oauth\//,
          /\/login/,
          /\/signup/,
          /\/dashboard/,
          /\/settings/,
          /\.(css|js|json|xml|ico|png|jpg|jpeg|gif|svg)$/i,
          /\/assets\//,
          /\/static\//,
        ],
      },
      auto: {
        navigationSelectors: [
          // Combine all platform selectors for auto-detection
          'nav a[href*="/docs"]',
          '.menu a',
          '.sidebar a',
          '[class*="sidebar"] a',
          '[class*="menu"] a',
          '.docs-sidebar a',
          '[data-nav] a',
          '.navigation a',
          '.docs-nav a',
        ],
        contentSelectors: [
          'main article',
          '.markdown',
          '[class*="docItemContainer"]',
          '[class*="docMainContainer"]',
          '.docs-content',
          '[class*="content"]',
          '.prose',
          'main',
          'article',
          '.page-content',
        ],
        useSitemap: true,
      },
    };

    return configs[detectedPlatform];
  }

  /**
   * Detects the platform type by analyzing the page structure
   * @param page - Playwright page instance
   * @returns Promise resolving to detected platform
   */
  private async detectPlatform(page: Page): Promise<Platform> {
    try {
      // Look for platform-specific indicators
      const indicators = await page.evaluate(() => {
        const hasDocusaurusClass =
          document.querySelector('[class*="docusaurus"]') !== null;
        const hasDocusaurusScript = Array.from(document.scripts).some(
          (script) =>
            script.src.includes('docusaurus') ||
            script.textContent?.includes('docusaurus')
        );
        const hasMintlifyMeta =
          document.querySelector(
            'meta[name="generator"][content*="Mintlify"]'
          ) !== null;
        const hasMintlifyClass =
          document.querySelector('[class*="mintlify"]') !== null;

        return {
          hasDocusaurusClass,
          hasDocusaurusScript,
          hasMintlifyMeta,
          hasMintlifyClass,
        };
      });

      if (indicators.hasDocusaurusClass || indicators.hasDocusaurusScript) {
        return 'docusaurus';
      }

      if (indicators.hasMintlifyMeta || indicators.hasMintlifyClass) {
        return 'mintlify';
      }

      // If no specific platform detected, default to auto
      return 'auto';
    } catch {
      return 'auto';
    }
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
   * Discovers documentation URLs from a documentation site with recursive crawling
   * @param page - Playwright page instance
   * @param baseUrl - Base URL of the documentation site
   * @returns Promise resolving to array of discovered URLs
   */
  private async getDocumentationUrls(
    page: Page,
    baseUrl: string
  ): Promise<string[]> {
    const discoveredUrls = new Set<string>();
    const visitedUrls = new Set<string>();
    const urlsToVisit = new Set<string>([baseUrl]);

    // Detect platform if using auto mode
    let currentPlatform = this.platform;
    if (currentPlatform === 'auto') {
      await page.goto(baseUrl, { timeout: this.timeout });
      await page.waitForLoadState('networkidle');
      currentPlatform = await this.detectPlatform(page);
      console.log(`🔍 Detected platform: ${currentPlatform}`);
    }

    const config = this.getPlatformConfig(currentPlatform);

    // Strategy 1: Try to get URLs from sitemap.xml if platform supports it and recursive crawling is disabled
    if (config.useSitemap && !this.recursiveCrawling) {
      try {
        await page.goto(`${baseUrl}/sitemap.xml`, { timeout: this.timeout });
        const content = await page.content();
        const matches = content.match(/<loc>(.*?)<\/loc>/g);

        if (matches) {
          matches.forEach((match) => {
            const url = match.replace(/<\/?loc>/g, '');
            if (url.startsWith(baseUrl) && !url.includes('#')) {
              // Apply platform-specific URL patterns if available
              if (config.urlPatterns) {
                const matchesPattern = config.urlPatterns.some((pattern) =>
                  pattern.test(url)
                );
                if (matchesPattern) {
                  discoveredUrls.add(url);
                }
              } else {
                discoveredUrls.add(url);
              }
            }
          });
        }

        if (discoveredUrls.size > 0) {
          console.log(`📄 Found ${discoveredUrls.size} URLs from sitemap`);
          return Array.from(discoveredUrls).sort();
        }
      } catch {
        console.warn('⚠️ Error fetching sitemap, trying recursive crawling');
      }
    }

    // Strategy 2: Recursive crawling through navigation links
    console.log('🕷️ Starting recursive crawling...');

    while (urlsToVisit.size > 0) {
      const currentUrl = Array.from(urlsToVisit)[0];
      if (!currentUrl) {
        break;
      }

      urlsToVisit.delete(currentUrl);

      if (visitedUrls.has(currentUrl)) {
        continue;
      }

      visitedUrls.add(currentUrl);
      console.log(
        `🔍 Crawling: ${currentUrl} (${visitedUrls.size} visited, ${urlsToVisit.size} pending)`
      );

      try {
        await page.goto(currentUrl, { timeout: this.timeout });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(this.delay);

        // Check if this page has documentation content
        const hasContent = await this.hasDocumentationContent(page, config);
        if (hasContent) {
          discoveredUrls.add(currentUrl);
        }

        // Find all links on the current page
        const selectors = [
          ...config.navigationSelectors,
          ...this.customSelectors,
          'a[href]', // Include all links for more comprehensive crawling
        ];

        for (const selector of selectors) {
          try {
            const links = await page.$$eval(
              selector,
              (links: HTMLAnchorElement[]) =>
                links.map((l) => l.href).filter((href) => href)
            );

            links.forEach((url) => {
              // Only include URLs from the same host
              if (
                url.startsWith(baseUrl) &&
                !url.includes('#') &&
                !visitedUrls.has(url)
              ) {
                // Apply exclusion patterns if available
                if (config.excludePatterns) {
                  const shouldExclude = config.excludePatterns.some((pattern) =>
                    pattern.test(url)
                  );
                  if (!shouldExclude) {
                    urlsToVisit.add(url);
                  }
                } else {
                  urlsToVisit.add(url);
                }
              }
            });
          } catch {
            continue;
          }
        }
      } catch (error) {
        console.warn(
          `⚠️ Error crawling ${currentUrl}: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
    }

    console.log(
      `✅ Crawling completed. Found ${discoveredUrls.size} documentation pages.`
    );
    return Array.from(discoveredUrls).sort();
  }

  /**
   * Checks if a page contains documentation content
   * @param page - Playwright page instance
   * @param config - Platform configuration
   * @returns Promise resolving to boolean indicating if page has documentation content
   */
  private async hasDocumentationContent(
    page: Page,
    config: PlatformConfig
  ): Promise<boolean> {
    try {
      // Check if any of the content selectors find meaningful content
      for (const selector of config.contentSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const textContent = await element.evaluate(
              (el: HTMLElement) => el.textContent?.trim() || ''
            );
            // Consider it documentation if it has substantial text content (more than 100 characters)
            if (textContent && textContent.length > 100) {
              return true;
            }
          }
        } catch {
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extracts content from a documentation page
   * @param page - Playwright page instance
   * @param platform - Platform type to use for selector configuration
   * @returns Promise resolving to extracted content or empty string
   */
  private async extractContent(
    page: Page,
    platform?: Platform
  ): Promise<string> {
    // Use the specified platform or fall back to instance platform
    const currentPlatform = platform || this.platform;
    const config = this.getPlatformConfig(
      currentPlatform === 'auto' ? 'auto' : currentPlatform
    );

    const contentSelectors = config.contentSelectors;

    const title = await page.title();
    let content: string | null = null;

    // Try to find content using platform-specific selectors
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
   * Scrapes documentation from a documentation site
   * @param baseUrl - Base URL of the documentation site
   * @param outputPath - Optional path to save the extracted documentation
   * @returns Promise resolving to the extracted content as string
   * @throws Error if scraping fails
   */
  public async scrape(baseUrl: string, outputPath?: string): Promise<string> {
    const browser: Browser = await chromium.launch({ headless: this.headless });
    const page: Page = await browser.newPage();

    let detectedPlatform: Platform = this.platform;

    try {
      console.log('🔍 Searching documentation URLs...');
      const urls = await this.getDocumentationUrls(page, baseUrl);
      console.log(`📄 Found ${urls.length} documentation URLs.`);

      // Detect platform if using auto mode for content extraction
      if (this.platform === 'auto' && urls.length > 0 && urls[0]) {
        await page.goto(urls[0], { timeout: this.timeout });
        await page.waitForLoadState('networkidle');
        detectedPlatform = await this.detectPlatform(page);
      }

      let allContent = '';

      // Add metadata header if enabled
      if (this.includeMetadata) {
        allContent += `# Documentation from: ${baseUrl}\n`;
        allContent += `Platform: ${detectedPlatform}\n`;
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

          const content = await this.extractContent(page, detectedPlatform);

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
