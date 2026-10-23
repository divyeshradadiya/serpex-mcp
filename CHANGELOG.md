# Changelog

## 1.2.1 — 2026-10-23

- Calls the API through the official `serpex` SDK (`^2.11.0`) instead of its own axios client, so parameters, timeouts and error parsing cannot drift from the API. `axios` is no longer a dependency.
- Errors: one actionable sentence per HTTP status (400 fix arguments, 401 check `SERPEX_API_KEY`, 402 out of credits with the balance, 429 retry after N ms with the plan limit, 5xx temporary and not charged, with the request id). An object-shaped error body no longer shows as `[object Object]`.
- `serpex_extract` output adds `error_type` for failed URLs and no longer includes the empty `markdown` of a failure.
- `serpex_search` rejects a query over 500 characters before sending it; the `q` description lists the search operators.
- New optional `SERPEX_BASE_URL`.
- `User-Agent: serpex-js/<sdk> serpex-mcp/1.2.1` with serpex >= 2.11.1.
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
