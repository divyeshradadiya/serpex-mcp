# Serpex MCP

[![npm version](https://badge.fury.io/js/serpex-mcp.svg)](https://www.npmjs.com/package/serpex-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides multi-engine web search capabilities through the [Serpex API](https://serpex.dev). Search across Google, Bing, DuckDuckGo, Brave, Yahoo, and Yandex with automatic engine routing and structured JSON results.

## Features

✅ **Multi-Engine Support**: Access 6 search engines (Google, Bing, DuckDuckGo, Brave, Yahoo, Yandex)  
✅ **Auto Routing**: Automatically selects the best available search engine  
✅ **Time Filtering**: Filter results by day, week, month, or year  
✅ **Structured Results**: Clean, consistent JSON responses  
✅ **Fast & Reliable**: Built-in captcha handling and proxy rotation  
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

Search the web using Serpex multi-engine API.

**Parameters:**
- `q` (required): Search query string
- `engine` (optional): Choose search engine
  - `auto` (default) - Automatically selects best engine
  - `google`, `bing`, `duckduckgo`, `brave`, `yahoo`, `yandex`
- `time_range` (optional): Filter by time
  - `all` (default), `day`, `week`, `month`, `year`

**Example:**
```javascript
{
  "q": "artificial intelligence trends 2025",
  "engine": "google",
  "time_range": "month"
}
```

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
