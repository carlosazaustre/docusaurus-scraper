const { chromium } = require('playwright');
const TurndownService = require('turndown');
const fs = require('node:fs').promises; // Cambiar a la versión de promesas

class DocusaurusScraper {
  constructor(options = {}) {
    this.headless = options.headless ?? true;
    this.timeout = options.timeout || 10000;
    this.delay = options.delay || 500;
    this.includeMetadata = options.includeMetadata ?? true;
    this.customSelectors = options.customSelectors || [];

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });

    this.setupTurndownRules();
  }

  setupTurndownRules() {
    this.turndown.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content, node) => {
        const code = node.querySelector('code');
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
        return `\n\`\`\`${lang}\n${code?.textContent || content}\n\`\`\`\n`;
      },
    });

    this.turndown.addRule('admonition', {
      filter: (node) => node.classList.contains('admonition'),
      replacement: (content, node) => {
        const type =
          [...node.classList]
            .find((c) => c.startsWith('admonition-'))
            ?.replace('admonition-', '') || 'note';
        return `\n\n:::${type}\n${content}\n:::\n\n`;
      },
    });
  }

  async getDocumentationUrls(page, baseUrl) {
    const urls = new Set();

    // 1) Sitemap Strategy
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

    // 2) Manual Discovery Strategy
    if (urls.size === 0) {
      await page.goto(baseUrl, { timeout: this.timeout });
      await page.waitForLoadState('networkidle');

      const selectors = [
        'nav a[href*="/docs"]',
        '.menu a',
        '.sidebar a',
        '[class*="sidebar"] a',
        '[class*="menu"] a',
        ...this.customSelectors,
      ];

      for (const selector of selectors) {
        try {
          const links = await page.$$eval(selector, (links) =>
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

  async extractContent(page) {
    const contentSelectors = [
      'main article',
      '.markdown',
      '[class*="docItemContainer"]',
      '[class*="docMainContainer"]',
      '[class*="content"]',
      'main',
      'article',
    ];

    const title = await page.title();
    let content = null;

    for (const selector of contentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          content = await element.evaluate((el) => el.innerHTML);
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

  async scrape(baseUrl, outputPath) {
    const browser = await chromium.launch({ headless: this.headless });
    const page = await browser.newPage();

    try {
      console.log('🔍 Searching documentation URLs...');
      const urls = await this.getDocumentationUrls(page, baseUrl);
      console.log(`📄 Found ${urls.length} documentation URLs.`);

      let allContent = '';

      if (this.includeMetadata) {
        allContent += `# Documentation from: ${baseUrl}\n`;
        allContent += `Date: ${new Date().toISOString()}\n\n`;
        allContent += '---\n\n';
      }

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`📖 Processing ${url} (${i + 1}/${urls.length})`);

        try {
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
          console.log(`❌ Error processing ${url}: ${error.message}`);
          continue;
        }
      }

      if (outputPath) {
        try {
          await fs.writeFile(outputPath, allContent, 'utf8');
          console.log(`✅ Documentation saved to ${outputPath}`);
        } catch (writeError) {
          console.error(`❌ Error writing file: ${writeError.message}`);
          throw writeError;
        }
      }

      return allContent;
    } catch (error) {
      console.error(`❌ Scraping failed: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }
}

module.exports = DocusaurusScraper;
