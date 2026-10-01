#!/usr/bin/env node

/**
 * Offline smoke test for the Serpex MCP server — no network, no real API key.
 * Starts the built server over stdio, runs `initialize` + `tools/list`, and
 * checks that `serpex_search` and `serpex_extract` are exposed with their
 * documented inputs (and that no stealth input is exposed).
 * (Live `tools/call` checks need SERPEX_API_KEY and are intentionally not run here.)
 */

import { spawn } from "child_process";
import readline from "readline";

const server = spawn("node", ["build/index.js"], {
  env: { ...process.env, SERPEX_API_KEY: "offline-test-key" },
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

function fail(message) {
  console.error(`FAIL: ${message}`);
  server.kill();
  process.exit(1);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "offline-test", version: "1.0.0" },
  });
  if (!init.result) fail(`initialize returned ${JSON.stringify(init)}`);
  console.log(`ok  initialize -> ${init.result.serverInfo.name} ${init.result.serverInfo.version}`);

  const list = await request("tools/list");
  const tool = (list.result?.tools || []).find((t) => t.name === "serpex_search");
  if (!tool) fail("serpex_search not listed");
  const props = Object.keys(tool.inputSchema.properties).sort().join(",");
  if (props !== "content_results,include_content,q") fail(`unexpected inputs: ${props}`);
  console.log(`ok  tools/list -> serpex_search(${props})`);

  const extract = (list.result?.tools || []).find((t) => t.name === "serpex_extract");
  if (!extract) fail("serpex_extract not listed");
  const extractProps = Object.keys(extract.inputSchema.properties).sort().join(",");
  if (extractProps !== "format,urls") fail(`unexpected extract inputs: ${extractProps}`);
  console.log(`ok  tools/list -> serpex_extract(${extractProps})`);

  if (init.result.serverInfo.version !== "1.2.0") {
    fail(`server version ${init.result.serverInfo.version}, expected 1.2.0`);
  }

  server.kill();
  console.log("PASS");
  process.exit(0);
} catch (error) {
  fail(error.message);
}
