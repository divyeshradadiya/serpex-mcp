#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
// The official SDK owns the HTTP contract (params, timeouts, error parsing), so
// this server cannot drift from the API on its own.
import { SerpexClient, SerpApiException } from 'serpex';
import type { ExtractParams, ExtractResponse, SearchParams, SearchResponse, SerpexClientOptions } from 'serpex';

const VERSION = '1.2.1';

const API_KEY = process.env.SERPEX_API_KEY;
if (!API_KEY) {
  throw new Error('SERPEX_API_KEY environment variable is required');
}

// Optional override (self-hosting, tests). Defaults to https://api.serpex.dev.
const BASE_URL = process.env.SERPEX_BASE_URL || 'https://api.serpex.dev';

const BILLING_URL = 'https://app.serpex.dev/dashboard/billing';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function textResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/** The API's own error text from an error body (string, `{ message }` or framework `message`). */
function apiMessage(err: SerpApiException): string {
  const d = (err.details ?? {}) as Record<string, unknown>;
  if (typeof d.error === 'string' && d.error) {
    if (err.statusCode === 404 && typeof d.message === 'string' && d.message) return d.message;
    return d.error;
  }
  const nested = d.error as { message?: unknown } | undefined;
  if (nested && typeof nested.message === 'string' && nested.message) return nested.message;
  if (typeof d.message === 'string' && d.message) return d.message;
  return typeof err.message === 'string' && err.message !== '[object Object]'
    ? err.message
    : 'API request failed';
}

/** Ensure the API text ends like a sentence before more text is appended. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * One clear, actionable sentence per failure, for the agent reading the tool
 * output: what happened, whether it was charged, and whether to retry.
 */
function describeError(err: unknown, what: 'Search' | 'Extract'): string {
  if (!(err instanceof SerpApiException)) {
    const msg = err instanceof Error ? err.message : String(err);
    return `${what} failed: ${sentence(msg)} Not charged; safe to retry.`;
  }
  const status = err.statusCode;
  const d = (err.details ?? {}) as Record<string, unknown>;
  const msg = apiMessage(err);
  if (status === undefined) {
    // Timeout or network failure: nothing came back from the API.
    return `${what} failed: ${sentence(err.message)} Safe to retry.`;
  }
  switch (status) {
    case 400:
      return `${what} rejected (HTTP 400): ${sentence(msg)} Fix the arguments; retrying the same call will fail again.`;
    case 401:
      return `Serpex rejected the API key (HTTP 401): ${sentence(msg)} Check SERPEX_API_KEY; do not retry.`;
    case 402: {
      const balance = typeof d.remainingCredits === 'number' ? ` Balance: ${d.remainingCredits} credits.` : '';
      return `Out of Serpex credits (HTTP 402).${balance} Top up at ${BILLING_URL}; do not retry until then.`;
    }
    case 403:
    case 410:
      return `${what} refused (HTTP ${status}): ${sentence(msg)} Do not retry.`;
    case 429: {
      const limit = typeof d.limit === 'number' ? ` (limit: ${d.limit} requests per second)` : '';
      const wait = typeof d.retryAfterMs === 'number' ? d.retryAfterMs : 1000;
      return `Serpex rate limit exceeded${limit}. Retry in ${wait} ms.`;
    }
    default: {
      const reqId = typeof d.request_id === 'string' ? ` Request id: ${d.request_id}.` : '';
      if (status >= 500) {
        const charged = /charged/i.test(msg) ? '' : ' Not charged.';
        const retry = /retry/i.test(msg) ? '' : ' Retry shortly.';
        return `Serpex is temporarily unavailable (HTTP ${status}): ${sentence(msg)}${charged}${retry}${reqId}`;
      }
      return `${what} failed (HTTP ${status}): ${sentence(msg)}`;
    }
  }
}

/** Tool output for a search: no deprecated engine fields, content only when requested. */
function formatSearch(data: SearchResponse) {
  const m = data.metadata;
  return {
    query: data.query,
    status: m.status,
    total_results: m.number_of_results,
    credits_used: m.credits_used,
    ...(data.message !== undefined ? { message: data.message } : {}),
    ...(m.content_requested !== undefined ? { content_requested: m.content_requested } : {}),
    ...(m.content_delivered !== undefined ? { content_delivered: m.content_delivered } : {}),
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      position: r.position,
      ...(r.content !== undefined ? { content: r.content } : {}),
      ...(r.content_error !== undefined ? { content_error: r.content_error } : {}),
    })),
  };
}

/** Tool output for an extract: per URL either the page or the failure reason and category. */
function formatExtract(data: ExtractResponse) {
  return {
    successful: data.metadata?.successful_crawls,
    failed: data.metadata?.failed_crawls,
    credits_used: data.metadata?.credits_used,
    results: (data.results ?? []).map((r) => ({
      url: r.url,
      success: r.success,
      ...(r.success && r.markdown !== undefined ? { markdown: r.markdown } : {}),
      ...(r.success && r.html !== undefined ? { html: r.html } : {}),
      ...(r.status_code !== undefined ? { status_code: r.status_code } : {}),
      ...(!r.success && r.error !== undefined ? { error: r.error } : {}),
      ...(!r.success && r.error_type !== undefined ? { error_type: r.error_type } : {}),
    })),
  };
}

function parseSearchArgs(args: Record<string, unknown>): SearchParams {
  if (typeof args.q !== 'string' || args.q.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Query parameter "q" is required and must be a non-empty string');
  }
  if (args.q.length > 500) {
    throw new McpError(ErrorCode.InvalidParams, 'Query parameter "q" must be at most 500 characters');
  }
  if (args.include_content !== undefined && typeof args.include_content !== 'boolean') {
    throw new McpError(ErrorCode.InvalidParams, 'include_content must be a boolean');
  }
  if (args.content_results !== undefined && args.content_results !== 5 && args.content_results !== 10) {
    throw new McpError(ErrorCode.InvalidParams, 'content_results must be exactly 5 or 10');
  }
  // Only q, include_content and content_results exist on the API.
  return {
    q: args.q,
    ...(args.include_content !== undefined ? { include_content: args.include_content as boolean } : {}),
    ...(args.content_results !== undefined ? { content_results: args.content_results as 5 | 10 } : {}),
  };
}

function parseExtractArgs(args: Record<string, unknown>): ExtractParams {
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
  // Stealth mode is not exposed: it ends on 2026-11-01.
  return {
    urls: urls as string[],
    ...(args.format !== undefined ? { format: args.format as 'markdown' | 'html' } : {}),
  };
}

class SerpexServer {
  private server: Server;
  private client: SerpexClient;

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

    // `userAgent` (serpex >= 2.11.1) adds this server to the SDK's User-Agent
    // ("serpex-js/<sdk> serpex-mcp/<version>"); older SDKs ignore it. Typed as
    // an intersection so it compiles against either.
    const options: SerpexClientOptions & { userAgent?: string } = {
      userAgent: `serpex-mcp/${VERSION}`,
    };
    this.client = new SerpexClient(API_KEY as string, BASE_URL, options);

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
                description: 'Search query (max 500 characters). Operators such as site:, -site:, after:YYYY-MM-DD and before:YYYY-MM-DD go inside the query.',
              },
              include_content: {
                type: 'boolean',
                description: 'Also fetch full page content (markdown) for the top results, inline with the search response. Best-effort: results that fail to extract carry a content_error instead of content. Costs 3 credits (5 pages) or 6 (10 pages) instead of 1. Default: false.',
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
          description: 'Extract the content of known web pages with Serpex. Returns each page as clean markdown (or HTML). Up to 10 URLs per call; pages that cannot be extracted return success: false with an error and an error_type, and are not charged.',
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
        return await this.handleExtract(parseExtractArgs(args));
      }
      return await this.handleSearch(parseSearchArgs(args));
    });
  }

  private async handleExtract(params: ExtractParams): Promise<ToolResult> {
    try {
      return textResult(formatExtract(await this.client.extract(params)));
    } catch (error) {
      return errorResult(describeError(error, 'Extract'));
    }
  }

  private async handleSearch(params: SearchParams): Promise<ToolResult> {
    try {
      return textResult(formatSearch(await this.client.search(params)));
    } catch (error) {
      return errorResult(describeError(error, 'Search'));
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
