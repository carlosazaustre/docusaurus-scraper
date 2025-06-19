const { chromium } = require('playwright');
const TurndownService = require('turndown');
const fs = require('node:fs');

class DocusaurusScraper {
  constructor(options = {}) {
    this.options = {
      headless: true,
      timeout: 10000,
      delay: 50,
      includeMetadata: true,
      customSelectors: [],
      ...options,
    };

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
      }
    });

    this.turndown.addRule('admonition', {
      filter: (node) => node.classList.contains('admonition'),
      replacement: (content, node) => {
        const type = [...node.classList].find(c => c.startsWith('admonition-'))?.replace('admonition-', '') || 'note';
        return `\n\n:::${type}\n${content}\n:::\n\n`;
      }
    });
  }

  async scrape(baseUrl, outputPath = null) {
    if (!baseUrl) throw new Error('Base URL is required');

    const browser = await chromium.launch({ headless: this.options.headless });
    const page = await browser.newPage();

    console.log('🔍 Searching documentation URLs...');

    try {
      const urls = await this.discoverUrls(page, baseUrl);
      console.log(`📄 Found ${urls.length} documentation URLs.`);

      const markdown = await this.extractContent(page, urls, baseUrl);

      if (outputPath) {
        fs.writeFileSync(outputPath, markdown, 'utf8');
        console.log(`✅ Documentation saved to ${outputPath}`);
      }

      return markdown;
    } catch (error) {
      console.error(`❌ Error scraping Docusaurus: ${error.message}`);
    } finally {
      await browser.close();
    }
  }

  async discoverUrls(page, baseUrl) {
    const urls = new Set();

    // 1) Sitemap Strategy
    try {
      await page.goto(`${baseUrl}/sitemap.xml`, { timeout: this.options.timeout });
      const content = await page.content();
      const matches = content.match(/<loc>(.*?)<\/loc>/g);
      
      if (matches) {
        matches.forEach(match => {
          const url = match.replace(/<\/?loc>/g, '');
          if (url.startsWith(baseUrl) && !url.includes('#')) {
            urls.add(url);
          }
        });
      }
    } catch (e) {
      console.warn('⚠️ Error fetching sitemap, trying manual discovery');
    }

    // 2) Manual Discovery Strategy
    if (urls.size === 0) {
      await page.goto(baseUrl, { timeout: this.options.timeout });
      await page.waitForLoadState('networkidle');
      
      const selectors = [
        'nav a[href*="/docs"]',
        '.menu a',
        '.sidebar a',
        '[class*="sidebar"] a',
        '[class*="menu"] a',
        ...this.options.customSelectors
      ];
      
      for (const selector of selectors) {
        try {
          const links = await page.$$eval(selector, links => 
            links.map(l => l.href).filter(href => href)
          );
          links.forEach(url => {
            if (url.startsWith(baseUrl)) urls.add(url);
          });
        } catch (e) {
          continue;
        }
      }
    }

    return Array.from(urls).sort();
  }

  async extractContent(page, urls, baseUrl) {
    let markdown = this.options.includeMetadata
      ? `# Documentation from ${baseUrl}\n\nDate: ${new Date().toISOString()}\n\n---\n\n`
      : '';

    for (const [url, index] of urls.entries()) {
      console.log(`\n🔗 Processing ${index + 1}/${urls.length}: ${url}`);
      
      try {
        await page.goto(url, { timeout: this.options.timeout });
        await page.waitForLoadState('networkidle');

        const contentSelectors = [
          'main article',
          '.markdown',
          '[class*="docItemContainer"]',
          '[class*="docMainContainer"]',
          '[class*="content"]',
          'main',
          'article'
        ];

        const title = await page.title();
        let content = null;

        for (const selector of contentSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              content = await element.evaluate(el => el.innerHTML);
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (content) {
          const pageMarkdown = this.turndown.turndown(content);
          const urlPath = new URL(url).pathname;

          markdown += `\n\n## ${title}\n\n**URL:** ${url}\n**Ruta:** ${urlPath}\n\n${pageMarkdown}\n\n---\n`;
        }

        await page.waitForTimeout(this.options.delay);
      } catch (error) {
        console.error(`❌ Error processing ${url}: ${error.message}`);
      }
    }

    return markdown;
  }
}

module.exports = DocusaurusScraper;
