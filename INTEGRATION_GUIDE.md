# Integrating Serpex MCP Server

## Overview

This MCP (Model Context Protocol) server enables AI applications to perform web searches using the Serpex API, providing access to multiple search engines (Google, Bing, DuckDuckGo, Brave, Yahoo, Yandex).

## Installation

### 1. Install the MCP Server

```bash
cd mcp/serpex-search-mcp-server
pnpm install
pnpm build
```

### 2. Get Your Serpex API Key

Sign up at [serpex.dev](https://serpex.dev) and get your API key from the dashboard.

### 3. Configure Your MCP Client

Configure the Serpex MCP server in your MCP-compatible application:

#### For Claude Desktop:
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

#### For Other MCP Clients:
Use these configuration parameters:
- **Command:** `npx`
- **Arguments:** `-y serpex-mcp`
- **Environment Variable:** `SERPEX_API_KEY=your-key`

## Usage in MCP Clients

Once configured, the `serpex_search` tool will be available to your AI applications.

### Example Prompts

1. **Basic Search:**
   ```
   Search for "artificial intelligence trends 2025"
   ```

2. **Specific Engine:**
   ```
   Use Google to search for "climate change research"
   ```

3. **Time-Filtered Search:**
   ```
   Search for news about "OpenAI" from the last month
   ```

### Tool Parameters

The MCP server exposes one tool: `serpex_search`

**Parameters:**
- `q` (required): Search query string
- `engine` (optional): Choose search engine
  - `auto` (default) - Automatically selects best engine
  - `google`
  - `bing`
  - `duckduckgo`
  - `brave`
  - `yahoo`
  - `yandex`
- `time_range` (optional): Filter results by time
  - `all` (default)
  - `day`
  - `week`
  - `month`
  - `year`

## API Information

- **Base URL:** `https://api.serpex.dev`
- **Endpoint:** `/api/search`
- **Authentication:** Bearer token (API key)
- **Documentation:** [https://serpex.dev/docs](https://serpex.dev/docs)

## Features

✅ Multiple search engines support  
✅ Real-time search results  
✅ Structured JSON responses  
✅ Time-range filtering  
✅ Auto-engine selection  
✅ Error handling and validation  

## Testing

Run the test script to verify the server works:

```bash
node test-server.js
```

Expected output:
- Initialize response ✅
- List tools response ✅
- Search results from Google ✅
- Search results from auto engine ✅

## Troubleshooting

### Server Not Starting

**Issue:** `SERPEX_API_KEY environment variable is required`

**Solution:** Make sure your API key is set in your MCP client configuration or environment.

### No Results Returned

**Issue:** Empty or error responses

**Solutions:**
1. Verify your API key is valid
2. Check your account has available credits
3. Ensure you're using the correct API endpoint: `https://api.serpex.dev`

## Development

### File Structure

```
mcp/serpex-search-mcp-server/
├── src/
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript output
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── test-server.js        # Test script
└── README.md            # Documentation
```

### Building from Source

```bash
pnpm install
pnpm build
```

### Running in Development

```bash
export SERPEX_API_KEY="your_key_here"
node build/index.js
```

## Support

## Support

- **Serpex API Documentation:** https://serpex.dev/docs
- **MCP Specification:** https://modelcontextprotocol.io/specification
- **MCP SDK Documentation:** https://github.com/modelcontextprotocol

## License

MIT License - See LICENSE file for details
