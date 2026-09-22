# Serpex MCP

[![npm version](https://badge.fury.io/js/serpex-mcp.svg)](https://www.npmjs.com/package/serpex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that gives AI agents real-time web search through [Serpex](https://serpex.dev), a real-time web search API. Every query returns structured JSON results, with optional page content as markdown.

## Features

✅ **Real-Time Web Search**: One search engine, nothing to configure — no engine to choose  
✅ **Page Content**: Optionally fetch the top results' pages as markdown in the same call  
✅ **Structured Results**: Clean, consistent JSON responses  
✅ **Fast & Reliable**: Real-time results from a managed API  
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

Search the web with Serpex, a real-time web search API. Optionally fetches full page content
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

**Response** (JSON, as tool output text) includes `content_requested` /
`content_delivered` counts and, per result, `content` on success or `content_error`
on failure — both keys are omitted when content wasn't requested.

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
