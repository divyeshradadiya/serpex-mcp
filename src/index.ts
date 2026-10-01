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
  engine: string;
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
  // Present only when include_content was requested.
  content_requested?: number;
  content_delivered?: number;
}

interface SerpexResponse {
  metadata: SearchMetadata;
  id: string;
  query: string;
  engines: string[];
  results: SearchResult[];
}

class SerpexServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'serpex-mcp-server',
        version: '1.1.3',
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
      },
      timeout: 30000,
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'serpex_search') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }

      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
      }

      const args = request.params.arguments as Record<string, unknown>;

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
      });

      const data = response.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: data.query,
              engines: data.engines,
              total_results: data.metadata.number_of_results,
              ...(data.metadata.content_requested !== undefined
                ? { content_requested: data.metadata.content_requested }
                : {}),
              ...(data.metadata.content_delivered !== undefined
                ? { content_delivered: data.metadata.content_delivered }
                : {}),
              results: data.results.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                position: r.position,
                engine: r.engine,
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
