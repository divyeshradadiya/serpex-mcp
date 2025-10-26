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
  engine?: 'auto' | 'google' | 'bing' | 'duckduckgo' | 'brave' | 'yahoo' | 'yandex';
  category?: 'web';
  time_range?: 'all' | 'day' | 'week' | 'month' | 'year';
  format?: 'json';
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  engine: string;
  published_date: string | null;
}

interface SearchMetadata {
  number_of_results: number;
  response_time: number;
  timestamp: string;
  credits_used: number;
}

interface SerpexResponse {
  metadata: SearchMetadata;
  id: string;
  query: string;
  engines: string[];
  results: SearchResult[];
  answers: any[];
  suggestions: string[];
}

class SerpexServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'serpex-mcp-server',
        version: '0.1.0',
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
          description: 'Search the web using Serpex API. Returns structured search results from multiple engines (Google, Bing, DuckDuckGo, Brave, Yahoo, Yandex).',
          inputSchema: {
            type: 'object',
            properties: {
              q: {
                type: 'string',
                description: 'Search query (max 500 characters)',
              },
              engine: {
                type: 'string',
                description: 'Search engine (default: auto)',
                enum: ['auto', 'google', 'bing', 'duckduckgo', 'brave', 'yahoo', 'yandex'],
              },
              time_range: {
                type: 'string',
                description: 'Filter by time range',
                enum: ['all', 'day', 'week', 'month', 'year'],
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

      // Build typed params
      const searchParams: SearchParams = {
        q: args.q as string,
      };

      if (args.engine && typeof args.engine === 'string') {
        searchParams.engine = args.engine as SearchParams['engine'];
      }

      if (args.time_range && typeof args.time_range === 'string') {
        searchParams.time_range = args.time_range as SearchParams['time_range'];
      }

      return await this.handleSearch(searchParams);
    });
  }

  private async handleSearch(params: SearchParams) {
    try {
      if (!params.q || params.q.trim().length === 0) {
        throw new Error('Query is required');
      }

      const response = await this.axiosInstance.get<SerpexResponse>('/api/search', {
        params: {
          q: params.q,
          engine: params.engine || 'auto',
          category: 'web',
          time_range: params.time_range || 'all',
          format: 'json',
        },
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
              results: data.results.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                position: r.position,
                engine: r.engine,
              })),
              suggestions: data.suggestions,
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
