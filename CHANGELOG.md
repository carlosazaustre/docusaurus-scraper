# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2025-06-19)


### Features

* add CLI for Docusaurus scraper and improve documentation extraction process ([4264148](https://github.com/carlosazaustre/docusaurus-scraper/commit/42641488e8414aa6d0c91f8a0420bafa9ef09e7b))
* add GITHUB_TOKEN environment variable to release workflow ([41c6dea](https://github.com/carlosazaustre/docusaurus-scraper/commit/41c6dea13b228ba9c7d8296761b8614a2b514914))
* add script to screp documentation from docusaurus websites and convert it to markdown file ([a54cec6](https://github.com/carlosazaustre/docusaurus-scraper/commit/a54cec64e5565ea35b3ed845cb258a15668c638f))
* fix ci ([69ea0d9](https://github.com/carlosazaustre/docusaurus-scraper/commit/69ea0d9c21b74aa1d7267485e409d2a6c7db7b98))
* refactor Docusaurus scraper to use class structure and improve URL discovery methods ([63b06c7](https://github.com/carlosazaustre/docusaurus-scraper/commit/63b06c74673c71b0d972372a610d72b5a2712177))
* restructure project and implement Docusaurus scraper ([8a62e7d](https://github.com/carlosazaustre/docusaurus-scraper/commit/8a62e7d3b0fd55b21724570693672e85a60b8e86))

## [Unreleased]

## [1.0.0] - 2025-01-19

### Added

- Initial release of docusaurus-scraper
- Command-line interface for scraping Docusaurus documentation sites
- Automatic URL discovery via sitemap and manual navigation crawling
- HTML to Markdown conversion with proper formatting preservation
- Support for code blocks, admonitions, and other Docusaurus-specific elements
- Configurable options for headless mode, timeouts, and delays
- Programmatic API for Node.js applications

### Features

- ✅ Automatic URL discovery from sitemaps or navigation
- ✅ Content extraction from multiple CSS selectors
- ✅ Clean Markdown conversion with preserved formatting
- ✅ Code block preservation with syntax highlighting
- ✅ Configurable output formatting and metadata
- ✅ Error handling for failed pages and network issues
