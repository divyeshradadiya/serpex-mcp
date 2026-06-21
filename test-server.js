#!/usr/bin/env node

/**
 * Test script for Serpex MCP Server
 * This simulates how Jan AI would interact with the MCP server
 */

import { spawn } from "child_process";
import readline from "readline";

const API_KEY =
  "sk_900865f78c1dd760c3253f5e4c406710d6931532e58822cc90f4bd09e70a35c4";

async function testMCPServer() {
  console.log("🚀 Starting Serpex MCP Server Test\n");

  // Start the MCP server
  const server = spawn("node", ["build/index.js"], {
    env: { ...process.env, SERPEX_API_KEY: API_KEY },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  server.stderr.on("data", (data) => {
    console.log("Server:", data.toString().trim());
  });

  // Helper to send JSON-RPC request
  function sendRequest(method, params = {}) {
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };
    console.log("\n📤 Sending request:", JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + "\n");
  }

  // Handle responses
  rl.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      console.log("\n📥 Received response:", JSON.stringify(response, null, 2));
    } catch (e) {
      console.log("Raw output:", line);
    }
  });

  // Wait a bit for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 1: Initialize
  console.log("\n=== Test 1: Initialize ===");
  sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0",
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 2: List tools
  console.log("\n=== Test 2: List Tools ===");
  sendRequest("tools/list");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 3: Search for "OpenAI"
  console.log("\n=== Test 3: Search Query ===");
  sendRequest("tools/call", {
    name: "serpex_search",
    arguments: {
      q: "OpenAI GPT-4",
      engine: "google",
      time_range: "month",
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Test 4: Search with auto engine
  console.log("\n=== Test 4: Auto Engine Search ===");
  sendRequest("tools/call", {
    name: "serpex_search",
    arguments: {
      q: "Model Context Protocol",
      engine: "auto",
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("\n✅ Tests completed! Shutting down...\n");
  server.kill();
  process.exit(0);
}

testMCPServer().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
