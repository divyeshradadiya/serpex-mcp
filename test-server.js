#!/usr/bin/env node

/**
 * Offline tests for the Serpex MCP server — no network, no real API key.
 *
 * Starts a local mock of the Serpex API that answers with the sanitized
 * fixtures in test/fixtures (captured from api.serpex.dev on 2026-10-23; the
 * statuses that cannot be triggered safely use the exact body from the backend
 * code), points the built server at it with SERPEX_BASE_URL, and drives it over
 * stdio: initialize, tools/list, then tools/call for every response shape and
 * error status. The fixture to serve is named in the query (search) or in the
 * first URL's path (extract).
 */

import { spawn } from "child_process";
import { readFileSync } from "fs";
import http from "http";
import readline from "readline";

const FIXTURES = new URL("./test/fixtures/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", FIXTURES), "utf8"));
const fixture = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), "utf8"));

// ---- mock Serpex API --------------------------------------------------------
const seen = [];
const api = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://mock");
    const parsed = body ? JSON.parse(body) : undefined;
    seen.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: parsed, headers: req.headers });
    let name;
    if (url.pathname === "/api/search") name = url.searchParams.get("q");
    else if (url.pathname === "/api/crawl") name = new URL(parsed.urls[0]).pathname.slice(1);
    if (!manifest[name]) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `mock: no fixture ${name}` }));
      return;
    }
    const { status, headers } = manifest[name];
    res.writeHead(status, { ...headers, "content-type": "application/json" });
    res.end(JSON.stringify(fixture(name)));
  });
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${api.address().port}`;

// ---- MCP server over stdio --------------------------------------------------
const server = spawn("node", ["build/index.js"], {
  env: { ...process.env, SERPEX_API_KEY: "offline-test-key", SERPEX_BASE_URL: BASE },
  stdio: ["pipe", "pipe", "pipe"],
});

const pending = new Map();
let nextId = 1;
readline.createInterface({ input: server.stdout }).on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  } catch {
    // ignore non-JSON output
  }
});

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`ok  ${label}`);
  else {
    failures++;
    console.error(`FAIL ${label}`);
  }
}

async function call(name, args) {
  const msg = await request("tools/call", { name, arguments: args });
  if (msg.error) return { rpcError: msg.error };
  const text = msg.result.content[0].text;
  return { isError: msg.result.isError === true, text, json: msg.result.isError ? undefined : JSON.parse(text) };
}

try {
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "offline-test", version: "1.0.0" },
  });
  check(init.result?.serverInfo?.version === "1.3.0", `initialize -> ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version}`);

  const list = await request("tools/list");
  const tools = list.result?.tools || [];
  const search = tools.find((t) => t.name === "serpex_search");
  const extract = tools.find((t) => t.name === "serpex_extract");
  check(search && Object.keys(search.inputSchema.properties).sort().join(",") === "content_results,include_content,q", "serpex_search(q, include_content, content_results)");
  check(extract && Object.keys(extract.inputSchema.properties).sort().join(",") === "format,urls", "serpex_extract(urls, format), no stealth input");
  const allText = JSON.stringify(tools).toLowerCase();
  check(!/multi-engine|serp api|cheapest|\bengines?\b/.test(allText), "tool descriptions name no engines");

  // --- search shapes ---
  let r = await call("serpex_search", { q: "search_plain" });
  let req = seen.at(-1);
  check(req.method === "GET" && req.path === "/api/search" && Object.keys(req.query).join(",") === "q", "plain search sends only q");
  const ua = req.headers["user-agent"] || "";
  check(/^serpex-js\/2\.(1[2-9]|[2-9]\d)\.\d+ serpex-mcp\/1\.3\.0$/.test(ua), `User-Agent (${ua})`);
  check(req.headers.authorization === "Bearer offline-test-key", "Bearer auth");
  check(!r.isError && r.json.status === "success" && r.json.credits_used === 1 && r.json.results.length === 10, "plain search: status, credits, 10 results");
  check(r.json.results.every((x) => !("engine" in x) && !("content" in x) && !("content_error" in x)), "plain search: no engine/content keys");

  r = await call("serpex_search", { q: "search_content", include_content: true, content_results: 5 });
  req = seen.at(-1);
  check(req.query.include_content === "true" && req.query.content_results === "5", "include_content + content_results sent");
  check(r.json.content_requested === 5 && r.json.content_delivered === 5 && r.json.credits_used === 3, "content metadata forwarded");
  check(r.json.results.slice(0, 5).every((x) => typeof x.content === "string") && r.json.results.slice(5).every((x) => !("content" in x)), "content on the first 5 only");

  r = await call("serpex_search", { q: "search_content_errors", include_content: true });
  check(r.json.results.slice(0, 5).every((x) => x.content_error === "robots_disallowed" && !("content" in x)), "content_error forwarded, exclusive with content");

  r = await call("serpex_search", { q: "search_no_results" });
  check(r.json.status === "no_results" && r.json.credits_used === 0 && /not charged/.test(r.json.message), "no_results: status, 0 credits, message");

  // --- search errors ---
  const errorCases = [
    ["error_401_bad_key", /HTTP 401.*SERPEX_API_KEY/],
    ["error_402_search", /Out of Serpex credits \(HTTP 402\)\. Balance: 0 credits/],
    ["error_429", /rate limit exceeded \(limit: 5 requests per second\)\. Retry in 292 ms/i],
    ["error_400_content_results", /HTTP 400\): content_results must be 5 or 10/],
    ["error_503_search", /temporarily unavailable \(HTTP 503\): Search temporarily unavailable, please retry\. Not charged\.$/],
    ["error_500_search", /HTTP 500\): Internal server error\. Not charged\. Retry shortly\. Request id: /],
    ["error_500_malformed_json", /Unexpected end of JSON input/],
  ];
  for (const [name, pattern] of errorCases) {
    r = await call("serpex_search", { q: name });
    check(r.isError && pattern.test(r.text) && !r.text.includes("[object Object]"), `${name} -> "${r.text}"`);
  }

  // --- argument validation never reaches the API ---
  const before = seen.length;
  r = await call("serpex_search", { q: "x", content_results: 7 });
  check(r.rpcError && seen.length === before, "content_results 7 rejected locally");
  r = await call("serpex_search", { q: "" });
  check(r.rpcError && seen.length === before, "empty q rejected locally");

  // --- extract ---
  r = await call("serpex_extract", { urls: ["https://example.com/extract_markdown"] });
  req = seen.at(-1);
  check(req.method === "POST" && req.path === "/api/crawl" && JSON.stringify(req.body) === JSON.stringify({ urls: ["https://example.com/extract_markdown"] }), "extract sends only urls");
  check(!r.isError && r.json.successful === 1 && r.json.credits_used === 1 && typeof r.json.results[0].markdown === "string", "extract markdown");

  r = await call("serpex_extract", { urls: ["https://example.com/extract_html"], format: "html" });
  check(seen.at(-1).body.format === "html" && typeof r.json.results[0].html === "string", "extract html");

  r = await call("serpex_extract", { urls: ["https://example.com/extract_failed_404"] });
  const failed = r.json.results[0];
  check(failed.success === false && failed.error_type === "http" && failed.status_code === 404 && failed.error === "HTTP 404: Not Found" && !("markdown" in failed), "extract failure: error + error_type, no empty markdown");

  for (const [name, pattern] of [
    ["error_504_extract", /HTTP 504\): Extraction timed out upstream and was not charged\. Retry, or split the request into fewer URLs\.$/],
    ["error_502_extract", /HTTP 502.*Request id/],
    ["error_402_extract", /HTTP 402/],
  ]) {
    r = await call("serpex_extract", { urls: [`https://example.com/${name}`] });
    check(r.isError && pattern.test(r.text), `${name} -> "${r.text}"`);
  }
} catch (error) {
  failures++;
  console.error(`FAIL ${error.message}`);
} finally {
  server.kill();
  api.close();
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("PASS");
process.exit(0);
