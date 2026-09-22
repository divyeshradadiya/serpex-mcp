# Integrating Serpex MCP Server

## Overview

This MCP (Model Context Protocol) server enables AI applications to perform web searches using Serpex, a real-time web search API, with optional page content as markdown.

## Installation

### 1. Install the MCP Server

No install step is needed — `npx -y serpex-mcp` (below) fetches it. To build from source:

```bash
git clone https://github.com/divyeshradadiya/serpex-mcp.git
cd serpex-mcp
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

2. **Search with page content:**
   ```
   Search for "climate change research" and read the top 5 pages
   ```

### Tool Parameters

The MCP server exposes one tool: `serpex_search`

**Parameters:**
- `q` (required): Search query string (max 500 characters)
- `include_content` (optional, boolean): Also fetch full page content (markdown) for the top results. Best-effort — pages that can't be extracted return `content_error` instead. Default: `false`.
- `content_results` (optional, `5` or `10`): How many top results to fetch content for when `include_content` is `true`. Default: `5`.

There is no engine parameter: Serpex is one search engine. (The API's legacy `engine`/`engines` parameters are deprecated and ignored since 2026-06; this server never sends them. The `engines`/`engine` fields in the tool output are kept for compatibility.)

## API Information

- **Base URL:** `https://api.serpex.dev`
- **Endpoint:** `/api/search`
- **Authentication:** Bearer token (API key)
- **Documentation:** [https://serpex.dev/docs](https://serpex.dev/docs)

## Features

✅ One search engine — nothing to configure  
✅ Real-time search results  
✅ Structured JSON responses  
✅ Optional page content (markdown) for top results  
✅ Error handling and validation  

## Testing

Run the test script to verify the server works:

```bash
node test-server.js
```

Expected output:
- Initialize response ✅
- List tools response ✅
- Search results ✅
- Search results with page content ✅

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
serpex-mcp/
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

- **Serpex API Documentation:** https://serpex.dev/docs
- **MCP Specification:** https://modelcontextprotocol.io/specification
- **MCP SDK Documentation:** https://github.com/modelcontextprotocol

## License

MIT License - See LICENSE file for details
