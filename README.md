# Serpex MCP

[![npm version](https://badge.fury.io/js/serpex-mcp.svg)](https://www.npmjs.com/package/serpex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that gives AI agents web search and page extraction through [Serpex](https://serpex.dev). Serpex is a web search API and extract API for AI agents. Search returns ranked web results, optionally with page content as markdown; Extract turns known URLs into clean markdown. Serpex runs its own search engine.

## Features

✅ **Web Search**: Ranked web results, nothing to configure  
✅ **Page Content**: Optionally fetch the top results' pages as markdown in the same call  
✅ **Structured Results**: Clean, consistent JSON responses  
✅ **Easy Integration**: Works with Claude Desktop, Jan AI, and any MCP-compatible client  

## Installation

### Quick Start (npx - Recommended)

No installation needed! Use npx to run directly:

```bash
npx serpex-mcp
```

### Global Installation

```bash
npm install -g serpex-mcp
```

### Local Installation

```bash
npm install serpex-mcp
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "serpex": {
      "command": "npx",
      "args": ["-y", "serpex-mcp"],
      "env": {
        "SERPEX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### With Other MCP Clients

Any MCP-compatible client can use this server. Configure it with:

- **Command**: `npx`
- **Arguments**: `-y serpex-mcp`
- **Environment**: `SERPEX_API_KEY=your-key`

### Standalone

```bash
export SERPEX_API_KEY="your-api-key-here"
serpex-mcp
```

## Available Tools

### `serpex_search`

Search the web with Serpex. Optionally fetches full page content
(markdown) for the top results inline with the search — best-effort, so check each
result for `content` vs `content_error`.

**Parameters:**
- `q` (required): Search query string (max 500 characters)
- `include_content` (optional, boolean): Also fetch full page content (markdown) for
  the top results. Best-effort — pages that can't be extracted
  return `content_error` instead. Default: `false`.
- `content_results` (optional, `5 | 10`): Number of top results to fetch content for,
  when `include_content` is `true`. Must be exactly `5` or `10`. Default: `5`.

**Example:**
```javascript
{
  "q": "artificial intelligence trends 2025",
  "include_content": true,
  "content_results": 5
}
```

**Response** (JSON, as tool output text) includes `status` (`success` or `no_results`),
`total_results`, `credits_used`, a `message` when nothing was found, `content_requested` /
`content_delivered` counts and, per result, `content` on success or `content_error`
on failure — both keys are omitted when content wasn't requested.

### `serpex_extract`

Extract the content of known web pages as clean markdown (or HTML).

**Parameters:**
- `urls` (required): 1 to 10 absolute http(s) URLs.
- `format` (optional, `markdown | html`): Output format. Default: `markdown`.

**Example:**
```javascript
{
  "urls": ["https://example.com/pricing"],
  "format": "markdown"
}
```

**Response** (JSON, as tool output text) includes `successful`, `failed`, `credits_used`
and, per URL, `success` plus `markdown` / `html`, or `error` when the page could not be
extracted. Extract calls can take up to about a minute, so the server waits up to 100 s.

## Getting Your API Key

1. Visit [serpex.dev](https://serpex.dev)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Use it in the `SERPEX_API_KEY` environment variable

## API Information

- **Base URL**: `https://api.serpex.dev`
- **Documentation**: [https://serpex.dev/docs](https://serpex.dev/docs)
- **Pricing**: Free tier available, affordable paid plans

## Development

### Build from Source

```bash
git clone https://github.com/divyeshradadiya/serpex-mcp.git
cd serpex-mcp
pnpm install
pnpm build
```

### Run Tests

```bash
export SERPEX_API_KEY="your-key-here"
pnpm test
```

## License

MIT

## Links

- [Serpex Website](https://serpex.dev)
- [Serpex Documentation](https://serpex.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Specification](https://modelcontextprotocol.io/specification)
