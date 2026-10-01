#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const VERSION = '1.2.0';

// Client timeouts sit above the server's own budget for each call (search
// 30 s upstream, 45 s with include_content, extract 55 s), so the client never
// gives up on a request the server still finishes and bills.
const SEARCH_TIMEOUT_MS = 60_000;
const SEARCH_CONTENT_TIMEOUT_MS = 100_000;
const EXTRACT_TIMEOUT_MS = 100_000;

const API_KEY = process.env.SERPEX_API_KEY;
if (!API_KEY) {
  throw new Error('SERPEX_API_KEY environment variable is required');
}

interface SearchParams {
  q: string;
  include_content?: boolean;
  content_results?: 5 | 10;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  /** @deprecated Always "auto"; may be removed from responses. Not forwarded. */
  engine?: string;
  // Present only when include_content was requested. Best-effort per-URL
  // extraction: a successful fetch sets content, a failed one sets
  // content_error instead.
  content?: string;
  content_error?: string;
}

interface SearchMetadata {
  number_of_results: number;
  response_time: number;
  timestamp: string;
  credits_used: number;
  status?: 'success' | 'no_results';
  // Present only when include_content was requested.
  content_requested?: number;
  content_delivered?: number;
}

interface SerpexResponse {
  metadata: SearchMetadata;
  id: string;
  query: string;
  /** @deprecated Always ["auto"]; may be removed from responses. Not forwarded. */
  engines?: string[];
  results: SearchResult[];
  /** Present only when no results were found. */
  message?: string;
}

interface ExtractParams {
  urls: string[];
  format?: 'markdown' | 'html';
}

interface ExtractResult {
  url: string;
  success: boolean;
  markdown?: string;
  html?: string;
  status_code?: number;
  error?: string;
  error_type?: string;
}

interface ExtractResponse {
  success: boolean;
  results: ExtractResult[];
  metadata: {
    total_urls: number;
    successful_crawls: number;
    failed_crawls: number;
    credits_used: number;
  };
}

class SerpexServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'serpex-mcp-server',
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://api.serpex.dev',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': `serpex-mcp/${VERSION}`,
      },
      timeout: SEARCH_TIMEOUT_MS,
    });

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'serpex_search',
          description: 'Search the web with Serpex. Returns ranked web results as structured JSON. Optionally fetches full page content (markdown) for the top results inline — best-effort: results whose page cannot be extracted return a content_error instead of content.',
          inputSchema: {
            type: 'object',
            properties: {
              q: {
                type: 'string',
                description: 'Search query (max 500 characters)',
              },
              include_content: {
                type: 'boolean',
                description: 'Also fetch full page content (markdown) for the top results, inline with the search response. Best-effort: results that fail to extract carry a content_error instead of content. Default: false.',
              },
              content_results: {
                type: 'integer',
                enum: [5, 10],
                description: 'Number of top results to fetch content for, when include_content is true. Must be exactly 5 or 10. Default: 5.',
              },
            },
            required: ['q'],
          },
        },
        {
          name: 'serpex_extract',
          description: 'Extract the content of known web pages with Serpex. Returns each page as clean markdown (or HTML). Up to 10 URLs per call; pages that cannot be extracted return success: false with an error.',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 10,
                description: 'Absolute http(s) URLs to extract (1 to 10).',
              },
              format: {
                type: 'string',
                enum: ['markdown', 'html'],
                description: 'Output format. Default: markdown.',
              },
            },
            required: ['urls'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      if (name !== 'serpex_search' && name !== 'serpex_extract') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
      }

      const args = request.params.arguments as Record<string, unknown>;

      if (name === 'serpex_extract') {
        return await this.handleExtract(this.parseExtractArgs(args));
      }

      // Validate required parameter
      if (!args.q || typeof args.q !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Query parameter "q" is required and must be a string');
      }

      // Validate optional parameters
      if (args.include_content !== undefined && typeof args.include_content !== 'boolean') {
        throw new McpError(ErrorCode.InvalidParams, 'include_content must be a boolean');
      }

      if (
        args.content_results !== undefined &&
        args.content_results !== 5 &&
        args.content_results !== 10
      ) {
        throw new McpError(ErrorCode.InvalidParams, 'content_results must be exactly 5 or 10');
      }

      // Build typed params — only include optional fields when set
      const searchParams: SearchParams = {
        q: args.q as string,
        ...(args.include_content !== undefined ? { include_content: args.include_content as boolean } : {}),
        ...(args.content_results !== undefined ? { content_results: args.content_results as 5 | 10 } : {}),
      };

      return await this.handleSearch(searchParams);
    });
  }

  private parseExtractArgs(args: Record<string, unknown>): ExtractParams {
    const urls = args.urls;
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
      throw new McpError(ErrorCode.InvalidParams, 'urls must be an array of 1 to 10 URLs');
    }
    for (const url of urls) {
      if (typeof url !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'every url must be a string');
      }
      try {
        new URL(url);
      } catch {
        throw new McpError(ErrorCode.InvalidParams, `Invalid URL: ${url}`);
      }
    }
    if (args.format !== undefined && args.format !== 'markdown' && args.format !== 'html') {
      throw new McpError(ErrorCode.InvalidParams, 'format must be "markdown" or "html"');
    }
    return {
      urls: urls as string[],
      ...(args.format !== undefined ? { format: args.format as 'markdown' | 'html' } : {}),
    };
  }

  private async handleExtract(params: ExtractParams) {
    try {
      const response = await this.axiosInstance.post<ExtractResponse>('/api/crawl', params, {
        timeout: EXTRACT_TIMEOUT_MS,
      });
      const data = response.data;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              successful: data.metadata?.successful_crawls,
              failed: data.metadata?.failed_crawls,
              credits_used: data.metadata?.credits_used,
              results: (data.results ?? []).map(r => ({
                url: r.url,
                success: r.success,
                ...(r.markdown !== undefined ? { markdown: r.markdown } : {}),
                ...(r.html !== undefined ? { html: r.html } : {}),
                ...(r.status_code !== undefined ? { status_code: r.status_code } : {}),
                ...(r.error !== undefined ? { error: r.error } : {}),
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.error || error.message;
        return {
          content: [{ type: 'text', text: `Extract failed: ${msg}` }],
          isError: true,
        };
      }
      throw error;
    }
  }

  private async handleSearch(params: SearchParams) {
    try {
      if (!params.q || params.q.trim().length === 0) {
        throw new Error('Query is required');
      }

      const requestParams: Record<string, unknown> = {
        q: params.q,
      };

      if (params.include_content !== undefined) {
        requestParams.include_content = params.include_content;
      }

      if (params.content_results !== undefined) {
        requestParams.content_results = params.content_results;
      }

      const response = await this.axiosInstance.get<SerpexResponse>('/api/search', {
        params: requestParams,
        timeout: params.include_content ? SEARCH_CONTENT_TIMEOUT_MS : SEARCH_TIMEOUT_MS,
      });

      const data = response.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: data.query,
              status: data.metadata.status,
              total_results: data.metadata.number_of_results,
              credits_used: data.metadata.credits_used,
              ...(data.message !== undefined ? { message: data.message } : {}),
              ...(data.metadata.content_requested !== undefined
                ? { content_requested: data.metadata.content_requested }
                : {}),
              ...(data.metadata.content_delivered !== undefined
                ? { content_delivered: data.metadata.content_delivered }
                : {}),
              results: (data.results ?? []).map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                position: r.position,
                ...(r.content !== undefined ? { content: r.content } : {}),
                ...(r.content_error !== undefined ? { content_error: r.content_error } : {}),
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.error || error.message;
        return {
          content: [{ type: 'text', text: `Search failed: ${msg}` }],
          isError: true,
        };
      }
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Serpex MCP server running');
  }
}

const server = new SerpexServer();
server.run().catch(console.error);
