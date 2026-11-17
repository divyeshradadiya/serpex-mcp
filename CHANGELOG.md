# Changelog

## 1.4.2 — 2026-11-17

- Package description, README and integration guide: Serpex is a web search engine built for AI agents; use cases (research, data enrichment, legal, hiring, sales, finance) listed; both extract and search endpoints named.
- The missing-key error now points to the Serpex dashboard.
- No change to tools, inputs, outputs or API calls.

## 1.4.1 — 2026-11-17

- The server starts without `SERPEX_API_KEY`. MCP clients and registries (such as Glama) start servers without secrets to list their tools. Before this release the server exited at start-up; now `tools/list` works and each tool call returns `SERPEX_API_KEY is not set…` (not charged, no request sent). Arguments are still validated first. A blank key counts as missing.
- `glama.json` added (Glama listing ownership).
- Tools, inputs, outputs and the API calls are unchanged.

## 1.4.0 — 2026-11-02

- Removed the `stealth` option. It ended 1 Nov 2026; the API answers 410 to older versions that send it.

## 1.3.0 — 2026-10-23

- Calls the API through the official `serpex` SDK (`^2.12.0`) instead of its own axios client, so parameters, timeouts and error parsing cannot drift from the API. `axios` is no longer a dependency. Tool names, inputs and output fields are unchanged; error texts are new.
- Errors: one actionable sentence per HTTP status (400 fix arguments, 401 check `SERPEX_API_KEY`, 402 out of credits with the balance, 429 retry after N ms with the plan limit, 5xx temporary and not charged, with the request id). An object-shaped error body no longer shows as `[object Object]`.
- `serpex_extract` output adds `error_type` for failed URLs and no longer includes the empty `markdown` of a failure.
- `serpex_search` rejects a query over 500 characters before sending it; the `q` description lists the search operators.
- New optional `SERPEX_BASE_URL`.
- `User-Agent: serpex-js/<sdk> serpex-mcp/1.3.0`.
- Published files limited to `build/`, README, LICENSE and CHANGELOG.
- `npm test` is now an offline contract test against a local mock API serving recorded responses (`test/fixtures/`).

## 1.2.0 — 2026-10-01

- New `serpex_extract` tool: extract up to 10 known URLs as markdown or HTML (`POST /api/crawl`).
- `serpex_search` output: adds `status`, `credits_used` and the no-results `message`; drops the `engines` / per-result `engine` fields (always `"auto"`, no information for the model).
- Timeouts: 60 s search, 100 s with `include_content`, 100 s extract (was 30 s for everything, shorter than the server's own budget for content searches).
- Every request sends `User-Agent: serpex-mcp/<version>`.

## 1.1.2 — 2026-09-22

- docs: positioning — Serpex is a real-time web search API; tool description, README and integration guide updated. `engine` deprecated (ignored by the API since 2026-06); this server never sent it and still doesn't. Tool name, inputs and output fields unchanged.
- `npm test` is now an offline smoke test (`initialize` + `tools/list`), no API key or network needed.
- package description, keywords and repository URL updated; PUBLISHING.md matches the tag-triggered workflow.
