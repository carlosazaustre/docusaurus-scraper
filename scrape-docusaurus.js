const { chromium } = require('playwright');
const TurndownService = require('turndown');
const fs = require('node:fs');

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

turndown.addRule('codeBlock', {
  filter: ['pre'],
  replacement: (content, node) => {
    const code = node.querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
    return `\n\`\`\`${lang}\n${code?.textContent || content}\n\`\`\`\n`;
  }
});

async function scrapeDocusaurus(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('🔍 Searching documentation URLs...');

  // Strategy 1): Trying Sitemap
  let docUrls;
  try {
    await page.goto(`${baseUrl}/sitemap.xml`, { waitUntil: 'networkidle' });
    const sitemapContent = await page.content();
    const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g);
    if (urlMatches) {
      docUrls = urlMatches
        .map(match => match.replace(/<\/?loc>/g, ''))
        .filter(url => url.includes(baseUrl) && !url.includes('#'));
    }
  } catch (e) {
    console.error('⚠️ Error fetching sitemap, trying manually');
  }

  // Strategy 2): Manual Scraping
  if(docUrls.length === 0) {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    const menuLinks = await page.$$eval('nav a, .menu a, .sidebar a', links =>
      links.map(link => link.href).filter(href => href && href.includes(baseUrl))
    );
    docUrls = [...new Set(menuLinks)];
  }

  console.log(`📄 Found ${docUrls.length} documentation URLs.`);

  let allMarkdown = `# Documentation from: ${baseUrl}\nDate: ${new Date().toISOString()}\n\n---\n\n`;

  for(let i = 0; i < docUrls.length; i++) {
    const url = docUrls[i];
    console.log(`📖 Processing ${i + 1}/${docUrls.length}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('main, article, .markdown, [class*="content"]', { timeout: 5000 });

      const title = await page.title();

      const contentSelectors = [
        'main article',
        '.markdown',
        '[class*="docItemContainer"]',
        '[class*="content"]',
        'main',
        'article'
      ];

      let content = null;
      for (const selector of contentSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            content = await element.innerHTML();
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (content) {
        const markdown = turndown.turndown(content);
        const urlPath = new URL(url).pathname;

        allMarkdown += `\n\n## ${title}\n\n**URL:** [${url}](${url})\n\n${markdown}\n\n---\n\n`;
      } else {
        console.warn(`⚠️ No content found for ${url}`);
      }

      // Pause to avoid overwhelming the server
      await page.waitForTimeout(1000);
    } catch (e) {
      console.error(`❌ Error processing ${url}: ${e.message}`);
    }
  }

  await browser.close();

  // Save the markdown to a file
  const filename = `output-${Date.now()}.md`;
  fs.writeFileSync(filename, allMarkdown, 'utf8');

  console.log(`✅ Documentation saved to ${filename}`);
  console.log(`📊 Size: ${(allMarkdown.length / 1024).toFixed(1)} KB`);
}

scrapeDocusaurus('https://docs.kemtai.com').catch(console.error);